// Version control for competence standards. See shared/standardVersions.ts for what a version holds.
//
// - A version is a complete copy of the wording. Draft versions are edited without touching the live standard.
// - Approval is by someone other than the author and the person who submitted it. Approving applies the wording to the live standard.
// - Every sign-off keeps the version that was assessed. If the live wording no longer matches the current version (it was changed
//   directly, which only a standard without change control allows), the wording is recorded as a new version at that moment.
// - A standard "under change control" can only be changed through a version.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { competenceCriteria, competencyElements, competencyElementVersions, users } from "@shared/schema";
import { CRITERION_FIELDS, ELEMENT_FIELDS, sameWording, snapshotOf, type StandardSnapshot } from "@shared/standardVersions";

export class VersionError extends Error { constructor(public status: number, message: string) { super(message); } }

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export async function liveSnapshot(elementId: string, tx: Tx = db): Promise<StandardSnapshot> {
  const element = (await tx.select().from(competencyElements).where(eq(competencyElements.id, elementId)))[0];
  if (!element) throw new VersionError(404, "That standard does not exist");
  const criteria = await tx.select().from(competenceCriteria).where(and(eq(competenceCriteria.elementId, elementId), eq(competenceCriteria.isActive, true)));
  return snapshotOf(element as any, criteria as any[]);
}

async function nextNumber(elementId: string, tx: Tx): Promise<number> {
  const r = await tx.select({ n: sql<number>`coalesce(max(${competencyElementVersions.versionNumber}), 0)::int` }).from(competencyElementVersions).where(eq(competencyElementVersions.elementId, elementId));
  return (r[0]?.n ?? 0) + 1;
}

const lock = (tx: Tx, elementId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"standard:" + elementId}))`);

/** the version that holds the live wording as it stands now, recording a new one if there is none */
export async function versionOfLiveWording(elementId: string, actorId: string | null, reason: string): Promise<string> {
  return db.transaction(async (tx) => {
    await lock(tx, elementId);
    const element = (await tx.select().from(competencyElements).where(eq(competencyElements.id, elementId)))[0];
    if (!element) throw new VersionError(404, "That standard does not exist");
    const live = await liveSnapshot(elementId, tx);
    const current = element.currentVersionId ? (await tx.select().from(competencyElementVersions).where(eq(competencyElementVersions.id, element.currentVersionId)))[0] : undefined;
    if (current && sameWording(current.snapshot as StandardSnapshot, live)) return current.id;
    const made = (await tx.insert(competencyElementVersions).values({
      elementId, versionNumber: await nextNumber(elementId, tx), status: "recorded", snapshot: live, changeSummary: reason, createdBy: actorId, appliedAt: new Date(),
    }).returning())[0];
    if (current && (current.status === "approved" || current.status === "recorded")) await tx.update(competencyElementVersions).set({ status: "superseded", updatedAt: new Date() }).where(eq(competencyElementVersions.id, current.id));
    await tx.update(competencyElements).set({ currentVersionId: made.id }).where(eq(competencyElements.id, elementId));
    return made.id;
  });
}

export async function startDraft(elementId: string, actorId: string) {
  await versionOfLiveWording(elementId, actorId, "Wording in use before version control started, or changed directly");
  return db.transaction(async (tx) => {
    await lock(tx, elementId);
    const open = (await tx.select({ id: competencyElementVersions.id }).from(competencyElementVersions)
      .where(and(eq(competencyElementVersions.elementId, elementId), inArray(competencyElementVersions.status, ["draft", "in_review"]))))[0];
    if (open) throw new VersionError(409, "There is already a version being worked on for this standard");
    const live = await liveSnapshot(elementId, tx);
    return (await tx.insert(competencyElementVersions).values({ elementId, versionNumber: await nextNumber(elementId, tx), status: "draft", snapshot: live, changeSummary: "", createdBy: actorId }).returning())[0];
  });
}

export async function getVersion(id: string) {
  const v = (await db.select().from(competencyElementVersions).where(eq(competencyElementVersions.id, id)))[0];
  if (!v) throw new VersionError(404, "That version does not exist");
  return v;
}

export async function saveDraft(id: string, snapshot: StandardSnapshot, changeSummary: string) {
  const v = await getVersion(id);
  if (v.status !== "draft") throw new VersionError(409, "Only a draft can be edited");
  const keys = new Set<string>();
  for (const c of snapshot.criteria) {
    const k = `${c.type}|${c.code.trim().toLowerCase()}`;
    if (keys.has(k)) throw new VersionError(400, `Two ${c.type} criteria have the code ${c.code}`);
    keys.add(k);
  }
  // only criteria that already belong to this standard may keep their identity
  const own = new Set((await db.select({ id: competenceCriteria.id }).from(competenceCriteria).where(eq(competenceCriteria.elementId, v.elementId))).map((r) => r.id));
  for (const c of snapshot.criteria) if (c.id && !own.has(c.id)) throw new VersionError(400, "A criterion in this draft belongs to another standard");
  return (await db.update(competencyElementVersions).set({ snapshot, changeSummary, updatedAt: new Date() }).where(and(eq(competencyElementVersions.id, id), eq(competencyElementVersions.status, "draft"))).returning())[0];
}

export async function submit(id: string, actorId: string) {
  const v = await getVersion(id);
  if (v.status !== "draft") throw new VersionError(409, "Only a draft can be sent for approval");
  if ((v.changeSummary ?? "").trim().length < 5) throw new VersionError(400, "Say what has changed and why before sending it for approval");
  if (sameWording(v.snapshot as StandardSnapshot, await liveSnapshot(v.elementId))) throw new VersionError(400, "Nothing has been changed yet");
  return (await db.update(competencyElementVersions).set({ status: "in_review", submittedBy: actorId, submittedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(competencyElementVersions.id, id), eq(competencyElementVersions.status, "draft"))).returning())[0];
}

/** why this person may not decide on this version, or null when they may */
export function approverBlock(v: { createdBy: string | null; submittedBy: string | null }, element: { standardApproverId: string | null }, actor: { id: string; isAdmin: boolean; isSuper: boolean }): string | null {
  if (actor.id === v.createdBy || actor.id === v.submittedBy) return "A version must be approved by someone other than the person who wrote or submitted it";
  if (element.standardApproverId) return actor.id === element.standardApproverId || actor.isSuper ? null : "Only the standard's named approver can decide on this version";
  return actor.isAdmin ? null : "Only an administrator or the standard's named approver can decide on this version";
}

/** makes the live standard match an approved version */
async function applySnapshot(tx: Tx, elementId: string, snapshot: StandardSnapshot) {
  const element: Record<string, any> = {};
  for (const f of ELEMENT_FIELDS) if (snapshot.element[f] !== undefined) element[f] = snapshot.element[f];
  await tx.update(competencyElements).set({ ...element, updatedAt: new Date() }).where(eq(competencyElements.id, elementId));
  const live = await tx.select().from(competenceCriteria).where(and(eq(competenceCriteria.elementId, elementId), eq(competenceCriteria.isActive, true)));
  const keep = new Set(snapshot.criteria.map((c) => c.id).filter(Boolean) as string[]);
  // removed criteria are switched off, never deleted: past answers and records still refer to them
  for (const c of live) if (!keep.has(c.id)) await tx.update(competenceCriteria).set({ isActive: false }).where(eq(competenceCriteria.id, c.id));
  for (const c of snapshot.criteria) {
    const values: Record<string, any> = {};
    for (const f of CRITERION_FIELDS) values[f] = (c as any)[f] ?? null;
    values.description = c.criteriaText;
    values.isActive = true;
    if (c.id) await tx.update(competenceCriteria).set(values).where(and(eq(competenceCriteria.id, c.id), eq(competenceCriteria.elementId, elementId)));
    else await tx.insert(competenceCriteria).values({ ...values, elementId } as any);
  }
}

export async function decide(id: string, actor: { id: string; isAdmin: boolean; isSuper: boolean }, decision: "approve" | "reject", note: string) {
  const v = await getVersion(id);
  if (v.status !== "in_review") throw new VersionError(409, "This version is not waiting for approval");
  const element = (await db.select().from(competencyElements).where(eq(competencyElements.id, v.elementId)))[0];
  const block = approverBlock(v, element, actor);
  if (block) throw new VersionError(403, block);
  if (decision === "reject" && note.trim().length < 5) throw new VersionError(400, "Say why it is being sent back");
  return db.transaction(async (tx) => {
    await lock(tx, v.elementId);
    const claimed = (await tx.update(competencyElementVersions).set({
      status: decision === "approve" ? "approved" : "rejected", decidedBy: actor.id, decidedAt: new Date(), decisionNote: note.trim() || null,
      appliedAt: decision === "approve" ? new Date() : null, updatedAt: new Date(),
    }).where(and(eq(competencyElementVersions.id, id), eq(competencyElementVersions.status, "in_review"))).returning())[0];
    if (!claimed) throw new VersionError(409, "Someone else has just decided on this version");
    if (decision === "approve") {
      await applySnapshot(tx, v.elementId, v.snapshot as StandardSnapshot);
      await tx.update(competencyElementVersions).set({ status: "superseded", updatedAt: new Date() })
        .where(and(eq(competencyElementVersions.elementId, v.elementId), inArray(competencyElementVersions.status, ["approved", "recorded"]), sql`${competencyElementVersions.id} <> ${id}`));
      await tx.update(competencyElements).set({ currentVersionId: id, lastReviewedAt: new Date(), lastReviewedBy: actor.id }).where(eq(competencyElements.id, v.elementId));
    }
    return claimed;
  });
}

/** sends a version that is waiting for approval back to being a draft, or removes an unapproved draft */
export async function withdraw(id: string, actorId: string, isAdmin: boolean) {
  const v = await getVersion(id);
  if (v.status !== "draft" && v.status !== "in_review") throw new VersionError(409, "Only unapproved work can be withdrawn");
  if (!isAdmin && v.createdBy !== actorId) throw new VersionError(403, "Only its author or an administrator can withdraw it");
  return (await db.update(competencyElementVersions).set({ status: "rejected", decidedBy: actorId, decidedAt: new Date(), decisionNote: "Withdrawn", updatedAt: new Date() }).where(eq(competencyElementVersions.id, id)).returning())[0];
}

export async function historyOf(elementId: string) {
  const list = await db.select().from(competencyElementVersions).where(eq(competencyElementVersions.elementId, elementId)).orderBy(desc(competencyElementVersions.versionNumber));
  const ids = Array.from(new Set(list.flatMap((v) => [v.createdBy, v.submittedBy, v.decidedBy]).filter(Boolean) as string[]));
  const names = new Map(ids.length ? (await db.select().from(users).where(inArray(users.id, ids))).map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()]) : []);
  return list.map((v) => ({ ...v, createdByName: v.createdBy ? names.get(v.createdBy) ?? null : null, submittedByName: v.submittedBy ? names.get(v.submittedBy) ?? null : null, decidedByName: v.decidedBy ? names.get(v.decidedBy) ?? null : null }));
}

export async function isChangeControlled(elementId: string): Promise<boolean> {
  const r = (await db.select({ c: competencyElements.changeControl }).from(competencyElements).where(eq(competencyElements.id, elementId)))[0];
  return !!r?.c;
}
