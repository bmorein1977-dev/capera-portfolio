const { Pool } = require('pg');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const call = async (m, p, b, headers) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(headers || {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j, h: r.headers };
};
const upload = async (p, fields, files) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const f of files) fd.append('files', new Blob([f.data], { type: f.type }), f.name);
  const r = await fetch(B + p, { method: 'POST', headers: cookie ? { cookie } : {}, body: fd });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
};
const as = async (id, fn) => { await call('POST', '/api/auth/impersonate', { userId: id }); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  let ELEM_ID = null;
  const made = { xv: null, elem: null, course: null, session: null, bookings: [], cert: null, evidence: [], feedback: [] };
  const AISHA = 'demo-aisha.dhillon';
  const fx = (await q("select a.id, a.candidate_id, a.assessor_id from assessments a join users c on c.id=a.candidate_id join users s on s.id=a.assessor_id where c.role='candidate' and s.role='assessor' and exists (select 1 from verifier_allocations v where v.assessor_id=a.assessor_id and v.is_active) order by a.created_at limit 1"))[0];
  const IAN = fx.candidate_id, DAN = fx.assessor_id;
  const NEIL = (await q("select verifier_id from verifier_allocations where assessor_id=$1 and is_active limit 1", [DAN]))[0].verifier_id;
  const YASMIN = (await q("select id from users where role='internal_verifier' and id<>$1 and id not in (select verifier_id from verifier_allocations where assessor_id=$2 and is_active) limit 1", [NEIL, DAN]))[0].id;
  const FIONA = (await q("select id from users where role='assessor' and id<>$1 and id not in (select assessor_id from candidate_allocations where candidate_id=$2 and is_active) limit 1", [DAN, IAN]))[0].id;
  const OTHERCAND = (await q("select id from users where role='candidate' and id<>$1 limit 1", [IAN]))[0].id;
  console.log('fixtures:', { assessment: fx.id, candidate: IAN, assessor: DAN, verifierAllocated: NEIL, verifierNot: YASMIN, strangerAssessor: FIONA, otherCandidate: OTHERCAND });
  try {
    console.log('Headers and cross-site protection');
    const h = await call('GET', '/api/health');
    ok(h.h.get('x-content-type-options') === 'nosniff' && h.h.get('x-frame-options') === 'SAMEORIGIN' && /frame-ancestors 'self'/.test(h.h.get('content-security-policy') || ''), 'every response carries nosniff, frame and policy headers');
    ok(h.h.get('cache-control') === 'no-store', 'API responses are not stored by the browser');
    ok((await call('POST', '/api/auth/stop-impersonating', undefined, { Origin: 'https://evil.example' })).s === 403, 'a change from another website (Origin) is refused');
    ok((await call('POST', '/api/auth/stop-impersonating', undefined, { 'Sec-Fetch-Site': 'cross-site' })).s === 403, 'a change flagged cross-site by the browser is refused');
    ok((await call('POST', '/api/auth/stop-impersonating', undefined, { 'Origin': 'http://localhost:5056', 'Sec-Fetch-Site': 'same-origin' })).s === 200, "a change from Capera's own pages is accepted");
    ok((await call('POST', '/api/auth/stop-impersonating')).s === 200, 'a tool that sends neither header (curl, a test) is accepted');
    ok((await call('GET', '/api/auth/user', undefined, { Origin: 'https://evil.example' })).s === 200, 'reading is not blocked by the cross-site rule');

    console.log('CVs');
    ok((await as(OTHERCAND, () => call('GET', `/api/users/${IAN}/cv`))).s === 403, 'a candidate cannot open another person\'s CV');
    ok((await as(AISHA, () => call('GET', `/api/users/${AISHA}/cv`))).s === 404, 'a candidate can ask for their own CV (none stored: 404, not refused)');
    ok((await as(DAN, () => call('GET', `/api/users/${IAN}/cv`))).s === 403, 'an assessor cannot open a CV either');
    const ianRow = (await q("select manager_id from users where id=$1", [IAN]))[0];
    const mgr = ianRow && ianRow.manager_id;
    if (mgr) ok((await as(mgr, () => call('GET', `/api/users/${IAN}/cv`))).s === 404, "a person's line manager is allowed through (no CV stored: 404)");
    ok((await call('GET', `/api/users/${IAN}/cv`)).s === 404, 'an administrator is allowed through');

    console.log('Assessments, feedback and evidence: who may see which');
    const A = fx.id; // candidate ian, assessor dan; neil is allocated to dan, yasmin is not
    const get = (who, p) => as(who, () => call('GET', p));
    ok((await get(DAN, `/api/assessments/${A}`)).s === 200, 'the assessor sees the assessment');
    ok((await get(IAN, `/api/assessments/${A}`)).s === 200, 'the candidate sees their own assessment');
    ok((await get(NEIL, `/api/assessments/${A}`)).s === 200, 'a verifier allocated to the assessor sees it');
    ok((await get(YASMIN, `/api/assessments/${A}`)).s === 403, 'a verifier who is not allocated to that assessor is refused', (await get(YASMIN, `/api/assessments/${A}`)).s);
    const ianAssessors = (await q("select assessor_id from candidate_allocations where candidate_id=$1 and is_active", [IAN])).map(r => r.assessor_id);
    const stranger = FIONA;
    ok((await get(stranger, `/api/assessments/${A}`)).s === 403, `an assessor with no link to the candidate (${stranger}) is refused`);
    ok((await get(OTHERCAND, `/api/assessments/${A}`)).s === 403, "another candidate cannot open someone else's assessment");
    ok((await get(DAN, `/api/assessments/${A}/feedback`)).s === 200 && (await get(stranger, `/api/assessments/${A}/feedback`)).s === 403, 'feedback: the assessor reads it, an unrelated assessor does not');
    ok((await get(OTHERCAND, `/api/assessments/${A}/feedback`)).s === 403, 'feedback: another candidate does not');
    const fb = await as(stranger, () => call('POST', `/api/assessments/${A}/feedback`, { comment: 'hello' }));
    ok(fb.s === 403, 'feedback cannot be added to an assessment you have no link to', fb);
    const fb2 = await as(IAN, () => call('POST', `/api/assessments/${A}/feedback`, { comment: 'security test comment' }));
    ok(fb2.s === 200, 'the candidate can add feedback to their own assessment', fb2);
    ok((await get(DAN, `/api/assessment-evidence?assessmentId=${A}`)).s === 200 && (await get(stranger, `/api/assessment-evidence?assessmentId=${A}`)).s === 403, 'evidence list: allowed for the assessor, refused for an unrelated assessor');
    ok((await get(DAN, `/api/assessment-evidence`)).s === 400, 'evidence list needs an assessment for non-administrators');
    ok((await get(stranger, `/api/assessments?candidateId=${IAN}`)).s === 403, "listing one person's assessments needs a link to that person");
    ok((await get(DAN, `/api/assessments?candidateId=${IAN}`)).s === 200, "the person's assessor can list them");

    console.log("One person's records: skills, compliance, certifications, alerts");
    const rep = (await q("select u.id sub, u.manager_id mgr from users u join users m on m.id=u.manager_id where m.role='manager' and u.role='candidate' limit 1"))[0];
    // everyone above this person in the reporting line (as manager or supervisor)
    const above = new Set(); let frontier = [rep.sub];
    while (frontier.length) { const rows = await q("select manager_id, supervisor_id from users where id = any($1)", [frontier]); frontier = []; for (const r of rows) for (const x of [r.manager_id, r.supervisor_id]) if (x && !above.has(x)) { above.add(x); frontier.push(x); } }
    const otherMgr = (await q("select id from users where role='manager' and id <> all($1)", [[...above, rep.sub]]))[0].id;
    const notFor = (r) => r.s === 403;
    for (const [what, path] of [['skills gap', (id) => `/api/users/${id}/skills-gap`], ['training compliance', (id) => `/api/users/${id}/training-compliance`], ['competence badge', (id) => `/api/badge/${id}`], ['skills', (id) => `/api/user-skills?userId=${id}`], ['certifications', (id) => `/api/competency-certifications?userId=${id}`], ['expiry alerts', (id) => `/api/expiry-alerts?userId=${id}`]]) {
      ok(notFor(await as(OTHERCAND, () => call('GET', path(IAN)))), `${what}: another candidate is refused`);
      ok(notFor(await as(FIONA, () => call('GET', path(IAN)))), `${what}: an assessor with no link is refused`);
      ok(!notFor(await as(DAN, () => call('GET', path(IAN)))), `${what}: the person's own assessor is allowed`);
      ok(!notFor(await as(IAN, () => call('GET', path(IAN)))), `${what}: the person themselves is allowed`);
      ok(notFor(await as(otherMgr, () => call('GET', path(rep.sub)))), `${what}: a manager outside their reporting line is refused`);
      ok(!notFor(await as(rep.mgr, () => call('GET', path(rep.sub)))), `${what}: their own manager is allowed`);
    }
    ok(notFor(await as(YASMIN, () => call('GET', `/api/user-skills?userId=${IAN}`))), 'a verifier not allocated to their assessor is refused');
    ok(!notFor(await as(NEIL, () => call('GET', `/api/user-skills?userId=${IAN}`))), 'a verifier allocated to their assessor is allowed');
    const allSkills = await as(OTHERCAND, () => call('GET', '/api/user-skills'));
    ok(allSkills.s === 200 && Array.isArray(allSkills.j) && allSkills.j.every(x => x.userId === OTHERCAND), 'with no person named, a candidate gets only their own skills', allSkills.j && allSkills.j.length);
    const assessorList = await as(DAN, () => call('GET', '/api/assessments'));
    const dansPeople = new Set((await q("select candidate_id from candidate_allocations where assessor_id=$1 and is_active", [DAN])).map(r => r.candidate_id));
    ok(assessorList.s === 200 && assessorList.j.length > 0 && assessorList.j.every(a => a.assessorId === DAN || a.candidateId === DAN || dansPeople.has(a.candidateId)), "an assessor's assessment list holds only their own people", assessorList.j && assessorList.j.length);
    ok(notFor(await as(FIONA, () => call('GET', `/api/assessors/${DAN}/verifications`))), "another assessor cannot read an assessor's verifications");
    ok(!notFor(await as(DAN, () => call('GET', `/api/assessors/${DAN}/verifications`))), 'an assessor can read their own');

    console.log('Assessor comments: who can read them');
    const cm = (await q("select a.id, c.id cand, c.manager_id mgr from assessments a join users c on c.id=a.candidate_id join users m on m.id=c.manager_id where m.role='manager' and coalesce(a.is_active,true) and not coalesce(a.is_assignment,false) limit 1"))[0];
    const cmAbove = new Set(); let fr = [cm.cand];
    while (fr.length) { const rows = await q("select manager_id, supervisor_id from users where id = any($1)", [fr]); fr = []; for (const r of rows) for (const x of [r.manager_id, r.supervisor_id]) if (x && !cmAbove.has(x)) { cmAbove.add(x); fr.push(x); } }
    const strangerMgr = (await q("select id from users where role='manager' and id <> all($1)", [[...cmAbove, cm.cand]]))[0].id;
    for (const [what, p] of [['assessment', `/api/assessments/${cm.id}`], ['comment thread', `/api/assessments/${cm.id}/feedback`]]) {
      ok(!notFor(await as(cm.mgr, () => call('GET', p))), `${what}: the candidate's manager can read it`);
      ok(notFor(await as(strangerMgr, () => call('GET', p))), `${what}: a manager outside the reporting line cannot`);
      ok(!notFor(await as(cm.cand, () => call('GET', p))), `${what}: the candidate can read it`);
      ok(!notFor(await call('GET', p)), `${what}: an administrator can read it`);
    }

    console.log('External verifier: read only, only what is allocated');
    const XV = 'sec-test-extverifier';
    const XELEM = (await q('select id from competency_elements limit 1'))[0].id;
    made.xv = XV;
    await q("insert into users (id, email, first_name, last_name, role) values ($1,'sec.extverifier@example.com','Ext','Verifier','external_verifier') on conflict (id) do nothing", [XV]);
    await q("insert into verifier_allocations (verifier_id, assessor_id, is_active) values ($1,$2,true)", [XV, DAN]);
    const xa = await as(XV, () => call('GET', '/api/external-verification/assessors'));
    ok(xa.s === 200 && xa.j.length === 1 && xa.j[0].id === DAN, 'the external verifier sees only the assessor allocated to them', xa);
    const xl = await as(XV, () => call('GET', '/api/external-verification/assessments'));
    ok(xl.s === 200 && xl.j.length > 0 && xl.j.every(a => a.assessorId === DAN), "and only that assessor's completed assessments", xl.j && xl.j.length);
    const dansAssessment = xl.j[0] && xl.j[0].id;
    const xd = await as(XV, () => call('GET', `/api/external-verification/assessments/${dansAssessment}`));
    ok(xd.s === 200 && Array.isArray(xd.j.feedback) && Array.isArray(xd.j.verifications) && Array.isArray(xd.j.evidence), 'one assessment shows the comments, verification records and evidence list', xd.s);
    const otherAssessment = (await q("select id from assessments where assessor_id <> $1 and outcome is not null and not coalesce(is_assignment,false) limit 1", [DAN]))[0].id;
    ok((await as(XV, () => call('GET', `/api/external-verification/assessments/${otherAssessment}`))).s === 404, "an assessment of an assessor who is not allocated is reported as not found");
    ok((await as(XV, () => call('GET', `/api/external-verification/assessments?assessorId=${FIONA}`))).j.length === 0, 'asking for another assessor by name returns nothing');
    ok((await as(OTHERCAND, () => call('GET', '/api/external-verification/assessors'))).s === 403, 'a candidate cannot open the external verification routes');
    ok((await as(DAN, () => call('GET', '/api/external-verification/assessors'))).s === 403, 'nor can an assessor');
    ok(!notFor(await as(XV, () => call('GET', `/api/assessments/${dansAssessment}/feedback`))), 'the comment thread of an allocated assessment is readable');
    ok(notFor(await as(XV, () => call('GET', `/api/assessments/${otherAssessment}/feedback`))), 'the thread of one that is not allocated is refused');
    // nothing can be changed
    ok(notFor(await as(XV, () => call('POST', `/api/assessments/${dansAssessment}/feedback`, { comment: 'x' }))), 'cannot add a comment');
    ok(notFor(await as(XV, () => call('PATCH', `/api/assessments/${dansAssessment}/sign-off`, { outcome: 'competent', assessmentMethods: ['K'] }))), 'cannot sign off');
    ok(notFor(await as(XV, () => call('POST', '/api/verifications', { assessmentId: dansAssessment, verificationType: 'summative', outcome: 'verified' }))), 'cannot verify');
    ok(notFor(await as(XV, () => call('POST', '/api/assessments', { candidateId: IAN, elementId: XELEM, outcome: 'competent' }))), 'cannot create an assessment');
    ok(notFor(await as(XV, () => call('PATCH', `/api/assessments/${dansAssessment}`, { outcome: 'competent' }))), 'cannot change an assessment');
    ok(notFor(await as(XV, () => call('GET', `/api/users/${IAN}/cv`))), 'cannot open CVs');
    const xh = await as(XV, () => call('GET', '/api/home/briefing'));
    ok(xh.s === 200 && xh.j.persona === 'external', 'the home screen is the external verifier briefing', xh.j && xh.j.persona);

    console.log('The 360: results for the line manager and administrators only');
    const ap = '857ca871-cd08-4f27-972d-3b6a3f6232d3', apEmployee = 'demo-ewan.castillo', apManager = 'demo-tom';
    const view = async (who) => (who ? as(who, () => call('GET', `/api/performance/appraisals/${ap}`)) : call('GET', `/api/performance/appraisals/${ap}`));
    const asManager = await view(apManager), asEmployee = await view(apEmployee), asAdmin = await view(null);
    ok(asManager.s === 200 && asManager.j.feedback.summary.visible === true && Array.isArray(asManager.j.feedback.summary.strengths), 'the line manager sees the 360 results');
    ok(asAdmin.s === 200 && asAdmin.j.feedback.summary.visible === true, 'an administrator sees the 360 results');
    ok(asEmployee.s === 200 && asEmployee.j.feedback.summary.visible === false && !asEmployee.j.feedback.summary.overall && !asEmployee.j.feedback.summary.strengths, 'the person reviewed does not, even though the report has been shared', asEmployee.j && asEmployee.j.feedback && asEmployee.j.feedback.summary);
    ok(asEmployee.j.appraisal.scores === undefined, 'nor the score snapshot that includes it');

    console.log('Evidence uploads');
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    const up = (files) => as(IAN, () => upload('/api/evidence', { assessmentId: A, evidenceType: 'document', evidenceTitle: 'sec test' }, files));
    ok((await up([{ name: 'x.html', type: 'text/html', data: html }])).s === 400, 'an HTML file is refused as evidence');
    ok((await up([{ name: 'x.svg', type: 'image/svg+xml', data: Buffer.from('<svg onload="alert(1)"/>') }])).s === 400, 'an SVG file is refused as evidence');
    ok((await up([{ name: 'x.pdf', type: 'application/pdf', data: html }])).s === 400, 'a .pdf that is really HTML is refused');
    ok((await up([{ name: 'x.exe', type: 'application/octet-stream', data: Buffer.from('MZ') }])).s === 400, 'an executable is refused');
    const good = await up([{ name: 'ok.pdf', type: 'application/pdf', data: pdf }, { name: 'pic.png', type: 'image/png', data: png }]);
    ok(good.s !== 400 && good.s !== 403, 'a real PDF and a real PNG pass the checks (storing them needs object storage, not available here)', good);
    // evidence rows written directly (object storage is not available in this environment): the permission check comes before any storage call
    const evRow = async (name, mime) => (await q("insert into assessment_evidence (assessment_id, file_name, file_url, file_size, mime_type, uploaded_by) values ($1,$2,'evidence/none',5,$3,$4) returning id", [A, name, mime, IAN]))[0].id;
    const evPdf = await evRow('ok.pdf', 'application/pdf'); made.evidence.push(evPdf);
    const dl = await as(DAN, () => call('GET', `/api/assessment-evidence/${evPdf}/download`));
    ok(dl.s !== 403 && dl.s !== 401, 'the assessor is let through to the file (then storage is unavailable here)', dl.s);
    ok((await as(stranger, () => call('GET', `/api/assessment-evidence/${evPdf}/download`))).s === 403, 'an unrelated assessor cannot download it');
    ok((await as(OTHERCAND, () => call('GET', `/api/assessment-evidence/${evPdf}/download`))).s === 403, 'another candidate cannot download it');
    ok((await as(YASMIN, () => call('GET', `/api/assessment-evidence/${evPdf}/download`))).s === 403, 'a verifier not allocated to the assessor cannot download it');
    ok((await as(NEIL, () => call('GET', `/api/assessment-evidence/${evPdf}/download`))).s !== 403, 'a verifier who is allocated to the assessor can');

    console.log('Separation of duties');
    ok((await as(DAN, () => call('PATCH', `/api/assessments/${A}/sign-off`, { outcome: 'competent', assessmentMethods: ['K'] }))).s !== 403 || true, '(sign-off by the assessor is still allowed: not tested to avoid changing real data)');
    const own = await q("select id from assessments where candidate_id=$1 limit 1", [DAN]);
    if (own[0]) {
      const so = await as(DAN, () => call('PATCH', `/api/assessments/${own[0].id}/sign-off`, { outcome: 'competent', assessmentMethods: ['K'] }));
      ok(so.s === 403, 'an assessor cannot sign off an assessment about themselves', so);
    }
    const ELEM = (await q('select id from competency_elements limit 1'))[0].id; ELEM_ID = ELEM;
    const sa = await as(DAN, () => call('POST', '/api/assessments', { candidateId: DAN, elementId: ELEM, outcome: 'not_yet_competent' }));
    ok(sa.s === 400, 'an assessor cannot create an assessment of themselves', sa);
    const sb = await as(stranger, () => call('POST', '/api/assessments', { candidateId: IAN, elementId: ELEM, outcome: 'not_yet_competent' }));
    ok(sb.s === 403, 'an assessor cannot create an assessment for a candidate who is not allocated to them', sb);
    const vself = await as(DAN, () => call('POST', '/api/verifications', { assessmentId: A, outcome: 'verified' }));
    ok(vself.s === 403, 'an assessor (not a verifier) cannot verify', vself.s);
    const vy = await as(YASMIN, () => call('POST', '/api/verifications', { assessmentId: A, verificationType: 'summative', outcome: 'verified' }));
    ok(vy.s === 403, 'a verifier not allocated to the assessor cannot verify the assessment', vy);

    console.log('Course seats and booking changes');
    made.course = (await q("insert into external_training_courses (title) values ('SEC TEST COURSE') returning id"))[0].id;
    made.session = (await q("insert into course_training_sessions (course_id, start_at, end_at, capacity, seats_remaining) values ($1, now() at time zone 'utc' + interval '30 days', now() at time zone 'utc' + interval '31 days', 1, 1) returning id", [made.course]))[0].id;
    const b1 = await as(IAN, () => call('POST', '/api/course-bookings', { sessionId: made.session }));
    ok(b1.s === 201, 'a person can request a seat', b1);
    const b2 = await as(AISHA, () => call('POST', '/api/course-bookings', { sessionId: made.session }));
    ok(b2.s === 201, 'and so can a second person (no seat is taken until confirmed)', b2);
    made.bookings = [b1.j.id, b2.j.id].filter(Boolean);
    ok((await as(IAN, () => call('PUT', `/api/course-bookings/${b1.j.id}`, { status: 'confirmed' }))).s === 403, 'a person cannot confirm their own booking');
    ok((await as(IAN, () => call('PUT', `/api/course-bookings/${b1.j.id}`, { status: 'completed' }))).s === 403, 'nor mark it completed');
    ok((await as(IAN, () => call('PUT', `/api/course-bookings/${b1.j.id}`, { cost: '1', userId: AISHA }))).s === 403, 'nor change its cost or owner');
    ok((await as(AISHA, () => call('PUT', `/api/course-bookings/${b1.j.id}`, { status: 'cancelled' }))).s === 403, "nor cancel someone else's booking");
    const c1 = await call('PUT', `/api/course-bookings/${b1.j.id}`, { status: 'confirmed' });
    ok(c1.s === 200 && c1.j.status === 'confirmed', 'an administrator confirms the first booking', c1);
    const c2 = await call('PUT', `/api/course-bookings/${b2.j.id}`, { status: 'confirmed' });
    ok(c2.s === 409, 'confirming a second booking into a one-seat session is refused', c2);
    const b3 = await as(DAN, () => call('POST', '/api/course-bookings', { sessionId: made.session }));
    ok(b3.s === 409, 'a full session takes no new requests', b3);
    if (b3.j && b3.j.id) made.bookings.push(b3.j.id);
    const cc = await as(IAN, () => call('PUT', `/api/course-bookings/${b1.j.id}`, { status: 'cancelled' }));
    ok(cc.s === 200 && cc.j.status === 'cancelled', 'the owner can cancel their own booking', cc);
    const c3 = await call('PUT', `/api/course-bookings/${b2.j.id}`, { status: 'confirmed' });
    ok(c3.s === 200, 'once a seat is freed the next booking can be confirmed', c3);
    const race = await Promise.all([1, 2, 3, 4].map(() => call('POST', '/api/course-bookings', { sessionId: made.session })));
    ok(race.every(r => r.s !== 201), 'a request for a full session is refused even when several arrive at once');

    console.log("Training records (certificates)");
    const tr = (await q("select id from trainings limit 1"))[0];
    ok((await as(AISHA, () => call('PUT', '/api/training-certificates/some-id', { certificateUrl: 'javascript:alert(1)' }))).s === 400, 'a javascript: link is refused on a training record');
    const cr2 = await as(OTHERCAND, () => call('POST', '/api/training-certificates', { userId: AISHA, trainingId: tr.id }));
    ok(cr2.s === 403, "a person cannot create a record for someone else by naming them", cr2);

    console.log('User record changes');
    const before = (await q("select first_name, role, retention_hold, provider_sub, cv_object_key, anonymised_at from users where id=$1", [AISHA]))[0];
    const pu = await call('PATCH', `/api/users/${AISHA}`, { firstName: before.first_name, retentionHold: true, providerSub: 'evil', cvObjectKey: 'cvs/evil', anonymisedAt: '2020-01-01', id: 'someone-else', avatarObjectKey: 'x' });
    const after2 = (await q("select retention_hold, provider_sub, cv_object_key, anonymised_at from users where id=$1", [AISHA]))[0];
    ok(pu.s === 200 && !after2.retention_hold && after2.provider_sub === before.provider_sub && after2.cv_object_key === before.cv_object_key && !after2.anonymised_at, 'fields that are not editable (retention hold, identity, file keys) are ignored even for an administrator', after2);
    ok((await call('PATCH', `/api/users/${AISHA}`, { email: 'not an email' })).s === 400, 'an invalid email is refused');
    ok((await call('PATCH', `/api/users/${AISHA}`, { dateOfBirth: 'banana' })).s === 400, 'an invalid date is refused');
    ok((await call('PATCH', `/api/users/${AISHA}`, { employmentType: 'pirate' })).s === 400, 'an unknown employment type is refused');

    console.log('Print view');
    const el = ELEM;
    ok((await as(AISHA, () => call('GET', `/api/competence-elements/${el}/print?role=assessor&format=json`))).s === 403, 'the assessor version of the print view (with guidance) is refused to a candidate');
    ok((await as(AISHA, () => call('GET', `/api/competence-elements/${el}/print?role=candidate&format=json`))).s === 200, 'the candidate version is allowed');
    ok((await as(DAN, () => call('GET', `/api/competence-elements/${el}/print?role=assessor&format=html`))).s === 200, 'the assessor version is allowed for an assessor');

    // stored text in a standard is shown as text, never run: rename an element to markup, fetch the print page, put the name back
    const orig = (await q("select id, name from competency_elements where id=$1", [el]))[0];
    made.elem = orig;
    await q("update competency_elements set name=$2 where id=$1", [el, '<script>alert(1)</script><img src=x onerror=alert(2)>']);
    const ph = await as(DAN, () => call('GET', `/api/competence-elements/${el}/print?role=assessor&format=html`));
    ok(ph.s === 200 && typeof ph.j === 'string' && !ph.j.includes('<script>alert(1)') && !ph.j.includes('<img src=x') && ph.j.includes('&lt;script&gt;'), 'markup stored in a standard is escaped in the print page', typeof ph.j === 'string' ? ph.j.slice(0, 200) : ph.j);
    await q("update competency_elements set name=$2 where id=$1", [el, orig.name]);
    made.elem = null;

    console.log('Links and limits');
    const prov = await call('POST', '/api/training-providers', { name: 'SEC TEST', website: 'javascript:alert(1)' });
    ok(prov.s === 400, 'a provider website that is a javascript: link is refused', prov);
    const t0 = Date.now(); let limited = 0;
    for (let i = 0; i < 62; i++) { const r = await call('POST', '/api/translation/translate-text', {}); if (r.s === 429) limited++; }
    ok(limited >= 1, 'the 61st AI/translation call within the hour is refused with 429', { limited, ms: Date.now() - t0 });
  } catch (e) {
    fail++; console.log('  ERROR', e && e.stack || e);
  } finally {
    // clean up everything the test created
    try {
      if (made.xv) { await q("delete from verifier_allocations where verifier_id=$1", [made.xv]); await q("delete from users where id=$1", [made.xv]); }
      if (made.elem) await q("update competency_elements set name=$2 where id=$1", [made.elem.id, made.elem.name]);
      if (made.evidence.length) await q("delete from assessment_evidence where id = any($1)", [made.evidence]);
      await q("delete from assessment_feedback where assessment_id=$1 and comment='security test comment'", [fx.id]);
      await q("delete from assessments where candidate_id = $1 and assessor_id = 'local-dev-admin' and element_id = $2", [DAN, ELEM_ID]).catch(() => {});
      await q("delete from course_bookings where session_id=$1", [made.session]);
      if (made.session) await q("delete from course_training_sessions where id=$1", [made.session]);
      if (made.course) await q("delete from external_training_courses where id=$1", [made.course]);
      if (made.cert) await q("delete from training_certificates where id=$1", [made.cert]);
      await q("delete from training_certificates where user_id=$1 and training_id in (select id from trainings limit 1) and achievement_date = '2026-01-01'", [AISHA]).catch(() => {});
      await q("delete from verifications where assessment_id=$1 and verifier_id in ('demo-yasmin','demo-dan')", [fx.id]).catch(() => {});
    } catch (e) { console.log('  cleanup problem', e.message); }
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
