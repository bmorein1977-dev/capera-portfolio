// Training course evaluations: who is asked, when, and how they are reminded.
//
// Nobody has to remember to send a form. Capera looks for attendance it already records: a course booking marked completed, e-learning finished in
// Capera, or a completion recorded against someone's training. Each attendance is asked about once, whichever of those recorded it, and again some
// weeks later (the follow-up). Records older than the day evaluations were switched on, and past certificates a contractor declared, are not asked about.
import { db } from "../db";
import { and, eq, inArray, isNotNull, isNull, lt, lte, gte, sql } from "drizzle-orm";
import { trainingEvaluations, trainingEvaluationSettings, type TrainingEvaluation } from "@shared/schema";
import { defaultSettings, settingsSchema, formTypeFor, FORM_TYPE_LABEL, type EvaluationSettings, type FormType } from "@shared/trainingEvaluation";
import { tierIncludes } from "@shared/licence";
import { licensedTier } from "./licence";
import { emailService } from "./emailService";
import { sendNotification, getRule } from "./notifications";

const DAY = 86_400_000;
export const EVALUATIONS_PATH = "/my-training-feedback";
/** two records of the same course within this many days are the same attendance (a booking and the completion it created, for example) */
const SAME_ATTENDANCE_DAYS = 14;
/** marks a request Capera withdrew itself because the attendance behind it was corrected, so it can come back if the attendance does */
export const AUTO_WITHDRAWN = "The attendance record behind this was changed";

const timeZone = () => process.env.APP_TIME_ZONE || "Europe/London";
export const dayOf = (d: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: timeZone(), year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const today = (now = new Date()) => dayOf(now);
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);
export const longDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
// timestamps are stored as UTC without a zone, and are asked for as text so the server's own time zone cannot move them
const asDate = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v).includes("T") ? String(v) : `${String(v).replace(" ", "T")}Z`));
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const licensed = () => tierIncludes(licensedTier(), "silver");

// ------------------------------------------------------------------------------------------------------------ settings

/** The stored settings. The first time they are asked for, evaluations start from today, so past training is never chased. */
export async function getSettings(): Promise<EvaluationSettings> {
  const row = (await db.select().from(trainingEvaluationSettings).where(eq(trainingEvaluationSettings.id, "default")))[0];
  const base = defaultSettings(today());
  if (!row) {
    await db.insert(trainingEvaluationSettings).values({ id: "default", settings: base }).onConflictDoNothing();
    return (await db.select().from(trainingEvaluationSettings).where(eq(trainingEvaluationSettings.id, "default")))[0].settings as EvaluationSettings;
  }
  const merged = { ...base, ...(row.settings as object) };
  const parsed = settingsSchema.safeParse(merged);
  if (!parsed.success) { console.error("Stored evaluation settings do not match what is expected; using the defaults for anything unreadable"); return { ...base, startFrom: (row.settings as any)?.startFrom ?? base.startFrom }; }
  return parsed.data;
}

export async function saveSettings(settings: EvaluationSettings, actorId: string): Promise<EvaluationSettings> {
  await db.insert(trainingEvaluationSettings).values({ id: "default", settings, updatedBy: actorId })
    .onConflictDoUpdate({ target: trainingEvaluationSettings.id, set: { settings, updatedBy: actorId, updatedAt: new Date() } });
  return settings;
}

// ------------------------------------------------------------------------------------------------------------ attendance

interface Attendance {
  userId: string; trainingId: string | null; courseKey: string; completedOn: string; source: "booking" | "elearning" | "record"; sourceRef: string;
  sessionId: string | null; externalTitle: string | null; modality: string | null; providerName: string | null; venueName: string | null; instructor: string | null;
}
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as any[];

async function findAttendance(from: string, to: string, userId?: string): Promise<Attendance[]> {
  const lower = addDays(from, -1); // the database comparison is generous by a day; the exact day is checked below in the right time zone
  const who = (column: ReturnType<typeof sql>) => (userId ? sql`and ${column} = ${userId}` : sql``);
  const bookings = await rows(sql`select b.id, b.user_id, b.completion_date::text completion_date, s.id session_id, s.end_at::text end_at, s.instructor, c.id course_id, c.training_id, c.title, c.modality, p.name provider, v.name venue, v.city, v.is_virtual
    from course_bookings b join course_training_sessions s on s.id = b.session_id join external_training_courses c on c.id = s.course_id
    left join training_providers p on p.id = c.provider_id left join training_venues v on v.id = s.venue_id
    where b.status = 'completed' and coalesce(b.completion_date, s.end_at) >= ${lower}::date ${who(sql`b.user_id`)}`);
  const completions = await rows(sql`select a.id, a.user_id, a.training_id, a.method, a.completed_at::text completed_at from training_completion_audit a
    where a.completed_at >= ${lower}::date and a.method not in ('contractor_declared', 'imported') ${who(sql`a.user_id`)}
    and not exists (select 1 from training_enrollments e where e.id = a.enrollment_id and (not coalesce(e.is_active, true) or e.status <> 'completed'))`);
  const enrolments = await rows(sql`select e.id, e.user_id, e.training_id, e.achievement_date::text achievement_date from training_enrollments e
    where coalesce(e.is_active, true) and e.status = 'completed' and e.achievement_date >= ${lower}::date ${who(sql`e.user_id`)}
    and not exists (select 1 from contractor_declarations d where d.training_enrollment_id = e.id)`);

  const blank = { sessionId: null, externalTitle: null, modality: null, providerName: null, venueName: null, instructor: null };
  const out: Attendance[] = [
    // bookings first: when two records describe one attendance, the booking is the one that knows the provider, venue and instructor
    ...bookings.map((b): Attendance => ({
      userId: b.user_id, trainingId: b.training_id ?? null, courseKey: b.training_id ?? `course:${b.course_id}`, completedOn: dayOf(asDate(b.completion_date ?? b.end_at)),
      source: "booking", sourceRef: `booking:${b.id}`, sessionId: b.session_id, externalTitle: b.title, modality: b.modality ?? null, providerName: b.provider ?? null,
      venueName: b.is_virtual ? "Online" : [b.venue, b.city].filter(Boolean).join(", ") || null, instructor: String(b.instructor ?? "").trim() || null,
    })),
    ...completions.map((a): Attendance => ({ ...blank, userId: a.user_id, trainingId: a.training_id, courseKey: a.training_id, completedOn: dayOf(asDate(a.completed_at)), source: a.method === "content_completed" ? "elearning" : "record", sourceRef: `completion:${a.id}` })),
    ...enrolments.map((e): Attendance => ({ ...blank, userId: e.user_id, trainingId: e.training_id, courseKey: e.training_id, completedOn: dayOf(asDate(e.achievement_date)), source: "record", sourceRef: `enrolment:${e.id}` })),
  ];
  return out.filter(a => a.completedOn >= from && a.completedOn <= to);
}

/** Withdraws requests whose attendance has since been corrected: a booking no longer marked completed, or a completion that was removed. */
async function withdrawCorrected(userId?: string): Promise<number> {
  const mine = userId ? sql`and t.user_id = ${userId}` : sql``;
  const gone = await rows(sql`select t.id from training_evaluations t
    where t.status = 'open' ${mine} and (
      (t.source_ref like 'booking:%' and not exists (select 1 from course_bookings b where 'booking:' || b.id = t.source_ref and b.status = 'completed'))
      or (t.source_ref like 'enrolment:%' and not exists (select 1 from training_enrollments e where 'enrolment:' || e.id = t.source_ref and coalesce(e.is_active, true) and e.status = 'completed'))
      or (t.source_ref like 'completion:%' and exists (select 1 from training_completion_audit a join training_enrollments e on e.id = a.enrollment_id where 'completion:' || a.id = t.source_ref and (not coalesce(e.is_active, true) or e.status <> 'completed'))))`);
  if (gone.length) {
    await db.update(trainingEvaluations).set({ status: "cancelled", declineReason: AUTO_WITHDRAWN, updatedAt: new Date() })
      .where(and(inArray(trainingEvaluations.id, gone.map(g => g.id as string)), eq(trainingEvaluations.status, "open")));
  }
  return gone.length;
}

/** Creates the requests that are due for attendance Capera has recorded. Safe to run as often as needed: each attendance is asked about once. */
export async function syncEvaluations(opts: { userId?: string; now?: Date } = {}): Promise<{ created: number; withdrawn: number }> {
  const settings = await getSettings();
  if (!settings.enabled || !licensed()) return { created: 0, withdrawn: 0 };
  const now = opts.now ?? new Date();
  const day = today(now);
  const withdrawn = await withdrawCorrected(opts.userId);
  // attendance is asked about while it is fresh: nothing older than the reply window, and nothing from before evaluations began
  const earliest = addDays(day, -settings.windowDays);
  const from = settings.startFrom > earliest ? settings.startFrom : earliest;
  const found = await findAttendance(from, day, opts.userId);
  if (!found.length) return { created: 0, withdrawn };

  const userIds = Array.from(new Set(found.map(a => a.userId)));
  const inList = (ids: string[]) => sql.join(ids.map(i => sql`${i}`), sql`, `);
  const people = new Map((await rows(sql`select u.id, j.name job_role from users u left join job_roles j on j.id = u.job_role_id
    where u.id in (${inList(userIds)}) and coalesce(u.is_active, true) and u.anonymised_at is null and (not coalesce(u.is_archived, false) or u.left_at > now())`)).map(p => [p.id as string, p]));
  const trainingIds = Array.from(new Set(found.map(a => a.trainingId).filter((x): x is string => !!x)));
  const courses = new Map(trainingIds.length ? (await rows(sql`select t.id, t.name, t.training_source, c.name category, e.modality from trainings t
    left join training_categories c on c.id = t.category_id left join external_training_courses e on e.training_id = t.id where t.id in (${inList(trainingIds)})`)).map(t => [t.id as string, t]) : []);
  const existing = await db.select().from(trainingEvaluations).where(inArray(trainingEvaluations.userId, userIds));
  const known = new Map<string, TrainingEvaluation[]>();
  for (const e of existing) { const k = `${e.userId}|${e.courseKey}`; (known.get(k) ?? known.set(k, []).get(k)!).push(e); }

  let created = 0;
  const seen = new Set<string>();
  for (const a of found) {
    const person = people.get(a.userId);
    if (!person) continue;
    const key = `${a.userId}|${a.courseKey}`;
    const near = (known.get(key) ?? []).filter(e => Math.abs(daysBetween(e.completedOn, a.completedOn)) <= SAME_ATTENDANCE_DAYS);
    const same = near.find(e => e.stage === "course");
    if (same) {
      const withdrawnByCapera = near.filter(e => e.status === "cancelled" && e.declineReason === AUTO_WITHDRAWN);
      if (withdrawnByCapera.length) {
        // the attendance is back (a booking was marked completed again): ask again
        for (const e of withdrawnByCapera) {
          await db.update(trainingEvaluations).set({ status: "open", declineReason: null, sourceRef: a.sourceRef, dueOn: addDays(e.opensOn > day ? e.opensOn : day, settings.windowDays), updatedAt: now })
            .where(and(eq(trainingEvaluations.id, e.id), eq(trainingEvaluations.status, "cancelled")));
          e.status = "open"; e.declineReason = null;
        }
      } else if (a.source === "booking" && same.source !== "booking" && same.status === "open") {
        // the booking was marked completed after the plain record: add what it knows
        await db.update(trainingEvaluations).set({ source: "booking", sourceRef: a.sourceRef, sessionId: a.sessionId, providerName: a.providerName, venueName: a.venueName, instructor: a.instructor, updatedAt: now })
          .where(and(eq(trainingEvaluations.userId, a.userId), eq(trainingEvaluations.courseKey, a.courseKey), eq(trainingEvaluations.completedOn, same.completedOn)));
        same.source = "booking";
      }
      continue;
    }
    if (seen.has(key)) continue;
    const course = a.trainingId ? courses.get(a.trainingId) : undefined;
    const title = (course?.name as string | undefined) ?? a.externalTitle;
    if (!title) continue; // a completion against a training that no longer exists
    const formType = formTypeFor({ override: a.trainingId ? settings.courseForms[a.trainingId] : undefined, viaElearning: a.source === "elearning", trainingSource: course?.training_source, modality: a.modality ?? (a.source === "booking" ? course?.modality : null) });
    if (formType === "none") continue;
    seen.add(key);
    const shared = {
      userId: a.userId, trainingId: a.trainingId, courseKey: a.courseKey, courseTitle: title, categoryName: (course?.category as string | undefined) ?? null, formType: formType as FormType,
      source: a.source, sourceRef: a.sourceRef, sessionId: a.sessionId, providerName: a.providerName, venueName: a.venueName, instructor: a.instructor,
      jobRoleName: (person.job_role as string | null) ?? null, completedOn: a.completedOn,
    };
    const added = await db.insert(trainingEvaluations).values({ ...shared, stage: "course", opensOn: a.completedOn, dueOn: addDays(day, settings.windowDays) }).onConflictDoNothing().returning({ id: trainingEvaluations.id });
    if (!added.length) continue;
    created++;
    if (settings.followUpDays > 0) {
      const planned = addDays(a.completedOn, settings.followUpDays);
      const opensOn = planned > day ? planned : day;
      await db.insert(trainingEvaluations).values({ ...shared, stage: "followup", opensOn, dueOn: addDays(opensOn, settings.windowDays) }).onConflictDoNothing();
    }
  }
  return { created, withdrawn };
}

// ------------------------------------------------------------------------------------------------------------ invitations and reminders

export async function closeOverdue(now = new Date()): Promise<number> {
  const closed = await db.update(trainingEvaluations).set({ status: "expired", updatedAt: now }).where(and(eq(trainingEvaluations.status, "open"), lt(trainingEvaluations.dueOn, today(now)))).returning({ id: trainingEvaluations.id });
  return closed.length;
}

const askable = (day: string, userId?: string) => and(eq(trainingEvaluations.status, "open"), lte(trainingEvaluations.opensOn, day), gte(trainingEvaluations.dueOn, day), ...(userId ? [eq(trainingEvaluations.userId, userId)] : []));

const itemsTable = (list: TrainingEvaluation[]) =>
  `<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Course</th><th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">What we are asking</th><th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Please reply by</th></tr></thead><tbody>` +
  list.map(e => `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(e.courseTitle)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${e.stage === "followup" ? "Follow-up: have you used it at work?" : `Your feedback (${FORM_TYPE_LABEL[e.formType as FormType].toLowerCase()})`}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${longDay(e.dueOn)}</td></tr>`).join("") +
  "</tbody></table>";

function byPerson(list: TrainingEvaluation[]): Array<[string, TrainingEvaluation[]]> {
  const m = new Map<string, TrainingEvaluation[]>();
  for (const e of list) (m.get(e.userId) ?? m.set(e.userId, []).get(e.userId)!).push(e);
  return Array.from(m.entries()).map(([id, items]) => [id, items.sort((a, b) => a.dueOn.localeCompare(b.dueOn))]);
}
const send = (type: "training_evaluation_invite" | "training_evaluation_reminder", userId: string, items: TrainingEvaluation[]) =>
  sendNotification(type, { userIds: [userId], aboutUserId: userId, vars: { count: items.length, dueDate: longDay(items[0].dueOn), itemsHtml: itemsTable(items) }, path: EVALUATIONS_PATH, settingId: "training-evaluations", metadata: { evaluationIds: items.map(i => i.id) } });

/** One email per person for anything newly open to them. Each request is invited once. */
export async function sendInvitations(opts: { userId?: string; now?: Date } = {}): Promise<{ people: number }> {
  const now = opts.now ?? new Date();
  const day = today(now);
  const pending = await db.select().from(trainingEvaluations).where(and(askable(day, opts.userId), isNull(trainingEvaluations.invitedAt)));
  let people = 0;
  for (const [userId, items] of byPerson(pending)) {
    // claimed before sending, so two runs at once cannot both invite
    const claimed = await db.update(trainingEvaluations).set({ invitedAt: now }).where(and(inArray(trainingEvaluations.id, items.map(i => i.id)), isNull(trainingEvaluations.invitedAt))).returning();
    if (!claimed.length) continue;
    await send("training_evaluation_invite", userId, items.filter(i => claimed.some(c => c.id === i.id)));
    people++;
  }
  return { people };
}

/**
 * Reminds people who have not replied, every `reminderEveryDays` days up to `maxReminders` times, one email per person listing everything outstanding.
 * A reminder only counts when an email was actually sent or queued: while email is not set up, or the reminder email is switched off, none are used up.
 */
export async function sendReminders(now = new Date()): Promise<{ people: number; items: number; skipped?: string }> {
  const settings = await getSettings();
  if (!settings.enabled || !licensed()) return { people: 0, items: 0, skipped: "Training evaluations are switched off" };
  if (settings.maxReminders === 0) return { people: 0, items: 0, skipped: "Reminders are switched off" };
  if (!(await getRule("training_evaluation_reminder")).isEnabled) return { people: 0, items: 0, skipped: "The reminder email is switched off" };
  if (!emailService.isConfigured()) return { people: 0, items: 0, skipped: "Email is not set up" };
  const day = today(now);
  const open = await db.select().from(trainingEvaluations).where(and(askable(day), isNotNull(trainingEvaluations.invitedAt), lt(trainingEvaluations.reminderCount, settings.maxReminders)));
  const due = open.filter(e => addDays(dayOf(e.lastReminderAt ?? e.invitedAt!), settings.reminderEveryDays) <= day);
  return deliverReminders(due, now);
}

async function deliverReminders(due: TrainingEvaluation[], now: Date): Promise<{ people: number; items: number }> {
  let people = 0, items = 0;
  for (const [userId, list] of byPerson(due)) {
    const claimed: TrainingEvaluation[] = [];
    for (const e of list) {
      const got = await db.update(trainingEvaluations).set({ reminderCount: e.reminderCount + 1, lastReminderAt: now })
        .where(and(eq(trainingEvaluations.id, e.id), eq(trainingEvaluations.reminderCount, e.reminderCount), eq(trainingEvaluations.status, "open"))).returning({ id: trainingEvaluations.id });
      if (got.length) claimed.push(e);
    }
    if (!claimed.length) continue;
    const result = await send("training_evaluation_reminder", userId, claimed);
    if (result.sent + result.queued === 0) {
      // nothing went: do not use up a reminder. The date is kept so a failing address is not retried every hour.
      for (const e of claimed) await db.update(trainingEvaluations).set({ reminderCount: e.reminderCount }).where(eq(trainingEvaluations.id, e.id));
      continue;
    }
    people++; items += claimed.length;
  }
  return { people, items };
}

/** An administrator chasing replies now. Nothing is sent twice to the same request on one day. */
export async function remindNow(ids: string[] | null, now = new Date()): Promise<{ people: number; items: number; alreadyToday: number; message: string }> {
  const day = today(now);
  const open = await db.select().from(trainingEvaluations).where(and(askable(day), ...(ids ? [inArray(trainingEvaluations.id, ids.length ? ids : ["-"])] : [])));
  const fresh = open.filter(e => !e.lastReminderAt || dayOf(e.lastReminderAt) !== day);
  const alreadyToday = open.length - fresh.length;
  const none = (message: string) => ({ people: 0, items: 0, alreadyToday, message });
  if (!open.length) return none("There is nobody to remind");
  if (!fresh.length) return none("Everyone chosen has already been reminded today");
  if (!(await getRule("training_evaluation_reminder")).isEnabled) return none("The reminder email is switched off under Email Notifications");
  if (!emailService.isConfigured()) return none("Email is not set up, so no reminder was sent. People still see the request on their home screen.");
  const out = await deliverReminders(fresh, now);
  return { ...out, alreadyToday, message: out.people ? `Reminder sent to ${out.people} ${out.people === 1 ? "person" : "people"}` : "No reminder could be sent. See the email log." };
}

export async function runEvaluationJobs(now = new Date()): Promise<void> {
  if (!licensed()) return;
  await syncEvaluations({ now });
  await closeOverdue(now);
  if (!(await getSettings()).enabled) return;
  await sendInvitations({ now });
  await sendReminders(now);
}

/** Called after something records a completion, so the request appears at once. It never delays or fails the thing that called it. */
export function touchEvaluations(userId: string): void {
  void (async () => {
    try { await syncEvaluations({ userId }); await sendInvitations({ userId }); }
    catch (e) { console.error("Could not create the training evaluation request:", (e as Error).message); }
  })();
}

/** How many requests are open to a person now (for the home screen). */
export async function openCount(userId: string, now = new Date()): Promise<{ count: number; soonestDue: string | null }> {
  const open = await db.select({ dueOn: trainingEvaluations.dueOn }).from(trainingEvaluations).where(askable(today(now), userId));
  return { count: open.length, soonestDue: open.map(o => o.dueOn).sort()[0] ?? null };
}

export async function openSafetyCount(): Promise<number> {
  const r = await rows(sql`select count(*)::int n from training_evaluations where safety_concern and safety_closed_at is null and status = 'submitted'`);
  return Number(r[0]?.n ?? 0);
}

/** For someone whose personal details are being removed: requests never answered go, and written answers are taken out. Ratings stay in the figures. */
export async function scrubEvaluationsFor(userId: string): Promise<void> {
  await db.delete(trainingEvaluations).where(and(eq(trainingEvaluations.userId, userId), sql`${trainingEvaluations.status} <> 'submitted'`));
  const kept = await db.select().from(trainingEvaluations).where(eq(trainingEvaluations.userId, userId));
  for (const e of kept) {
    const answers = { ...((e.answers as Record<string, unknown>) ?? {}) };
    for (const k of ["best", "improve", "further", "missing", "safety_details"]) delete answers[k];
    await db.update(trainingEvaluations).set({ answers, named: false, enteredBy: null, declineReason: null, updatedAt: new Date() }).where(eq(trainingEvaluations.id, e.id));
  }
}
