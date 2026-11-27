// Version control and approval for competence standards.
import type { Express } from "express";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { assessments, competenceCriteria, competencyElements, competencyElementVersions, competencyLevels, users } from "@shared/schema";
import { differences, snapshotOf, type StandardSnapshot } from "@shared/standardVersions";
import * as v from "./services/standardVersions";

const AUTHORS = ["admin", "super_admin", "developer"];

const text = (max: number) => z.string().max(max).nullable().optional();
const criterion = z.object({
  id: z.string().max(100).nullable().optional(), code: z.string().trim().min(1).max(40), type: z.enum(["knowledge", "performance"]), criteriaText: z.string().trim().min(1).max(8000),
  criteriaNumber: z.number().int().min(0).max(100000), levelId: text(100), subcategoryId: text(100), subcategoryNumber: z.number().int().nullable().optional(),
  assessmentMethods: z.array(z.string().max(100)).max(30).nullable().optional(), assessorGuidance: text(8000), guidanceNumber: text(40), criticalityRating: text(20),
  required: z.boolean().nullable().optional(), applicableLevels: z.array(z.string().max(100)).max(50).nullable().optional(),
  mcqOptions: z.array(z.string().max(1000)).max(20).nullable().optional(), mcqCorrectAnswerIndex: z.number().int().min(0).max(19).nullable().optional(),
}).strict();
const draftBody = z.object({
  changeSummary: z.string().max(4000),
  snapshot: z.object({
    element: z.object({
      name: z.string().trim().min(1).max(300), code: text(80), description: text(8000), safetyCriticality: z.enum(["Low", "Medium", "High"]),
      validityMonths: z.number().int().min(1).max(600).nullable().optional(), reassessmentYears: z.number().int().min(0).max(50).nullable().optional(),
      proficiencyScale: z.string().max(40), requiresAssessorGuidance: z.boolean().nullable().optional(), assessorGuidance: text(8000), selfAssessmentEnabled: z.boolean().nullable().optional(),
    }).strict(),
    criteria: z.array(criterion).max(600),
  }).strict(),
}).strict();

export function registerStandardVersionRoutes(app: Express, deps: { requireRole: (...roles: string[]) => any; actingUser: (req: any) => Promise<{ id: string; roles: string[] }>; ownNameOnly: any }) {
  const { requireRole, actingUser, ownNameOnly } = deps;
  const author = requireRole(...AUTHORS);

  const handle = (fn: (req: any, res: any, me: { id: string; roles: string[]; isAdmin: boolean; isSuper: boolean }) => Promise<unknown>) => async (req: any, res: any) => {
    try {
      const me = await actingUser(req);
      const isSuper = me.roles.includes("super_admin") || me.roles.includes("developer");
      const out = await fn(req, res, { ...me, isSuper, isAdmin: isSuper || me.roles.includes("admin") });
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (e: any) {
      if (e instanceof v.VersionError) return res.status(e.status).json({ error: e.message });
      if (e instanceof z.ZodError) return res.status(400).json({ error: `Some of the wording is not valid: ${e.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` });
      console.error("Standard version request failed:", e);
      res.status(500).json({ error: "The request could not be completed" });
    }
  };

  // every standard with where its version control stands
  app.get("/api/standard-versions/overview", author, handle(async () => {
    const [elements, versions] = await Promise.all([
      db.select().from(competencyElements).where(eq(competencyElements.isActive, true)).orderBy(asc(competencyElements.code), asc(competencyElements.name)),
      db.select({ id: competencyElementVersions.id, elementId: competencyElementVersions.elementId, versionNumber: competencyElementVersions.versionNumber, status: competencyElementVersions.status, createdBy: competencyElementVersions.createdBy, submittedBy: competencyElementVersions.submittedBy, submittedAt: competencyElementVersions.submittedAt }).from(competencyElementVersions),
    ]);
    return elements.map((e) => {
      const own = versions.filter((x) => x.elementId === e.id);
      const current = own.find((x) => x.id === e.currentVersionId);
      const open = own.find((x) => x.status === "draft" || x.status === "in_review");
      return { id: e.id, code: e.code, name: e.name, changeControl: !!e.changeControl, currentVersion: current?.versionNumber ?? null, currentStatus: current?.status ?? null, open: open ? { id: open.id, versionNumber: open.versionNumber, status: open.status } : null };
    });
  }));

  app.get("/api/standards/:id/versions", author, handle(async (req, _res, me) => {
    const element = (await db.select().from(competencyElements).where(eq(competencyElements.id, req.params.id)))[0];
    if (!element) throw new v.VersionError(404, "That standard does not exist");
    const [history, levels, live] = await Promise.all([v.historyOf(element.id), db.select().from(competencyLevels).where(eq(competencyLevels.elementId, element.id)), v.liveSnapshot(element.id)]);
    const approver = element.standardApproverId ? (await db.select().from(users).where(eq(users.id, element.standardApproverId)))[0] : undefined;
    return {
      element: { id: element.id, code: element.code, name: element.name, changeControl: !!element.changeControl, currentVersionId: element.currentVersionId, approverName: approver ? `${approver.firstName} ${approver.lastName}` : null },
      levels: levels.map((l) => ({ id: l.id, name: l.name })), live,
      versions: history.map((h) => ({ ...h, mayDecide: h.status === "in_review" && !v.approverBlock(h, element, me), blockedBecause: h.status === "in_review" ? v.approverBlock(h, element, me) : null })),
    };
  }));

  app.post("/api/standards/:id/versions", author, handle(async (req, res, me) => { res.status(201); return v.startDraft(req.params.id, me.id); }));

  app.put("/api/standards/:id/change-control", requireRole("admin", "super_admin", "developer"), handle(async (req, _res, me) => {
    const on = z.object({ on: z.boolean() }).strict().parse(req.body).on;
    // turning it off removes a safeguard, so only a super administrator may
    if (!on && !me.isSuper) throw new v.VersionError(403, "Only a super administrator can take a standard out of change control");
    if (on) await v.versionOfLiveWording(req.params.id, me.id, "Wording in use when change control was switched on");
    await db.update(competencyElements).set({ changeControl: on }).where(eq(competencyElements.id, req.params.id));
    return { ok: true, changeControl: on };
  }));

  app.get("/api/standard-versions/:id", author, handle(async (req) => {
    const version = await v.getVersion(req.params.id);
    const live = await v.liveSnapshot(version.elementId);
    const all = await v.historyOf(version.elementId);
    // compared with what it would replace: the live wording while it is open, otherwise the version before it
    const previous = all.filter((x) => x.versionNumber < version.versionNumber && x.status !== "rejected" && x.status !== "draft")[0];
    const base = version.status === "draft" || version.status === "in_review" ? live : (previous?.snapshot as StandardSnapshot | undefined);
    return { version, changes: base ? differences(base, version.snapshot as StandardSnapshot) : [], comparedWith: version.status === "draft" || version.status === "in_review" ? "the wording in use now" : previous ? `version ${previous.versionNumber}` : null };
  }));

  app.put("/api/standard-versions/:id", author, handle(async (req) => {
    const body = draftBody.parse(req.body);
    return v.saveDraft(req.params.id, snapshotOf(body.snapshot.element, body.snapshot.criteria as any[]), body.changeSummary);
  }));

  app.post("/api/standard-versions/:id/submit", author, handle(async (req, _res, me) => v.submit(req.params.id, me.id)));

  // the named approver need not be an administrator, so the rule is applied to the person rather than to a role
  app.post("/api/standard-versions/:id/decide", requireRole("admin", "super_admin", "developer", "manager", "assessor", "internal_verifier"), ownNameOnly, handle(async (req, _res, me) => {
    const body = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().max(4000).default("") }).strict().parse(req.body);
    return v.decide(req.params.id, me, body.decision, body.note);
  }));

  app.post("/api/standard-versions/:id/withdraw", author, handle(async (req, _res, me) => v.withdraw(req.params.id, me.id, me.isAdmin)));

  // versions waiting for the signed-in person's decision, including those where they are the named approver
  app.get("/api/standard-versions/waiting/mine", requireRole("admin", "super_admin", "developer", "manager", "assessor", "internal_verifier"), handle(async (_req, _res, me) => {
    const waiting = await db.select({ version: competencyElementVersions, element: competencyElements }).from(competencyElementVersions)
      .innerJoin(competencyElements, eq(competencyElementVersions.elementId, competencyElements.id)).where(eq(competencyElementVersions.status, "in_review"));
    return waiting.filter((w) => !v.approverBlock(w.version, w.element, me)).map((w) => ({ id: w.version.id, elementId: w.element.id, code: w.element.code, name: w.element.name, versionNumber: w.version.versionNumber, changeSummary: w.version.changeSummary, submittedAt: w.version.submittedAt, changes: [] as unknown[] }));
  }));
  app.get("/api/standard-versions/waiting/:id", requireRole("admin", "super_admin", "developer", "manager", "assessor", "internal_verifier"), handle(async (req, _res, me) => {
    const version = await v.getVersion(req.params.id);
    const element = (await db.select().from(competencyElements).where(eq(competencyElements.id, version.elementId)))[0];
    if (version.status !== "in_review" || v.approverBlock(version, element, me)) throw new v.VersionError(403, "This version is not waiting for your decision");
    return { version, changes: differences(await v.liveSnapshot(version.elementId), version.snapshot as StandardSnapshot), element: { code: element.code, name: element.name } };
  }));
}

/**
 * The wording an assessment was signed off against. Visible to whoever may see the assessment itself.
 */
export async function assessedWording(assessmentId: string) {
  const a = (await db.select().from(assessments).where(eq(assessments.id, assessmentId)))[0];
  if (!a?.elementVersionId) return null;
  const version = (await db.select().from(competencyElementVersions).where(eq(competencyElementVersions.id, a.elementVersionId)))[0];
  return version ? { versionNumber: version.versionNumber, status: version.status, snapshot: version.snapshot as StandardSnapshot } : null;
}

/** refuses a direct change to a standard that is under change control, whichever route is used */
export function underChangeControl(find: (req: any) => Promise<string | string[] | null | undefined>) {
  return async (req: any, res: any, next: any) => {
    try {
      const found = await find(req);
      const ids = (Array.isArray(found) ? found : [found]).filter((x): x is string => !!x);
      if (ids.length) {
        const controlled = await db.select({ id: competencyElements.id, code: competencyElements.code, name: competencyElements.name }).from(competencyElements)
          .where(and(inArray(competencyElements.id, ids), eq(competencyElements.changeControl, true)));
        if (controlled.length) return res.status(409).json({ error: `${controlled[0].code ?? controlled[0].name} is under change control. Make the change in a new version and have it approved (Standard Versions).`, code: "CHANGE_CONTROL" });
      }
      next();
    } catch (e) {
      console.error("Could not check change control:", e);
      res.status(500).json({ error: "The request could not be completed" });
    }
  };
}
export const elementOfCriterion = async (id: string) => (await db.select({ e: competenceCriteria.elementId }).from(competenceCriteria).where(eq(competenceCriteria.id, id)))[0]?.e;
export const elementOfLevel = async (id: string) => (await db.select({ e: competencyLevels.elementId }).from(competencyLevels).where(eq(competencyLevels.id, id)))[0]?.e;
