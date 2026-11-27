// A person's own records: Evidence Portal and My Profile. Against a running demo server (port 5056, LOCAL_DEV_AUTH=true NODE_ENV=development,
// SESSION_SECRET=test, LOCAL_OBJECT_STORAGE_DIR set to an empty scratch folder for the server and the test) and the demo database.
// Creates throwaway people and assessments, and removes everything it made when it finishes.
const { Pool } = require('pg');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : ''); } };
const raw = async (m, p, b) => {
  const form = b instanceof FormData;
  const r = await fetch(B + p, { method: m, headers: { ...(form || b === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : form ? b : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return r;
};
const call = async (m, p, b) => { const r = await raw(m, p, b); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const as = async (id, fn) => { await call('POST', '/api/auth/impersonate', { userId: id }); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };
const PDF = Buffer.from('%PDF-1.4\n% test evidence\n');
const send = (fields, files = []) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); for (const x of files) f.append('files', new Blob([x.data]), x.name); return call('POST', '/api/evidence', f); };

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const ME = 'sec-my-cand', OTHER = 'sec-my-other', ASSESSOR = 'sec-my-assessor', MGR = 'sec-my-manager';
  const people = [ME, OTHER, ASSESSOR, MGR];
  const startedAt = (await q("select (now() at time zone 'utc')::text t"))[0].t;
  const cleanup = async () => {
    await q('delete from assessment_evidence where assessment_id in (select id from assessments where candidate_id = any($1))', [people]);
    await q('delete from assessments where candidate_id = any($1)', [people]);
    await q("delete from notification_logs where created_at >= $1::timestamp and (body like '%SEC MY%' or subject like '%SEC MY%')", [startedAt]);
    await q('delete from users where id = any($1)', [people]);
  };
  try {
    await cleanup();
    const mk = (id, role, last, extra = {}) => q("insert into users (id,email,first_name,last_name,role,employment_type,is_active,approval_status,date_of_birth,avatar_object_key) values ($1,$2,'Sec',$3,$4,'employee',true,'approved',$5,$6)", [id, `${id}@example.com`, last, role, extra.dob || null, extra.avatar || null]);
    await mk(ASSESSOR, 'assessor', 'Assessor'); await mk(OTHER, 'candidate', 'Other'); await mk(MGR, 'manager', 'Manager');
    await mk(ME, 'candidate', 'Person', { dob: '1990-01-02', avatar: 'avatars/ZZSECRETKEY' });
    await q('update users set manager_id = $1 where id = $2', [MGR, ME]);
    const elements = await q('select id, code from competency_elements order by code limit 5');
    const asmt = async (who, el, o) => (await q("insert into assessments (candidate_id, element_id, assessor_id, outcome, is_assignment, is_active, sign_off_at, assessment_date, assessor_comments) values ($1,$2,$3,$4,$5,true,$6,now(),'ZZASSESSOR-PRIVATE') returning id", [who, el, ASSESSOR, o.outcome, o.assignment, o.signed ? new Date().toISOString() : null]))[0].id;
    const mine = await asmt(ME, elements[0].id, { outcome: 'not_yet_competent', assignment: true });
    const signed = await asmt(ME, elements[1].id, { outcome: 'competent', assignment: false, signed: true });
    const draft = await asmt(ME, elements[2].id, { outcome: 'not_yet_competent', assignment: false });
    const unsignedOk = await asmt(ME, elements[3].id, { outcome: 'competent', assignment: false });
    const theirs = await asmt(OTHER, elements[0].id, { outcome: 'not_yet_competent', assignment: true });
    const managers = await asmt(MGR, elements[4].id, { outcome: 'not_yet_competent', assignment: true });
    await q("insert into assessment_evidence (assessment_id, file_name, file_url, mime_type, uploaded_by, title, description) values ($1,'other.pdf','evidence/ZZOTHERKEY','application/pdf',$2,'ZZOTHER-TITLE','ZZOTHER-WORDS')", [theirs, OTHER]);
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");

    console.log('What a person is shown');
    let r = await as(ME, () => call('GET', '/api/my-evidence'));
    ok(r.s === 200 && r.j.openAssessments.length === 1 && r.j.openAssessments[0].id === mine && r.j.evidence.length === 0, 'only their own open assignment is offered, and they start with no evidence: nothing invented', r.j);

    console.log('A written note is saved with what the person wrote');
    const words = 'ZZMINE I carried out the isolation with A. Supervisor on night shift.';
    const base = { assessmentId: mine, evidenceType: 'observation record', evidenceTitle: 'SEC MY isolation note', description: words };
    ok((await as(ME, () => send({ ...base, evidenceTitle: '  ' }))).s === 400, 'a title is needed');
    ok((await as(ME, () => send({ ...base, description: '' }))).s === 400, 'with no file, a description is needed: an empty record is not made');
    ok((await as(ME, () => send({ ...base, evidenceTitle: 'x'.repeat(201) }))).s === 400 && (await as(ME, () => send({ ...base, description: 'x'.repeat(5001) }))).s === 400, 'over-long text is refused, not cut');
    const note = await as(ME, () => send(base));
    ok(note.s === 201, 'a note is accepted', note);
    let row = (await q('select * from assessment_evidence where assessment_id = $1', [mine]))[0];
    ok(row && row.title === 'SEC MY isolation note' && row.evidence_type === 'Observation record' && row.description === words && row.file_url === '', 'title, kind and description are all kept', row);
    r = await as(ME, () => call('GET', '/api/my-evidence'));
    ok(r.j.evidence.length === 1 && r.j.evidence[0].description === words && r.j.evidence[0].hasFile === false && r.j.evidence[0].mine === true, 'and shown back to them', r.j.evidence);

    console.log('A file is stored and can be opened again');
    const filed = await as(ME, () => send({ ...base, evidenceType: 'Document', evidenceTitle: 'SEC MY certificate scan', description: '' }, [{ name: 'scan.pdf', data: PDF }]));
    ok(filed.s === 201, 'a file with a title needs no description', filed);
    row = (await q("select * from assessment_evidence where assessment_id = $1 and title = 'SEC MY certificate scan'", [mine]))[0];
    ok(row && row.file_url && row.description === null && row.file_name === 'scan.pdf', 'the file and its title are recorded', row);
    const dl = await as(ME, () => raw('GET', `/api/assessment-evidence/${row.id}/download`));
    ok(dl.status === 200 && Buffer.from(await dl.arrayBuffer()).equals(PDF), 'what comes back is the file that was sent', dl.status);
    ok((await as(OTHER, () => call('GET', `/api/assessment-evidence/${row.id}/download`))).s === 403, 'another person cannot open it');
    const unknown = await as(ME, () => send({ ...base, evidenceType: '<script>', evidenceTitle: 'SEC MY odd type' }));
    ok(unknown.s === 201 && (await q("select evidence_type from assessment_evidence where title = 'SEC MY odd type'"))[0].evidence_type === null, 'an unrecognised kind is not stored as typed');

    console.log('Whose records');
    r = await as(ME, () => call('GET', '/api/my-evidence'));
    const text = JSON.stringify(r.j);
    ok(!/ZZOTHER|fileUrl|file_url|evidence\/|aiVerdict|aiReasoning/.test(text), "nothing of anyone else's, no storage address and no review notes", text.slice(0, 200));
    ok(JSON.stringify((await as(ME, () => call('GET', `/api/my-evidence?userId=${OTHER}&candidateId=${OTHER}`))).j) === text, 'naming someone else in the address changes nothing');
    ok((await as(ME, () => send({ ...base, assessmentId: theirs }))).s === 403, "they cannot add to another person's assessment");
    ok((await as(ME, () => send({ ...base, assessmentId: signed }))).s === 409, 'nor to their own once it is signed off');
    ok((await as(MGR, () => send({ ...base, assessmentId: managers, evidenceTitle: 'SEC MY manager note' }))).s === 201, 'a manager can add evidence to their own assessment');
    ok((await as(MGR, () => send({ ...base, assessmentId: mine }))).s === 403, "but not to their team member's");
    ok((await as(MGR, () => call('GET', '/api/my-evidence'))).j.evidence.every(e => /manager/.test(e.title)), "and their own portal shows only their own");

    console.log('Those who assess it see what was written');
    const seen = await as(ASSESSOR, () => call('GET', `/api/assessment-evidence?assessmentId=${mine}`));
    ok(seen.s === 200 && seen.j.some(e => e.description === words && e.title === 'SEC MY isolation note' && e.evidenceType === 'Observation record'), 'the assessor gets the title, kind and description', seen.s);
    const target = (await q("select id from assessment_evidence where title = 'SEC MY isolation note'"))[0].id;
    const patched = await call('PATCH', `/api/assessment-evidence/${target}`, { description: 'rewritten by someone else', title: 'rewritten' });
    row = (await q('select title, description from assessment_evidence where id = $1', [target]))[0];
    ok(patched.s === 404 && row.description === words && row.title === 'SEC MY isolation note', 'there is no route that rewrites what the person said', [patched.s, row]);
    await q("update assessment_evidence set rejected_at = now(), rejection_reason = 'SEC MY not dated' where id = $1", [target]);
    r = await as(ME, () => call('GET', '/api/my-evidence'));
    ok(r.j.evidence.find(e => e.id === target).rejectionReason === 'SEC MY not dated', 'a rejection and its reason are shown to the person');

    console.log('My Profile');
    const p = await as(ME, () => call('GET', '/api/my-profile'));
    ok(p.s === 200 && p.j.person.lastName === 'Person' && p.j.person.manager === 'Sec Manager' && p.j.person.hasPhoto === true, 'who the records say they are', p.j.person);
    const ids = p.j.history.map(h => h.id).sort();
    ok(JSON.stringify(ids) === JSON.stringify([signed, unsignedOk].sort()), 'history is signed-off and competent results: not open assignments, and not an unfinished "not yet competent"', { ids, draft });
    ok(!/ZZSECRETKEY|1990-01-02|dateOfBirth|avatarObjectKey|providerSub|ZZASSESSOR-PRIVATE|ZZOTHER/.test(JSON.stringify(p.j)), 'no storage address, date of birth, sign-in identifier or assessor free text', p.j);
    const o = await as(OTHER, () => call('GET', `/api/my-profile?userId=${ME}`));
    ok(o.j.person.lastName === 'Other' && o.j.history.length === 0, "it always answers about the person asking", o.j.person);

    console.log('Not exported');
    const prep = await call('POST', '/api/export/prepare', { path: '/profile', title: 'My Profile', urls: ['/api/my-profile', '/api/my-evidence'] });
    ok(prep.s === 400, 'neither is picked up by the Export button', prep);
  } catch (e) {
    ok(false, 'the test stopped early: ' + (e && e.stack || e));
  } finally {
    await cleanup().catch(e => console.log('  cleanup problem', e.message));
    await q("update users set role = 'developer' where id = 'local-dev-admin'");
    await pool.end();
  }
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
