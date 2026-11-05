import { db } from "../db";
import { and, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import {
  users, jobRoles, locations, teams, businessUnits, roleElements, competencyElements, assessments, absences,
  staffingRequirements, staffingShortfallReviews, notificationLogs,
  STAFFING_SCOPE_TYPES, STAFFING_COUNT_BY, STAFFING_DECISIONS,
  type StaffingRequirement, type StaffingShortfallReview, type User,
} from "@shared/schema";
import { computeAssessmentTimeline } from "../storage";
import { notifyUser } from "./performanceNotifications";

// Minimum staffing ("duty to operate"). An administrator states how many people holding a given job role
// must be available at a location, team or business unit, for example 1 Responsible Electrical Person,
// 6 Operations Technicians and 4 Emergency Response Team members. People are counted against each
// requirement live, using the same rules as the compliance reports: a person counts if they hold the role
// (as their primary or secondary job role), currently hold every competence element the role requires,
// and are not on long-term absence. When a minimum is not met a review is opened and the right people are
// told, so there is a recorded decision on whether a risk assessment is needed.

export class StaffingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const bad = (m: string) => new StaffingError(400, m);
const missing = (m: string) => new StaffingError(404, m);

export const STAFFING_SETTING_ID = "staffing-shortfall";
const DAY = 86400000;
const EXPIRING_SOON_DAYS = 60; // someone whose competence runs out within this many days is an early warning
const LEAVING_SOON_DAYS = 90;

export interface CountedPerson {
  userId: string; name: string; jobRole: string | null; source: "primary" | "secondary" | "both";
  counted: boolean; reason: string | null; // why they are not counted
  competent: boolean | null; // null when competence is not being checked
  onAbsence: boolean; expiresInDays: number | null; leavingInDays: number | null; atRisk: boolean;
}
export interface RequirementStatus {
  requirement: StaffingRequirement; roleName: string; scopeName: string;
  required: number; actual: number; shortfall: number; atRiskCount: number;
  status: "met" | "at_risk" | "shortfall";
  competenceDefined: boolean; // false when the role has no competence elements, so everyone counts as competent
  people: CountedPerson[];
  review: StaffingShortfallReview | null; // the unresolved review for this requirement, if any
}

const fullName = (u: { firstName: string | null; lastName: string | null; email: string | null }) =>
  `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "Unknown";

// ---------------------------------------------------------------- scope

async function scopeUsers(req: StaffingRequirement, now: Date): Promise<{ name: string; where: ReturnType<typeof sql> }> {
  if (req.scopeType === "location") {
    const loc = (await db.select().from(locations).where(eq(locations.id, req.scopeId)))[0];
    if (!loc) throw missing("Location not found");
    // users.location is free text and users.locationId is only filled by a backfill, so match either
    return { name: loc.name, where: sql`(${users.locationId} = ${loc.id} OR lower(${users.location}) = lower(${loc.name}))` };
  }
  if (req.scopeType === "team") {
    const team = (await db.select().from(teams).where(eq(teams.id, req.scopeId)))[0];
    if (!team) throw missing("Team not found");
    const loc = team.locationId ? (await db.select().from(locations).where(eq(locations.id, team.locationId)))[0] : undefined;
    const teamMatch = sql`lower(${users.teamShift}) = lower(${team.name})`;
    return {
      name: loc ? `${team.name} (${loc.name})` : team.name,
      where: loc ? sql`(${teamMatch} AND (${users.locationId} = ${loc.id} OR lower(${users.location}) = lower(${loc.name})))` : teamMatch,
    };
  }
  const bu = (await db.select().from(businessUnits).where(eq(businessUnits.id, req.scopeId)))[0];
  if (!bu) throw missing("Business unit not found");
  return { name: bu.name, where: sql`${users.businessUnitId} = ${bu.id}` };
}

export async function scopeName(scopeType: string, scopeId: string): Promise<string | null> {
  const table = scopeType === "location" ? locations : scopeType === "team" ? teams : businessUnits;
  const row = (await db.select({ name: table.name }).from(table).where(eq(table.id, scopeId)))[0];
  return row?.name ?? null;
}

// ---------------------------------------------------------------- evaluation

async function evaluateOne(req: StaffingRequirement, now: Date): Promise<RequirementStatus> {
  const role = (await db.select().from(jobRoles).where(eq(jobRoles.id, req.jobRoleId)))[0];
  const scope = await scopeUsers(req, now);

  const roleMatch = req.countBy === "primary" ? eq(users.jobRoleId, req.jobRoleId)
    : req.countBy === "secondary" ? eq(users.secondaryJobRoleId, req.jobRoleId)
    : or(eq(users.jobRoleId, req.jobRoleId), eq(users.secondaryJobRoleId, req.jobRoleId))!;
  const candidates: User[] = await db.select().from(users).where(and(
    eq(users.isActive, true),
    sql`(${users.isArchived} IS NOT TRUE OR ${users.leftAt} > ${now})`, // leavers stay in scope until their leaving date
    scope.where,
    roleMatch,
  ));
  const ids = candidates.map(c => c.id);

  const absentIds = new Set<string>();
  if (req.excludeAbsent && ids.length) {
    const rows = await db.select().from(absences).where(and(
      inArray(absences.userId, ids), eq(absences.isActive, true), sql`${absences.actualReturnDate} IS NULL`, lte(absences.startDate, now), eq(absences.isFrozen, true),
    ));
    rows.forEach(r => absentIds.add(r.userId));
  }

  // the competence elements the role requires, and each candidate's latest assessment of them
  const required = await db.select({ re: roleElements, el: competencyElements }).from(roleElements)
    .innerJoin(competencyElements, eq(roleElements.elementId, competencyElements.id))
    .where(and(eq(roleElements.roleId, req.jobRoleId), eq(roleElements.isActive, true), eq(roleElements.required, true)));
  const competenceDefined = required.length > 0;
  const latest = new Map<string, typeof assessments.$inferSelect>();
  if (req.onlyCompetent && competenceDefined && ids.length) {
    const rows = await db.select().from(assessments).where(and(
      inArray(assessments.candidateId, ids), inArray(assessments.elementId, required.map(r => r.re.elementId)), eq(assessments.isActive, true),
    ));
    for (const a of rows) {
      const key = `${a.candidateId}:${a.elementId}`;
      const prev = latest.get(key);
      if (!prev || new Date(a.updatedAt || 0).getTime() > new Date(prev.updatedAt || 0).getTime()) latest.set(key, a);
    }
  }

  const people: CountedPerson[] = [];
  for (const u of candidates) {
    const source: CountedPerson["source"] = u.jobRoleId === req.jobRoleId && u.secondaryJobRoleId === req.jobRoleId ? "both"
      : u.jobRoleId === req.jobRoleId ? "primary" : "secondary";
    let competent: boolean | null = null;
    let gaps = 0;
    let soonest: number | null = null;
    if (req.onlyCompetent) {
      competent = true;
      for (const { re, el } of required) {
        const a = latest.get(`${u.id}:${re.elementId}`);
        // time-limited exemptions and "in training" placeholders are skipped, as in the compliance reports
        if (a && (a.outcome === "not_required" || a.outcome === "in_training") && (!a.exemptionUntil || new Date(a.exemptionUntil).getTime() > now.getTime())) continue;
        const real = !!a && !a.isAssignment && ["competent", "competent_with_minor_needs"].includes(a.outcome);
        if (!real) { competent = false; gaps++; continue; }
        const expiry = a!.expiryDate ? new Date(a!.expiryDate)
          : a!.signOffAt ? computeAssessmentTimeline({ signOffAt: a!.signOffAt, validityYears: re.validityYears ?? el.reassessmentYears ?? undefined, validityMonths: el.validityMonths ?? el.validityPeriod ?? undefined }).expiryDate
          : null;
        if (expiry) {
          const days = Math.floor((expiry.getTime() - now.getTime()) / DAY);
          if (days < 0) { competent = false; gaps++; } else if (soonest === null || days < soonest) soonest = days;
        }
      }
    }
    const onAbsence = absentIds.has(u.id);
    const counted = !onAbsence && competent !== false;
    const leavingInDays = u.leftAt && new Date(u.leftAt).getTime() > now.getTime() ? Math.ceil((new Date(u.leftAt).getTime() - now.getTime()) / DAY) : null;
    const atRisk = counted && ((soonest !== null && soonest <= EXPIRING_SOON_DAYS) || (leavingInDays !== null && leavingInDays <= LEAVING_SOON_DAYS));
    people.push({
      userId: u.id, name: fullName(u), jobRole: role?.name ?? null, source, counted,
      reason: onAbsence ? "On long-term absence" : competent === false ? `${gaps} required competence element${gaps === 1 ? "" : "s"} missing or expired` : null,
      competent, onAbsence, expiresInDays: soonest, leavingInDays, atRisk,
    });
  }
  people.sort((a, b) => Number(b.counted) - Number(a.counted) || a.name.localeCompare(b.name));

  const actual = people.filter(p => p.counted).length;
  const atRiskCount = people.filter(p => p.atRisk).length;
  const status: RequirementStatus["status"] = actual < req.minimumCount ? "shortfall" : actual - atRiskCount < req.minimumCount ? "at_risk" : "met";
  const review = (await db.select().from(staffingShortfallReviews)
    .where(and(eq(staffingShortfallReviews.requirementId, req.id), inArray(staffingShortfallReviews.status, ["open", "decided"])))
    .orderBy(desc(staffingShortfallReviews.detectedAt)).limit(1))[0] ?? null;

  return { requirement: req, roleName: role?.name ?? "Unknown role", scopeName: scope.name, required: req.minimumCount, actual, shortfall: Math.max(0, req.minimumCount - actual), atRiskCount, status, competenceDefined, people, review };
}

export async function evaluateAll(now = new Date()): Promise<RequirementStatus[]> {
  const reqs = await db.select().from(staffingRequirements).where(eq(staffingRequirements.isActive, true));
  const out: RequirementStatus[] = [];
  for (const r of reqs) {
    try { out.push(await evaluateOne(r, now)); } catch (e) { if (!(e instanceof StaffingError)) throw e; /* a deleted scope is skipped, not fatal */ }
  }
  const rank = { shortfall: 0, at_risk: 1, met: 2 } as const;
  return out.sort((a, b) => rank[a.status] - rank[b.status] || a.scopeName.localeCompare(b.scopeName) || a.roleName.localeCompare(b.roleName));
}

export async function summary() {
  const all = await evaluateAll();
  return {
    requirements: all.length,
    met: all.filter(s => s.status === "met").length,
    atRisk: all.filter(s => s.status === "at_risk").length,
    shortfall: all.filter(s => s.status === "shortfall").length,
    awaitingDecision: all.filter(s => s.review?.status === "open").length,
  };
}

// ---------------------------------------------------------------- requirements

export interface RequirementInput {
  scopeType: string; scopeId: string; jobRoleId: string; minimumCount: number; countBy?: string;
  onlyCompetent?: boolean; excludeAbsent?: boolean; dutyToOperate?: boolean; legalReference?: string | null; notes?: string | null; notifyUserIds?: string[];
}

async function validate(input: RequirementInput, existingId?: string) {
  if (!(STAFFING_SCOPE_TYPES as readonly string[]).includes(input.scopeType)) throw bad("Choose a location, team or business unit");
  if (!input.scopeId || !(await scopeName(input.scopeType, input.scopeId))) throw bad("That location, team or business unit was not found");
  const role = (await db.select({ id: jobRoles.id, isActive: jobRoles.isActive }).from(jobRoles).where(eq(jobRoles.id, input.jobRoleId)))[0];
  if (!role || role.isActive === false) throw bad("Choose an active job role");
  const min = Number(input.minimumCount);
  if (!Number.isInteger(min) || min < 1 || min > 999) throw bad("The minimum number must be a whole number from 1 to 999");
  const countBy = input.countBy ?? "either";
  if (!(STAFFING_COUNT_BY as readonly string[]).includes(countBy)) throw bad("Choose whether to count primary roles, secondary roles or either");
  const dup = await db.select({ id: staffingRequirements.id }).from(staffingRequirements).where(and(
    eq(staffingRequirements.scopeType, input.scopeType), eq(staffingRequirements.scopeId, input.scopeId), eq(staffingRequirements.jobRoleId, input.jobRoleId), eq(staffingRequirements.isActive, true),
  ));
  if (dup.some(d => d.id !== existingId)) throw bad("There is already a requirement for this role here. Edit that one instead.");
  const notify = (input.notifyUserIds ?? []).filter(Boolean);
  if (notify.length) {
    const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, notify));
    if (found.length !== new Set(notify).size) throw bad("One of the people to notify was not found");
  }
  return { min, countBy, notify };
}

export async function listRequirements() {
  const rows = await db.select().from(staffingRequirements).where(eq(staffingRequirements.isActive, true));
  return rows;
}

export async function createRequirement(input: RequirementInput, actorId: string) {
  const { min, countBy, notify } = await validate(input);
  return (await db.insert(staffingRequirements).values({
    scopeType: input.scopeType, scopeId: input.scopeId, jobRoleId: input.jobRoleId, minimumCount: min, countBy,
    onlyCompetent: input.onlyCompetent ?? true, excludeAbsent: input.excludeAbsent ?? true, dutyToOperate: input.dutyToOperate ?? true,
    legalReference: input.legalReference?.trim() || null, notes: input.notes?.trim() || null, notifyUserIds: notify, createdBy: actorId,
  }).returning())[0];
}

export async function updateRequirement(id: string, input: RequirementInput) {
  const existing = (await db.select().from(staffingRequirements).where(and(eq(staffingRequirements.id, id), eq(staffingRequirements.isActive, true))))[0];
  if (!existing) throw missing("Requirement not found");
  const { min, countBy, notify } = await validate(input, id);
  return (await db.update(staffingRequirements).set({
    scopeType: input.scopeType, scopeId: input.scopeId, jobRoleId: input.jobRoleId, minimumCount: min, countBy,
    onlyCompetent: input.onlyCompetent ?? true, excludeAbsent: input.excludeAbsent ?? true, dutyToOperate: input.dutyToOperate ?? true,
    legalReference: input.legalReference?.trim() || null, notes: input.notes?.trim() || null, notifyUserIds: notify, updatedAt: new Date(),
  }).where(eq(staffingRequirements.id, id)).returning())[0];
}

export async function deleteRequirement(id: string) {
  const rows = await db.update(staffingRequirements).set({ isActive: false, updatedAt: new Date() }).where(and(eq(staffingRequirements.id, id), eq(staffingRequirements.isActive, true))).returning();
  if (!rows.length) throw missing("Requirement not found");
  // a requirement that no longer exists cannot still be short
  await db.update(staffingShortfallReviews).set({ status: "resolved", resolvedAt: new Date() })
    .where(and(eq(staffingShortfallReviews.requirementId, id), inArray(staffingShortfallReviews.status, ["open", "decided"])));
  return { deleted: true };
}

// ---------------------------------------------------------------- reviews and decisions

export async function listReviews(opts: { status?: string; requirementId?: string } = {}) {
  const conds = [] as any[];
  if (opts.status) conds.push(eq(staffingShortfallReviews.status, opts.status));
  if (opts.requirementId) conds.push(eq(staffingShortfallReviews.requirementId, opts.requirementId));
  const rows = await db.select({ r: staffingShortfallReviews, q: staffingRequirements }).from(staffingShortfallReviews)
    .innerJoin(staffingRequirements, eq(staffingShortfallReviews.requirementId, staffingRequirements.id))
    .where(conds.length ? and(...conds) : undefined).orderBy(desc(staffingShortfallReviews.detectedAt)).limit(200);
  const roleIds = Array.from(new Set(rows.map(x => x.q.jobRoleId)));
  const roleRows = roleIds.length ? await db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles).where(inArray(jobRoles.id, roleIds)) : [];
  const roleName = new Map(roleRows.map(r => [r.id, r.name]));
  const deciderIds = Array.from(new Set(rows.map(x => x.r.decidedBy).filter((x): x is string => !!x)));
  const deciders = deciderIds.length ? await db.select().from(users).where(inArray(users.id, deciderIds)) : [];
  const deciderName = new Map(deciders.map(d => [d.id, fullName(d)]));
  const out = [];
  for (const { r, q } of rows) {
    out.push({ ...r, roleName: roleName.get(q.jobRoleId) ?? "Unknown role", scopeName: (await scopeName(q.scopeType, q.scopeId)) ?? "Unknown", dutyToOperate: q.dutyToOperate, legalReference: q.legalReference, decidedByName: r.decidedBy ? deciderName.get(r.decidedBy) ?? null : null });
  }
  return out;
}

export async function decideReview(id: string, actorId: string, data: { decision: string; comment?: string; riskAssessmentRef?: string }) {
  const review = (await db.select().from(staffingShortfallReviews).where(eq(staffingShortfallReviews.id, id)))[0];
  if (!review) throw missing("Review not found");
  if (review.status === "resolved") throw bad("This shortfall has already been resolved");
  if (!(STAFFING_DECISIONS as readonly string[]).includes(data.decision)) throw bad("Choose whether a risk assessment is required");
  const comment = (data.comment ?? "").trim();
  if (comment.length < 5) throw bad("Record the reason for the decision so there is a trail");
  return (await db.update(staffingShortfallReviews).set({
    status: "decided", decision: data.decision, decisionComment: comment, riskAssessmentRef: data.riskAssessmentRef?.trim() || null, decidedBy: actorId, decidedAt: new Date(),
  }).where(eq(staffingShortfallReviews.id, id)).returning())[0];
}

// ---------------------------------------------------------------- the daily check

async function recipientsFor(req: StaffingRequirement): Promise<string[]> {
  if (req.notifyUserIds && req.notifyUserIds.length) return req.notifyUserIds;
  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.isActive, true), inArray(users.role, ["admin", "super_admin"])));
  return admins.map(a => a.id);
}

// Runs once a day (and on demand). Opens a review the first time a minimum is found short, reminds weekly
// while nobody has decided, warns early when a requirement is only just being met, and closes the review
// when the minimum is met again. notification_logs is the dedup ledger, as for the other reminders.
export async function runStaffingChecks(now = new Date()): Promise<{ checked: number; opened: number; resolved: number; notified: number }> {
  const statuses = await evaluateAll(now);
  const logs = await db.select({ metadata: notificationLogs.metadata }).from(notificationLogs).where(eq(notificationLogs.settingId, STAFFING_SETTING_ID));
  const done = new Set(logs.map(l => (l.metadata as any)?.dedupKey).filter(Boolean));
  let opened = 0, resolved = 0, notified = 0;

  const tell = async (s: RequirementStatus, subject: string, lines: string[], dedupKey: string) => {
    if (done.has(dedupKey)) return;
    done.add(dedupKey);
    for (const userId of await recipientsFor(s.requirement)) {
      await notifyUser(userId, subject, lines, { event: "staffing_" + s.status, path: "/duty-to-operate", dedupKey, settingId: STAFFING_SETTING_ID });
      notified++;
    }
  };
  const what = (s: RequirementStatus) => `${s.roleName} at ${s.scopeName}`;
  const legal = (s: RequirementStatus) => s.requirement.dutyToOperate ? ` This is a duty-to-operate requirement${s.requirement.legalReference ? ` (${s.requirement.legalReference})` : ""}.` : "";

  for (const s of statuses) {
    const review = s.review;
    if (s.status === "shortfall") {
      let reviewId = review?.id;
      if (!review) {
        const created = (await db.insert(staffingShortfallReviews).values({ requirementId: s.requirement.id, requiredCount: s.required, actualCount: s.actual }).returning())[0];
        reviewId = created.id; opened++;
      } else {
        await db.update(staffingShortfallReviews).set({ requiredCount: s.required, actualCount: s.actual, lastCheckedAt: now }).where(eq(staffingShortfallReviews.id, review.id));
      }
      const weeksOpen = review ? Math.floor((now.getTime() - new Date(review.detectedAt ?? now).getTime()) / (7 * DAY)) : 0;
      if (!review || review.status === "open") {
        await tell(s, `Minimum staffing not met: ${what(s)}`,
          [`${s.actual} of the ${s.required} required are available (${what(s)}).${legal(s)}`, "Please review it and record whether a risk assessment is needed."],
          `${reviewId}:open:w${weeksOpen}`);
      }
    } else {
      if (review) {
        await db.update(staffingShortfallReviews).set({ status: "resolved", resolvedAt: now, actualCount: s.actual, lastCheckedAt: now }).where(eq(staffingShortfallReviews.id, review.id));
        resolved++;
      }
      if (s.status === "at_risk") {
        const month = now.toISOString().slice(0, 7);
        await tell(s, `Early warning, minimum staffing at risk: ${what(s)}`,
          [`The minimum is currently met (${s.actual} of ${s.required}), but ${s.atRiskCount} of those counted have competence expiring within ${EXPIRING_SOON_DAYS} days or are leaving within ${LEAVING_SOON_DAYS} days.${legal(s)}`],
          `${s.requirement.id}:atrisk:${month}`);
      }
    }
  }
  return { checked: statuses.length, opened, resolved, notified };
}
