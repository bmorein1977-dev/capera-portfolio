// The reporting engine, without a server: which addresses may be read, how data becomes tables, what the AI is and is not allowed to say, and the workbook.
import ExcelJS from "exceljs";
import { allowedUrl, cleanUrls, toTables, pageFilters } from "../../server/services/reportData";
import { buildWorkbook } from "../../server/services/reportWorkbook";
import { profileTables, buildByRules, refineWithAi, valueOf, cleanText } from "../../server/services/reportInfographic";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string, x?: unknown) => { if (c) { pass++; console.log("  PASS", m); } else { fail++; console.log("  FAIL", m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ""); } };

(async () => {
  console.log("Which addresses can be read");
  ok(allowedUrl("/api/reports/compliance-explorer?status=expired&limit=10"), "an ordinary data address is allowed");
  for (const bad of ["/api/auth/user", "/api/users/abc/cv", "/api/assessment-evidence/x/download", "/api/export/prepare", "/api/login", "/api/../etc/passwd", "//evil.example/api/x", "https://evil.example/api/x", "/other/api", "/api/users?x=<script>", "/api/audit-log/export", "/api/test-object-storage", "/api/users/x/avatar"]) ok(!allowedUrl(bad), `refused: ${bad}`);
  ok(cleanUrls(["/api/a", "/api/a", "/api/auth/user", 5, "/api/b"]).join() === "/api/a,/api/b", "a list is de-duplicated and cleaned");
  ok(cleanUrls(Array.from({ length: 40 }, (_, i) => `/api/x${i}`)).length === 14, "no more than 14 are read for one page");
  ok(pageFilters(["/api/r?status=expired&limit=5&locationId=abc"]).join("|") === "Status: expired|Location ID: abc", "filters are listed (paging is not a filter)", pageFilters(["/api/r?status=expired&limit=5&locationId=abc"]));

  console.log("Turning responses into tables");
  const list = [{ id: "u1", firstName: "Ann", lastName: "Lee", status: "current", expiryDate: "2027-01-05T00:00:00.000Z", coveragePercentage: 80, isActive: true, user: { email: "a@x.com", providerSub: "SECRET", id: "u1" }, tags: ["a", "b"], items: [{}, {}] },
                { id: "u2", firstName: "Bo", lastName: "Ng", status: "expired", expiryDate: "2025-01-05T00:00:00.000Z", coveragePercentage: 40, isActive: true, user: { email: "b@x.com", providerSub: "SECRET", id: "u2" }, tags: [], items: [] }];
  const t = toTables("/api/reports/team-compliance", list, 1);
  ok(t.length === 1 && t[0].rows.length === 2, "a list of records is one table");
  const keys = t[0].columns.map(c => c.key);
  ok(!keys.includes("id") && !keys.includes("isActive") && !keys.some(k => /providerSub/i.test(k)), "identifiers, housekeeping and secrets are left out", keys);
  ok(t[0].columns.find(c => c.key === "expiryDate")!.type === "date" && t[0].columns.find(c => c.key === "coveragePercentage")!.type === "percent", "dates and percentages are recognised");
  ok(t[0].columns.find(c => c.key === "user.email")!.label === "User email" && t[0].rows[0]["tags"] === "a; b" && t[0].rows[0]["items (count)"] === 2, "nested values are flattened with readable headings", t[0].columns.map(c => c.label));
  const obj = toTables("/api/reports/summary", { headline: 12, statistics: { current: 5, expired: 2 }, people: [{ name: "x", status: "ok" }] }, 1);
  ok(obj.some(x => x.kind === "figures") && obj.some(x => x.rows.length === 1 && x.name.toLowerCase().includes("people")), "an object gives a figures table and a table per list inside it", obj.map(x => x.name));
  ok(toTables("/api/job-roles", [{ name: "A" }], 1)[0].kind === "reference", "lookup lists are marked as reference");

  console.log("The infographic: numbers are ours");
  const people = Array.from({ length: 30 }, (_, i) => ({ name: `Person ${i}`, jobRole: i % 3 ? "Operator" : "Technician", status: i < 6 ? "Expired" : i < 12 ? "Expiring" : "Current", expiryDate: new Date(Date.now() + (i - 8) * 86400000 * 9).toISOString(), email: `p${i}@x.com` }));
  const tables = toTables("/api/reports/people", people, 1);
  const prof = profileTables(tables);
  const cols = prof[0].columns.map(c => c.label);
  ok(prof[0].rows === 30 && cols.includes("Status") && cols.includes("Job role") && !cols.includes("Name") && !cols.includes("Email"), "names and emails are never profiled", cols);
  const sJson = JSON.stringify(prof);
  ok(!/Person \d|@x\.com/.test(sJson), "nothing that identifies a person is in what the AI would be sent");
  const statusRef = prof[0].columns.find(c => c.label === "Status")!.ref;
  ok(valueOf(prof, `count:${statusRef}.Expired`)?.num === 6 && valueOf(prof, `share:${statusRef}.Expired`)?.text === "20%" && valueOf(prof, "rows:t1")?.text === "30", "references resolve to counted values");
  ok(valueOf(prof, "count:t1.c99.Expired") === null && valueOf(prof, "rows:t9") === null, "unknown references resolve to nothing");
  ok(cleanText(prof, "There are 6 expired") === null, "a sentence with a bare number is thrown away");
  ok(cleanText(prof, `{{count:${statusRef}.Expired}} are expired`) === "6 are expired", "a reference is filled in");
  ok(cleanText(prof, "{{count:t1.c1.Nope}} are expired") === null, "a bad reference throws the sentence away");
  const draft = buildByRules(prof, "People", "Test, manager");
  ok(draft.charts.length >= 2 && draft.keyFigures.length >= 1 && draft.insights.some(i => /expired/i.test(i.text)), "the rule-based version has charts, figures and an insight about what is expired", draft.insights);
  ok(draft.charts.find(c => c.title === "Status")?.kind === "donut", "status is drawn as a donut");

  console.log("The AI refinement, with a stand-in for the AI");
  const fake = (payload: unknown) => ({ messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify(payload) }] }) } });
  const good = await refineWithAi(prof, draft, new Date(), fake({
    headline: "A third of people need attention", subtitle: "Compliance across the team",
    keyFigures: [{ label: "Expired", ref: `count:${statusRef}.Expired` }, { label: "Share expired", ref: `share:${statusRef}.Expired` }, { label: "People", ref: "rows:t1" }],
    charts: [{ ref: `counts:${statusRef}`, title: "Status", kind: "donut" }, { ref: "windows:t1.c3", title: "Expiry", kind: "column" }],
    insights: [{ title: "Expired items", text: `{{share:${statusRef}.Expired}} are expired.`, tone: "risk" }, { title: "Cheating", text: "Exactly 99 people are fine.", tone: "good" }, { title: "Bad ref", text: "{{count:t1.zz.Nope}} here", tone: "info" }],
    nextSteps: ["Chase the expired first.", "Review 12 more."],
  }));
  ok(!!good && good.aiUsed === true, "a good answer is used");
  ok(good!.keyFigures.map(f => f.value).join() === "6,20%,30", "key figure values are ours, not the AI's", good!.keyFigures);
  ok(good!.insights.length === 1 && good!.insights[0].text === "20% are expired.", "only the insight whose numbers came from references survives", good!.insights);
  ok(good!.nextSteps.length === 1 && good!.nextSteps[0] === "Chase the expired first.", "a next step with a typed number is dropped");
  ok(good!.charts.every(c => c.data.every(d => typeof d.value === "number")) && good!.charts.length >= 2, "charts are drawn from our counts");
  const junk = await refineWithAi(prof, draft, new Date(), { messages: { create: async () => ({ content: [{ type: "text", text: "not json at all" }] }) } });
  ok(junk === null, "an unreadable answer means the rule-based version is used");
  const thin = await refineWithAi(prof, draft, new Date(), fake({ headline: "x", keyFigures: [{ label: "bad", ref: "rows:t9" }], charts: [], insights: [], nextSteps: [] }));
  ok(!!thin && thin.keyFigures.length === draft.keyFigures.length && thin.charts.length === draft.charts.length, "too little from the AI keeps the rule-based parts");
  const boom = await refineWithAi(prof, draft, new Date(), { messages: { create: async () => { throw new Error("network"); } } });
  ok(boom === null, "an AI failure never breaks the infographic");

  console.log("The workbook");
  const wb = await buildWorkbook(tables.concat(toTables("/api/x", { measure: 4 }, 5)), { title: "People", pagePath: "/people", preparedFor: "Test User", role: "manager", generatedAt: new Date(), filters: ["Status: expired"] });
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const back = new ExcelJS.Workbook(); await back.xlsx.load(buf as any);
  ok(back.worksheets[0].name === "Report" && back.worksheets.length === 3, "a front sheet then one sheet per table", back.worksheets.map(w => w.name));
  const ws = back.worksheets[1];
  ok(ws.getRow(4).getCell(1).value === "Name" || typeof ws.getRow(4).getCell(1).value === "string", "headings are on row 4");
  const exp = ws.getRow(4).values as any[]; const expCol = exp.indexOf("Expiry date");
  ok(expCol > 0 && ws.getRow(5).getCell(expCol).value instanceof Date, "dates are real Excel dates", ws.getRow(5).getCell(expCol).value);
  ok(ws.rowCount >= 34, "every row is there", ws.rowCount);
  ok(JSON.stringify(ws.views).includes("frozen") && (ws as any).tables && Object.keys((ws as any).tables).length === 1, "headings are frozen and the data is a real Excel table");
  const front = back.worksheets[0]; const text = JSON.stringify(front.getSheetValues());
  ok(text.includes("Prepared for") && text.includes("Test User") && text.includes("Status: expired") && text.includes("Confidential"), "the front sheet says who, when, filters and confidentiality");
  const formula = await buildWorkbook(toTables("/api/f", [{ note: "=HYPERLINK(\"http://evil\",\"x\")", status: "ok" }, { note: "plain", status: "ok" }], 1), { title: "F", pagePath: "/f", preparedFor: "T", role: "admin", generatedAt: new Date(), filters: [] });
  const fb = new ExcelJS.Workbook(); await fb.xlsx.load(Buffer.from(await formula.xlsx.writeBuffer()) as any);
  const cell = fb.worksheets[1].getRow(5).getCell(1).value as any;
  ok(typeof cell === "string" && cell.startsWith("=HYPERLINK"), "a cell that looks like a formula is stored as text, not run", cell);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
