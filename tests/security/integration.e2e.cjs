// The integration interface, skills gap analysis, verification sampling and standardisation, the historical import and a person's data
// download, end to end. Same setup as capabilities.e2e.cjs. Removes everything it makes.
const { Pool } = require('pg');
const JSZip = require('jszip');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); } };
const raw = async (m, p, b, h = {}) => {
  const r = await fetch(B + p, { method: m, headers: { ...(b === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie && !h.authorization ? { cookie } : {}), ...h }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc && !h.authorization) cookie = sc.split(';')[0];
  return r;
};
const call = async (m, p, b, h) => { const r = await raw(m, p, b, h); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const as = async (id, fn) => { const r = await call('POST', '/api/auth/impersonate', { userId: id }); if (r.s !== 200) throw new Error(`could not act as ${id}: ${r.s}`); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const P = { MGR: 'sec-int-manager', OTHER: 'sec-int-othermanager', ASSESSOR: 'sec-int-assessor', VERIFIER: 'sec-int-verifier', ANN: 'sec-int-ann', BEN: 'sec-int-ben', CAL: 'sec-int-cal', BOSS: 'sec-int-admin' };
  const ids = Object.values(P);
  let meRole = null;
  const reallyAs = async (role, fn) => { await q("update users set role = $1 where id = 'local-dev-admin'", [role]); try { return await fn(); } finally { await q("update users set role = 'super_admin' where id = 'local-dev-admin'"); } };
  const everyone = async () => (await q("select id from users where id = any($1) or lower(coalesce(email,'')) like 'sec-int-%' or company_number like 'SECINT%'", [ids])).map(r => r.id);
  const cleanup = async () => {
    const who = await everyone();
    const as_ = (await q('select id from assessments where candidate_id = any($1)', [who])).map(r => r.id);
    await q('delete from verifications where assessment_id = any($1)', [as_]);
    await q('delete from assessment_expiry_history where candidate_id = any($1)', [who]);
    await q('delete from assessment_evidence where assessment_id = any($1)', [as_]);
    await q('delete from assessments where candidate_id = any($1) or assessor_id = any($1)', [who]);
    await q('delete from training_enrollments where user_id = any($1)', [who]);
    await q('delete from sampling_plans where verifier_id = any($1)', [who]);
    await q('delete from verifier_allocations where verifier_id = any($1)', [who]);
    await q('delete from candidate_allocations where candidate_id = any($1) or assessor_id = any($1)', [who]);
    await q("delete from standardisation_records where title like 'SEC INT%'");
    await q("delete from api_keys where name like 'SEC INT%'");
    await q("delete from role_elements where role_id in (select id from job_roles where code = 'SEC-INT-ROLE')");
    await q('delete from users where id = any($1)', [who]);
    await q("delete from users where email in ('alma.assessor@imported.local')");
    await q("delete from job_roles where code = 'SEC-INT-ROLE'");
    await q("delete from competency_element_versions where element_id in (select id from competency_elements where code like 'SECINT%')");
    await q("delete from competency_elements where code like 'SECINT%'");
    await q("delete from competency_categories where code = 'SEC-INT-CAT'");
  };
  try {
    await cleanup();
    await call('GET', '/api/auth/user');
    meRole = (await q("select role from users where id = 'local-dev-admin'"))[0].role;
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");
    const cat = (await q("insert into competency_categories (name, code) values ('SEC INT category', 'SEC-INT-CAT') returning id"))[0].id;
    const roleId = (await q("insert into job_roles (name, code) values ('SEC INT role', 'SEC-INT-ROLE') returning id"))[0].id;
    const els = [];
    for (const [n, crit] of [[1, 'High'], [2, 'Low']]) {
      const e = (await q("insert into competency_elements (category_id, name, code, validity_months, safety_criticality) values ($1,$2,$3,24,$4) returning id", [cat, `SEC INT standard ${n}`, `SECINT${n}`, crit]))[0].id;
      els.push(e);
      await q('insert into role_elements (role_id, element_id, required) values ($1,$2,true)', [roleId, e]);
    }
    const mk = (id, role, last, o = {}) => q("insert into users (id,email,first_name,last_name,role,employment_type,is_active,approval_status,job_role_id,location,manager_id,company_number) values ($1,$2,'Secint',$3,$4,'employee',true,'approved',$5,$6,$7,$8)",
      [id, `${id}@example.com`, last, role, o.jobRole || null, o.location || null, o.manager || null, o.number || null]);
    await mk(P.MGR, 'manager', 'Manager', { number: 'SECINT-M1' }); await mk(P.OTHER, 'manager', 'Othermanager'); await mk(P.ASSESSOR, 'assessor', 'Assessor'); await mk(P.VERIFIER, 'internal_verifier', 'Verifier'); await mk(P.BOSS, 'admin', 'Admin', { number: 'SECINT-A1' });
    await mk(P.ANN, 'candidate', 'Ann', { jobRole: roleId, location: 'SEC INT site', manager: P.MGR, number: 'SECINT-1' });
    await mk(P.BEN, 'candidate', 'Ben', { jobRole: roleId, location: 'SEC INT site', manager: P.MGR, number: 'SECINT-2' });
    await mk(P.CAL, 'candidate', 'Cal', { jobRole: roleId, location: 'SEC INT site', manager: P.OTHER, number: 'SECINT-3' });
    const result = async (who, el, o = {}) => (await q("insert into assessments (candidate_id, element_id, assessor_id, outcome, is_assignment, is_active, sign_off_at, assessment_date, expiry_date, verification_status) values ($1,$2,$3,$4,false,true, now() - make_interval(days => $5::int), now() - make_interval(days => $5::int), now() + make_interval(days => $6::int), $7) returning id",
      [who, el, P.ASSESSOR, o.outcome || 'competent', o.ago ?? 10, o.left ?? 400, o.verification || 'not_verified']))[0].id;
    const annHigh = await result(P.ANN, els[0]);
    await result(P.ANN, els[1], { ago: 800, left: -5 });
    const benHigh = await result(P.BEN, els[0], { left: 40 });

    console.log('Skills gap analysis');
    let r = await call('GET', `/api/reports/skills-gap?jobRoleId=${roleId}`);
    const s1 = r.j.byStandard?.find(s => s.code === 'SECINT1'), s2 = r.j.byStandard?.find(s => s.code === 'SECINT2');
    ok(r.s === 200 && r.j.people === 3 && r.j.competence.required === 6 && r.j.competence.inDate === 2, 'it counts what three people need and hold', r.j.competence);
    ok(s1.required === 3 && s1.inDate === 2 && s1.missing === 1 && s1.expiring === 1 && s1.safetyCritical, 'by standard: held, due soon and not held', s1);
    ok(s2.expired === 1 && s2.missing === 2 && s2.shortfall.length === 3, 'and who has the gap', s2);
    ok(r.j.byRole[0].people === 3 && r.j.bySite.some(x => x.name === 'SEC INT site'), 'by job role and by location');
    r = await as(P.MGR, () => call('GET', `/api/reports/skills-gap?jobRoleId=${roleId}`));
    ok(r.s === 200 && r.j.people === 2 && !JSON.stringify(r.j).includes('Secint Cal'), 'a manager sees their own people only', r.j.people);
    ok((await reallyAs('candidate', () => call('GET', '/api/reports/skills-gap'))).s === 403, 'a candidate does not see it');

    console.log('Verification sampling');
    await q('insert into verifier_allocations (verifier_id, assessor_id) values ($1,$2)', [P.VERIFIER, P.ASSESSOR]);
    r = await as(P.VERIFIER, () => call('POST', '/api/sampling-plans', { verifierId: P.VERIFIER, assessorId: P.ASSESSOR, targetPercentage: 0, method: 'coverage' }));
    ok(r.s === 201 && r.j.method === 'coverage', 'a verifier sets the target and method', r);
    const planId = r.j.id;
    const queue = async () => (await as(P.VERIFIER, () => call('GET', `/api/verifiers/${P.VERIFIER}/dashboard`))).j.assessorQueue.find(a => a.assessorId === P.ASSESSOR);
    let qd = await queue();
    ok(qd.candidates.length === 0 && qd.samplingMethod === 'coverage', 'with a nil target, coverage offers nothing', qd);
    await q("update assessments set verification_status = 'resubmitted' where id = $1", [benHigh]);
    qd = await queue();
    ok(qd.candidates.length === 1 && qd.candidates[0].assessments.some(a => a.id === benHigh), 'work sent back after action is offered even though the target is met', qd.candidates);
    await q("update assessments set verification_status = 'not_verified' where id = $1", [benHigh]);
    await as(P.VERIFIER, () => call('PATCH', `/api/sampling-plans/${planId}`, { method: 'risk' }));
    qd = await queue();
    ok(qd.samplingMethod === 'risk' && qd.candidates.length === 2, 'risk based offers safety-critical work by an assessor new to the verifier', qd.candidates.map(c => c.candidateName));
    ok((await as(P.VERIFIER, () => call('PATCH', `/api/sampling-plans/${planId}`, { method: 'whatever' }))).s === 400, 'an unknown method is refused');
    ok((await reallyAs('internal_verifier', () => call('POST', '/api/sampling-plans', { verifierId: P.VERIFIER, assessorId: P.ASSESSOR, targetPercentage: 5 }))).s === 403, 'a verifier cannot set another verifier\'s sampling');
    await as(P.VERIFIER, () => call('PATCH', `/api/sampling-plans/${planId}`, { method: 'random', targetPercentage: 100 }));
    const first = (await queue()).candidates.map(c => c.candidateId).join(), second = (await queue()).candidates.map(c => c.candidateId).join();
    ok(first === second && first.length > 0, 'a random order stays the same within the quarter', [first, second]);

    console.log('Standardisation records');
    const meeting = { heldOn: new Date().toISOString().slice(0, 10), title: 'SEC INT standardisation', attendeeIds: [P.ASSESSOR, P.VERIFIER], discussion: 'Compared two assessments of the same task.', agreedApproach: 'Observe twice for safety-critical tasks.', actions: [{ what: 'Update guidance', ownerId: P.VERIFIER, dueOn: '2027-01-31' }] };
    r = await as(P.VERIFIER, () => call('POST', '/api/standardisation', meeting));
    ok(r.s === 201, 'a verifier records a meeting', r);
    ok((await as(P.ASSESSOR, () => call('GET', '/api/standardisation'))).j.records.some(x => x.title === 'SEC INT standardisation'), 'an assessor who attended can read it');
    ok((await reallyAs('assessor', () => call('POST', '/api/standardisation', meeting))).s === 403, 'but cannot record one');
    ok((await as(P.VERIFIER, () => call('POST', '/api/standardisation', { ...meeting, heldOn: '2099-01-01' }))).s === 400, 'a meeting that has not happened is refused');

    console.log('Performance targets');
    ok((await call('PATCH', '/api/kpi-targets/not_a_target', { label: 'x', targetPercentage: 90 })).s === 400, 'only listed targets can be set');

    console.log('Historical import: try first, and never replace a decision made in Capera');
    const importRow = (o) => ({ User: 'Secint Ann', Email: `${P.ANN}@example.com`, 'Role (Super Admin, Admin, Internal Verifier, Assessor, Candidate)': 'Candidate', 'Competence Category (Optional)': 'SEC INT category', 'Competence Element (Optional)': 'SEC INT standard 1', 'Assessor (Required if Competence Element given)': 'Alma Assessor', 'Assessment Date (Required if Competence Element given)': '2024-03-01', ...o });
    const rows = [importRow({}), importRow({ User: 'Secint Cal', Email: `${P.CAL}@example.com`, 'Competence Element (Optional)': 'SEC INT standard 2' }), importRow({ User: 'Secint New', Email: 'sec-int-new@example.com', 'Competence Element (Optional)': 'No such standard' }), importRow({ User: 'Secint Noemail', Email: '' })];
    const before = (await q('select count(*)::int n from assessments'))[0].n, peopleBefore = (await q('select count(*)::int n from users'))[0].n;
    r = await call('POST', '/api/admin/historical-import', { data: rows, dryRun: true });
    ok(r.s === 200 && r.j.dryRun === true && r.j.totals.competenceProtected === 1 && r.j.rowsWithProblems === 2 && r.j.totals.rowsWithoutEmail === 1, 'the trial run finds the protected record, the unknown standard and the missing email', r.j.totals || r.j);
    ok((await q('select count(*)::int n from assessments'))[0].n === before && (await q('select count(*)::int n from users'))[0].n === peopleBefore, 'and changes nothing at all');
    r = await call('POST', '/api/admin/historical-import', { data: rows.slice(0, 2) });
    const held = (await q('select outcome, assessor_id, assessor_comments from assessments where id = $1', [annHigh]))[0];
    ok(r.s === 200 && held.assessor_id === P.ASSESSOR && r.j.errors.some(e => /signed off in Capera/.test(e.error)), 'the real run leaves the signed-off decision alone and says so', [held, r.j.errors]);
    ok((await q("select count(*)::int n from assessments where candidate_id = $1 and element_id = $2 and origin = 'historical_import'", [P.CAL, els[1]]))[0].n === 1, 'the other row is imported and marked as imported');

    console.log("A person's data");
    let res = await raw('GET', `/api/users/${P.ANN}/data-export`);
    const zip = res.ok ? await JSZip.loadAsync(Buffer.from(await res.arrayBuffer())) : null;
    const profile = zip ? JSON.parse(await zip.file('records/profile.json').async('string'))[0] : null;
    const contents = zip ? JSON.parse(await zip.file('contents.json').async('string')) : null;
    ok(res.status === 200 && profile?.email === `${P.ANN}@example.com` && JSON.parse(await zip.file('records/assessments.json').async('string')).length >= 2, 'an administrator downloads what is held about a person', res.status);
    ok(profile && !('provider_sub' in profile) && !('cv_object_key' in profile), 'without sign-in identifiers or storage addresses', Object.keys(profile || {}));
    ok(contents && contents.contents.every(c => !/could not be read: /.test(c.note || '') ), 'every kind of record could be read', contents?.contents.filter(c => c.note));
    ok((await reallyAs('manager', () => call('GET', `/api/users/${P.ANN}/data-export`))).s === 403, 'a manager cannot');

    console.log('Integration keys');
    r = await call('POST', '/api/api-keys', { name: 'SEC INT reporting', scopes: ['competence:read'] });
    const reading = r.j.key, readingId = r.j.id;
    ok(r.s === 201 && /^capk_/.test(reading) && !r.j.keyHash, 'an administrator creates a key and sees it once', r.s);
    const stored = (await q('select * from api_keys where id = $1', [readingId]))[0];
    ok(stored.key_hash && stored.key_hash !== reading && !JSON.stringify(stored).includes(reading), 'only its fingerprint is stored');
    ok(!JSON.stringify((await call('GET', '/api/api-keys')).j).includes(reading), 'and it is never shown again');
    ok((await reallyAs('manager', () => call('POST', '/api/api-keys', { name: 'SEC INT x', scopes: ['people:read'] }))).s === 403, 'only administrators can create keys');
    const hr = (await call('POST', '/api/api-keys', { name: 'SEC INT hr', scopes: ['people:write', 'people:read'] })).j.key;
    const bearer = (k) => ({ authorization: `Bearer ${k}` });

    console.log('Reading through the interface');
    ok((await call('GET', '/api/v1/competence', undefined, { authorization: 'Bearer capk_not_a_real_key_000000000000' })).s === 401, 'a made-up key is refused');
    ok((await call('GET', '/api/v1/competence', undefined, { authorization: 'Basic abc' })).s === 401, 'so is no key');
    ok((await call('GET', '/api/v1/people', undefined, bearer(reading))).s === 403, 'a key can only do what its scopes allow');
    r = await call('GET', '/api/v1/competence?pageSize=1000', undefined, bearer(reading));
    let mine = (r.j.items || []).filter(i => i.personId === P.ANN);
    for (let pg = 2; mine.length < 2 && pg <= Math.ceil((r.j.total || 0) / 1000); pg++) mine = mine.concat((await call('GET', `/api/v1/competence?pageSize=1000&page=${pg}`, undefined, bearer(reading))).j.items.filter(i => i.personId === P.ANN));
    ok(r.s === 200 && mine.length === 2 && mine.find(i => i.standardCode === 'SECINT1').valid === true && mine.find(i => i.standardCode === 'SECINT2').status === 'expired', 'competence status matches the screens', mine);
    ok((await call('GET', '/api/v1/training?pageSize=5', undefined, bearer(reading))).s === 200 && (await call('GET', '/api/v1/standards', undefined, bearer(reading))).j.total > 0, 'training status and standards are served');
    const doc = await call('GET', '/api/v1/openapi.json', undefined, bearer(reading));
    ok(doc.s === 200 && doc.j.openapi && doc.j.paths['/people/sync'], 'the interface describes itself (OpenAPI)');

    console.log('An HR feed');
    const feed = [
      { employeeNumber: 'SECINT-1', location: 'SEC INT new site', team: 'Night', managerEmployeeNumber: 'SECINT-NEW-M' },
      { employeeNumber: 'SECINT-NEW-M', email: 'sec-int-newmgr@example.com', firstName: 'Nia', lastName: 'Newmanager' },
      { employeeNumber: 'SECINT-NEW-1', email: 'sec-int-starter@example.com', firstName: 'Sam', lastName: 'Starter', jobRoleCode: 'SEC-INT-ROLE', managerEmployeeNumber: 'SECINT-M1', startDate: '2026-11-01' },
      { employeeNumber: 'SECINT-2', leavingDate: '2026-10-31' },
    ];
    const countUsers = async () => (await q('select count(*)::int n from users'))[0].n;
    let n = await countUsers();
    r = await call('POST', '/api/v1/people/sync', { people: feed }, bearer(hr));
    ok(r.s === 200 && r.j.dryRun === true && r.j.applied === false && r.j.summary.create === 2 && r.j.summary.update === 1 && r.j.summary.leaver === 1, 'by default it only says what it would do', r.j.summary || r.j);
    ok(await countUsers() === n && (await q('select location from users where id = $1', [P.ANN]))[0].location === 'SEC INT site', 'and changes nothing');
    r = await call('POST', '/api/v1/people/sync', { dryRun: false, people: [...feed, { employeeNumber: 'SECINT-A1', location: 'taken over' }] }, bearer(hr));
    ok(r.s === 422 && r.j.applied === false && await countUsers() === n && /administrator/.test(r.j.rows.at(-1).message), "one bad row stops the whole batch; an administrator's account cannot be changed", r.j.rows?.at(-1));
    ok((await call('POST', '/api/v1/people/sync', { dryRun: false, people: [{ employeeNumber: 'SECINT-1', role: 'super_admin' }] }, bearer(hr))).j.rows[0].action === 'error', 'a role cannot be sent at all');
    r = await call('POST', '/api/v1/people/sync', { dryRun: false, people: feed }, bearer(hr));
    ok(r.s === 200 && r.j.applied === true, 'a clean batch is applied', r.j);
    const ann = (await q('select u.location, u.team_shift, m.company_number mgr from users u left join users m on m.id = u.manager_id where u.id = $1', [P.ANN]))[0];
    ok(ann.location === 'SEC INT new site' && ann.team_shift === 'Night' && ann.mgr === 'SECINT-NEW-M', 'a mover gets location, team and a manager who arrived in the same batch', ann);
    const starter = (await q("select * from users where company_number = 'SECINT-NEW-1'"))[0];
    ok(starter?.role === 'candidate' && starter.job_role_id === roleId && starter.manager_id === P.MGR && (await q('select count(*)::int n from assessments where candidate_id = $1', [starter.id]))[0].n === 2, "a starter gets the role's requirements assigned", starter?.role);
    const leaver = (await q('select is_archived, left_at from users where id = $1', [P.BEN]))[0];
    ok(leaver.is_archived === true && leaver.left_at, 'a leaver is archived with the date', leaver);
    r = await call('POST', '/api/v1/people/sync', { dryRun: false, people: feed }, bearer(hr));
    ok(r.j.summary.unchanged === 4, 'sending the same batch again changes nothing', r.j.summary);
    r = await call('GET', '/api/v1/people?pageSize=1000', undefined, bearer(hr));
    ok(r.s === 200 && r.j.items.every(i => !('role' in i) && !('dateOfBirth' in i)), 'the people list carries no Capera role or date of birth');
    await call('POST', `/api/api-keys/${readingId}/revoke`);
    ok((await call('GET', '/api/v1/standards', undefined, bearer(reading))).s === 401, 'a revoked key stops working at once');
    ok((await q("select count(*)::int n from audit_events where entity_type = 'Integration key' and entity_id = $1", [readingId]))[0].n >= 2, 'creating and revoking it are in the audit log');
  } catch (e) { fail++; console.log('  FAIL the run stopped:', e.stack); }
  finally {
    try { await cleanup(); if (meRole) await q("update users set role = $1 where id = 'local-dev-admin'", [meRole]); } catch (e) { console.log('cleanup failed', e.message); fail++; }
    await pool.end();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
