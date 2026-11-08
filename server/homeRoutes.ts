import type { Express } from "express";
import type { IStorage } from "./storage";
import { buildBriefing } from "./services/homeBriefing";

// The home screen briefing: what matters to the signed-in person, worked out from their roles (including when an administrator is
// acting as someone else). Everything in the response is already limited to what that role may see.
export function registerHomeRoutes(app: Express, { storage, isAuthenticated }: { storage: IStorage; isAuthenticated: any }) {
  app.get("/api/home/briefing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.impersonatedUserId || req.user?.claims?.sub;
      res.setHeader("Cache-Control", "no-store");
      const horizon = req.query.horizon === undefined ? undefined : Number(req.query.horizon);
      res.json(await buildBriefing(storage as any, userId, Number.isFinite(horizon) ? horizon : undefined));
    } catch (error) {
      console.error("Error building the home briefing:", error);
      res.status(500).json({ error: "Could not load your home screen" });
    }
  });
}
