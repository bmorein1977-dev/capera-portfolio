import type { Express, Request, Response } from "express";
import * as retention from "./services/retention";
import { RetentionError } from "./services/retention";

// Retention of leavers: the rule, the list of archived people with the date their details will be removed, holds, and removing
// details early. Administrators only: this is about personal data and removing it cannot be undone.
interface Deps {
  isAuthenticated: any;
  requireRole: (...roles: string[]) => any;
}

export function registerRetentionRoutes(app: Express, { isAuthenticated, requireRole }: Deps) {
  const actorId = (req: any): string => req.session?.impersonatedUserId || req.user?.claims?.sub;
  const guard = [isAuthenticated, requireRole("admin", "super_admin")];
  const handle = (fn: (req: any) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      res.json(await fn(req));
    } catch (error: any) {
      if (error instanceof RetentionError) return res.status(error.status).json({ error: error.message });
      console.error(`Error in ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  };

  app.get("/api/retention/archived", ...guard, handle(async () => retention.listArchived()));
  app.put("/api/retention/settings", ...guard, handle(async (req) => retention.updateSettings(req.body ?? {}, actorId(req))));
  app.post("/api/retention/run", ...guard, handle(async () => retention.runRetention()));
  app.post("/api/retention/:userId/hold", ...guard, handle(async (req) => {
    await retention.setHold(req.params.userId, req.body?.hold === true, typeof req.body?.reason === "string" ? req.body.reason : undefined, actorId(req));
    return { success: true };
  }));
  // Removing details cannot be undone, so the caller has to send the word REMOVE as well
  app.post("/api/retention/:userId/remove-now", ...guard, handle(async (req) => {
    if (req.body?.confirm !== "REMOVE") throw new RetentionError(400, "Confirm by typing REMOVE");
    await retention.removePersonalDetails(req.params.userId, actorId(req), "manual");
    return { success: true };
  }));
}
