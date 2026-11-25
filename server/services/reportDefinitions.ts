// Hand-made report layouts for the pages that matter most. For any other page the generic reader in reportData.ts works out a table from whatever the page returns;
// for these it is worth doing better: the columns a manager actually wants, in the order they want them, in plain words, with the figures worked out
// (readiness, gaps, shortfalls, overdue) so nobody has to build a pivot table first.
//
// A definition never reads anything itself except through the same loopback call the generic reader uses, so it sees exactly what the signed-in person may see.
// It is matched on the page's data address (not the page), so it works the same from the Export button and from a scheduled report.
import type { Col, ColType, Table } from "./reportData";

type Row = Record<string, any>;
type Get = (url: string) => Promise<unknown | null>;
export interface Built { tables: Table[]; notes: string[] }
export interface Definition {
  key: string;
  title: string;
  match: RegExp; // tested against the path only, without the query
  // read the data (default: one call to the address). Lets a definition collect several pages of a long list or add a name from another call.
  load?: (url: string, get: Get) => Promise<unknown | null>;
  build: (json: any, query: URLSearchParams) => Built;
}

// ------------------------------------------------------------------------------------------------------------ small helpers
const cols = (...c: Array<[string, string, ColType?]>): Col[] => c.map(([key, label, type]) => ({ key, label, type: type ?? "text" }));
// written-out columns are marked so that an infographic never charts them
const FREE = new Set(["notes", "note", "comment", "legal", "summary", "reason", "exemption", "revokedReason", "email", "cert", "reasons", "action"]);
const table = (name: string, source: string, columns: Col[], rows: Row[], extra: Partial<Table> = {}): Table => ({ id: "", name, source, kind: "data", columns: columns.map(c => (FREE.has(c.key) ? { ...c, free: true } : c)), rows, truncated: false, ...extra });
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const val = (v: unknown) => (v === undefined || v === null || v === "" ? null : v);
const fullName = (a?: string | null, b?: string | null) => `${a ?? ""} ${b ?? ""}`.trim() || null;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
// the database gives some times as "2026-05-05 15:45:03.265" (no zone); make them proper ISO times so Excel sees a date
const iso = (v: unknown): string | null => {
  if (typeof v !== "string" || !v) return null;
  const s = v.includes("T") ? v : v.replace(" ", "T");
  const t = /(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s + "Z";
  return Number.isNaN(Date.parse(t)) ? null : t;
};
const sentence = (s: unknown) => { const t = String(s ?? "").replace(/_/g, " ").trim().toLowerCase(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : null; };
const figures = (source: string, name: string, items: Array<[string, unknown]>): Table[] => {
  const rows = items.filter(([, v]) => typeof v === "number" && Number.isFinite(v)).map(([measure, value]) => ({ measure, value }));
  return rows.length ? [table(name, source, cols(["measure", "Measure"], ["value", "Value"]), rows, { kind: "figures" })] : [];
};
const list = (j: any, key?: string): any[] => (Array.isArray(j) ? j : key && Array.isArray(j?.[key]) ? j[key] : []);

const COMPETENCE_STATUS: Record<string, string> = {
  current: "Current", expiring_30: "Expiring within 30 days", expiring_60: "Expiring within 60 days", expiring_90: "Expiring within 90 days", expired: "Expired", missing: "Missing",
};

// ------------------------------------------------------------------------------------------------------------ Compliance Explorer
const complianceExplorer: Definition = {
  key: "compliance-explorer", title: "Compliance Explorer", match: /^\/api\/reports\/compliance-explorer$/,
  build(j) {
    const src = "/api/reports/compliance-explorer";
    const people = list(j, "people").map((p: any): Row => {
      const c = p.competence ?? {}, t = p.training ?? {};
      const gaps = num(c.expired) + num(c.missing) + num(t.expired) + num(t.missing);
      const soon = num(c.expiring30) + num(t.expiring30);
      const sc = Math.max(0, num(c.safetyCriticalTotal) - num(c.safetyCriticalCurrent)) + Math.max(0, num(t.safetyCriticalTotal) - num(t.safetyCriticalCurrent));
      return {
        name: val(p.name), jobRole: val(p.jobRoleName), readiness: p.onLeave === true ? "On leave" : gaps > 0 ? "Not ready" : soon > 0 ? "Expiring soon" : "Ready",
        site: val(p.location), team: val(p.teamShift), secondaryRole: val(p.secondaryJobRoleName), employment: sentence(p.employmentType), contractor: val(p.contractCompanyName),
        competencePct: val(c.percentage), safetyCritical: sc,
        cReq: num(c.total), cCur: num(c.current), c30: num(c.expiring30), c60: num(c.expiring60), c90: num(c.expiring90), cExp: num(c.expired), cMiss: num(c.missing),
        trainingPct: val(t.percentage),
        tReq: num(t.total), tCur: num(t.current), t30: num(t.expiring30), t60: num(t.expiring60), t90: num(t.expiring90), tExp: num(t.expired), tMiss: num(t.missing),
      };
    });
    const peopleCols = cols(
      ["name", "Name"], ["jobRole", "Job role"], ["readiness", "Readiness"], ["site", "Site"], ["team", "Team or shift"], ["secondaryRole", "Secondary role"], ["employment", "Employment"], ["contractor", "Contractor company"],
      ["competencePct", "Competence percentage", "percent"], ["trainingPct", "Training percentage", "percent"], ["safetyCritical", "Safety-critical gaps", "number"],
      ["cReq", "Competence required", "number"], ["cCur", "Competence current", "number"], ["c30", "Competence expiring in 30 days", "number"], ["c60", "Competence expiring in 60 days", "number"], ["c90", "Competence expiring in 90 days", "number"], ["cExp", "Competence expired", "number"], ["cMiss", "Competence missing", "number"],
      ["tReq", "Training required", "number"], ["tCur", "Training current", "number"], ["t30", "Training expiring in 30 days", "number"], ["t60", "Training expiring in 60 days", "number"], ["t90", "Training expiring in 90 days", "number"], ["tExp", "Training expired", "number"], ["tMiss", "Training missing", "number"],
    );
    const sites = list(j, "byTeamShift").map((s: any): Row => ({ site: val(s.location), team: val(s.teamShift), people: num(s.headcount), trainingPct: val(s.trainingPercentage), competencePct: val(s.competencePercentage) }));
    const s = j?.summary ?? {};
    return {
      notes: [],
      tables: [
        ...figures(src, "Key figures", [["Training compliance percentage", s.trainingPercentage], ["Competence compliance percentage", s.competencePercentage], ["Safety-critical training percentage", s.safetyCriticalTrainingPercentage], ["Safety-critical competence percentage", s.safetyCriticalCompetencePercentage]]),
        table("People", src, peopleCols, people, { primary: true }),
        ...(sites.length ? [table("Sites and teams", src, cols(["site", "Site"], ["team", "Team or shift"], ["people", "People", "number"], ["trainingPct", "Training percentage", "percent"], ["competencePct", "Competence percentage", "percent"]), sites, { skipCharts: true })] : []),
      ],
    };
  },
};

// ------------------------------------------------------------------------------------------------------------ Competence Detail
const competenceDetail: Definition = {
  key: "competence-detail", title: "Competence Detail", match: /^\/api\/reports\/competence-detail$/,
  build(j) {
    const src = "/api/reports/competence-detail";
    const elements: any[] = list(j, "elements"), people: any[] = list(j, "people");
    const gaps: Row[] = [];
    const byElement = new Map<string, Row>();
    for (const e of elements) byElement.set(e.elementId, { code: val(e.elementCode), element: val(e.elementName), safetyCritical: e.safetyCritical === true, required: 0, current: 0, s30: 0, s60: 0, s90: 0, expired: 0, missing: 0 });
    for (const p of people) {
      for (const e of elements) {
        const c = p.cells?.[e.elementId]; if (!c || c.required !== true) continue;
        const tally = byElement.get(e.elementId)!; tally.required++;
        const bucket: Record<string, string> = { current: "current", expiring_30: "s30", expiring_60: "s60", expiring_90: "s90", expired: "expired", missing: "missing" };
        if (bucket[c.status]) tally[bucket[c.status]]++;
        if (c.status !== "current") {
          gaps.push({ person: val(p.name), jobRole: val(p.jobRoleName), site: val(p.location), team: val(p.teamShift), code: val(e.elementCode), element: val(e.elementName), safetyCritical: e.safetyCritical === true,
            status: COMPETENCE_STATUS[c.status] ?? sentence(c.status), outcome: sentence(c.outcome), expiry: val(c.expiryDate), days: typeof c.daysUntilExpiry === "number" ? c.daysUntilExpiry : null, exemption: val(c.exemptionReason), exemptUntil: val(c.exemptionUntil), onLeave: p.onLeave === true });
        }
      }
    }
    const order: Record<string, number> = { Expired: 0, Missing: 1 };
    gaps.sort((a, b) => (b.safetyCritical === true ? 1 : 0) - (a.safetyCritical === true ? 1 : 0) || (order[a.status] ?? 2) - (order[b.status] ?? 2) || (a.days ?? 99999) - (b.days ?? 99999));
    const elementRows = Array.from(byElement.values()).map(r => ({ ...r, pct: pct(r.current, r.required) }));

    // the matrix, laid out like the screen: a competence element on each row (column A, filterable), a person in each column, with their job role, location,
    // team and competence percentage above their name; each cell says where that person stands, with the date it runs out
    const MAX_PEOPLE = 300;
    const shown = people.slice(0, MAX_PEOPLE);
    const day = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : null);
    const cellText = (c: any): string | null => {
      if (!c) return null;
      if (c.exemptionReason) return "Exempt";
      if (c.required !== true && c.status === "missing") return "N/A";
      const d = day(c.expiryDate);
      switch (c.status) {
        case "current": return d ? `Current until ${d}` : "Current";
        case "expiring_30": case "expiring_60": case "expiring_90": return d ? `Expiring soon, ends ${d}` : "Expiring soon";
        case "expired": return d ? `Expired ${d}` : "Expired";
        case "missing": return "No record";
        default: return sentence(c.status);
      }
    };
    const percentFor = (p: any) => { let need = 0, ok = 0; for (const e of elements) { const c = p.cells?.[e.elementId]; if (c?.required === true) { need++; if (c.status === "current") ok++; } } return need ? Math.round((ok / need) * 100) : null; };
    const matrixCols: Col[] = [{ key: "element", label: "Competency element", type: "text" }, { key: "code", label: "Code", type: "text" }, { key: "safety", label: "Safety critical", type: "boolean" },
      ...shown.map((p: any, i: number) => ({ key: `p${i}`, label: String(p.name ?? "Unnamed"), type: "text" as ColType }))];
    const matrix = elements.map((e: any): Row => {
      const r: Row = { element: val(e.elementName), code: val(e.elementCode), safety: e.safetyCritical === true };
      shown.forEach((p: any, i: number) => { r[`p${i}`] = cellText(p.cells?.[e.elementId]); });
      return r;
    });
    const fact = (label: string, f: (p: any) => string | number | null, percent = false) => ({ cells: [label, null, null, ...shown.map(f)] as Array<string | number | null>, percent });
    const above = [fact("Job role", p => val(p.jobRoleName) as string | null), fact("Location", p => val(p.location) as string | null),
      ...(shown.some((p: any) => p.teamShift) ? [fact("Team or shift", p => val(p.teamShift) as string | null)] : []),
      ...(shown.some((p: any) => p.onLeave === true) ? [fact("On leave", p => (p.onLeave === true ? "Yes" : null))] : []),
      fact("Competence percentage", percentFor, true)];
    return {
      notes: people.length > shown.length ? [`The matrix shows the first ${shown.length} of ${people.length} people`] : [],
      tables: [
        table("Gaps and expiries", src, cols(["person", "Name"], ["jobRole", "Job role"], ["site", "Site"], ["team", "Team or shift"], ["code", "Element code"], ["element", "Element"], ["safetyCritical", "Safety critical", "boolean"],
          ["status", "Status"], ["outcome", "Last outcome"], ["expiry", "Expiry date", "date"], ["days", "Days until expiry", "number"], ["exemption", "Exemption reason"], ["exemptUntil", "Exempt until", "date"], ["onLeave", "On leave", "boolean"]), gaps, { primary: true }),
        table("By element", src, cols(["code", "Element code"], ["element", "Element"], ["safetyCritical", "Safety critical", "boolean"], ["required", "People required", "number"], ["current", "Current", "number"], ["s30", "Expiring in 30 days", "number"], ["s60", "Expiring in 60 days", "number"], ["s90", "Expiring in 90 days", "number"], ["expired", "Expired", "number"], ["missing", "Missing", "number"], ["pct", "Percentage current", "percent"]), elementRows, { skipCharts: true }),
        table("Matrix", src, matrixCols, matrix, { skipCharts: true, above, freezeCols: 1, colourFrom: 4 }),
      ],
    };
  },
};

// ------------------------------------------------------------------------------------------------------------ Training completions
const METHOD: Record<string, string> = { content_completed: "Completed in Capera", contractor_declared: "Declared by contractor", classroom: "Classroom session", manual: "Recorded by hand", imported: "Imported" };
const trainingCompletions: Definition = {
  key: "training-completions", title: "Training Completions", match: /^\/api\/reports\/training-completions$/,
  build(j) {
    const src = "/api/reports/training-completions";
    const rows = list(j).map((r: any): Row => ({ completed: val(r.completedAt), person: val(r.userName), email: val(r.userEmail), training: val(r.trainingName), category: val(r.categoryName), method: METHOD[r.method] ?? sentence(r.method), recorded: val(r.recordedAt) }));
    const group = (key: "training" | "category") => {
      const m = new Map<string, { n: number; people: Set<string>; last: string | null; category: string | null }>();
      for (const r of rows) {
        const k = String(r[key] ?? "Not set"); const g = m.get(k) ?? { n: 0, people: new Set<string>(), last: null, category: r.category };
        g.n++; g.people.add(String(r.email ?? r.person)); if (r.completed && (!g.last || r.completed > g.last)) g.last = r.completed; m.set(k, g);
      }
      return Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n);
    };
    return {
      notes: [],
      tables: [
        table("Completions", src, cols(["completed", "Completed", "date"], ["person", "Name"], ["email", "Email"], ["training", "Training"], ["category", "Category"], ["method", "How it was recorded"], ["recorded", "Recorded", "date"]), rows, { primary: true }),
        table("By training", src, cols(["training", "Training"], ["category", "Category"], ["n", "Completions", "number"], ["people", "People", "number"], ["last", "Latest completion", "date"]),
          group("training").map(([k, g]) => ({ training: k, category: g.category, n: g.n, people: g.people.size, last: g.last })), { skipCharts: true }),
        table("By category", src, cols(["category", "Category"], ["n", "Completions", "number"], ["people", "People", "number"]), group("category").map(([k, g]) => ({ category: k, n: g.n, people: g.people.size })), { skipCharts: true }),
      ],
    };
  },
};

// ------------------------------------------------------------------------------------------------------------ Training evaluations
// one line of headline figures, used for courses, providers and the other ways of grouping. Anything held back to protect anonymity stays empty.
const evaluationLine = (g: any): Row => {
  const s = g.summary ?? {}, fu = s.followUp ?? {};
  return { name: val(g.label), rating: val(g.verdict?.label), reasons: (g.verdict?.reasons ?? []).join("; ") || null, asked: num(s.asked), replies: num(s.replies), response: val(s.responseRatePct),
    overall: val(s.overall), suitable: val(s.suitablePct), recommend: val(s.recommendPct), gain: val(s.confidenceGain), used: val(fu.usedPct), prepared: val(fu.prepared), concerns: num(s.safetyConcerns) };
};
const evaluationColumns = (first: string) => cols(["name", first], ["rating", "Suitability rating"], ["asked", "Asked", "number"], ["replies", "Replies", "number"], ["response", "Reply rate", "percent"],
  ["overall", "Overall (out of 5)", "number"], ["suitable", "Fully met the job need", "percent"], ["recommend", "Would recommend", "percent"], ["gain", "Confidence gain", "number"],
  ["used", "Used at work (follow-up)", "percent"], ["prepared", "Prepared for the job (out of 5)", "number"], ["concerns", "Safety concerns", "number"], ["reasons", "Why this rating"]);
const GROUP_HEADING: Record<string, string> = { formType: "Kind of course", provider: "Provider", instructor: "Instructor", venue: "Venue", jobRole: "Job role", category: "Category", quarter: "Quarter", course: "Course" };
const evaluationAnalysis: Definition = {
  key: "training-evaluations", title: "Training evaluations", match: /^\/api\/training-evaluations\/analysis$/,
  build(j) {
    const src = "/api/training-evaluations/analysis";
    const courses = list(j, "courses"), groups = list(j, "groups"), by = String(j?.groupBy ?? "provider");
    const sections = courses.flatMap((g: any): Row[] => (g.summary?.sections ?? []).map((s: any) => ({ course: g.label, area: s.label, score: s.average, favourable: s.favourablePct, answers: s.answers })));
    const out: Table[] = [
      table("Course suitability", src, evaluationColumns("Course"), courses.map(evaluationLine), { primary: true }),
      table("Scores by area", src, cols(["course", "Course"], ["area", "Area"], ["score", "Score (out of 5)", "number"], ["favourable", "Agreeing", "percent"], ["answers", "Answers", "number"]), sections, { skipCharts: true }),
    ];
    // instructors are people: their figures go in the workbook but are left out of anything drawn or summarised from it
    if (by !== "course" && groups.length) out.push(table(`By ${(GROUP_HEADING[by] ?? by).toLowerCase()}`, src, evaluationColumns(GROUP_HEADING[by] ?? by), groups.map(evaluationLine), { skipCharts: true }));
    return { tables: out, notes: [`Where names are not shown, results are held back for any group with fewer than ${num(j?.minGroup)} replies.`] };
  },
};
const evaluationCourse: Definition = {
  key: "training-evaluation-course", title: "Course evaluation", match: /^\/api\/training-evaluations\/course$/,
  build(j) {
    const src = "/api/training-evaluations/course";
    const head = evaluationLine({ label: j?.courseTitle, summary: j?.summary, verdict: j?.verdict });
    const questions = list(j, "questions").map((q: any): Row => ({ area: q.section, statement: q.text, score: q.average, favourable: q.favourablePct, answers: q.answers, na: q.notApplicable }));
    const KIND: Record<string, string> = { best: "Most useful", improve: "Should change", further: "Further training or support", missing: "Not covered" };
    const written = list(j, "comments").map((c: any): Row => ({ month: val(c.month), about: KIND[c.kind] ?? sentence(c.kind), comment: val(c.text), provider: val(c.provider), person: val(c.name) }));
    const reviews = list(j, "reviews").map((r: any): Row => ({ on: iso(r.on), decision: val(r.decision), note: val(r.note), by: val(r.by), next: val(r.nextReviewOn) }));
    return { notes: [], tables: [
      table("Course summary", src, evaluationColumns("Course"), [head], { primary: true, skipCharts: true }),
      table("Statements", src, cols(["area", "Area"], ["statement", "Statement"], ["score", "Score (out of 5)", "number"], ["favourable", "Agreeing", "percent"], ["answers", "Answers", "number"], ["na", "Not applicable", "number"]), questions),
      // written comments go in the workbook only: skipCharts keeps them out of the infographic, including the AI version
      ...(written.length ? [table("Comments", src, cols(["month", "Month attended"], ["about", "About"], ["comment", "Comment"], ["provider", "Provider"], ["person", "Name, where given"]), written, { skipCharts: true })] : []),
      ...(reviews.length ? [table("Review decisions", src, cols(["on", "Decided", "date"], ["decision", "Decision"], ["note", "Reason"], ["by", "By"], ["next", "Review again", "date"]), reviews, { skipCharts: true })] : []),
    ] };
  },
};

// ------------------------------------------------------------------------------------------------------------ Duty to operate
const STAFFING_STATUS: Record<string, string> = { met: "Met", shortfall: "Shortfall", at_risk: "At risk" };
const COUNT_BY: Record<string, string> = { primary: "Main role", secondary: "Second role", either: "Either role" };
const dutyStatus: Definition = {
  key: "duty-to-operate", title: "Duty to Operate", match: /^\/api\/staffing\/status$/,
  build(j) {
    const src = "/api/staffing/status";
    const items = list(j);
    const reqs = items.map((x: any): Row => ({
      site: val(x.scopeName), role: val(x.roleName), duty: x.requirement?.dutyToOperate === true, required: num(x.required), actual: num(x.actual), shortfall: num(x.shortfall), atRisk: num(x.atRiskCount),
      status: STAFFING_STATUS[x.status] ?? sentence(x.status), countBy: COUNT_BY[x.requirement?.countBy] ?? sentence(x.requirement?.countBy), onlyCompetent: x.requirement?.onlyCompetent === true, excludeAbsent: x.requirement?.excludeAbsent === true,
      legal: val(x.requirement?.legalReference), notes: val(x.requirement?.notes), review: sentence(x.review?.status), decision: sentence(x.review?.decision), riskRef: val(x.review?.riskAssessmentRef), detected: val(x.review?.detectedAt),
    }));
    const order: Record<string, number> = { Shortfall: 0, "At risk": 1, Met: 2 };
    reqs.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || (b.shortfall - a.shortfall));
    const people: Row[] = [];
    for (const x of items) for (const p of x.people ?? []) people.push({
      site: val(x.scopeName), role: val(x.roleName), person: val(p.name), jobRole: val(p.jobRole), source: sentence(p.source), counted: p.counted === true, competent: p.competent === true, absent: p.onAbsence === true,
      expires: typeof p.expiresInDays === "number" ? p.expiresInDays : null, leaving: typeof p.leavingInDays === "number" ? p.leavingInDays : null, atRisk: p.atRisk === true, reason: val(p.reason),
    });
    return {
      notes: [],
      tables: [
        table("Requirements", src, cols(["site", "Site or area"], ["role", "Role"], ["status", "Status"], ["required", "Required", "number"], ["actual", "Actual", "number"], ["shortfall", "Shortfall", "number"], ["atRisk", "At risk", "number"], ["duty", "Duty to operate", "boolean"],
          ["countBy", "Counted by"], ["onlyCompetent", "Only competent people count", "boolean"], ["excludeAbsent", "Absent people excluded", "boolean"], ["legal", "Legal reference"], ["notes", "Notes"], ["review", "Review"], ["decision", "Decision"], ["riskRef", "Risk assessment reference"], ["detected", "Shortfall found", "date"]), reqs, { primary: true }),
        ...(people.length ? [table("People counted", src, cols(["site", "Site or area"], ["role", "Role"], ["person", "Name"], ["jobRole", "Job role"], ["source", "Counted from"], ["counted", "Counted", "boolean"], ["competent", "Competent", "boolean"], ["absent", "On absence", "boolean"], ["expires", "Competence runs out in (days)", "number"], ["leaving", "Leaving in (days)", "number"], ["atRisk", "At risk", "boolean"], ["reason", "Why not counted"]), people, { skipCharts: true })] : []),
      ],
    };
  },
};
const dutyReviews: Definition = {
  key: "duty-to-operate-reviews", title: "Duty to Operate reviews", match: /^\/api\/staffing\/reviews$/,
  build(j) {
    const src = "/api/staffing/reviews";
    const rows = list(j).map((r: any): Row => ({
      detected: val(r.detectedAt), site: val(r.scopeName), role: val(r.roleName), duty: r.dutyToOperate === true, required: num(r.requiredCount), actual: num(r.actualCount), status: sentence(r.status), decision: sentence(r.decision),
      comment: val(r.decisionComment), riskRef: val(r.riskAssessmentRef), decidedBy: val(r.decidedByName), decided: val(r.decidedAt), resolved: val(r.resolvedAt), legal: val(r.legalReference),
    }));
    return { notes: [], tables: [table("Shortfall reviews", src, cols(["detected", "Found", "date"], ["site", "Site or area"], ["role", "Role"], ["duty", "Duty to operate", "boolean"], ["required", "Required", "number"], ["actual", "Actual", "number"], ["status", "Status"], ["decision", "Decision"], ["comment", "Comment"], ["riskRef", "Risk assessment reference"], ["decidedBy", "Decided by"], ["decided", "Decided", "date"], ["resolved", "Resolved", "date"], ["legal", "Legal reference"]), rows)] };
  },
};

// ------------------------------------------------------------------------------------------------------------ Performance and appraisals
const STAGES = ["no_appraiser", "not_started", "objectives", "self_review", "manager_review", "calibration", "meeting", "signed_off"];
const STAGE_LABEL: Record<string, string> = { no_appraiser: "No appraiser", not_started: "Not started", objectives: "Objectives", self_review: "Self review", manager_review: "Manager review", calibration: "Calibration", meeting: "Meeting", signed_off: "Signed off" };
const appraisalCompletion: Definition = {
  key: "appraisal-completion", title: "Appraisal completion", match: /^\/api\/performance\/completion$/,
  build(j) {
    const src = "/api/performance/completion";
    const s = j?.summary ?? {};
    const people = list(j, "rows").map((r: any): Row => ({
      name: val(r.name), jobRole: val(r.jobRole), site: val(r.location), manager: val(r.managerName), supervisor: val(r.supervisorName), stage: val(r.stageLabel) ?? STAGE_LABEL[r.stage] ?? sentence(r.stage), waitingOn: val(r.waitingOn),
      self: r.selfSubmitted === true, mgr: r.managerSubmitted === true, shared: r.shared === true, due: val(r.dueDate), overdue: r.overdue === true,
    }));
    const byStage = STAGES.filter(k => typeof s.byStage?.[k] === "number").map(k => ({ stage: STAGE_LABEL[k], people: s.byStage[k] as number }));
    const byManager = list(j, "managers").map((m: any): Row => ({ manager: val(m.name), people: num(m.people), complete: num(m.complete), overdue: num(m.overdue), notStarted: num(m.notStarted), pct: pct(num(m.complete), num(m.people)) }));
    return {
      notes: j?.cycle?.name ? [`Review cycle: ${j.cycle.name}`] : [],
      tables: [
        ...figures(src, "Key figures", [["Complete percentage", s.completePct], ["People in this cycle", s.total], ["Complete", s.complete], ["Overdue", s.overdue], ["No appraiser", s.noAppraiser], ["Not started", s.notStarted], ["In progress", s.inProgress]]),
        table("People", src, cols(["name", "Name"], ["jobRole", "Job role"], ["site", "Site"], ["manager", "Manager"], ["supervisor", "Supervisor"], ["stage", "Stage"], ["waitingOn", "Waiting on"], ["self", "Self review in", "boolean"], ["mgr", "Manager review in", "boolean"], ["shared", "Shared with the person", "boolean"], ["due", "Due", "date"], ["overdue", "Overdue", "boolean"]), people, { primary: true }),
        ...(byStage.length ? [table("By stage", src, cols(["stage", "Stage"], ["people", "People", "number"]), byStage, { skipCharts: true })] : []),
        ...(byManager.length ? [table("By manager", src, cols(["manager", "Manager"], ["people", "People", "number"], ["complete", "Complete", "number"], ["overdue", "Overdue", "number"], ["notStarted", "Not started", "number"], ["pct", "Complete percentage", "percent"]), byManager, { skipCharts: true })] : []),
      ],
    };
  },
};
const teamAppraisals: Definition = {
  key: "team-appraisals", title: "Team appraisals", match: /^\/api\/performance\/team$/,
  build(j) {
    const src = "/api/performance/team";
    const now = Date.now();
    // the scores are deliberately left out: they are for administrators on their own screen, and a report is passed around
    const rows = list(j).map((r: any): Row => ({
      name: val(r.employeeName), jobRole: val(r.jobRole), cycle: val(r.cycleName), year: typeof r.year === "number" ? r.year : null, relationship: sentence(r.relationship),
      status: STAGE_LABEL[r.status] ?? sentence(r.status), self: r.selfSubmitted === true, mgr: r.managerSubmitted === true, shared: r.shared === true, due: val(r.dueDate),
      overdue: !!r.dueDate && Date.parse(r.dueDate) < now && !/^(signed_off|complete|closed)$/.test(String(r.status)),
    }));
    return { notes: [], tables: [table("Appraisals", src, cols(["name", "Name"], ["jobRole", "Job role"], ["cycle", "Review cycle"], ["year", "Year", "number"], ["relationship", "Your part"], ["status", "Stage"], ["self", "Self review in", "boolean"], ["mgr", "Manager review in", "boolean"], ["shared", "Shared with the person", "boolean"], ["due", "Due", "date"], ["overdue", "Overdue", "boolean"]), rows, { primary: true })] };
  },
};

// ------------------------------------------------------------------------------------------------------------ Contractor management
// the company's name is not in each row, so it is read once from the list of companies (a contractor administrator has just their own)
async function companyName(url: string, get: Get): Promise<string | null> {
  const id = new URLSearchParams(url.split("?")[1] ?? "").get("companyId");
  const all = list(await get("/api/contractor/companies"));
  const hit = id ? all.find((c: any) => c.id === id) : all.length === 1 ? all[0] : null;
  return hit?.name ?? null;
}
const withCompany = (match: RegExp, key: string, title: string, build: (rows: any[], company: string | null) => Built): Definition => ({
  key, title, match,
  async load(url, get) { const [rows, company] = await Promise.all([get(url), companyName(url, get)]); return rows === null ? null : { rows, company }; },
  build: j => build(list(j, "rows"), j?.company ?? null),
});
const contractorPeople = withCompany(/^\/api\/contractor\/people$/, "contractor-people", "Contractor people", (rows, company) => {
  const src = "/api/contractor/people";
  const status = (p: any) => (p.leftAt ? "Left" : p.approvalStatus === "pending" ? "Waiting for approval" : p.approvalStatus === "rejected" ? "Not approved" : p.approvalStatus === "visitor" ? "Short visit only" : p.isActive === false ? "Inactive" : "Active");
  const out = rows.map((p: any): Row => {
    const c = p.competence ?? {}, t = p.training ?? {};
    const gaps = num(c.expired) + num(c.missing) + num(t.expired) + num(t.missing), soon = num(c.expiringSoon30) + num(t.expiringSoon30);
    return {
      company, name: fullName(p.firstName, p.lastName), email: val(p.email), vantage: val(p.vantageNumber), jobRole: val(p.jobRoleName), status: status(p),
      readiness: p.leftAt ? "Left" : gaps > 0 ? "Not ready" : soon > 0 ? "Expiring soon" : "Ready", verified: p.verified === true, left: val(p.leftAt),
      cPct: val(c.coveragePercentage), cReq: num(c.totalRequired), cCur: num(c.current), c30: num(c.expiringSoon30), cExp: num(c.expired), cMiss: num(c.missing),
      tPct: val(t.coveragePercentage), tReq: num(t.totalRequired), tCur: num(t.current), t30: num(t.expiringSoon30), tExp: num(t.expired), tMiss: num(t.missing),
    };
  });
  return { notes: company ? [`Company: ${company}`] : [], tables: [table("People", src, cols(["company", "Company"], ["name", "Name"], ["email", "Email"], ["vantage", "Vantage number"], ["jobRole", "Job role"], ["status", "Status"], ["readiness", "Readiness"], ["verified", "Verified", "boolean"], ["left", "Left on", "date"],
    ["cPct", "Competence percentage", "percent"], ["tPct", "Training percentage", "percent"], ["cReq", "Competence required", "number"], ["cCur", "Competence current", "number"], ["c30", "Competence expiring in 30 days", "number"], ["cExp", "Competence expired", "number"], ["cMiss", "Competence missing", "number"],
    ["tReq", "Training required", "number"], ["tCur", "Training current", "number"], ["t30", "Training expiring in 30 days", "number"], ["tExp", "Training expired", "number"], ["tMiss", "Training missing", "number"]), out, { primary: true })] };
});
const contractorDeclarations = withCompany(/^\/api\/contractor\/declarations$/, "contractor-declarations", "Contractor declarations", (rows, company) => {
  const src = "/api/contractor/declarations";
  const out = rows.map((d: any): Row => ({
    company: val(d.companyName) ?? company, name: fullName(d.firstName, d.lastName), kind: sentence(d.kind), what: val(d.what), achieved: iso(d.achievedAt), expires: iso(d.expiryDate), cert: val(d.certificateRef), status: sentence(d.status),
    declaredBy: val(d.declaredByName), declared: iso(d.declaredAt), revoked: iso(d.revokedAt), revokedReason: val(d.revokedReason), note: val(d.note),
  }));
  return { notes: company ? [`Company: ${company}`] : [], tables: [table("Declarations", src, cols(["company", "Company"], ["name", "Name"], ["kind", "Type"], ["what", "What was declared"], ["achieved", "Achieved", "date"], ["expires", "Runs out", "date"], ["cert", "Certificate reference"], ["status", "Status"], ["declaredBy", "Declared by"], ["declared", "Declared on", "date"], ["revoked", "Withdrawn on", "date"], ["revokedReason", "Reason withdrawn"], ["note", "Note"]), out, { primary: true })] };
});
const contractorPending = withCompany(/^\/api\/contractor\/pending$/, "contractor-pending", "Contractor people waiting for approval", rows => ({
  notes: [], tables: [table("Waiting for approval", "/api/contractor/pending", cols(["company", "Company"], ["name", "Name"], ["email", "Email"], ["jobRole", "Job role"]), rows.map((p: any): Row => ({ company: val(p.companyName), name: fullName(p.firstName, p.lastName), email: val(p.email), jobRole: val(p.jobRoleName) })))],
}));

// ------------------------------------------------------------------------------------------------------------ Audit log
// the log is read 500 at a time; the report takes up to 10 pages (5,000 events) of whatever the page's own filters select, newest first
const AUDIT_PAGE = 500, AUDIT_PAGES = 10;
const auditLog: Definition = {
  key: "audit-log", title: "Audit Log", match: /^\/api\/audit-log$/,
  async load(url, get) {
    const q = new URLSearchParams(url.split("?")[1] ?? ""); q.delete("offset"); q.set("limit", String(AUDIT_PAGE));
    const events: any[] = []; let total = 0;
    for (let page = 0; page < AUDIT_PAGES; page++) {
      q.set("offset", String(page * AUDIT_PAGE));
      const r: any = await get(`/api/audit-log?${q.toString()}`);
      if (!r || !Array.isArray(r.events)) return page === 0 ? null : { events, total };
      events.push(...r.events); total = typeof r.total === "number" ? r.total : events.length;
      if (events.length >= total || r.events.length < AUDIT_PAGE) break;
    }
    return { events, total };
  },
  build(j) {
    const rows = list(j, "events").map((e: any): Row => ({
      when: val(e.occurredAt), who: val(e.actorName), role: sentence(e.actorRole), actingAs: val(e.actingAsName), action: val(e.action), entityType: val(e.entityType), entity: val(e.entityLabel), summary: val(e.summary),
      outcome: typeof e.statusCode !== "number" ? null : e.statusCode < 400 ? "Done" : e.statusCode < 500 ? "Refused" : "Failed", ip: val(e.ipAddress),
    }));
    const total = typeof j?.total === "number" ? j.total : rows.length;
    return {
      notes: total > rows.length ? [`The newest ${rows.length.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} matching events. Narrow the dates to see the rest`] : [],
      tables: [table("Audit log", "/api/audit-log", cols(["when", "When", "date"], ["who", "Who"], ["role", "Their role"], ["actingAs", "Acting as"], ["action", "Action"], ["entityType", "Type of record"], ["entity", "Record"], ["summary", "What happened"], ["outcome", "Outcome"], ["ip", "From address"]), rows, { primary: true })],
    };
  },
};

export const DEFINITIONS: Definition[] = [complianceExplorer, competenceDetail, trainingCompletions, evaluationAnalysis, evaluationCourse, dutyStatus, dutyReviews, appraisalCompletion, teamAppraisals, contractorPeople, contractorDeclarations, contractorPending, auditLog];

export const definitionFor = (url: string): Definition | undefined => {
  const path = url.split("?")[0];
  return DEFINITIONS.find(d => d.match.test(path));
};
