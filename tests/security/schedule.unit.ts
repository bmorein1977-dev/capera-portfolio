// Scheduled reports, without a server: when the next one is due (including clock changes and other time zones), the pass a scheduled report reads its data with,
// and the email it sends.
import { nextRunAfter, describeWhen, validTimezone, type When } from "../../server/services/reportScheduleTime";
import { makeRunnerPass, runnerUserId, RUNNER_HEADER } from "../../server/services/reportRunnerAuth";
import { renderSummaryHtml } from "../../server/services/reportEmail";
import { buildByRules, profileTables } from "../../server/services/reportInfographic";
import type { Table } from "../../server/services/reportData";

process.env.SESSION_SECRET = "unit-test-secret";
let pass = 0, fail = 0;
const ok = (c: boolean, m: string, x?: unknown) => { if (c) { pass++; console.log("  PASS", m); } else { fail++; console.log("  FAIL", m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ""); } };
const iso = (d: Date) => d.toISOString();
const W = (o: Partial<When>): When => ({ frequency: "weekly", weekday: 1, dayOfMonth: 1, hour: 7, timezone: "Europe/London", ...o });

console.log("When is the next one");
ok(iso(nextRunAfter(W({}), new Date("2026-11-18T12:00:00Z"))) === "2026-11-23T07:00:00.000Z", "weekly on Monday at 07:00 in winter is 07:00 UTC");
ok(iso(nextRunAfter(W({}), new Date("2026-07-01T12:00:00Z"))) === "2026-07-06T06:00:00.000Z", "the same report in summer is 06:00 UTC, so it still lands at 07:00 local");
ok(iso(nextRunAfter(W({}), new Date("2026-11-23T07:00:00Z"))) === "2026-11-30T07:00:00.000Z", "it is always strictly after now, so the run that just happened is not repeated");
ok(iso(nextRunAfter(W({}), new Date("2026-11-23T06:59:59Z"))) === "2026-11-23T07:00:00.000Z", "a run due in the next second is still today's");
ok(iso(nextRunAfter(W({ frequency: "monthly", dayOfMonth: 1 }), new Date("2026-11-22T10:00:00Z"))) === "2026-12-01T07:00:00.000Z", "monthly on the 1st");
ok(iso(nextRunAfter(W({ frequency: "monthly", dayOfMonth: 28 }), new Date("2027-02-10T10:00:00Z"))) === "2027-02-28T07:00:00.000Z", "the 28th exists in every month, February included");
ok(iso(nextRunAfter(W({ frequency: "monthly", dayOfMonth: 15 }), new Date("2026-12-20T10:00:00Z"))) === "2027-01-15T07:00:00.000Z", "monthly rolls over into the next year");
ok(iso(nextRunAfter(W({ weekday: 0 }), new Date("2026-10-20T10:00:00Z"))) === "2026-10-25T07:00:00.000Z", "the Sunday the clocks go back is 07:00 local, which is 07:00 UTC");
ok(iso(nextRunAfter(W({ weekday: 0 }), new Date("2026-10-13T10:00:00Z"))) === "2026-10-18T06:00:00.000Z", "the Sunday before is 07:00 local, which is 06:00 UTC");
ok(iso(nextRunAfter(W({ weekday: 0 }), new Date("2026-03-24T10:00:00Z"))) === "2026-03-29T06:00:00.000Z", "the Sunday the clocks go forward is 07:00 local, which is 06:00 UTC");
ok(iso(nextRunAfter(W({ frequency: "monthly", dayOfMonth: 15, hour: 9, timezone: "America/New_York" }), new Date("2026-03-01T10:00:00Z"))) === "2026-03-15T13:00:00.000Z", "another time zone, with its own clock change");
ok(iso(nextRunAfter(W({ hour: 0 }), new Date("2026-11-18T12:00:00Z"))) === "2026-11-23T00:00:00.000Z", "midnight works");
ok(iso(nextRunAfter(W({ hour: 23, timezone: "Asia/Tokyo" }), new Date("2026-11-18T12:00:00Z"))) === "2026-11-23T14:00:00.000Z", "a zone far ahead of UTC (Monday 23:00 in Tokyo is Monday 14:00 UTC)");
ok(validTimezone("Nowhere/Land") === "Europe/London" && validTimezone(undefined) === "Europe/London" && validTimezone("Asia/Tokyo") === "Asia/Tokyo" && validTimezone("x".repeat(200)) === "Europe/London", "a made-up time zone falls back to London");
ok(describeWhen(W({})) === "Every Monday at 07:00 (Europe/London)" && describeWhen(W({ frequency: "monthly", dayOfMonth: 15, hour: 9, timezone: "America/New_York" })) === "On day 15 of every month at 09:00 (America/New York)", "the schedule is described in words");
let last = nextRunAfter(W({ weekday: 3, hour: 6 }), new Date("2026-01-01T00:00:00Z")), steady = true;
for (let i = 0; i < 120; i++) { const n = nextRunAfter(W({ weekday: 3, hour: 6 }), last); if (n <= last || Math.abs(n.getTime() - last.getTime() - 7 * 86400000) > 3600000 + 1000) steady = false; last = n; }
ok(steady, "120 weekly runs in a row, through every clock change, never repeat and never skip a week");

console.log("The pass a scheduled report reads with");
const req = (headers: Record<string, any>, over: Record<string, any> = {}) => ({ headers, method: "GET", socket: { remoteAddress: "127.0.0.1" }, ...over });
const p = makeRunnerPass("user-1");
ok(runnerUserId(req({ [RUNNER_HEADER]: p })) === "user-1", "a pass made by the server is accepted, for the person it names");
ok(runnerUserId(req({ [RUNNER_HEADER]: p }, { socket: { remoteAddress: "::1" } })) === "user-1" && runnerUserId(req({ [RUNNER_HEADER]: p }, { socket: { remoteAddress: "::ffff:127.0.0.1" } })) === "user-1", "from the server's own address in any of its forms");
ok(runnerUserId(req({ [RUNNER_HEADER]: p }, { socket: { remoteAddress: "203.0.113.5" } })) === null, "refused from any other address");
ok(runnerUserId(req({ [RUNNER_HEADER]: p, "x-forwarded-for": "203.0.113.5" })) === null && runnerUserId(req({ [RUNNER_HEADER]: p, forwarded: "for=1.2.3.4" })) === null && runnerUserId(req({ [RUNNER_HEADER]: p, "x-real-ip": "1.2.3.4" })) === null, "refused when it came through a proxy from outside");
for (const m of ["POST", "PUT", "PATCH", "DELETE"]) ok(runnerUserId(req({ [RUNNER_HEADER]: p }, { method: m })) === null, `refused for ${m}: it can read, never change`);
const [payload, sig] = p.split(".");
const forged = Buffer.from(JSON.stringify({ u: "someone-else", e: Date.now() + 60000 })).toString("base64url");
ok(runnerUserId(req({ [RUNNER_HEADER]: `${forged}.${sig}` })) === null, "a pass cannot be moved to another person (the signature no longer fits)");
ok(runnerUserId(req({ [RUNNER_HEADER]: `${payload}.${sig.slice(0, -2)}AA` })) === null && runnerUserId(req({ [RUNNER_HEADER]: `${payload}.` })) === null && runnerUserId(req({ [RUNNER_HEADER]: payload })) === null && runnerUserId(req({ [RUNNER_HEADER]: `${p}.x` })) === null, "damaged or cut-short passes are refused");
ok(runnerUserId(req({ [RUNNER_HEADER]: p }), Date.now() + 3 * 60 * 1000) === null, "a pass runs out after two minutes");
const early = makeRunnerPass("user-1", Date.now() + 60 * 60 * 1000);
ok(runnerUserId(req({ [RUNNER_HEADER]: early })) === null, "a pass that claims a very long life is refused");
process.env.SESSION_SECRET = "a-different-secret";
ok(runnerUserId(req({ [RUNNER_HEADER]: p })) === null, "a pass made with another key is refused");
process.env.SESSION_SECRET = "unit-test-secret";
ok(runnerUserId({ headers: {}, method: "GET", socket: { remoteAddress: "127.0.0.1" } }) === null && runnerUserId({ headers: { [RUNNER_HEADER]: 5 as any }, method: "GET" }) === null, "no pass, or not text, means no one");
ok(runnerUserId(req({ [RUNNER_HEADER]: "x".repeat(2000) })) === null, "a huge value is refused without being looked at");
const dotted = makeRunnerPass("user.with.dots");
ok(runnerUserId(req({ [RUNNER_HEADER]: dotted })) === "user.with.dots", "an identifier with dots in it still works");

console.log("The email");
const table = (rows: Array<Record<string, any>>): Table => ({ id: "t1", name: "People", source: "/api/x", kind: "data", primary: true, truncated: false,
  columns: [{ key: "name", label: "Name", type: "text" }, { key: "status", label: "Readiness", type: "text" }, { key: "site", label: "Site", type: "text" }, { key: "pct", label: "Competence percentage", type: "percent" }], rows });
const rows = [
  { name: "Alice Secret", status: "Ready", site: "<script>alert(1)</script> North", pct: 95 }, { name: "Bob Private", status: "Not ready", site: "South", pct: 40 },
  { name: "Cara Hidden", status: "Not ready", site: "South", pct: 55 }, { name: "Dan Quiet", status: "Expiring soon", site: "North", pct: 80 },
];
const info = buildByRules(profileTables([table(rows)]), "Team <b>Readiness</b>", "Someone, manager", new Date("2026-11-22T10:00:00Z"));
const html = renderSummaryHtml(info);
ok(html.length > 500 && html.length < 60000, "the summary is a reasonable size", html.length);
ok(!/Alice|Bob|Cara|Dan|Secret|Private|Hidden|Quiet/.test(html), "no person's name is in the email body");
ok(!/<script|<img|<link|<iframe|javascript:|onerror|onload|https?:\/\//i.test(html), "nothing that email programs block or that could run: no scripts, pictures, links or frames");
ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt; North") || !html.includes("<script"), "text from the data is escaped");
ok(/Not ready/.test(html) && /Readiness/.test(html) && /What to do first/.test(html), "it names the not-ready group and what to do first");
ok(/width="\d+%" style="background:#/.test(html), "charts are drawn as bars made of table cells, which every email program shows");
ok((html.match(/<table/g) ?? []).length === (html.match(/<\/table>/g) ?? []).length, "every table is closed");
const evil = renderSummaryHtml({ ...info, title: "x", subtitle: "<img src=x onerror=alert(1)>", keyFigures: [{ label: "\"><script>", value: "1", tone: "risk" }], insights: [{ title: "<i>", text: "a & b", tone: "watch" }], nextSteps: ["<u>"], footnote: "<b>f</b>" });
ok(!/<img|<script|<i>|<u>|<b>f/.test(evil) && evil.includes("a &amp; b"), "even hand-made wording is escaped");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
