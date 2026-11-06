import type { Express, Request, Response } from "express";
import * as n from "./services/notifications";
import { NotificationError } from "./services/notifications";
import { ADDABLE_ROLES } from "./services/notificationTypes";
import { sendDueEmails } from "./services/announcements";

// Email notifications: what each email is and how it is set up, the log of everything sent, and resending. Administrators only:
// the log contains the text of emails sent to people.
interface Deps {
  isAuthenticated: any;
  requireRole: (...roles: string[]) => any;
}

export function registerNotificationRoutes(app: Express, { isAuthenticated, requireRole }: Deps) {
  const actorId = (req: any): string => req.session?.impersonatedUserId || req.user?.claims?.sub;
  const guard = [isAuthenticated, requireRole("admin", "super_admin", "developer")];
  const handle = (fn: (req: any) => Promise<unknown>, successStatus = 200) => async (req: Request, res: Response) => {
    try {
      res.status(successStatus).json(await fn(req));
    } catch (error: any) {
      if (error instanceof NotificationError) return res.status(error.status).json({ error: error.message });
      console.error(`Error in ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  };
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

  app.get("/api/notifications/rules", ...guard, handle(async () => ({ rules: await n.listRules(), roles: ADDABLE_ROLES, email: n.emailStatus(), summary: await n.logSummary() })));
  app.put("/api/notifications/rules/:typeKey", ...guard, handle(async (req) => n.saveRule(req.params.typeKey, req.body ?? {}, actorId(req))));
  app.post("/api/notifications/rules/:typeKey/reset", ...guard, handle(async (req) => n.resetRule(req.params.typeKey)));
  app.post("/api/notifications/rules/:typeKey/preview", ...guard, handle(async (req) => n.previewTemplate(req.params.typeKey, { subject: str(req.body?.subject), body: str(req.body?.body) })));
  app.post("/api/notifications/rules/:typeKey/test", ...guard, handle(async (req) => n.sendTest(req.params.typeKey, actorId(req), { subject: str(req.body?.subject), body: str(req.body?.body) })));

  app.get("/api/notifications/logs", ...guard, handle(async (req) => n.listLogs({
    typeKey: str(req.query.typeKey), status: str(req.query.status), q: str(req.query.q), from: str(req.query.from), to: str(req.query.to),
    limit: Number(req.query.limit) || undefined, offset: Number(req.query.offset) || undefined,
  })));
  app.get("/api/notifications/logs/:id", ...guard, handle(async (req) => n.getLog(req.params.id)));
  app.post("/api/notifications/logs/:id/resend", ...guard, handle(async (req) => n.resend(req.params.id, actorId(req), str(req.body?.to))));

  // run the daily jobs now: the competence reminders, any digests that are due, and announcement emails that are due
  app.post("/api/notifications/run", ...guard, handle(async () => ({ reminders: await n.runCompetenceReminders(), digests: await n.flushDigests(), announcements: await sendDueEmails() })));
}
