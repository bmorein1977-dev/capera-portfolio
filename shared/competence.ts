// The one definition of whether a person is competent for a requirement, and until when. Every screen, report, check and reminder must use
// this, so that they cannot disagree.
//
// - A requirement can have several assessment rows for one person (the original, a planned reassessment, a renewal). The one that counts is the
//   latest DECISION. An unfinished row (an assignment or a planned reassessment) never hides a decision that has already been made.
// - A competent decision (including "competent with minor needs") is valid until its expiry date. If no date was saved, it is worked out from
//   the date of the decision and the validity period, so older records are never treated as valid for ever.
// - "Valid" includes items due to expire soon. The expiring bands are shown separately but still count as in date.

export const COMPETENT_OUTCOMES = ["competent", "competent_with_minor_needs"] as const;
export const EXEMPT_OUTCOMES = ["not_required", "in_training"] as const;
export const DEFAULT_VALIDITY_MONTHS = 48;

export type CompetenceStatus = "current" | "expiring_30" | "expiring_60" | "expiring_90" | "expired" | "missing";

export interface ElementValidity { validityMonths?: number | null; validityPeriod?: number | null; reassessmentYears?: number | null }
export interface RoleValidity { validityYears?: number | null }
export interface AssessmentLike {
  outcome: string; isAssignment?: boolean | null; isActive?: boolean | null;
  signOffAt?: Date | string | null; assessmentDate?: Date | string | null; expiryDate?: Date | string | null;
  createdAt?: Date | string | null; updatedAt?: Date | string | null;
  exemptionReason?: string | null; exemptionUntil?: Date | string | null;
}

const time = (v: Date | string | null | undefined) => (v ? new Date(v).getTime() : 0);

/** adds calendar months, keeping to the end of a shorter month (31 January + 1 month is the end of February) */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * how long a decision lasts, in months: the job role's own period wins, then the standard's months, then its years, then four years.
 * null means it does not lapse, which a standard says by setting its reassessment period to zero.
 */
export function validityMonthsFor(element?: ElementValidity | null, role?: RoleValidity | null): number | null {
  if (role?.validityYears) return role.validityYears * 12;
  if (element?.validityMonths) return element.validityMonths;
  if (element?.validityPeriod) return element.validityPeriod;
  if (element?.reassessmentYears) return element.reassessmentYears * 12;
  return element?.reassessmentYears === 0 ? null : DEFAULT_VALIDITY_MONTHS;
}

export const isCompetentDecision = (a: AssessmentLike | null | undefined): boolean =>
  !!a && a.isActive !== false && !a.isAssignment && (COMPETENT_OUTCOMES as readonly string[]).includes(a.outcome);

/** a row on which an assessor or an import has actually recorded a result */
export const isDecision = (a: AssessmentLike): boolean =>
  a.isActive !== false && !a.isAssignment && !(EXEMPT_OUTCOMES as readonly string[]).includes(a.outcome) &&
  ((COMPETENT_OUTCOMES as readonly string[]).includes(a.outcome) || !!a.signOffAt || a.outcome === "not_yet_competent" || a.outcome === "training_needs");

export const decisionTime = (a: AssessmentLike): number => time(a.signOffAt) || time(a.assessmentDate) || time(a.createdAt);

/** the date a competent decision runs out: the saved date, or one worked out from the decision date. null when it is not a competent decision. */
export function effectiveExpiry(a: AssessmentLike | null | undefined, element?: ElementValidity | null, role?: RoleValidity | null): Date | null {
  if (!isCompetentDecision(a)) return null;
  if (a!.expiryDate) return new Date(a!.expiryDate);
  const base = a!.signOffAt ?? a!.assessmentDate ?? a!.createdAt;
  const months = validityMonthsFor(element, role);
  return base && months ? addMonths(new Date(base), months) : null;
}

export const daysUntil = (expiry: Date, now: Date) => Math.floor((expiry.getTime() - now.getTime()) / 86_400_000);

export function statusFromExpiry(expiry: Date | null, now: Date): Exclude<CompetenceStatus, "missing"> {
  if (!expiry) return "current";
  if (expiry.getTime() <= now.getTime()) return "expired";
  const days = daysUntil(expiry, now);
  if (days <= 30) return "expiring_30";
  if (days <= 60) return "expiring_60";
  if (days <= 90) return "expiring_90";
  return "current";
}

export const isValidStatus = (s: string) => s === "current" || s === "expiring_30" || s === "expiring_60" || s === "expiring_90";

export function isExemptRow(a: AssessmentLike | null | undefined, now: Date): boolean {
  if (!a || !(EXEMPT_OUTCOMES as readonly string[]).includes(a.outcome)) return false;
  return !a.exemptionUntil || new Date(a.exemptionUntil).getTime() > now.getTime();
}

/**
 * From all of one person's rows for one requirement, the row that says where they stand.
 * A current exemption (set on the most recently changed row) wins; otherwise the latest decision; otherwise the latest unfinished row.
 */
export function governingRow<T extends AssessmentLike>(rows: T[], now: Date = new Date()): T | undefined {
  const live = rows.filter((r) => r.isActive !== false);
  if (!live.length) return undefined;
  const changed = [...live].sort((a, b) => time(b.updatedAt) - time(a.updatedAt) || time(b.createdAt) - time(a.createdAt));
  if (isExemptRow(changed[0], now)) return changed[0];
  const decisions = live.filter(isDecision).sort((a, b) => decisionTime(b) - decisionTime(a) || time(b.updatedAt) - time(a.updatedAt));
  return decisions[0] ?? changed[0];
}

export interface Standing<T> { row: T | undefined; status: CompetenceStatus; expiry: Date | null; daysUntilExpiry?: number; exempt: boolean; expiryCalculated: boolean }

/** where a person stands against one requirement */
export function standingFor<T extends AssessmentLike>(rows: T[], element?: ElementValidity | null, role?: RoleValidity | null, now: Date = new Date()): Standing<T> {
  const row = governingRow(rows, now);
  if (isExemptRow(row, now)) return { row, status: "missing", expiry: null, exempt: true, expiryCalculated: false };
  if (!isCompetentDecision(row)) return { row, status: "missing", expiry: null, exempt: false, expiryCalculated: false };
  const expiry = effectiveExpiry(row, element, role);
  return { row, status: statusFromExpiry(expiry, now), expiry, daysUntilExpiry: expiry ? daysUntil(expiry, now) : undefined, exempt: false, expiryCalculated: !row!.expiryDate && !!expiry };
}

/** when a training completion runs out: the saved date, or one worked out from the course's validity period in months. null means it does not run out. */
export function trainingExpiry(e: { achievementDate?: Date | string | null; expiryDate?: Date | string | null }, course?: { validityPeriod?: number | null } | null): Date | null {
  if (e.expiryDate) return new Date(e.expiryDate);
  return e.achievementDate && course?.validityPeriod ? addMonths(new Date(e.achievementDate), course.validityPeriod) : null;
}

/** one standing per (person, requirement) pair from a flat list of rows */
export function groupByPair<T extends AssessmentLike & { candidateId: string; elementId: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = `${r.candidateId}:${r.elementId}`;
    const list = m.get(k);
    if (list) list.push(r); else m.set(k, [r]);
  }
  return m;
}
