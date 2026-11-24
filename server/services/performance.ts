import { db } from "../db";
import { and, asc, desc, eq, inArray, lte, ne, or, sql } from "drizzle-orm";
import {
  users,
  jobRoles,
  performanceCycles,
  behaviours,
  appraisals,
  performanceObjectives,
  objectiveUpdates,
  appraisalBehaviourRatings,
  appraisalComments,
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
import { accessiblePersonIds } from "./personAccess";
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
  const periodType = data.periodType ?? "annual";
  if (!(PERIOD_TYPES as readonly string[]).includes(periodType)) throw bad("Choose a review period type");
  const scale = data.ratingScale != null ? Number(data.ratingScale) : 5;
  if (!Number.isInteger(scale) || scale < 3 || scale > 10) throw bad("The rating scale must be between 3 and 10");
  const values = {
    name: data.name.trim(), year, ratingScale: scale,
    startDate: dateOrNull(data.startDate), endDate: dateOrNull(data.endDate),
    objectiveDeadline: dateOrNull(data.objectiveDeadline), selfReviewDeadline: dateOrNull(data.selfReviewDeadline), managerReviewDeadline: dateOrNull(data.managerReviewDeadline),
    includes360: data.includes360 ?? true, requiresCalibration: data.requiresCalibration ?? false, updatedAt: new Date(),
    periodType, autoLaunch: !!data.autoLaunch, carryForward: !!data.carryForward,
    opensOn: dateOrNull(data.opensOn), selfReviewOpensOn: dateOrNull(data.selfReviewOpensOn),
  };
  if (values.autoLaunch && !values.opensOn) throw bad("Set the date this period opens, so it can open by itself");
  if (values.opensOn && values.selfReviewOpensOn && values.selfReviewOpensOn < values.opensOn) throw bad("The self assessment cannot open before the period does");
  if (values.startDate && values.endDate && values.endDate < values.startDate) throw bad("The period cannot end before it starts");
  if (data.id) {
    const existing = await getCycle(data.id);
    if (existing.status !== "draft" && existing.ratingScale !== scale) throw bad("The rating scale cannot change once a cycle has been launched");
    return (await db.update(performanceCycles).set(values).where(eq(performanceCycles.id, data.id)).returning())[0];
  }
  return (await db.insert(performanceCycles).values({ ...values, status: "draft" }).returning())[0];
}

// Creates one appraisal per active person who has an appraiser (their manager), then opens the cycle. Safe to run
// again: people who already have an appraisal for the cycle are left alone.
//
// With "carry forward" on, a person's review starts from the objectives already agreed earlier in the same year (the ones not yet
// complete), so a quarterly or mid-year check-in goes straight to their self assessment. Everyone created is told, and each manager and
// supervisor gets one email saying how many people they have in the period.
//
// mode "open_only" opens the cycle without creating anything, so managers then start the reviews for
// their own people (see createAppraisal) rather than HR creating them all in one go.
export async function launchCycle(cycleId: string, fallbackReviewerId?: string | null, mode: "everyone" | "open_only" = "everyone", launchedBy?: string) {
  const cycle = await getCycle(cycleId);
  if (cycle.status === "closed") throw bad("This cycle is closed");
  await ensureStarterBehaviours();
  const stamp = { status: "open", launchedAt: cycle.launchedAt ?? new Date(), updatedAt: new Date() };
  if (mode === "open_only") {
    await db.update(performanceCycles).set(stamp).where(eq(performanceCycles.id, cycleId));
    return { created: 0, alreadyHad: 0, skippedNoManager: 0, carriedForward: 0, openedOnly: true };
  }
  const people = await db.select({ id: users.id, managerId: users.managerId, supervisorId: users.supervisorId }).from(users)
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

  const carried = cycle.carryForward ? await objectivesToCarry(cycle, toCreate.map(p => p.id)) : new Map<string, Array<typeof performanceObjectives.$inferSelect>>();
  const made: Array<{ a: Appraisal; carried: boolean }> = [];
  for (let i = 0; i < toCreate.length; i += 200) {
    const batch = toCreate.slice(i, i + 200);
    const rows = await db.insert(appraisals).values(batch.map(p => {
      const reviewer = reviewerFor(p);
      return {
        userId: p.id, cycleId, managerId: reviewer, supervisorId: p.supervisorId && p.supervisorId !== reviewer ? p.supervisorId : null,
        status: carried.has(p.id) ? "self_review" : "objectives", initiatedBy: launchedBy ?? null,
        // each person's dates start from the cycle's; the manager can change them for one person later
        objectivesDueDate: cycle.objectiveDeadline, selfReviewDueDate: cycle.selfReviewDeadline, managerReviewDueDate: cycle.managerReviewDeadline,
      };
    })).returning();
    for (const a of rows) {
      const objs = carried.get(a.userId);
      if (objs?.length) {
        await db.insert(performanceObjectives).values(objs.map(o => ({
          appraisalId: a.id, userId: a.userId, cycleId, title: o.title, description: o.description, successMeasure: o.successMeasure, weighting: o.weighting,
          category: o.category, targetDate: o.targetDate, parentObjectiveId: o.parentObjectiveId, status: "agreed", progressPercent: o.progressPercent, agreedAt: o.agreedAt ?? new Date(),
        })));
      }
      made.push({ a, carried: !!objs?.length });
    }
  }
  await db.update(performanceCycles).set(stamp).where(eq(performanceCycles.id, cycleId));

  // tell the people concerned: each person what to do first, each appraiser how many people they have in this period
  const counts = new Map<string, { manager: number; supervisor: number }>();
  const bump = (id: string | null, k: "manager" | "supervisor") => { if (!id) return; const c = counts.get(id) ?? { manager: 0, supervisor: 0 }; c[k]++; counts.set(id, c); };
  for (const { a, carried: c } of made) {
    if (c) await notify.selfReviewOpened(a, a.selfReviewDueDate ?? cycle.selfReviewDeadline);
    else await notify.objectivesStarted(a, a.objectivesDueDate ?? cycle.objectiveDeadline);
    bump(a.managerId, "manager"); bump(a.supervisorId, "supervisor");
  }
  if (made.length) await notify.periodOpened(cycle.name, counts, cycle.managerReviewDeadline);
  return { created: toCreate.length, alreadyHad: have.size, skippedNoManager: noManager, carriedForward: made.filter(m => m.carried).length };
}

// The objectives each person agreed earlier in the same year that are still running: taken from their most recent earlier review that has
// any, leaving out ones that are still drafts and ones already complete.
async function objectivesToCarry(cycle: PerformanceCycle, userIds: string[]) {
  const out = new Map<string, Array<typeof performanceObjectives.$inferSelect>>();
  if (!userIds.length) return out;
  const before = cycle.startDate ?? cycle.createdAt ?? new Date();
  const earlier = await db.select({ id: performanceCycles.id, startDate: performanceCycles.startDate, createdAt: performanceCycles.createdAt }).from(performanceCycles)
    .where(and(eq(performanceCycles.year, cycle.year), eq(performanceCycles.isActive, true), ne(performanceCycles.id, cycle.id)));
  const prior = earlier.filter(c => new Date(c.startDate ?? c.createdAt ?? 0).getTime() < new Date(before).getTime());
  if (!prior.length) return out;
  const order = new Map(prior.map(c => [c.id, new Date(c.startDate ?? c.createdAt ?? 0).getTime()]));
  const rows = await db.select().from(performanceObjectives).where(and(
    inArray(performanceObjectives.cycleId, prior.map(c => c.id)), inArray(performanceObjectives.userId, userIds), eq(performanceObjectives.isActive, true),
    sql`${performanceObjectives.status} NOT IN ('draft', 'complete')`));
  const best = new Map<string, number>();
  for (const r of rows) { const t = order.get(r.cycleId) ?? 0; if (t > (best.get(r.userId) ?? -1)) best.set(r.userId, t); }
  for (const r of rows) { if ((order.get(r.cycleId) ?? 0) === best.get(r.userId)) { if (!out.has(r.userId)) out.set(r.userId, []); out.get(r.userId)!.push(r); } }
  return out;
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

interface AppraisalAccess { isEmployee: boolean; isManager: boolean; isSupervisor: boolean; isAdmin: boolean; canView: boolean }
function accessFor(a: Appraisal, actor: Actor): AppraisalAccess {
  const isEmployee = a.userId === actor.id;
  const isManager = a.managerId === actor.id;
  const isSupervisor = a.supervisorId === actor.id && !isManager && !isEmployee;
  const isAdmin = isAdminActor(actor);
  return { isEmployee, isManager, isSupervisor, isAdmin, canView: isEmployee || isManager || isSupervisor || isAdmin };
}

// Anyone who has people to appraise (as their manager) or supervise gets the team side of performance, whatever their role is called.
// The reporting lines an administrator sets are what decide this.
export async function isAppraiser(userId: string): Promise<boolean> {
  const r = await db.select({ id: users.id }).from(users)
    .where(and(or(eq(users.managerId, userId), eq(users.supervisorId, userId)), eq(users.isActive, true), sql`${users.isArchived} IS NOT TRUE`)).limit(1);
  return r.length > 0;
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
  if (!(opts.all && isAdminActor(actor))) conds.push(or(eq(appraisals.managerId, actor.id), eq(appraisals.supervisorId, actor.id))!);
  const rows = await db.select({ a: appraisals, c: performanceCycles, u: users }).from(appraisals)
    .innerJoin(performanceCycles, eq(appraisals.cycleId, performanceCycles.id))
    .innerJoin(users, eq(appraisals.userId, users.id))
    .where(and(...conds)).orderBy(desc(performanceCycles.year), asc(users.lastName));
  const roleIds = Array.from(new Set(rows.map(r => r.u.jobRoleId).filter((x): x is string => !!x)));
  const roleRows = roleIds.length ? await db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles).where(inArray(jobRoles.id, roleIds)) : [];
  const roleName = new Map(roleRows.map(r => [r.id, r.name]));
  return rows.map(r => ({
    id: r.a.id, userId: r.u.id, employeeName: fullName(r.u), jobRole: r.u.jobRoleId ? roleName.get(r.u.jobRoleId) ?? null : null,
    relationship: r.a.managerId === actor.id ? "manager" : r.a.supervisorId === actor.id ? "supervisor" : "administrator",
    status: r.a.status, cycleId: r.c.id, cycleName: r.c.name, year: r.c.year,
    selfSubmitted: !!r.a.selfSubmittedAt, managerSubmitted: !!r.a.managerSubmittedAt, shared: !!r.a.sharedAt,
    // the date the current stage is due, for the "Next due" column
    dueDate: (r.a.status === "objectives" ? r.a.objectivesDueDate ?? r.c.objectiveDeadline
      : r.a.status === "self_review" ? r.a.selfReviewDueDate ?? r.c.selfReviewDeadline
      : r.a.status === "manager_review" ? r.a.managerReviewDueDate ?? r.c.managerReviewDeadline : null) ?? null,
    // only people who can see ratings (admins, or the manager) reach this list, and the score snapshot is theirs to see
    // the score snapshot (which includes the 360) is for the line manager and HR; a supervisor does not get it
    scores: r.a.managerId === actor.id || isAdminActor(actor) ? (r.a.scores ?? null) : null,
  }));
}

// ---------------------------------------------------------------- detail

export async function getAppraisalDetail(id: string, actor: Actor) {
  const { appraisal, access, cycle } = await loadContext(id, actor);
  const [employee, manager, supervisor] = await Promise.all([
    db.select().from(users).where(eq(users.id, appraisal.userId)),
    appraisal.managerId ? db.select().from(users).where(eq(users.id, appraisal.managerId)) : Promise.resolve([]),
    appraisal.supervisorId ? db.select().from(users).where(eq(users.id, appraisal.supervisorId)) : Promise.resolve([]),
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
  // a supervisor contributes to the review but does not see the ratings snapshot, the potential rating or calibration notes
  if (access.isSupervisor && !access.isAdmin) { delete view.potentialRating; delete view.calibrationNote; delete view.scores; }

  const feedback = cycle.includes360 ? await getFeedbackView(id, appraisal, access, cycle) : null;

  return {
    appraisal: view, cycle,
    employee: employee[0] ? { id: employee[0].id, name: fullName(employee[0]), jobRole: role } : null,
    manager: manager[0] ? { id: manager[0].id, name: fullName(manager[0]) } : null,
    supervisor: supervisor[0] ? { id: supervisor[0].id, name: fullName(supervisor[0]) } : null,
    comments: await listComments(appraisal, access, actor.id),
    objectives: objectives.map(o => (hideManagerSide ? { ...o, managerOutcome: null, managerComment: null } : o)).map(o => ({ ...o, updates: updates.filter(u => u.objectiveId === o.id) })),
    behaviours: frameworks.map(b => {
      const r = ratings.find(x => x.behaviourId === b.id);
      return { behaviour: b, selfRating: r?.selfRating ?? null, selfComment: r?.selfComment ?? null, managerRating: hideManagerSide ? null : r?.managerRating ?? null, managerComment: hideManagerSide ? null : r?.managerComment ?? null };
    }),
    feedback,
    permissions: {
      isEmployee: access.isEmployee, isManager: access.isManager, isSupervisor: access.isSupervisor, isAdmin: access.isAdmin,
      canComment: appraisal.status !== "signed_off" && cycle.status !== "closed",
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

// The 360 as the line manager and HR see it (the person and a supervisor see only the requests and the count). Nothing identifies a rater, and results are held
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

  // The 360 results are for the line manager and HR (administrators) only. The person being reviewed and a supervisor do not see them, even after
  // the report is shared; they can still see who has been asked and how many have answered.
  const resultsVisible = access.isManager || access.isAdmin;
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

// A plain directory (name and job title only) for the pickers. Administrators and anyone who appraises or supervises people see
// everyone. Everybody else sees only the people they could reasonably nominate or work with: their own manager and supervisor, colleagues
// under the same manager or supervisor, and colleagues at the same location. It is never an open list of the whole company.
export async function listPeople(actor: Actor) {
  const conds = [eq(users.isActive, true), sql`${users.isArchived} IS NOT TRUE`];
  // only administrators are offered everyone; a manager is offered their own people (at any depth), their own manager and peers, and the people at their site
  if (!isAdminActor(actor)) {
    const me = (await db.select().from(users).where(eq(users.id, actor.id)))[0];
    const scope = [eq(users.id, actor.id)];
    const reach = await accessiblePersonIds(actor.id, actor.roles);
    if (reach && reach.size) scope.push(inArray(users.id, Array.from(reach)));
    if (me?.managerId) scope.push(eq(users.id, me.managerId), eq(users.managerId, me.managerId));
    if (me?.supervisorId) scope.push(eq(users.id, me.supervisorId), eq(users.supervisorId, me.supervisorId));
    if (me?.locationId) scope.push(eq(users.locationId, me.locationId)); else if (me?.location) scope.push(eq(users.location, me.location));
    conds.push(or(...scope)!);
  }
  const rows = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, jobRoleId: users.jobRoleId })
    .from(users).where(and(...conds)).orderBy(asc(users.lastName), asc(users.firstName));
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
    userId: person.id, cycleId: cycle.id, managerId: reviewerId, supervisorId: person.supervisorId && person.supervisorId !== reviewerId ? person.supervisorId : null,
    status: "objectives", initiatedBy: actor.id,
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

// ---------------------------------------------------------------- comments

type CommentRole = "employee" | "manager" | "supervisor" | "admin";

// What the person sees: their own comments straight away, and everyone else's only once the report has been shared.
// Managers, supervisors and HR see the whole conversation.
async function listComments(appraisal: Appraisal, access: AppraisalAccess, actorId: string) {
  const rows = await db.select().from(appraisalComments).where(eq(appraisalComments.appraisalId, appraisal.id)).orderBy(asc(appraisalComments.createdAt));
  const employeeOnly = access.isEmployee && !access.isManager && !access.isSupervisor && !access.isAdmin;
  const visible = rows.filter(r => !employeeOnly || r.authorRole === "employee" || !!appraisal.sharedAt);
  if (!visible.length) return [];
  const authors = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(inArray(users.id, Array.from(new Set(visible.map(r => r.authorId)))));
  const name = new Map(authors.map(a => [a.id, fullName(a)]));
  return visible.map(r => ({ id: r.id, authorId: r.authorId, authorName: name.get(r.authorId) ?? "Unknown", authorRole: r.authorRole as CommentRole, body: r.body, createdAt: r.createdAt, mine: r.authorId === actorId }));
}

export async function addComment(appraisalId: string, actor: Actor, body: unknown) {
  const { appraisal, access, cycle } = await loadContext(appraisalId, actor);
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) throw bad("Write a comment first");
  if (text.length > 2000) throw bad("Please keep a comment to 2000 characters");
  if (appraisal.status === "signed_off" || cycle.status === "closed") throw bad("This review is complete, so no more comments can be added");
  const role: CommentRole = access.isEmployee ? "employee" : access.isManager ? "manager" : access.isSupervisor ? "supervisor" : "admin";
  const row = (await db.insert(appraisalComments).values({ appraisalId, authorId: actor.id, authorRole: role, body: text }).returning())[0];
  // Who hears about it: the person's own comments go to their manager and supervisor. A manager's, supervisor's or HR's comment goes to the
  // person only once it is visible to them (the report has been shared), and always to the rest of the team.
  const team = [appraisal.managerId, appraisal.supervisorId].filter((x): x is string => !!x);
  const recipients = role === "employee" ? team : appraisal.sharedAt ? [appraisal.userId, ...team] : team;
  await notify.comment(appraisal, actor.id, recipients, text);
  return { id: row.id, role };
}

// ---------------------------------------------------------------- reporting lines

// An administrator decides who appraises whom. The manager rates, holds the discussion and signs off; the supervisor (optional) sees the
// review and adds comments. Both are set here, one person or many at a time.
export async function listReportingLines(actor: Actor) {
  if (!isAdminActor(actor)) throw forbid("Only an administrator can see reporting lines");
  const rows = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, role: users.role, jobRoleId: users.jobRoleId, location: users.location, department: users.department, managerId: users.managerId, supervisorId: users.supervisorId })
    .from(users).where(and(eq(users.isActive, true), sql`${users.isArchived} IS NOT TRUE`)).orderBy(asc(users.lastName), asc(users.firstName));
  const roleIds = Array.from(new Set(rows.map(r => r.jobRoleId).filter((x): x is string => !!x)));
  const roleRows = roleIds.length ? await db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles).where(inArray(jobRoles.id, roleIds)) : [];
  const roleName = new Map(roleRows.map(r => [r.id, r.name]));
  const name = new Map(rows.map(r => [r.id, fullName(r)]));
  const manages = new Map<string, number>(), supervises = new Map<string, number>();
  for (const r of rows) {
    if (r.managerId) manages.set(r.managerId, (manages.get(r.managerId) ?? 0) + 1);
    if (r.supervisorId) supervises.set(r.supervisorId, (supervises.get(r.supervisorId) ?? 0) + 1);
  }
  return rows.map(r => ({
    id: r.id, name: fullName(r), role: r.role, jobRole: r.jobRoleId ? roleName.get(r.jobRoleId) ?? null : null, location: r.location ?? null, department: r.department ?? null,
    managerId: r.managerId, managerName: r.managerId ? name.get(r.managerId) ?? "Unknown (inactive)" : null,
    supervisorId: r.supervisorId, supervisorName: r.supervisorId ? name.get(r.supervisorId) ?? "Unknown (inactive)" : null,
    manages: manages.get(r.id) ?? 0, supervises: supervises.get(r.id) ?? 0,
  }));
}

// Keeps reviews that are still in progress with whoever is now the manager or supervisor. A signed-off review is history and is never moved.
// Clearing a manager leaves the open reviews with the last manager rather than leaving them with nobody.
export async function repointOpenAppraisals(userId: string, lines: { managerId?: string | null; supervisorId?: string | null }) {
  const set: Record<string, unknown> = {};
  if (lines.managerId) set.managerId = lines.managerId;
  if ("supervisorId" in lines) set.supervisorId = lines.supervisorId ?? null;
  if (!Object.keys(set).length) return 0;
  const rows = await db.update(appraisals).set({ ...set, updatedAt: new Date() })
    .where(and(eq(appraisals.userId, userId), eq(appraisals.isActive, true), ne(appraisals.status, "signed_off"),
      sql`${appraisals.cycleId} IN (SELECT id FROM performance_cycles WHERE status <> 'closed')`)).returning({ id: appraisals.id });
  return rows.length;
}

export async function setReportingLine(actor: Actor, data: { userId: string; managerId?: string | null; supervisorId?: string | null }) {
  if (!isAdminActor(actor)) throw forbid("Only an administrator can change who appraises whom");
  const person = (await db.select().from(users).where(eq(users.id, data.userId)))[0];
  if (!person || !person.isActive || person.isArchived) throw missing("That person was not found");
  const setManager = "managerId" in data, setSupervisor = "supervisorId" in data;
  if (!setManager && !setSupervisor) throw bad("Choose a manager or a supervisor to set");
  const managerId = setManager ? (data.managerId || null) : person.managerId;
  const supervisorId = setSupervisor ? (data.supervisorId || null) : person.supervisorId;
  const need = async (id: string, what: string) => {
    if (id === person.id) throw bad(`${fullName(person)} cannot be their own ${what}`);
    const u = (await db.select().from(users).where(eq(users.id, id)))[0];
    if (!u || !u.isActive || u.isArchived) throw bad(`The chosen ${what} was not found or has left`);
    return u;
  };
  if (setManager && managerId) {
    const m = await need(managerId, "manager");
    // walk up from the new manager: reaching this person would make a loop (A reports to B who reports to A)
    let up: string | null = m.managerId, steps = 0;
    if (m.id === person.id) throw bad("A person cannot report to themselves");
    while (up && steps++ < 50) {
      if (up === person.id) throw bad(`That would make a loop: ${fullName(m)} already reports, directly or through others, to ${fullName(person)}`);
      up = (await db.select({ m: users.managerId }).from(users).where(eq(users.id, up)))[0]?.m ?? null;
    }
  }
  if (setSupervisor && supervisorId) await need(supervisorId, "supervisor");
  if (managerId && supervisorId && managerId === supervisorId) throw bad("The manager and the supervisor need to be different people");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (setManager) patch.managerId = managerId;
  if (setSupervisor) patch.supervisorId = supervisorId;
  await db.update(users).set(patch).where(eq(users.id, person.id));
  const appraisalsUpdated = await repointOpenAppraisals(person.id, { ...(setManager ? { managerId } : {}), ...(setSupervisor ? { supervisorId } : {}) });

  const managerChanged = setManager && managerId !== person.managerId, supervisorChanged = setSupervisor && supervisorId !== person.supervisorId;
  if (managerChanged && managerId) await notify.appraiserAssigned(managerId, person, "manager");
  if (supervisorChanged && supervisorId) await notify.appraiserAssigned(supervisorId, person, "supervisor");
  return { userId: person.id, managerId, supervisorId, managerChanged, supervisorChanged, appraisalsUpdated };
}

export async function setReportingLinesBulk(actor: Actor, data: { userIds: string[]; managerId?: string | null; supervisorId?: string | null }) {
  if (!isAdminActor(actor)) throw forbid("Only an administrator can change who appraises whom");
  const ids = Array.from(new Set(Array.isArray(data.userIds) ? data.userIds : []));
  if (!ids.length) throw bad("Choose at least one person");
  if (ids.length > 500) throw bad("Change up to 500 people at a time");
  const lines: { managerId?: string | null; supervisorId?: string | null } = {};
  if ("managerId" in data) lines.managerId = data.managerId || null;
  if ("supervisorId" in data) lines.supervisorId = data.supervisorId || null;
  if (!("managerId" in lines) && !("supervisorId" in lines)) throw bad("Choose a manager or a supervisor to set");
  const failed: Array<{ userId: string; error: string }> = [];
  let updated = 0, appraisalsUpdated = 0;
  for (const userId of ids) {
    try { const r = await setReportingLine(actor, { userId, ...lines }); updated++; appraisalsUpdated += r.appraisalsUpdated; }
    catch (e: any) { failed.push({ userId, error: e?.message ?? "Could not change this person" }); }
  }
  return { updated, appraisalsUpdated, failed };
}

// ---------------------------------------------------------------- completion across the company

const STAGE_LABEL: Record<string, string> = {
  no_appraiser: "No appraiser set", not_started: "Not started", objectives: "Objectives", self_review: "Self assessment", manager_review: "Manager review",
  calibration: "Calibration", meeting: "Discussion and sign-off", signed_off: "Complete",
};

// Every active person against one review period: who has not started, who is where, who is overdue, and who has nobody set to appraise them.
// This is the administrator's "check on completion" view, and the same figures feed the summary at the top of the screen.
export async function completionOverview(actor: Actor, cycleId?: string) {
  if (!isAdminActor(actor)) throw forbid("Only an administrator can see completion across the company");
  const cycles = await db.select().from(performanceCycles).where(eq(performanceCycles.isActive, true)).orderBy(desc(performanceCycles.year), desc(performanceCycles.startDate), desc(performanceCycles.createdAt));
  const cycle = cycleId ? cycles.find(c => c.id === cycleId) : (cycles.find(c => c.status === "open") ?? cycles[0]);
  const cycleList = cycles.map(c => ({ id: c.id, name: c.name, year: c.year, status: c.status, periodType: c.periodType }));
  if (!cycle) return { cycle: null, cycles: cycleList, summary: null, rows: [], managers: [] };

  const people = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, jobRoleId: users.jobRoleId, location: users.location, managerId: users.managerId, supervisorId: users.supervisorId })
    .from(users).where(and(eq(users.isActive, true), sql`${users.isArchived} IS NOT TRUE`)).orderBy(asc(users.lastName), asc(users.firstName));
  const apps = await db.select().from(appraisals).where(and(eq(appraisals.cycleId, cycle.id), eq(appraisals.isActive, true)));
  const byUser = new Map(apps.map(a => [a.userId, a]));
  const roleIds = Array.from(new Set(people.map(r => r.jobRoleId).filter((x): x is string => !!x)));
  const roleRows = roleIds.length ? await db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles).where(inArray(jobRoles.id, roleIds)) : [];
  const roleName = new Map(roleRows.map(r => [r.id, r.name]));
  const nameOf = new Map<string, string>();
  const allNamed = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users);
  for (const u of allNamed) nameOf.set(u.id, fullName(u));

  const now = Date.now();
  const waiting: Record<string, string> = { not_started: "Manager", objectives: "Employee and manager", self_review: "Employee", manager_review: "Manager", calibration: "HR", signed_off: "", no_appraiser: "Administrator" };
  const rows = people.map(p => {
    const a = byUser.get(p.id);
    const managerId = a?.managerId ?? p.managerId ?? null;
    const stage = a ? a.status : managerId ? "not_started" : "no_appraiser";
    const supervisorId = a?.supervisorId ?? p.supervisorId ?? null;
    const due = !a ? null : (a.status === "objectives" ? a.objectivesDueDate ?? cycle.objectiveDeadline
      : a.status === "self_review" ? a.selfReviewDueDate ?? cycle.selfReviewDeadline
      : a.status === "manager_review" ? a.managerReviewDueDate ?? cycle.managerReviewDeadline : null);
    const overdue = !!due && stage !== "signed_off" && new Date(due).getTime() < now && cycle.status === "open";
    return {
      userId: p.id, name: fullName(p), jobRole: p.jobRoleId ? roleName.get(p.jobRoleId) ?? null : null, location: p.location ?? null,
      managerId, managerName: managerId ? nameOf.get(managerId) ?? "Unknown" : null, supervisorId, supervisorName: supervisorId ? nameOf.get(supervisorId) ?? "Unknown" : null,
      appraisalId: a?.id ?? null, stage, stageLabel: STAGE_LABEL[stage] ?? stage,
      waitingOn: stage === "meeting" ? (a?.sharedAt ? "Employee and manager" : "Manager") : waiting[stage] ?? "",
      selfSubmitted: !!a?.selfSubmittedAt, managerSubmitted: !!a?.managerSubmittedAt, shared: !!a?.sharedAt,
      dueDate: due ? new Date(due).toISOString() : null, overdue,
    };
  });

  const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
  const stages = ["no_appraiser", "not_started", "objectives", "self_review", "manager_review", "calibration", "meeting", "signed_off"];
  const byStage = Object.fromEntries(stages.map(s => [s, count(r => r.stage === s)]));
  const total = rows.length, complete = byStage.signed_off;
  const summary = {
    total, byStage, complete, completePct: total ? Math.round((complete / total) * 1000) / 10 : 0,
    overdue: count(r => r.overdue), noAppraiser: byStage.no_appraiser, notStarted: byStage.not_started,
    inProgress: total - complete - byStage.no_appraiser - byStage.not_started,
  };

  const mgr = new Map<string, { managerId: string; name: string; people: number; complete: number; overdue: number; notStarted: number }>();
  for (const r of rows) {
    if (!r.managerId) continue;
    const m = mgr.get(r.managerId) ?? { managerId: r.managerId, name: r.managerName ?? "Unknown", people: 0, complete: 0, overdue: 0, notStarted: 0 };
    m.people++; if (r.stage === "signed_off") m.complete++; if (r.overdue) m.overdue++; if (r.stage === "not_started") m.notStarted++;
    mgr.set(r.managerId, m);
  }
  const managers = Array.from(mgr.values()).sort((a, b) => b.overdue - a.overdue || (b.people - b.complete) - (a.people - a.complete) || a.name.localeCompare(b.name));
  return { cycle: { id: cycle.id, name: cycle.name, year: cycle.year, status: cycle.status, periodType: cycle.periodType }, cycles: cycleList, summary, rows, managers };
}

// ---------------------------------------------------------------- scheduling the year

export const PERIOD_TYPES = ["annual", "mid_year", "year_end", "q1", "q2", "q3", "q4", "custom"] as const;
export const SCHEDULE_PATTERNS = ["annual", "half_year", "quarterly"] as const;
export type SchedulePattern = typeof SCHEDULE_PATTERNS[number];

const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 9, 0, 0));

// The review periods for a year, with sensible dates. They are only a starting point: each can be edited afterwards.
// The first period of a year starts at the objectives; later ones carry the agreed objectives forward and open at the self assessment,
// near the end of the period they cover.
export function buildSchedule(year: number, pattern: SchedulePattern) {
  const mk = (name: string, periodType: string, start: Date, end: Date, opensOn: Date, selfOpens: Date | null, obj: Date | null, self: Date, mgr: Date, carry: boolean, c360: boolean) => ({
    name: `${year} ${name}`, year, periodType, startDate: start, endDate: end, opensOn, selfReviewOpensOn: selfOpens, objectiveDeadline: obj, selfReviewDeadline: self, managerReviewDeadline: mgr,
    carryForward: carry, includes360: c360,
  });
  if (pattern === "annual") return [mk("Annual Review", "annual", at(year, 1, 1), at(year, 12, 31), at(year, 1, 1), at(year, 11, 15), at(year, 1, 31), at(year, 12, 10), at(year, 12, 22), false, true)];
  if (pattern === "half_year") return [
    mk("Mid-year Review", "mid_year", at(year, 1, 1), at(year, 6, 30), at(year, 1, 1), at(year, 6, 1), at(year, 1, 31), at(year, 6, 15), at(year, 6, 30), false, false),
    mk("Year-end Review", "year_end", at(year, 7, 1), at(year, 12, 31), at(year, 12, 1), null, null, at(year, 12, 12), at(year, 12, 22), true, true),
  ];
  return [
    mk("Q1 Review", "q1", at(year, 1, 1), at(year, 3, 31), at(year, 1, 1), at(year, 3, 10), at(year, 1, 31), at(year, 3, 20), at(year, 3, 31), false, false),
    mk("Q2 Review", "q2", at(year, 4, 1), at(year, 6, 30), at(year, 6, 10), null, null, at(year, 6, 20), at(year, 6, 30), true, false),
    mk("Q3 Review", "q3", at(year, 7, 1), at(year, 9, 30), at(year, 9, 10), null, null, at(year, 9, 20), at(year, 9, 30), true, false),
    mk("Q4 Review", "q4", at(year, 10, 1), at(year, 12, 31), at(year, 12, 1), null, null, at(year, 12, 12), at(year, 12, 22), true, true),
  ];
}

function cleanSchedule(year: unknown, pattern: unknown) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw bad("Enter a valid year");
  if (!SCHEDULE_PATTERNS.includes(pattern as SchedulePattern)) throw bad("Choose annual, mid-year and year-end, or quarterly");
  return { y, p: pattern as SchedulePattern };
}

export function previewSchedule(year: unknown, pattern: unknown) {
  const { y, p } = cleanSchedule(year, pattern);
  return buildSchedule(y, p);
}

// Creates the periods as drafts. A period that already exists for that year and type is left alone, so running it twice does no harm.
export async function createSchedule(year: unknown, pattern: unknown, autoLaunch: boolean) {
  const { y, p } = cleanSchedule(year, pattern);
  const existing = await db.select({ periodType: performanceCycles.periodType }).from(performanceCycles).where(and(eq(performanceCycles.year, y), eq(performanceCycles.isActive, true)));
  const have = new Set(existing.map(e => e.periodType));
  const created: Array<typeof performanceCycles.$inferSelect> = [], skipped: string[] = [];
  for (const d of buildSchedule(y, p)) {
    if (have.has(d.periodType)) { skipped.push(d.name); continue; }
    created.push((await db.insert(performanceCycles).values({ ...d, status: "draft", ratingScale: 5, requiresCalibration: false, autoLaunch: !!autoLaunch }).returning())[0]);
  }
  return { created, skipped };
}

// Runs once a day (and on start-up). It opens any period whose date has come, creating a review for everyone who has an appraiser, and
// moves people whose objectives are agreed on to their self assessment when that date comes. It only ever moves things forward, so
// running it again changes nothing that has already happened.
export async function runCycleSchedule(now = new Date()) {
  const out = { launched: [] as Array<{ name: string; created: number; skippedNoManager: number; carriedForward: number }>, selfReviewsOpened: 0 };
  const due = await db.select().from(performanceCycles).where(and(eq(performanceCycles.isActive, true), eq(performanceCycles.status, "draft"), eq(performanceCycles.autoLaunch, true), lte(performanceCycles.opensOn, now)));
  for (const c of due) {
    if (c.endDate && new Date(c.endDate).getTime() < now.getTime()) continue; // a period that is already over is left for an administrator to decide
    const r = await launchCycle(c.id, null, "everyone", "scheduler");
    await notify.periodSummary(c.name, r.created, r.skippedNoManager);
    out.launched.push({ name: c.name, created: r.created, skippedNoManager: r.skippedNoManager, carriedForward: r.carriedForward ?? 0 });
  }
  const opening = await db.select().from(performanceCycles).where(and(eq(performanceCycles.isActive, true), eq(performanceCycles.status, "open"), eq(performanceCycles.carryForward, false), lte(performanceCycles.selfReviewOpensOn, now)));
  for (const c of opening) {
    const ready = await db.select({ a: appraisals }).from(appraisals).where(and(eq(appraisals.cycleId, c.id), eq(appraisals.isActive, true), eq(appraisals.status, "objectives"),
      sql`EXISTS (SELECT 1 FROM performance_objectives o WHERE o.appraisal_id = ${appraisals.id} AND o.is_active)`,
      sql`NOT EXISTS (SELECT 1 FROM performance_objectives o WHERE o.appraisal_id = ${appraisals.id} AND o.is_active AND o.status = 'draft')`));
    for (const { a } of ready) {
      await db.update(appraisals).set({ status: "self_review", updatedAt: new Date() }).where(eq(appraisals.id, a.id));
      await notify.selfReviewOpened(a, a.selfReviewDueDate ?? c.selfReviewDeadline);
      out.selfReviewsOpened++;
    }
  }
  return out;
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
