// Standard version control, the audit evidence repository and course booking, end to end. Same setup as reviewfixes.e2e.cjs
// (ENABLE_DEMO_TOOLS=true, migrations 0061 and 0062, LOCAL_OBJECT_STORAGE_DIR set for server and test). Removes everything it makes.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); } };
const raw = async (m, p, b) => {
  const form = b instanceof FormData;
  const r = await fetch(B + p, { method: m, headers: { ...(form || b === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : form ? b : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return r;
};
const call = async (m, p, b) => { const r = await raw(m, p, b); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const as = async (id, fn) => { const r = await call('POST', '/api/auth/impersonate', { userId: id }); if (r.s !== 200) throw new Error(`could not act as ${id}: ${r.s}`); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const P = { AUTHOR: 'sec-cap-author', APPROVER: 'sec-cap-approver', ASSESSOR: 'sec-cap-assessor', AUDITOR: 'sec-cap-auditor', MGR: 'sec-cap-manager', TA: 'sec-cap-trainadmin', ANN: 'sec-cap-ann', BEN: 'sec-cap-ben' };
  const ids = Object.values(P);
  let meRole = null;
  // A super administrator passes every role gate, even while acting as someone else. To prove a refusal, the local sign-in is really given the role.
  const reallyAs = async (role, fn) => { await q("update users set role = $1 where id = 'local-dev-admin'", [role]); try { return await fn(); } finally { await q("update users set role = 'super_admin' where id = 'local-dev-admin'"); } };
  const docIds = [];
  const cleanup = async () => {
    await q("delete from booking_approvals where booking_id in (select id from course_bookings where user_id = any($1))", [ids]);
    await q('delete from course_bookings where user_id = any($1)', [ids]);
    await q('delete from training_requests where user_id = any($1)', [ids]);
    await q('delete from training_completion_audit where user_id = any($1)', [ids]);
    await q('delete from training_evaluations where user_id = any($1)', [ids]).catch(() => {});
    await q('delete from training_enrollments where user_id = any($1)', [ids]);
    await q("delete from training_policy_matrix where course_id in (select id from external_training_courses where title like 'SEC CAP%')");
    await q("delete from course_training_sessions where course_id in (select id from external_training_courses where title like 'SEC CAP%')");
    await q("delete from external_training_courses where title like 'SEC CAP%'");
    await q('delete from role_trainings where role_id in (select id from job_roles where code = $1)', ['SEC-CAP-ROLE']);
    await q("delete from trainings where name like 'SEC CAP%'");
    await q('delete from assessments where candidate_id = any($1)', [ids]);
    await q("delete from competency_element_versions where element_id in (select id from competency_elements where code like 'SECCAP%')");
    await q("delete from competence_criteria where element_id in (select id from competency_elements where code like 'SECCAP%')");
    await q("delete from competency_elements where code like 'SECCAP%'");
    await q("delete from competency_categories where code = 'SEC-CAP-CAT'");
    await q("delete from opito_documents where title like 'SEC CAP%'");
    await q("delete from repository_headings where key = 'SECCAP.1'");
    await q("delete from job_roles where code = 'SEC-CAP-ROLE'");
    await q('delete from users where id = any($1)', [ids]);
  };
  try {
    await cleanup();
    await call('GET', '/api/auth/user');
    meRole = (await q("select role from users where id = 'local-dev-admin'"))[0].role;
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");
    const roleId = (await q("insert into job_roles (name, code) values ('SEC CAP role', 'SEC-CAP-ROLE') returning id"))[0].id;
    const mk = (id, role, last, extra = {}) => q("insert into users (id,email,first_name,last_name,role,employment_type,is_active,approval_status,job_role_id,manager_id) values ($1,$2,'Seccap',$3,$4,'employee',true,'approved',$5,$6)", [id, `${id}@example.com`, last, role, extra.jobRole || null, extra.manager || null]);
    await mk(P.AUTHOR, 'admin', 'Author'); await mk(P.APPROVER, 'admin', 'Approver'); await mk(P.ASSESSOR, 'assessor', 'Assessor'); await mk(P.AUDITOR, 'external_verifier', 'Auditor');
    await mk(P.MGR, 'manager', 'Manager'); await mk(P.TA, 'candidate', 'Trainingadmin'); await q("insert into user_role_assignments (user_id, role) values ($1, 'training_administrator')", [P.TA]).catch(() => {});
    await mk(P.ANN, 'candidate', 'Ann', { jobRole: roleId, manager: P.MGR }); await mk(P.BEN, 'candidate', 'Ben', { jobRole: roleId, manager: P.MGR });

    // ------------------------------------------------------------------------------------------------ standards
    console.log('Standard version control');
    const cat = (await q("insert into competency_categories (name, code) values ('SEC CAP category', 'SEC-CAP-CAT') returning id"))[0].id;
    const el = (await q("insert into competency_elements (category_id, name, code, description, validity_months) values ($1,'SEC CAP standard','SECCAP1','Original description',24) returning id", [cat]))[0].id;
    const k1 = (await q("insert into competence_criteria (element_id, code, criteria_text, type, criteria_number) values ($1,'K 1','Explain the original rule','knowledge',1) returning id", [el]))[0].id;
    await q("insert into competence_criteria (element_id, code, criteria_text, type, criteria_number) values ($1,'P 1','Carry out the original task','performance',1)", [el]);
    const asmt = async (who) => (await q("insert into assessments (candidate_id, element_id, assessor_id, outcome, is_assignment, is_active) values ($1,$2,$3,'not_yet_competent',true,true) returning id", [who, el, P.ASSESSOR]))[0].id;
    const sign = (id) => as(P.ASSESSOR, () => call('PATCH', `/api/assessments/${id}/sign-off`, { outcome: 'competent', assessmentMethods: ['Observation'] }));
    const wording = async (id) => (await call('GET', `/api/assessments/${id}/standard-wording`)).j.wording;

    const A1 = await asmt(P.ANN);
    await sign(A1);
    let w = await wording(A1);
    ok(w?.versionNumber === 1 && w.snapshot.criteria.some(c => c.criteriaText === 'Explain the original rule'), 'the first sign-off records version 1, the wording that was assessed', w);

    let r = await call('PUT', `/api/standards/${el}/change-control`, { on: true });
    ok(r.s === 200, 'change control can be switched on', r);
    for (const [m, p, b, what] of [
      ['PATCH', `/api/competency-elements/${el}`, { description: 'sneaked in' }, 'editing the standard'],
      ['PATCH', `/api/competence-criteria/${k1}`, { criteriaText: 'sneaked in' }, 'editing a criterion'],
      ['POST', '/api/competence-criteria', { elementId: el, code: 'K 9', criteriaText: 'sneaked in', type: 'knowledge', criteriaNumber: 9 }, 'adding a criterion'],
      ['DELETE', `/api/competence-criteria/${k1}`, undefined, 'removing a criterion'],
      ['DELETE', `/api/competency-elements/${el}`, undefined, 'deleting the standard'],
    ]) { const x = await call(m, p, b); ok(x.s === 409 && x.j.code === 'CHANGE_CONTROL', `under change control, ${what} directly is refused`, x); }
    ok((await call('PATCH', `/api/competency-elements/${el}`, { reviewCycleMonths: 12 })).s === 200, 'review settings can still be changed');

    r = await as(P.AUTHOR, () => call('POST', `/api/standards/${el}/versions`));
    const vid = r.j.id;
    ok(r.s === 201 && r.j.status === 'draft' && r.j.versionNumber === 2, 'an author starts version 2 as a draft', r);
    ok((await as(P.AUTHOR, () => call('POST', `/api/standards/${el}/versions`))).s === 409, 'only one version is worked on at a time');
    const snap = r.j.snapshot;
    ok((await as(P.AUTHOR, () => call('POST', `/api/standard-versions/${vid}/submit`))).s === 400, 'it cannot be sent without saying what changed');
    snap.element.description = 'Updated description';
    snap.criteria.find(c => c.code === 'K 1').criteriaText = 'Explain the revised rule';
    snap.criteria = snap.criteria.filter(c => c.code !== 'P 1');
    snap.criteria.push({ id: null, code: 'P 2', type: 'performance', criteriaText: 'Carry out the new task', criteriaNumber: 2 });
    r = await as(P.AUTHOR, () => call('PUT', `/api/standard-versions/${vid}`, { changeSummary: 'SEC CAP procedure changed', snapshot: { element: snap.element, criteria: snap.criteria } }));
    ok(r.s === 200, 'the draft is saved', r);
    const live = await q('select criteria_text from competence_criteria where element_id = $1 and is_active order by code', [el]);
    ok(live.some(x => x.criteria_text === 'Explain the original rule') && (await q('select description from competency_elements where id = $1', [el]))[0].description === 'Original description', 'editing a draft does not touch the standard in use', live);
    ok((await as(P.AUTHOR, () => call('POST', `/api/standard-versions/${vid}/submit`))).s === 200, 'it is sent for approval');
    r = await as(P.AUTHOR, () => call('POST', `/api/standard-versions/${vid}/decide`, { decision: 'approve', note: '' }));
    ok(r.s === 403, 'its author cannot approve it', r);
    ok((await as(P.ASSESSOR, () => call('POST', `/api/standard-versions/${vid}/decide`, { decision: 'approve', note: '' }))).s === 403, 'nor can someone who is not an approver');
    r = await as(P.APPROVER, () => call('GET', `/api/standard-versions/${vid}`));
    const what = (r.j.changes || []).map(c => c.what).join('|');
    ok(/Description/.test(what) && /K 1 wording/.test(what) && /P 2 added/.test(what) && /P 1 removed/.test(what), 'the approver sees each change', what);
    r = await as(P.APPROVER, () => call('POST', `/api/standard-versions/${vid}/decide`, { decision: 'approve', note: 'SEC CAP agreed' }));
    ok(r.s === 200 && r.j.status === 'approved', 'someone else approves it', r);
    const after = await q('select code, criteria_text, is_active from competence_criteria where element_id = $1 order by code, is_active', [el]);
    ok(after.find(x => x.code === 'K 1' && x.is_active)?.criteria_text === 'Explain the revised rule' && after.some(x => x.code === 'P 2' && x.is_active) && after.some(x => x.code === 'P 1' && !x.is_active), 'approval puts the new wording into use; the removed criterion is kept, switched off', after);
    w = await wording(A1);
    ok(w.versionNumber === 1 && w.snapshot.element.description === 'Original description', 'the earlier sign-off still shows the wording it was assessed against', w?.versionNumber);
    const A2 = await asmt(P.BEN); await sign(A2);
    ok((await wording(A2)).versionNumber === 2, 'a new sign-off is recorded against version 2');
    const hist = (await call('GET', `/api/standards/${el}/versions`)).j.versions.map(v => `${v.versionNumber}:${v.status}`);
    ok(hist.includes('2:approved') && hist.includes('1:superseded'), 'the history shows version 1 replaced by version 2', hist);

    // ------------------------------------------------------------------------------------------------ repository
    console.log('Audit evidence repository');
    const pdf = (t) => Buffer.from(`%PDF-1.4\n% ${t}\n`);
    const up = (fields, file = pdf('SEC CAP DOC'), name = 'policy.pdf') => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); f.append('file', new Blob([file]), name); return call('POST', '/api/opito/documents', f); };
    r = await as(P.AUTHOR, () => up({ categoryKey: '1.1', title: 'SEC CAP policy', reviewDueOn: '2020-01-01' }));
    ok(r.s === 201 && r.j.status === 'awaiting_approval' && !r.j.objectKey, 'a new document waits for approval, and its storage address is not sent', r);
    const d1 = r.j.id;
    ok((await as(P.AUTHOR, () => up({ categoryKey: '1.1', title: 'SEC CAP bad' }, Buffer.from('MZ not a pdf'), 'x.pdf'))).s === 400, 'a file that is not what it says is refused');
    ok((await as(P.AUTHOR, () => call('POST', `/api/opito/documents/${d1}/approve`))).s === 403, 'the uploader cannot approve their own document');
    ok((await as(P.APPROVER, () => call('POST', `/api/opito/documents/${d1}/approve`))).s === 200, 'someone else approves it');
    const listFor = async (id, hist) => (await as(id, () => call('GET', `/api/opito/documents${hist ? '?history=1' : ''}`)));
    ok((await listFor(P.AUDITOR)).j.every(x => x.id !== d1), 'an auditor does not see a document that has not been shared');
    ok((await as(P.AUDITOR, () => raw('GET', `/api/opito/documents/${d1}/download`))).status === 404, 'nor open it by its address');
    await call('PATCH', `/api/opito/documents/${d1}`, { visibleToAuditors: true });
    r = await listFor(P.AUDITOR);
    ok(r.s === 200 && r.j.some(x => x.id === d1) && r.j.find(x => x.id === d1).due === 'review_overdue', 'once shared the auditor sees it, with its overdue review', r.j.map(x => [x.id === d1, x.due]));
    ok((await reallyAs('external_verifier', () => up({ categoryKey: '1.1', title: 'SEC CAP auditor upload' }))).s === 403, 'an external verifier cannot upload');
    ok((await reallyAs('external_verifier', () => call('POST', `/api/opito/documents/${d1}/withdraw`, { reason: 'SEC CAP no' }))).s === 403, 'or withdraw');
    ok((await reallyAs('assessor', () => call('GET', '/api/opito/documents'))).s === 403, 'other roles have no access');
    let dl = await as(P.AUDITOR, () => raw('GET', `/api/opito/documents/${d1}/download`));
    const got = Buffer.from(await dl.arrayBuffer());
    ok(dl.status === 200 && got.equals(pdf('SEC CAP DOC')), 'the auditor can open it', [dl.status, got.toString().slice(0, 200)]);
    await new Promise(res => setTimeout(res, 700));
    ok((await q("select count(*)::int n from audit_events where entity_id = $1 and action = 'Opened a document'", [d1]))[0].n >= 1, 'opening it is written to the audit log');
    r = await as(P.APPROVER, () => up({ categoryKey: '1.1', title: 'SEC CAP policy', replacesId: d1 }, pdf('SEC CAP DOC v2')));
    const d2 = r.j.id;
    ok(r.s === 201 && r.j.version === 2, 'a new version is added', r);
    ok((await listFor(P.AUDITOR)).j.some(x => x.id === d1), 'the old version stays in use until the new one is approved');
    await as(P.AUTHOR, () => call('POST', `/api/opito/documents/${d2}/approve`));
    const all = (await listFor(P.AUTHOR, true)).j;
    ok(all.find(x => x.id === d1)?.status === 'superseded' && all.find(x => x.id === d2)?.status === 'current', 'then it replaces it, and the old one is kept', all.filter(x => x.id === d1 || x.id === d2).map(x => x.status));
    ok((await call('DELETE', `/api/opito/documents/${d2}`)).s === 400, 'removal needs a reason');
    ok((await call('POST', `/api/opito/documents/${d2}/withdraw`, { reason: 'SEC CAP replaced by a new scheme' })).s === 200 && (await q('select status, is_active from opito_documents where id = $1', [d2]))[0].status === 'withdrawn', 'withdrawal keeps the record and the reason');
    const key = (await q('select object_key from opito_documents where id = $1', [d1]))[0].object_key;
    const stored = path.join(process.env.LOCAL_OBJECT_STORAGE_DIR, key);
    if (fs.existsSync(stored)) {
      fs.writeFileSync(stored, pdf('SEC CAP TAMPERED'));
      dl = await as(P.AUTHOR, () => raw('GET', `/api/opito/documents/${d1}/download`));
      ok(dl.status === 409, 'a file changed in storage is not opened', dl.status);
      fs.writeFileSync(stored, pdf('SEC CAP DOC'));
    } else ok(false, 'the stored file could be found for the integrity check', stored);
    ok((await call('PUT', '/api/opito/headings/SECCAP.1', { section: 'SEC CAP section', title: 'SEC CAP heading' })).s === 200 && (await as(P.AUTHOR, () => up({ categoryKey: 'SECCAP.1', title: 'SEC CAP under new heading' }))).s === 201, 'an organisation can add its own heading');

    console.log('The audit log cannot be altered in the database');
    const refuses = async (sqlText) => { try { await q(sqlText); return false; } catch (e) { return /append-only|cannot be altered/.test(e.message); } };
    ok(await refuses(`update audit_events set summary = 'changed' where entity_id = '${d1}'`), 'changing an entry is refused');
    ok(await refuses(`delete from audit_events where entity_id = '${d1}'`), 'removing one is refused');

    // ------------------------------------------------------------------------------------------------ training
    console.log('Course booking, approval rules, attendance and expiry');
    const trainingCat = (await q('select id from training_categories limit 1'))[0].id;
    const training = (await q("insert into trainings (name, category_id, validity_period, is_active) values ('SEC CAP training', $1, 24, true) returning id", [trainingCat]))[0].id;
    const course = (await q("insert into external_training_courses (training_id, title, cost) values ($1,'SEC CAP course','900 GBP') returning id", [training]))[0].id;
    const session = async (offsetDays, capacity = 5) => (await q("insert into course_training_sessions (course_id, start_at, end_at, capacity, seats_remaining) values ($1, now() + make_interval(days => $2::int), now() + make_interval(days => $2::int, hours => 6), $3, $3) returning id", [course, offsetDays, capacity]))[0].id;
    await q("insert into role_trainings (role_id, training_id, required) values ($1,$2,true)", [roleId, training]);
    await q('insert into training_policy_matrix (job_role_id, course_id, policy_status, requires_approval, cost_cap, approver_chain) values ($1,$2,$3,true,$4,$5)', [roleId, course, 'MANDATORY', '500', JSON.stringify([{ role: 'manager', level: 1 }, { role: 'training_administrator', level: 2 }])]);
    const past = await session(-3), future = await session(20);
    r = await as(P.ANN, () => call('POST', '/api/course-bookings', { sessionId: past }));
    const bk = r.j.id;
    ok(r.s === 201 && r.j.approvalsRequired?.length === 3, 'a booking opens the steps the policy asks for: manager, training administrator, and the cost limit', r.j.approvalsRequired?.map(s => s.approverRole));
    r = await call('PUT', `/api/course-bookings/${bk}`, { status: 'confirmed' });
    ok(r.s === 409 && r.j.code === 'APPROVAL_NEEDED', 'it cannot be confirmed before approval', r);
    ok((await as(P.ANN, () => call('POST', `/api/course-bookings/${bk}/approvals/decide`, { decision: 'approve' }))).s === 403, 'nobody approves their own booking');
    ok((await as(P.TA, () => call('POST', `/api/course-bookings/${bk}/approvals/decide`, { decision: 'approve' }))).s === 403, 'a later approver cannot jump the first step');
    r = await as(P.MGR, () => call('GET', '/api/booking-approvals/mine'));
    ok(r.s === 200 && r.j.some(x => x.bookingId === bk && x.step === 1), "the manager sees it waiting for them", r);
    ok((await as(P.MGR, () => call('POST', `/api/course-bookings/${bk}/approvals/decide`, { decision: 'approve' }))).s === 200, 'the manager approves step 1');
    ok((await as(P.TA, () => call('POST', `/api/course-bookings/${bk}/approvals/decide`, { decision: 'approve' }))).s === 200, 'the training administrator approves step 2');
    ok((await call('PUT', `/api/course-bookings/${bk}`, { status: 'confirmed' })).s === 409, 'the cost step is still waiting');
    r = await call('POST', `/api/course-bookings/${bk}/approvals/decide`, { decision: 'approve' });
    ok(r.s === 200 && r.j.waiting === null, 'the last approval clears it', r);
    ok((await call('PUT', `/api/course-bookings/${bk}`, { status: 'confirmed' })).s === 200, 'now it is confirmed');

    r = await call('POST', `/api/course-training-sessions/${past}/attendance`, { attended: [bk] });
    ok(r.s === 200 && r.j.attended === 1, 'the register records attendance', r);
    const en = await q('select status, achievement_date, expiry_date from training_enrollments where user_id = $1 and training_id = $2 order by created_at', [P.ANN, training]);
    const months = en.length ? Math.round((new Date(en.at(-1).expiry_date) - new Date(en.at(-1).achievement_date)) / (86400000 * 30.4)) : null;
    ok(en.length === 1 && en[0].status === 'completed' && months === 24, "the training record is completed with an expiry 24 months on", { en, months });
    ok((await q("select count(*)::int n from training_completion_audit where user_id = $1 and method = 'course_attendance'", [P.ANN]))[0].n === 1, 'and the completion is logged');
    let tc = (await call('GET', `/api/users/${P.ANN}/training-compliance`)).j;
    ok(tc.items?.[0]?.status === 'current', 'compliance shows it as current', tc.items?.[0]?.status);

    // booking a refresher while still current must not make the person look untrained
    await q("update training_policy_matrix set requires_approval = false, cost_cap = null, approver_chain = null where course_id = $1", [course]);
    r = await as(P.ANN, () => call('POST', '/api/course-bookings', { sessionId: future }));
    await call('PUT', `/api/course-bookings/${r.j.id}`, { status: 'confirmed' });
    tc = (await call('GET', `/api/users/${P.ANN}/training-compliance`)).j;
    ok(tc.items?.[0]?.status === 'current', 'booking a refresher leaves the current completion in place', tc.items?.[0]?.status);
    ok((await call('PUT', `/api/course-bookings/${r.j.id}`, { status: 'completed' })).s === 409, 'attendance cannot be recorded before the session has started');

    const b2 = (await as(P.BEN, () => call('POST', '/api/course-bookings', { sessionId: past }))).j.id;
    await call('PUT', `/api/course-bookings/${b2}`, { status: 'confirmed' });
    r = await call('POST', `/api/course-training-sessions/${past}/attendance`, { absent: [b2] });
    ok(r.s === 200 && r.j.absent === 1 && (await q('select status from course_bookings where id = $1', [b2]))[0].status === 'no_show', 'someone who did not attend is recorded as such', r);
    ok((await q("select count(*)::int n from training_enrollments where user_id = $1 and status = 'completed'", [P.BEN]))[0].n === 0, 'and gets no completion');

    await q("update training_policy_matrix set policy_status = 'NA' where course_id = $1", [course]);
    r = await as(P.BEN, () => call('POST', '/api/course-bookings', { sessionId: future }));
    ok(r.s === 409 && r.j.code === 'NOT_APPLICABLE', 'a course the policy says does not apply cannot be booked', r);

    // a completion about to run out can be given a refresher by bulk assignment
    await q("update training_enrollments set expiry_date = now() + interval '30 days' where user_id = $1 and status = 'completed'", [P.ANN]);
    await q("update training_enrollments set is_active = false where user_id = $1 and status <> 'completed'", [P.ANN]);
    r = await call('POST', '/api/admin/bulk-assign-training', { userIds: [P.ANN], trainingId: training });
    ok(r.s === 200 && (await q("select count(*)::int n from training_enrollments where user_id = $1 and is_active and status <> 'completed'", [P.ANN]))[0].n === 1, 'bulk assignment gives a refresher when the completion is running out', r);
  } catch (e) { fail++; console.log('  FAIL the run stopped:', e.stack); }
  finally {
    try {
      await q('alter table audit_events disable trigger audit_events_append_only_trg');
      try { await q("delete from audit_events where entity_label like 'SEC CAP%' or actor_id = any($1)", [ids]); } finally { await q('alter table audit_events enable trigger audit_events_append_only_trg'); }
      await q('delete from user_role_assignments where user_id = any($1)', [ids]).catch(() => {});
      await cleanup();
      if (meRole) await q("update users set role = $1 where id = 'local-dev-admin'", [meRole]);
    } catch (e) { console.log('cleanup failed', e.message); fail++; }
    await pool.end();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
