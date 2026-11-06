import { db } from "../db";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { users, retentionSettings, userExperience, userQualifications, absences, notificationLogs, auditEvents, jobRoles, type RetentionSettings } from "@shared/schema";
import { deleteObject } from "./objectStorage";
import { sendNotification } from "./notifications";
import { recordSystemEvent } from "./auditLog";

// Retention of leavers. When someone is archived they get a leaving date. Once a set number of months has passed after it,
// their personal details are removed: name, email, date of birth, company and Vantage numbers, photo, CV, career history,
// qualifications, absence notes and the copies of emails sent to them. Their competence and training history is kept, under
// "Former employee", because it is audit evidence and the compliance figures depend on it. Nothing happens automatically
// until an administrator turns it on, a person can be put on hold, and administrators are warned beforehand.

export class RetentionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const bad = (m: string) => new RetentionError(400, m);

export const RETENTION_SETTING_ID = "retention";
const DAY = 86_400_000;

export async function getSettings(): Promise<RetentionSettings> {
  const rows = await db.select().from(retentionSettings).limit(1);
  if (rows[0]) return rows[0];
  return (await db.insert(retentionSettings).values({}).returning())[0];
}

export async function updateSettings(input: { autoRemoveEnabled?: unknown; retentionMonths?: unknown; warnDays?: unknown }, actorId: string): Promise<RetentionSettings> {
  const current = await getSettings();
  const months = input.retentionMonths === undefined ? current.retentionMonths : Number(input.retentionMonths);
  const warn = input.warnDays === undefined ? current.warnDays : Number(input.warnDays);
  if (!Number.isInteger(months) || months < 1 || months > 120) throw bad("Keep details for between 1 and 120 months");
  if (!Number.isInteger(warn) || warn < 1 || warn > 180) throw bad("Warn administrators between 1 and 180 days beforehand");
  const enabled = input.autoRemoveEnabled === undefined ? current.autoRemoveEnabled : input.autoRemoveEnabled === true;
  return (await db.update(retentionSettings).set({ autoRemoveEnabled: enabled, retentionMonths: months, warnDays: warn, updatedBy: actorId, updatedAt: new Date() }).where(eq(retentionSettings.id, current.id)).returning())[0];
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

export interface ArchivedPerson {
  id: string; name: string; email: string | null; jobRole: string | null; location: string | null; leftAt: string | null;
  removeOn: string | null; daysLeft: number | null; held: boolean; holdReason: string | null; removed: boolean; removedAt: string | null;
}

export async function listArchived(): Promise<{ settings: RetentionSettings; people: ArchivedPerson[] }> {
  const settings = await getSettings();
  const rows = await db.select({ u: users, roleName: jobRoles.name }).from(users).leftJoin(jobRoles, eq(jobRoles.id, users.jobRoleId))
    .where(eq(users.isArchived, true)).orderBy(desc(users.leftAt));
  const now = Date.now();
  const people = rows.map(({ u, roleName }): ArchivedPerson => {
    const removed = !!u.anonymisedAt;
    const removeOn = u.leftAt && !removed ? addMonths(new Date(u.leftAt), settings.retentionMonths) : null;
    return {
      id: u.id, name: removed ? "Former employee" : [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id, email: removed ? null : u.email,
      jobRole: roleName ?? null, location: u.location, leftAt: u.leftAt ? new Date(u.leftAt).toISOString() : null,
      removeOn: removeOn ? removeOn.toISOString() : null, daysLeft: removeOn ? Math.ceil((removeOn.getTime() - now) / DAY) : null,
      held: !!u.retentionHold, holdReason: u.retentionHoldReason ?? null, removed, removedAt: u.anonymisedAt ? new Date(u.anonymisedAt).toISOString() : null,
    };
  });
  return { settings, people };
}

async function loadArchived(id: string) {
  const u = (await db.select().from(users).where(eq(users.id, id)))[0];
  if (!u) throw new RetentionError(404, "Person not found");
  if (!u.isArchived) throw bad("Only archived people can be put on hold or have their details removed");
  if (u.anonymisedAt) throw new RetentionError(409, "This person's details have already been removed");
  return u;
}

export async function setHold(id: string, hold: boolean, reason: string | undefined, actorId: string) {
  const u = await loadArchived(id);
  const why = (reason ?? "").trim();
  if (hold && why.length < 5) throw bad("Record why these details must be kept, so there is a trail");
  await db.update(users).set({ retentionHold: hold, retentionHoldReason: hold ? why : null, updatedAt: new Date() }).where(eq(users.id, id));
  await recordSystemEvent({ actorId, action: hold ? "retention-hold" : "retention-release", entityType: "user", entityId: id, entityLabel: [u.firstName, u.lastName].filter(Boolean).join(" "),
    summary: hold ? `Details kept past the retention period: ${why}` : "Retention hold released" });
}

/** Removes a person's personal details, keeping their competence and training history under "Former employee". */
export async function removePersonalDetails(id: string, actorId: string | null, how: "manual" | "automatic" = "manual") {
  const u = await loadArchived(id);
  if (u.retentionHold && how === "automatic") throw bad("This person is on hold");
  const short = id.slice(0, 8);
  const objects = [u.avatarObjectKey, u.cvObjectKey].filter((k): k is string => !!k);
  const label = `Former employee ${short}`;

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      firstName: "Former", lastName: "employee", email: `removed-${short}-${Date.now().toString(36)}@removed.invalid`, profileImageUrl: null, avatarObjectKey: null, avatarContentType: null,
      providerSub: null, dateOfBirth: null, companyNumber: null, vantageNumber: null, managerId: null, cvObjectKey: null, cvFileName: null, cvContentType: null, cvUploadedAt: null,
      isActive: false, retentionHold: false, retentionHoldReason: null, anonymisedAt: new Date(), updatedAt: new Date(),
    }).where(eq(users.id, id));
    await tx.delete(userExperience).where(eq(userExperience.userId, id));
    await tx.delete(userQualifications).where(eq(userQualifications.userId, id));
    await tx.update(absences).set({ notes: null }).where(eq(absences.userId, id));
    await tx.update(notificationLogs).set({ recipientEmail: "removed", subject: "(removed)", body: "(removed)", metadata: null }).where(eq(notificationLogs.recipientId, id));
    // The audit log is otherwise append-only. Names are taken out of the entries about this person so that removing their
    // details really does remove them; the entries themselves (what happened and when) stay.
    // Entries the person made themselves carry their name inside the summary sentence, so it is swapped there too.
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ");
    const mentions = fullName ? sql`replace(${auditEvents.summary}, ${fullName}, 'Former employee')` : auditEvents.summary;
    await tx.update(auditEvents).set({ actorName: "Former employee", summary: mentions }).where(eq(auditEvents.actorId, id));
    await tx.update(auditEvents).set({ actingAsName: "Former employee", summary: mentions }).where(eq(auditEvents.actingAsId, id));
    await tx.update(auditEvents).set({ entityLabel: "Former employee", summary: "Details recorded for a person whose details have since been removed", changes: null })
      .where(and(inArray(auditEvents.entityType, ["users", "user"]), eq(auditEvents.entityId, id)));
  });
  for (const key of objects) await deleteObject(key).catch(err => console.error("Retention: could not delete stored file:", err?.message));
  await recordSystemEvent({ actorId, action: "remove-personal-details", entityType: "user", entityId: id, entityLabel: label,
    summary: `${how === "automatic" ? "Personal details removed automatically after the retention period" : "Personal details removed on request"} (${label})` });
}

async function adminIds(): Promise<string[]> {
  return (await db.select({ id: users.id }).from(users).where(and(eq(users.isActive, true), eq(users.isArchived, false), inArray(users.role, ["admin", "super_admin"])))).map(a => a.id);
}

/** Runs daily. Removes details past the retention period and warns administrators about those coming up. */
export async function runRetention(now = new Date()): Promise<{ removed: number; warned: number }> {
  const settings = await getSettings();
  if (!settings.autoRemoveEnabled) return { removed: 0, warned: 0 };
  const candidates = await db.select().from(users).where(and(eq(users.isArchived, true), isNull(users.anonymisedAt), isNotNull(users.leftAt), eq(users.retentionHold, false)));
  let removed = 0, warned = 0;
  const due: typeof candidates = [];
  const soon: Array<{ u: (typeof candidates)[number]; on: Date }> = [];
  for (const u of candidates) {
    const on = addMonths(new Date(u.leftAt!), settings.retentionMonths);
    if (on.getTime() <= now.getTime()) due.push(u);
    else if (on.getTime() - now.getTime() <= settings.warnDays * DAY) soon.push({ u, on });
  }
  for (const u of due) {
    try { await removePersonalDetails(u.id, null, "automatic"); removed++; }
    catch (error) { console.error("Retention: could not remove details for", u.id, (error as Error).message); }
  }
  if (soon.length) {
    // notification_logs is the ledger, as for the other reminders: one row per person and date, so each is warned about once
    const logs = await db.select({ metadata: notificationLogs.metadata }).from(notificationLogs).where(eq(notificationLogs.settingId, RETENTION_SETTING_ID));
    const done = new Set(logs.map(l => (l.metadata as any)?.dedupKey).filter(Boolean));
    const keyOf = (s: { u: { id: string }; on: Date }) => `retention:${s.u.id}:${s.on.toISOString().slice(0, 10)}`;
    const fresh = soon.filter(s => !done.has(keyOf(s)));
    if (fresh.length) {
      const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const listHtml = `<ul>${fresh.map(s => `<li>${esc([s.u.firstName, s.u.lastName].filter(Boolean).join(" ") || s.u.email || "Unnamed")}: ${s.on.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</li>`).join("")}</ul>`;
      await sendNotification("retention_warning", { userIds: await adminIds(), vars: { count: fresh.length, listHtml }, path: "/admin/archived-people", settingId: RETENTION_SETTING_ID, metadata: { batch: now.toISOString().slice(0, 10) } });
      for (const s of fresh) {
        await db.insert(notificationLogs).values({ settingId: RETENTION_SETTING_ID, recipientId: s.u.id, recipientEmail: "(ledger)", subject: "retention warning ledger", body: "", status: "ledger",
          metadata: { event: "retention_warning_ledger", dedupKey: keyOf(s) } });
      }
      warned = fresh.length;
    }
  }
  if (removed) console.log(`Retention: removed personal details for ${removed} leaver(s)`);
  return { removed, warned };
}
