import { db } from "../db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  users,
  jobRoles,
  roleElements,
  roleTrainings,
  trainingEnrollments,
  assessments,
  competencyElements,
  userExperience,
  userQualifications,
  appraisals,
  performanceCycles,
  talentScoreSettings,
  QUALIFICATION_LEVEL_POINTS,
  type TalentScoreBreakdown,
  type TalentScoreComponent,
  type TalentScoreKey,
  type TalentScoreSettings,
} from "@shared/schema";

// The Talent Score is a 0-100 number built from five parts: competence, training, experience,
// qualifications and last year's performance review. Every part is scored 0-100 on its own, shown
// with the reason for the number, then combined with the configured weights. A part that is not
// available for a person (for example no review yet) is left out and the remaining weights are
// scaled up, so missing data never counts as a zero. How many parts were available is reported as
// "confidence" so a score built on two parts is not mistaken for one built on five.

export interface ScoreViewer {
  canSeePerformance: boolean;
}

const ACHIEVED_OUTCOMES = ["competent", "competent_with_minor_needs"];
const IN_CHUNK = 2000;

const chunk = <T,>(items: T[], size = IN_CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
const addMonths = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
const yearsBetween = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / (365.25 * 86400000));

export async function getTalentScoreSettings(): Promise<TalentScoreSettings> {
  const rows = await db.select().from(talentScoreSettings).limit(1);
  if (rows.length) return rows[0];
  const created = await db.insert(talentScoreSettings).values({} as any).returning();
  return created[0];
}

const WEIGHT_FIELDS = [
  "weightCompetence", "weightTraining", "weightExperience", "weightQualifications", "weightPerformance",
  "perfWeightObjectives", "perfWeightRating", "perfWeightBehaviours", "feedbackShareOfBehaviours",
] as const;
const INT_FIELDS = ["experienceYearsForFull", "reviewWindowMonths", "minFeedbackRaters", "minComponentsForScore"] as const;
const BOOL_FIELDS = ["includePerformanceInScore"] as const;

export async function updateTalentScoreSettings(patch: Record<string, unknown>, updatedBy: string): Promise<TalentScoreSettings> {
  const current = await getTalentScoreSettings();
  const next: Record<string, unknown> = {};
  for (const key of WEIGHT_FIELDS) {
    if (patch[key] === undefined) continue;
    const v = Number(patch[key]);
    if (!Number.isInteger(v) || v < 0 || v > 100) throw new Error(`${key} must be a whole number from 0 to 100`);
    next[key] = v;
  }
  for (const key of INT_FIELDS) {
    if (patch[key] === undefined) continue;
    const v = Number(patch[key]);
    if (!Number.isInteger(v) || v < 1 || v > 600) throw new Error(`${key} must be a whole number of at least 1`);
    if (key === "minComponentsForScore" && v > 5) throw new Error("minComponentsForScore cannot be more than 5, the number of parts in the score");
    next[key] = v;
  }
  for (const key of BOOL_FIELDS) {
    if (patch[key] !== undefined) next[key] = Boolean(patch[key]);
  }
  const merged: any = { ...current, ...next };
  const total = merged.weightCompetence + merged.weightTraining + merged.weightExperience + merged.weightQualifications + merged.weightPerformance;
  if (total <= 0) throw new Error("At least one weight must be above zero");
  if (merged.perfWeightObjectives + merged.perfWeightRating + merged.perfWeightBehaviours <= 0) throw new Error("At least one performance weight must be above zero");
  const updated = await db.update(talentScoreSettings).set({ ...next, updatedBy, updatedAt: new Date() }).where(eq(talentScoreSettings.id, current.id)).returning();
  return updated[0];
}

// The Talent Score, and the performance part inside it, is an administrator (HR) view only. Performance
// reviews are sensitive personal data, and managers and employees see the review itself instead.
// (The performance_visible_to_managers column is no longer read; it is kept so existing databases still match.)
export function canViewScore(role: string | undefined | null): boolean {
  const r = (role || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  return r === "super_admin" || r === "admin" || r === "developer";
}
export const canViewPerformance = canViewScore;

export async function computeTalentScores(
  userIds: string[],
  viewer: ScoreViewer,
  settingsIn?: TalentScoreSettings,
): Promise<Map<string, TalentScoreBreakdown>> {
  const result = new Map<string, TalentScoreBreakdown>();
  const ids = Array.from(new Set(userIds));
  if (!ids.length) return result;

  const now = new Date();
  const settings = settingsIn ?? await getTalentScoreSettings();

  // ---- load everything in a few batched queries ----
  const userRows: Array<{ id: string; jobRoleId: string | null; yearsOfExperience: number | null }> = [];
  for (const part of chunk(ids)) {
    userRows.push(...await db.select({ id: users.id, jobRoleId: users.jobRoleId, yearsOfExperience: users.yearsOfExperience }).from(users).where(inArray(users.id, part)));
  }
  const roleIds = Array.from(new Set(userRows.map(u => u.jobRoleId).filter((r): r is string => !!r)));
  const [roles, reqEls, reqTrain] = await Promise.all([
    roleIds.length ? db.select({ id: jobRoles.id, jobFamilyId: jobRoles.jobFamilyId }).from(jobRoles).where(inArray(jobRoles.id, roleIds)) : Promise.resolve([]),
    roleIds.length ? db.select().from(roleElements).where(and(inArray(roleElements.roleId, roleIds), eq(roleElements.isActive, true), eq(roleElements.required, true))) : Promise.resolve([]),
    roleIds.length ? db.select().from(roleTrainings).where(and(inArray(roleTrainings.roleId, roleIds), eq(roleTrainings.isActive, true), eq(roleTrainings.required, true))) : Promise.resolve([]),
  ]);

  const assessRows: Array<{ candidateId: string; elementId: string; outcome: string; signOffAt: Date | null; assessmentDate: Date | null; expiryDate: Date | null }> = [];
  const enrolRows: Array<{ userId: string; trainingId: string; expiryDate: Date | null }> = [];
  const expRows: Array<typeof userExperience.$inferSelect> = [];
  const qualRows: Array<typeof userQualifications.$inferSelect> = [];
  const apprRows: Array<{ userId: string; scores: any; cycleName: string; signedAt: Date | null; updatedAt: Date | null }> = [];
  for (const part of chunk(ids)) {
    assessRows.push(...await db.select({
      candidateId: assessments.candidateId, elementId: assessments.elementId, outcome: assessments.outcome,
      signOffAt: assessments.signOffAt, assessmentDate: assessments.assessmentDate, expiryDate: assessments.expiryDate,
    }).from(assessments).where(and(
      inArray(assessments.candidateId, part), eq(assessments.isActive, true),
      sql`${assessments.isAssignment} IS NOT TRUE`, inArray(assessments.outcome, ACHIEVED_OUTCOMES),
    )));
    enrolRows.push(...await db.select({ userId: trainingEnrollments.userId, trainingId: trainingEnrollments.trainingId, expiryDate: trainingEnrollments.expiryDate })
      .from(trainingEnrollments).where(and(inArray(trainingEnrollments.userId, part), eq(trainingEnrollments.isActive, true), eq(trainingEnrollments.status, "completed"))));
    expRows.push(...await db.select().from(userExperience).where(and(inArray(userExperience.userId, part), eq(userExperience.isActive, true))));
    qualRows.push(...await db.select().from(userQualifications).where(and(inArray(userQualifications.userId, part), eq(userQualifications.isActive, true))));
    if (viewer.canSeePerformance && settings.includePerformanceInScore) {
      apprRows.push(...await db.select({
        userId: appraisals.userId, scores: appraisals.scores, cycleName: performanceCycles.name,
        signedAt: appraisals.managerSignedOffAt, updatedAt: appraisals.updatedAt,
      }).from(appraisals).innerJoin(performanceCycles, eq(appraisals.cycleId, performanceCycles.id))
        .where(and(inArray(appraisals.userId, part), eq(appraisals.status, "signed_off"), eq(appraisals.isActive, true)))
        .orderBy(desc(appraisals.managerSignedOffAt)));
    }
  }

  // element validity, to work out whether an achieved standard is still current
  const elementIds = Array.from(new Set(assessRows.map(a => a.elementId)));
  const elementRows = elementIds.length
    ? await db.select({ id: competencyElements.id, validityMonths: competencyElements.validityMonths, reassessmentYears: competencyElements.reassessmentYears })
        .from(competencyElements).where(inArray(competencyElements.id, elementIds))
    : [];
  const validityByElement = new Map(elementRows.map(e => [e.id, e.validityMonths ?? (e.reassessmentYears ? e.reassessmentYears * 12 : 48)]));

  // ---- index ----
  const familyByRole = new Map(roles.map(r => [r.id, r.jobFamilyId]));
  const reqElsByRole = new Map<string, Set<string>>();
  for (const r of reqEls) { if (!reqElsByRole.has(r.roleId)) reqElsByRole.set(r.roleId, new Set()); reqElsByRole.get(r.roleId)!.add(r.elementId); }
  const reqTrainByRole = new Map<string, Array<{ trainingId: string; groupId: string | null }>>();
  for (const r of reqTrain) { if (!reqTrainByRole.has(r.roleId)) reqTrainByRole.set(r.roleId, []); reqTrainByRole.get(r.roleId)!.push({ trainingId: r.trainingId, groupId: r.groupId }); }

  const achievedByUser = new Map<string, Set<string>>();
  for (const a of assessRows) {
    const base = a.signOffAt ?? a.assessmentDate;
    const expiry = a.expiryDate ?? (base ? addMonths(new Date(base), validityByElement.get(a.elementId) ?? 48) : null);
    if (expiry && new Date(expiry).getTime() <= now.getTime()) continue; // lapsed
    if (!achievedByUser.has(a.candidateId)) achievedByUser.set(a.candidateId, new Set());
    achievedByUser.get(a.candidateId)!.add(a.elementId);
  }
  const trainedByUser = new Map<string, Set<string>>();
  for (const e of enrolRows) {
    if (e.expiryDate && new Date(e.expiryDate).getTime() <= now.getTime()) continue;
    if (!trainedByUser.has(e.userId)) trainedByUser.set(e.userId, new Set());
    trainedByUser.get(e.userId)!.add(e.trainingId);
  }
  const expByUser = new Map<string, typeof expRows>();
  for (const e of expRows) { if (!expByUser.has(e.userId)) expByUser.set(e.userId, []); expByUser.get(e.userId)!.push(e); }
  const qualByUser = new Map<string, typeof qualRows>();
  for (const q of qualRows) { if (!qualByUser.has(q.userId)) qualByUser.set(q.userId, []); qualByUser.get(q.userId)!.push(q); }
  const windowStart = addMonths(now, -settings.reviewWindowMonths);
  const apprByUser = new Map<string, (typeof apprRows)[number]>();
  for (const a of apprRows) {
    const when = a.signedAt ?? a.updatedAt;
    if (!when || new Date(when).getTime() < windowStart.getTime()) continue;
    if (!apprByUser.has(a.userId)) apprByUser.set(a.userId, a); // rows are newest first
  }

  const weights: Record<TalentScoreKey, number> = {
    competence: settings.weightCompetence, training: settings.weightTraining, experience: settings.weightExperience,
    qualifications: settings.weightQualifications, performance: settings.weightPerformance,
  };
  const labels: Record<TalentScoreKey, string> = {
    competence: "Competence", training: "Training", experience: "Experience", qualifications: "Qualifications", performance: "Performance review",
  };

  // ---- score each person ----
  for (const u of userRows) {
    const roleId = u.jobRoleId;
    const parts: Record<TalentScoreKey, { score: number | null; detail: string; restricted?: boolean }> = {
      competence: { score: null, detail: "" }, training: { score: null, detail: "" }, experience: { score: null, detail: "" },
      qualifications: { score: null, detail: "" }, performance: { score: null, detail: "" },
    };

    // competence: role-required standards that are held and still current
    const achieved = achievedByUser.get(u.id) ?? new Set<string>();
    const reqE = roleId ? reqElsByRole.get(roleId) : undefined;
    if (reqE && reqE.size > 0) {
      const met = Array.from(reqE).filter(e => achieved.has(e)).length;
      parts.competence = { score: round1(met / reqE.size * 100), detail: `${met} of ${reqE.size} role-required standards held and current` };
    } else if (achieved.size > 0) {
      parts.competence = { score: round1(clamp100(achieved.size * 12.5)), detail: `${achieved.size} standards held and current (no role requirement set)` };
    } else {
      parts.competence.detail = "No role-required standards or achievements recorded";
    }

    // training: required courses completed and current; "any one of" groups count once
    const trained = trainedByUser.get(u.id) ?? new Set<string>();
    const reqT = roleId ? reqTrainByRole.get(roleId) ?? [] : [];
    if (reqT.length > 0) {
      const units = new Map<string, string[]>();
      for (const t of reqT) { const key = t.groupId ?? `t:${t.trainingId}`; if (!units.has(key)) units.set(key, []); units.get(key)!.push(t.trainingId); }
      const met = Array.from(units.values()).filter(members => members.some(m => trained.has(m))).length;
      parts.training = { score: round1(met / units.size * 100), detail: `${met} of ${units.size} required courses completed and current` };
    } else if (trained.size > 0) {
      parts.training = { score: round1(clamp100(trained.size * 10)), detail: `${trained.size} courses completed and current (no role requirement set)` };
    } else {
      parts.training.detail = "No required courses or completions recorded";
    }

    // experience: years in the same kind of work, from the recorded career history
    const history = expByUser.get(u.id) ?? [];
    const family = roleId ? familyByRole.get(roleId) ?? null : null;
    if (history.length > 0) {
      let relevant = 0, total = 0, unclassified = 0;
      for (const p of history) {
        const yrs = yearsBetween(new Date(p.startDate), p.endDate ? new Date(p.endDate) : now);
        total += yrs;
        const sameRole = !!(roleId && p.jobRoleId && p.jobRoleId === roleId);
        const sameFamily = !!(family && p.jobFamilyId && p.jobFamilyId === family);
        if (sameRole || sameFamily) relevant += yrs; else if (!p.jobRoleId && !p.jobFamilyId) unclassified++;
      }
      const note = unclassified > 0 ? `; ${unclassified} position${unclassified > 1 ? "s" : ""} not yet matched to a role family` : "";
      parts.experience = {
        score: round1(clamp100(relevant / settings.experienceYearsForFull * 100)),
        detail: `${relevant.toFixed(1)} years in this kind of work from recorded career history (${total.toFixed(1)} years in total)${note}`,
      };
    } else if (u.yearsOfExperience && u.yearsOfExperience > 0) {
      parts.experience = {
        score: round1(clamp100((u.yearsOfExperience * 0.5) / settings.experienceYearsForFull * 100)),
        detail: `${u.yearsOfExperience} years declared, no career history recorded (counted at half weight)`,
      };
    } else {
      parts.experience.detail = "No career history or years of experience recorded";
    }

    // qualifications: highest level held, plus a little for each additional one
    const quals = (qualByUser.get(u.id) ?? []).filter(q => !q.expiryDate || new Date(q.expiryDate).getTime() > now.getTime());
    if (quals.length > 0) {
      const scored = quals.map(q => ({ q, pts: q.level != null ? (QUALIFICATION_LEVEL_POINTS[q.level] ?? 30) : 30 })).sort((a, b) => b.pts - a.pts);
      const score = clamp100(scored[0].pts + Math.min(15, 5 * (scored.length - 1)));
      const unverified = quals.some(q => !q.verified);
      parts.qualifications = {
        score: round1(score),
        detail: `${quals.length} qualification${quals.length > 1 ? "s" : ""}; highest: ${scored[0].q.name}${scored[0].q.level != null ? ` (level ${scored[0].q.level})` : ""}${unverified ? "; some not yet verified" : ""}`,
      };
    } else {
      parts.qualifications.detail = "No current qualifications recorded";
    }

    // performance: the latest signed-off review inside the window
    let performanceExcludedReason: string | undefined;
    if (!settings.includePerformanceInScore) {
      parts.performance.detail = "Performance reviews are switched off in the score settings";
      performanceExcludedReason = "switched off";
    } else if (!viewer.canSeePerformance) {
      parts.performance = { score: null, detail: "Restricted for your role", restricted: true };
      performanceExcludedReason = "restricted for your role";
    } else {
      const a = apprByUser.get(u.id);
      if (!a || !a.scores) {
        parts.performance.detail = `No signed-off review in the last ${settings.reviewWindowMonths} months`;
      } else {
        const s = a.scores as { objectives: number | null; performance: number | null; behaviours: number | null; feedback360: number | null };
        const behaviours = s.behaviours != null && s.feedback360 != null
          ? (settings.feedbackShareOfBehaviours / 100) * s.feedback360 + (1 - settings.feedbackShareOfBehaviours / 100) * s.behaviours
          : s.behaviours ?? s.feedback360;
        const subs: Array<[number | null, number, string]> = [
          [s.objectives, settings.perfWeightObjectives, `objectives ${s.objectives != null ? Math.round(s.objectives) + "%" : "n/a"}`],
          [s.performance, settings.perfWeightRating, `rating ${s.performance != null ? Math.round(s.performance) + "%" : "n/a"}`],
          [behaviours ?? null, settings.perfWeightBehaviours, `behaviours ${behaviours != null ? Math.round(behaviours) + "%" : "n/a"}${s.feedback360 != null ? " (with 360 feedback)" : ""}`],
        ];
        const usable = subs.filter(([v, w]) => v != null && w > 0);
        if (usable.length === 0) {
          parts.performance.detail = `${a.cycleName}: review has no scored parts`;
        } else {
          const totalW = usable.reduce((sum, [, w]) => sum + w, 0);
          const score = usable.reduce((sum, [v, w]) => sum + (v as number) * w, 0) / totalW;
          parts.performance = { score: round1(score), detail: `${a.cycleName}: ${subs.map(x => x[2]).join(", ")}` };
        }
      }
    }

    // combine the available parts, re-weighting so a missing part never counts as zero
    const components: TalentScoreComponent[] = (Object.keys(parts) as TalentScoreKey[]).map(key => ({
      key, label: labels[key], weight: weights[key], score: parts[key].score, detail: parts[key].detail, restricted: parts[key].restricted,
    }));
    const usable = components.filter(c => c.score != null && c.weight > 0);
    const available = components.filter(c => c.score != null).length;
    const totalWeight = usable.reduce((sum, c) => sum + c.weight, 0);
    let score: number | null = usable.length ? round1(usable.reduce((sum, c) => sum + (c.score as number) * c.weight, 0) / totalWeight) : null;
    let withheldReason: string | undefined;
    if (available < settings.minComponentsForScore) {
      withheldReason = `Not enough information for a fair score: ${available} of 5 parts available, ${settings.minComponentsForScore} needed`;
      score = null;
    }
    result.set(u.id, {
      userId: u.id,
      score,
      confidence: available >= 4 ? "high" : available === 3 ? "medium" : available >= 1 ? "low" : "none",
      componentsAvailable: available,
      components,
      performanceExcludedReason,
      withheldReason,
    });
  }
  return result;
}

export async function computeTalentScore(userId: string, viewer: ScoreViewer): Promise<TalentScoreBreakdown | undefined> {
  return (await computeTalentScores([userId], viewer)).get(userId);
}
