// The hand-made report layouts, without a server: each one is fed data shaped like the real page data and checked for the right tables, the right sums,
// plain headings, nothing it should not carry (scores, identifiers), and that the workbook and infographic still build from them.
import * as XLSX from "xlsx";
import { definitionFor, DEFINITIONS } from "../../server/services/reportDefinitions";
import { buildWorkbook } from "../../server/services/reportWorkbook";
import { profileTables, buildByRules } from "../../server/services/reportInfographic";
import type { Table } from "../../server/services/reportData";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string, x?: unknown) => { if (c) { pass++; console.log("  PASS", m); } else { fail++; console.log("  FAIL", m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ""); } };
const build = (url: string, json: unknown) => { const d = definitionFor(url); if (!d) throw new Error("no layout for " + url); return d.build(json, new URLSearchParams(url.split("?")[1] ?? "")); };
const named = (tables: Table[], name: string) => tables.find(t => t.name === name)!;

const counts = (extra: Record<string, number> = {}) => ({ current: 0, expiring30: 0, expiring60: 0, expiring90: 0, expired: 0, missing: 0, total: 0, safetyCriticalTotal: 0, safetyCriticalCurrent: 0, percentage: 100, ...extra });

(async () => {
  console.log("Which pages have a layout");
  for (const [url, key] of [["/api/reports/compliance-explorer?location=x", "compliance-explorer"], ["/api/reports/competence-detail", "competence-detail"], ["/api/reports/training-completions", "training-completions"], ["/api/staffing/status", "duty-to-operate"],
    ["/api/staffing/reviews", "duty-to-operate-reviews"], ["/api/performance/completion?cycleId=1", "appraisal-completion"], ["/api/performance/team?all=1", "team-appraisals"], ["/api/contractor/people?companyId=a", "contractor-people"],
    ["/api/contractor/declarations", "contractor-declarations"], ["/api/contractor/pending", "contractor-pending"], ["/api/audit-log?limit=50", "audit-log"]] as const) ok(definitionFor(url)?.key === key, `${key} is matched, with or without a filter`);
  ok(!definitionFor("/api/job-roles") && !definitionFor("/api/reports/compliance-explorer/extra") && !definitionFor("/api/auth/user"), "other addresses keep the generic reader");
  ok(new Set(DEFINITIONS.map(d => d.key)).size === DEFINITIONS.length, "every layout has its own key");

  console.log("Compliance Explorer");
  const ce = build("/api/reports/compliance-explorer", {
    summary: { trainingPercentage: 60.6, competencePercentage: 58, safetyCriticalTrainingPercentage: 64.4, safetyCriticalCompetencePercentage: 59.1 },
    byTeamShift: [{ location: "North", teamShift: "Day", headcount: 3, trainingPercentage: 70, competencePercentage: 80 }],
    people: [
      { userId: "u1", name: "Ready Ruth", email: "r@x", jobRoleName: "Operator", location: "North", teamShift: "Day", employmentType: "employee", contractCompanyName: null, onLeave: false, competence: counts({ total: 4, current: 4 }), training: counts({ total: 6, current: 6 }) },
      { userId: "u2", name: "Gap Gary", email: "g@x", jobRoleName: "Operator", location: "North", employmentType: "contractor", contractCompanyName: "Acme", onLeave: false, competence: counts({ total: 4, current: 2, expired: 1, missing: 1, safetyCriticalTotal: 2, safetyCriticalCurrent: 1, percentage: 50 }), training: counts({ total: 2, current: 2 }) },
      { userId: "u3", name: "Soon Sam", email: "s@x", jobRoleName: "Operator", location: "North", onLeave: false, competence: counts({ total: 3, current: 2, expiring30: 1 }), training: counts({ total: 3, current: 3 }) },
      { userId: "u4", name: "Away Ann", email: "a@x", jobRoleName: "Operator", location: "North", onLeave: true, competence: counts({ total: 1, missing: 1 }), training: counts({ total: 1, current: 1 }) },
    ],
  });
  const people = named(ce.tables, "People");
  ok(ce.tables.map(t => t.name).join() === "Key figures,People,Sites and teams", "key figures, people, then sites and teams", ce.tables.map(t => t.name));
  ok(people.rows.map(r => r.readiness).join() === "Ready,Not ready,Expiring soon,On leave", "readiness is worked out for every person", people.rows.map(r => r.readiness));
  ok(people.rows[1].safetyCritical === 1 && people.rows[1].employment === "Contractor" && people.rows[1].contractor === "Acme", "safety-critical gaps and the contractor are shown");
  ok(people.primary === true && named(ce.tables, "Sites and teams").skipCharts === true, "people lead the infographic; the roll-up stays in Excel only");
  ok(!people.columns.some(c => /(^| )id$/i.test(c.label) || /user ?id/i.test(c.label)) && !people.columns.some(c => c.key === "userId"), "no identifier columns");
  ok(named(ce.tables, "Key figures").rows.length === 4 && named(ce.tables, "Key figures").kind === "figures", "four key figures");

  console.log("Competence Detail");
  const els = [{ elementId: "e1", elementName: "Alarm handling", elementCode: "OPS-01", safetyCritical: true }, { elementId: "e2", elementName: "Isolation", elementCode: "SSW-02", safetyCritical: false }];
  const cell = (status: string, required = true, extra: Record<string, unknown> = {}) => ({ status, outcome: status === "missing" ? null : "competent", expiryDate: null, daysUntilExpiry: null, required, safetyCritical: false, exemptionReason: null, exemptionUntil: null, ...extra });
  const cd = build("/api/reports/competence-detail", { elements: els, people: [
    { userId: "u1", name: "Ruth", jobRoleName: "Op", location: "North", teamShift: null, onLeave: false, cells: { e1: cell("current"), e2: cell("expired", true, { daysUntilExpiry: -10 }) } },
    { userId: "u2", name: "Gary", jobRoleName: "Op", location: "North", teamShift: null, onLeave: false, cells: { e1: cell("missing"), e2: cell("missing", false) } },
    { userId: "u3", name: "Sam", jobRoleName: "Op", location: "North", teamShift: null, onLeave: false, cells: { e1: cell("expiring_30", true, { daysUntilExpiry: 12 }), e2: cell("current", false) } },
  ] });
  const gaps = named(cd.tables, "Gaps and expiries"), byEl = named(cd.tables, "By element"), matrix = named(cd.tables, "Matrix");
  ok(gaps.rows.length === 3, "only required items that are not current are listed", gaps.rows.map(r => `${r.person}/${r.code}/${r.status}`));
  ok(gaps.rows[0].safetyCritical === true && gaps.rows[0].status === "Missing", "safety-critical gaps come first, then expired and missing");
  ok(gaps.rows.map(r => r.status).every(s => ["Expired", "Missing", "Expiring within 30 days"].includes(s)), "statuses are in plain words", gaps.rows.map(r => r.status));
  const op = byEl.rows.find(r => r.code === "OPS-01")!;
  ok(op.required === 3 && op.current === 1 && op.s30 === 1 && op.missing === 1 && op.pct === 33.3, "the element roll-up adds up", op);
  ok(byEl.rows.every(r => r.required === r.current + r.s30 + r.s60 + r.s90 + r.expired + r.missing), "current, expiring, expired and missing add to the people required for every element");
  ok(matrix.columns.length === 6 && matrix.columns[4].label === "OPS-01 Alarm handling" && matrix.rows[1].e0 === "Missing", "the matrix has one column per element", matrix.columns.map(c => c.label));
  ok(matrix.rows[1][matrix.columns[5].key] === null && matrix.rows[2][matrix.columns[5].key] === "Current", "an optional element nobody holds is blank, one that is held is shown");
  ok(matrix.skipCharts === true && byEl.skipCharts === true && gaps.primary === true, "only the gaps list feeds the infographic");

  console.log("Training completions");
  const tc = build("/api/reports/training-completions", [
    { id: "1", userId: "u1", userName: "A", userEmail: "a@x", trainingId: "t1", trainingName: "Induction", categoryName: "Safety", method: "content_completed", completedAt: "2026-05-01T10:00:00Z", recordedAt: "2026-05-01T10:00:00Z" },
    { id: "2", userId: "u2", userName: "B", userEmail: "b@x", trainingId: "t1", trainingName: "Induction", categoryName: "Safety", method: "contractor_declared", completedAt: "2026-06-01T10:00:00Z", recordedAt: "2026-06-02T10:00:00Z" },
    { id: "3", userId: "u1", userName: "A", userEmail: "a@x", trainingId: "t2", trainingName: "Hot work", categoryName: "Technical", method: "content_completed", completedAt: "2026-04-01T10:00:00Z", recordedAt: "2026-04-01T10:00:00Z" },
  ]);
  const comp = named(tc.tables, "Completions"), byT = named(tc.tables, "By training"), byC = named(tc.tables, "By category");
  ok(comp.rows.length === 3 && comp.rows.map(r => r.method).join() === "Completed in Capera,Declared by contractor,Completed in Capera", "methods are in plain words");
  ok(byT.rows[0].training === "Induction" && byT.rows[0].n === 2 && byT.rows[0].people === 2 && byT.rows[0].last === "2026-06-01T10:00:00Z", "completions, people and latest date by training", byT.rows);
  ok(byC.rows.reduce((n, r) => n + r.n, 0) === 3, "completions by category add to the total");

  console.log("Duty to operate");
  const st = build("/api/staffing/status", [
    { requirement: { countBy: "secondary", dutyToOperate: true, onlyCompetent: true, excludeAbsent: true, legalReference: "Safety case" }, roleName: "ERT", scopeName: "North", required: 4, actual: 2, shortfall: 2, atRiskCount: 0, status: "shortfall", review: { status: "open", detectedAt: "2026-11-04T06:47:05Z" },
      people: [{ userId: "u1", name: "Hannah", jobRole: "ERT", source: "secondary", counted: true, reason: null, competent: true, onAbsence: false, expiresInDays: 300, leavingInDays: null, atRisk: false }] },
    { requirement: { countBy: "primary", dutyToOperate: false }, roleName: "Op", scopeName: "North", required: 2, actual: 3, shortfall: 0, atRiskCount: 1, status: "met", review: null, people: [] },
    { requirement: { countBy: "either", dutyToOperate: true }, roleName: "Fitter", scopeName: "South", required: 2, actual: 2, shortfall: 0, atRiskCount: 1, status: "at_risk", review: null, people: [] },
  ]);
  const reqs = named(st.tables, "Requirements");
  ok(reqs.rows.map(r => r.status).join() === "Shortfall,At risk,Met", "shortfalls first, then at risk, then met", reqs.rows.map(r => r.status));
  ok(reqs.rows[0].countBy === "Second role" && reqs.rows[0].duty === true && reqs.rows[0].review === "Open", "counted-by, duty to operate and review are shown");
  ok(named(st.tables, "People counted").rows.length === 1, "the people counted are listed with their reasons");
  const rv = build("/api/staffing/reviews", [{ id: "x", requirementId: "y", status: "resolved", requiredCount: 2, actualCount: 1, detectedAt: "2026-11-06T17:58:56Z", decision: "risk_assessment_required", decisionComment: "Raise it", riskAssessmentRef: "RA-1", decidedByName: "Local Dev", decidedAt: "2026-11-06T17:59:12Z", resolvedAt: "2026-11-06T17:59:19Z", roleName: "Op", scopeName: "Site", dutyToOperate: true }]);
  ok(rv.tables[0].rows[0].decision === "Risk assessment required" && rv.tables[0].rows[0].status === "Resolved", "review decisions are in plain words");

  console.log("Appraisals");
  const ac = build("/api/performance/completion", { cycle: { name: "2027 Annual Review" }, summary: { total: 3, byStage: { no_appraiser: 1, not_started: 1, signed_off: 1 }, complete: 1, completePct: 33.3, overdue: 1, noAppraiser: 1, notStarted: 1, inProgress: 0 },
    rows: [{ userId: "u1", name: "A", jobRole: "Op", location: "N", managerName: "M", stage: "signed_off", stageLabel: "Signed off", waitingOn: null, selfSubmitted: true, managerSubmitted: true, shared: true, dueDate: null, overdue: false }, { userId: "u2", name: "B", stage: "not_started", stageLabel: "Not started", waitingOn: "Manager", overdue: true }, { userId: "u3", name: "C", stage: "no_appraiser", stageLabel: "No appraiser set" }],
    managers: [{ managerId: "m", name: "M", people: 2, complete: 1, overdue: 1, notStarted: 1 }] });
  ok(ac.notes[0] === "Review cycle: 2027 Annual Review", "the review cycle is named in the notes");
  ok(named(ac.tables, "By stage").rows.map(r => r.stage).join() === "No appraiser,Not started,Signed off", "stages are listed in the order the process runs", named(ac.tables, "By stage").rows);
  ok(named(ac.tables, "By manager").rows[0].pct === 50, "the manager's complete percentage is worked out");
  ok(named(ac.tables, "Key figures").rows.find(r => r.measure === "Complete percentage")?.value === 33.3, "headline figures are carried");
  const ta = build("/api/performance/team?all=1", [{ id: "1", userId: "u1", employeeName: "A", jobRole: "Op", relationship: "manager", status: "manager_review", cycleName: "2026", year: 2026, selfSubmitted: true, managerSubmitted: false, shared: false, dueDate: "2020-01-01T00:00:00Z", scores: { talentScore: 4.2, performance: 5 } },
    { id: "2", userId: "u2", employeeName: "B", jobRole: "Op", relationship: "manager", status: "signed_off", cycleName: "2026", year: 2026, dueDate: "2020-01-01T00:00:00Z", scores: null }]);
  const appr = ta.tables[0];
  ok(!JSON.stringify(ta).toLowerCase().includes("talent") && !appr.columns.some(c => /score/i.test(c.label)), "scores and the Talent Score never leave in a report");
  ok(appr.rows[0].overdue === true && appr.rows[1].overdue === false && appr.rows[0].status === "Manager review", "overdue is worked out, and signed-off appraisals are never overdue", appr.rows.map(r => [r.status, r.overdue]));

  console.log("Contractors");
  const get = async (u: string) => (u.startsWith("/api/contractor/companies") ? [{ id: "c1", name: "Harbour Ltd" }, { id: "c2", name: "Other Ltd" }] : [{ id: "p1", firstName: "Sophie", lastName: "Marsh", email: "s@x", vantageNumber: "V1", jobRoleName: "Tech", isActive: true, approvalStatus: "approved", leftAt: null, verified: true,
    competence: { totalRequired: 4, current: 3, expiringSoon30: 0, expired: 1, missing: 0, coveragePercentage: 75 }, training: { totalRequired: 2, current: 2, expiringSoon30: 0, expired: 0, missing: 0, coveragePercentage: 100 } },
    { id: "p2", firstName: "Left", lastName: "Larry", approvalStatus: "approved", leftAt: "2026-01-01T00:00:00Z", competence: { totalRequired: 1, current: 1 }, training: { totalRequired: 1, current: 1 } },
    { id: "p3", firstName: "New", lastName: "Nina", approvalStatus: "pending", competence: { totalRequired: 1, current: 1 }, training: { totalRequired: 1, current: 1 } }]);
  const cp = definitionFor("/api/contractor/people?companyId=c1")!;
  const loaded = await cp.load!("/api/contractor/people?companyId=c1", get);
  const cb = cp.build(loaded, new URLSearchParams("companyId=c1"));
  ok(cb.notes[0] === "Company: Harbour Ltd" && cb.tables[0].rows[0].company === "Harbour Ltd", "the company is named from the list of companies");
  ok(cb.tables[0].rows.map(r => r.status).join() === "Active,Left,Waiting for approval" && cb.tables[0].rows[0].readiness === "Not ready" && cb.tables[0].rows[1].readiness === "Left", "status and readiness are in plain words");
  const dd = build("/api/contractor/declarations", { rows: [{ id: "d", kind: "competence", status: "revoked", achievedAt: "2026-05-05 15:45:03.265", expiryDate: "2027-07-13 15:45:03.265", certificateRef: "X-1", declaredAt: "2026-11-21 15:44:47.462547", revokedAt: null, firstName: "Dev", lastName: "Patel", companyName: "Harbour Ltd", what: "OPS-03", declaredByName: "Carla" }] });
  ok(dd.tables[0].rows[0].achieved === "2026-05-05T15:45:03.265Z" && dd.tables[0].rows[0].status === "Revoked" && !Number.isNaN(Date.parse(dd.tables[0].rows[0].declared)), "database times become proper dates", dd.tables[0].rows[0]);

  console.log("Audit log");
  const al = definitionFor("/api/audit-log?actorId=x")!;
  const pagesAsked: string[] = [];
  const events = (n: number, off: number) => Array.from({ length: n }, (_, i) => ({ id: `e${off + i}`, occurredAt: "2026-11-21T20:52:18.883Z", actorName: "A", actorRole: "admin", action: "Did a thing", entityType: "x", entityLabel: "y", summary: "s", statusCode: 200, ipAddress: "1.2.3.4" }));
  const pager = async (u: string) => { pagesAsked.push(u); const q = new URLSearchParams(u.split("?")[1]); const off = Number(q.get("offset")), lim = Number(q.get("limit")); return { events: events(Math.min(lim, 1200 - off), off), total: 1200, limit: lim, offset: off }; };
  const got: any = await al.load!("/api/audit-log?actorId=x&offset=40&limit=10", pager);
  ok(got.events.length === 1200 && pagesAsked.length === 3, "a long log is read 500 at a time until it is all read", [got.events.length, pagesAsked.length]);
  ok(pagesAsked.every(u => u.includes("actorId=x")) && pagesAsked[0].includes("offset=0") && pagesAsked[0].includes("limit=500"), "the page's own filters are kept, and it starts from the newest");
  const huge = async (u: string) => { const off = Number(new URLSearchParams(u.split("?")[1]).get("offset")); return { events: events(500, off), total: 90000 }; };
  const capped: any = await al.load!("/api/audit-log", huge);
  ok(capped.events.length === 5000, "no more than 5,000 events are taken", capped.events.length);
  const ab = al.build(capped, new URLSearchParams());
  ok(ab.notes.length === 1 && /5,000 of 90,000/.test(ab.notes[0]), "the report says plainly that it is the newest part", ab.notes);
  ok(ab.tables[0].rows[0].outcome === "Done", "the outcome is Done, Refused or Failed");
  ok(al.build({ events: [{ ...events(1, 0)[0], statusCode: 403 }, { ...events(1, 0)[0], statusCode: 500 }], total: 2 }, new URLSearchParams()).tables[0].rows.map(r => r.outcome).join() === "Refused,Failed", "refusals and failures are told apart");
  ok((await al.load!("/api/audit-log", async () => null)) === null, "if the log cannot be read the layout gives up quietly");

  console.log("Excel and infographic from a layout");
  const all = [...ce.tables, ...cd.tables, ...st.tables].map((t, i) => ({ ...t, id: `t${i + 1}` }));
  const wb = XLSX.read(await buildWorkbook(all, { title: "Layouts", pagePath: "/x", preparedFor: "Test", role: "admin", generatedAt: new Date("2026-11-22T10:00:00Z"), filters: ce.notes }), { type: "buffer" });
  ok(wb.SheetNames.length === all.length + 1, "the workbook has the front sheet and one sheet for each table", wb.SheetNames);
  const peopleSheet = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames.find(n => /People/.test(n))!], { range: 3 });
  ok(peopleSheet.length === 4 && peopleSheet[1]["Readiness"] === "Not ready" && peopleSheet[1]["Competence percentage"] !== undefined, "Excel holds the same people with their readiness", peopleSheet[1]);
  const cdTables = cd.tables.map((t, i) => ({ ...t, id: `t${i + 1}` }));
  const info = buildByRules(profileTables(cdTables), "Competence Detail", "Test", new Date("2026-11-22T10:00:00Z"));
  ok(profileTables(cdTables).length === 1 && profileTables(cdTables)[0].name === "Gaps and expiries", "the infographic reads the gaps list, not the matrix");
  ok(info.charts.some(c => /status/i.test(c.title)), "it charts the statuses", info.charts.map(c => c.title));
  const ceTables = ce.tables.map((t, i) => ({ ...t, id: `t${i + 1}` }));
  const ceInfo = buildByRules(profileTables(ceTables), "Compliance Explorer", "Test", new Date("2026-11-22T10:00:00Z"), ceTables.filter(t => t.kind === "figures"));
  ok(ceInfo.charts.some(c => /readiness/i.test(c.title) && c.data.some(d => d.label === "Not ready" && d.value === 1)), "the readiness chart counts the not-ready people", ceInfo.charts.map(c => c.title));
  ok(ceInfo.keyFigures.some(f => /Training compliance/.test(f.label) && f.value === "61%"), "the page's own headline percentages are key figures", ceInfo.keyFigures);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
