import { db } from "../db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { users, appraisals, performanceCycles, performanceObjectives, notificationLogs } from "@shared/schema";
import { sendNotification, getRule } from "./notifications";

// Emails and reminders for the appraisal workflow. Two kinds:
//  - event emails, sent straight away when something needs someone's attention (self review opened,
//    your turn to review, report shared). sendNotification() never throws, so a mail problem cannot stop an
//    appraisal moving on.
//  - reminders, run once a day by runPerformanceReminders(): from 30 days before a due date, then at
//    14, 7, 3 and 1 days, on the day, and weekly once overdue. notification_logs is the dedup ledger.
// When email is not configured the message is logged as "skipped" and the person still sees the same
// thing in the "To do" list on My Performance, which does not depend on email.

export const PERFORMANCE_SETTING_ID = "performance-review";
export const REMINDER_THRESHOLDS_DAYS = [30, 14, 7, 3, 1, 0];
const DAY = 86400000;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function appLink(path: string): string | null {
  const base = process.env.APP_BASE_URL || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}` : "");
  return base ? `${base.replace(/\/$/, "")}${path}` : null;
}

const fullName = (u: { firstName: string | null; lastName: string | null; email: string | null }) =>
  `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "a colleague";
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// The workflow code reads as what is happening. Each is a notification type (see notificationTypes.ts), so an administrator
// can switch it off, add recipients or change its wording.
const base = (appraisalId: string) => ({ path: `/performance/appraisals/${appraisalId}`, settingId: PERFORMANCE_SETTING_ID, metadata: { appraisalId } });

export const notify = {
  async objectivesStarted(a: { id: string; userId: string; managerId: string | null }, dueDate: Date | null) {
    const mgr = a.managerId ? (await db.select().from(users).where(eq(users.id, a.managerId)))[0] : undefined;
    await sendNotification("appraisal_started", { userIds: [a.userId], aboutUserId: a.userId, vars: { manager: mgr ? fullName(mgr) : "Your manager", dueText: dueDate ? ` by ${fmt(dueDate)}` : "" }, ...base(a.id) });
  },
  async selfReviewOpened(a: { id: string; userId: string }, dueDate: Date | null) {
    await sendNotification("self_review_opened", { userIds: [a.userId], aboutUserId: a.userId, vars: { dueText: dueDate ? ` and is due by ${fmt(dueDate)}` : "", reminderNote: dueDate ? "We will send reminders in the 30 days before the due date." : "" }, ...base(a.id) });
  },
  async managerTurn(a: { id: string; userId: string; managerId: string | null }, dueDate: Date | null) {
    if (!a.managerId) return;
    const emp = (await db.select().from(users).where(eq(users.id, a.userId)))[0];
    await sendNotification("manager_review_turn", { userIds: [a.managerId], vars: { employee: emp ? fullName(emp) : "Your team member", dueText: dueDate ? `, due by ${fmt(dueDate)}` : "" }, ...base(a.id) });
  },
  async reportShared(a: { id: string; userId: string }) {
    await sendNotification("report_shared", { userIds: [a.userId], aboutUserId: a.userId, vars: {}, ...base(a.id) });
  },
  async raterProposed(a: { id: string; userId: string; managerId: string | null }) {
    if (!a.managerId) return;
    const emp = (await db.select().from(users).where(eq(users.id, a.userId)))[0];
    await sendNotification("raters_proposed", { userIds: [a.managerId], vars: { employee: emp ? fullName(emp) : "Someone in your team" }, ...base(a.id) });
  },
  async feedbackRequested(raterId: string, subjectUserId: string, requestId: string) {
    const subject = (await db.select().from(users).where(eq(users.id, subjectUserId)))[0];
    await sendNotification("feedback_requested", { userIds: [raterId], vars: { colleague: subject ? fullName(subject) : "A colleague" }, path: `/performance/feedback/${requestId}`, dedupKey: requestId, settingId: PERFORMANCE_SETTING_ID });
  },
};

// ---------------------------------------------------------------- daily reminders

interface Due { recipientId: string; stage: string; dueDate: Date; task: string; detail: string; appraisalId: string }

export async function runPerformanceReminders(now = new Date()): Promise<{ checked: number; notified: number; emailed: number }> {
  const rows = await db.select({ a: appraisals, c: performanceCycles, u: users }).from(appraisals)
    .innerJoin(performanceCycles, eq(appraisals.cycleId, performanceCycles.id))
    .innerJoin(users, eq(appraisals.userId, users.id))
    .where(and(eq(performanceCycles.status, "open"), eq(appraisals.isActive, true), inArray(appraisals.status, ["objectives", "self_review", "manager_review", "meeting"])));
  if (!rows.length) return { checked: 0, notified: 0, emailed: 0 };

  const objectiveCounts = await db.select({
    appraisalId: performanceObjectives.appraisalId, total: sql<number>`count(*)::int`, drafts: sql<number>`count(*) filter (where ${performanceObjectives.status} = 'draft')::int`,
  }).from(performanceObjectives).where(and(inArray(performanceObjectives.appraisalId, rows.map(r => r.a.id)), eq(performanceObjectives.isActive, true))).groupBy(performanceObjectives.appraisalId);
  const objByAppraisal = new Map(objectiveCounts.map(o => [o.appraisalId, o]));

  const logs = await db.select({ metadata: notificationLogs.metadata }).from(notificationLogs).where(eq(notificationLogs.settingId, PERFORMANCE_SETTING_ID));
  const done = new Set(logs.map(l => (l.metadata as any)?.dedupKey).filter(Boolean));

  const todo: Due[] = [];
  for (const { a, c, u } of rows) {
    const name = fullName(u);
    const objs = objByAppraisal.get(a.id);
    if (a.status === "objectives") {
      const due = a.objectivesDueDate ?? c.objectiveDeadline;
      if (!due) continue;
      if (!objs || objs.total === 0) todo.push({ recipientId: a.userId, stage: "objectives", dueDate: new Date(due), task: "set your objectives", detail: "Please draft your objectives for your annual review.", appraisalId: a.id });
      else if (objs.drafts > 0 && a.managerId) todo.push({ recipientId: a.managerId, stage: "agree", dueDate: new Date(due), task: `agree objectives for ${name}`, detail: `${name} has drafted objectives that are waiting for your agreement.`, appraisalId: a.id });
    } else if (a.status === "self_review") {
      const due = a.selfReviewDueDate ?? c.selfReviewDeadline;
      if (due) todo.push({ recipientId: a.userId, stage: "self_review", dueDate: new Date(due), task: "complete your self assessment", detail: "Your self assessment is due. Please complete it and submit it to your manager.", appraisalId: a.id });
    } else if (a.status === "manager_review" && a.managerId) {
      const due = a.managerReviewDueDate ?? c.managerReviewDeadline;
      if (due) todo.push({ recipientId: a.managerId, stage: "manager_review", dueDate: new Date(due), task: `complete the review for ${name}`, detail: `${name}'s self assessment is in. Your manager review is due.`, appraisalId: a.id });
    } else if (a.status === "meeting" && !a.sharedAt && a.managerId && a.managerSubmittedAt) {
      // no due date for the discussion itself: nudge the manager every week after the first 7 days
      const waitedDays = (now.getTime() - new Date(a.managerSubmittedAt).getTime()) / DAY;
      if (waitedDays >= 7) todo.push({ recipientId: a.managerId, stage: "discussion", dueDate: new Date(new Date(a.managerSubmittedAt).getTime() + 7 * DAY), task: `hold the review discussion with ${name}`, detail: `Your review of ${name} is complete. Please hold the discussion and share the report with them.`, appraisalId: a.id });
    }
  }

  // an administrator can switch the reminders off, or change the days
  const rule = await getRule("performance_reminder");
  if (!rule.isEnabled) return { checked: todo.length, notified: 0, emailed: 0 };
  const thresholds = [...(rule.reminderDays ?? REMINDER_THRESHOLDS_DAYS)].sort((x, y) => x - y);
  const maxThreshold = thresholds[thresholds.length - 1];

  let notified = 0, emailed = 0;
  for (const t of todo) {
    const days = Math.ceil((t.dueDate.getTime() - now.getTime()) / DAY);
    if (days > maxThreshold) continue; // nothing until the first reminder day
    const bucket = days < 0 ? `overdue-w${Math.floor(-days / 7)}` : `t${thresholds.find(th => days <= th)}`;
    const dedupKey = `${t.appraisalId}:${t.stage}:${bucket}:${t.dueDate.toISOString().slice(0, 10)}:${t.recipientId}`;
    if (done.has(dedupKey)) continue;
    const when = days < 0 ? `It was due on ${fmt(t.dueDate)} and is now ${-days} day${-days === 1 ? "" : "s"} overdue.` : days === 0 ? "It is due today." : `It is due on ${fmt(t.dueDate)} (${days} day${days === 1 ? "" : "s"} away).`;
    const r = await sendNotification("performance_reminder", { userIds: [t.recipientId], vars: { task: t.task, detail: t.detail, dueText: when }, path: `/performance/appraisals/${t.appraisalId}`, dedupKey, settingId: PERFORMANCE_SETTING_ID, metadata: { appraisalId: t.appraisalId, stage: t.stage } });
    done.add(dedupKey);
    notified++; if (r.sent) emailed++;
  }
  return { checked: todo.length, notified, emailed };
}
