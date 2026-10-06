import { db } from "../db";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  users,
  jobRoles,
  performanceCycles,
  behaviours,
  appraisals,
  performanceObjectives,
  objectiveUpdates,
  appraisalBehaviourRatings,
  feedbackRequests,
  feedbackResponses,
  userExperience,
  userQualifications,
  OBJECTIVE_OUTCOME_VALUE,
  OBJECTIVE_OUTCOMES,
  type Appraisal,
  type PerformanceCycle,
  type ObjectiveOutcome,
  type InsertUserExperience,
  type InsertUserQualification,
} from "@shared/schema";
import { getTalentScoreSettings } from "./talentScore";
import { notify } from "./performanceNotifications";

// Annual appraisal, objectives, behaviours and 360 feedback. Permission rules live here, next to the
// data, so a screen cannot bypass them. "Actor" is whoever is making the request.

export interface Actor { id: string; roles: string[] } // roles = primary role plus any granted additional roles, normalised
const ADMIN_ROLES = ["admin", "super_admin", "developer"];
export const isAdminActor = (a: Actor) => a.roles.some(r => ADMIN_ROLES.includes(r));

export class PerformanceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const forbid = (msg = "You do not have permission to do that") => new PerformanceError(403, msg);
const bad = (msg: string) => new PerformanceError(400, msg);
const missing = (msg: string) => new PerformanceError(404, msg);

const RATER_TYPES = ["peer", "direct_report", "stakeholder"] as const;
const OBJECTIVE_CATEGORIES = ["delivery", "safety", "people", "development"];

const pct = (rating: number, scale: number) => scale <= 1 ? 0 : Math.round(((rating - 1) / (scale - 1)) * 1000) / 10;
const fullName = (u?: { firstName: string | null; lastName: string | null; email: string | null } | null) =>
  u ? (`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "Unknown") : "Unknown";

// ---------------------------------------------------------------- behaviours

const STARTER_BEHAVIOURS = [
  { name: "Safety leadership", description: "Puts safety first, speaks up, and models the standards expected of others.", indicators: ["Stops work when it is unsafe", "Reports near misses promptly", "Challenges shortcuts respectfully"] },
  { name: "Accountability", description: "Takes ownership of outcomes and follows through on commitments.", indicators: ["Delivers what was agreed", "Owns mistakes and fixes them", "Keeps others informed of progress"] },
  { name: "Collaboration", description: "Works across teams and shares knowledge generously.", indicators: ["Helps colleagues succeed", "Involves the right people early", "Shares learning openly"] },
  { name: "Communication", description: "Listens well and communicates clearly and honestly.", indicators: ["Explains things simply", "Listens before responding", "Raises concerns early and constructively"] },
  { name: "Learning and adaptability", description: "Seeks feedback, learns quickly and adapts to change.", indicators: ["Acts on feedback", "Tries new approaches", "Stays effective through change"] },
  { name: "Integrity and respect", description: "Acts ethically and treats everyone with respect.", indicators: ["Does the right thing when unobserved", "Treats people fairly", "Values different views"] },
];

export async function listBehaviours(includeInactive = false) {
  const rows = await db.select().from(behaviours).orderBy(asc(behaviours.order), asc(behaviours.name));
  return includeInactive ? rows : rows.filter(b => b.isActive);
}

export async function ensureStarterBehaviours() {
  const existing = await db.select({ id: behaviours.id }).from(behaviours).limit(1);
  if (existing.length) return { created: 0 };
  await db.insert(behaviours).values(STARTER_BEHAVIOURS.map((b, i) => ({ ...b, order: i })));
  return { created: STARTER_BEHAVIOURS.length };
}

export async function saveBehaviour(data: { id?: string; name: string; description?: string | null; indicators?: string[]; order?: number; isActive?: boolean }) {
  if (!data.name?.trim()) throw bad("A behaviour needs a name");
  const values = { name: data.name.trim(), description: data.description ?? null, indicators: data.indicators ?? [], order: data.order ?? 0, isActive: data.isActive ?? true, updatedAt: new Date() };
  if (data.id) {
    const rows = await db.update(behaviours).set(values).where(eq(behaviours.id, data.id)).returning();
    if (!rows.length) throw missing("Behaviour not found");
    return rows[0];
  }
  return (await db.insert(behaviours).values(values).returning())[0];
}

// ---------------------------------------------------------------- cycles

export async function listCycles() {
  const cycles = await db.select().from(performanceCycles).where(eq(performanceCycles.isActive, true)).orderBy(desc(performanceCycles.year), desc(performanceCycles.createdAt));
  const counts = await db.select({ cycleId: appraisals.cycleId, status: appraisals.status, n: sql<number>`count(*)::int` }).from(appraisals).where(eq(appraisals.isActive, true)).groupBy(appraisals.cycleId, appraisals.status);
  return cycles.map(c => {
    const byStatus: Record<string, number> = {};
    counts.filter(x => x.cycleId === c.id).forEach(x => { byStatus[x.status] = x.n; });
    return { ...c, appraisalCounts: byStatus, appraisalTotal: Object.values(byStatus).reduce((a, b) => a + b, 0) };
  });
}

export async function getCycle(id: string) {
  const rows = await db.select().from(performanceCycles).where(eq(performanceCycles.id, id));
  if (!rows.length) throw missing("Review cycle not found");
  return rows[0];
}

const dateOrNull = (v: unknown) => (v ? new Date(v as string) : null);

export async function saveCycle(data: Record<string, any>) {
  if (!data.name?.trim()) throw bad("A review cycle needs a name");
  const year = Number(data.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw bad("Enter a valid year");
  const scale = data.ratingScale != null ? Number(data.ratingScale) : 5;
  if (!Number.isInteger(scale) || scale < 3 || scale > 10) throw bad("The rating scale must be between 3 and 10");
  const values = {
    name: data.name.trim(), year, ratingScale: scale,
    startDate: dateOrNull(data.startDate), endDate: dateOrNull(data.endDate),
    objectiveDeadline: dateOrNull(data.objectiveDeadline), selfReviewDeadline: dateOrNull(data.selfReviewDeadline), managerReviewDeadline: dateOrNull(data.managerReviewDeadline),
    includes360: data.includes360 ?? true, requiresCalibration: data.requiresCalibration ?? false, updatedAt: new Date(),
  };
  if (data.id) {
    const existing = await getCycle(data.id);
    if (existing.status !== "draft" && existing.ratingScale !== scale) throw bad("The rating scale cannot change once a cycle has been launched");
    return (await db.update(performanceCycles).set(values).where(eq(performanceCycles.id, data.id)).returning())[0];
  }
  return (await db.insert(performanceCycles).values({ ...values, status: "draft" }).returning())[0];
}

// Creates one appraisal per active person who has a line manager, then opens the cycle. Safe to run
// again: people who already have an appraisal for the cycle are left alone.
//
// mode "open_only" opens the cycle without creating anything, so managers then start the reviews for
// their own people (see createAppraisal) rather than HR creating them all in one go.
export async function launchCycle(cycleId: string, fallbackReviewerId?: string | null, mode: "everyone" | "open_only" = "everyone", launchedBy?: string) {
  const cycle = await getCycle(cycleId);
  if (cycle.status === "closed") throw bad("This cycle is closed");
  await ensureStarterBehaviours();
  if (mode === "open_only") {
    await db.update(performanceCycles).set({ status: "open", updatedAt: new Date() }).where(eq(performanceCycles.id, cycleId));
    return { created: 0, alreadyHad: 0, skippedNoManager: 0, openedOnly: true };
  }
  const people = await db.select({ id: users.id, managerId: users.managerId }).from(users)
    .where(and(eq(users.isActive, true), sql`${users.isArchived} IS NOT TRUE`));
  const have = new Set((await db.select({ userId: appraisals.userId }).from(appraisals).where(eq(appraisals.cycleId, cycleId))).map(a => a.userId));
  // People with no line manager (for example the most senior roles) are reviewed by the chosen fallback
  // reviewer if there is one, otherwise they are left out and counted so HR can see who was skipped.
  if (fallbackReviewerId) {
    const reviewer = await db.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.id, fallbackReviewerId));
    if (!reviewer.length || !reviewer[0].isActive) throw bad("The chosen reviewer was not found");
  }
  const reviewerFor = (p: { id: string; managerId: string | null }) => p.managerId ?? (fallbackReviewerId && fallbackReviewerId !== p.id ? fallbackReviewerId : null);
  const toCreate = people.filter(p => reviewerFor(p) && !have.has(p.id));
  const noManager = people.filter(p => !reviewerFor(p) && !have.has(p.id)).length;
  for (let i = 0; i < toCreate.length; i += 200) {
    await db.insert(appraisals).values(toCreate.slice(i, i + 200).map(p => ({
      userId: p.id, cycleId, managerId: reviewerFor(p), status: "objectives", initiatedBy: launchedBy ?? null,
      // each person's dates start from the cycle's; the manager can change them for one person later
      objectivesDueDate: cycle.objectiveDeadline, selfReviewDueDate: cycle.selfReviewDeadline, managerReviewDueDate: cycle.managerReviewDeadline,
    })));
  }
  await db.update(performanceCycles).set({ status: "open", updatedAt: new Date() }).where(eq(performanceCycles.id, cycleId));
  return { created: toCreate.length, alreadyHad: have.size, skippedNoManager: noManager };
}

export async function openSelfReviews(cycleId: string) {
  const cycle = await getCycle(cycleId);
  const rows = await db.update(appraisals).set({ status: "self_review", updatedAt: new Date() })
    .where(and(eq(appraisals.cycleId, cycleId), eq(appraisals.status, "objectives"))).returning();
  // tell each person their self assessment is open
  for (const a of rows) await notify.selfReviewOpened(a, a.selfReviewDueDate ?? cycle.selfReviewDeadline);
  return { moved: rows.length };
}

export async function closeCycle(cycleId: string) {
  await getCycle(cycleId);
  await db.update(performanceCycles).set({ status: "closed", updatedAt: new Date() }).where(eq(performanceCycles.id, cycleId));
  return { closed: true };
}

// ---------------------------------------------------------------- access

interface AppraisalAccess { isEmployee: boolean; isManager: boolean; isAdmin: boolean; canView: boolean }
function accessFor(a: Appraisal, actor: Actor): AppraisalAccess {
  const isEmployee = a.userId === actor.id;
  const isManager = a.managerId === actor.id;
  const isAdmin = isAdminActor(actor);
  return { isEmployee, isManager, isAdmin, canView: isEmployee || isManager || isAdmin };
}

async function loadAppraisal(id: string) {
  const rows = await db.select().from(appraisals).where(and(eq(appraisals.id, id), eq(appraisals.isActive, true)));
  if (!rows.length) throw missing("Appraisal not found");
  return rows[0];
}

async function loadContext(id: string, actor: Actor) {
  const appraisal = await loadAppraisal(id);
  const access = accessFor(appraisal, actor);
  if (!access.canView) throw forbid("You cannot view this appraisal");
  const cycle = await getCycle(appraisal.cycleId);
  return { appraisal, access, cycle };
}

// ---------------------------------------------------------------- listing

export async function listMyAppraisals(userId: string) {
  const rows = await db.select({ a: appraisals, c: performanceCycles }).from(appraisals)
    .innerJoin(performanceCycles, eq(appraisals.cycleId, performanceCycles.id))
    .where(and(eq(appraisals.userId, userId), eq(appraisals.isActive, true))).orderBy(desc(performanceCycles.year));
  return rows.map(r => ({ id: r.a.id, status: r.a.status, shared: !!r.a.sharedAt, cycleId: r.c.id, cycleName: r.c.name, year: r.c.year, cycleStatus: r.c.status }));
}

export async function listTeamAppraisals(actor: Actor, opts: { all?: boolean; cycleId?: string }) {
  const conds = [eq(appraisals.isActive, true)];
  if (opts.cycleId) conds.push(eq(appraisals.cycleId, opts.cycleId));
  if (!(opts.all && isAdminActor(actor))) conds.push(eq(appraisals.managerId, actor.id));
  const rows = await db.select({ a: appraisals, c: performanceCycles, u: users }).from(appraisals)
    .innerJoin(performanceCycles, eq(appraisals.cycleId, performanceCycles.id))
    .innerJoin(users, eq(appraisals.userId, users.id))
    .where(and(...conds)).orderBy(desc(performanceCycles.year), asc(users.lastName));
  const roleIds = Array.from(new Set(rows.map(r => r.u.jobRoleId).filter((x): x is string => !!x)));
  const roleRows = roleIds.length ? await db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles).where(inArray(jobRoles.id, roleIds)) : [];
  const roleName = new Map(roleRows.map(r => [r.id, r.name]));
  return rows.map(r => ({
    id: r.a.id, userId: r.u.id, employeeName: fullName(r.u), jobRole: r.u.jobRoleId ? roleName.get(r.u.jobRoleId) ?? null : null,
    status: r.a.status, cycleId: r.c.id, cycleName: r.c.name, year: r.c.year,
    selfSubmitted: !!r.a.selfSubmittedAt, managerSubmitted: !!r.a.managerSubmittedAt, shared: !!r.a.sharedAt,
    // the date the current stage is due, for the "Next due" column
    dueDate: (r.a.status === "objectives" ? r.a.objectivesDueDate ?? r.c.objectiveDeadline
      : r.a.status === "self_review" ? r.a.selfReviewDueDate ?? r.c.selfReviewDeadline
      : r.a.status === "manager_review" ? r.a.managerReviewDueDate ?? r.c.managerReviewDeadline : null) ?? null,
    // only people who can see ratings (admins, or the manager) reach this list, and the score snapshot is theirs to see
    scores: r.a.scores ?? null,
  }));
}

// ---------------------------------------------------------------- detail

export async function getAppraisalDetail(id: string, actor: Actor) {
  const { appraisal, access, cycle } = await loadContext(id, actor);
  const [employee, manager] = await Promise.all([
    db.select().from(users).where(eq(users.id, appraisal.userId)),
    appraisal.managerId ? db.select().from(users).where(eq(users.id, appraisal.managerId)) : Promise.resolve([]),
  ]);
  const role = employee[0]?.jobRoleId ? (await db.select({ name: jobRoles.name }).from(jobRoles).where(eq(jobRoles.id, employee[0].jobRoleId))) [0]?.name ?? null : null;
  const objectives = await db.select().from(performanceObjectives)
    .where(and(eq(performanceObjectives.appraisalId, id), eq(performanceObjectives.isActive, true))).orderBy(asc(performanceObjectives.createdAt));
  const updates = objectives.length
    ? await db.select().from(objectiveUpdates).where(inArray(objectiveUpdates.objectiveId, objectives.map(o => o.id))).orderBy(desc(objectiveUpdates.createdAt))
    : [];
  const frameworks = await listBehaviours();
  const ratings = await db.select().from(appraisalBehaviourRatings).where(eq(appraisalBehaviourRatings.appraisalId, id));

  // The employee sees the manager's side only after the manager has held the discussion and shared
  // the report (sharedAt). The 0-100 score snapshot, the potential rating and any calibration note are
  // for the manager and HR and are never sent to the employee, shared or not.
  const employeeOnly = access.isEmployee && !access.isManager && !access.isAdmin;
  const hideManagerSide = employeeOnly && !appraisal.sharedAt;
  const view: any = { ...appraisal };
  if (employeeOnly) {
    delete view.potentialRating; delete view.calibrationNote; delete view.scores;
    if (hideManagerSide) { delete view.managerSummary; delete view.performanceRating; delete view.developmentPlan; }
  }

  const feedback = cycle.includes360 ? await getFeedbackView(id, appraisal, access, cycle) : null;

  return {
    appraisal: view, cycle,
    employee: employee[0] ? { id: employee[0].id, name: fullName(employee[0]), jobRole: role } : null,
    manager: manager[0] ? { id: manager[0].id, name: fullName(manager[0]) } : null,
    objectives: objectives.map(o => (hideManagerSide ? { ...o, managerOutcome: null, managerComment: null } : o)).map(o => ({ ...o, updates: updates.filter(u => u.objectiveId === o.id) })),
    behaviours: frameworks.map(b => {
      const r = ratings.find(x => x.behaviourId === b.id);
      return { behaviour: b, selfRating: r?.selfRating ?? null, selfComment: r?.selfComment ?? null, managerRating: hideManagerSide ? null : r?.managerRating ?? null, managerComment: hideManagerSide ? null : r?.managerComment ?? null };
    }),
    feedback,
    permissions: {
      isEmployee: access.isEmployee, isManager: access.isManager, isAdmin: access.isAdmin,
      canEditObjectives: (access.isEmployee || access.isManager || access.isAdmin) && appraisal.status === "objectives" && cycle.status === "open",
      canSubmitSelf: access.isEmployee && appraisal.status === "self_review" && cycle.status === "open",
      canSubmitManager: (access.isManager || access.isAdmin) && appraisal.status === "manager_review" && cycle.status === "open",
      canCalibrate: access.isAdmin && appraisal.status === "calibration",
      canShare: (access.isManager || access.isAdmin) && appraisal.status === "meeting" && !appraisal.sharedAt,
      canEditDates: (access.isManager || access.isAdmin) && appraisal.status !== "signed_off" && cycle.status === "open",
      canSignOff: (access.isEmployee || access.isManager || access.isAdmin) && appraisal.status === "meeting" && !!appraisal.sharedAt,
      waitingForShare: appraisal.status === "meeting" && !appraisal.sharedAt,
    },
  };
}

// ---------------------------------------------------------------- objectives

function assertObjectivesEditable(a: Appraisal, access: AppraisalAccess, cycle: PerformanceCycle) {
  if (cycle.status !== "open") throw bad("This review cycle is not open");
  if (a.status !== "objectives") throw bad("Objectives can only be changed while they are being set. Ask your manager to reopen them.");
  if (!(access.isEmployee || access.isManager || access.isAdmin)) throw forbid();
}

function cleanObjective(data: Record<string, any>) {
  if (!data.title?.trim()) throw bad("An objective needs a title");
  const weighting = Number(data.weighting ?? 0);
  if (!Number.isFinite(weighting) || weighting < 0 || weighting > 100) throw bad("Weighting must be between 0 and 100");
  if (data.category && !OBJECTIVE_CATEGORIES.includes(data.category)) throw bad("Unknown objective category");
  return {
    title: data.title.trim(), description: data.description ?? null, successMeasure: data.successMeasure ?? null,
    weighting: Math.round(weighting), category: data.category ?? "delivery", targetDate: dateOrNull(data.targetDate),
    parentObjectiveId: data.parentObjectiveId ?? null,
  };
}

export async function createObjective(appraisalId: string, actor: Actor, data: Record<string, any>) {
  const { appraisal, access, cycle } = await loadContext(appraisalId, actor);
  assertObjectivesEditable(appraisal, access, cycle);
  const values = cleanObjective(data);
  return (await db.insert(performanceObjectives).values({ ...values, appraisalId, userId: appraisal.userId, cycleId: appraisal.cycleId, status: "draft" }).returning())[0];
}

async function loadObjective(id: string, actor: Actor) {
  const rows = await db.select().from(performanceObjectives).where(and(eq(performanceObjectives.id, id), eq(performanceObjectives.isActive, true)));
  if (!rows.length) throw missing("Objective not found");
  const ctx = await loadContext(rows[0].appraisalId, actor);
  return { objective: rows[0], ...ctx };
}

export async function updateObjective(id: string, actor: Actor, data: Record<string, any>) {
  const { objective, appraisal, access, cycle } = await loadObjective(id, actor);
  assertObjectivesEditable(appraisal, access, cycle);
  const values = cleanObjective({ ...objective, ...data });
  return (await db.update(performanceObjectives).set({ ...values, status: "draft", agreedAt: null, updatedAt: new Date() }).where(eq(performanceObjectives.id, id)).returning())[0];
}

export async function deleteObjective(id: string, actor: Actor) {
  const { appraisal, access, cycle } = await loadObjective(id, actor);
  assertObjectivesEditable(appraisal, access, cycle);
  await db.update(performanceObjectives).set({ isActive: false, updatedAt: new Date() }).where(eq(performanceObjectives.id, id));
  return { deleted: true };
}

// A check-in note through the year, with optional progress. Allowed until the appraisal is signed off.
export async function addObjectiveUpdate(id: string, actor: Actor, note: string, progressPercent?: number) {
  const { objective, appraisal, access } = await loadObjective(id, actor);
  if (!(access.isEmployee || access.isManager || access.isAdmin)) throw forbid();
  if (appraisal.status === "signed_off") throw bad("This appraisal has been signed off");
  if (!note?.trim()) throw bad("Write a note for the check-in");
  let progress: number | undefined;
  if (progressPercent !== undefined && progressPercent !== null) {
    progress = Math.round(Number(progressPercent));
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw bad("Progress must be between 0 and 100");
  }
  const created = (await db.insert(objectiveUpdates).values({ objectiveId: id, authorId: actor.id, note: note.trim(), progressPercent: progress ?? null }).returning())[0];
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (progress !== undefined) { patch.progressPercent = progress; if (objective.status === "agreed" && progress > 0) patch.status = "in_progress"; if (progress === 100) patch.status = "complete"; }
  await db.update(performanceObjectives).set(patch).where(eq(performanceObjectives.id, id));
  return created;
}

// The manager (or an admin) confirms the objectives. Weightings must add up to 100 so that
// "objectives met" is a fair percentage.
export async function agreeObjectives(appraisalId: string, actor: Actor) {
  const { appraisal, access, cycle } = await loadContext(appraisalId, actor);
  if (!(access.isManager || access.isAdmin)) throw forbid("Only the line manager can agree objectives");
  if (cycle.status !== "open") throw bad("This review cycle is not open");
  if (appraisal.status !== "objectives") throw bad("Objectives can only be agreed while they are being set");
  const objs = await db.select().from(performanceObjectives).where(and(eq(performanceObjectives.appraisalId, appraisalId), eq(performanceObjectives.isActive, true)));
  if (objs.length === 0) throw bad("Add at least one objective first");
  const total = objs.reduce((s, o) => s + o.weighting, 0);
  if (total !== 100) throw bad(`Objective weightings add up to ${total}%. They must add up to 100%.`);
  await db.update(performanceObjectives).set({ status: "agreed", agreedAt: new Date(), updatedAt: new Date() }).where(and(eq(performanceObjectives.appraisalId, appraisalId), eq(performanceObjectives.isActive, true)));
  return { agreed: objs.length };
}

export async function startSelfReview(appraisalId: string, actor: Actor) {
  const { appraisal, access, cycle } = await loadContext(appraisalId, actor);
  if (!(access.isManager || access.isAdmin)) throw forbid();
  if (cycle.status !== "open") throw bad("This review cycle is not open");
  if (appraisal.status !== "objectives") throw bad("The self review has already started");
  const objs = await db.select().from(performanceObjectives).where(and(eq(performanceObjectives.appraisalId, appraisalId), eq(performanceObjectives.isActive, true)));
  if (objs.length === 0 || objs.some(o => o.status === "draft")) throw bad("Agree the objectives before starting the self review");
  await db.update(appraisals).set({ status: "self_review", updatedAt: new Date() }).where(eq(appraisals.id, appraisalId));
  await notify.selfReviewOpened(appraisal, appraisal.selfReviewDueDate ?? cycle.selfReviewDeadline);
  return { status: "self_review" };
}

// ---------------------------------------------------------------- reviews

function checkRating(value: unknown, scale: number, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > scale) throw bad(`${label} must be a whole number from 1 to ${scale}`);
  return n;
}
function checkOutcome(value: unknown, label: string): ObjectiveOutcome {
  if (!OBJECTIVE_OUTCOMES.includes(value as ObjectiveOutcome)) throw bad(`${label}: choose Not met, Partially met, Met or Exceeded`);
  return value as ObjectiveOutcome;
}

export async function saveSelfReview(appraisalId: string, actor: Actor, body: Record<string, any>, submit: boolean) {
  const { appraisal, access, cycle } = await loadContext(appraisalId, actor);
  if (!access.isEmployee) throw forbid("Only the person being reviewed can complete their self review");
  if (cycle.status !== "open") throw bad("This review cycle is not open");
  if (appraisal.status !== "self_review") throw bad("The self review is not open for this appraisal");
  const frameworks = await listBehaviours();
  const objs = await db.select().from(performanceObjectives).where(and(eq(performanceObjectives.appraisalId, appraisalId), eq(performanceObjectives.isActive, true)));

  for (const o of body.objectives ?? []) {
    const target = objs.find(x => x.id === o.id);
    if (!target) throw bad("Unknown objective in the review");
    await db.update(performanceObjectives).set({
      selfOutcome: o.selfOutcome ? checkOutcome(o.selfOutcome, target.title) : null, selfComment: o.selfComment ?? null, updatedAt: new Date(),
    }).where(eq(performanceObjectives.id, target.id));
  }
  for (const b of body.behaviours ?? []) {
    if (!frameworks.some(f => f.id === b.behaviourId)) throw bad("Unknown behaviour in the review");
    const selfRating = b.selfRating != null ? checkRating(b.selfRating, cycle.ratingScale, "Behaviour rating") : null;
    await db.insert(appraisalBehaviourRatings).values({ appraisalId, behaviourId: b.behaviourId, selfRating, selfComment: b.selfComment ?? null })
      .onConflictDoUpdate({ target: [appraisalBehaviourRatings.appraisalId, appraisalBehaviourRatings.behaviourId], set: { selfRating, selfComment: b.selfComment ?? null, updatedAt: new Date() } });
  }
  const patch: Record<string, unknown> = {
    selfSummary: body.selfSummary ?? appraisal.selfSummary, careerAspirations: body.careerAspirations ?? appraisal.careerAspirations,
    mobility: body.mobility ?? appraisal.mobility, updatedAt: new Date(),
  };
  if (body.selfPerformanceRating != null) patch.selfPerformanceRating = checkRating(body.selfPerformanceRating, cycle.ratingScale, "Overall rating");

  if (submit) {
    const fresh = (await db.select().from(performanceObjectives).where(and(eq(performanceObjectives.appraisalId, appraisalId), eq(performanceObjectives.isActive, true))));
    const rated = await db.select().from(appraisalBehaviourRatings).where(eq(appraisalBehaviourRatings.appraisalId, appraisalId));
    const problems: string[] = [];
    if (!(patch.selfSummary as string)?.trim()) problems.push("write your summary");
    if (patch.selfPerformanceRating == null && appraisal.selfPerformanceRating == null) problems.push("give yourself an overall rating");
    if (fresh.some(o => !o.selfOutcome)) problems.push("say how each objective turned out");
    if (frameworks.some(f => !rated.find(r => r.behaviourId === f.id && r.selfRating != null))) problems.push("rate every behaviour");
    if (problems.length) throw bad(`Before you submit, please ${problems.join(", ")}.`);
    patch.status = "manager_review"; patch.selfSubmittedAt = new Date();
  }
  await db.update(appraisals).set(patch).where(eq(appraisals.id, appraisalId));
  // the self assessment is in: it is now the manager's turn
  if (submit) await notify.managerTurn(appraisal, appraisal.managerReviewDueDate ?? cycle.managerReviewDeadline);
  return { status: (patch.status as string) ?? appraisal.status };
}

export async function saveManagerReview(appraisalId: string, actor: Actor, body: Record<string, any>, submit: boolean) {
  const { appraisal, access, cycle } = await loadContext(appraisalId, actor);
  if (!(access.isManager || access.isAdmin)) throw forbid("Only the line manager can complete the manager review");
  if (cycle.status !== "open") throw bad("This review cycle is not open");
  if (appraisal.status !== "manager_review") throw bad("The manager review is not open for this appraisal");
  const frameworks = await listBehaviours();
  const objs = await db.select().from(performanceObjectives).where(and(eq(performanceObjectives.appraisalId, appraisalId), eq(performanceObjectives.isActive, true)));

  for (const o of body.objectives ?? []) {
    const target = objs.find(x => x.id === o.id);
    if (!target) throw bad("Unknown objective in the review");
    await db.update(performanceObjectives).set({
      managerOutcome: o.managerOutcome ? checkOutcome(o.managerOutcome, target.title) : null, managerComment: o.managerComment ?? null, updatedAt: new Date(),
    }).where(eq(performanceObjectives.id, target.id));
  }
  for (const b of body.behaviours ?? []) {
    if (!frameworks.some(f => f.id === b.behaviourId)) throw bad("Unknown behaviour in the review");
    const managerRating = b.managerRating != null ? checkRating(b.managerRating, cycle.ratingScale, "Behaviour rating") : null;
    await db.insert(appraisalBehaviourRatings).values({ appraisalId, behaviourId: b.behaviourId, managerRating, managerComment: b.managerComment ?? null })
      .onConflictDoUpdate({ target: [appraisalBehaviourRatings.appraisalId, appraisalBehaviourRatings.behaviourId], set: { managerRating, managerComment: b.managerComment ?? null, updatedAt: new Date() } });
  }
  const patch: Record<string, unknown> = {
    managerSummary: body.managerSummary ?? appraisal.managerSummary, developmentPlan: body.developmentPlan ?? appraisal.developmentPlan, updatedAt: new Date(),
  };
  if (body.performanceRating != null) patch.performanceRating = checkRating(body.performanceRating, cycle.ratingScale, "Overall performance rating");
  if (body.potentialRating != null) patch.potentialRating = checkRating(body.potentialRating, 3, "Potential rating");

  if (submit) {
    const fresh = await db.select().from(performanceObjectives).where(and(eq(performanceObjectives.appraisalId, appraisalId), eq(performanceObjectives.isActive, true)));
    const rated = await db.select().from(appraisalBehaviourRatings).where(eq(appraisalBehaviourRatings.appraisalId, appraisalId));
    const problems: string[] = [];
    if (!(patch.managerSummary as string)?.trim()) problems.push("write your summary");
    if ((patch.performanceRating ?? appraisal.performanceRating) == null) problems.push("give an overall performance rating");
    if ((patch.potentialRating ?? appraisal.potentialRating) == null) problems.push("give a potential rating");
    if (fresh.some(o => !o.managerOutcome)) problems.push("say how each objective turned out");
    if (frameworks.some(f => !rated.find(r => r.behaviourId === f.id && r.managerRating != null))) problems.push("rate every behaviour");
    if (problems.length) throw bad(`Before you submit, please ${problems.join(", ")}.`);
    patch.status = cycle.requiresCalibration ? "calibration" : "meeting"; patch.managerSubmittedAt = new Date();
  }
  await db.update(appraisals).set(patch).where(eq(appraisals.id, appraisalId));
  if (submit) await recomputeAppraisalScores(appraisalId);
  return { status: (patch.status as string) ?? appraisal.status };
}

export async function finishCalibration(appraisalId: string, actor: Actor, body: Record<string, any>) {
  const { appraisal, access, cycle } = await loadContext(appraisalId, actor);
  if (!access.isAdmin) throw forbid("Only HR can calibrate");
  if (appraisal.status !== "calibration") throw bad("This appraisal is not waiting for calibration");
  const patch: Record<string, unknown> = { status: "meeting", calibratedAt: new Date(), calibratedBy: actor.id, calibrationNote: body.calibrationNote ?? null, updatedAt: new Date() };
  if (body.performanceRating != null) patch.performanceRating = checkRating(body.performanceRating, cycle.ratingScale, "Overall performance rating");
  if (body.potentialRating != null) patch.potentialRating = checkRating(body.potentialRating, 3, "Potential rating");
  await db.update(appraisals).set(patch).where(eq(appraisals.id, appraisalId));
  await recomputeAppraisalScores(appraisalId);
  return { status: "meeting" };
}

// The manager records that the discussion has taken place and shares the report. Until this happens the
// employee sees only their own half, and nobody can sign off.
export async function shareReport(appraisalId: string, actor: Actor, meetingDate?: string) {
  const { appraisal, access } = await loadContext(appraisalId, actor);
  if (!(access.isManager || access.isAdmin)) throw forbid("Only the line manager can share the report");
  if (appraisal.status !== "meeting") throw bad("The review is not ready to be shared yet. The manager review must be submitted first.");
  if (appraisal.sharedAt) throw bad("This report has already been shared");
  const d = meetingDate ? new Date(meetingDate) : new Date();
  if (isNaN(d.getTime())) throw bad("Enter a valid date for the discussion");
  if (d.getTime() > Date.now() + 86400000) throw bad("The discussion date cannot be in the future. Share the report after you have met.");
  await db.update(appraisals).set({ meetingDate: d, sharedAt: new Date(), updatedAt: new Date() }).where(eq(appraisals.id, appraisalId));
  await notify.reportShared(appraisal);
  return { meetingDate: d, shared: true };
}
export const recordMeeting = shareReport; // earlier name for the same step

export async function signOff(appraisalId: string, actor: Actor, comments?: string) {
  const { appraisal, access } = await loadContext(appraisalId, actor);
  if (appraisal.status !== "meeting") throw bad("The appraisal can be signed off once the report has been shared after the discussion");
  if (!appraisal.sharedAt) throw bad("The manager has not shared the report yet. Sign-off follows the discussion.");
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  let employeeDone = !!appraisal.employeeSignedOffAt, managerDone = !!appraisal.managerSignedOffAt;
  if (access.isEmployee) { patch.employeeSignedOffAt = new Date(); patch.employeeComments = comments ?? appraisal.employeeComments; employeeDone = true; }
  else if (access.isManager || access.isAdmin) { patch.managerSignedOffAt = new Date(); managerDone = true; }
  else throw forbid();
  if (employeeDone && managerDone) patch.status = "signed_off";
  await db.update(appraisals).set(patch).where(eq(appraisals.id, appraisalId));
  if (patch.status === "signed_off") await recomputeAppraisalScores(appraisalId);
  return { status: (patch.status as string) ?? appraisal.status, employeeSignedOff: employeeDone, managerSignedOff: managerDone };
}

// Admin correction path: sends an appraisal back a step and clears the sign-offs.
export async function reopenAppraisal(appraisalId: string, actor: Actor, toStatus: string) {
  if (!isAdminActor(actor)) throw forbid("Only HR can reopen an appraisal");
  if (!["objectives", "self_review", "manager_review", "meeting"].includes(toStatus)) throw bad("Choose a stage to return to");
  await loadAppraisal(appraisalId);
  // going back before the meeting stage un-shares the report, so the employee stops seeing the manager's side
  const patch: Record<string, unknown> = { status: toStatus, employeeSignedOffAt: null, managerSignedOffAt: null, updatedAt: new Date() };
  if (toStatus !== "meeting") patch.sharedAt = null;
  await db.update(appraisals).set(patch).where(eq(appraisals.id, appraisalId));
  return { status: toStatus };
}

// ---------------------------------------------------------------- scores

// Writes the 0-100 snapshot the Talent Score reads: objectives met, overall rating, behaviours (as the
// manager rated them) and 360 feedback (only when enough people responded).
export async function recomputeAppraisalScores(appraisalId: string) {
  const a = await loadAppraisal(appraisalId);
  const cycle = await getCycle(a.cycleId);
  const settings = await getTalentScoreSettings();
  const objs = await db.select().from(performanceObjectives).where(and(eq(performanceObjectives.appraisalId, appraisalId), eq(performanceObjectives.isActive, true)));
  const ratings = await db.select().from(appraisalBehaviourRatings).where(eq(appraisalBehaviourRatings.appraisalId, appraisalId));

  const judged = objs.filter(o => o.managerOutcome);
  const totalWeight = judged.reduce((s, o) => s + o.weighting, 0);
  const objectives = judged.length === 0 ? null
    : totalWeight > 0 ? Math.round(judged.reduce((s, o) => s + o.weighting * OBJECTIVE_OUTCOME_VALUE[o.managerOutcome as ObjectiveOutcome], 0) / totalWeight * 10) / 10
    : Math.round(judged.reduce((s, o) => s + OBJECTIVE_OUTCOME_VALUE[o.managerOutcome as ObjectiveOutcome], 0) / judged.length * 10) / 10;
  const performance = a.performanceRating != null ? pct(a.performanceRating, cycle.ratingScale) : null;
  const mgrRatings = ratings.filter(r => r.managerRating != null).map(r => r.managerRating as number);
  const behavioursScore = mgrRatings.length ? pct(mgrRatings.reduce((s, v) => s + v, 0) / mgrRatings.length, cycle.ratingScale) : null;

  let feedback360: number | null = null;
  if (cycle.includes360) {
    const done = await db.select({ id: feedbackRequests.id }).from(feedbackRequests).where(and(eq(feedbackRequests.appraisalId, appraisalId), eq(feedbackRequests.status, "completed")));
    if (done.length >= settings.minFeedbackRaters) {
      const resp = await db.select({ rating: feedbackResponses.rating }).from(feedbackResponses).where(inArray(feedbackResponses.requestId, done.map(d => d.id)));
      if (resp.length) feedback360 = pct(resp.reduce((s, r) => s + r.rating, 0) / resp.length, cycle.ratingScale);
    }
  }
  const scores = { objectives, performance, behaviours: behavioursScore, feedback360 };
  await db.update(appraisals).set({ scores, updatedAt: new Date() }).where(eq(appraisals.id, appraisalId));
  return scores;
}

// ---------------------------------------------------------------- 360 feedback

export async function proposeRater(appraisalId: string, actor: Actor, raterId: string, raterType: string) {
  const { appraisal, access, cycle } = await loadContext(appraisalId, actor);
  if (!cycle.includes360) throw bad("This review cycle does not include 360 feedback");
  if (cycle.status !== "open" || appraisal.status === "signed_off") throw bad("Feedback requests can no longer be added");
  if (!(access.isEmployee || access.isManager || access.isAdmin)) throw forbid();
  if (!RATER_TYPES.includes(raterType as any)) throw bad("Choose peer, direct report or stakeholder");
  if (raterId === appraisal.userId) throw bad("A person cannot rate themselves in the 360");
  if (raterId === appraisal.managerId) throw bad("The line manager rates in the manager review, not the 360");
  const rater = await db.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.id, raterId));
  if (!rater.length || !rater[0].isActive) throw bad("That person cannot be asked for feedback");
  const dup = await db.select({ id: feedbackRequests.id }).from(feedbackRequests).where(and(eq(feedbackRequests.appraisalId, appraisalId), eq(feedbackRequests.raterId, raterId)));
  if (dup.length) throw bad("That person has already been asked");
  const approvedNow = access.isManager || access.isAdmin;
  const created = (await db.insert(feedbackRequests).values({
    appraisalId, subjectUserId: appraisal.userId, raterId, raterType, proposedBy: actor.id,
    status: approvedNow ? "approved" : "proposed", approvedBy: approvedNow ? actor.id : null, approvedAt: approvedNow ? new Date() : null,
  }).returning())[0];
  if (approvedNow) await notify.feedbackRequested(raterId, appraisal.userId, created.id);
  else await notify.raterProposed(appraisal);
  return created;
}

export async function decideRater(requestId: string, actor: Actor, approve: boolean) {
  const rows = await db.select().from(feedbackRequests).where(eq(feedbackRequests.id, requestId));
  if (!rows.length) throw missing("Feedback request not found");
  const { access } = await loadContext(rows[0].appraisalId, actor);
  if (!(access.isManager || access.isAdmin)) throw forbid("Only the line manager can approve raters");
  if (rows[0].status !== "proposed") throw bad("This request has already been decided");
  await db.update(feedbackRequests).set({ status: approve ? "approved" : "rejected", approvedBy: actor.id, approvedAt: new Date() }).where(eq(feedbackRequests.id, requestId));
  if (approve) await notify.feedbackRequested(rows[0].raterId, rows[0].subjectUserId, requestId);
  return { status: approve ? "approved" : "rejected" };
}

export async function removeRater(requestId: string, actor: Actor) {
  const rows = await db.select().from(feedbackRequests).where(eq(feedbackRequests.id, requestId));
  if (!rows.length) throw missing("Feedback request not found");
  const { access } = await loadContext(rows[0].appraisalId, actor);
  if (!(access.isManager || access.isAdmin || rows[0].proposedBy === actor.id)) throw forbid();
  if (rows[0].status === "completed") throw bad("Completed feedback cannot be removed");
  await db.delete(feedbackRequests).where(eq(feedbackRequests.id, requestId));
  return { removed: true };
}

// What a rater sees in their inbox: people who have asked them (with approval) for feedback.
export async function listFeedbackInbox(raterId: string) {
  const rows = await db.select({ r: feedbackRequests, a: appraisals, c: performanceCycles, u: users }).from(feedbackRequests)
    .innerJoin(appraisals, eq(feedbackRequests.appraisalId, appraisals.id))
    .innerJoin(performanceCycles, eq(appraisals.cycleId, performanceCycles.id))
    .innerJoin(users, eq(feedbackRequests.subjectUserId, users.id))
    .where(and(eq(feedbackRequests.raterId, raterId), inArray(feedbackRequests.status, ["approved", "completed"]), eq(performanceCycles.status, "open")))
    .orderBy(desc(feedbackRequests.createdAt));
  return rows.map(x => ({ id: x.r.id, status: x.r.status, raterType: x.r.raterType, subjectName: fullName(x.u), cycleName: x.c.name, ratingScale: x.c.ratingScale }));
}

export async function getFeedbackForm(requestId: string, actor: Actor) {
  const rows = await db.select({ r: feedbackRequests, c: performanceCycles, u: users }).from(feedbackRequests)
    .innerJoin(appraisals, eq(feedbackRequests.appraisalId, appraisals.id))
    .innerJoin(performanceCycles, eq(appraisals.cycleId, performanceCycles.id))
    .innerJoin(users, eq(feedbackRequests.subjectUserId, users.id))
    .where(eq(feedbackRequests.id, requestId));
  if (!rows.length) throw missing("Feedback request not found");
  if (rows[0].r.raterId !== actor.id) throw forbid("This feedback request is not yours");
  return { request: { id: rows[0].r.id, status: rows[0].r.status, raterType: rows[0].r.raterType }, subjectName: fullName(rows[0].u), cycle: rows[0].c, behaviours: await listBehaviours() };
}

export async function submitFeedback(requestId: string, actor: Actor, body: Record<string, any>) {
  const rows = await db.select().from(feedbackRequests).where(eq(feedbackRequests.id, requestId));
  if (!rows.length) throw missing("Feedback request not found");
  const req = rows[0];
  if (req.raterId !== actor.id) throw forbid("This feedback request is not yours");
  if (req.status !== "approved") throw bad(req.status === "completed" ? "You have already given this feedback" : "This request is not open");
  const appraisal = await loadAppraisal(req.appraisalId);
  const cycle = await getCycle(appraisal.cycleId);
  if (cycle.status !== "open") throw bad("This review cycle is closed");
  const frameworks = await listBehaviours();
  const given = new Map<string, number>();
  for (const r of body.ratings ?? []) given.set(r.behaviourId, checkRating(r.rating, cycle.ratingScale, "Each rating"));
  if (frameworks.some(f => !given.has(f.id))) throw bad("Please rate every behaviour");
  await db.insert(feedbackResponses).values(frameworks.map(f => ({ requestId, behaviourId: f.id, rating: given.get(f.id) as number })))
    .onConflictDoUpdate({ target: [feedbackResponses.requestId, feedbackResponses.behaviourId], set: { rating: sql`excluded.rating` } });
  await db.update(feedbackRequests).set({ status: "completed", strengthsComment: body.strengthsComment ?? null, developmentComment: body.developmentComment ?? null, completedAt: new Date() }).where(eq(feedbackRequests.id, requestId));
  await recomputeAppraisalScores(req.appraisalId);
  return { status: "completed" };
}

export async function declineFeedback(requestId: string, actor: Actor) {
  const rows = await db.select().from(feedbackRequests).where(eq(feedbackRequests.id, requestId));
  if (!rows.length) throw missing("Feedback request not found");
  if (rows[0].raterId !== actor.id) throw forbid();
  if (rows[0].status !== "approved") throw bad("This request cannot be declined now");
  await db.update(feedbackRequests).set({ status: "declined" }).where(eq(feedbackRequests.id, requestId));
  return { status: "declined" };
}

// The 360 as the person and their manager see it. Nothing identifies a rater, and results are held
// back until enough people have answered: a group needs minFeedbackRaters responses to be shown on its
// own, and the comments only appear once the total reaches that number.
async function getFeedbackView(appraisalId: string, appraisal: Appraisal, access: AppraisalAccess, cycle: PerformanceCycle) {
  const settings = await getTalentScoreSettings();
  const min = settings.minFeedbackRaters;
  const reqs = await db.select().from(feedbackRequests).where(eq(feedbackRequests.appraisalId, appraisalId)).orderBy(asc(feedbackRequests.createdAt));
  const raterRows = reqs.length ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(inArray(users.id, reqs.map(r => r.raterId))) : [];
  const nameOf = new Map(raterRows.map(u => [u.id, fullName(u)]));
  const completed = reqs.filter(r => r.status === "completed");

  // who has been asked, and where each request stands. The raters' names are visible to the manager and
  // HR (they approve the list) but never next to a rating.
  const canSeeRequests = access.isManager || access.isAdmin;
  const requests = reqs.map(r => ({
    id: r.id, raterType: r.raterType, status: r.status,
    raterName: canSeeRequests || r.proposedBy === appraisal.userId ? nameOf.get(r.raterId) ?? null : null,
    proposedByMe: r.proposedBy === appraisal.userId,
  }));

  // the employee sees the 360 results only once the manager has shared the report after the discussion
  const resultsVisible = access.isManager || access.isAdmin || !!appraisal.sharedAt;
  let summary: any = { minRaters: min, completedCount: completed.length, visible: false };
  if (resultsVisible && completed.length >= min) {
    const resp = await db.select().from(feedbackResponses).where(inArray(feedbackResponses.requestId, completed.map(c => c.id)));
    const groups: Record<string, string[]> = {};
    for (const c of completed) { (groups[c.raterType] ??= []).push(c.id); }
    const avgBy = (requestIds: string[]) => {
      const out: Record<string, number> = {};
      for (const b of Array.from(new Set(resp.map(r => r.behaviourId)))) {
        const vals = resp.filter(r => requestIds.includes(r.requestId) && r.behaviourId === b).map(r => r.rating);
        if (vals.length) out[b] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 100) / 100;
      }
      return out;
    };
    const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
    summary = {
      minRaters: min, completedCount: completed.length, visible: true, ratingScale: cycle.ratingScale,
      overall: avgBy(completed.map(c => c.id)),
      groups: Object.entries(groups).filter(([, ids]) => ids.length >= min).map(([raterType, ids]) => ({ raterType, count: ids.length, averages: avgBy(ids) })),
      strengths: shuffle(completed.map(c => c.strengthsComment).filter((x): x is string => !!x)),
      development: shuffle(completed.map(c => c.developmentComment).filter((x): x is string => !!x)),
    };
  }
  return { requests, summary };
}

// ---------------------------------------------------------------- career history and qualifications

function assertOwnerOrAdmin(userId: string, actor: Actor) {
  if (userId !== actor.id && !isAdminActor(actor)) throw forbid("You can only change your own career history");
}

export async function listExperience(userId: string, actor: Actor) {
  assertOwnerOrAdmin(userId, actor);
  return db.select().from(userExperience).where(and(eq(userExperience.userId, userId), eq(userExperience.isActive, true))).orderBy(desc(userExperience.startDate));
}
export async function listQualifications(userId: string, actor: Actor) {
  assertOwnerOrAdmin(userId, actor);
  return db.select().from(userQualifications).where(and(eq(userQualifications.userId, userId), eq(userQualifications.isActive, true))).orderBy(desc(userQualifications.awardedDate));
}

export async function saveExperience(userId: string, actor: Actor, data: Record<string, any>) {
  assertOwnerOrAdmin(userId, actor);
  if (!data.employer?.trim() || !data.title?.trim()) throw bad("Add the employer and job title");
  const start = dateOrNull(data.startDate);
  if (!start || isNaN(start.getTime())) throw bad("Add a valid start date");
  const end = dateOrNull(data.endDate);
  if (end && end.getTime() < start.getTime()) throw bad("The end date is before the start date");
  const values: Partial<InsertUserExperience> = {
    employer: data.employer.trim(), title: data.title.trim(), jobFamilyId: data.jobFamilyId || null, jobRoleId: data.jobRoleId || null,
    startDate: start, endDate: end, description: data.description ?? null, source: data.source ?? "manual",
    // only HR can mark history as verified
    verified: isAdminActor(actor) ? Boolean(data.verified) : false,
  };
  if (data.id) {
    const existing = await db.select().from(userExperience).where(and(eq(userExperience.id, data.id), eq(userExperience.userId, userId)));
    if (!existing.length) throw missing("Entry not found");
    return (await db.update(userExperience).set({ ...values, verified: isAdminActor(actor) ? values.verified : existing[0].verified, updatedAt: new Date() }).where(eq(userExperience.id, data.id)).returning())[0];
  }
  return (await db.insert(userExperience).values({ ...values, userId } as InsertUserExperience).returning())[0];
}

export async function saveQualification(userId: string, actor: Actor, data: Record<string, any>) {
  assertOwnerOrAdmin(userId, actor);
  if (!data.name?.trim()) throw bad("Add the qualification name");
  let level: number | null = null;
  if (data.level !== undefined && data.level !== null && data.level !== "") {
    level = Number(data.level);
    if (!Number.isInteger(level) || level < 0 || level > 8) throw bad("Level must be a whole number from 0 to 8");
  }
  const values: Partial<InsertUserQualification> = {
    name: data.name.trim(), level, awardingBody: data.awardingBody ?? null, awardedDate: dateOrNull(data.awardedDate), expiryDate: dateOrNull(data.expiryDate),
    source: data.source ?? "manual", verified: isAdminActor(actor) ? Boolean(data.verified) : false,
  };
  if (data.id) {
    const existing = await db.select().from(userQualifications).where(and(eq(userQualifications.id, data.id), eq(userQualifications.userId, userId)));
    if (!existing.length) throw missing("Entry not found");
    return (await db.update(userQualifications).set({ ...values, verified: isAdminActor(actor) ? values.verified : existing[0].verified, updatedAt: new Date() }).where(eq(userQualifications.id, data.id)).returning())[0];
  }
  return (await db.insert(userQualifications).values({ ...values, userId } as InsertUserQualification).returning())[0];
}

export async function deleteExperience(userId: string, id: string, actor: Actor) {
  assertOwnerOrAdmin(userId, actor);
  await db.update(userExperience).set({ isActive: false, updatedAt: new Date() }).where(and(eq(userExperience.id, id), eq(userExperience.userId, userId)));
  return { deleted: true };
}
export async function deleteQualification(userId: string, id: string, actor: Actor) {
  assertOwnerOrAdmin(userId, actor);
  await db.update(userQualifications).set({ isActive: false, updatedAt: new Date() }).where(and(eq(userQualifications.id, id), eq(userQualifications.userId, userId)));
  return { deleted: true };
}

// A plain directory (name and job title only) so anyone can nominate colleagues for 360 feedback without
// needing access to the full user list.
export async function listPeople() {
  const rows = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, jobRoleId: users.jobRoleId })
    .from(users).where(and(eq(users.isActive, true), sql`${users.isArchived} IS NOT TRUE`)).orderBy(asc(users.lastName), asc(users.firstName));
  const roleIds = Array.from(new Set(rows.map(r => r.jobRoleId).filter((x): x is string => !!x)));
  const roleRows = roleIds.length ? await db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles).where(inArray(jobRoles.id, roleIds)) : [];
  const roleName = new Map(roleRows.map(r => [r.id, r.name]));
  return rows.map(r => ({ id: r.id, name: fullName(r), jobRole: r.jobRoleId ? roleName.get(r.jobRoleId) ?? null : null }));
}

// ---------------------------------------------------------------- starting reviews and dates

// The people a manager can start a review for: their direct reports. An admin can pick anyone.
// Each row says whether the person already has a review in the chosen cycle.
export async function listMyReports(actor: Actor, cycleId?: string) {
  const admin = isAdminActor(actor);
  const conds = [eq(users.isActive, true), sql`${users.isArchived} IS NOT TRUE`, ne(users.id, actor.id)];
  if (!admin) conds.push(eq(users.managerId, actor.id));
  const rows = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, jobRoleId: users.jobRoleId, managerId: users.managerId })
    .from(users).where(and(...conds)).orderBy(asc(users.lastName), asc(users.firstName));
  const roleIds = Array.from(new Set(rows.map(r => r.jobRoleId).filter((x): x is string => !!x)));
  const roleRows = roleIds.length ? await db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles).where(inArray(jobRoles.id, roleIds)) : [];
  const roleName = new Map(roleRows.map(r => [r.id, r.name]));
  const existing = cycleId
    ? await db.select({ id: appraisals.id, userId: appraisals.userId }).from(appraisals).where(and(eq(appraisals.cycleId, cycleId), eq(appraisals.isActive, true)))
    : [];
  const have = new Map(existing.map(e => [e.userId, e.id]));
  return rows.map(r => ({ id: r.id, name: fullName(r), jobRole: r.jobRoleId ? roleName.get(r.jobRoleId) ?? null : null, hasManager: !!r.managerId, appraisalId: have.get(r.id) ?? null }));
}

function cleanDate(v: unknown, label: string): Date | null {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v as string);
  if (isNaN(d.getTime())) throw bad(`Enter a valid date for ${label}`);
  return d;
}

function assertDatesInOrder(d: { objectivesDueDate: Date | null; selfReviewDueDate: Date | null; managerReviewDueDate: Date | null }) {
  const { objectivesDueDate: o, selfReviewDueDate: s, managerReviewDueDate: m } = d;
  if (o && s && s < o) throw bad("The self assessment cannot be due before the objectives");
  if (s && m && m < s) throw bad("The manager review cannot be due before the self assessment");
  if (o && m && m < o) throw bad("The manager review cannot be due before the objectives");
}

// A manager starts the annual review for one of their own direct reports and sets the dates. Admins can
// do it for anyone, naming the reviewer if the person has no line manager.
export async function createAppraisal(actor: Actor, data: { userId: string; cycleId: string; reviewerId?: string | null; objectivesDueDate?: string | null; selfReviewDueDate?: string | null; managerReviewDueDate?: string | null }) {
  if (!data.userId || !data.cycleId) throw bad("Choose the person and the review cycle");
  const cycle = await getCycle(data.cycleId);
  if (cycle.status !== "open") throw bad("This review cycle is not open. HR needs to launch it first.");
  const person = (await db.select().from(users).where(eq(users.id, data.userId)))[0];
  if (!person || !person.isActive) throw bad("That person was not found");
  if (person.id === actor.id) throw bad("You cannot start your own review. Your manager does that.");
  const admin = isAdminActor(actor);
  if (!admin && person.managerId !== actor.id) throw forbid("You can only start reviews for your own direct reports");
  const reviewerId = person.managerId ?? (admin ? data.reviewerId ?? null : null);
  if (!reviewerId) throw bad("This person has no line manager. Choose who should review them.");
  const dup = await db.select({ id: appraisals.id }).from(appraisals).where(and(eq(appraisals.userId, person.id), eq(appraisals.cycleId, cycle.id)));
  if (dup.length) throw bad("This person already has a review in this cycle");

  const objectivesDueDate = cleanDate(data.objectivesDueDate, "the objectives") ?? cycle.objectiveDeadline;
  const selfReviewDueDate = cleanDate(data.selfReviewDueDate, "the self assessment") ?? cycle.selfReviewDeadline;
  const managerReviewDueDate = cleanDate(data.managerReviewDueDate, "the manager review") ?? cycle.managerReviewDeadline;
  assertDatesInOrder({ objectivesDueDate, selfReviewDueDate, managerReviewDueDate });

  await ensureStarterBehaviours();
  const created = (await db.insert(appraisals).values({
    userId: person.id, cycleId: cycle.id, managerId: reviewerId, status: "objectives", initiatedBy: actor.id,
    objectivesDueDate, selfReviewDueDate, managerReviewDueDate,
  }).returning())[0];
  await notify.objectivesStarted(created, objectivesDueDate);
  return created;
}

export async function updateAppraisalDates(appraisalId: string, actor: Actor, data: { objectivesDueDate?: string | null; selfReviewDueDate?: string | null; managerReviewDueDate?: string | null }) {
  const { appraisal, access, cycle } = await loadContext(appraisalId, actor);
  if (!(access.isManager || access.isAdmin)) throw forbid("Only the line manager can change the dates");
  if (cycle.status !== "open" || appraisal.status === "signed_off") throw bad("The dates can no longer be changed");
  const next = {
    objectivesDueDate: "objectivesDueDate" in data ? cleanDate(data.objectivesDueDate, "the objectives") : appraisal.objectivesDueDate,
    selfReviewDueDate: "selfReviewDueDate" in data ? cleanDate(data.selfReviewDueDate, "the self assessment") : appraisal.selfReviewDueDate,
    managerReviewDueDate: "managerReviewDueDate" in data ? cleanDate(data.managerReviewDueDate, "the manager review") : appraisal.managerReviewDueDate,
  };
  assertDatesInOrder(next);
  await db.update(appraisals).set({ ...next, updatedAt: new Date() }).where(eq(appraisals.id, appraisalId));
  return next;
}

// ---------------------------------------------------------------- to do list

export interface TodoItem { appraisalId?: string; requestId?: string; kind: string; title: string; detail: string; path: string; dueDate: string | null; daysLeft: number | null }

// What needs this person's attention now. Shown in the app whether or not email is set up, and follows
// the same rules as the reminder emails.
export async function listTodo(actor: Actor): Promise<TodoItem[]> {
  const now = Date.now();
  const days = (d: Date | null) => (d ? Math.ceil((new Date(d).getTime() - now) / 86400000) : null);
  const items: TodoItem[] = [];
  const rows = await db.select({ a: appraisals, c: performanceCycles, u: users }).from(appraisals)
    .innerJoin(performanceCycles, eq(appraisals.cycleId, performanceCycles.id))
    .innerJoin(users, eq(appraisals.userId, users.id))
    .where(and(eq(performanceCycles.status, "open"), eq(appraisals.isActive, true), ne(appraisals.status, "signed_off"),
      sql`(${appraisals.userId} = ${actor.id} OR ${appraisals.managerId} = ${actor.id})`));
  const ids = rows.map(r => r.a.id);
  const objs = ids.length
    ? await db.select({ appraisalId: performanceObjectives.appraisalId, total: sql<number>`count(*)::int`, drafts: sql<number>`count(*) filter (where ${performanceObjectives.status} = 'draft')::int` })
        .from(performanceObjectives).where(and(inArray(performanceObjectives.appraisalId, ids), eq(performanceObjectives.isActive, true))).groupBy(performanceObjectives.appraisalId)
    : [];
  const objBy = new Map(objs.map(o => [o.appraisalId, o]));
  const push = (a: Appraisal, kind: string, title: string, detail: string, due: Date | null) =>
    items.push({ appraisalId: a.id, kind, title, detail, path: `/performance/appraisals/${a.id}`, dueDate: due ? new Date(due).toISOString() : null, daysLeft: days(due) });

  for (const { a, c, u } of rows) {
    const name = fullName(u);
    if (a.userId === actor.id) {
      if (a.status === "objectives") {
        const o = objBy.get(a.id);
        if (!o || o.total === 0) push(a, "set_objectives", "Draft your objectives", "Add the objectives you will be reviewed against.", a.objectivesDueDate ?? c.objectiveDeadline);
      } else if (a.status === "self_review") {
        push(a, "self_review", "Complete your self assessment", "Rate your objectives and behaviours, then submit to your manager.", a.selfReviewDueDate ?? c.selfReviewDeadline);
      } else if (a.status === "meeting" && a.sharedAt) {
        push(a, "sign_off", "Read and sign off your review", "Your manager has shared your report after your discussion.", null);
      }
    }
    if (a.managerId === actor.id && a.userId !== actor.id) {
      if (a.status === "objectives") {
        const o = objBy.get(a.id);
        if (o && o.drafts > 0) push(a, "agree_objectives", `Agree objectives with ${name}`, `${o.drafts} objective${o.drafts === 1 ? " is" : "s are"} waiting for your agreement.`, a.objectivesDueDate ?? c.objectiveDeadline);
      } else if (a.status === "manager_review") {
        push(a, "manager_review", `Complete the review for ${name}`, "Their self assessment is in. Rate them and write your summary.", a.managerReviewDueDate ?? c.managerReviewDeadline);
      } else if (a.status === "meeting" && !a.sharedAt) {
        push(a, "share_report", `Hold the discussion with ${name} and share the report`, "Your review is complete. Meet them, then share the report.", null);
      } else if (a.status === "meeting" && a.sharedAt) {
        push(a, "sign_off", `Sign off ${name}'s review`, "The report has been shared. Sign it off when you have both agreed.", null);
      }
    }
  }

  const pending = await db.select({ f: feedbackRequests }).from(feedbackRequests)
    .where(and(eq(feedbackRequests.raterId, actor.id), eq(feedbackRequests.status, "approved")));
  if (pending.length) {
    const subj = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(inArray(users.id, pending.map(p => p.f.subjectUserId)));
    const subjName = new Map(subj.map(s => [s.id, fullName(s)]));
    for (const p of pending) {
      items.push({ requestId: p.f.id, kind: "give_feedback", title: `Give feedback for ${subjName.get(p.f.subjectUserId) ?? "a colleague"}`, detail: "Takes a few minutes and your answers are anonymous.", path: `/performance/feedback/${p.f.id}`, dueDate: null, daysLeft: null });
    }
  }

  if (isAdminActor(actor)) {
    const cal = await db.select({ a: appraisals, u: users }).from(appraisals).innerJoin(users, eq(appraisals.userId, users.id)).where(and(eq(appraisals.status, "calibration"), eq(appraisals.isActive, true)));
    for (const { a, u } of cal) push(a, "calibrate", `Calibrate ${fullName(u)}`, "Check the ratings are consistent across the organisation.", null);
  }

  // soonest due first, then items with no date
  return items.sort((x, y) => (x.daysLeft ?? 9999) - (y.daysLeft ?? 9999));
}
