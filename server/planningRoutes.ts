import type { Express } from "express";
import type { IStorage } from "./storage";
import { planAssessment, PlanningError } from "./services/assessmentPlanning";

// Set the date of an assessment from the home screen's assessment plan. Assessors (for their own candidates) and administrators only.
export function registerPlanningRoutes(app: Express, { storage, isAuthenticated, requireRole }: { storage: IStorage; isAuthenticated: any; requireRole: (...roles: string[]) => any }) {
  app.post("/api/assessments/plan", isAuthenticated, requireRole("assessor", "admin", "super_admin"), async (req: any, res) => {
    try {
      const actorId = req.session?.impersonatedUserId || req.user?.claims?.sub;
      const roles = (await storage.getEffectiveRoles(actorId)).map((r: string) => String(r).toLowerCase().replace(/[\s-]+/g, "_"));
      res.status(201).json(await planAssessment(storage as any, { id: actorId, isAdmin: roles.includes("admin") || roles.includes("super_admin") }, req.body ?? {}));
    } catch (error: any) {
      if (error instanceof PlanningError) return res.status(error.status).json({ error: error.message });
      console.error("Error planning assessment:", error);
      res.status(500).json({ error: "Could not set that date. Please try again." });
    }
  });
}
