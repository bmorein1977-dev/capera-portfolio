import { db } from "../db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { users, appraisals, performanceCycles, performanceObjectives, notificationLogs } from "@shared/schema";
import { emailService } from "./emailService";

// Emails and reminders for the appraisal workflow. Two kinds:
//  - event emails, sent straight away when something needs someone's attention (self review opened,
//    your turn to review, report shared). notifyUser() never throws, so a mail problem cannot stop an
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

export async function notifyUser(
  userId: string,
  subject: string,
  paragraphs: string[],
  meta: { event: string; appraisalId?: string; path?: string; dedupKey?: string },
): Promise<void> {
  try {
    const rows = await db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId));
    const recipient = rows[0];
    if (!recipient?.email) return;
    const link = meta.path ? appLink(meta.path) : null;
    const html = `<h2>${esc(subject)}</h2>${paragraphs.map(p => `<p>${esc(p)}</p>`).join("")}${link ? `<p><a href="${link}">Open it in Capera</a></p>` : "<p>Sign in to Capera to take a look.</p>"}`;
    const configured = emailService.isConfigured();
    if (configured) await emailService.sendEmail({ to: recipient.email, subject, html });
    await db.insert(notificationLogs).values({
      settingId: PERFORMANCE_SETTING_ID, recipientId: userId, recipientEmail: recipient.email, subject, body: html,
      sentAt: configured ? new Date() : undefined, status: configured ? "sent" : "skipped",
      metadata: { event: meta.event, appraisalId: meta.appraisalId, dedupKey: meta.dedupKey },
    });
  } catch (error) {
    console.error(`Performance notification failed (${meta.event}):`, error);
  }
}

// Convenience wrappers so the workflow code reads as what is happening
export const notify = {
  async objectivesStarted(a: { id: string; userId: string; managerId: string | null }, dueDate: Date | null) {
    const mgr = a.managerId ? (await db.select().from(users).where(eq(users.id, a.managerId)))[0] : undefined;
    await notifyUser(a.userId, "Your annual review has been started", [
      `${mgr ? fullName(mgr) : "Your manager"} has started your annual review. Please draft your objectives${dueDate ? ` by ${fmt(dueDate)}` : ""}, and your manager will agree them with you.`,
    ], { event: "appraisal_started", appraisalId: a.id, path: `/performance/appraisals/${a.id}` });
  },
  async selfReviewOpened(a: { id: string; userId: string }, dueDate: Date | null) {
    await notifyUser(a.userId, "Please complete your self assessment", [
      `Your self assessment is now open${dueDate ? ` and is due by ${fmt(dueDate)}` : ""}.`,
      "Look back over your objectives and behaviours, add your own ratings, and submit it to your manager.",
      ...(dueDate ? ["We will send reminders in the 30 days before the due date."] : []),
    ], { event: "self_review_opened", appraisalId: a.id, path: `/performance/appraisals/${a.id}` });
  },
  async managerTurn(a: { id: string; userId: string; managerId: string | null }, dueDate: Date | null) {
    if (!a.managerId) return;
    const emp = (await db.select().from(users).where(eq(users.id, a.userId)))[0];
    await notifyUser(a.managerId, `${emp ? fullName(emp) : "Your team member"} has submitted their self assessment`, [
      `It is now your turn to complete the manager review${dueDate ? `, due by ${fmt(dueDate)}` : ""}.`,
      "Rate each objective and behaviour, add your summary and development plan, then submit. You will then discuss it with them before sharing the report.",
    ], { event: "manager_turn", appraisalId: a.id, path: `/performance/appraisals/${a.id}` });
  },
  async reportShared(a: { id: string; userId: string }) {
    await notifyUser(a.userId, "Your review report is ready", [
      "Your manager has held your review discussion and shared the final report with you.",
      "Please read it and, when you are happy, sign it off. You can add your own comments when you do.",
    ], { event: "report_shared", appraisalId: a.id, path: `/performance/appraisals/${a.id}` });
  },
  async raterProposed(a: { id: string; userId: string; managerId: string | null }) {
    if (!a.managerId) return;
    const emp = (await db.select().from(users).where(eq(users.id, a.userId)))[0];
    await notifyUser(a.managerId, "Feedback raters need your approval", [
      `${emp ? fullName(emp) : "Someone in your team"} has suggested colleagues to give 360 feedback. Please approve the list.`,
    ], { event: "rater_proposed", appraisalId: a.id, path: `/performance/appraisals/${a.id}` });
  },
  async feedbackRequested(raterId: string, subjectUserId: string, requestId: string) {
    const subject = (await db.select().from(users).where(eq(users.id, subjectUserId)))[0];
    await notifyUser(raterId, `${subject ? fullName(subject) : "A colleague"} has asked for your feedback`, [
      "It takes a few minutes. Your answers are anonymous and only shown as averages once enough people have responded.",
    ], { event: "feedback_requested", path: `/performance/feedback/${requestId}`, dedupKey: requestId });
  },
};

// ---------------------------------------------------------------- daily reminders

interface Due { recipientId: string; stage: string; dueDate: Date; subject: string; lines: string[]; appraisalId: string }

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
      if (!objs || objs.total === 0) todo.push({ recipientId: a.userId, stage: "objectives", dueDate: new Date(due), subject: "Reminder: set your objectives", lines: ["Please draft your objectives for your annual review."], appraisalId: a.id });
      else if (objs.drafts > 0 && a.managerId) todo.push({ recipientId: a.managerId, stage: "agree", dueDate: new Date(due), subject: `Reminder: agree objectives for ${name}`, lines: [`${name} has drafted objectives that are waiting for your agreement.`], appraisalId: a.id });
    } else if (a.status === "self_review") {
      const due = a.selfReviewDueDate ?? c.selfReviewDeadline;
      if (due) todo.push({ recipientId: a.userId, stage: "self_review", dueDate: new Date(due), subject: "Reminder: complete your self assessment", lines: ["Your self assessment is due. Please complete it and submit it to your manager."], appraisalId: a.id });
    } else if (a.status === "manager_review" && a.managerId) {
      const due = a.managerReviewDueDate ?? c.managerReviewDeadline;
      if (due) todo.push({ recipientId: a.managerId, stage: "manager_review", dueDate: new Date(due), subject: `Reminder: complete the review for ${name}`, lines: [`${name}'s self assessment is in. Your manager review is due.`], appraisalId: a.id });
    } else if (a.status === "meeting" && !a.sharedAt && a.managerId && a.managerSubmittedAt) {
      // no due date for the discussion itself: nudge the manager every week after the first 7 days
      const waitedDays = (now.getTime() - new Date(a.managerSubmittedAt).getTime()) / DAY;
      if (waitedDays >= 7) todo.push({ recipientId: a.managerId, stage: "discussion", dueDate: new Date(new Date(a.managerSubmittedAt).getTime() + 7 * DAY), subject: `Reminder: hold the review discussion with ${name}`, lines: [`Your review of ${name} is complete. Please hold the discussion and share the report with them.`], appraisalId: a.id });
    }
  }

  let notified = 0, emailed = 0;
  for (const t of todo) {
    const days = Math.ceil((t.dueDate.getTime() - now.getTime()) / DAY);
    if (days > REMINDER_THRESHOLDS_DAYS[0]) continue; // nothing until 30 days out
    const bucket = days < 0 ? `overdue-w${Math.floor(-days / 7)}` : `t${[...REMINDER_THRESHOLDS_DAYS].sort((x, y) => x - y).find(th => days <= th)}`;
    const dedupKey = `${t.appraisalId}:${t.stage}:${bucket}:${t.dueDate.toISOString().slice(0, 10)}:${t.recipientId}`;
    if (done.has(dedupKey)) continue;
    const when = days < 0 ? `It was due on ${fmt(t.dueDate)} and is now ${-days} day${-days === 1 ? "" : "s"} overdue.` : days === 0 ? "It is due today." : `It is due on ${fmt(t.dueDate)} (${days} day${days === 1 ? "" : "s"} away).`;
    const before = emailService.isConfigured();
    await notifyUser(t.recipientId, t.subject, [...t.lines, when], { event: "reminder", appraisalId: t.appraisalId, path: `/performance/appraisals/${t.appraisalId}`, dedupKey });
    done.add(dedupKey);
    notified++; if (before) emailed++;
  }
  return { checked: todo.length, notified, emailed };
}
