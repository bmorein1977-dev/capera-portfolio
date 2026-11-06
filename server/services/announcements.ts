import { db } from "../db";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { announcements, announcementReads, users, businessUnits, locations, jobRoles, ANNOUNCEMENT_IMPORTANCE, type Announcement, type User } from "@shared/schema";
import { sendNotification } from "./notifications";

// Announcements. An administrator writes a notice and says who it is for: everyone, or any mix of business units (and the units
// beneath them), job roles and locations. A person is in the audience if any one of the groups matches them. People see the notices
// meant for them, mark them read, and confirm them where an acknowledgement is required. Administrators see who has and has not.

export class AnnouncementError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const bad = (m: string) => new AnnouncementError(400, m);

export const ANNOUNCEMENT_SETTING_ID = "announcements";
const DAY = 86_400_000;
const EARLIER_DAYS = 120; // how far back someone can still see notices that have expired

export interface AnnouncementInput {
  title?: unknown; body?: unknown; importance?: unknown; requiresAcknowledgement?: unknown; audienceAll?: unknown;
  businessUnitIds?: unknown; jobRoleIds?: unknown; locationIds?: unknown; sendEmail?: unknown; publishAt?: unknown; expiresAt?: unknown;
}

interface Clean {
  title: string; body: string; importance: string; requiresAcknowledgement: boolean; audienceAll: boolean;
  businessUnitIds: string[]; jobRoleIds: string[]; locationIds: string[]; sendEmail: boolean; publishAt: Date | null; expiresAt: Date | null;
}

const idList = (v: unknown, what: string): string[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw bad(`${what} must be a list`);
  return Array.from(new Set(v.map(String).filter(Boolean)));
};
const dateOrNull = (v: unknown, what: string): Date | null => {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) throw bad(`${what} is not a valid date`);
  return d;
};

async function validate(input: AnnouncementInput, existing?: Announcement): Promise<Clean> {
  const title = String(input.title ?? existing?.title ?? "").trim();
  const body = String(input.body ?? existing?.body ?? "").replace(/\r\n/g, "\n").trim();
  if (!title) throw bad("Give the announcement a title");
  if (title.length > 150) throw bad("The title is too long (at most 150 characters)");
  if (!body) throw bad("Write the announcement");
  if (body.length > 10_000) throw bad("The announcement is too long (at most 10,000 characters)");
  const importance = String(input.importance ?? existing?.importance ?? "normal");
  if (!(ANNOUNCEMENT_IMPORTANCE as readonly string[]).includes(importance)) throw bad("Importance must be normal or important");
  const audienceAll = input.audienceAll === undefined ? existing?.audienceAll ?? false : input.audienceAll === true;
  const businessUnitIds = input.businessUnitIds === undefined ? existing?.businessUnitIds ?? [] : idList(input.businessUnitIds, "Business units");
  const jobRoleIds = input.jobRoleIds === undefined ? existing?.jobRoleIds ?? [] : idList(input.jobRoleIds, "Job roles");
  const locationIds = input.locationIds === undefined ? existing?.locationIds ?? [] : idList(input.locationIds, "Locations");
  if (!audienceAll && !businessUnitIds.length && !jobRoleIds.length && !locationIds.length) throw bad("Choose who it is for: everyone, or at least one business unit, job role or location");
  if (businessUnitIds.length && (await db.select({ id: businessUnits.id }).from(businessUnits).where(inArray(businessUnits.id, businessUnitIds))).length !== businessUnitIds.length) throw bad("One of those business units no longer exists");
  if (jobRoleIds.length && (await db.select({ id: jobRoles.id }).from(jobRoles).where(inArray(jobRoles.id, jobRoleIds))).length !== jobRoleIds.length) throw bad("One of those job roles no longer exists");
  if (locationIds.length && (await db.select({ id: locations.id }).from(locations).where(inArray(locations.id, locationIds))).length !== locationIds.length) throw bad("One of those locations no longer exists");
  const publishAt = input.publishAt === undefined ? existing?.publishAt ?? null : dateOrNull(input.publishAt, "The publish date");
  const expiresAt = input.expiresAt === undefined ? existing?.expiresAt ?? null : dateOrNull(input.expiresAt, "The expiry date");
  if (expiresAt && expiresAt.getTime() <= (publishAt ?? new Date()).getTime()) throw bad("The expiry date must be after the date it goes live");
  return {
    title, body, importance, requiresAcknowledgement: input.requiresAcknowledgement === undefined ? existing?.requiresAcknowledgement ?? false : input.requiresAcknowledgement === true,
    audienceAll, businessUnitIds: audienceAll ? [] : businessUnitIds, jobRoleIds: audienceAll ? [] : jobRoleIds, locationIds: audienceAll ? [] : locationIds,
    sendEmail: input.sendEmail === undefined ? existing?.sendEmail ?? false : input.sendEmail === true, publishAt, expiresAt,
  };
}

// --------------------------------------------------------------------------------------------------------------- audience

type Audience = Pick<Announcement, "audienceAll" | "businessUnitIds" | "jobRoleIds" | "locationIds">;

async function unitClosure(selected: string[]): Promise<Set<string>> {
  const all = await db.select({ id: businessUnits.id, parent: businessUnits.parentBusinessUnitId }).from(businessUnits);
  const kids = new Map<string, string[]>();
  for (const u of all) if (u.parent) kids.set(u.parent, [...(kids.get(u.parent) ?? []), u.id]);
  const out = new Set<string>();
  const walk = (id: string) => { if (out.has(id)) return; out.add(id); for (const k of kids.get(id) ?? []) walk(k); };
  selected.forEach(walk);
  return out;
}

function isCurrent(u: Pick<User, "isActive" | "isArchived" | "leftAt" | "anonymisedAt">): boolean {
  if (u.isActive === false || u.anonymisedAt) return false;
  if (u.isArchived && (!u.leftAt || new Date(u.leftAt).getTime() <= Date.now())) return false;
  return true;
}

/** Builds a test for "is this person in the audience", so a list of people is checked against one set of lookups. */
async function audienceTest(a: Audience): Promise<(u: User) => boolean> {
  if (a.audienceAll) return () => true;
  const units = await unitClosure(a.businessUnitIds ?? []);
  const roles = new Set(a.jobRoleIds ?? []);
  const locIds = new Set(a.locationIds ?? []);
  const locNames = new Set((a.locationIds?.length ? await db.select({ name: locations.name }).from(locations).where(inArray(locations.id, a.locationIds)) : []).map(l => l.name));
  return (u) => !!(
    (u.businessUnitId && units.has(u.businessUnitId)) || (u.jobRoleId && roles.has(u.jobRoleId)) || (u.secondaryJobRoleId && roles.has(u.secondaryJobRoleId)) ||
    (u.locationId && locIds.has(u.locationId)) || (u.location && locNames.has(u.location))
  );
}

export async function audienceUsers(a: Audience): Promise<User[]> {
  const test = await audienceTest(a);
  return (await db.select().from(users)).filter(u => isCurrent(u) && test(u));
}

export async function previewAudience(input: AnnouncementInput): Promise<{ count: number; withoutEmail: number }> {
  const audienceAll = input.audienceAll === true;
  const people = await audienceUsers({ audienceAll, businessUnitIds: audienceAll ? [] : idList(input.businessUnitIds, "Business units"), jobRoleIds: audienceAll ? [] : idList(input.jobRoleIds, "Job roles"), locationIds: audienceAll ? [] : idList(input.locationIds, "Locations") });
  return { count: people.length, withoutEmail: people.filter(p => !p.email).length };
}

// ----------------------------------------------------------------------------------------------------------- administrators

const nameOf = (u: { firstName: string | null; lastName: string | null; email: string | null } | undefined) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email || "Someone" : "Someone");
const goLive = (a: Pick<Announcement, "publishAt" | "publishedAt">): Date | null => a.publishAt ?? a.publishedAt ?? null;

async function load(id: string): Promise<Announcement> {
  const a = (await db.select().from(announcements).where(eq(announcements.id, id)))[0];
  if (!a) throw new AnnouncementError(404, "Announcement not found");
  return a;
}

export async function create(input: AnnouncementInput, actorId: string, publishNow: boolean): Promise<Announcement> {
  const c = await validate(input);
  const row = (await db.insert(announcements).values({ ...c, status: "draft", createdBy: actorId, updatedBy: actorId }).returning())[0];
  return publishNow ? publish(row.id, actorId) : row;
}

export async function update(id: string, input: AnnouncementInput, actorId: string): Promise<Announcement> {
  const a = await load(id);
  if (a.status === "withdrawn") throw new AnnouncementError(409, "A withdrawn announcement cannot be edited. Publish it again first.");
  const c = await validate(input, a);
  const changed = a.title !== c.title || a.body !== c.body;
  const row = (await db.update(announcements).set({ ...c, updatedBy: actorId, updatedAt: new Date(), ...(a.status === "published" && changed ? { editedAt: new Date() } : {}) }).where(eq(announcements.id, id)).returning())[0];
  return row;
}

export async function publish(id: string, actorId: string): Promise<Announcement> {
  const a = await load(id);
  if (a.status === "published") throw new AnnouncementError(409, "This announcement is already published");
  const c = await validate({}, a);
  const row = (await db.update(announcements).set({ status: "published", publishedAt: a.publishedAt ?? new Date(), withdrawnAt: null, updatedBy: actorId, updatedAt: new Date(), publishAt: c.publishAt }).where(eq(announcements.id, id)).returning())[0];
  await sendDueEmails(new Date());
  return row;
}

export async function withdraw(id: string, actorId: string): Promise<Announcement> {
  const a = await load(id);
  if (a.status !== "published") throw new AnnouncementError(409, "Only a published announcement can be withdrawn");
  return (await db.update(announcements).set({ status: "withdrawn", withdrawnAt: new Date(), updatedBy: actorId, updatedAt: new Date() }).where(eq(announcements.id, id)).returning())[0];
}

export async function remove(id: string): Promise<void> {
  const a = await load(id);
  if (a.status !== "draft") throw new AnnouncementError(409, "Only a draft can be deleted. Withdraw a published announcement instead, so there is a record of it.");
  await db.delete(announcements).where(eq(announcements.id, id));
}

export interface AdminRow extends Announcement { audienceCount: number; readCount: number; acknowledgedCount: number; scheduled: boolean; expired: boolean; audienceText: string; createdByName: string | null }

export async function listAdmin(): Promise<AdminRow[]> {
  const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(300);
  if (!rows.length) return [];
  const people = (await db.select().from(users)).filter(isCurrent);
  const reads = await db.select().from(announcementReads).where(inArray(announcementReads.announcementId, rows.map(r => r.id)));
  const units = new Map((await db.select({ id: businessUnits.id, name: businessUnits.name }).from(businessUnits)).map(u => [u.id, u.name]));
  const roles = new Map((await db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles)).map(r => [r.id, r.name]));
  const locs = new Map((await db.select({ id: locations.id, name: locations.name }).from(locations)).map(l => [l.id, l.name]));
  const creators = new Map(people.map(p => [p.id, nameOf(p)]));
  const now = Date.now();
  const out: AdminRow[] = [];
  for (const a of rows) {
    const test = await audienceTest(a);
    const audience = new Set(people.filter(test).map(p => p.id));
    const mine = reads.filter(r => r.announcementId === a.id && audience.has(r.userId));
    const parts = a.audienceAll ? ["Everyone"] : [
      ...(a.businessUnitIds ?? []).map(i => units.get(i) ?? "a business unit"), ...(a.jobRoleIds ?? []).map(i => roles.get(i) ?? "a job role"), ...(a.locationIds ?? []).map(i => locs.get(i) ?? "a location"),
    ];
    out.push({
      ...a, audienceCount: audience.size, readCount: mine.length, acknowledgedCount: mine.filter(r => r.acknowledgedAt).length,
      scheduled: a.status === "published" && !!a.publishAt && a.publishAt.getTime() > now, expired: !!a.expiresAt && a.expiresAt.getTime() <= now,
      audienceText: parts.join(", "), createdByName: a.createdBy ? creators.get(a.createdBy) ?? null : null,
    });
  }
  return out;
}

export interface Reader { userId: string; name: string; email: string | null; location: string | null; readAt: string | null; acknowledgedAt: string | null }

export async function readers(id: string): Promise<{ announcement: Announcement; people: Reader[] }> {
  const a = await load(id);
  const people = await audienceUsers(a);
  const reads = new Map((await db.select().from(announcementReads).where(eq(announcementReads.announcementId, id))).map(r => [r.userId, r]));
  return {
    announcement: a,
    people: people.map(p => ({ userId: p.id, name: nameOf(p), email: p.email, location: p.location, readAt: reads.get(p.id)?.readAt?.toISOString() ?? null, acknowledgedAt: reads.get(p.id)?.acknowledgedAt?.toISOString() ?? null }))
      .sort((x, y) => Number(!!x.readAt) - Number(!!y.readAt) || x.name.localeCompare(y.name)),
  };
}

/** Chases the people who have not yet read (or, where required, confirmed) an announcement. */
export async function remind(id: string, actorId: string): Promise<{ reminded: number }> {
  const a = await load(id);
  if (a.status !== "published") throw new AnnouncementError(409, "Only a published announcement can be chased");
  const { people } = await readers(id);
  const waiting = people.filter(p => (a.requiresAcknowledgement ? !p.acknowledgedAt : !p.readAt));
  if (!waiting.length) return { reminded: 0 };
  const r = await sendNotification("announcement_reminder", {
    userIds: waiting.map(p => p.userId), vars: { title: a.title, actionText: a.requiresAcknowledgement ? "confirmed that you have read and understood" : "read" },
    path: "/announcements", settingId: ANNOUNCEMENT_SETTING_ID, metadata: { announcementId: id, remindedBy: actorId },
  });
  return { reminded: r.recipients };
}

// --------------------------------------------------------------------------------------------------------------- email

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const messageHtml = (body: string) => body.split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

/** Emails the audience of any live announcement that is set to send email and has not yet done so. Safe to run as often as you like. */
export async function sendDueEmails(now = new Date()): Promise<{ announcements: number; emails: number }> {
  const due = await db.select().from(announcements).where(and(eq(announcements.status, "published"), eq(announcements.sendEmail, true), isNull(announcements.emailedAt), or(isNull(announcements.publishAt), lte(announcements.publishAt, now))));
  let emails = 0;
  for (const a of due) {
    // claim it first so two runs at once cannot both send
    const claimed = await db.update(announcements).set({ emailedAt: now }).where(and(eq(announcements.id, a.id), isNull(announcements.emailedAt))).returning({ id: announcements.id });
    if (!claimed.length) continue;
    const sender = a.createdBy ? (await db.select().from(users).where(eq(users.id, a.createdBy)))[0] : undefined;
    const r = await sendNotification("announcement", {
      userIds: (await audienceUsers(a)).map(p => p.id),
      vars: {
        title: a.title, messageHtml: messageHtml(a.body), importanceNote: a.importance === "important" ? "This is an important notice." : "",
        ackNote: a.requiresAcknowledgement ? "Please sign in to Capera and confirm that you have read and understood it." : "", sender: nameOf(sender),
      },
      path: "/announcements", settingId: ANNOUNCEMENT_SETTING_ID, dedupKey: `announcement:${a.id}`, metadata: { announcementId: a.id },
    });
    emails += r.recipients;
  }
  return { announcements: due.length, emails };
}

// ---------------------------------------------------------------------------------------------------------------- people

export interface MyAnnouncement {
  id: string; title: string; body: string; importance: string; requiresAcknowledgement: boolean; goesLiveAt: string | null; expiresAt: string | null; expired: boolean; edited: boolean;
  readAt: string | null; acknowledgedAt: string | null; needsAction: boolean; sender: string | null;
}

export async function mine(userId: string, now = new Date()): Promise<{ announcements: MyAnnouncement[]; unread: number; needsAction: number }> {
  const me = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!me || !isCurrent(me)) return { announcements: [], unread: 0, needsAction: 0 }; // someone who has left sees nothing
  const since = new Date(now.getTime() - EARLIER_DAYS * DAY);
  const live = await db.select().from(announcements).where(and(eq(announcements.status, "published"), or(isNull(announcements.publishAt), lte(announcements.publishAt, now)))).orderBy(desc(announcements.publishedAt)).limit(300);
  const out: Array<{ a: Announcement; mine: boolean }> = [];
  for (const a of live) {
    if (a.expiresAt && a.expiresAt < since) continue;
    out.push({ a, mine: (await audienceTest(a))(me) });
  }
  const visible = out.filter(x => x.mine).map(x => x.a);
  const reads = visible.length ? new Map((await db.select().from(announcementReads).where(and(eq(announcementReads.userId, userId), inArray(announcementReads.announcementId, visible.map(v => v.id))))).map(r => [r.announcementId, r])) : new Map();
  const senders = new Map((await db.select().from(users).where(inArray(users.id, Array.from(new Set(visible.map(v => v.createdBy).filter((x): x is string => !!x))).concat(["-"])))).map(u => [u.id, nameOf(u)]));
  const list: MyAnnouncement[] = visible.map(a => {
    const read = reads.get(a.id);
    const expired = !!a.expiresAt && a.expiresAt <= now;
    const done = a.requiresAcknowledgement ? !!read?.acknowledgedAt : !!read;
    return {
      id: a.id, title: a.title, body: a.body, importance: a.importance, requiresAcknowledgement: a.requiresAcknowledgement, goesLiveAt: (goLive(a))?.toISOString() ?? null,
      expiresAt: a.expiresAt?.toISOString() ?? null, expired, edited: !!a.editedAt, readAt: read?.readAt?.toISOString() ?? null, acknowledgedAt: read?.acknowledgedAt?.toISOString() ?? null,
      needsAction: !expired && !done, sender: a.createdBy ? senders.get(a.createdBy) ?? null : null,
    };
  }).sort((x, y) => Number(x.expired) - Number(y.expired) || Number(y.needsAction) - Number(x.needsAction) || Number(y.importance === "important") - Number(x.importance === "important") || String(y.goesLiveAt).localeCompare(String(x.goesLiveAt)));
  return { announcements: list, unread: list.filter(l => !l.expired && !l.readAt).length, needsAction: list.filter(l => l.needsAction && (l.importance === "important" || l.requiresAcknowledgement)).length };
}

async function visibleTo(announcementId: string, userId: string): Promise<Announcement> {
  const a = await load(announcementId);
  const me = (await db.select().from(users).where(eq(users.id, userId)))[0];
  const live = a.status === "published" && (!a.publishAt || a.publishAt <= new Date());
  if (!me || !live || !(await audienceTest(a))(me)) throw new AnnouncementError(404, "Announcement not found");
  return a;
}

export async function markRead(announcementId: string, userId: string) {
  await visibleTo(announcementId, userId);
  await db.insert(announcementReads).values({ announcementId, userId }).onConflictDoNothing();
  return { success: true };
}

export async function acknowledge(announcementId: string, userId: string) {
  const a = await visibleTo(announcementId, userId);
  if (!a.requiresAcknowledgement) return markRead(announcementId, userId);
  await db.insert(announcementReads).values({ announcementId, userId, acknowledgedAt: new Date() })
    .onConflictDoUpdate({ target: [announcementReads.announcementId, announcementReads.userId], set: { acknowledgedAt: sql`coalesce(${announcementReads.acknowledgedAt}, now())` } });
  return { success: true };
}
