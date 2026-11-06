import { db } from "../db";
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import { users, userRoleAssignments, notificationRules, notificationQueue, notificationLogs, notificationSettings, type NotificationRule } from "@shared/schema";
import { emailService } from "./emailService";
import { NOTIFICATION_TYPES, TYPE_BY_KEY, RECIPIENT_NAME, ADDABLE_ROLES, type NotificationType, type Frequency } from "./notificationTypes";

// The one way Capera sends email. Everything that emails someone calls sendNotification() with a notification type (see
// notificationTypes.ts). That is what makes every email:
//   - switchable and adjustable by an administrator (on or off, extra recipients, digest, wording),
//   - worded safely (placeholder values are escaped, so a name or a comment can never inject HTML),
//   - sent one email per person, rather than one email addressed to a list of people,
//   - recorded in the email log, whether it was sent, failed, or not sent because email is not set up, so it can be seen and resent.

export class NotificationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const bad = (m: string) => new NotificationError(400, m);

const DAY = 86_400_000;
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function appLink(path: string): string | null {
  const base = process.env.APP_BASE_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}` : "");
  return base ? `${base.replace(/\/$/, "")}${path}` : null;
}

// ------------------------------------------------------------------------------------------------------------------ wording

const TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
export type Vars = Record<string, string | number | null | undefined>;

/** Subjects are plain text: placeholders are filled in as text, never as HTML. */
export function renderSubject(template: string, vars: Vars): string {
  return template.replace(TOKEN, (_m, name: string) => {
    const v = vars[name] == null ? "" : String(vars[name]);
    return name.endsWith("Html") ? stripTags(v) : v;
  }).replace(/\s+/g, " ").trim().slice(0, 200);
}

function renderLine(line: string, vars: Vars): { html: string; text: string } {
  let html = "", text = "", last = 0;
  for (const m of Array.from(line.matchAll(TOKEN))) {
    const literal = line.slice(last, m.index);
    html += escapeHtml(literal); text += literal;
    const raw = vars[m[1]] == null ? "" : String(vars[m[1]]);
    if (m[1].endsWith("Html")) { html += raw; text += stripTags(raw); } else { html += escapeHtml(raw); text += raw; }
    last = (m.index ?? 0) + m[0].length;
  }
  const tail = line.slice(last);
  return { html: html + escapeHtml(tail), text: text + tail };
}

/**
 * The body is plain text. A blank line starts a new paragraph. A line that only holds an Html placeholder (a table, a list)
 * is placed as it is. A line made up only of placeholders that turned out empty is left out, so optional lines vanish cleanly.
 */
export function renderBody(template: string, vars: Vars): string {
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) out.push(`<p>${para.join("<br>")}</p>`); para = []; };
  for (const line of template.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) { flush(); continue; }
    const hadPlaceholder = TOKEN.test(line); TOKEN.lastIndex = 0;
    const only = line.trim().match(/^\{\{\s*([A-Za-z0-9_]+Html)\s*\}\}$/);
    if (only) { flush(); const raw = vars[only[1]] == null ? "" : String(vars[only[1]]); if (raw) out.push(raw); continue; }
    const r = renderLine(line, vars);
    if (hadPlaceholder && !r.text.trim()) continue;
    para.push(r.html);
  }
  flush();
  return out.join("");
}

const FOOTER = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"><p style="color:#6b7280;font-size:12px;margin:0">This is an automated message from Capera.</p>`;

export function wrapEmail(subject: string, bodyHtml: string, path?: string | null): string {
  const link = path ? appLink(path) : null;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;line-height:1.5"><h2 style="color:#1d4ed8">${escapeHtml(subject)}</h2>${bodyHtml}${link ? `<p><a href="${link}">Open it in Capera</a></p>` : "<p>Sign in to Capera to take a look.</p>"}${FOOTER}</div>`;
}

function wrapDigest(items: Array<{ subject: string; bodyHtml: string; path: string | null }>): string {
  const parts = items.map(i => { const link = i.path ? appLink(i.path) : null; return `<h3 style="margin-bottom:4px">${escapeHtml(i.subject)}</h3>${i.bodyHtml}${link ? `<p><a href="${link}">Open it in Capera</a></p>` : ""}`; });
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;line-height:1.5"><h2 style="color:#1d4ed8">Your Capera digest</h2>${parts.join('<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">')}${FOOTER}</div>`;
}

/** Placeholders in a template that the type does not provide. Used to refuse a save that would print {{typo}} to people. */
export function unknownPlaceholders(def: NotificationType, ...templates: string[]): string[] {
  const allowed = new Set([RECIPIENT_NAME.name, ...def.variables.map(v => v.name)]);
  const bad = new Set<string>();
  for (const t of templates) for (const m of Array.from(t.matchAll(TOKEN))) if (!allowed.has(m[1])) bad.add(m[1]);
  return Array.from(bad);
}

export function sampleVars(def: NotificationType): Vars {
  const v: Vars = { recipientName: RECIPIENT_NAME.example };
  for (const x of def.variables) v[x.name] = x.name.endsWith("Html") ? `<p style="color:#6b7280"><em>${escapeHtml(x.example)}</em></p>` : x.example;
  return v;
}

// ------------------------------------------------------------------------------------------------------------------- rules

export interface EffectiveRule {
  typeKey: string; isEnabled: boolean; sendToDefault: boolean; alsoRoles: string[]; alsoUserIds: string[]; includeManager: boolean;
  frequency: Frequency; reminderDays: number[] | null; subject: string; body: string; customSubject: boolean; customBody: boolean; customised: boolean; lastDigestAt: Date | null;
}

const DEFAULT_OFF = new Set(["competence_expiring", "competence_expired"]); // new automatic reminders: off until an administrator switches them on

function effective(def: NotificationType, row: NotificationRule | undefined): EffectiveRule {
  const freq = (row?.frequency as Frequency) ?? "immediate";
  return {
    typeKey: def.key, isEnabled: row ? row.isEnabled : !DEFAULT_OFF.has(def.key), sendToDefault: row?.sendToDefault ?? true,
    alsoRoles: row?.alsoRoles ?? [], alsoUserIds: row?.alsoUserIds ?? [], includeManager: def.managerCopy ? (row?.includeManager ?? false) : false,
    frequency: def.frequencies.includes(freq) ? freq : "immediate", reminderDays: def.reminderDays ? (row?.reminderDays?.length ? row.reminderDays : def.reminderDays) : null,
    subject: row?.subjectTemplate || def.subject, body: row?.bodyTemplate || def.body, customSubject: !!row?.subjectTemplate, customBody: !!row?.bodyTemplate,
    customised: !!row, lastDigestAt: row?.lastDigestAt ?? null,
  };
}

let cache: { at: number; rows: Map<string, NotificationRule> } | null = null;
async function allRows(): Promise<Map<string, NotificationRule>> {
  if (cache && Date.now() - cache.at < 15_000) return cache.rows;
  const rows = new Map((await db.select().from(notificationRules)).map(r => [r.typeKey, r]));
  cache = { at: Date.now(), rows };
  return rows;
}
const forget = () => { cache = null; };

export async function getRule(typeKey: string): Promise<EffectiveRule> {
  const def = TYPE_BY_KEY.get(typeKey);
  if (!def) throw new NotificationError(404, "Unknown notification type");
  return effective(def, (await allRows()).get(typeKey));
}

export async function listRules() {
  const rows = await allRows();
  return NOTIFICATION_TYPES.map(def => ({ type: def, rule: effective(def, rows.get(def.key)) }));
}

export interface RuleInput {
  isEnabled?: unknown; sendToDefault?: unknown; alsoRoles?: unknown; alsoUserIds?: unknown; includeManager?: unknown; frequency?: unknown;
  reminderDays?: unknown; subject?: unknown; body?: unknown;
}

export async function saveRule(typeKey: string, input: RuleInput, actorId: string): Promise<EffectiveRule> {
  const def = TYPE_BY_KEY.get(typeKey);
  if (!def) throw new NotificationError(404, "Unknown notification type");
  const current = effective(def, (await allRows()).get(typeKey));

  const frequency = input.frequency === undefined ? current.frequency : String(input.frequency);
  if (!def.frequencies.includes(frequency as Frequency)) throw bad(def.frequencies.length === 1 ? "This email is always sent straight away" : "Choose straight away, a daily digest or a weekly digest");

  const roles = input.alsoRoles === undefined ? current.alsoRoles : Array.isArray(input.alsoRoles) ? input.alsoRoles.map(String) : null;
  if (!roles) throw bad("Roles must be a list");
  const validRoles = new Set<string>(ADDABLE_ROLES.map(r => r.value));
  if (roles.some(r => !validRoles.has(r))) throw bad("One of those roles cannot be added");

  const ids = input.alsoUserIds === undefined ? current.alsoUserIds : Array.isArray(input.alsoUserIds) ? Array.from(new Set(input.alsoUserIds.map(String))) : null;
  if (!ids) throw bad("People must be a list");
  if (ids.length > 50) throw bad("Add up to 50 named people. For more, add a role instead.");
  if (ids.length) {
    const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
    if (found.length !== ids.length) throw bad("One of the people you chose no longer exists");
  }

  let reminderDays: number[] | null = null;
  if (def.reminderDays) {
    const raw = input.reminderDays === undefined ? current.reminderDays ?? def.reminderDays : input.reminderDays;
    const days = Array.isArray(raw) ? raw.map(Number) : null;
    if (!days || !days.length || days.length > 10 || days.some(d => !Number.isInteger(d) || d < 0 || d > 365)) throw bad("Give up to 10 reminder days, each between 0 and 365");
    reminderDays = Array.from(new Set(days)).sort((a, b) => b - a);
  }

  const clean = (v: unknown, keep: string | undefined, max: number, what: string): string | null => {
    if (v === undefined) return keep === undefined ? null : keep;
    const t = String(v).replace(/\r\n/g, "\n").trim();
    if (!t) return null; // blank puts the default wording back
    if (t.length > max) throw bad(`The ${what} is too long (at most ${max} characters)`);
    return t;
  };
  const subject = clean(input.subject, current.customSubject ? current.subject : undefined, 200, "subject");
  const body = clean(input.body, current.customBody ? current.body : undefined, 6000, "message");
  const unknown = unknownPlaceholders(def, subject ?? "", body ?? "");
  if (unknown.length) throw bad(`These placeholders are not available for this email: ${unknown.map(u => `{{${u}}}`).join(", ")}`);
  if (body && !/\S/.test(body.replace(TOKEN, ""))  && !body.match(TOKEN)) throw bad("The message cannot be empty");

  const values = {
    isEnabled: input.isEnabled === undefined ? current.isEnabled : input.isEnabled === true, sendToDefault: input.sendToDefault === undefined ? current.sendToDefault : input.sendToDefault === true,
    alsoRoles: roles, alsoUserIds: ids, includeManager: def.managerCopy ? (input.includeManager === undefined ? current.includeManager : input.includeManager === true) : false,
    frequency, reminderDays, subjectTemplate: subject, bodyTemplate: body, updatedBy: actorId, updatedAt: new Date(),
  };
  await db.insert(notificationRules).values({ typeKey, ...values }).onConflictDoUpdate({ target: notificationRules.typeKey, set: values });
  forget();
  // changing back to straight away must not leave emails stranded in the queue
  if (current.frequency !== "immediate" && frequency === "immediate") await flushDigests(new Date(), typeKey);
  return getRule(typeKey);
}

export async function resetRule(typeKey: string): Promise<EffectiveRule> {
  if (!TYPE_BY_KEY.has(typeKey)) throw new NotificationError(404, "Unknown notification type");
  await db.delete(notificationRules).where(eq(notificationRules.typeKey, typeKey));
  forget();
  return getRule(typeKey);
}

// --------------------------------------------------------------------------------------------------------------- recipients

interface Resolved { email: string; userId: string | null; name: string }

function isUsable(u: { email: string | null; isActive: boolean | null; isArchived: boolean | null; leftAt: Date | null; anonymisedAt: Date | null }): boolean {
  if (!u.email || u.isActive === false || u.anonymisedAt) return false;
  if (u.isArchived && (!u.leftAt || new Date(u.leftAt).getTime() <= Date.now())) return false; // someone who has left is not emailed
  return true;
}
const nameOf = (u: { firstName: string | null; lastName: string | null; email: string | null }) => [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email || "there";

async function usersWithRoles(roles: string[]): Promise<string[]> {
  if (!roles.length) return [];
  const primary = await db.select({ id: users.id }).from(users).where(inArray(users.role, roles));
  const secondary = await db.select({ id: userRoleAssignments.userId }).from(userRoleAssignments).where(and(inArray(userRoleAssignments.role, roles), eq(userRoleAssignments.isActive, true)));
  return Array.from(new Set([...primary, ...secondary].map(r => r.id)));
}

export interface Audience { userIds?: string[]; emails?: string[]; aboutUserId?: string | null }

async function resolveRecipients(def: NotificationType, rule: EffectiveRule, audience: Audience): Promise<Resolved[]> {
  const ids = new Set<string>(rule.sendToDefault ? (audience.userIds ?? []).filter(Boolean) : []);
  for (const id of rule.alsoUserIds) ids.add(id);
  for (const id of await usersWithRoles(rule.alsoRoles)) ids.add(id);
  if (rule.includeManager && def.managerCopy && audience.aboutUserId) {
    const about = (await db.select({ managerId: users.managerId }).from(users).where(eq(users.id, audience.aboutUserId)))[0];
    if (about?.managerId) ids.add(about.managerId);
  }
  const found = ids.size ? await db.select().from(users).where(inArray(users.id, Array.from(ids))) : [];
  const out = new Map<string, Resolved>();
  for (const u of found) if (isUsable(u)) out.set(u.email!.toLowerCase(), { email: u.email!, userId: u.id, name: nameOf(u) });
  if (rule.sendToDefault) for (const e of audience.emails ?? []) if (e && !out.has(e.toLowerCase())) out.set(e.toLowerCase(), { email: e, userId: null, name: e.split("@")[0] });
  return Array.from(out.values());
}

// ---------------------------------------------------------------------------------------------------------------- delivery

export type DeliveryStatus = "sent" | "failed" | "skipped";

/** Sends one email and records it in the log. Never throws. */
async function deliver(a: { to: string; recipientId: string | null; subject: string; html: string; typeKey: string; settingId?: string | null; metadata?: Record<string, unknown>; resendOf?: string | null }): Promise<{ id: string | null; status: DeliveryStatus; error?: string }> {
  let status: DeliveryStatus = "sent", error: string | undefined;
  if (!emailService.isConfigured()) { status = "skipped"; error = "Email is not set up, so this was recorded but not sent."; }
  else {
    try { await emailService.sendEmail({ to: a.to, subject: a.subject, html: a.html }); }
    catch (e: any) { status = "failed"; error = String(e?.message ?? e).slice(0, 500); console.error(`Email to ${a.to} failed:`, error); }
  }
  try {
    const row = (await db.insert(notificationLogs).values({
      settingId: a.settingId ?? a.typeKey, typeKey: a.typeKey, recipientId: a.recipientId ?? "", recipientEmail: a.to, subject: a.subject, body: a.html, status,
      sentAt: status === "sent" ? new Date() : null, errorMessage: error ?? null, metadata: a.metadata ?? null, resendOf: a.resendOf ?? null,
    }).returning({ id: notificationLogs.id }))[0];
    return { id: row.id, status, error };
  } catch (e) {
    console.error("Could not write the email log:", (e as Error).message);
    return { id: null, status, error };
  }
}

export interface SendOptions extends Audience {
  vars?: Vars; path?: string | null; dedupKey?: string; dedupKeys?: string[]; settingId?: string; metadata?: Record<string, unknown>;
}
export interface SendResult { recipients: number; sent: number; failed: number; skipped: number; queued: number; off?: boolean }

/**
 * Sends a notification of the given type: finds who should get it (the normal audience plus whatever the rule adds), words it
 * from the rule's wording or the default, and either sends it now or queues it for a digest. Never throws, so a mail problem
 * cannot stop the thing that triggered it.
 */
export async function sendNotification(typeKey: string, opts: SendOptions): Promise<SendResult> {
  const result: SendResult = { recipients: 0, sent: 0, failed: 0, skipped: 0, queued: 0 };
  try {
    const def = TYPE_BY_KEY.get(typeKey);
    if (!def) { console.error(`Unknown notification type "${typeKey}"`); return result; }
    const rule = await getRule(typeKey);
    if (!rule.isEnabled) return { ...result, off: true };
    const recipients = await resolveRecipients(def, rule, opts);
    result.recipients = recipients.length;
    const metadata = { ...(opts.metadata ?? {}), event: typeKey, dedupKey: opts.dedupKey, dedupKeys: opts.dedupKeys };
    for (const r of recipients) {
      const vars: Vars = { ...(opts.vars ?? {}), recipientName: r.name };
      const subject = renderSubject(rule.subject, vars) || def.label;
      const bodyHtml = renderBody(rule.body, vars);
      if (rule.frequency !== "immediate") {
        await db.insert(notificationQueue).values({ typeKey, recipientId: r.userId, recipientEmail: r.email, subject, bodyHtml, path: opts.path ?? null });
        result.queued++;
        continue;
      }
      const d = await deliver({ to: r.email, recipientId: r.userId, subject, html: wrapEmail(subject, bodyHtml, opts.path), typeKey, settingId: opts.settingId, metadata });
      result[d.status]++;
    }
  } catch (error) {
    console.error(`Notification "${typeKey}" failed:`, (error as Error).message);
  }
  return result;
}

// -------------------------------------------------------------------------------------------------------------------- digests

/** Sends the queued emails of every type set to a daily or weekly digest as one email per person. `onlyType` flushes just that type. */
export async function flushDigests(now = new Date(), onlyType?: string): Promise<{ digests: number; items: number; discarded: number }> {
  const rows = await allRows();
  const due: string[] = [];
  let discarded = 0;
  for (const def of NOTIFICATION_TYPES) {
    if (onlyType && def.key !== onlyType) continue;
    const rule = effective(def, rows.get(def.key));
    if (!onlyType && rule.frequency === "immediate") continue;
    if (!rule.isEnabled) {
      const gone = await db.delete(notificationQueue).where(and(eq(notificationQueue.typeKey, def.key), isNull(notificationQueue.sentAt))).returning({ id: notificationQueue.id });
      discarded += gone.length; continue;
    }
    const weeklyDue = !rule.lastDigestAt || now.getTime() - new Date(rule.lastDigestAt).getTime() >= 7 * DAY - 3_600_000;
    if (onlyType || rule.frequency === "daily" || (rule.frequency === "weekly" && weeklyDue)) due.push(def.key);
  }
  if (!due.length) return { digests: 0, items: 0, discarded };
  const pending = await db.select().from(notificationQueue).where(and(inArray(notificationQueue.typeKey, due), isNull(notificationQueue.sentAt))).orderBy(notificationQueue.createdAt);
  const byPerson = new Map<string, typeof pending>();
  for (const p of pending) byPerson.set(p.recipientEmail.toLowerCase(), [...(byPerson.get(p.recipientEmail.toLowerCase()) ?? []), p]);
  let digests = 0, items = 0;
  for (const group of Array.from(byPerson.values())) {
    const subject = group.length === 1 ? group[0].subject : `Capera digest: ${group.length} notifications`;
    const html = group.length === 1 ? wrapEmail(group[0].subject, group[0].bodyHtml, group[0].path) : wrapDigest(group.map(g => ({ subject: g.subject, bodyHtml: g.bodyHtml, path: g.path })));
    const d = await deliver({ to: group[0].recipientEmail, recipientId: group[0].recipientId, subject, html, typeKey: group.length === 1 ? group[0].typeKey : "digest", metadata: { digest: true, types: Array.from(new Set(group.map(g => g.typeKey))), items: group.length } });
    if (d.status !== "failed") { await db.update(notificationQueue).set({ sentAt: now }).where(inArray(notificationQueue.id, group.map(g => g.id))); digests++; items += group.length; }
  }
  for (const key of due) await db.update(notificationRules).set({ lastDigestAt: now }).where(eq(notificationRules.typeKey, key));
  forget();
  return { digests, items, discarded };
}

// ---------------------------------------------------------------------------------------------------- preview, test and resend

export async function previewTemplate(typeKey: string, draft?: { subject?: string; body?: string }) {
  const def = TYPE_BY_KEY.get(typeKey);
  if (!def) throw new NotificationError(404, "Unknown notification type");
  const rule = await getRule(typeKey);
  const subject = (draft?.subject?.trim() || rule.subject), body = (draft?.body?.trim() || rule.body);
  const unknown = unknownPlaceholders(def, subject, body);
  const vars = sampleVars(def);
  const s = renderSubject(subject, vars);
  return { subject: s, html: wrapEmail(s, renderBody(body, vars), "/"), unknownPlaceholders: unknown };
}

export async function sendTest(typeKey: string, actorId: string, draft?: { subject?: string; body?: string }) {
  const p = await previewTemplate(typeKey, draft);
  if (p.unknownPlaceholders.length) throw bad(`These placeholders are not available for this email: ${p.unknownPlaceholders.map(u => `{{${u}}}`).join(", ")}`);
  const me = (await db.select().from(users).where(eq(users.id, actorId)))[0];
  if (!me?.email) throw bad("Your account has no email address to send the test to");
  const d = await deliver({ to: me.email, recipientId: me.id, subject: `[Test] ${p.subject}`, html: p.html, typeKey, metadata: { test: true } });
  return { status: d.status, to: me.email, error: d.error ?? null };
}

export async function resend(logId: string, actorId: string, to?: string) {
  const log = (await db.select().from(notificationLogs).where(eq(notificationLogs.id, logId)))[0];
  if (!log) throw new NotificationError(404, "That email is not in the log");
  const target = (to ?? log.recipientEmail ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target) || target === "removed") throw bad("There is no valid address to resend this to");
  if (!log.body || log.body === "(removed)") throw bad("The content of this email was removed, so it cannot be resent");
  if (log.status === "ledger") throw bad("That entry is not an email");
  const d = await deliver({ to: target, recipientId: target === log.recipientEmail ? log.recipientId : null, subject: log.subject, html: log.body, typeKey: log.typeKey ?? "resend", settingId: log.settingId, metadata: { resentBy: actorId, originalId: log.id }, resendOf: log.id });
  return { status: d.status, to: target, error: d.error ?? null, logId: d.id };
}

export function emailStatus() {
  return { configured: emailService.isConfigured(), ...emailService.describe() };
}

// ---------------------------------------------------------------------------------------------------------------------- log

export interface LogFilter { typeKey?: string; status?: string; q?: string; from?: string; to?: string; limit?: number; offset?: number }

function logWhere(f: LogFilter) {
  const c: any[] = [ne(notificationLogs.status, "ledger")];
  if (f.typeKey) c.push(f.typeKey === "unclassified" ? isNull(notificationLogs.typeKey) : eq(notificationLogs.typeKey, f.typeKey));
  if (f.status) c.push(eq(notificationLogs.status, f.status));
  if (f.from) c.push(gte(notificationLogs.createdAt, new Date(f.from)));
  if (f.to) { const d = new Date(f.to); if (!f.to.includes("T")) d.setUTCHours(23, 59, 59, 999); c.push(lte(notificationLogs.createdAt, d)); }
  if (f.q?.trim()) { const p = `%${f.q.trim()}%`; c.push(or(ilike(notificationLogs.recipientEmail, p), ilike(notificationLogs.subject, p))); }
  return and(...c);
}

export async function listLogs(f: LogFilter) {
  const limit = Math.min(Math.max(Number(f.limit) || 50, 1), 200), offset = Math.max(Number(f.offset) || 0, 0);
  const rows = await db.select({
    id: notificationLogs.id, typeKey: notificationLogs.typeKey, settingId: notificationLogs.settingId, recipientId: notificationLogs.recipientId, recipientEmail: notificationLogs.recipientEmail,
    subject: notificationLogs.subject, status: notificationLogs.status, errorMessage: notificationLogs.errorMessage, sentAt: notificationLogs.sentAt, createdAt: notificationLogs.createdAt, resendOf: notificationLogs.resendOf,
    firstName: users.firstName, lastName: users.lastName,
  }).from(notificationLogs).leftJoin(users, eq(users.id, notificationLogs.recipientId)).where(logWhere(f)).orderBy(desc(notificationLogs.createdAt)).limit(limit).offset(offset);
  const total = Number((await db.select({ n: sql<number>`count(*)::int` }).from(notificationLogs).where(logWhere(f)))[0]?.n ?? 0);
  return { logs: rows.map(r => ({ ...r, recipientName: [r.firstName, r.lastName].filter(Boolean).join(" ") || null, label: r.typeKey ? TYPE_BY_KEY.get(r.typeKey)?.label ?? (r.typeKey === "digest" ? "Digest" : r.typeKey) : null })), total, limit, offset };
}

export async function getLog(id: string) {
  const row = (await db.select().from(notificationLogs).where(and(eq(notificationLogs.id, id), ne(notificationLogs.status, "ledger"))))[0];
  if (!row) throw new NotificationError(404, "That email is not in the log");
  return row;
}

export async function logSummary() {
  const since = new Date(Date.now() - 30 * DAY);
  const rows = await db.select({ status: notificationLogs.status, n: sql<number>`count(*)::int` }).from(notificationLogs).where(and(ne(notificationLogs.status, "ledger"), gte(notificationLogs.createdAt, since))).groupBy(notificationLogs.status);
  const out = { sent: 0, failed: 0, skipped: 0, pending: 0 } as Record<string, number>;
  for (const r of rows) out[r.status] = r.n;
  const queued = Number((await db.select({ n: sql<number>`count(*)::int` }).from(notificationQueue).where(isNull(notificationQueue.sentAt)))[0]?.n ?? 0);
  return { last30Days: out, queued };
}

// ---------------------------------------------------------------------------------------------- competence reminders (daily)

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const REMINDER_LEDGER = "competence-reminders";
const EXPIRED_WINDOW_DAYS = 30; // something that expired longer ago than this is not announced as news

async function ledgerKeys(settingId: string): Promise<Set<string>> {
  const logs = await db.select({ metadata: notificationLogs.metadata }).from(notificationLogs).where(and(eq(notificationLogs.settingId, settingId), ne(notificationLogs.status, "failed")));
  const out = new Set<string>();
  for (const l of logs) { const m = l.metadata as any; if (m?.dedupKey) out.add(m.dedupKey); for (const k of m?.dedupKeys ?? []) out.add(k); }
  return out;
}

/**
 * Daily. Reminds people whose competence is about to expire, and tells them when it has. It looks at the latest valid assessment
 * of each competence element the person's job role requires, so an old assessment that has since been renewed never triggers a
 * reminder. Each item is reminded once per reminder stage (the tightest stage that now applies), however often this runs.
 * Both emails are off until an administrator switches them on, and nothing is attempted while email is not set up.
 */
export async function runCompetenceReminders(now = new Date()): Promise<{ expiringEmails: number; expiredEmails: number; skipped?: string }> {
  const expiringRule = await getRule("competence_expiring"), expiredRule = await getRule("competence_expired");
  if (!expiringRule.isEnabled && !expiredRule.isEnabled) return { expiringEmails: 0, expiredEmails: 0, skipped: "Both reminders are switched off" };
  if (!emailService.isConfigured()) return { expiringEmails: 0, expiredEmails: 0, skipped: "Email is not set up" };

  const rows = (await db.execute(sql`
    select distinct on (a.candidate_id, a.element_id) a.id as assessment_id, a.candidate_id as user_id, a.expiry_date, ce.name as element_name
    from assessments a
    join users u on u.id = a.candidate_id
    join competency_elements ce on ce.id = a.element_id
    where a.is_active and not coalesce(a.is_assignment, false) and a.outcome in ('competent', 'competent_with_minor_needs') and a.expiry_date is not null
      and coalesce(u.is_active, true) and u.anonymised_at is null and (not coalesce(u.is_archived, false) or u.left_at > now())
      and exists (select 1 from role_elements re where re.element_id = a.element_id and re.is_active and coalesce(re.required, true) and re.role_id in (u.job_role_id, u.secondary_job_role_id))
    order by a.candidate_id, a.element_id, a.expiry_date desc`)).rows as Array<{ assessment_id: string; user_id: string; expiry_date: Date; element_name: string }>;

  const done = await ledgerKeys(REMINDER_LEDGER);
  const stages = [...(expiringRule.reminderDays ?? [])].sort((a, b) => a - b);
  const maxStage = stages[stages.length - 1] ?? 0;
  const expiring = new Map<string, Array<{ id: string; element: string; expiry: Date; daysLeft: number }>>(); // key: user + stage
  const expired = new Map<string, Array<{ id: string; element: string; expiry: Date; daysLeft: number }>>();
  for (const r of rows) {
    const expiry = new Date(r.expiry_date);
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / DAY);
    const item = { id: r.assessment_id, element: r.element_name, expiry, daysLeft };
    if (daysLeft >= 0 && expiringRule.isEnabled && daysLeft <= maxStage) {
      const stage = stages.find(s => daysLeft <= s)!;
      if (done.has(`expiring:${r.assessment_id}:${stage}`)) continue;
      const k = `${r.user_id}|${stage}`; expiring.set(k, [...(expiring.get(k) ?? []), item]);
    } else if (daysLeft < 0 && daysLeft >= -EXPIRED_WINDOW_DAYS && expiredRule.isEnabled) {
      if (done.has(`expired:${r.assessment_id}`)) continue;
      expired.set(r.user_id, [...(expired.get(r.user_id) ?? []), item]);
    }
  }

  const table = (items: Array<{ element: string; expiry: Date; daysLeft: number }>, past: boolean) =>
    `<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Competence element</th><th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">${past ? "Expired on" : "Expires on"}</th><th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">${past ? "Status" : "Days left"}</th></tr></thead><tbody>` +
    items.map(i => `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(i.element)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${fmtDate(i.expiry)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${past ? "Expired" : i.daysLeft}</td></tr>`).join("") + "</tbody></table>";

  let expiringEmails = 0, expiredEmails = 0;
  for (const [key, items] of Array.from(expiring.entries())) {
    const [userId, stage] = key.split("|");
    const r = await sendNotification("competence_expiring", { userIds: [userId], aboutUserId: userId, vars: { count: items.length, days: stage, itemsHtml: table(items, false) }, path: "/my-assessments", settingId: REMINDER_LEDGER, dedupKeys: items.map(i => `expiring:${i.id}:${stage}`) });
    if (r.sent) expiringEmails++;
  }
  for (const [userId, items] of Array.from(expired.entries())) {
    const r = await sendNotification("competence_expired", { userIds: [userId], aboutUserId: userId, vars: { count: items.length, itemsHtml: table(items, true) }, path: "/my-assessments", settingId: REMINDER_LEDGER, dedupKeys: items.map(i => `expired:${i.id}`) });
    if (r.sent) expiredEmails++;
  }
  return { expiringEmails, expiredEmails };
}

// -------------------------------------------------------------------------------------------------------- one-off conversion

/**
 * The old notification_settings table held reminder days that were never acted on. If someone had set them up, keep their intent:
 * the first time this runs, turn the competence reminders on with those days. Runs at most once, and only when no rules exist yet.
 */
export async function adoptLegacySettings(): Promise<void> {
  try {
    if ((await db.select({ id: notificationRules.id }).from(notificationRules).limit(1)).length) return;
    const legacy = await db.select().from(notificationSettings);
    if (!legacy.length) return;
    const expiring = legacy.filter(l => l.notificationType === "expiring_soon" && l.isEnabled && l.daysBeforeExpiry);
    const expired = legacy.filter(l => l.notificationType === "expired" && l.isEnabled);
    if (expiring.length) await db.insert(notificationRules).values({ typeKey: "competence_expiring", isEnabled: true, reminderDays: Array.from(new Set(expiring.map(l => l.daysBeforeExpiry!))).sort((a, b) => b - a) }).onConflictDoNothing();
    if (expired.length) await db.insert(notificationRules).values({ typeKey: "competence_expired", isEnabled: true }).onConflictDoNothing();
    forget();
  } catch (error) {
    console.error("Could not carry over the old notification settings:", (error as Error).message);
  }
}
