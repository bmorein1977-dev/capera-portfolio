// Site visitor forms, against a running demo server (port 5056, LOCAL_DEV_AUTH=true NODE_ENV=development, SESSION_SECRET=test and
// LOCAL_OBJECT_STORAGE_DIR set to an empty scratch folder, because object storage exists only on Replit) and the demo database.
// Creates throwaway companies and people, and removes everything it made when it finishes.
const { Pool } = require('pg');
const { execSync } = require('child_process');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''); } };
const raw = async (m, p, b, headers = {}) => {
  const form = typeof FormData !== 'undefined' && b instanceof FormData;
  const r = await fetch(B + p, { method: m, headers: { ...(form ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers }, body: b === undefined ? undefined : form ? b : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return r;
};
const call = async (m, p, b) => { const r = await raw(m, p, b); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j, h: r.headers }; };
const as = async (id, fn) => { await call('POST', '/api/auth/impersonate', { userId: id }); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };
const day = (ahead) => new Date(Date.now() + ahead * 86400000).toISOString().slice(0, 10);
const PDF = Buffer.from('%PDF-1.4\n% test certificate\n');
const upload = (id, category, title, buf = PDF, name = 'cert.pdf', expiry = '') => { const f = new FormData(); f.append('category', category); f.append('title', title); f.append('expiryDate', expiry); f.append('file', new Blob([buf]), name); return call('POST', `/api/contractor/visits/${id}/files`, f); };
const SECRET_WORDS = ['ZZEMERGENCY-NAME', 'ZZ07700-900111', 'ZZSUPPORT-DETAIL', 'ZZREG123', 'ZZ07700-900222'];

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const CA = 'sec-vis-ca-a', CB = 'sec-vis-ca-b', P1 = 'sec-vis-p1';
  let coA, coB;
  const before = (await q("select settings from visitor_settings where id = 'default'"))[0];
  try {
    await q("delete from visitor_settings where id = 'default'");
    coA = (await q("insert into contract_companies (name) values ('SEC VISIT CONTRACTOR A') returning id"))[0].id;
    coB = (await q("insert into contract_companies (name) values ('SEC VISIT CONTRACTOR B') returning id"))[0].id;
    const mk = (id, email, role, co, last) => q("insert into users (id,email,first_name,last_name,role,employment_type,contract_company_id,is_active,approval_status) values ($1,$2,'Sec',$3,$4,'contractor',$5,true,'approved')", [id, email, last, role, co]);
    await mk(CA, 'sec.vis.ca.a@example.com', 'contractor_admin', coA, 'AdminA');
    await mk(CB, 'sec.vis.ca.b@example.com', 'contractor_admin', coB, 'AdminB');
    await mk(P1, 'sec.vis.p1@example.com', 'candidate', coA, 'Regular');
    const MANAGER = (await q("select id from users where role='manager' limit 1"))[0].id;
    // the host's settings and decisions need a real administrator sign-in
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");

    console.log('The host administrator sets where forms go and how much notice is needed');
    const s0 = await call('GET', '/api/contractor/visitor-settings');
    ok(s0.s === 200 && s0.j.noticeDays === 3 && s0.j.checklist.length === 4 && Array.isArray(s0.j.submissionEmails) && s0.j.submissionEmails.length === 0, 'sensible starting settings, with no email address yet', s0.s);
    const text = JSON.stringify(s0.j);
    ok(s0.j.siteName === '' && !/[a-z0-9._-]+@[a-z0-9-]+\.[a-z]|https?:\/\/|www\.|\+?\d[\d ]{8,}\d/i.test(text), 'the standard wording carries no site name, email address, web address or phone number');
    const settings = { ...s0.j, submissionEmails: ['Site.Security@Example.com'], noticeDays: 5 }; delete settings.defaults;
    const put = await call('PUT', '/api/contractor/visitor-settings', settings);
    ok(put.s === 200 && put.j.submissionEmails[0] === 'site.security@example.com' && put.j.noticeDays === 5, 'they set an address and five days notice', put);
    ok((await call('PUT', '/api/contractor/visitor-settings', { ...settings, submissionEmails: ['not-an-address'] })).s === 400, 'a bad address is refused');
    ok((await call('PUT', '/api/contractor/visitor-settings', { ...settings, somethingElse: 1 })).s === 400, 'unknown settings are refused');
    const seenByContractor = await as(CA, () => call('GET', '/api/contractor/visitor-settings'));
    ok(seenByContractor.s === 200 && seenByContractor.j.noticeDays === 5 && !('submissionEmails' in seenByContractor.j), 'a contractor sees the notice period but not where the forms go', Object.keys(seenByContractor.j));
    await q("update users set role = 'assessor' where id = 'local-dev-admin'");
    const notAdmin = await call('PUT', '/api/contractor/visitor-settings', settings);
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");
    ok(notAdmin.s === 403, 'someone who is not an administrator cannot change them', notAdmin.s);
    const asContractor = await as(CA, () => call('GET', '/api/contractor/visits'));
    ok(asContractor.s === 200 && asContractor.j.length === 0, 'a contractor administrator starts with no forms', asContractor);

    console.log('A contractor administrator fills in a form for a new visitor');
    const made = await as(CA, () => call('POST', '/api/contractor/visits', { newVisitor: { firstName: 'Vic', lastName: 'Visitor', email: 'sec.vis.new@example.com' } }));
    ok(made.s === 201 && made.j.id && /^VIS-\d{4}-/.test(made.j.reference), 'a form is started', made);
    const id = made.j.id;
    const person = (await q("select u.* from users u join contractor_visits v on v.user_id = u.id where v.id = $1", [id]))[0];
    ok(person && person.contract_company_id === coA && person.approval_status === 'visitor' && person.is_active === false && person.employment_type === 'contractor', 'the visitor gets a record under that company, inactive so counted nowhere', person && [person.approval_status, person.is_active]);
    const plist = await as(CA, () => call('GET', '/api/contractor/people'));
    ok(plist.j.find(p => p.id === person.id)?.status === 'visitor', 'they show in the company list as a short-term visitor');
    ok(!(await call('GET', '/api/contractor/pending')).j.some(p => p.id === person.id), 'and are not in the approval queue');
    const early = await as(CA, () => call('POST', `/api/contractor/visits/${id}/submit`, {}));
    ok(early.s === 400 && early.j.needed.length > 8, 'an empty form cannot be sent, and says what is missing', early.j.needed?.length);
    ok((await as(CA, () => call('PUT', `/api/contractor/visits/${id}`, { status: 'accepted' }))).s === 400, 'the status cannot be set by saving');
    ok((await as(CA, () => call('PUT', `/api/contractor/visits/${id}`, { details: { hostName: 'x', injected: 1 } }))).s === 400, 'unknown fields are refused');

    const full = (await as(CA, () => call('GET', `/api/contractor/visits/${id}`))).j;
    const answers = Object.fromEntries(full.wording.checklist.flatMap(sec => sec.items.map(i => [i.key, { answer: sec.naAllowed ? 'na' : 'yes' }])));
    answers['t-electrical'] = { answer: 'yes' }; answers['e-calibration'] = { answer: 'yes' };
    const form = {
      arrivalDate: day(20), days: 2,
      details: { businessEmail: 'sec.vis.new@example.com', hostName: 'Hana Host', hostPhone: '01234 000000', location: 'Site office', purpose: 'Calibrate instruments', organiser: 'Ora Organiser', safetyCritical: 'yes', ppe: [{ item: 'Safety helmet', required: true, size: 'M' }], declarations: ['accurate', 'identity', 'contact', 'support', 'rules'], completedBy: 'Sec AdminA', signature: 'Sec AdminA' },
      privateDetails: { mobile: 'ZZ07700-900222', vehicleReg: 'ZZREG123', emergencyName: 'ZZEMERGENCY-NAME', emergencyPhone: 'ZZ07700-900111', emergencyPermission: true, supportNeeded: 'yes', supportTypes: ['Sight'], supportDetails: 'ZZSUPPORT-DETAIL <script>alert(1)</script>' },
      checklist: { supervisorName: 'Sue Super', answers: { ...answers, 'p-risk': { answer: 'no' } } },
    };
    const saved = await as(CA, () => call('PUT', `/api/contractor/visits/${id}`, form));
    ok(saved.s === 200 && saved.j.needed.some(n => /comment/i.test(n)) && saved.j.needed.some(n => /certificate for the people/i.test(n)) && saved.j.needed.some(n => /certificate for the equipment/i.test(n)), 'saved as a draft; it still wants a reason for "No" and certificates for people and equipment', saved.j.needed);
    form.checklist.answers['p-risk'] = { answer: 'no', comment: 'Toolbox talk booked' };
    await as(CA, () => call('PUT', `/api/contractor/visits/${id}`, form));
    ok((await call('GET', `/api/contractor/visits/${id}`)).s === 404 && !(await call('GET', '/api/contractor/visits')).j.some(v => v.id === id), "the host does not see a company's unfinished draft");

    console.log('Certificates');
    const bad = await as(CA, () => upload(id, 'personnel', 'Fake', Buffer.from('<html>hello</html>'), 'cert.pdf'));
    ok(bad.s === 400 && /does not look like/i.test(bad.j.error), 'a file that is not what its name says is refused', bad);
    ok((await as(CA, () => upload(id, 'personnel', 'Script', Buffer.from('<svg onload=1>'), 'cert.svg'))).s === 400, 'so is a type that is not allowed');
    const c1 = await as(CA, () => upload(id, 'personnel', 'CompEx for Vic', PDF, 'compex.pdf', day(1)));
    const c2 = await as(CA, () => upload(id, 'equipment', 'Calibrator certificate', PDF, 'calibrator.pdf', day(400)));
    ok(c1.s === 201 && c2.s === 201, 'a certificate for the person and one for the equipment are added', [c1, c2]);
    const withFiles = (await as(CA, () => call('GET', `/api/contractor/visits/${id}`))).j;
    ok(withFiles.needed.length === 0, 'now nothing is missing', withFiles.needed);
    ok(withFiles.files.find(f => f.title === 'CompEx for Vic').expiresBeforeVisitEnds === true && withFiles.files.find(f => f.title === 'Calibrator certificate').expiresBeforeVisitEnds === false, 'a certificate that runs out before the visit ends is flagged');
    const dl = await as(CA, () => raw('GET', `/api/contractor/visits/${id}/files/${c1.j.id}/download`));
    ok(dl.status === 200 && Buffer.from(await dl.arrayBuffer()).equals(PDF) && /pdf/.test(dl.headers.get('content-type')), 'it downloads, exactly as uploaded', dl.status);

    console.log('Only the right people can reach it');
    const other = await as(CB, async () => [
      (await call('GET', `/api/contractor/visits/${id}`)).s, (await call('PUT', `/api/contractor/visits/${id}`, { days: 3 })).s,
      (await call('GET', `/api/contractor/visits/${id}/files/${c1.j.id}/download`)).s, (await call('GET', `/api/contractor/visits/${id}/print`)).s,
      (await upload(id, 'personnel', 'x')).s, (await call('DELETE', `/api/contractor/visits/${id}/files/${c1.j.id}`)).s,
      (await call('POST', `/api/contractor/visits/${id}/submit`, {})).s, (await call('POST', `/api/contractor/visits/${id}/cancel`, {})).s,
    ]);
    ok(other.every(s => s === 404), "another contracting company's administrator gets \"not found\" on every route", other);
    const otherList = await as(CB, () => call('GET', `/api/contractor/visits?companyId=${coA}&userId=${person.id}`));
    ok(otherList.s === 200 && otherList.j.length === 0, 'and cannot list them by naming the company or the person', otherList);
    ok((await as(CB, () => call('POST', '/api/contractor/visits', { companyId: coA, personId: P1 }))).s === 404, "nor start a form for another company's person");
    await q("update users set role = 'manager' where id = 'local-dev-admin'");
    const mgr = [(await call('GET', '/api/contractor/visits')).s, (await call('GET', `/api/contractor/visits/${id}`)).s, (await call('GET', `/api/contractor/visits/${id}/files/${c1.j.id}/download`)).s];
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");
    ok(mgr.every(s => s === 403), 'a manager cannot see visitor forms at all', mgr);
    ok((await as(MANAGER, () => call('GET', `/api/contractor/visits/${id}`))).s === 403, 'nor when being viewed as');

    console.log('Notice period and submitting');
    ok((await as(CA, () => call('PUT', `/api/contractor/visits/${id}`, { arrivalDate: day(2) }))).s === 200, 'move the arrival to two days away (five are needed)');
    const noWhy = await as(CA, () => call('POST', `/api/contractor/visits/${id}/submit`, {}));
    ok(noWhy.s === 400 && noWhy.j.needsLateReason === true, 'a late form needs a reason', noWhy);
    await call('PUT', '/api/contractor/visitor-settings', { ...settings, lateRule: 'block' });
    const blocked = await as(CA, () => call('POST', `/api/contractor/visits/${id}/submit`, { lateReason: 'Urgent breakdown' }));
    ok(blocked.s === 409 && /had to be submitted by/.test(blocked.j.error), 'with "refuse late forms" set, it cannot be sent at all', blocked);
    await call('PUT', '/api/contractor/visitor-settings', settings);
    const logsBefore = Number((await q("select count(*)::int n from notification_logs where type_key = 'visitor_form_submitted'"))[0].n);
    const sent = await as(CA, () => call('POST', `/api/contractor/visits/${id}/submit`, { lateReason: 'Urgent breakdown' }));
    ok(sent.s === 200 && sent.j.late === true, 'with "accept and mark late", it is sent with the reason', sent);
    const row = (await q('select * from contractor_visits where id = $1', [id]))[0];
    ok(row.status === 'submitted' && row.late && row.late_reason === 'Urgent breakdown' && row.snapshot && row.snapshot.checklist.length === 4, 'it is filed as submitted and late, with the wording as it was', [row.status, row.late]);
    const mail = (await q("select recipient_email, subject, body, status from notification_logs where type_key = 'visitor_form_submitted' order by created_at desc limit 1"))[0];
    ok(Number((await q("select count(*)::int n from notification_logs where type_key = 'visitor_form_submitted'"))[0].n) === logsBefore + 1 && mail.recipient_email === 'site.security@example.com' && /Vic Visitor/.test(mail.subject), 'an email to the set address is made (recorded as not sent, as email is not set up here)', mail && [mail.recipient_email, mail.subject, mail.status]);
    ok(mail && SECRET_WORDS.every(w => !mail.body.includes(w)), 'the email wording kept in the log holds no personal details');
    ok(/Not emailed to site\.security@example\.com/.test(row.email_status), 'and the form says plainly it was not delivered', row.email_status);
    ok((await as(CA, () => call('POST', `/api/contractor/visits/${id}/submit`, {}))).s === 409 && (await as(CA, () => call('PUT', `/api/contractor/visits/${id}`, { days: 4 }))).s === 409 && (await as(CA, () => upload(id, 'personnel', 'late add'))).s === 409 && (await as(CA, () => call('DELETE', `/api/contractor/visits/${id}/files/${c1.j.id}`))).s === 409, 'once sent it cannot be sent again or changed');

    console.log('The host reviews it');
    const hostList = await call('GET', '/api/contractor/visits');
    ok(hostList.s === 200 && hostList.j.some(v => v.id === id && v.status === 'submitted' && v.files === 2), 'the host sees it waiting');
    ok(SECRET_WORDS.every(w => !JSON.stringify(hostList.j).includes(w)), 'the list carries no personal details');
    const opened = await call('GET', `/api/contractor/visits/${id}`);
    ok(opened.s === 200 && opened.j.canReview && opened.j.privateDetails.emergencyName === 'ZZEMERGENCY-NAME', 'and can open it in full', opened.s);
    const print = await raw('GET', `/api/contractor/visits/${id}/print`); const html = await print.text();
    ok(print.status === 200 && /Vic/.test(html) && /CompEx for Vic/.test(html) && html.includes('&lt;script&gt;') && !html.includes('<script') && /default-src 'none'/.test(print.headers.get('content-security-policy')), 'the printable copy shows everything, with typed text made harmless and scripts not allowed');
    const selfAccept = await as(CA, () => call('POST', `/api/contractor/visits/${id}/review`, { decision: 'accept' }));
    ok(selfAccept.s === 403, 'a contractor cannot accept their own form', selfAccept.s);
    ok((await call('POST', `/api/contractor/visits/${id}/review`, { decision: 'return' })).s === 400, 'sending back needs a note');
    ok((await call('POST', `/api/contractor/visits/${id}/review`, { decision: 'return', note: 'Please attach the current CompEx certificate' })).s === 200, 'the host sends it back');
    const back = await as(CA, () => call('GET', `/api/contractor/visits/${id}`));
    ok(back.j.status === 'returned' && back.j.canEdit && /current CompEx/.test(back.j.reviewNote), 'the contractor sees why and can correct it', back.j.status);
    ok((await as(CA, () => call('DELETE', `/api/contractor/visits/${id}/files/${c1.j.id}`))).s === 200, 'they remove the old certificate');
    ok((await q('select is_active, object_key from contractor_visit_files where id = $1', [c1.j.id]))[0].is_active === false, 'it is kept as part of what was sent before, not shown');
    ok((await as(CA, () => upload(id, 'personnel', 'New CompEx', PDF, 'compex2.pdf', day(500)))).s === 201, 'and attach the new one');
    const again = await as(CA, () => call('POST', `/api/contractor/visits/${id}/submit`, {}));
    ok(again.s === 200 && again.j.late === true, 'submitted again; still marked late because it was first sent late', again);
    ok((await call('POST', `/api/contractor/visits/${id}/review`, { decision: 'accept', note: 'All in order' })).s === 200, 'the host accepts it');
    ok((await call('POST', `/api/contractor/visits/${id}/review`, { decision: 'accept' })).s === 409, 'a decision cannot be made twice');
    await call('PUT', '/api/contractor/visitor-settings', { ...settings, siteNotes: 'CHANGED LATER' });
    ok(!(await call('GET', `/api/contractor/visits/${id}`)).j.wording.siteNotes.includes('CHANGED LATER'), 'changing the settings later does not rewrite an accepted form');
    const hist = (await q('select history from contractor_visits where id = $1', [id]))[0].history.map(h => h.what);
    ok(['Started', 'Submitted', 'Sent back by the host', 'Submitted again', 'Accepted by the host'].every(w => hist.includes(w)), 'its history records each step', hist);

    console.log('It is filed on the person');
    const mine = await as(CA, () => call('GET', `/api/contractor/visits?userId=${person.id}`));
    ok(mine.j.length === 1 && mine.j[0].id === id, "the person's record lists the visit");
    const next = await as(CA, () => call('POST', '/api/contractor/visits', { newVisitor: { firstName: 'Vic', lastName: 'Visitor', email: 'SEC.VIS.NEW@example.com' } }));
    ok(next.s === 201 && (await q('select user_id from contractor_visits where id = $1', [next.j.id]))[0].user_id === person.id, 'a second visit by the same person is filed on the same record');
    const regular = await as(CA, () => call('POST', '/api/contractor/visits', { personId: P1 }));
    ok(regular.s === 201, 'a form can also be started for someone already on the list', regular);
    ok((await as(CA, () => call('POST', '/api/contractor/visits', { newVisitor: { firstName: 'a', lastName: 'b', email: 'sec.vis.ca.b@example.com' } }))).s === 409, "an address that belongs to someone else is refused");
    const join = await as(CA, () => call('POST', '/api/contractor/people', { firstName: 'Vic', lastName: 'Visitor', email: 'sec.vis.new@example.com' }));
    ok(join.s === 201 && join.j.id === person.id && (await q('select approval_status from users where id = $1', [person.id]))[0].approval_status === 'pending', 'a visitor who joins longer term is added on the same record and waits for approval', join);

    console.log('Nothing personal leaks into the audit log or exports');
    await new Promise(r => setTimeout(r, 700));
    const audit = await q("select action, summary, entity_label, changes::text c from audit_events where occurred_at > now() - interval '10 minutes'");
    const blob = JSON.stringify(audit);
    ok(SECRET_WORDS.every(w => !blob.includes(w)), 'no emergency contact, support detail, mobile or registration appears anywhere in the audit log');
    ok(['submit', 'accept', 'send-back', 'attach-certificate', 'view'].every(a => audit.some(e => e.action === a && /visitor form/i.test(e.summary))), 'but who submitted, attached, opened, sent back and accepted is all recorded', [...new Set(audit.map(a => a.action))]);
    // with an ordinary address alongside as the control: the export works, and takes that one only
    const exp = await call('POST', '/api/export/prepare', { path: '/admin/contractors/visitors', title: 'Visitors', urls: ['/api/contractor/companies', `/api/contractor/visits/${id}`, '/api/contractor/visits', '/api/contractor/visitor-settings'] });
    ok(exp.s === 200 && exp.j.sources.length === 1, 'the page export works for an ordinary address and takes nothing from the visitor form addresses', [exp.s, exp.j.sources?.map(x => x.name) ?? exp.j]);
    const only = await call('POST', '/api/export/prepare', { path: '/admin/contractors/visitors', title: 'Visitors', urls: [`/api/contractor/visits/${id}`] });
    ok(only.s === 400 && /no data/i.test(JSON.stringify(only.j)), 'asked for a visitor form alone, it has nothing to export', [only.s, only.j]);

    console.log('Removing personal details after the visit');
    const purge = async () => (await q('select private_details, private_removed_at, details, checklist from contractor_visits where id = $1', [id]))[0];
    const runPurge = () => execSync('npx tsx tests/security/runVisitorPurge.ts 40', { encoding: 'utf8' });
    runPurge();
    ok((await purge()).private_details !== null, 'with no number of days set, nothing is removed');
    await call('PUT', '/api/contractor/visitor-settings', { ...settings, privateRetentionDays: 7 });
    ok((await call('POST', `/api/contractor/visits/${id}/hold`, { hold: true, reason: 'Incident enquiry' })).s === 200, 'a hold is placed on this one');
    runPurge();
    ok((await purge()).private_details !== null, 'a form on hold is left alone');
    await call('POST', `/api/contractor/visits/${id}/hold`, { hold: false });
    runPurge();
    const gone = await purge();
    ok(gone.private_details === null && gone.private_removed_at && gone.checklist.answers && gone.details.hostName === 'Hana Host', 'after the days set, the personal details go and the record of the checks stays', gone.private_details);
    const after = await raw('GET', `/api/contractor/visits/${id}/print`); const afterHtml = await after.text();
    ok(/Removed after the visit/.test(afterHtml) && SECRET_WORDS.every(w => !afterHtml.includes(w)), 'and the printable copy says so');

    console.log('Removing a person altogether');
    const keys = (await q('select object_key from contractor_visit_files where visit_id = $1', [id])).map(r => r.object_key);
    execSync(`npx tsx tests/security/runVisitorPurge.ts scrub ${person.id}`, { encoding: 'utf8' });
    const scrubbed = (await q('select * from contractor_visits where id = $1', [id]))[0];
    const files = await q('select file_name, title, is_active from contractor_visit_files where visit_id = $1', [id]);
    ok(scrubbed.visitor_last_name === 'visitor' && !('signature' in scrubbed.details) && !('businessEmail' in scrubbed.details) && scrubbed.status === 'accepted' && scrubbed.checklist.answers['t-electrical'].answer === 'yes', 'their forms lose names and contact details; what was checked and decided stays', [scrubbed.visitor_first_name, Object.keys(scrubbed.details)]);
    ok(files.every(f => !f.is_active && f.file_name === '(removed)') && keys.every(k => !require('fs').existsSync(require('path').join(process.env.LOCAL_OBJECT_STORAGE_DIR, k))), 'and their certificate files are deleted', files);

    console.log('Cancelling');
    ok((await as(CA, () => call('POST', `/api/contractor/visits/${next.j.id}/cancel`, { reason: 'No longer coming' }))).s === 200, 'a visit can be cancelled');
    ok((await as(CA, () => call('PUT', `/api/contractor/visits/${next.j.id}`, { days: 1 }))).s === 409, 'and then not changed');
  } catch (e) {
    fail++; console.log('  FAIL the test stopped:', e.stack || e.message);
  } finally {
    await q("update users set role = 'developer' where id = 'local-dev-admin'");
    if (coA) {
      const ids = (await q('select id from contractor_visits where contract_company_id in ($1,$2)', [coA, coB])).map(r => r.id);
      await q('delete from contractor_visit_files where visit_id = any($1)', [ids]);
      await q('delete from contractor_visits where id = any($1)', [ids]);
      await q("delete from notification_logs where type_key in ('visitor_form_submitted','visitor_form_decision') and (recipient_email = 'site.security@example.com' or recipient_email like 'sec.vis%')");
      await q('delete from users where contract_company_id in ($1,$2)', [coA, coB]);
      await q('delete from contract_companies where id in ($1,$2)', [coA, coB]);
    }
    await q("delete from visitor_settings where id = 'default'");
    if (before) await q("insert into visitor_settings (id, settings) values ('default', $1)", [JSON.stringify(before.settings)]);
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
