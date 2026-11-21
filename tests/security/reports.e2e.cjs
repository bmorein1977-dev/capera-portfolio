// Export and infographics, against a running demo server (port 5056, LOCAL_DEV_AUTH=true NODE_ENV=development, no ANTHROPIC_API_KEY) and the demo database.
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const raw = async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return r;
};
const call = async (m, p, b) => { const r = await raw(m, p, b); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j, h: r.headers }; };
const as = async (id, fn) => { await call('POST', '/api/auth/impersonate', { userId: id }); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const MANAGER = (await q("select manager_id id from users where manager_id is not null group by 1 order by count(*) desc limit 1"))[0].id;
  const CAND = (await q("select id from users where role='candidate' and coalesce(employment_type,'employee')='employee' limit 1"))[0].id;
  const URLS = ['/api/user-skills', '/api/reports/compliance-explorer', '/api/job-roles'];
  try {
    console.log('Who may export');
    ok((await as(CAND, () => call('POST', '/api/export/prepare', { path: '/x', title: 'X', urls: URLS }))).s === 403, 'a candidate cannot');
    ok((await as('demo-dan', () => call('POST', '/api/export/prepare', { path: '/x', title: 'X', urls: URLS }))).s === 403, 'nor an assessor');
    ok((await as('demo-neil', () => call('POST', '/api/export/prepare', { path: '/x', title: 'X', urls: URLS }))).s === 403, 'nor a verifier');

    console.log('Preparing');
    const prep = await as(MANAGER, () => call('POST', '/api/export/prepare', { path: '/compliance-explorer', title: 'Compliance Explorer', urls: [...URLS, '/api/auth/user', `/api/users/${CAND}/cv`, '/api/export/xlsx', '/api/users'] }));
    ok(prep.s === 200 && prep.j.id && Array.isArray(prep.j.sources), 'a manager can prepare an export', prep);
    const names = prep.j.sources.map(s => s.name);
    ok(prep.j.sources.length >= 2 && prep.j.sources.every(s => s.rows > 0), 'the page data is found, with row counts', names);
    ok(prep.j.sources.some(s => s.kind === 'reference') && prep.j.sources.filter(s => s.defaultOn).every(s => s.kind !== 'reference'), 'lookup lists are offered but not chosen by default');
    ok(!JSON.stringify(prep.j).includes('/cv') && !names.some(n => /auth|export/i.test(n)), 'forbidden addresses were ignored');
    ok(prep.j.aiAvailable === false, 'AI is reported as not available without a key');
    // the manager's export holds exactly what the manager is allowed to read
    const direct = await as(MANAGER, () => call('GET', '/api/user-skills'));
    const skills = prep.j.sources.find(s => /skills/i.test(s.name));
    ok(skills && skills.rows === direct.j.length, "the number of rows equals what the manager's own screen gets (their people only)", [skills && skills.rows, direct.j.length]);
    const adminDirect = await call('GET', '/api/user-skills');
    ok(adminDirect.j.length >= direct.j.length, "(an administrator's own list is at least as big)", [adminDirect.j.length, direct.j.length]);
    ok((await as(MANAGER, () => call('POST', '/api/export/prepare', { path: '/x', title: 'X', urls: ['/api/auth/user', `/api/users/${CAND}/cv`] }))).s === 400, 'only forbidden addresses means nothing to export');
    ok((await as(MANAGER, () => call('POST', '/api/export/prepare', { path: '/x', title: 'X', urls: [] }))).s === 400, 'no addresses means nothing to export');
    ok((await as(MANAGER, () => call('POST', '/api/export/prepare', { path: '/x', title: 'X', urls: ['/api/reports/training-cost-activity'] }))).s === 404, "an address the manager is not allowed to read (training costs) yields nothing: their permissions apply");

    console.log('The workbook');
    const include = prep.j.sources.filter(s => s.defaultOn).map(s => s.id);
    const r = await as(MANAGER, () => raw('POST', '/api/export/xlsx', { id: prep.j.id, include }));
    ok(r.status === 200 && /spreadsheetml/.test(r.headers.get('content-type')) && /^attachment/.test(r.headers.get('content-disposition')) && /\.xlsx/.test(r.headers.get('content-disposition')) && r.headers.get('cache-control').includes('no-store'), 'it downloads as a private .xlsx file', [r.status, r.headers.get('content-disposition')]);
    const buf = Buffer.from(await r.arrayBuffer());
    ok(buf.length > 4000 && buf[0] === 0x50 && buf[1] === 0x4b, 'the file is a real zip-based workbook', buf.length);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    ok(wb.worksheets[0].name === 'Report' && wb.worksheets.length === include.length + 1, 'a front sheet and a sheet per chosen source', wb.worksheets.map(w => w.name));
    const data = wb.worksheets[1];
    ok(data.rowCount >= 5 && data.getRow(4).cellCount >= 2, 'the data sheet has headings and rows', data.rowCount);
    const front = JSON.stringify(wb.worksheets[0].getSheetValues());
    ok(/Compliance Explorer/.test(front) && /Confidential/.test(front), 'the front sheet names the page and carries the confidentiality note');
    // somebody else cannot use the manager's prepared export
    ok((await call('POST', '/api/export/xlsx', { id: prep.j.id, include })).s === 410, "another person cannot use someone else's prepared export");
    ok((await as(MANAGER, () => call('POST', '/api/export/xlsx', { id: 'nope', include }))).s === 410, 'an unknown export id is refused');
    ok((await as(MANAGER, () => call('POST', '/api/export/xlsx', { id: prep.j.id, include: ['t999'] }))).s === 400, 'choosing nothing that exists is refused');

    console.log('The infographic');
    const inf = await as(MANAGER, () => call('POST', '/api/export/infographic', { id: prep.j.id, include, ai: true }));
    ok(inf.s === 200 && inf.j.aiUsed === false && inf.j.charts.length >= 1 && inf.j.keyFigures.length >= 1, 'with no AI key it is still built, from the counted figures', inf.j && [inf.j.aiUsed, inf.j.charts && inf.j.charts.length]);
    ok(inf.j.charts.every(c => c.data.length && c.data.every(d => typeof d.value === 'number')) && !!inf.j.footnote && /Figures are counted/.test(inf.j.footnote), 'every chart has numbers and the footnote says where they come from');
    ok(!/@/.test(JSON.stringify(inf.j)), 'no email addresses appear in it');

    console.log('The audit log');
    await new Promise(r => setTimeout(r, 800));
    const ev = await q("select action, entity_label, summary from audit_events where action in ('Exported page data to Excel','Created an infographic','Created an AI infographic') and entity_label='Compliance Explorer' and occurred_at > now() at time zone 'utc' - interval '10 minutes'");
    ok(ev.some(e => e.action === 'Exported page data to Excel') && ev.some(e => e.action === 'Created an infographic'), 'each export and infographic is recorded', ev);
  } catch (e) {
    fail++; console.log('  ERROR', e && e.stack || e);
  } finally {
    try { await q("delete from audit_events where action in ('Exported page data to Excel','Created an infographic','Created an AI infographic') and entity_label='Compliance Explorer'"); } catch (e) { console.log('  cleanup problem', e.message); }
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
