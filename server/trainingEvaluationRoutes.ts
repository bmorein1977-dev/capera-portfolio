// Training course evaluations. A candidate sees and answers only their own (anyone else's answers "not found"). What an administrator, or anyone
// else, may do is set on the Training Permissions screen under "Training evaluations": view shows results without names; manage adds the forms and
// settings, who has replied, reminders, safety concerns and course review decisions.
import type { Express } from "express";
import { z } from "zod";
import { db } from "./db";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { users, trainings, trainingEvaluations, trainingCourseReviews, type TrainingEvaluation } from "@shared/schema";
import {
  buildForm, checkAnswers, privacyStatement, settingsSchema, reviewSchema, formTypeFor, FORM_TYPES, FORM_TYPE_LABEL, DEFAULT_STATEMENTS, REVIEW_DECISION_LABEL,
  type Answers, type EvaluationForm, type FormType, type Stage,
} from "@shared/trainingEvaluation";
import { summarise, verdict, grouped, questionResults, comments, GROUPS, THRESHOLDS, type GroupBy, type Row } from "./services/trainingEvaluationAnalysis";
import { getSettings, saveSettings, syncEvaluations, sendInvitations, remindNow, today, licensed } from "./services/trainingEvaluations";
import { canTraining } from "./services/trainingPermissions";
import { sendNotification } from "./services/notifications";
import { recordRequestEvent } from "./services/auditLog";
import { rateLimit } from "./security";
import type { IStorage } from "./storage";

interface Deps { storage: IStorage; isAuthenticated: any }
class HttpError extends Error { constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); } }
const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");
const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/;
const personName = (u: { firstName: string | null; lastName: string | null; email: string | null }) => [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Unnamed";

export function registerTrainingEvaluationRoutes(app: Express, { storage, isAuthenticated }: Deps) {
  const actingId = (req: any): string => req.session?.impersonatedUserId || req.user?.claims?.sub;
  async function rolesOf(req: any) { return (await storage.getEffectiveRoles(actingId(req))).map(norm); }
  async function may(req: any, action: "view" | "edit") {
    const roles = await rolesOf(req);
    // holding "manage" includes being able to look
    return (await canTraining(roles, "evaluations", action)) || (action === "view" && (await canTraining(roles, "evaluations", "edit")));
  }
  async function need(req: any, action: "view" | "edit") {
    if (!(await may(req, action))) throw new HttpError(403, "Insufficient permissions");
  }

  const handle = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { const out = await fn(req, res); if (!res.headersSent) res.json(out); }
    catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message, ...e.extra });
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message && !/^(Required|Invalid|Expected|Unrecognized)/.test(e.issues[0].message) ? e.issues[0].message : "Some of the details are not valid", fields: e.issues.map(i => i.path.join(".")) });
      console.error("Training evaluation route failed:", e?.message ?? e); // the message only: what people wrote is not written to the log
      res.status(500).json({ error: "Something went wrong on our side. Please try again." });
    }
  };
  const limit = rateLimit({ name: "evaluation-writes", max: 120, windowMs: 10 * 60 * 1000 });

  // ------------------------------------------------------------------------------------------------ the candidate's own
  const brief = (e: TrainingEvaluation) => ({
    id: e.id, courseTitle: e.courseTitle, formType: e.formType, formTypeLabel: FORM_TYPE_LABEL[e.formType as FormType], stage: e.stage, status: e.status,
    completedOn: e.completedOn, dueOn: e.dueOn, providerName: e.providerName, venueName: e.venueName, instructor: e.instructor, started: e.status === "open" && !!e.answers,
  });
  async function own(req: any, id: string) {
    const e = (await db.select().from(trainingEvaluations).where(eq(trainingEvaluations.id, id)))[0];
    if (!e || e.userId !== actingId(req) || e.status === "cancelled" || e.opensOn > today()) throw new HttpError(404, "That evaluation was not found");
    return e;
  }
  const requireOpen = (e: TrainingEvaluation) => {
    if (e.status === "submitted") throw new HttpError(409, "You have already sent this one");
    if (e.status !== "open" || e.dueOn < today()) throw new HttpError(409, "This one has closed");
  };

  app.get("/api/training-evaluations/mine", isAuthenticated, handle(async (req) => {
    const id = actingId(req);
    await syncEvaluations({ userId: id });
    void sendInvitations({ userId: id }).catch(err => console.error("Could not send an evaluation invitation:", (err as Error).message));
    const day = today();
    const all = await db.select().from(trainingEvaluations).where(eq(trainingEvaluations.userId, id)).orderBy(desc(trainingEvaluations.completedOn));
    return {
      open: all.filter(e => e.status === "open" && e.opensOn <= day && e.dueOn >= day).sort((a, b) => a.dueOn.localeCompare(b.dueOn)).map(brief),
      done: all.filter(e => e.status === "submitted" || e.status === "declined" || (e.status === "expired" && e.opensOn <= day)).map(brief),
    };
  }));

  app.get("/api/training-evaluations/mine/:id", isAuthenticated, handle(async (req) => {
    const e = await own(req, req.params.id);
    const settings = await getSettings();
    const form: EvaluationForm = e.status === "submitted" && e.form ? (e.form as EvaluationForm) : buildForm(e.formType as FormType, e.stage as Stage, settings.statements);
    const showNames = e.status === "submitted" ? e.named : settings.showNames;
    return { evaluation: brief(e), form, answers: (e.answers as Answers | null) ?? {}, namesShown: showNames, privacy: privacyStatement(showNames) };
  }));

  app.put("/api/training-evaluations/mine/:id/draft", isAuthenticated, limit, handle(async (req) => {
    const e = await own(req, req.params.id);
    requireOpen(e);
    const { answers } = checkAnswers(buildForm(e.formType as FormType, e.stage as Stage, (await getSettings()).statements), req.body?.answers);
    await db.update(trainingEvaluations).set({ answers, updatedAt: new Date() }).where(and(eq(trainingEvaluations.id, e.id), eq(trainingEvaluations.status, "open")));
    return { saved: true };
  }));

  app.post("/api/training-evaluations/mine/:id/submit", isAuthenticated, limit, handle(async (req) => {
    const e = await own(req, req.params.id);
    requireOpen(e);
    const settings = await getSettings();
    // the reply is only accepted under the promise about names that was on the screen when it was written
    if (req.body?.namesShown !== settings.showNames) throw new HttpError(409, "What happens to your name has changed since this form was opened. Please read it again before sending.", { reload: true });
    const form = buildForm(e.formType as FormType, e.stage as Stage, settings.statements);
    const { answers, missing } = checkAnswers(form, req.body?.answers);
    if (missing.length) throw new HttpError(400, `Please answer ${missing.length === 1 ? "one more question" : `${missing.length} more questions`}`, { missing: missing.map(m => m.key) });
    const concern = answers.safety === "yes";
    const real = req.user?.claims?.sub as string;
    const sent = await db.update(trainingEvaluations).set({
      status: "submitted", answers, form, named: settings.showNames, safetyConcern: concern, submittedAt: new Date(), updatedAt: new Date(),
      enteredBy: real && real !== e.userId ? real : null,
    }).where(and(eq(trainingEvaluations.id, e.id), eq(trainingEvaluations.status, "open"))).returning({ id: trainingEvaluations.id });
    if (!sent.length) throw new HttpError(409, "You have already sent this one");
    await recordRequestEvent(req, { action: "submit", entityType: "training-evaluation", entityId: e.id, label: e.courseTitle, what: e.stage === "followup" ? "sent a training follow-up for" : "sent training feedback for" });
    if (concern) {
      const found = await db.execute(sql`select id from users where role in ('admin', 'super_admin', 'training_administrator') and coalesce(is_active, true)
        union select user_id from user_role_assignments where role = 'training_administrator' and coalesce(is_active, true)`);
      // the email says there is a concern and where to read it; what was written stays in Capera
      await sendNotification("training_safety_concern", { userIds: (found.rows as any[]).map(r => r.id), vars: { course: e.courseTitle }, path: "/admin/training-evaluations?tab=safety", settingId: "training-evaluations", dedupKey: `evaluation-safety:${e.id}`, metadata: { evaluationId: e.id } });
    }
    return { submitted: true, safetyConcern: concern };
  }));

  app.post("/api/training-evaluations/mine/:id/not-attended", isAuthenticated, limit, handle(async (req) => {
    const e = await own(req, req.params.id);
    requireOpen(e);
    if (e.stage !== "course") throw new HttpError(400, "This is a follow-up to training you have already been asked about");
    const reason = z.string().trim().min(5, "Say briefly why, so the record can be checked").max(500).parse(req.body?.reason);
    await db.update(trainingEvaluations).set({ status: "declined", declineReason: reason, answers: null, updatedAt: new Date() }).where(and(eq(trainingEvaluations.id, e.id), eq(trainingEvaluations.status, "open")));
    await db.update(trainingEvaluations).set({ status: "cancelled", declineReason: "The person says they did not attend", updatedAt: new Date() })
      .where(and(eq(trainingEvaluations.userId, e.userId), eq(trainingEvaluations.courseKey, e.courseKey), eq(trainingEvaluations.completedOn, e.completedOn), eq(trainingEvaluations.stage, "followup"), eq(trainingEvaluations.status, "open")));
    await recordRequestEvent(req, { action: "not-attended", entityType: "training-evaluation", entityId: e.id, label: e.courseTitle, what: "said they did not attend" });
    return { recorded: true };
  }));

  // ------------------------------------------------------------------------------------------------ results
  const filterSchema = z.object({
    from: z.string().regex(DAY_TEXT).optional(), to: z.string().regex(DAY_TEXT).optional(), formType: z.enum(FORM_TYPES).optional(),
    provider: z.string().max(200).optional(), key: z.string().max(80).optional(), groupBy: z.enum(GROUPS).optional(),
  });
  type Filter = z.infer<typeof filterSchema>;
  const readFilter = (req: any): Filter => filterSchema.parse(Object.fromEntries(Object.entries(req.query ?? {}).filter(([, v]) => v !== "")));

  async function loadRows(f: Filter, withNames: boolean): Promise<Row[]> {
    const c = [
      ...(f.from ? [gte(trainingEvaluations.completedOn, f.from)] : []), ...(f.to ? [lte(trainingEvaluations.completedOn, f.to)] : []),
      ...(f.formType ? [eq(trainingEvaluations.formType, f.formType)] : []), ...(f.provider ? [eq(trainingEvaluations.providerName, f.provider)] : []),
      ...(f.key ? [eq(trainingEvaluations.courseKey, f.key)] : []),
    ];
    const found = await db.select({ e: trainingEvaluations, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(trainingEvaluations)
      .leftJoin(users, eq(users.id, trainingEvaluations.userId)).where(c.length ? and(...c) : undefined).orderBy(trainingEvaluations.completedOn);
    return found.map(({ e, firstName, lastName, email }): Row => ({
      id: e.id, courseKey: e.courseKey, courseTitle: e.courseTitle, categoryName: e.categoryName, formType: e.formType as FormType, stage: e.stage as Stage, status: e.status,
      answers: e.status === "submitted" ? (e.answers as Answers) : null, form: (e.form as EvaluationForm | null) ?? null, providerName: e.providerName, venueName: e.venueName,
      instructor: e.instructor, jobRoleName: e.jobRoleName, completedOn: e.completedOn, opensOn: e.opensOn, named: e.named,
      userName: withNames && e.named ? personName({ firstName, lastName, email }) : null,
    }));
  }
  const reviewsFor = (keys: string[]) => (keys.length ? db.select().from(trainingCourseReviews).where(inArray(trainingCourseReviews.courseKey, keys)).orderBy(desc(trainingCourseReviews.createdAt)) : Promise.resolve([]));

  app.get("/api/training-evaluations/analysis", isAuthenticated, handle(async (req) => {
    await need(req, "view");
    const f = readFilter(req);
    const settings = await getSettings();
    const manage = await may(req, "edit");
    const data = await loadRows({ ...f, key: undefined }, false);
    const day = today();
    const courses = grouped(data, "course", settings.minGroup, day);
    const latest = new Map<string, any>();
    for (const r of await reviewsFor(courses.map(c => c.key))) if (!latest.has(r.courseKey)) latest.set(r.courseKey, r);
    const order = { review: 0, watch: 1, suitable: 2, too_few: 3 } as const;
    const by: GroupBy = f.groupBy ?? "provider";
    const providers = (await db.execute(sql`select distinct provider_name p from training_evaluations where provider_name is not null order by 1`)).rows.map((r: any) => r.p as string);
    const safety = manage ? Number(((await db.execute(sql`select count(*)::int n from training_evaluations where safety_concern and safety_closed_at is null and status = 'submitted'`)).rows[0] as any).n) : null;
    return {
      canManage: manage, enabled: settings.enabled && licensed(), startFrom: settings.startFrom, minGroup: settings.minGroup, showNames: settings.showNames, thresholds: THRESHOLDS,
      providers, openSafety: safety,
      total: summarise(data, settings.minGroup, day),
      courses: courses.map(c => {
        const first = data.find(r => r.courseKey === c.key)!;
        const review = latest.get(c.key);
        return { ...c, categoryName: first.categoryName, formTypes: Array.from(new Set(data.filter(r => r.courseKey === c.key).map(r => FORM_TYPE_LABEL[r.formType]))),
          lastReview: review ? { decision: REVIEW_DECISION_LABEL[review.decision as keyof typeof REVIEW_DECISION_LABEL] ?? review.decision, on: review.createdAt, nextReviewOn: review.nextReviewOn } : null };
      }).sort((a, b) => order[a.verdict.key] - order[b.verdict.key] || (a.summary.overall ?? 9) - (b.summary.overall ?? 9) || a.label.localeCompare(b.label)),
      groupBy: by,
      groups: grouped(data, by, settings.minGroup, day).map(g => ({ ...g, label: by === "formType" ? FORM_TYPE_LABEL[g.key as FormType] ?? g.label : g.label }))
        .sort((a, b) => (by === "quarter" ? a.key.localeCompare(b.key) : b.summary.replies - a.summary.replies)),
    };
  }));

  app.get("/api/training-evaluations/course", isAuthenticated, handle(async (req) => {
    await need(req, "view");
    const f = readFilter(req);
    if (!f.key) throw new HttpError(400, "Choose a course");
    const settings = await getSettings();
    const manage = await may(req, "edit");
    const data = await loadRows(f, manage);
    const reviews = await reviewsFor([f.key]);
    if (!data.length && !reviews.length) throw new HttpError(404, "No evaluations for that course yet");
    const day = today();
    const summary = summarise(data, settings.minGroup, day);
    return {
      canManage: manage, minGroup: settings.minGroup, courseKey: f.key, courseTitle: data.at(-1)?.courseTitle ?? reviews[0]?.courseTitle ?? "", categoryName: data.at(-1)?.categoryName ?? null,
      formTypes: Array.from(new Set(data.map(r => FORM_TYPE_LABEL[r.formType]))),
      summary, verdict: verdict(summary, settings.minGroup),
      questions: questionResults(data, settings.minGroup),
      comments: comments(data, settings.minGroup, manage),
      byProvider: grouped(data, "provider", settings.minGroup, day), byInstructor: grouped(data, "instructor", settings.minGroup, day),
      byVenue: grouped(data, "venue", settings.minGroup, day), byQuarter: grouped(data, "quarter", settings.minGroup, day).sort((a, b) => a.key.localeCompare(b.key)),
      reviews: reviews.map(r => ({ id: r.id, decision: REVIEW_DECISION_LABEL[r.decision as keyof typeof REVIEW_DECISION_LABEL] ?? r.decision, note: r.note, nextReviewOn: r.nextReviewOn, by: r.createdByName, on: r.createdAt, figures: r.figures })),
    };
  }));

  app.post("/api/training-evaluations/reviews", isAuthenticated, limit, handle(async (req) => {
    await need(req, "edit");
    const input = reviewSchema.parse(req.body);
    const settings = await getSettings();
    const data = await loadRows({ key: input.courseKey }, false);
    if (!data.length) throw new HttpError(404, "No evaluations for that course yet");
    const summary = summarise(data, settings.minGroup, today());
    const me = await storage.getUser(actingId(req));
    const title = data.at(-1)!.courseTitle;
    // the figures as they stood are kept with the decision, so it can be understood later
    const [saved] = await db.insert(trainingCourseReviews).values({
      courseKey: input.courseKey, courseTitle: title, decision: input.decision, note: input.note, nextReviewOn: input.nextReviewOn ?? null,
      figures: { rating: verdict(summary, settings.minGroup).label, replies: summary.replies, asked: summary.asked, overall: summary.overall, suitablePct: summary.suitablePct },
      createdBy: actingId(req), createdByName: me ? personName(me as any) : null,
    }).returning({ id: trainingCourseReviews.id });
    return { id: saved.id };
  }));

  // ------------------------------------------------------------------------------------------------ managing
  app.get("/api/training-evaluations/awaiting", isAuthenticated, handle(async (req) => {
    await need(req, "edit");
    const day = today();
    const found = await db.select({ e: trainingEvaluations, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(trainingEvaluations)
      .leftJoin(users, eq(users.id, trainingEvaluations.userId)).where(inArray(trainingEvaluations.status, ["open", "declined"])).orderBy(trainingEvaluations.dueOn);
    const line = ({ e, firstName, lastName, email }: (typeof found)[number]) => ({
      id: e.id, person: personName({ firstName, lastName, email }), course: e.courseTitle, stage: e.stage === "followup" ? "Follow-up" : "Course feedback", completedOn: e.completedOn, dueOn: e.dueOn,
      invitedAt: e.invitedAt, reminders: e.reminderCount, lastReminderAt: e.lastReminderAt, reason: e.declineReason,
    });
    return {
      awaiting: found.filter(x => x.e.status === "open" && x.e.opensOn <= day && x.e.dueOn >= day).map(line),
      notAttended: found.filter(x => x.e.status === "declined").map(line),
    };
  }));

  app.post("/api/training-evaluations/remind", isAuthenticated, limit, handle(async (req) => {
    await need(req, "edit");
    const ids = z.array(z.string().max(64)).max(500).optional().parse(req.body?.ids);
    return remindNow(ids ?? null);
  }));

  app.post("/api/training-evaluations/:id/withdraw", isAuthenticated, limit, handle(async (req) => {
    await need(req, "edit");
    const reason = z.string().trim().min(5, "Say why it is being withdrawn").max(500).parse(req.body?.reason);
    const [row] = await db.update(trainingEvaluations).set({ status: "cancelled", declineReason: reason, updatedAt: new Date() })
      .where(and(eq(trainingEvaluations.id, req.params.id), inArray(trainingEvaluations.status, ["open", "declined"]))).returning();
    if (!row) throw new HttpError(404, "There is no open request to withdraw");
    return { withdrawn: true };
  }));

  app.get("/api/training-evaluations/safety", isAuthenticated, handle(async (req) => {
    await need(req, "edit");
    const found = await db.select({ e: trainingEvaluations, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(trainingEvaluations)
      .leftJoin(users, eq(users.id, trainingEvaluations.userId)).where(and(eq(trainingEvaluations.safetyConcern, true), eq(trainingEvaluations.status, "submitted"))).orderBy(desc(trainingEvaluations.submittedAt));
    const closers = Array.from(new Set(found.map(x => x.e.safetyClosedBy).filter((x): x is string => !!x)));
    const names = new Map(closers.length ? (await db.select().from(users).where(inArray(users.id, closers))).map(u => [u.id, personName(u)]) : []);
    // a safety concern is always shown with the name, as the form tells the person it will be
    return found.map(({ e, firstName, lastName, email }) => ({
      id: e.id, course: e.courseTitle, courseKey: e.courseKey, stage: e.stage === "followup" ? "Follow-up" : "Course feedback", completedOn: e.completedOn, raisedAt: e.submittedAt,
      person: personName({ firstName, lastName, email }), concern: String((e.answers as Answers | null)?.safety_details ?? "(removed)"), provider: e.providerName, instructor: e.instructor, venue: e.venueName,
      closedAt: e.safetyClosedAt, closedBy: e.safetyClosedBy ? names.get(e.safetyClosedBy) ?? null : null, action: e.safetyAction,
    })).sort((a, b) => Number(!!a.closedAt) - Number(!!b.closedAt));
  }));

  app.post("/api/training-evaluations/:id/safety-close", isAuthenticated, limit, handle(async (req) => {
    await need(req, "edit");
    const action = z.string().trim().min(10, "Record what was done about it").max(1000).parse(req.body?.action);
    const [row] = await db.update(trainingEvaluations).set({ safetyClosedAt: new Date(), safetyClosedBy: actingId(req), safetyAction: action, updatedAt: new Date() })
      .where(and(eq(trainingEvaluations.id, req.params.id), eq(trainingEvaluations.safetyConcern, true), sql`${trainingEvaluations.safetyClosedAt} is null`)).returning();
    if (!row) throw new HttpError(404, "There is no open safety concern there");
    await recordRequestEvent(req, { action: "safety-close", entityType: "training-evaluation", entityId: row.id, label: row.courseTitle, what: "recorded the action on a safety concern raised about" });
    return { closed: true };
  }));

  // ------------------------------------------------------------------------------------------------ settings
  app.get("/api/training-evaluations/settings", isAuthenticated, handle(async (req) => {
    await need(req, "edit");
    const settings = await getSettings();
    const list = (await db.execute(sql`select t.id, t.name, t.training_source, e.modality from trainings t left join external_training_courses e on e.training_id = t.id where coalesce(t.is_active, true) order by t.name`)).rows as any[];
    return {
      settings, defaults: DEFAULT_STATEMENTS,
      courses: list.map(c => ({ id: c.id as string, name: c.name as string, worksOutAs: formTypeFor({ trainingSource: c.training_source, modality: c.modality }) as FormType })),
    };
  }));

  app.put("/api/training-evaluations/settings", isAuthenticated, limit, handle(async (req) => {
    await need(req, "edit");
    const settings = settingsSchema.parse(req.body);
    for (const type of FORM_TYPES) {
      const keys = Object.values(settings.statements[type]).flat().map(s => s.key);
      if (new Set(keys).size !== keys.length) throw new HttpError(400, "Two statements on one form have the same reference. Reload and try again.");
    }
    const known = new Set((await db.select({ id: trainings.id }).from(trainings)).map(t => t.id));
    settings.courseForms = Object.fromEntries(Object.entries(settings.courseForms).filter(([id]) => known.has(id)));
    return { settings: await saveSettings(settings, actingId(req)) };
  }));
}
