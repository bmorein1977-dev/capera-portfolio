// Contractor administrators and the QR check, against a running demo server (port 5056, LOCAL_DEV_AUTH=true NODE_ENV=development) and the demo database.
// Creates a few throwaway companies, people and records and removes them when it finishes.
const { Pool } = require('pg');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const call = async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { s: r.status, j };
};
const as = async (id, fn) => { await call('POST', '/api/auth/impersonate', { userId: id }); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const made = { companies: [], users: [] };
  const CA = 'sec-test-ca-a', CB = 'sec-test-ca-b', PB1 = 'sec-test-pb1';
  try {
    const role = (await q("select rt.role_id from role_trainings rt join role_elements re on re.role_id=rt.role_id where rt.required and re.required and coalesce(rt.is_active,true) and coalesce(re.is_active,true) group by rt.role_id limit 1"))[0].role_id;
    const training = (await q("select rt.training_id id, t.name, t.validity_period from role_trainings rt join trainings t on t.id=rt.training_id where rt.role_id=$1 and rt.required and coalesce(rt.is_active,true) limit 1", [role]))[0];
    const element = (await q("select re.element_id id, e.code, e.reassessment_years from role_elements re join competency_elements e on e.id=re.element_id where re.role_id=$1 and re.required and coalesce(re.is_active,true) limit 1", [role]))[0];
    const MANAGER = (await q("select id from users where role='manager' limit 1"))[0].id;
    const OTHERCAND = (await q("select id from users where role='candidate' and coalesce(employment_type,'employee')='employee' limit 1"))[0].id;
    const coA = (await q("insert into contract_companies (name) values ('SEC TEST CONTRACTOR A') returning id"))[0].id;
    const coB = (await q("insert into contract_companies (name) values ('SEC TEST CONTRACTOR B') returning id"))[0].id;
    made.companies = [coA, coB];
    const mk = async (id, email, role_, co, jobRole) => { made.users.push(id); await q("insert into users (id,email,first_name,last_name,role,employment_type,contract_company_id,job_role_id,is_active,approval_status) values ($1,$2,'Sec',$3,$4,'contractor',$5,$6,true,'approved')", [id, email, id.slice(9), role_, co, jobRole]); };
    await mk(CA, 'sec.ca.a@example.com', 'contractor_admin', coA, null);
    await mk(CB, 'sec.ca.b@example.com', 'contractor_admin', coB, null);
    const PA1 = 'sec-test-pa1';
    await mk(PA1, 'sec.pa1@example.com', 'candidate', coA, role);
    await mk(PB1, 'sec.pb1@example.com', 'candidate', coB, role);

    console.log('A contractor administrator sees only their own company');
    const list = await as(CA, () => call('GET', '/api/contractor/people'));
    ok(list.s === 200 && list.j.length === 1 && list.j[0].id === PA1, "their own company's people, nobody else's", list);
    ok((await as(CA, () => call('GET', `/api/contractor/people/${PB1}`))).s === 404, "another company's person is not found");
    ok((await as(CA, () => call('POST', `/api/contractor/people/${PB1}/training`, { trainingId: training.id, completedOn: iso(5) }))).s === 404, "and cannot be recorded against");
    ok((await as(CA, () => call('POST', `/api/contractor/people/${OTHERCAND}/training`, { trainingId: training.id, completedOn: iso(5) }))).s === 404, "nor can one of the host company's own employees");
    ok((await as(CA, () => call('GET', `/api/users/${OTHERCAND}/skills-gap`))).s === 403, "the host company's employees' records are closed to them");
    ok((await as(CA, () => call('GET', `/api/user-skills?userId=${OTHERCAND}`))).s === 403, "skills too");
    ok((await as(CA, () => call('GET', `/api/users/${PA1}/skills-gap`))).s !== 403, "but their own people's are open");
    ok((await as(OTHERCAND, () => call('GET', '/api/contractor/people'))).s === 403, 'a normal employee cannot use the contractor routes');
    ok((await call('GET', '/api/contractor/people')).s === 400, 'a host administrator must choose a company');
    ok((await call('GET', `/api/contractor/people?companyId=${coA}`)).j.length === 1, 'and sees that company when they do');

    console.log('Recording training and competence');
    const before = await as(CA, () => call('GET', `/api/contractor/people/${PA1}`));
    ok(before.j.training.some(t => t.status === 'missing'), 'before: required training is missing');
    ok((await as(CA, () => call('POST', `/api/contractor/people/${PA1}/training`, { trainingId: training.id, completedOn: iso(-5) }))).s === 400, 'a date in the future is refused');
    ok((await as(CA, () => call('POST', `/api/contractor/people/${PA1}/training`, { trainingId: training.id, completedOn: iso(10), expiryDate: iso(20) }))).s === 400, 'an expiry before the achievement is refused');
    ok((await as(CA, () => call('POST', `/api/contractor/people/${PA1}/training`, { trainingId: 'no-such', completedOn: iso(10) }))).s === 400, 'an unknown training is refused');
    const tr = await as(CA, () => call('POST', `/api/contractor/people/${PA1}/training`, { trainingId: training.id, completedOn: iso(10), expiryDate: new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10), certificateRef: 'CERT-123' }));
    ok(tr.s === 201 && tr.j.status === 'active' && tr.j.certificateRef === 'CERT-123', 'training is recorded and marked as a contractor declaration', tr);
    const comp = await as(CA, () => call('POST', `/api/contractor/people/${PA1}/competence`, { elementId: element.id, achievedOn: iso(10), expiryDate: new Date(Date.now() + 700 * 86400000).toISOString().slice(0, 10) }));
    ok(comp.s === 201, 'competence is recorded', comp);
    const after = await as(CA, () => call('GET', `/api/contractor/people/${PA1}`));
    ok(after.j.training.some(t => t.status === 'current') && after.j.competence.some(c => c.status === 'current'), 'both now count as current straight away', after.j.training.map(t => t.status));
    ok(after.j.declarations.length === 2, 'and both appear as declarations');
    const people2 = await as(CA, () => call('GET', '/api/contractor/people'));
    ok(people2.j[0].training.current >= 1 && people2.j[0].competence.current >= 1, 'the figures on the people list moved too');

    console.log('The QR check');
    const full = await as(CA, () => call('GET', `/api/check/${PA1}`));
    ok(full.s === 200 && full.j.full === true && full.j.training.items.some(i => i.declaredByContractor) && full.j.competence.items.some(i => i.declaredByContractor), "a contractor's own administrator sees the full record, with the contractor-declared items marked", full.j && full.j.full);
    ok(full.j.identity.employer === 'SEC TEST CONTRACTOR A', 'it names the employer');
    const other = await as(CB, () => call('GET', `/api/check/${PA1}`));
    ok(other.s === 200 && other.j.full === false && !other.j.training && other.j.identity.firstName, "another company's administrator gets only the short answer", other.j);
    const mgr = await as(MANAGER, () => call('GET', `/api/check/${PA1}`));
    ok(mgr.j.full === true, 'a manager sees the full record of anyone they scan');
    const cand = await as(OTHERCAND, () => call('GET', `/api/check/${PA1}`));
    ok(cand.j.full === false && typeof cand.j.verified === 'boolean' && !cand.j.identity.vantageNumber, 'an ordinary employee sees only name, photo and the tick');
    const self = await as(PA1, () => call('GET', `/api/check/${PA1}`));
    ok(self.j.full === true, 'a person sees their own full record');
    ok((await as(MANAGER, () => call('GET', '/api/check/no-such-person'))).s === 404, 'an unknown code is not recognised');
    const logged = await q("select count(*)::int n from audit_events where action='Checked by QR code' and entity_id=$1 and actor_id = any($2)", [PA1, [CA, MANAGER, PA1]]);
    ok(logged[0].n >= 3, 'every full check is in the audit log', logged[0]);
    const noLog = await q("select count(*)::int n from audit_events where action='Checked by QR code' and entity_id=$1 and actor_id = any($2)", [PA1, [CB, OTHERCAND]]);
    ok(noLog[0].n === 0, 'a short answer is not logged as a full check', noLog[0]);

    console.log('Revoking');
    const decl = after.j.declarations.find(d => d.kind === 'training');
    ok((await as(CB, () => call('POST', `/api/contractor/declarations/${decl.id}/revoke`, { reason: 'not theirs' }))).s === 404, "another company cannot revoke it");
    ok((await as(CA, () => call('POST', `/api/contractor/declarations/${decl.id}/revoke`, {}))).s === 400, 'a reason is needed');
    ok((await as(CA, () => call('POST', `/api/contractor/declarations/${decl.id}/revoke`, { reason: 'Entered in error' }))).s === 200, 'the company can revoke its own entry');
    ok((await as(CA, () => call('POST', `/api/contractor/declarations/${decl.id}/revoke`, { reason: 'again' }))).s === 409, 'but only once');
    const reverted = await as(CA, () => call('GET', `/api/contractor/people/${PA1}`));
    ok(reverted.j.training.some(t => t.status === 'missing'), 'the training stops counting', reverted.j.training.map(t => t.status));
    const hostList = await call('GET', `/api/contractor/declarations?companyId=${coA}&status=all`);
    ok(hostList.s === 200 && hostList.j.length === 2 && hostList.j.some(d => d.status === 'revoked' && d.revokedReason === 'Entered in error'), 'the host sees both, with the revoked one kept as history');

    console.log('Adding and removing people');
    const add = await as(CA, () => call('POST', '/api/contractor/people', { firstName: 'Newly', lastName: 'Added', email: 'sec.newly.added@example.com', jobRoleId: role }));
    ok(add.s === 201 && add.j.status === 'pending', 'a person is added as pending', add);
    const newId = add.j.id; made.users.push(newId);
    const row = (await q("select is_active, approval_status, employment_type, contract_company_id, role from users where id=$1", [newId]))[0];
    ok(row.is_active === false && row.approval_status === 'pending' && row.employment_type === 'contractor' && row.contract_company_id === coA && row.role === 'candidate', 'inactive, pending, a contractor of the right company, an ordinary role', row);
    ok((await as(CA, () => call('POST', '/api/contractor/people', { firstName: 'Dup', lastName: 'Email', email: 'sec.newly.added@example.com' }))).s === 409, 'a repeated email is refused');
    ok((await as(CA, () => call('POST', '/api/contractor/people', { firstName: 'Bad', lastName: 'Email', email: 'nope' }))).s === 400, 'an invalid email is refused');
    ok((await as(CA, () => call('POST', `/api/contractor/people/${newId}/training`, { trainingId: training.id, completedOn: iso(5) }))).s === 409, 'nothing can be recorded for a person who is not approved yet');
    const pcheck = await as(MANAGER, () => call('GET', `/api/check/${newId}`));
    ok(pcheck.j.verified === false && pcheck.j.identity.working === false, 'a pending person is never "ready to work"');
    const pend = await call('GET', '/api/contractor/pending');
    ok(pend.s === 200 && pend.j.some(p => p.id === newId), 'the host sees them waiting');
    const appr = await call('POST', `/api/contractor/people/${newId}/approve`);
    ok(appr.s === 200, 'the host approves them', appr);
    const row2 = (await q("select is_active, approval_status from users where id=$1", [newId]))[0];
    ok(row2.is_active === true && row2.approval_status === 'approved', 'now active and approved');
    const reqs = (await q("select (select count(*)::int from assessments where candidate_id=$1) a, (select count(*)::int from training_enrollments where user_id=$1) t", [newId]))[0];
    ok(reqs.a > 0 && reqs.t > 0, 'approving gives them their job role requirements', reqs);
    ok((await call('POST', `/api/contractor/people/${newId}/approve`)).s === 409, 'and cannot be approved twice');
    const leave = await as(CA, () => call('POST', `/api/contractor/people/${newId}/leave`, {}));
    ok(leave.s === 200, 'the company can mark them as having left', leave);
    ok((await as(CA, () => call('GET', '/api/contractor/people'))).j.every(p => p.id !== newId), 'they drop off the list');
    ok((await as(CA, () => call('POST', `/api/contractor/people/${PB1}/leave`, {}))).s === 404, "and cannot remove another company's person");
    const reject = await as(CA, () => call('POST', '/api/contractor/people', { firstName: 'Will', lastName: 'Reject', email: 'sec.will.reject@example.com' }));
    made.users.push(reject.j.id);
    ok((await call('POST', `/api/contractor/people/${reject.j.id}/reject`)).s === 200 && (await q("select approval_status, is_archived from users where id=$1", [reject.j.id]))[0].approval_status === 'rejected', 'the host can decline a person');

    console.log('A contractor administrator must belong to a company');
    const emp = (await q("select id, role, employment_type, contract_company_id from users where id=$1", [OTHERCAND]))[0];
    const bad = await call('PATCH', `/api/users/${OTHERCAND}`, { role: 'contractor_admin' });
    ok(bad.s === 400, 'cannot give the role to someone who is not a contractor with a company', bad);
    const still = (await q("select role from users where id=$1", [OTHERCAND]))[0];
    ok(still.role === emp.role, 'and nothing changed');

    console.log('Sign-in returns to the scanned page');
    const lr = await fetch(B + '/api/login?returnTo=/check/abc', { redirect: 'manual' });
    ok(lr.status === 302, 'the sign-in start route accepts a return address (in local development it just goes home)');
  } catch (e) {
    fail++; console.log('  ERROR', e && e.stack || e);
  } finally {
    try {
      const ids = made.users;
      await q("delete from contractor_declarations where user_id = any($1)", [ids]);
      await q("delete from training_completion_audit where user_id = any($1)", [ids]);
      await q("delete from training_enrollments where user_id = any($1)", [ids]);
      await q("delete from assessments where candidate_id = any($1)", [ids]);
      await q("delete from audit_events where actor_id = any($1) or entity_id = any($1)", [ids]);
      await q("delete from users where id = any($1)", [ids]);
      await q("delete from users where email like 'sec.%@example.com'");
      await q("delete from contract_companies where id = any($1)", [made.companies]);
    } catch (e) { console.log('  cleanup problem', e.message); }
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
