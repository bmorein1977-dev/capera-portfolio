// Scheduled reports: a manager or administrator asks for a page's report to be emailed to them every week or month.
//   - The report always runs as, and goes to, the person who set it up. It reads the data through the same calls the page uses, with a short-lived pass made for
//     that one person (see reportRunnerAuth.ts), so every permission and "only your own people" rule applies exactly as it does at their screen.
//   - If they have since left, or lost the manager/administrator role, nothing is sent and the schedule says why.
//   - Several copies of the server may be running, so a due report is claimed by moving its next run time forward in one step that only one of them can win.
//   - After a long stop, a report that was due is sent once (not once for every day it was missed).
import { and, eq, lte } from "drizzle-orm";
import { db } from "../db";
import { reportSchedules, users, type ReportSchedule } from "@shared/schema";
import type { IStorage } from "../storage";
import { gatherWithNotes, pageFilters, type Table } from "./reportData";
import { buildWorkbook } from "./reportWorkbook";
import { aiAvailable, buildInfographic } from "./reportInfographic";
import { renderSummaryHtml } from "./reportEmail";
import { makeRunnerPass, RUNNER_HEADER } from "./reportRunnerAuth";
import { sendScheduledReport } from "./notifications";
import { isAccountClosed } from "../replitAuth";
import { recordSystemEvent } from "./auditLog";

export const MAX_SCHEDULES_PER_PERSON = 10;
export const REPORT_ROLES = ["manager", "admin", "super_admin", "developer"];
export type Format = "both" | "summary" | "excel";
export { nextRunAfter, describeWhen, validTimezone, WEEKDAYS, type Frequency, type When } from "./reportScheduleTime";
import { nextRunAfter, type When } from "./reportScheduleTime";

// ------------------------------------------------------------------------------------------------------------ running one
const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");
export interface RunContext { storage: Pick<IStorage, "getUser" | "getEffectiveRoles">; base: string }
export interface RunOutcome { status: "sent" | "not_sent" | "failed" | "blocked"; message: string }

const clip = (s: string) => s.slice(0, 400);

async function runReport(s: ReportSchedule, ctx: RunContext): Promise<RunOutcome> {
  const user = await ctx.storage.getUser(s.userId);
  if (!user || (await isAccountClosed(s.userId))) return { status: "blocked", message: "The person this report is for has left or no longer has access, so it was not sent." };
  const roles = (await ctx.storage.getEffectiveRoles(s.userId)).map(norm);
  if (!roles.some(r => REPORT_ROLES.includes(r))) return { status: "blocked", message: "You no longer have a manager or administrator role, so this report was not sent. It will be sent again if you get one back." };
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || s.userId;
  const top = ["developer", "super_admin", "admin", "manager"].find(r => roles.includes(r)) ?? "manager";

  const urls = Array.isArray(s.urls) ? s.urls : [];
  const { tables, notes } = await gatherWithNotes(ctx.base, urls, { [RUNNER_HEADER]: makeRunnerPass(s.userId) });
  const data = tables.filter((t: Table) => t.kind !== "reference" && t.rows.length > 0);
  if (!data.length) return { status: "failed", message: "The report came back empty, so nothing was sent. The page may have changed, or you may no longer be able to see this data." };

  const format = (["both", "summary", "excel"] as const).includes(s.format as Format) ? (s.format as Format) : "both";
  const when = new Date();
  const frequency = s.frequency === "monthly" ? "monthly" : "weekly";
  let summaryHtml = "", note = "";
  if (format !== "excel") {
    const info = await buildInfographic(data, s.title, `${name}, ${top.replace(/_/g, " ")}`, !!s.useAi && aiAvailable());
    summaryHtml = renderSummaryHtml(info);
  }
  const attachments = [] as Array<{ filename: string; content: Buffer; contentType: string }>;
  if (format !== "summary") {
    const content = await buildWorkbook(data, { title: s.title, pagePath: s.pagePath, preparedFor: name, role: top.replace(/_/g, " "), generatedAt: when, filters: [...pageFilters(urls), ...notes] });
    attachments.push({ filename: `Capera - ${s.title.replace(/[^\w\s\-&,.()]/g, "").slice(0, 70)} - ${when.toISOString().slice(0, 10)}.xlsx`, content, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    note = "The full data is attached as an Excel workbook. It includes people's names, so please look after it.";
  } else note = "Open the report in Capera for the full data.";

  const sent = await sendScheduledReport(s.userId, { vars: { reportTitle: s.title, frequency, summaryHtml, attachmentNote: note }, path: s.pagePath, attachments, metadata: { scheduleId: s.id } });
  const rows = data.reduce((n, t) => n + t.rows.length, 0);
  if (sent.status === "sent") {
    void recordSystemEvent({ actorId: s.userId, action: "Sent a scheduled report", entityType: "Report", entityId: s.id, entityLabel: s.title, summary: `${frequency} report to the person who set it up, ${rows} rows, ${attachments.length ? "Excel workbook attached" : "summary only"}` }).catch(() => {});
    return { status: "sent", message: `Sent, with ${rows.toLocaleString("en-GB")} rows${attachments.length ? " and the Excel workbook" : ""}.` };
  }
  if (sent.status === "failed") return { status: "failed", message: clip(`The email could not be sent: ${sent.error ?? "unknown problem"}`) };
  return { status: "not_sent", message: clip(sent.status === "off" ? (sent.error ?? "Scheduled report emails are switched off.") : (sent.error ?? "Email is not set up, so this was recorded but not sent.")) };
}

async function finish(s: ReportSchedule, out: RunOutcome, advance?: Date) {
  await db.update(reportSchedules).set({ lastRunAt: new Date(), lastStatus: out.status, lastMessage: out.message, updatedAt: new Date(), ...(advance ? { nextRunAt: advance } : {}) }).where(eq(reportSchedules.id, s.id));
}

/** Runs one schedule now, for "Send now". Does not move the next scheduled time. */
export async function runScheduleNow(s: ReportSchedule, ctx: RunContext): Promise<RunOutcome> {
  let out: RunOutcome;
  try { out = await runReport(s, ctx); } catch (e) { console.error("Scheduled report failed:", (e as Error).message); out = { status: "failed", message: "The report could not be built. Please try again." }; }
  await finish(s, out).catch(() => {});
  return out;
}

/** Sends every report that is due. Safe to call from several servers at once: each due report is claimed by exactly one of them. */
export async function runDueSchedules(ctx: RunContext, now = new Date()): Promise<{ claimed: number; sent: number }> {
  const due = await db.select().from(reportSchedules).where(and(eq(reportSchedules.enabled, true), lte(reportSchedules.nextRunAt, now))).limit(50);
  let claimed = 0, sent = 0;
  for (const s of due) {
    const next = nextRunAfter({ frequency: s.frequency === "monthly" ? "monthly" : "weekly", weekday: s.weekday ?? 1, dayOfMonth: s.dayOfMonth ?? 1, hour: s.hour ?? 7, timezone: s.timezone }, now);
    // claim it: moving the next time forward only succeeds while it is still due and switched on, so of two servers looking at once only one gets a row back
    const won = await db.update(reportSchedules).set({ nextRunAt: next, updatedAt: new Date() }).where(and(eq(reportSchedules.id, s.id), lte(reportSchedules.nextRunAt, now), eq(reportSchedules.enabled, true))).returning({ id: reportSchedules.id });
    if (!won.length) continue;
    claimed++;
    let out: RunOutcome;
    try { out = await runReport(s, ctx); } catch (e) { console.error("Scheduled report failed:", (e as Error).message); out = { status: "failed", message: "The report could not be built." }; }
    await finish(s, out).catch(() => {});
    if (out.status === "sent") sent++;
  }
  return { claimed, sent };
}

export async function ownerName(userId: string): Promise<string | null> {
  const u = (await db.select({ f: users.firstName, l: users.lastName, e: users.email }).from(users).where(eq(users.id, userId)))[0];
  return u ? (`${u.f ?? ""} ${u.l ?? ""}`.trim() || u.e || null) : null;
}
