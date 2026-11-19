import type { Express, Request, Response } from "express";
import type { IStorage } from "./storage";
import { TrainingPermissionError, getMatrix, resetRole, saveChanges, trainingPermissionsOf } from "./services/trainingPermissions";

// The administrator's screen for who may do what in training, and the list of what the signed-in person may do (for the menu and router).
// The matrix itself is changed by administrators; reading your own permissions is open to everyone signed in.
export function registerTrainingPermissionRoutes(app: Express, { storage, isAuthenticated, requireRole }: { storage: IStorage; isAuthenticated: any; requireRole: (...roles: string[]) => any }) {
  const handle = (fn: (req: any) => Promise<unknown>, status = 200) => async (req: Request, res: Response) => {
    try { res.status(status).json(await fn(req)); }
    catch (error: any) {
      if (error instanceof TrainingPermissionError) return res.status(error.status).json({ error: error.message });
      console.error(`Error in ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  };
  const actingId = (req: any): string => req.session?.impersonatedUserId || req.user?.claims?.sub;
  const ADMINS = ["admin", "super_admin", "developer"] as const;

  app.get("/api/training-permissions", isAuthenticated, requireRole(...ADMINS), handle(async () => getMatrix()));
  app.put("/api/training-permissions", isAuthenticated, requireRole(...ADMINS), handle(async (req) => saveChanges(actingId(req), req.body?.changes)));
  app.post("/api/training-permissions/reset", isAuthenticated, requireRole(...ADMINS), handle(async (req) => resetRole(req.body?.role)));
  app.get("/api/training-permissions/mine", isAuthenticated, handle(async (req) => {
    const roles = (await storage.getEffectiveRoles(actingId(req))).map((r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_"));
    return { permissions: await trainingPermissionsOf(roles) };
  }));
}
