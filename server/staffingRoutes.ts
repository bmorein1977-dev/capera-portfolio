import type { Express, Request, Response } from "express";
import type { IStorage } from "./storage";
import * as staffing from "./services/staffingCompliance";
import { StaffingError } from "./services/staffingCompliance";

// Minimum staffing ("duty to operate"). Administrators set the requirements; managers can see how each is
// being met and record the decision on whether a risk assessment is needed when one is not.

interface Deps {
  storage: IStorage;
  isAuthenticated: any;
  requireRole: (...roles: string[]) => any;
}

export function registerStaffingRoutes(app: Express, { storage, isAuthenticated, requireRole }: Deps) {
  const actorId = (req: any): string => req.session?.impersonatedUserId || req.user?.claims?.sub;
  const handle = (fn: (req: any) => Promise<unknown>, successStatus = 200) => async (req: Request, res: Response) => {
    try {
      res.status(successStatus).json(await fn(req));
    } catch (error: any) {
      if (error instanceof StaffingError) return res.status(error.status).json({ error: error.message });
      console.error(`Error in ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  };
  const ADMINS = ["admin", "super_admin", "developer"] as const;
  const VIEWERS = [...ADMINS, "manager"] as const;

  // how every requirement is currently being met, with the people counted against it
  app.get("/api/staffing/status", isAuthenticated, requireRole(...VIEWERS), handle(async () => staffing.evaluateAll()));
  app.get("/api/staffing/summary", isAuthenticated, requireRole(...VIEWERS), handle(async () => staffing.summary()));

  // requirements themselves
  app.get("/api/staffing/requirements", isAuthenticated, requireRole(...VIEWERS), handle(async () => staffing.listRequirements()));
  app.post("/api/staffing/requirements", isAuthenticated, requireRole(...ADMINS), handle(async (req) => staffing.createRequirement(req.body ?? {}, actorId(req)), 201));
  app.put("/api/staffing/requirements/:id", isAuthenticated, requireRole(...ADMINS), handle(async (req) => staffing.updateRequirement(req.params.id, req.body ?? {})));
  app.delete("/api/staffing/requirements/:id", isAuthenticated, requireRole(...ADMINS), handle(async (req) => staffing.deleteRequirement(req.params.id)));

  // shortfall reviews and the risk assessment decision
  app.get("/api/staffing/reviews", isAuthenticated, requireRole(...VIEWERS), handle(async (req) =>
    staffing.listReviews({ status: typeof req.query.status === "string" ? req.query.status : undefined, requirementId: typeof req.query.requirementId === "string" ? req.query.requirementId : undefined })));
  app.post("/api/staffing/reviews/:id/decision", isAuthenticated, requireRole(...VIEWERS), handle(async (req) => staffing.decideReview(req.params.id, actorId(req), req.body ?? {})));

  // run the daily check now
  app.post("/api/staffing/run-check", isAuthenticated, requireRole(...ADMINS), handle(async () => staffing.runStaffingChecks()));
}
