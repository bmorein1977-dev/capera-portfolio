// Checks for the faults found in the code review of 26 November 2026, end to end against a running server and the demo database
// (migration 0061). Same setup as the other end-to-end tests: port 5056, LOCAL_DEV_AUTH=true NODE_ENV=development SESSION_SECRET=test.
//   ENABLE_DEMO_TOOLS=true on the server:           node tests/security/reviewfixes.e2e.cjs
//   a server WITHOUT ENABLE_DEMO_TOOLS:   STRICT=1 node tests/security/reviewfixes.e2e.cjs   (checks that acting as someone cannot decide)
// Removes everything it makes and puts the local administrator's role back.
const { Pool } = require('pg');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''); } };
const call = async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { ...(b === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j };
};
const as = async (id, fn) => { const r = await call('POST', '/api/auth/impersonate', { userId: id }); if (r.s !== 200) throw new Error(`could not act as ${id}: ${r.s}`); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };
const signOff = (id, outcome = 'competent') => call('PATCH', `/api/assessments/${id}/sign-off`, { outcome, assessmentMethods: ['Observation'], overallComment: 'SEC RF decision' });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const P = { ADMIN: 'sec-rf-admin', MGR: 'sec-rf-manager', MGR2: 'sec-rf-manager2', ASSESSOR: 'sec-rf-assessor', ASSESSOR2: 'sec-rf-assessor2', VERIFIER: 'sec-rf-verifier', ANN: 'sec-rf-ann', BEN: 'sec-rf-ben', CAL: 'sec-rf-cal' };
  const ids = Object.values(P);
  let meRole = null, roleId = null, catId = null;
  const els = [];
  const cleanup = async () => {
    await q("delete from training_enrollments where training_id in (select id from trainings where name = 'SEC RF course')");
    await q("delete from trainings where name = 'SEC RF course'");
    const as_ = (await q('select id from assessments where candidate_id = any($1)', [ids])).map(r => r.id);
    await q('delete from verifications where assessment_id = any($1)', [as_]);
    await q('delete from assessment_expiry_history where candidate_id = any($1)', [ids]);
    await q('delete from assessment_feedback where assessment_id = any($1)', [as_]).catch(() => {});
    await q('delete from assessments where candidate_id = any($1)', [ids]);
    await q('delete from candidate_allocations where candidate_id = any($1)', [ids]);
    await q('delete from verifier_allocations where verifier_id = any($1) or assessor_id = any($1)', [ids]);
    await q("delete from role_elements where role_id in (select id from job_roles where code = 'SEC-RF-ROLE')");
    await q("delete from job_roles where code = 'SEC-RF-ROLE'");
    await q("delete from competency_elements where code like 'SECRF%'");
    await q("delete from competency_categories where code = 'SEC-RF-CAT'");
    await q('delete from users where id = any($1)', [ids]);
    await q("delete from users where email like 'sec-rf-import%'");
  };
  try {
    await cleanup();
    meRole = (await q("select role from users where id = 'local-dev-admin'"))[0]?.role;
    if (!meRole) { await call('GET', '/api/auth/user'); meRole = (await q("select role from users where id = 'local-dev-admin'"))[0].role; }
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");

    catId = (await q("insert into competency_categories (name, code) values ('SEC RF category', 'SEC-RF-CAT') returning id"))[0].id;
    roleId = (await q("insert into job_roles (name, code) values ('SEC RF role', 'SEC-RF-ROLE') returning id"))[0].id;
    for (const n of [1, 2, 3]) {
      const e = (await q("insert into competency_elements (category_id, name, code, validity_months, safety_criticality) values ($1,$2,$3,12,'High') returning id", [catId, `SEC RF standard ${n}`, `SECRF${n}`]))[0].id;
      els.push(e);
      await q('insert into role_elements (role_id, element_id, required) values ($1,$2,true)', [roleId, e]);
    }
    const mk = (id, role, last, extra = {}) => q('insert into users (id,email,first_name,last_name,role,employment_type,is_active,approval_status,job_role_id,location,manager_id) values ($1,$2,$3,$4,$5,\'employee\',true,\'approved\',$6,$7,$8)',
      [id, `${id}@example.com`, 'Secrf', last, role, extra.jobRole || null, extra.location || null, extra.manager || null]);
    await mk(P.ADMIN, 'admin', 'Admin'); await mk(P.MGR, 'manager', 'Manager'); await mk(P.MGR2, 'manager', 'Othermanager');
    await mk(P.ASSESSOR, 'assessor', 'Assessor'); await mk(P.ASSESSOR2, 'assessor', 'Second'); await mk(P.VERIFIER, 'internal_verifier', 'Verifier');
    for (const [id, last] of [[P.ANN, 'Ann'], [P.BEN, 'Ben'], [P.CAL, 'Cal']]) await mk(id, 'candidate', last, { jobRole: roleId, location: 'SEC RF site', manager: id === P.CAL ? P.MGR2 : P.MGR });
    await q('insert into verifier_allocations (verifier_id, assessor_id) values ($1,$2)', [P.VERIFIER, P.ASSESSOR]);
    const open = async (who, el, assessor, o = {}) => (await q("insert into assessments (candidate_id, element_id, assessor_id, outcome, is_assignment, is_active, created_at) values ($1,$2,$3,'not_yet_competent',true,true, now() + ($4 || ' seconds')::interval) returning id", [who, el, assessor, String(o.after || 0)]))[0].id;
    const row = async (id) => (await q('select *, expiry_date::text as expiry_text from assessments where id = $1', [id]))[0];
    for (const c of [P.ANN, P.BEN, P.CAL]) await q("insert into candidate_allocations (assessor_id, candidate_id) values ($1,$2)", [P.ASSESSOR, c]);

    if (process.env.STRICT) {
      console.log('Without demo mode, nobody can make a competence decision in another person\'s name');
      const a = await open(P.ANN, els[0], P.ASSESSOR);
      let r = await as(P.ASSESSOR, () => signOff(a));
      ok(r.s === 403 && r.j.code === 'ACTING_AS', 'sign-off while acting as the assessor is refused', r);
      r = await as(P.ASSESSOR, () => call('POST', `/api/assessments/${a}/result`, { outcome: 'competent', assessmentMethods: ['Observation'], knowledgeOutcomes: 'k', performanceOutcomes: 'p', overallComment: 'o' }));
      ok(r.s === 403 && r.j.code === 'ACTING_AS', 'so is recording a result', r);
      ok((await row(a)).is_assignment === true, 'nothing was recorded');
      r = await as(P.VERIFIER, () => call('PATCH', `/api/verifications/00000000-0000-0000-0000-000000000000`, { outcome: 'agreed' }));
      ok(r.s === 403, 'and changing a verification', r);
    } else {
      console.log('Sign-off saves the expiry date, and every screen agrees');
      const a1 = await open(P.ANN, els[0], P.ASSESSOR);
      let r = await as(P.ASSESSOR, () => signOff(a1));
      let saved = await row(a1);
      const months = saved.expiry_date ? Math.round((new Date(saved.expiry_date) - new Date(saved.sign_off_at)) / (86400000 * 30.4)) : null;
      ok(r.s === 200 && months === 12, 'a competent sign-off saves an expiry 12 months on, from the standard', { s: r.s, months, e: saved.expiry_text });
      const a2 = await open(P.ANN, els[1], P.ASSESSOR);
      await as(P.ASSESSOR, () => signOff(a2, 'not_yet_competent'));
      ok((await row(a2)).expiry_date === null, "'not yet competent' has no expiry date");

      // an older record signed off with no saved date, two years ago: it must read as expired everywhere
      const a3 = await open(P.ANN, els[2], P.ASSESSOR);
      await q("update assessments set outcome='competent', is_assignment=false, sign_off_at = now() - interval '2 years', assessment_date = now() - interval '2 years', expiry_date = null where id = $1", [a3]);
      const views = async () => {
        const gap = (await call('GET', `/api/users/${P.ANN}/skills-gap`)).j;
        const qr = (await call('GET', `/api/check/${P.ANN}`)).j;
        const matrix = (await call('GET', `/api/team-compliance?roleId=${roleId}&location=${encodeURIComponent('SEC RF site')}`)).j;
        const detail = (await call('GET', `/api/reports/competence-detail?jobRoleId=${roleId}`)).j;
        const kpi = (await call('GET', '/api/reports/element3-kpi')).j;
        const move = (await call('GET', `/api/users/${P.ANN}/role-transition/${roleId}`)).j;
        const of = (list, key) => Object.fromEntries((list || []).map(x => [x.element?.code || key(x), x.status]));
        const dp = (detail.people || []).find(p => p.userId === P.ANN);
        const codeById = Object.fromEntries((detail.elements || []).map(e => [e.elementId, e.elementCode]));
        return {
          gap: of(gap.elements), qr: Object.fromEntries((qr.competence?.items || []).map(i => [i.code, i.status])),
          matrix: of((matrix.members || []).find(m => m.user.id === P.ANN)?.elements),
          detail: Object.fromEntries(Object.entries(dp?.cells || {}).map(([k, v]) => [codeById[k], v.status])),
          move: of(move.elements), overdue: (kpi.overdueAgeing?.items || []).filter(i => i.candidateId === P.ANN).length,
          gapStats: gap.statistics, qrItems: qr.competence?.items,
        };
      };
      let v = await views();
      const agree = (code, want) => ['gap', 'qr', 'matrix', 'detail', 'move'].every(k => v[k][code] === want);
      ok(agree('SECRF3', 'expired'), 'a two-year-old record with no saved date is expired on the skills gap, QR check, team matrix, detail report and role move', { gap: v.gap, qr: v.qr, matrix: v.matrix, detail: v.detail, move: v.move });
      ok(v.overdue === 1, 'and Element 3 counts it as overdue', v.overdue);
      ok(agree('SECRF1', 'current') && agree('SECRF2', 'missing'), 'a new pass is current and a fail is missing on all five', { gap: v.gap, qr: v.qr, matrix: v.matrix, detail: v.detail, move: v.move });
      ok(v.gapStats?.coveragePercentage === 33, 'coverage counts one of three in date', v.gapStats);
      ok(!!v.qrItems?.find(i => i.code === 'SECRF3')?.expiryDate, 'the QR check shows the date it ran out');

      await q("update assessments set expiry_date = now() + interval '20 days' where id = $1", [a1]);
      v = await views();
      ok(agree('SECRF1', 'expiring_30'), 'a record expiring in 20 days shows as expiring on all five', { gap: v.gap, qr: v.qr, matrix: v.matrix, detail: v.detail, move: v.move });
      ok(v.gapStats?.coveragePercentage === 33, 'and still counts as in date', v.gapStats?.coveragePercentage);

      console.log('A planned reassessment, and a renewal recorded as a new record');
      const plan = await open(P.ANN, els[0], P.ASSESSOR, { after: 5 });
      await q('update assessments set updated_at = now() + interval \'10 seconds\' where id = $1', [plan]);
      v = await views();
      ok(agree('SECRF1', 'expiring_30'), 'planning a reassessment does not hide competence that is still valid', { gap: v.gap, detail: v.detail });
      await q("update assessments set sign_off_at = now() - interval '11 months', assessment_date = now() - interval '11 months' where id = $1", [a1]);
      await as(P.ASSESSOR, () => signOff(plan));
      const hist = await q('select * from assessment_expiry_history where candidate_id = $1 and element_id = $2', [P.ANN, els[0]]);
      ok(hist.length === 1 && hist[0].was_breach === false, 'the renewal on a new record is counted for renewal timeliness', hist);
      v = await views();
      ok(agree('SECRF1', 'current'), 'and everything shows the new date', { gap: v.gap, detail: v.detail });
      await as(P.ASSESSOR, () => signOff(plan));
      ok((await q('select count(*)::int n from assessment_expiry_history where candidate_id = $1', [P.ANN]))[0].n === 1, 'correcting a decision made today is not counted as another renewal');

      console.log('My Assessments shows what has been signed off, as well as what is open');
      const redo = await open(P.ANN, els[2], P.ASSESSOR, { after: 20 });
      let mineRows = (await as(P.ANN, () => call('GET', '/api/my-assessments'))).j;
      ok(Array.isArray(mineRows) && mineRows.length > 0 && mineRows.every(x => x.is_assignment === true), 'other screens still get open assessments only', mineRows);
      mineRows = (await as(P.ANN, () => call('GET', '/api/my-assessments?include=results'))).j;
      const decidedRows = mineRows.filter(x => x.is_assignment === false);
      const resultFor = (code) => decidedRows.find(x => x.element?.code === code);
      ok(decidedRows.length === 3 && mineRows.every(x => x.candidate_id === P.ANN), 'one result for each standard, and only their own', decidedRows.map(x => [x.element?.code, x.outcome]));
      ok(resultFor('SECRF1')?.id === plan && resultFor('SECRF1')?.standing === 'current', 'the latest decision is the one shown', resultFor('SECRF1'));
      ok(resultFor('SECRF2')?.outcome === 'not_yet_competent' && resultFor('SECRF2')?.expiryDate === null, "'not yet competent' is shown with no expiry date", resultFor('SECRF2'));
      ok(resultFor('SECRF3')?.standing === 'expired' && new Date(resultFor('SECRF3')?.expiryDate) < new Date(), 'an old record with no saved date shows when it ran out', resultFor('SECRF3'));
      ok(mineRows.some(x => x.id === redo && x.is_assignment === true), 'with its open reassessment listed beside it');

      console.log('The assessor workspace uses the same rule');
      const workspace = async () => (await as(P.ASSESSOR, () => call('GET', `/api/assessors/${P.ASSESSOR}/candidates`))).j.find(c => c.id === P.ANN)?.assessments || [];
      const unfinished = (await workspace()).find(x => x.id === redo);
      ok(!!unfinished && unfinished.result === undefined && unfinished.status !== 'completed', 'an unfinished assessment has no result', unfinished);
      let w = (await workspace()).find(x => x.id === a3);
      ok(w?.status === 'completed' && w?.result === 'competent' && new Date(w?.dueDate) < new Date(), 'the old record has run out here too', w);
      await q('update role_elements set validity_years = 3 where role_id = $1 and element_id = $2', [roleId, els[2]]);
      w = (await workspace()).find(x => x.id === a3);
      const runsFor = w?.dueDate ? Math.round((new Date(w.dueDate) - new Date((await row(a3)).sign_off_at)) / (86400000 * 365.25)) : null;
      const mineThree = (await as(P.ANN, () => call('GET', '/api/my-assessments?include=results'))).j.find(x => x.id === a3);
      ok(runsFor === 3 && mineThree?.standing === 'current', "the job role's own validity period applies here and on My Assessments", { runsFor, standing: mineThree?.standing });
      await q('update role_elements set validity_years = null where role_id = $1 and element_id = $2', [roleId, els[2]]);
      await q("update assessments set outcome = 'competent_with_minor_needs' where id = $1", [a3]);
      w = (await workspace()).find(x => x.id === a3);
      ok(w?.result === 'competent_with_minor_needs', "'competent with minor needs' is not relabelled as training needed", w?.result);
      await q("update assessments set outcome = 'competent' where id = $1", [a3]);
      console.log('The dashboards are told what has been decided, and when it runs out');
      const listed = (await as(P.ASSESSOR, () => call('GET', '/api/assessments'))).j.filter(x => x.candidateId === P.ANN);
      const entry = (id) => listed.find(x => x.id === id);
      ok(entry(redo)?.decided === false && entry(redo)?.effectiveExpiry === null, 'an open assessment is marked as not decided', entry(redo));
      ok(entry(a3)?.decided === true && new Date(entry(a3)?.effectiveExpiry) < new Date(), 'an old pass with no saved date comes with the date it ran out', entry(a3)?.effectiveExpiry);
      ok(entry(a2)?.decided === true && entry(a2)?.effectiveExpiry === null, 'a fail is decided and has no expiry', entry(a2));
      await q('delete from assessments where id = $1', [redo]);

      const course = (await q("insert into trainings (name, category_id, validity_period) select 'SEC RF course', id, 12 from training_categories limit 1 returning id"))[0]?.id;
      await q("insert into training_enrollments (user_id, training_id, status, achievement_date, is_active) values ($1,$2,'completed', now() - interval '2 years', true)", [P.ANN, course]);
      const enrolled = (await as(P.ANN, () => call('GET', `/api/training-enrollments?userId=${P.ANN}`))).j.find(x => x.trainingId === course);
      ok(enrolled?.expiryDate && new Date(enrolled.expiryDate) < new Date(), 'a course completion with no saved date shows when it ran out', enrolled);
      await q('delete from training_enrollments where training_id = $1', [course]);
      await q('delete from trainings where id = $1', [course]);
      ok((await call('GET', `/api/assessors/${P.ASSESSOR}/kpis`)).s === 404, 'the unused figures address with its own expiry rule is gone');

      console.log('Verification: only an agreement verifies');
      const b1 = await open(P.BEN, els[0], P.ASSESSOR);
      await as(P.ASSESSOR, () => signOff(b1));
      const queued = async () => (await as(P.VERIFIER, () => call('GET', `/api/verifiers/${P.VERIFIER}/unverified-assessments`))).j.some(x => x.id === b1);
      ok(await queued(), 'a new sign-off waits in the verifier\'s queue');
      r = await as(P.VERIFIER, () => call('POST', '/api/verifications', { assessmentId: b1, outcome: 'disagreed', verifierComments: 'SEC RF disagree', verificationType: 'summative' }));
      const vid = r.j?.id;
      ok(r.s < 300 && (await row(b1)).verification_status === 'action_required', 'a disagreement leaves it needing action, not verified', { s: r.s, status: (await row(b1)).verification_status, j: r.j });
      ok(!(await queued()), 'it leaves the queue while the assessor acts');
      const mineList = (await as(P.ASSESSOR, () => call('GET', `/api/assessors/${P.ASSESSOR}/verifications`))).j;
      ok(Array.isArray(mineList) && mineList.find(x => x.id === vid)?.actionRequired === true, 'the assessor is told action is required', mineList?.[0]);
      ok((await as(P.ASSESSOR2, () => call('POST', `/api/verifications/${vid}/resolve`, { action: 'explained', note: 'SEC RF not mine to answer' }))).s === 403, 'another assessor cannot answer it');
      ok((await as(P.ASSESSOR, () => call('POST', `/api/verifications/${vid}/resolve`, { action: 'explained', note: 'short' }))).s === 400, 'an answer has to say what was done');
      r = await as(P.ASSESSOR, () => call('POST', `/api/verifications/${vid}/resolve`, { action: 'evidence_added', note: 'SEC RF added the missing observation record' }));
      ok(r.s === 200 && (await row(b1)).verification_status === 'resubmitted' && await queued(), 'once answered it goes back to the verifier', r);
      r = await as(P.VERIFIER, () => call('POST', '/api/verifications', { assessmentId: b1, outcome: 'agreed', verificationType: 'summative' }));
      ok(r.s < 300 && (await row(b1)).verification_status === 'verified', 'and an agreement then verifies it', r);
      await as(P.ASSESSOR, () => signOff(b1, 'not_yet_competent'));
      ok((await row(b1)).verification_status === 'not_verified' && await queued(), 'changing the decision means it needs verifying again');
      const own = await open(P.BEN, els[1], P.ASSESSOR);
      await q("insert into verifier_allocations (verifier_id, assessor_id) values ($1,$2)", [P.VERIFIER, P.VERIFIER]).catch(() => {});
      await q("update assessments set outcome='competent', is_assignment=false, sign_off_at=now(), sign_off_assessor_id=$2 where id=$1", [own, P.VERIFIER]);
      r = await as(P.VERIFIER, () => call('POST', '/api/verifications', { assessmentId: own, outcome: 'agreed' }));
      ok(r.s === 403, 'nobody verifies a decision they signed off themselves', r);

      console.log('The intended assessor gets the work');
      await q('delete from candidate_allocations where candidate_id = $1', [P.CAL]);
      const c1 = await open(P.CAL, els[0], 'local-dev-admin'), cDone = await open(P.CAL, els[1], 'local-dev-admin');
      await q("update assessments set outcome='competent', is_assignment=false, sign_off_at=now() where id=$1", [cDone]);
      r = await call('POST', '/api/candidate-allocations', { assessorId: P.ASSESSOR2, candidateId: P.CAL });
      ok(r.s < 300 && (await row(c1)).assessor_id === P.ASSESSOR2, 'allocating an assessor moves the unfinished assessments to them', { s: r.s, a: (await row(c1)).assessor_id });
      ok((await row(cDone)).assessor_id === 'local-dev-admin', 'signed-off work keeps the name on it');
      await call('POST', '/api/candidate-allocations', { assessorId: P.ASSESSOR, candidateId: P.CAL });
      ok((await row(c1)).assessor_id === P.ASSESSOR2, 'a second allocated assessor does not take over the first one\'s work');

      console.log('Separation of duties');
      const vo = await open(P.VERIFIER, els[0], P.ASSESSOR);
      r = await as(P.VERIFIER, () => call('POST', `/api/assessments/${vo}/result`, { outcome: 'competent', assessmentMethods: ['Observation'], knowledgeOutcomes: 'k', performanceOutcomes: 'p', overallComment: 'o' }));
      ok(r.s === 403 && (await row(vo)).is_assignment === true, 'nobody records a result about themselves', r);
      const g = await open(P.BEN, els[2], P.ASSESSOR);
      r = await as(P.ASSESSOR, () => call('PATCH', `/api/assessments/${g}`, { outcome: 'competent', isAssignment: false }));
      ok(r.s === 403 && (await row(g)).is_assignment === true, 'the general edit route cannot be used to record a result', r);
      r = await as(P.ASSESSOR, () => call('PATCH', `/api/assessments/${g}`, { assessorComments: 'SEC RF note', verificationStatus: 'verified' }));
      ok(r.s === 200 && (await row(g)).verification_status === 'not_verified', 'notes can still be saved, and nobody can mark their own work verified', r);

      console.log('Who can read what');
      r = await as(P.MGR2, () => call('GET', `/api/users/${P.ANN}`));
      ok(r.s === 403, "another team's manager cannot open a person's full record", r.s);
      r = await as(P.MGR, () => call('GET', `/api/users/${P.ANN}`));
      ok(r.s === 200 && r.j.id === P.ANN, 'their own manager can', r.s);
      // admin-only routes judge the real signed-in person, so make the local sign-in a candidate for this one call
      await q("update users set role = 'candidate' where id = 'local-dev-admin'");
      r = await call('GET', '/api/swp/succession-plans/anything/candidates');
      await q("update users set role = 'super_admin' where id = 'local-dev-admin'");
      ok(r.s === 403, 'only administrators see successor lists', r.s);
      r = await as(P.ASSESSOR, () => call('POST', '/api/training-content/00000000-0000-0000-0000-000000000000/progress', { userId: P.ANN, status: 'completed' }));
      ok(r.s === 403, "an assessor cannot record someone else's e-learning progress", r.s);

      console.log('Element 3 keeps to the manager\'s own people');
      const kpiMine = (await as(P.MGR, () => call('GET', '/api/reports/element3-kpi'))).j;
      const kpiOther = (await as(P.MGR2, () => call('GET', '/api/reports/element3-kpi'))).j;
      ok(kpiMine.closeoutTimeliness.compliant.count === 1 && kpiOther.closeoutTimeliness.compliant.count === 0, 'renewal timeliness counts only their own team', [kpiMine.closeoutTimeliness, kpiOther.closeoutTimeliness]);
      ok(kpiOther.ivAssurance.total === 0 && kpiMine.ivAssurance.total >= 2, 'so does verification assurance', [kpiMine.ivAssurance, kpiOther.ivAssurance]);
      ok(kpiOther.outcomeDistribution.total <= 1, 'and the month\'s outcomes', kpiOther.outcomeDistribution);

      console.log('An import cannot give out the top roles');
      await q("update users set role = 'admin' where id = 'local-dev-admin'");
      r = await call('POST', '/api/admin/historical-import', { data: [{ First_Name: 'X', Last_Name: 'Y', Email: 'sec-rf-import@example.com', User_Role: 'Super Admin' }] });
      ok(r.s === 403 && (await q("select count(*)::int n from users where email = 'sec-rf-import@example.com'"))[0].n === 0, 'an administrator cannot import a super administrator', r);
      r = await call('POST', '/api/admin/historical-import', { data: [{ First_Name: 'X', Last_Name: 'Y', Email: 'sec-rf-import2@example.com', userRole: 'developer' }] });
      ok(r.s === 403, 'nor a developer', r);
      await q("update users set role = 'super_admin' where id = 'local-dev-admin'");

      console.log('The routes that never worked are gone');
      for (const p of ['/api/hr/import-users', '/api/competence/import']) ok((await call('POST', p, {})).s === 404, `${p} is removed`);
    }
  } catch (e) { fail++; console.log('  FAIL the run stopped:', e.stack); }
  finally {
    try { await cleanup(); if (meRole) await q('update users set role = $1 where id = \'local-dev-admin\'', [meRole]); } catch (e) { console.log('cleanup failed', e.message); fail++; }
    await pool.end();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
