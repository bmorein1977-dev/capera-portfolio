import type { Express, Request, Response } from "express";
import type { IStorage } from "./storage";
import * as perf from "./services/performance";
import { PerformanceError, isAdminActor, type Actor } from "./services/performance";
import { canViewPerformance, computeTalentScore, getTalentScoreSettings, updateTalentScoreSettings } from "./services/talentScore";

// Annual appraisal, objectives, behaviours, 360 feedback, career history and the Talent Score.
// Permission rules for appraisal data live in services/performance.ts; the role gates here only
// decide who may reach each kind of screen at all.

interface Deps {
  storage: IStorage;
  isAuthenticated: any;
  requireRole: (...roles: string[]) => any;
}

const normRole = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");

export function registerPerformanceRoutes(app: Express, { storage, isAuthenticated, requireRole }: Deps) {
  // Whoever the request is acting as: the signed-in person, or the person an admin is impersonating,
  // with any additional roles they have been granted.
  async function actorFrom(req: any): Promise<Actor> {
    const id = req.session?.impersonatedUserId || req.user?.claims?.sub;
    const user = id ? await storage.getUser(id) : undefined;
    if (!user) throw new PerformanceError(401, "User not found");
    const effective = (await storage.getEffectiveRoles(id)).map(normRole);
    return { id, roles: Array.from(new Set([normRole(user.role), ...effective])) };
  }

  const handle = (fn: (req: any, actor: Actor) => Promise<unknown>, successStatus = 200) => async (req: Request, res: Response) => {
    try {
      const actor = await actorFrom(req);
      res.status(successStatus).json(await fn(req, actor));
    } catch (error: any) {
      if (error instanceof PerformanceError) return res.status(error.status).json({ error: error.message });
      console.error(`Error in ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  };
  const ADMINS = ["admin", "super_admin", "developer"] as const;
  const submitFlag = (req: any) => req.query.submit === "1" || req.query.submit === "true";

  // ---------------- behaviours framework
  app.get("/api/performance/behaviours", isAuthenticated, handle(async (req, actor) => perf.listBehaviours(req.query.all === "1" && isAdminActor(actor))));
  app.post("/api/performance/behaviours/starter", isAuthenticated, requireRole(...ADMINS), handle(async () => perf.ensureStarterBehaviours()));
  app.post("/api/performance/behaviours", isAuthenticated, requireRole(...ADMINS), handle(async (req) => perf.saveBehaviour(req.body ?? {}), 201));
  app.put("/api/performance/behaviours/:id", isAuthenticated, requireRole(...ADMINS), handle(async (req) => perf.saveBehaviour({ ...(req.body ?? {}), id: req.params.id })));

  app.get("/api/performance/people", isAuthenticated, handle(async () => perf.listPeople()));

  // ---------------- cycles
  app.get("/api/performance/cycles", isAuthenticated, requireRole(...ADMINS, "manager"), handle(async () => perf.listCycles()));
  app.post("/api/performance/cycles", isAuthenticated, requireRole(...ADMINS), handle(async (req) => perf.saveCycle(req.body ?? {}), 201));
  app.put("/api/performance/cycles/:id", isAuthenticated, requireRole(...ADMINS), handle(async (req) => perf.saveCycle({ ...(req.body ?? {}), id: req.params.id })));
  app.post("/api/performance/cycles/:id/launch", isAuthenticated, requireRole(...ADMINS), handle(async (req, actor) => perf.launchCycle(req.params.id, req.body?.fallbackReviewerId, req.body?.mode === "open_only" ? "open_only" : "everyone", actor.id)));
  app.post("/api/performance/cycles/:id/open-self-reviews", isAuthenticated, requireRole(...ADMINS), handle(async (req) => perf.openSelfReviews(req.params.id)));
  app.post("/api/performance/cycles/:id/close", isAuthenticated, requireRole(...ADMINS), handle(async (req) => perf.closeCycle(req.params.id)));

  // ---------------- appraisals
  app.get("/api/performance/my", isAuthenticated, handle(async (_req, actor) => perf.listMyAppraisals(actor.id)));
  app.get("/api/performance/team", isAuthenticated, requireRole("manager", ...ADMINS), handle(async (req, actor) =>
    perf.listTeamAppraisals(actor, { all: req.query.all === "1", cycleId: req.query.cycleId as string | undefined })));
  app.get("/api/performance/todo", isAuthenticated, handle(async (_req, actor) => perf.listTodo(actor)));
  app.get("/api/performance/my-reports", isAuthenticated, requireRole("manager", ...ADMINS), handle(async (req, actor) => perf.listMyReports(actor, typeof req.query.cycleId === "string" ? req.query.cycleId : undefined)));
  app.post("/api/performance/appraisals", isAuthenticated, requireRole("manager", ...ADMINS), handle(async (req, actor) => perf.createAppraisal(actor, req.body ?? {}), 201));
  app.get("/api/performance/appraisals/:id", isAuthenticated, handle(async (req, actor) => perf.getAppraisalDetail(req.params.id, actor)));

  app.post("/api/performance/appraisals/:id/objectives", isAuthenticated, handle(async (req, actor) => perf.createObjective(req.params.id, actor, req.body ?? {}), 201));
  app.put("/api/performance/objectives/:id", isAuthenticated, handle(async (req, actor) => perf.updateObjective(req.params.id, actor, req.body ?? {})));
  app.delete("/api/performance/objectives/:id", isAuthenticated, handle(async (req, actor) => perf.deleteObjective(req.params.id, actor)));
  app.post("/api/performance/objectives/:id/updates", isAuthenticated, handle(async (req, actor) => perf.addObjectiveUpdate(req.params.id, actor, req.body?.note, req.body?.progressPercent), 201));
  app.post("/api/performance/appraisals/:id/agree-objectives", isAuthenticated, handle(async (req, actor) => perf.agreeObjectives(req.params.id, actor)));
  app.post("/api/performance/appraisals/:id/start-self-review", isAuthenticated, handle(async (req, actor) => perf.startSelfReview(req.params.id, actor)));

  app.put("/api/performance/appraisals/:id/self-review", isAuthenticated, handle(async (req, actor) => perf.saveSelfReview(req.params.id, actor, req.body ?? {}, submitFlag(req))));
  app.put("/api/performance/appraisals/:id/manager-review", isAuthenticated, handle(async (req, actor) => perf.saveManagerReview(req.params.id, actor, req.body ?? {}, submitFlag(req))));
  app.post("/api/performance/appraisals/:id/calibrate", isAuthenticated, handle(async (req, actor) => perf.finishCalibration(req.params.id, actor, req.body ?? {})));
  app.post("/api/performance/appraisals/:id/share", isAuthenticated, handle(async (req, actor) => perf.shareReport(req.params.id, actor, req.body?.meetingDate)));
  app.post("/api/performance/appraisals/:id/meeting", isAuthenticated, handle(async (req, actor) => perf.shareReport(req.params.id, actor, req.body?.meetingDate))); // earlier name for the same step
  app.put("/api/performance/appraisals/:id/dates", isAuthenticated, handle(async (req, actor) => perf.updateAppraisalDates(req.params.id, actor, req.body ?? {})));
  app.post("/api/performance/appraisals/:id/sign-off", isAuthenticated, handle(async (req, actor) => perf.signOff(req.params.id, actor, req.body?.comments)));
  app.post("/api/performance/appraisals/:id/reopen", isAuthenticated, handle(async (req, actor) => perf.reopenAppraisal(req.params.id, actor, req.body?.status)));

  // ---------------- 360 feedback
  app.post("/api/performance/appraisals/:id/raters", isAuthenticated, handle(async (req, actor) => perf.proposeRater(req.params.id, actor, req.body?.raterId, req.body?.raterType), 201));
  app.post("/api/performance/raters/:id/decision", isAuthenticated, handle(async (req, actor) => perf.decideRater(req.params.id, actor, req.body?.approve === true)));
  app.delete("/api/performance/raters/:id", isAuthenticated, handle(async (req, actor) => perf.removeRater(req.params.id, actor)));
  app.get("/api/performance/feedback-inbox", isAuthenticated, handle(async (_req, actor) => perf.listFeedbackInbox(actor.id)));
  app.get("/api/performance/feedback/:id", isAuthenticated, handle(async (req, actor) => perf.getFeedbackForm(req.params.id, actor)));
  app.post("/api/performance/feedback/:id", isAuthenticated, handle(async (req, actor) => perf.submitFeedback(req.params.id, actor, req.body ?? {})));
  app.post("/api/performance/feedback/:id/decline", isAuthenticated, handle(async (req, actor) => perf.declineFeedback(req.params.id, actor)));

  // ---------------- career history and qualifications (the person themselves, or HR)
  app.get("/api/users/:id/experience", isAuthenticated, handle(async (req, actor) => perf.listExperience(req.params.id, actor)));
  app.post("/api/users/:id/experience", isAuthenticated, handle(async (req, actor) => perf.saveExperience(req.params.id, actor, req.body ?? {}), 201));
  app.delete("/api/users/:id/experience/:entryId", isAuthenticated, handle(async (req, actor) => perf.deleteExperience(req.params.id, req.params.entryId, actor)));
  app.get("/api/users/:id/qualifications", isAuthenticated, handle(async (req, actor) => perf.listQualifications(req.params.id, actor)));
  app.post("/api/users/:id/qualifications", isAuthenticated, handle(async (req, actor) => perf.saveQualification(req.params.id, actor, req.body ?? {}), 201));
  app.delete("/api/users/:id/qualifications/:entryId", isAuthenticated, handle(async (req, actor) => perf.deleteQualification(req.params.id, req.params.entryId, actor)));

  // ---------------- Talent Score
  // The Talent Score is an HR / administrator view only. Employees and line managers never see it; managers
  // work from the review itself.
  app.get("/api/talent-score/settings", isAuthenticated, requireRole(...ADMINS), handle(async () => getTalentScoreSettings()));
  app.put("/api/talent-score/settings", isAuthenticated, requireRole(...ADMINS), handle(async (req, actor) => {
    try { return await updateTalentScoreSettings(req.body ?? {}, actor.id); }
    catch (e: any) { throw new PerformanceError(400, e.message); }
  }));
  app.get("/api/users/:id/talent-score", isAuthenticated, requireRole(...ADMINS), handle(async (req, actor) => {
    return computeTalentScore(req.params.id, { canSeePerformance: actor.roles.some(r => canViewPerformance(r)) });
  }));
}
