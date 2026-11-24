// Company-wide reports are cut down to the requester's own people (managers: their reporting lines at any depth; assessors and verifiers: their allocations),
// while administrators still see everyone. Against a running demo server (port 5056, LOCAL_DEV_AUTH=true, NODE_ENV=development) and the demo database.
const { Pool } = require('pg');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const raw = async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return r;
};
const call = async (m, p, b) => { const r = await raw(m, p, b); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const as = async (id, fn) => { await call('POST', '/api/auth/impersonate', { userId: id }); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const downline = async (id) => new Set((await q(`with recursive r(id) as (select id from users where manager_id=$1 or supervisor_id=$1 union select u.id from users u join r on u.manager_id=r.id or u.supervisor_id=r.id) select id from r`, [id])).map(r => r.id).concat([id]));
  const MANAGER = (await q("select manager_id id from users where manager_id is not null group by 1 order by count(*) desc limit 1"))[0].id;
  const mine = await downline(MANAGER);
  const ASSESSOR = 'demo-dan';
  const assessorMine = new Set((await q("select candidate_id id from candidate_allocations where assessor_id=$1 and is_active", [ASSESSOR])).map(r => r.id).concat([ASSESSOR]));
  try {
    console.log('Administrators still see everyone');
    const adminX = await call('GET', '/api/reports/compliance-explorer');
    const adminIds = new Set(adminX.j.people.map(p => p.userId));
    ok(adminX.s === 200 && adminIds.size > mine.size + 5, 'an administrator sees the whole company', [adminIds.size, mine.size]);
    const adminD = await call('GET', '/api/reports/competence-detail');
    ok(adminD.j.people.length === adminIds.size, 'and so does the competence detail report');

    console.log('A manager sees only their own team');
    const x = await as(MANAGER, () => call('GET', '/api/reports/compliance-explorer'));
    const xIds = x.j.people.map(p => p.userId);
    ok(x.s === 200 && xIds.length > 0 && xIds.length < adminIds.size, 'the Compliance Explorer shows fewer people', [xIds.length, adminIds.size]);
    ok(xIds.every(id => mine.has(id)), 'and every one of them is the manager or someone who reports to them (at any depth)', xIds.filter(id => !mine.has(id)));
    ok(x.j.totalMatched === xIds.length && x.j.byTeamShift.reduce((n, g) => n + g.headcount, 0) === xIds.length, 'the totals and the site breakdown are of that team only, not the company');
    ok(x.j.summary.competencePercentage !== adminX.j.summary.competencePercentage || x.j.summary.trainingPercentage !== adminX.j.summary.trainingPercentage, 'the headline percentages are the team\'s own');
    const d = await as(MANAGER, () => call('GET', '/api/reports/competence-detail'));
    ok(d.s === 200 && d.j.people.length === xIds.length && d.j.people.every(p => mine.has(p.userId)), 'Competence Detail shows the same team and no one else', d.j.people?.length);
    const outsider = adminX.j.people.find(p => !mine.has(p.userId) && p.jobRoleId && p.location);
    const byId = await as(MANAGER, () => call('GET', `/api/reports/compliance-explorer?candidateIds=${outsider.userId}`));
    ok(byId.s === 200 && byId.j.people.length === 0, 'asking for a named person outside the team returns nothing', byId.j.people?.length);
    const ov = await as(MANAGER, () => call('GET', '/api/reports/compliance-overview'));
    const adminOv = await call('GET', '/api/reports/compliance-overview');
    ok(ov.s === 200 && JSON.stringify(ov.j) !== JSON.stringify(adminOv.j), 'the compliance overview is the team\'s, not the company\'s', ov.s);
    const k = await as(MANAGER, () => call('GET', '/api/reports/element3-kpi'));
    const adminK = await call('GET', '/api/reports/element3-kpi');
    ok(k.s === 200 && JSON.stringify(k.j) !== JSON.stringify(adminK.j), 'the Element 3 KPIs are the team\'s, not the company\'s', k.s);
    const tcAdmin = await call('GET', `/api/team-compliance?roleId=${outsider.jobRoleId}&location=${encodeURIComponent(outsider.location)}`);
    const tc = await as(MANAGER, () => call('GET', `/api/team-compliance?roleId=${outsider.jobRoleId}&location=${encodeURIComponent(outsider.location)}`));
    ok(tcAdmin.s === 200 && JSON.stringify(tcAdmin.j.members).includes(outsider.userId) && tc.s === 200 && !JSON.stringify(tc.j.members).includes(outsider.userId), 'the team compliance matrix leaves out people outside the team (an administrator sees them)');

    console.log('Duty to operate: whole-site counts, own-team names');
    const stAdmin = await call('GET', '/api/staffing/status');
    const st = await as(MANAGER, () => call('GET', '/api/staffing/status'));
    ok(st.s === 200 && st.j.length === stAdmin.j.length && st.j.every((s, i) => s.actual === stAdmin.j[i].actual && s.required === stAdmin.j[i].required && s.status === stAdmin.j[i].status), 'every requirement shows the same counts and status as for an administrator (a shortfall is a shortfall)');
    const people = st.j.flatMap(s => s.people);
    ok(people.length === stAdmin.j.flatMap(s => s.people).length, 'with the same number of people counted');
    ok(people.every(p => p.name === 'Someone outside your team' ? !mine.has(p.userId) && p.userId.startsWith('outside-') : mine.has(p.userId)), 'but a person is named only if they are in the manager\'s team', people.filter(p => p.name !== 'Someone outside your team' && !mine.has(p.userId)).map(p => p.name));
    ok(people.some(p => p.name === 'Someone outside your team') || stAdmin.j.flatMap(s => s.people).every(p => mine.has(p.userId)), 'and the others are shown without a name or role');
    ok(st.j.every(s => (s.requirement.notifyUserIds ?? []).length === 0), 'the internal list of who is alerted is not shown to a manager');
    ok(stAdmin.j.flatMap(s => s.people).every(p => p.name !== 'Someone outside your team'), 'an administrator sees every name');

    console.log('The 360 people picker');
    const pAdmin = await call('GET', '/api/performance/people');
    const pMgr = await as(MANAGER, () => call('GET', '/api/performance/people'));
    ok(pMgr.s === 200 && pMgr.j.length < pAdmin.j.length && [...mine].filter(id => pAdmin.j.some(p => p.id === id)).every(id => pMgr.j.some(p => p.id === id)), 'a manager is offered their own team and some colleagues, not the whole company', [pMgr.j.length, pAdmin.j.length]);
    ok(!pMgr.j.some(p => p.id === outsider.userId) || outsider.location === (await q('select location from users where id=$1', [MANAGER]))[0].location, 'someone at another site, outside the team, is not offered');

    console.log('An assessor');
    const ax = await as(ASSESSOR, () => call('GET', '/api/reports/compliance-explorer'));
    ok(ax.s === 200 && ax.j.people.every(p => assessorMine.has(p.userId)), 'sees only themself and the candidates allocated to them', ax.j.people?.filter(p => !assessorMine.has(p.userId)).length);

    console.log('Export and scheduled reports follow the same limit');
    const prep = await as(MANAGER, () => call('POST', '/api/export/prepare', { path: '/compliance-explorer', title: 'Compliance Explorer', urls: ['/api/reports/compliance-explorer'] }));
    const people2 = prep.j.sources?.find(s => s.name === 'People');
    ok(prep.s === 200 && people2 && people2.rows === xIds.length, 'a manager\'s export holds only their team', [people2 && people2.rows, xIds.length]);
    const prepAdmin = await call('POST', '/api/export/prepare', { path: '/compliance-explorer', title: 'Compliance Explorer', urls: ['/api/reports/compliance-explorer'] });
    ok(prepAdmin.j.sources?.find(s => s.name === 'People')?.rows === adminIds.size, 'an administrator\'s export holds everyone');
  } finally { await pool.end(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
