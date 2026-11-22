// Scheduled reports, against a running demo server (port 5056, LOCAL_DEV_AUTH=true SESSION_SECRET=test NODE_ENV=development, no ANTHROPIC_API_KEY, no email set up)
// and the demo database. Covers who may schedule, whose schedule is whose, the due-run (claimed once, as the right person, blocked when they should be) and the email log.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test";
import pg from "pg";
const { Pool } = pg;
import { DbStorage } from "../../server/storage";
import { runDueSchedules, runScheduleNow } from "../../server/services/reportSchedule";
import { makeRunnerPass, RUNNER_HEADER } from "../../server/services/reportRunnerAuth";

const B = "http://localhost:5056";
let pass = 0, fail = 0, cookie = "";
const ok = (c: boolean, m: string, x?: unknown) => { if (c) { pass++; console.log("  PASS", m); } else { fail++; console.log("  FAIL", m, x !== undefined ? JSON.stringify(x).slice(0, 400) : ""); } };
const raw = async (m: string, p: string, b?: unknown) => {
  const r = await fetch(B + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  return r;
};
const call = async (m: string, p: string, b?: unknown) => { const r = await raw(m, p, b); const t = await r.text(); let j: any; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const as = async <T>(id: string, fn: () => Promise<T>): Promise<T> => { await call("POST", "/api/auth/impersonate", { userId: id }); try { return await fn(); } finally { await call("POST", "/api/auth/stop-impersonating"); } };

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s: string, a: unknown[] = []) => (await pool.query(s, a)).rows;
  const storage = new DbStorage();
  const mgrs = await q("select manager_id id from users where manager_id is not null group by 1 order by count(*) desc limit 2");
  const MANAGER = mgrs[0].id as string, OTHER = mgrs[1].id as string;
  const CAND = (await q("select id from users where role='candidate' and coalesce(employment_type,'employee')='employee' and is_active is not false limit 1"))[0].id as string;
  const made: string[] = [];
  const tempUsers: string[] = [];
  const URLS = ["/api/user-skills", "/api/reports/compliance-explorer"];
  const prepare = (title = "Team readiness") => call("POST", "/api/export/prepare", { path: "/compliance-explorer", title, urls: URLS });
  const make = async (over: Record<string, unknown> = {}) => { const p = await prepare(); const r = await call("POST", "/api/report-schedules", { exportId: p.j.id, frequency: "weekly", weekday: 1, hour: 7, timezone: "Europe/London", ...over }); if (r.s === 201) made.push(r.j.id); return r; };
  const logs = async (since: Date) => q("select * from notification_logs where type_key='scheduled_report' and created_at >= $1::timestamptz order by created_at", [since]);
  const start = new Date(Date.now() - 60000);
  const total = async () => (await q("select count(*)::int n from notification_logs where type_key='scheduled_report'"))[0].n as number;
  const newest = async (n: number) => q("select recipient_id, status from notification_logs where type_key='scheduled_report' order by created_at desc limit $1", [n]);

  try {
    console.log("Who may schedule");
    ok((await as(CAND, () => call("GET", "/api/report-schedules"))).s === 403, "a candidate cannot");
    ok((await as("demo-dan", () => call("GET", "/api/report-schedules"))).s === 403, "nor an assessor");
    ok((await as("demo-neil", () => call("POST", "/api/report-schedules", { exportId: "x".repeat(20), frequency: "weekly" }))).s === 403, "nor a verifier");

    console.log("Making one");
    const m1 = await as(MANAGER, () => make());
    ok(m1.s === 201 && m1.j.id && m1.j.mine === true && m1.j.enabled === true, "a manager can schedule an open export", m1);
    ok(m1.j.when === "Every Monday at 07:00 (Europe/London)" && new Date(m1.j.nextRunAt).getTime() > Date.now() && new Date(m1.j.nextRunAt).getTime() < Date.now() + 8 * 86400000, "it is due within the next week, at the time chosen", m1.j);
    const row1 = (await q("select * from report_schedules where id=$1", [m1.j.id]))[0];
    ok(row1.user_id === MANAGER && JSON.stringify(row1.urls) === JSON.stringify(URLS) && row1.format === "both" && row1.use_ai === false, "it is stored for that manager, with the page's own data addresses");
    ok((await as(MANAGER, () => call("POST", "/api/report-schedules", { exportId: "no-such-export-xx", frequency: "weekly" }))).s === 410, "an export that is not open (or is someone else's) cannot be scheduled");
    const otherExport = (await as(OTHER, () => prepare())).j.id;
    ok((await as(MANAGER, () => call("POST", "/api/report-schedules", { exportId: otherExport, frequency: "weekly" }))).s === 410, "nor can another person's open export");
    for (const [label, body] of [["a daily frequency", { frequency: "daily" }], ["hour 24", { hour: 24 }], ["day 31", { frequency: "monthly", dayOfMonth: 31 }], ["weekday 7", { weekday: 7 }], ["a format that does not exist", { format: "pdf" }]] as const) {
      const p = await as(MANAGER, () => prepare());
      ok((await as(MANAGER, () => call("POST", "/api/report-schedules", { exportId: p.j.id, frequency: "weekly", ...body }))).s === 400, `${label} is refused`);
    }
    const bad = await as(MANAGER, () => make({ timezone: "Nowhere/Land" }));
    ok(bad.s === 201 && bad.j.timezone === "Europe/London", "a made-up time zone is replaced by London");
    ok((await as(MANAGER, () => make({ useAi: true }))).j.useAi === false, "AI is not switched on without a key, even if asked");

    console.log("Whose is whose");
    const mine = await as(MANAGER, () => call("GET", "/api/report-schedules"));
    ok(mine.j.schedules.length === 3 && mine.j.schedules.every((s: any) => s.mine) && mine.j.canSeeAll === false, "the manager sees their own, and cannot ask for everyone's", mine.j.schedules.length);
    ok((await as(MANAGER, () => call("GET", "/api/report-schedules?all=1"))).j.schedules.length === 3, "?all=1 does nothing for a manager");
    ok((await as(OTHER, () => call("GET", "/api/report-schedules"))).j.schedules.length === 0, "another manager sees none of them");
    for (const [m, path, body] of [["PATCH", `/api/report-schedules/${m1.j.id}`, { hour: 9 }], ["DELETE", `/api/report-schedules/${m1.j.id}`, undefined], ["POST", `/api/report-schedules/${m1.j.id}/send-now`, {}]] as const)
      ok((await as(OTHER, () => call(m, path, body))).s === 404, `another manager cannot ${m === "PATCH" ? "change" : m === "DELETE" ? "delete" : "send"} it`);
    const adminAll = await call("GET", "/api/report-schedules?all=1");
    ok(adminAll.s === 200 && adminAll.j.canSeeAll === true && adminAll.j.schedules.some((s: any) => s.id === m1.j.id && s.mine === false && s.owner), "an administrator can see everyone's, with the owner's name", adminAll.j.schedules?.[0]);
    ok((await call("GET", "/api/report-schedules")).j.schedules.every((s: any) => s.mine), "but their normal list is only their own");
    ok((await call("PATCH", `/api/report-schedules/${m1.j.id}`, { hour: 9 })).s === 403, "an administrator cannot change someone else's");
    ok((await call("PATCH", `/api/report-schedules/${m1.j.id}`, { enabled: true })).s === 403 && (await call("POST", `/api/report-schedules/${m1.j.id}/send-now`, {})).s === 404, "cannot resume it or send it either");
    ok((await call("PATCH", `/api/report-schedules/${m1.j.id}`, { enabled: false })).j.enabled === false, "but can pause it");

    console.log("Changing one");
    const resumed = await as(MANAGER, () => call("PATCH", `/api/report-schedules/${m1.j.id}`, { enabled: true, hour: 9, frequency: "monthly", dayOfMonth: 15 }));
    ok(resumed.s === 200 && resumed.j.enabled === true && resumed.j.when === "On day 15 of every month at 09:00 (Europe/London)", "the owner can resume and re-time it", resumed.j);
    const nx = new Date(resumed.j.nextRunAt);
    ok(nx.getUTCDate() === 15 && nx.getTime() > Date.now(), "the next run moves to the new time", resumed.j.nextRunAt);
    ok((await as(MANAGER, () => call("PATCH", `/api/report-schedules/${m1.j.id}`, { format: "summary" }))).j.format === "summary", "the format can be changed");
    ok((await as(MANAGER, () => call("PATCH", `/api/report-schedules/${m1.j.id}`, { hour: 99 }))).s === 400, "an impossible time is refused");

    console.log("Send now (no email is set up here, so it is recorded but not sent)");
    const sn = await as(MANAGER, () => call("POST", `/api/report-schedules/${m1.j.id}/send-now`, {}));
    ok(sn.s === 200 && sn.j.status === "not_sent" && /Email is not set up/i.test(sn.j.message), "the result says plainly that it was not sent", sn.j);
    const l1 = await logs(start);
    ok(l1.length === 1 && l1[0].status === "skipped" && l1[0].recipient_id === MANAGER, "it was recorded in the email log, to the manager only", l1.map(x => [x.status, x.recipient_id]));
    ok(/CAPERA REPORT/.test(l1[0].body) && /Hello /.test(l1[0].body), "the email body has the summary", l1[0].body.slice(0, 300));
    const summaryPart = String(l1[0].body).split("CAPERA REPORT")[1] ?? "";
    ok(summaryPart.length > 300 && !/Marsh|Patel|Bellamy|Dunmore|Abbott|@example\.com/.test(summaryPart), "and, apart from the greeting, no names or email addresses");
    const afterSend = (await q("select * from report_schedules where id=$1", [m1.j.id]))[0];
    ok(afterSend.last_status === "not_sent" && afterSend.last_run_at && afterSend.next_run_at.getTime() === nx.getTime(), "the schedule shows the result, and sending now does not move the next run");

    console.log("The pass reads as the right person");
    const skillsAsManager = (await as(MANAGER, () => call("GET", "/api/user-skills"))).j.length;
    const adminSkills = (await call("GET", "/api/user-skills")).j.length;
    const withPass = async (id: string) => { const r = await fetch(B + "/api/user-skills", { headers: { [RUNNER_HEADER]: makeRunnerPass(id) } }); return r.ok ? (await r.json()).length : r.status; };
    ok(skillsAsManager < adminSkills, "(the manager can see fewer people than an administrator)", [skillsAsManager, adminSkills]);
    ok((await withPass(MANAGER)) === skillsAsManager, "with the manager's pass the data is the manager's, exactly as at their screen");
    ok((await withPass(CAND)) !== adminSkills, "a pass for someone else gets that person's view, not the administrator's");
    const who = await fetch(B + "/api/auth/user", { headers: { [RUNNER_HEADER]: makeRunnerPass(MANAGER) } }).then(r => r.json());
    ok(who.id === MANAGER, "the server sees the call as coming from that manager", who.id);

    console.log("The due run");
    await pool.query("update report_schedules set next_run_at = now() - interval '1 hour', enabled = true, format='both' where id=$1", [m1.j.id]);
    const ctx = { storage, base: B };
    const before = new Date();
    const n0 = await total();
    const [a, b2] = await Promise.all([runDueSchedules(ctx), runDueSchedules(ctx)]);
    ok(a.claimed + b2.claimed === 1, "two servers looking at the same moment claim it once between them", [a, b2]);
    const ran = (await q("select * from report_schedules where id=$1", [m1.j.id]))[0];
    ok(ran.next_run_at.getTime() > Date.now() && ran.last_run_at.getTime() >= before.getTime() - 1000 && ran.last_status === "not_sent", "it moves on to the next time and records the run", [ran.next_run_at, ran.last_status]);
    ok((await runDueSchedules(ctx)).claimed === 0, "a second look finds nothing due");
    ok((await total()) - n0 === 1, "exactly one email was made", (await total()) - n0);

    await pool.query("update report_schedules set next_run_at = now() - interval '40 days' where id=$1", [m1.j.id]);
    await runDueSchedules(ctx);
    ok((await total()) - n0 === 2, "after a long stop it is sent once, not once for every missed run");

    await pool.query("update report_schedules set next_run_at = now() - interval '1 hour', enabled = false where id=$1", [m1.j.id]);
    ok((await runDueSchedules(ctx)).claimed === 0, "a paused one is left alone");

    console.log("When it must not be sent");
    const insertFor = async (userId: string, urls: string[] = URLS) => (await q("insert into report_schedules (user_id,title,page_path,urls,frequency,weekday,hour,timezone,format,enabled,next_run_at) values ($1,'Blocked test','/x',$2,'weekly',1,7,'Europe/London','both',true, now() - interval '1 hour') returning id", [userId, JSON.stringify(urls)]))[0].id as string;
    const idCand = await insertFor(CAND); made.push(idCand);
    const n3 = await total();
    await runDueSchedules(ctx);
    const cand = (await q("select * from report_schedules where id=$1", [idCand]))[0];
    ok(cand.last_status === "blocked" && /no longer have a manager/i.test(cand.last_message) && (await total()) === n3, "someone without the manager or administrator role gets nothing, and it says why", cand.last_message);

    const tempId = "e2e-closed-" + Date.now();
    await pool.query("insert into users (id,email,first_name,last_name,role,is_active,is_archived,left_at) values ($1,$2,'Closed','Person','manager',true,true, now() - interval '2 days')", [tempId, `${tempId}@example.com`]);
    tempUsers.push(tempId);
    const idClosed = await insertFor(tempId); made.push(idClosed);
    await runDueSchedules(ctx);
    const closed = (await q("select * from report_schedules where id=$1", [idClosed]))[0];
    ok(closed.last_status === "blocked" && /has left/i.test(closed.last_message), "someone who has left gets nothing", closed.last_message);

    const idEmpty = await insertFor(MANAGER, ["/api/this-does-not-exist"]); made.push(idEmpty);
    await runDueSchedules(ctx);
    const empty = (await q("select * from report_schedules where id=$1", [idEmpty]))[0];
    ok(empty.last_status === "failed" && /came back empty/i.test(empty.last_message), "a report that finds no data says so rather than sending an empty email", empty.last_message);

    console.log("The off switch and the wording");
    await call("PUT", "/api/notifications/rules/scheduled_report", { isEnabled: false });
    const off = await as(MANAGER, () => call("POST", `/api/report-schedules/${m1.j.id}/send-now`, {}));
    ok(off.j.status === "not_sent" && /switched off/i.test(off.j.message), "when an administrator switches scheduled reports off none are sent", off.j);
    const put = await call("PUT", "/api/notifications/rules/scheduled_report", { isEnabled: true, alsoRoles: ["admin"], alsoUserIds: [OTHER] });
    ok(put.s === 200 && put.j.alsoUserIds.includes(OTHER), "(extra recipients were added to the rule)", put);
    const n2 = await total();
    await as(MANAGER, () => call("POST", `/api/report-schedules/${m1.j.id}/send-now`, {}));
    const l2 = await newest((await total()) - n2);
    ok(l2.length === 1 && l2[0].recipient_id === MANAGER, "extra recipients added to the rule are ignored: it goes only to the person who set it up", l2.map(x => x.recipient_id));
    await call("POST", "/api/notifications/rules/scheduled_report/reset");

    console.log("Deleting");
    ok((await as(MANAGER, () => call("DELETE", `/api/report-schedules/${m1.j.id}`))).j.ok === true && (await q("select 1 from report_schedules where id=$1", [m1.j.id])).length === 0, "the owner can delete it");
    const m2 = made.find(id => id !== m1.j.id && id !== idCand && id !== idClosed && id !== idEmpty)!;
    ok((await call("DELETE", `/api/report-schedules/${m2}`)).j.ok === true, "an administrator can delete anyone's");

    console.log("The limit");
    const batch = await as(MANAGER, async () => { const out = []; for (let i = 0; i < 11; i++) out.push((await make()).s); return out; });
    ok(batch.filter(s => s === 201).length >= 1 && batch.includes(409), "no more than ten each", batch);

    console.log("The audit trail");
    const ev = await q("select action from audit_events where actor_id=$1 and occurred_at >= $2::timestamptz", [MANAGER, start]).catch(() => [] as any[]);
    ok(ev.some((e: any) => e.action === "Scheduled a report") && ev.some((e: any) => e.action === "Deleted a scheduled report"), "making and deleting are in the audit log", ev.map((e: any) => e.action));
  } finally {
    if (made.length) await pool.query("delete from report_schedules where id = any($1)", [made]).catch(() => {});
    await pool.query("delete from report_schedules where user_id = $1 and title in ('Team readiness','Blocked test')", [MANAGER]).catch(() => {});
    await pool.query("delete from notification_rules where type_key='scheduled_report'").catch(() => {});
    await pool.query("delete from notification_logs where type_key='scheduled_report' and created_at >= $1::timestamptz", [start]).catch(() => {});
    if (tempUsers.length) await pool.query("delete from users where id = any($1)", [tempUsers]).catch(() => {});
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
