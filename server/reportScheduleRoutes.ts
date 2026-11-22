// Scheduled reports: a manager or administrator has a page's report emailed to them every week or month.
//   GET    /api/report-schedules            my schedules (administrators can add ?all=1 to see everyone's, to keep the email volume in check)
//   POST   /api/report-schedules            {exportId, frequency, weekday, dayOfMonth, hour, timezone, format, useAi}  made from an open Export, so the data
//                                           addresses are the ones that export just read successfully as this person (never addresses typed in by a client)
//   PATCH  /api/report-schedules/:id        change the timing, the format, or pause and resume
//   DELETE /api/report-schedules/:id
//   POST   /api/report-schedules/:id/send-now
// A report is only ever for the person who made it. An administrator can pause or delete anyone's, but cannot read or redirect them.
import type { Express } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { reportSchedules, users, type ReportSchedule } from "@shared/schema";
import type { IStorage } from "./storage";
import { heldExport } from "./exportRoutes";
import { pageFilters } from "./services/reportData";
import { aiAvailable } from "./services/reportInfographic";
import { describeWhen, MAX_SCHEDULES_PER_PERSON, nextRunAfter, REPORT_ROLES, runScheduleNow, validTimezone, type Frequency } from "./services/reportSchedule";
import { recordSystemEvent } from "./services/auditLog";
import { rateLimit } from "./security";

interface Deps { storage: IStorage; isAuthenticated: any; requireRole: (...roles: string[]) => any }
const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");
const OVERSEERS = ["admin", "super_admin", "developer"];

const Timing = z.object({
  frequency: z.enum(["weekly", "monthly"]),
  weekday: z.number().int().min(0).max(6).default(1),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  hour: z.number().int().min(0).max(23).default(7),
  timezone: z.string().max(60).default("Europe/London"),
});
const Create = Timing.extend({ exportId: z.string().min(8).max(120), format: z.enum(["both", "summary", "excel"]).default("both"), useAi: z.boolean().default(false) });
const Change = Timing.partial().extend({ format: z.enum(["both", "summary", "excel"]).optional(), useAi: z.boolean().optional(), enabled: z.boolean().optional() });

export function registerReportScheduleRoutes(app: Express, { storage, isAuthenticated, requireRole }: Deps) {
  const guard = [isAuthenticated, requireRole(...REPORT_ROLES)];

  const me = async (req: any) => {
    const id = (req.session?.impersonatedUserId || req.user?.claims?.sub) as string;
    const roles = id ? (await storage.getEffectiveRoles(id)).map(norm) : [];
    return { id, roles, overseer: roles.some(r => OVERSEERS.includes(r)) };
  };
  const whenOf = (s: ReportSchedule) => ({ frequency: (s.frequency === "monthly" ? "monthly" : "weekly") as Frequency, weekday: s.weekday ?? 1, dayOfMonth: s.dayOfMonth ?? 1, hour: s.hour ?? 7, timezone: s.timezone });
  const shape = (s: ReportSchedule, viewer: string, owner?: string | null) => ({
    id: s.id, title: s.title, pagePath: s.pagePath, frequency: s.frequency, weekday: s.weekday, dayOfMonth: s.dayOfMonth, hour: s.hour, timezone: s.timezone, format: s.format, useAi: !!s.useAi,
    enabled: s.enabled, nextRunAt: s.nextRunAt, lastRunAt: s.lastRunAt, lastStatus: s.lastStatus, lastMessage: s.lastMessage, when: describeWhen(whenOf(s)),
    filters: pageFilters(Array.isArray(s.urls) ? s.urls : []), mine: s.userId === viewer, owner: owner ?? undefined,
  });
  const base = (req: any) => `http://127.0.0.1:${req.socket?.localPort ?? process.env.PORT ?? 5000}`;
  const fail = (res: any, e: any) => {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    if (e instanceof z.ZodError) return res.status(400).json({ error: "That schedule is not valid. Check the day and the time." });
    console.error("Report schedule error:", e);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  };
  // my own, or (to pause or delete only) anyone's for an administrator
  async function load(req: any, id: string, allowOverseer: boolean) {
    const who = await me(req);
    const s = (await db.select().from(reportSchedules).where(eq(reportSchedules.id, id)))[0];
    if (!s || (s.userId !== who.id && !(allowOverseer && who.overseer))) throw Object.assign(new Error("Scheduled report not found."), { status: 404 });
    return { s, who };
  }

  app.get("/api/report-schedules", ...guard, async (req: any, res) => {
    try {
      const who = await me(req);
      const all = req.query.all === "1" && who.overseer;
      const rows = await db.select({ s: reportSchedules, f: users.firstName, l: users.lastName, e: users.email }).from(reportSchedules).leftJoin(users, eq(users.id, reportSchedules.userId))
        .where(all ? undefined : eq(reportSchedules.userId, who.id)).orderBy(desc(reportSchedules.createdAt)).limit(500);
      res.json({ aiAvailable: aiAvailable(), max: MAX_SCHEDULES_PER_PERSON, canSeeAll: who.overseer, schedules: rows.map(r => shape(r.s, who.id, all ? (`${r.f ?? ""} ${r.l ?? ""}`.trim() || r.e) : undefined)) });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/report-schedules", ...guard, rateLimit({ name: "schedule-create", max: 30, windowMs: 3600_000, by: "user" }), async (req: any, res) => {
    try {
      const b = Create.parse(req.body ?? {});
      const who = await me(req);
      const h = heldExport(b.exportId, who.id);
      if (!h) throw Object.assign(new Error("That export has expired. Open Export again, then schedule it."), { status: 410 });
      const mine = (await db.select({ n: sql<number>`count(*)::int` }).from(reportSchedules).where(eq(reportSchedules.userId, who.id)))[0]?.n ?? 0;
      if (mine >= MAX_SCHEDULES_PER_PERSON) throw Object.assign(new Error(`You already have ${MAX_SCHEDULES_PER_PERSON} scheduled reports. Delete one first.`), { status: 409 });
      const timezone = validTimezone(b.timezone);
      const next = nextRunAfter({ frequency: b.frequency, weekday: b.weekday, dayOfMonth: b.dayOfMonth, hour: b.hour, timezone }, new Date());
      const row = (await db.insert(reportSchedules).values({ userId: who.id, title: h.title, pagePath: h.path, urls: h.urls, frequency: b.frequency, weekday: b.weekday, dayOfMonth: b.dayOfMonth, hour: b.hour, timezone,
        format: b.format, useAi: b.useAi && aiAvailable(), nextRunAt: next }).returning())[0];
      res.status(201).json(shape(row, who.id));
      void recordSystemEvent({ actorId: who.id, action: "Scheduled a report", entityType: "Report", entityId: row.id, entityLabel: row.title, summary: `${describeWhen(whenOf(row))}, sent to themselves` }).catch(() => {});
    } catch (e) { fail(res, e); }
  });

  app.patch("/api/report-schedules/:id", ...guard, async (req: any, res) => {
    try {
      const b = Change.parse(req.body ?? {});
      // an administrator may pause (never change or resume) someone else's
      const { s, who } = await load(req, String(req.params.id), true);
      if (s.userId !== who.id && (Object.keys(b).some(k => k !== "enabled") || b.enabled !== false)) throw Object.assign(new Error("You can pause or delete another person's scheduled report, but not change it."), { status: 403 });
      const next = { ...whenOf(s), ...Object.fromEntries(Object.entries({ frequency: b.frequency, weekday: b.weekday, dayOfMonth: b.dayOfMonth, hour: b.hour, timezone: b.timezone ? validTimezone(b.timezone) : undefined }).filter(([, v]) => v !== undefined)) } as ReturnType<typeof whenOf>;
      const timingChanged = JSON.stringify(next) !== JSON.stringify(whenOf(s));
      const resumed = b.enabled === true && !s.enabled;
      const row = (await db.update(reportSchedules).set({
        frequency: next.frequency, weekday: next.weekday, dayOfMonth: next.dayOfMonth, hour: next.hour, timezone: next.timezone,
        ...(b.format ? { format: b.format } : {}), ...(b.useAi !== undefined ? { useAi: b.useAi && aiAvailable() } : {}), ...(b.enabled !== undefined ? { enabled: b.enabled } : {}),
        ...(timingChanged || resumed ? { nextRunAt: nextRunAfter(next, new Date()) } : {}), updatedAt: new Date(),
      }).where(eq(reportSchedules.id, s.id)).returning())[0];
      res.json(shape(row, who.id));
      void recordSystemEvent({ actorId: who.id, action: b.enabled === false ? "Paused a scheduled report" : b.enabled === true ? "Resumed a scheduled report" : "Changed a scheduled report", entityType: "Report", entityId: s.id, entityLabel: s.title, summary: s.userId === who.id ? describeWhen(next) : "Paused by an administrator" }).catch(() => {});
    } catch (e) { fail(res, e); }
  });

  app.delete("/api/report-schedules/:id", ...guard, async (req: any, res) => {
    try {
      const { s, who } = await load(req, String(req.params.id), true);
      await db.delete(reportSchedules).where(and(eq(reportSchedules.id, s.id)));
      res.json({ ok: true });
      void recordSystemEvent({ actorId: who.id, action: "Deleted a scheduled report", entityType: "Report", entityId: s.id, entityLabel: s.title, summary: s.userId === who.id ? "Deleted by the person it was for" : "Deleted by an administrator" }).catch(() => {});
    } catch (e) { fail(res, e); }
  });

  app.post("/api/report-schedules/:id/send-now", ...guard, rateLimit({ name: "schedule-send-now", max: 10, windowMs: 3600_000, by: "user" }), async (req: any, res) => {
    try {
      const { s } = await load(req, String(req.params.id), false);
      const out = await runScheduleNow(s, { storage, base: base(req) });
      res.json(out);
    } catch (e) { fail(res, e); }
  });
}
