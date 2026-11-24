// Security round three, against a running demo server (port 5056, LOCAL_DEV_AUTH=true, NODE_ENV=development) and the demo database:
//   1. every appraisal route refuses someone who has no part in the appraisal, and nothing changes
//   2. an administrator opening someone else's appraisal is written to the audit log
//   3. an external verifier's views are written to the audit log, and an allocation's end date really ends their access
//   4. (CONTENT_E2E=1, server started with CONTENT_ORIGIN=http://127.0.0.1:5056) learning packages are served only from the separate address
const { Pool } = require('pg');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const raw = async (m, p, b, base = B) => {
  const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(cookie && base === B ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b), redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (sc && base === B) cookie = sc.split(';')[0];
  return r;
};
const call = async (m, p, b, base) => { const r = await raw(m, p, b, base); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j, h: r.headers }; };
const as = async (id, fn) => { await call('POST', '/api/auth/impersonate', { userId: id }); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };
const refused = (r) => r.s === 403 || r.s === 404;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const views = async (where, a) => Number((await q(`select count(*)::int n from audit_events where action = 'view' and (${where})`, a))[0].n);
  const EVA = 'demo-ext-eva';
  const allocs = await q("select id, assessor_id from verifier_allocations where verifier_id = $1 and is_active order by assessor_id", [EVA]);
  try {
    // ------------------------------------------------------------------ 1. appraisal records
    console.log('Appraisal routes refuse people who have no part in the appraisal');
    const A = (await q("select a.id, a.user_id, a.manager_id from appraisals a join performance_cycles c on c.id = a.cycle_id where a.is_active and a.status = 'objectives' and c.status = 'open' and a.supervisor_id is null order by a.id limit 1"))[0];
    const outsiders = (await q("select id from users where id in ('demo-ian','demo-dan','demo-priya','demo-tom','demo-helen') and id <> $1 and id <> $2 and coalesce(manager_id,'') <> $1 limit 3", [A.user_id, A.manager_id])).map(r => r.id);
    ok(!!A && outsiders.length >= 2, 'found an appraisal and people outside it', { A, outsiders });
    const objective = await as(A.manager_id, () => call('POST', `/api/performance/appraisals/${A.id}/objectives`, { title: 'e2e objective', weighting: 100 }));
    ok(objective.s === 201 && objective.j.id, 'the line manager can add an objective (so there is a real one to attack)', objective);
    const before = {
      upd: (await q('select updated_at::text u from appraisals where id = $1', [A.id]))[0].u,
      obj: (await q('select count(*)::int n from performance_objectives where appraisal_id = $1 and is_active', [A.id]))[0].n,
      com: (await q('select count(*)::int n from appraisal_comments where appraisal_id = $1', [A.id]))[0].n,
      upds: (await q('select count(*)::int n from objective_updates where objective_id = $1', [objective.j.id]))[0].n,
    };
    const attacks = [
      ['GET', `/api/performance/appraisals/${A.id}`],
      ['POST', `/api/performance/appraisals/${A.id}/comments`, { body: 'hello' }],
      ['POST', `/api/performance/appraisals/${A.id}/objectives`, { title: 'injected', weighting: 10 }],
      ['PUT', `/api/performance/objectives/${objective.j.id}`, { title: 'changed', weighting: 50 }],
      ['DELETE', `/api/performance/objectives/${objective.j.id}`],
      ['POST', `/api/performance/objectives/${objective.j.id}/updates`, { note: 'note', progressPercent: 50 }],
      ['POST', `/api/performance/appraisals/${A.id}/agree-objectives`],
      ['POST', `/api/performance/appraisals/${A.id}/start-self-review`],
      ['PUT', `/api/performance/appraisals/${A.id}/self-review`, { overallComment: 'x' }],
      ['PUT', `/api/performance/appraisals/${A.id}/manager-review`, { managerSummary: 'x' }],
      ['POST', `/api/performance/appraisals/${A.id}/calibrate`, { potentialRating: 3 }],
      ['POST', `/api/performance/appraisals/${A.id}/share`, {}],
      ['POST', `/api/performance/appraisals/${A.id}/meeting`, {}],
      ['PUT', `/api/performance/appraisals/${A.id}/dates`, { objectivesDueDate: '2027-01-01' }],
      ['POST', `/api/performance/appraisals/${A.id}/sign-off`, { comments: 'x' }],
      ['POST', `/api/performance/appraisals/${A.id}/reopen`, { status: 'objectives' }],
      ['POST', `/api/performance/appraisals/${A.id}/raters`, { raterId: 'demo-claire', raterType: 'peer' }],
    ];
    for (const who of outsiders) {
      const results = await as(who, async () => { const out = []; for (const [m, p, b] of attacks) out.push([m, p, (await call(m, p, b)).s]); return out; });
      const bad = results.filter(([, , s]) => s !== 403 && s !== 404);
      ok(bad.length === 0, `${who}: all ${attacks.length} appraisal routes refuse them`, bad);
    }
    const after = {
      upd: (await q('select updated_at::text u from appraisals where id = $1', [A.id]))[0].u,
      obj: (await q('select count(*)::int n from performance_objectives where appraisal_id = $1 and is_active', [A.id]))[0].n,
      com: (await q('select count(*)::int n from appraisal_comments where appraisal_id = $1', [A.id]))[0].n,
      upds: (await q('select count(*)::int n from objective_updates where objective_id = $1', [objective.j.id]))[0].n,
    };
    ok(after.upd === before.upd && after.obj === before.obj && after.com === before.com && after.upds === before.upds, 'and nothing was changed, added or deleted', { before, after });
    const ob = (await q('select title, weighting from performance_objectives where id = $1', [objective.j.id]))[0];
    ok(ob && ob.title === 'e2e objective' && ob.weighting === 100, 'the objective is exactly as the manager left it');

    const emp = await as(A.user_id, () => call('GET', `/api/performance/appraisals/${A.id}`));
    ok(emp.s === 200 && !('scores' in emp.j.appraisal) && !('potentialRating' in emp.j.appraisal) && !('calibrationNote' in emp.j.appraisal), 'the person reviewed never receives the scores, potential rating or calibration note');
    const mgr = await as(A.manager_id, () => call('GET', `/api/performance/appraisals/${A.id}`));
    ok(mgr.s === 200 && mgr.j.permissions.isManager, 'the line manager can open it');
    const feedbackReq = (await q("select fr.id, fr.rater_id, fr.appraisal_id, a.user_id, a.manager_id from feedback_requests fr join appraisals a on a.id = fr.appraisal_id where fr.status = 'completed' limit 1"))[0];
    const involved = (await q("select user_id, manager_id, supervisor_id from appraisals where id = $1", [feedbackReq.appraisal_id]))[0];
    const stranger = (await q("select id from users where id in ('demo-dan','demo-priya','demo-tom','demo-helen','demo-ian') and id <> all($1) and role <> 'admin' limit 1", [[involved.user_id, involved.manager_id, involved.supervisor_id, feedbackReq.rater_id].filter(Boolean)]))[0].id;
    const fb = await as(stranger, async () => [(await call('GET', `/api/performance/feedback/${feedbackReq.id}`)).s, (await call('POST', `/api/performance/feedback/${feedbackReq.id}`, { ratings: [] })).s, (await call('POST', `/api/performance/feedback/${feedbackReq.id}/decline`)).s, (await call('DELETE', `/api/performance/raters/${feedbackReq.id}`)).s, (await call('POST', `/api/performance/raters/${feedbackReq.id}/decision`, { approve: true })).s]);
    ok(fb.every(s => s === 403 || s === 404), 'someone who was not asked cannot read, answer, decline, remove or approve another person\'s feedback request', fb);
    const own360 = await as(feedbackReq.user_id, () => call('GET', `/api/performance/appraisals/${feedbackReq.appraisal_id}`));
    ok(own360.s === 200 && own360.j.feedback && own360.j.feedback.summary.visible === false && !own360.j.feedback.summary.strengths, 'the person reviewed does not see their own 360 results');
    const mgr360 = await as(feedbackReq.manager_id, () => call('GET', `/api/performance/appraisals/${feedbackReq.appraisal_id}`));
    ok(mgr360.s === 200 && mgr360.j.feedback.summary.visible === true, 'their line manager does');
    const outsider360 = await as(stranger, () => call('GET', `/api/performance/appraisals/${feedbackReq.appraisal_id}`));
    ok(refused(outsider360), 'someone else cannot open the appraisal that holds the 360');

    console.log('Refused requests (403) are written to the audit log');
    await new Promise(r => setTimeout(r, 500));
    const refusedRows = (who) => q("select actor_id, actor_name, entity_type, summary, method, path, status_code, ip_address, acting_as_id from audit_events where action = 'refused' and (actor_id = $1 or acting_as_id = $1) order by occurred_at desc", [who]);
    const mine = await refusedRows(outsiders[0]);
    ok(mine.length >= 1, 'an outsider\'s refused attempts leave entries', mine.length);
    ok(mine.every(r => r.status_code === 403 && /was refused: (GET|POST|PUT|DELETE) \/api\//.test(r.summary)), 'each says who was refused and what they tried', mine[0]);
    ok(mine.every(r => !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(r.summary)), 'the summary names the route, not the record numbers', mine[0]?.summary);
    ok(mine.some(r => r.acting_as_id === outsiders[0]) && mine.every(r => r.actor_id === 'local-dev-admin' || r.actor_id === outsiders[0]), 'recorded as the real person, with who they were acting as', mine[0]);
    const refusedGet = await as(outsiders[0], () => call('GET', `/api/performance/appraisals/${A.id}`));
    if (refusedGet.s === 403) {
      const n0 = (await refusedRows(outsiders[0])).length;
      await as(outsiders[0], async () => { for (let i = 0; i < 4; i++) await call('GET', `/api/performance/appraisals/${A.id}`); });
      await new Promise(r => setTimeout(r, 400));
      ok((await refusedRows(outsiders[0])).length === n0, 'the same refusal repeated within a minute is one entry, not a flood', n0);
    } else console.log('  (appraisal GET answered', refusedGet.s, 'so the repeat test was skipped)');
    const mgrRefusedBefore = (await refusedRows(A.manager_id)).length;
    const readOk = await as(A.manager_id, () => call('GET', `/api/performance/appraisals/${A.id}`));
    await new Promise(r => setTimeout(r, 300));
    ok(readOk.s === 200 && (await refusedRows(A.manager_id)).length === mgrRefusedBefore, 'a request that is allowed leaves no refusal entry');
    const crossBefore = Number((await q("select count(*)::int n from audit_events where action = 'refused' and actor_id is null"))[0].n);
    const cross = await fetch(B + '/api/job-roles', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }, body: '{}' });
    await new Promise(r => setTimeout(r, 500));
    const crossAfter = await q("select summary, ip_address, status_code from audit_events where action = 'refused' and actor_id is null order by occurred_at desc limit 1");
    ok(cross.status === 403 && Number((await q("select count(*)::int n from audit_events where action = 'refused' and actor_id is null"))[0].n) === crossBefore + 1, 'a cross-site request refused before sign-in is also recorded (no person, with the address)', crossAfter[0]);
    const notFound = await call('GET', '/api/this-route-does-not-exist');
    await new Promise(r => setTimeout(r, 300));
    ok(notFound.s === 404 && (await q("select count(*)::int n from audit_events where action = 'refused' and path = '/api/this-route-does-not-exist'"))[0].n === 0, 'a 404 is not recorded as a refusal');

    console.log('An administrator opening someone else\'s appraisal is logged');
    const adminBefore = await views("entity_type = 'appraisal' and entity_id = $1", [feedbackReq.appraisal_id]);
    const adminOpen = await call('GET', `/api/performance/appraisals/${feedbackReq.appraisal_id}`);
    await new Promise(r => setTimeout(r, 400));
    const adminAfter = await views("entity_type = 'appraisal' and entity_id = $1", [feedbackReq.appraisal_id]);
    ok(adminOpen.s === 200 && adminAfter === adminBefore + 1, 'one "view" entry is written', [adminBefore, adminAfter]);
    const entry = (await q("select actor_id, actor_name, entity_label, summary from audit_events where action = 'view' and entity_id = $1 order by occurred_at desc limit 1", [feedbackReq.appraisal_id]))[0];
    ok(entry && /viewed an appraisal/.test(entry.summary) && entry.entity_label, 'saying who looked and at whose appraisal', entry);
    await as(feedbackReq.manager_id, () => call('GET', `/api/performance/appraisals/${feedbackReq.appraisal_id}`));
    await as(feedbackReq.user_id, () => call('GET', `/api/performance/appraisals/${feedbackReq.appraisal_id}`));
    await new Promise(r => setTimeout(r, 400));
    ok(await views("entity_type = 'appraisal' and entity_id = $1", [feedbackReq.appraisal_id]) === adminAfter, 'the person and their manager opening it leave nothing (they are its own people)');
    await as(objective.j.id ? A.manager_id : A.manager_id, () => call('DELETE', `/api/performance/objectives/${objective.j.id}`));

    // ------------------------------------------------------------------ 3. external verifier
    console.log('An external verifier\'s views are logged');
    ok(allocs.length >= 2, 'the demo external verifier has allocations', allocs);
    const list0 = await as(EVA, () => call('GET', '/api/external-verification/assessors'));
    ok(list0.s === 200 && list0.j.length === allocs.length, 'they see their allocated assessors', list0.j?.length);
    await new Promise(r => setTimeout(r, 500));
    const mark = Number((await q("select count(*)::int n from audit_events where action = 'view' and acting_as_id = $1", [EVA]))[0].n);
    const asList = await as(EVA, () => call('GET', '/api/external-verification/assessments'));
    ok(asList.s === 200 && asList.j.length > 0, 'and their assessments', asList.s);
    const one = asList.j[0];
    const detail = await as(EVA, () => call('GET', `/api/external-verification/assessments/${one.id}`));
    ok(detail.s === 200, 'and can open one', detail.s);
    await as(EVA, () => call('GET', '/api/auth/user'));
    await as(EVA, () => call('GET', '/api/job-roles'));
    await new Promise(r => setTimeout(r, 500));
    const rows = await q("select entity_type, entity_id, entity_label, summary, actor_id, acting_as_id from audit_events where action = 'view' and acting_as_id = $1 order by occurred_at desc limit 10", [EVA]);
    ok(rows.length - 0 >= 2 && (await views('acting_as_id = $1', [EVA])) === mark + 2, 'the list and the one they opened are each logged (and the page\'s own housekeeping and lookup lists are not)', [mark, rows.length]);
    const opened = rows.find(r => r.entity_id === one.id);
    ok(opened && opened.entity_type === 'assessment' && /viewed assessment/.test(opened.summary) && opened.entity_label && opened.acting_as_id === EVA, 'the entry names the assessment and the candidate', opened);
    const mgrMark = await views("actor_id = 'demo-tom' or acting_as_id = 'demo-tom'");
    await as('demo-tom', () => call('GET', '/api/reports/compliance-explorer'));
    await new Promise(r => setTimeout(r, 300));
    ok(await views("actor_id = 'demo-tom' or acting_as_id = 'demo-tom'") === mgrMark, 'ordinary people reading things are not logged (only outside bodies, and administrators opening appraisals)');

    console.log('An end date on an allocation ends the access');
    const [first, second] = allocs;
    const past = new Date(Date.now() - 3600_000).toISOString(), future = new Date(Date.now() + 7 * 86400_000).toISOString();
    // these routes need a real administrator sign-in (impersonating one does not count), so the local dev user is made a super administrator for this part only
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");
    const adm = (fn) => fn();
    const endIt = await adm(() => call('PATCH', `/api/verifier-allocations/${first.id}`, { endsOn: past }));
    ok(endIt.s === 200, 'an administrator sets an end date in the past', endIt);
    const liveList = await as(EVA, () => call('GET', '/api/external-verification/assessors'));
    ok(liveList.s === 200 && liveList.j.length === allocs.length - 1 && !liveList.j.some(a => a.id === first.assessor_id), 'the assessor drops out of their list at once', liveList.j?.map(a => a.id));
    const liveAs = await as(EVA, () => call('GET', '/api/external-verification/assessments'));
    ok(liveAs.s === 200 && !liveAs.j.some(a => a.assessorId === first.assessor_id), 'and their assessments disappear');
    const endedAssessment = (await q("select id, candidate_id from assessments where assessor_id = $1 and outcome is not null and coalesce(is_active, true) and not coalesce(is_assignment, false) limit 1", [first.assessor_id]))[0];
    if (endedAssessment) {
      const gone = await as(EVA, () => call('GET', `/api/external-verification/assessments/${endedAssessment.id}`));
      ok(gone.s === 404, 'opening one of them is "not found"', gone.s);
      const fbk = await as(EVA, () => call('GET', `/api/assessments/${endedAssessment.id}/feedback`));
      ok(fbk.s !== 200, 'and so is the assessment\'s comment thread', fbk.s);
      const ev = await as(EVA, () => call('GET', `/api/assessments/${endedAssessment.id}/evidence`));
      ok(ev.s !== 200 || (Array.isArray(ev.j) && ev.j.length === 0), 'and its evidence', ev.s);
    }
    const adminList = await adm(() => call('GET', '/api/verifier-allocations'));
    const shown = adminList.j.find(a => a.id === first.id);
    ok(adminList.s === 200 && shown && shown.endsOn, 'the administrator still sees the ended allocation (with its end date) so they can extend it', shown);
    const verifierView = await adm(() => call('GET', `/api/verifier-allocations?verifierId=${EVA}`));
    ok(verifierView.j.some(a => a.id === first.id), 'in the administrator\'s list');
    ok((await adm(() => call('PATCH', `/api/verifier-allocations/${first.id}`, { endsOn: future }))).s === 200, 'extending it to next week...');
    const back = await as(EVA, () => call('GET', '/api/external-verification/assessors'));
    ok(back.j.length === allocs.length, '...gives the access back');
    ok((await adm(() => call('PATCH', `/api/verifier-allocations/${first.id}`, { endsOn: 'not a date' }))).s === 400, 'a nonsense date is refused');
    ok((await adm(() => call('PATCH', `/api/verifier-allocations/${first.id}`, { endsOn: null }))).s === 200, 'clearing the date works');
    const created = await adm(() => call('POST', '/api/verifier-allocations', { verifierId: EVA, assessorId: 'demo-sophie', endsOn: past, allocatedBy: 'someone-else' }));
    ok(created.s === 201 && created.j.endsOn, 'an allocation can be created with an end date already set', created);
    const inList = await as(EVA, () => call('GET', '/api/external-verification/assessors'));
    ok(!inList.j.some(a => a.id === 'demo-sophie'), 'and one that has already ended gives nothing');
    ok(created.j.allocatedBy && created.j.allocatedBy !== 'someone-else', 'who allocated is taken from the signed-in administrator, not from the request', created.j.allocatedBy);
    await adm(() => call('DELETE', `/api/verifier-allocations/${created.j.id}`));

    console.log('An end date on the external verifier\'s account');
    const acc = (id, body) => adm(() => call('PATCH', `/api/users/${id}/access-end`, body));
    const readEnd = async () => (await q('select access_ends_on from users where id = $1', [EVA]))[0].access_ends_on;
    ok((await acc(EVA, { accessEndsOn: future })).s === 200 && (await readEnd()) && new Date(await readEnd()).getTime() > Date.now(), 'an administrator sets an account end date', await readEnd());
    const shownEnd = await adm(() => call('GET', '/api/users/by-effective-role/external_verifier'));
    ok(shownEnd.s === 200 && shownEnd.j.find(u => u.id === EVA)?.accessEndsOn, 'and the list of external verifiers shows it');
    const logged = (await q("select summary, changes from audit_events where entity_id = $1 and path like '%/access-end' order by occurred_at desc limit 1", [EVA]))[0];
    ok(logged && JSON.stringify(logged.changes).includes('accessEndsOn'), 'the change is in the audit log', logged);
    ok((await acc(EVA, { accessEndsOn: 'not a date' })).s === 400, 'a nonsense date is refused');
    ok((await acc('demo-tom', { accessEndsOn: future })).s === 400, 'it cannot be set on someone who is not an external verifier');
    ok((await acc('local-dev-admin', { accessEndsOn: past })).s === 400, 'nor on an administrator, nor on yourself');
    ok((await q("select access_ends_on from users where id in ('demo-tom','local-dev-admin') and access_ends_on is not null")).length === 0, 'and nothing was written to those accounts');
    // (impersonation does not count for administrator-only routes, so the real sign-in is made an ordinary assessor for this one check)
    await acc(EVA, { accessEndsOn: future });
    await q("update users set role = 'assessor' where id = 'local-dev-admin'");
    const notAdmin = await call('PATCH', `/api/users/${EVA}/access-end`, { accessEndsOn: null });
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");
    ok(notAdmin.s === 403 && (await readEnd()), 'someone who is not an administrator cannot change it', notAdmin.s);
    ok((await acc(EVA, { accessEndsOn: null })).s === 200 && (await readEnd()) === null, 'clearing it works');
    const viaGeneral = await adm(() => call('PATCH', `/api/users/${EVA}`, { accessEndsOn: past }));
    ok((await readEnd()) === null, 'and the general user edit cannot set it', viaGeneral.s);

    // ------------------------------------------------------------------ 4. separate address for packages
    if (process.env.CONTENT_E2E === '1') {
      console.log('Learning packages are served only from the separate address');
      const CONTENT = 'http://127.0.0.1:5056';
      const training = (await q('select id from trainings limit 1'))[0].id;
      const c = (await q("insert into training_content (training_id, title, content_type, scorm_version, scorm_launch_path) values ($1, 'e2e package', 'scorm', 'scorm12', 'index.html') returning id", [training]))[0].id;
      await q("insert into scorm_package_files (content_id, relative_path, object_key, mime_type) values ($1, 'index.html', 'e2e/none', 'text/html')", [c]);
      try {
        const l = await call('GET', `/api/training-content/${c}/scorm-launch`);
        ok(l.s === 200 && l.j.separate === true && l.j.origin === CONTENT && l.j.url.startsWith(`${CONTENT}/c/`) && l.j.url.endsWith('/index.html'), 'the launch is a signed link to the content address', l.j);
        const payload = JSON.parse(Buffer.from(l.j.url.split('/c/')[1].split('/')[0].split('.')[0], 'base64url').toString());
        ok(payload.c === c && payload.a === B && payload.e > Date.now(), 'which names the package, the application\'s own address and a time it runs out', payload);
        const old = await call('GET', `/api/training-content/${c}/scorm/index.html`);
        ok(old.s === 404, 'the application\'s own address no longer serves the package', old.s);
        const api = await call('GET', '/api/auth/user', undefined, CONTENT);
        ok(api.s === 404 && !api.h.get('set-cookie'), 'the content address does not answer for the application (no API, no cookie)', api.s);
        ok((await call('GET', '/', undefined, CONTENT)).s === 404 && (await call('GET', '/api/reports/compliance-explorer', undefined, CONTENT)).s === 404, 'nor for pages or reports');
        ok((await call('GET', '/c/not-a-link/index.html', undefined, CONTENT)).s === 403, 'a made-up link is refused');
        const hdr = (await call('GET', '/api/auth/user')).h.get('content-security-policy') ?? '';
        ok(process.env.CAPERA_STRICT_CSP_E2E !== '1' || hdr.includes(`frame-src 'self' ${CONTENT}`), 'the application may frame the content address and nothing else outside itself', hdr);
        const mine = await as('demo-claire', () => call('GET', `/api/training-content/${c}/scorm-launch`));
        const mineTok = JSON.parse(Buffer.from(mine.j.url.split('/c/')[1].split('/')[0].split('.')[0], 'base64url').toString());
        ok(mine.s === 200 && mineTok.u === 'demo-claire', 'a learner\'s link names that learner, not the administrator');
      } finally {
        await q('delete from scorm_package_files where content_id = $1', [c]); await q('delete from training_content where id = $1', [c]);
      }
    }
  } finally {
    await q("update users set role = 'developer' where id = 'local-dev-admin'");
    await q('update users set access_ends_on = null where id = $1', [EVA]);
    for (const a of allocs) await q('update verifier_allocations set ends_on = null, is_active = true where id = $1', [a.id]);
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
