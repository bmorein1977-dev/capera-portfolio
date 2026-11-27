// A competence standard's wording as one document, so that it can be drafted, approved, kept and compared.

export const VERSION_STATUSES = ["draft", "in_review", "approved", "rejected", "superseded", "recorded"] as const;
export type VersionStatus = typeof VERSION_STATUSES[number];
export const VERSION_STATUS_LABEL: Record<VersionStatus, string> = {
  draft: "Draft", in_review: "Waiting for approval", approved: "Approved", rejected: "Sent back", superseded: "Replaced",
  recorded: "Recorded at sign-off",
};

export const ELEMENT_FIELDS = ["name", "code", "description", "safetyCriticality", "validityMonths", "reassessmentYears", "proficiencyScale", "requiresAssessorGuidance", "assessorGuidance", "selfAssessmentEnabled"] as const;
export const ELEMENT_FIELD_LABEL: Record<typeof ELEMENT_FIELDS[number], string> = {
  name: "Title", code: "Code", description: "Description", safetyCriticality: "Safety criticality", validityMonths: "Validity (months)",
  reassessmentYears: "Reassessment (years)", proficiencyScale: "Proficiency scale", requiresAssessorGuidance: "Needs assessor guidance",
  assessorGuidance: "Assessor guidance", selfAssessmentEnabled: "Self-assessment quiz",
};
export const CRITERION_FIELDS = ["code", "type", "criteriaText", "levelId", "subcategoryId", "subcategoryNumber", "criteriaNumber", "assessmentMethods", "assessorGuidance", "guidanceNumber", "criticalityRating", "required", "applicableLevels", "mcqOptions", "mcqCorrectAnswerIndex"] as const;

export interface CriterionSnapshot {
  id?: string | null; code: string; type: string; criteriaText: string; criteriaNumber: number;
  levelId?: string | null; subcategoryId?: string | null; subcategoryNumber?: number | null; assessmentMethods?: string[] | null; assessorGuidance?: string | null;
  guidanceNumber?: string | null; criticalityRating?: string | null; required?: boolean | null; applicableLevels?: string[] | null; mcqOptions?: string[] | null; mcqCorrectAnswerIndex?: number | null;
}
export interface StandardSnapshot { element: Record<string, any>; criteria: CriterionSnapshot[] }

const blank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const same = (a: unknown, b: unknown) => (blank(a) && blank(b)) || JSON.stringify(a) === JSON.stringify(b);

export function snapshotOf(element: Record<string, any>, criteria: Array<Record<string, any>>): StandardSnapshot {
  const el: Record<string, any> = {};
  for (const f of ELEMENT_FIELDS) el[f] = element[f] ?? null;
  const list = criteria.filter((c) => c.isActive !== false).map((c) => {
    const out: Record<string, any> = { id: c.id ?? null };
    for (const f of CRITERION_FIELDS) out[f] = c[f] ?? null;
    return out as CriterionSnapshot;
  });
  list.sort((a, b) => a.type.localeCompare(b.type) || a.code.localeCompare(b.code, undefined, { numeric: true }));
  return { element: el, criteria: list };
}

export function sameWording(a: StandardSnapshot, b: StandardSnapshot): boolean {
  if (!ELEMENT_FIELDS.every((f) => same(a.element[f], b.element[f]))) return false;
  if (a.criteria.length !== b.criteria.length) return false;
  const key = (c: CriterionSnapshot) => `${c.type}|${c.code}`;
  const bByKey = new Map(b.criteria.map((c) => [key(c), c]));
  return a.criteria.every((c) => { const o = bByKey.get(key(c)); return !!o && CRITERION_FIELDS.every((f) => same((c as any)[f], (o as any)[f])); });
}

export interface Change { what: string; before: string | null; after: string | null }
const show = (v: unknown) => (blank(v) ? null : Array.isArray(v) ? v.join(", ") : String(v));

/** what is different between two versions, in words a reviewer can read */
export function differences(from: StandardSnapshot, to: StandardSnapshot): Change[] {
  const out: Change[] = [];
  for (const f of ELEMENT_FIELDS) if (!same(from.element[f], to.element[f])) out.push({ what: ELEMENT_FIELD_LABEL[f], before: show(from.element[f]), after: show(to.element[f]) });
  const key = (c: CriterionSnapshot) => (c.id ? `id:${c.id}` : `code:${c.type}|${c.code}`);
  const before = new Map(from.criteria.map((c) => [key(c), c]));
  const seen = new Set<string>();
  for (const c of to.criteria) {
    const o = before.get(key(c));
    if (!o) { out.push({ what: `Criterion ${c.code} added`, before: null, after: c.criteriaText }); continue; }
    seen.add(key(c));
    if (o.criteriaText !== c.criteriaText) out.push({ what: `Criterion ${c.code} wording`, before: o.criteriaText, after: c.criteriaText });
    const other = CRITERION_FIELDS.filter((f) => f !== "criteriaText" && !same((o as any)[f], (c as any)[f]));
    if (other.length) out.push({ what: `Criterion ${c.code} settings`, before: other.map((f) => `${f}: ${show((o as any)[f]) ?? "none"}`).join("; "), after: other.map((f) => `${f}: ${show((c as any)[f]) ?? "none"}`).join("; ") });
  }
  for (const [k, o] of Array.from(before.entries())) if (!seen.has(k)) out.push({ what: `Criterion ${o.code} removed`, before: o.criteriaText, after: null });
  return out;
}
