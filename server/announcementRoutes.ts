import type { Express, Request, Response } from "express";
import * as ann from "./services/announcements";
import { AnnouncementError } from "./services/announcements";

// Announcements. Everyone can see the ones meant for them and mark them read; administrators write, publish, withdraw and chase them.
interface Deps {
  isAuthenticated: any;
  requireRole: (...roles: string[]) => any;
}

export function registerAnnouncementRoutes(app: Express, { isAuthenticated, requireRole }: Deps) {
  const actorId = (req: any): string => req.session?.impersonatedUserId || req.user?.claims?.sub;
  const guard = [isAuthenticated, requireRole("admin", "super_admin", "developer")];
  const handle = (fn: (req: any) => Promise<unknown>, successStatus = 200) => async (req: Request, res: Response) => {
    try {
      res.status(successStatus).json(await fn(req));
    } catch (error: any) {
      if (error instanceof AnnouncementError) return res.status(error.status).json({ error: error.message });
      console.error(`Error in ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  };
  const list = (v: unknown): string[] => (typeof v === "string" && v ? v.split(",").filter(Boolean) : []);

  // the announcements meant for me
  app.get("/api/announcements/mine", isAuthenticated, handle(async (req) => ann.mine(actorId(req))));
  app.post("/api/announcements/:id/read", isAuthenticated, handle(async (req) => ann.markRead(req.params.id, actorId(req))));
  app.post("/api/announcements/:id/acknowledge", isAuthenticated, handle(async (req) => ann.acknowledge(req.params.id, actorId(req))));

  // administrators. The audience preview is a GET so that looking at it is not recorded as a change in the audit log.
  app.get("/api/announcements/audience", ...guard, handle(async (req) => ann.previewAudience({
    audienceAll: req.query.all === "1", businessUnitIds: list(req.query.businessUnitIds), jobRoleIds: list(req.query.jobRoleIds), locationIds: list(req.query.locationIds),
  })));
  app.get("/api/announcements", ...guard, handle(async () => ann.listAdmin()));
  app.post("/api/announcements", ...guard, handle(async (req) => ann.create(req.body ?? {}, actorId(req), req.body?.publish === true), 201));
  app.put("/api/announcements/:id", ...guard, handle(async (req) => ann.update(req.params.id, req.body ?? {}, actorId(req))));
  app.delete("/api/announcements/:id", ...guard, handle(async (req) => { await ann.remove(req.params.id); return { success: true }; }));
  app.post("/api/announcements/:id/publish", ...guard, handle(async (req) => ann.publish(req.params.id, actorId(req))));
  app.post("/api/announcements/:id/withdraw", ...guard, handle(async (req) => ann.withdraw(req.params.id, actorId(req))));
  app.post("/api/announcements/:id/remind", ...guard, handle(async (req) => ann.remind(req.params.id, actorId(req))));
  app.get("/api/announcements/:id/readers", ...guard, handle(async (req) => ann.readers(req.params.id)));
}
