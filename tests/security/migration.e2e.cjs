// The bulk evidence loader and the reconciliation report, end to end against a running server and the demo database. Same setup as the other
// end-to-end tests: port 5056, LOCAL_DEV_AUTH=true NODE_ENV=development SESSION_SECRET=test, ENABLE_DEMO_TOOLS=true.
//   node tests/security/migration.e2e.cjs
// Removes everything it makes (audit events stay, as the database requires) and puts the local administrator's role back.
const { Pool } = require('pg');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const crypto = require('crypto');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); } };
const call = async (m, p, b) => {
  const form = b instanceof FormData;
  const r = await fetch(B + p, { method: m, headers: { ...(b === undefined || form ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : form ? b : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const buf = Buffer.from(await r.arrayBuffer()); let j; try { j = JSON.parse(buf.toString('utf8')); } catch { j = buf.toString('utf8'); } return { s: r.status, j, buf };
};
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const pdf = (words) => Buffer.from(`%PDF-1.4\n% SEC MIG ${words} ${Date.now()} ${Math.random()}\n%%EOF`);
const COLS = ['File', 'Email', 'Competence Category', 'Competence Element', 'Title', 'Evidence Type', 'Description', 'Original Date', 'Fingerprint (SHA-256)', 'Source Reference'];
const sheetBytes = (rows, headings) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header: headings }), 'Sheet1'); return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }); };
async function zipOf(rows, files, { manifest = 'manifest.xlsx', folder = '' } = {}) {
  const z = new JSZip();
  if (manifest) {
    const objects = rows.map((r) => Object.fromEntries(COLS.map((c, i) => [c, r[i] ?? ''])));
    z.file(folder + manifest, manifest.endsWith('.csv') ? [COLS.join(','), ...objects.map((o) => COLS.map((c) => `"${String(o[c]).replace(/"/g, '""')}"`).join(','))].join('\r\n') : sheetBytes(objects, COLS));
  }
  for (const [name, bytes] of Object.entries(files)) z.file(folder + name, bytes);
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
const sendBatch = (zip, dryRun) => { const f = new FormData(); if (dryRun !== undefined) f.append('dryRun', String(dryRun)); f.append('batch', new Blob([zip]), 'sec-mig-batch.zip'); return call('POST', '/api/admin/migration/evidence', f); };
const sendRecon = (rows, zip) => { const f = new FormData(); f.append('records', typeof rows === 'string' ? rows : JSON.stringify(rows)); if (zip) f.append('batch', new Blob([zip]), 'sec-mig-evidence.zip'); return call('POST', '/api/admin/migration/reconcile', f); };

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const ANN = 'sec-mig-ann', BEN = 'sec-mig-ben';
  let meRole = null;
  const cleanup = async () => {
    const ids = (await q("select id from users where id like 'sec-mig-%' or email like 'secmig.%@imported.local'")).map((r) => r.id);
    const as_ = (await q('select id from assessments where candidate_id = any($1)', [ids])).map((r) => r.id);
    await q('delete from assessment_evidence where assessment_id = any($1) and linked_from_id is not null', [as_]);
    await q('delete from assessment_evidence where assessment_id = any($1)', [as_]);
    await q('delete from assessment_expiry_history where candidate_id = any($1)', [ids]);
    await q('delete from assessments where candidate_id = any($1)', [ids]);
    await q("delete from training_enrollments where user_id = any($1) or training_id in (select id from trainings where name = 'SEC MIG course')", [ids]);
    await q("delete from trainings where name = 'SEC MIG course'");
    await q("delete from role_elements where role_id in (select id from job_roles where code = 'SEC-MIG-ROLE')");
    await q('delete from users where id = any($1)', [ids]);
    await q("delete from job_roles where code = 'SEC-MIG-ROLE'");
    await q("delete from competency_elements where code like 'SECMIG%'");
    await q("delete from competency_categories where code = 'SEC-MIG-CAT'");
  };
  try {
    await cleanup();
    meRole = (await q("select role from users where id = 'local-dev-admin'"))[0]?.role;
    if (!meRole) { await call('GET', '/api/auth/user'); meRole = (await q("select role from users where id = 'local-dev-admin'"))[0].role; }
    const reallyAs = (role) => q('update users set role = $1 where id = \'local-dev-admin\'', [role]);
    await reallyAs('super_admin');

    const cat = (await q("insert into competency_categories (name, code, is_active) values ('SEC MIG category', 'SEC-MIG-CAT', true) returning id"))[0].id;
    const role = (await q("insert into job_roles (name, code) values ('SEC MIG role', 'SEC-MIG-ROLE') returning id"))[0].id;
    const el = {};
    for (const [n, crit] of [[1, 'High'], [2, 'Low'], [3, 'Low']]) {
      el[n] = (await q("insert into competency_elements (category_id, name, code, validity_months, safety_criticality, is_active, is_current) values ($1,$2,$3,12,$4,true,true) returning id", [cat, `SEC MIG standard ${n}`, `SECMIG${n}`, crit]))[0].id;
      if (n < 3) await q('insert into role_elements (role_id, element_id, required) values ($1,$2,true)', [role, el[n]]);
    }
    for (const [id, last] of [[ANN, 'Ann'], [BEN, 'Ben']]) await q("insert into users (id,email,first_name,last_name,role,employment_type,is_active,approval_status,job_role_id) values ($1,$2,'Secmig',$3,'candidate','employee',true,'approved',$4)", [id, `${id}@example.com`, last, role]);
    const category = (await q('select id from training_categories limit 1'))[0].id;
    const course = (await q("insert into trainings (name, category_id, validity_period, is_active) values ('SEC MIG course', $1, 36, true) returning id", [category]))[0].id;

    // ------------------------------------------------------------------------------------------------ records first, as a real move would
    const record = (who, standard, outcome, date, extra = {}) => ({
      User: `Secmig ${who}`, Email: `sec-mig-${who.toLowerCase()}@example.com`, 'Role (Super Admin, Admin, Internal Verifier, Assessor, Candidate)': 'Candidate', 'Job Role (Optional)': 'SEC MIG role',
      ...(standard ? { 'Competence Category (Optional)': 'SEC MIG category', 'Competence Element (Optional)': `SEC MIG standard ${standard}`, 'Assessment Outcome (Optional - defaults to Competent)': outcome, 'Assessor (Required if Competence Element given)': 'Secmig Oldassessor', 'Assessment Date (Required if Competence Element given)': date } : {}),
      ...extra,
    });
    const recent = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10), next = new Date(Date.now() + 700 * 86400000).toISOString().slice(0, 10);
    const extract = [
      record('Ann', 1, 'Competent', recent, { 'Expiry_Date (Optional)': next, 'Source Reference (Optional)': 'OLD-1' }),
      record('Ann', 2, 'Not Yet Competent', recent),
      record('Ben', 1, 'Competent', '2024-03-01'),
      record('Ben', null, null, null, { 'Training Course (Optional)': 'SEC MIG course', 'Training Completion Date (Required if Training Course given)': recent }),
    ];
    let r = await call('POST', '/api/admin/historical-import', { data: extract });
    ok(r.s === 200 && r.j.errors?.length === 0 && r.j.assessmentsCreated === 3, 'the records load first', r.j);
    const rowFor = async (who, n) => (await q('select * from assessments where candidate_id = $1 and element_id = $2 and is_active', [who, el[n]]))[0];
    const annOne = await rowFor(ANN, 1), annTwo = await rowFor(ANN, 2), benOne = await rowFor(BEN, 1);
    // a decision made in Capera: old evidence must not be added to it
    await q("insert into assessments (candidate_id, element_id, assessor_id, outcome, is_assignment, is_active, sign_off_at, assessment_date) values ($1,$2,'local-dev-admin','competent',false,true, now(), now())", [BEN, el[2]]);

    // ------------------------------------------------------------------------------------------------ the loader
    console.log('Bulk evidence loader');
    const a = pdf('ann one'), b = pdf('ben one'), c = pdf('changed'), shared = pdf('shared'), d = pdf('d'), e = pdf('e'), s = pdf('signed');
    const M = (file, who, n, extra = {}) => [file, `${who}@example.com`, 'SEC MIG category', `SEC MIG standard ${n}`, extra.title ?? `SEC MIG ${file}`, extra.type ?? 'Observation record', extra.about ?? '', extra.when ?? '2023-05-04', extra.print ?? '', extra.ref ?? ''];
    const rows = [
      M('files/a.pdf', ANN, 1, { ref: 'EV-100', about: 'Observed on shift' }),   // 2 load
      M('files/a.pdf', ANN, 2),                                                    // 3 attach: same person, second standard
      M('files/b.pdf', BEN, 1, { print: sha(b) }),                                 // 4 load, fingerprint matches
      M('files/c.pdf', ANN, 1, { print: sha(b) }),                                 // 5 fingerprint differs
      M('files/shared.pdf', ANN, 1),                                               // 6 same file for two people
      M('files/shared.pdf', BEN, 1),                                               // 7
      M('files/fake.pdf', ANN, 1),                                                 // 8 not a pdf
      M('files/big.txt', ANN, 1),                                                  // 9 too large
      M('files/missing.pdf', ANN, 1),                                              // 10 not in zip
      M('files/d.pdf', 'sec-mig-nobody', 1),                                       // 11 unknown person
      M('files/d.pdf', ANN, 9),                                                    // 12 unknown standard
      M('files/run.exe', ANN, 1),                                                  // 13 type not accepted
      M('files/signed.pdf', BEN, 2),                                               // 14 signed off in Capera
      M('files/e.pdf', ANN, 3),                                                    // 15 no record
    ];
    const files = { 'files/a.pdf': a, 'files/b.pdf': b, 'files/c.pdf': c, 'files/shared.pdf': shared, 'files/fake.pdf': Buffer.from('<html>not a pdf</html>'), 'files/big.txt': Buffer.alloc(10 * 1024 * 1024 + 1, 65), 'files/d.pdf': d, 'files/run.exe': Buffer.from('MZ'), 'files/signed.pdf': s, 'files/e.pdf': e, 'files/forgotten.pdf': pdf('forgotten') };
    const zip = await zipOf(rows, files);
    const evidenceCount = async () => (await q('select count(*)::int n from assessment_evidence v join assessments x on x.id = v.assessment_id where x.candidate_id = any($1)', [[ANN, BEN]]))[0].n;

    r = await sendBatch(zip, true);
    const at = (n) => r.j.detail?.find((x) => x.row === n);
    const says = (n, re) => !!at(n) && at(n).action === 'not loaded' && re.test(at(n).problems.join(' '));
    ok(r.s === 200 && r.j.dryRun === true && r.j.rows === 14 && r.j.toLoad === 3 && r.j.withProblems === 11, 'a trial run reports every row: 3 ready, 11 with problems', r.j);
    ok(at(2)?.action === 'load' && at(3)?.action === 'attach' && at(4)?.action === 'load', 'the same file for the same person on a second standard is attached, not stored twice', [at(2), at(3), at(4)]);
    ok(says(5, /fingerprint/), 'a file that does not match its fingerprint is refused', at(5));
    ok(says(6, /more than one person/) && says(7, /more than one person/), 'a file listed for two people is loaded for neither', [at(6), at(7)]);
    ok(says(8, /does not look like/) && says(13, /not accepted/), 'files get the same type and content checks as an upload', [at(8), at(13)]);
    ok(says(9, /larger than 10 MB/) && says(10, /not in the zip/), 'too large and missing files are reported', [at(9), at(10)]);
    ok(says(11, /No person/) && says(12, /element not found/) && says(15, /no assessment record/), 'unknown person, unknown standard and no record are reported', [at(11), at(12), at(15)]);
    ok(says(14, /signed off in Capera/), 'nothing is added to a decision signed off in Capera', at(14));
    ok(r.j.unlistedFiles?.some((f) => /forgotten\.pdf$/.test(f)), 'a file left off the list is pointed out', r.j.unlistedFiles);
    ok(await evidenceCount() === 0, 'and a trial run changes nothing');

    r = await sendBatch(zip);
    ok(r.s === 200 && r.j.dryRun === true && await evidenceCount() === 0, 'leaving out the instruction to load is treated as a trial run', r.j.dryRun);

    await reallyAs('candidate');
    r = await sendBatch(zip, false);
    await reallyAs('super_admin');
    ok(r.s === 403 && await evidenceCount() === 0, 'only an administrator can load', r.s);

    r = await sendBatch(zip, false);
    ok(r.s === 200 && r.j.loaded === 3 && await evidenceCount() === 3, 'loading stores the three good rows and no others', r.j);
    const ev = await q('select v.*, x.candidate_id, x.element_id from assessment_evidence v join assessments x on x.id = v.assessment_id where x.candidate_id = any($1)', [[ANN, BEN]]);
    const first = ev.find((v) => v.assessment_id === annOne.id), second = ev.find((v) => v.assessment_id === annTwo.id), bens = ev.find((v) => v.assessment_id === benOne.id);
    ok(!!first && !!second && !!bens, 'each sits on the right person and standard', ev.map((v) => [v.candidate_id, v.element_id]));
    ok(second?.linked_from_id === first?.id && second?.file_url === first?.file_url, 'the second use points at the first copy', second);
    ok(first?.content_hash === sha(a) && /Source reference: EV-100/.test(first?.description) && /Original date: 2023-05-04/.test(first?.description) && first?.evidence_type === 'Observation record', 'with its fingerprint, kind, original date and source reference', first);
    r = await call('GET', `/api/assessment-evidence/${first?.id}/download`);
    ok(r.s === 200 && sha(r.buf) === sha(a), 'and the stored file is byte for byte what was sent', r.s);
    r = await sendBatch(zip, false);
    ok(r.s === 200 && r.j.loaded === 0 && r.j.alreadyThere === 3 && await evidenceCount() === 3, 'running the same batch again loads nothing twice', r.j);
    r = await sendBatch(await zipOf([M('a.pdf', BEN, 1)], { 'a.pdf': a }), false);
    ok(r.j.loaded === 0 && /another person/.test(r.j.detail?.[0]?.problems.join(' ')) && await evidenceCount() === 3, "one person's file cannot be loaded for another in a later batch", r.j);
    r = await sendBatch(await zipOf([M('g.pdf', ANN, 1)], { 'g.pdf': pdf('csv') }, { manifest: 'manifest.csv', folder: 'batch2/' }), true);
    ok(r.s === 200 && r.j.toLoad === 1, 'a CSV list inside a folder works too', r.j);
    r = await sendBatch(await zipOf([], { 'a.pdf': a }, { manifest: null }), true);
    ok(r.s === 400 && /manifest/.test(r.j.error), 'a zip with no list is refused with a plain reason', r.j);
    r = await sendBatch(Buffer.from('not a zip at all'), true);
    ok(r.s === 400 && /zip/.test(r.j.error), 'so is something that is not a zip', r.j);
    ok((await q("select count(*)::int n from audit_events where action = 'load-evidence-batch' and entity_label = 'sec-mig-batch.zip'"))[0].n > 0, 'loads are written to the audit log');

    // ------------------------------------------------------------------------------------------------ reconciliation
    console.log('Reconciliation report');
    const good = await zipOf([rows[0], rows[1], rows[2]], { 'files/a.pdf': a, 'files/b.pdf': b });
    const snapshot = async () => JSON.stringify([await q('select id, outcome, expiry_date, updated_at from assessments where candidate_id = any($1) order by id', [[ANN, BEN]]), await evidenceCount()]);
    const before = await snapshot();
    r = await sendRecon(extract, good);
    const total = (m) => r.j.totals?.find((t) => t.measure === m);
    ok(r.s === 200 && r.j.acceptance?.passed === true && r.j.acceptance.unexplained === 0, 'a faithful move passes with nothing unexplained', { a: r.j.acceptance, d: r.j.differences });
    ok(total('People')?.matched === 2 && total('Competence results')?.matched === 3 && total('Training records')?.matched === 1 && total('Evidence files')?.matched === 3 && total('Compliance status')?.matched === 3, 'people, results, training, evidence and status all match', r.j.totals);
    ok(r.j.statuses?.find((x) => x.email === `${BEN}@example.com`)?.capera === 'expired', 'an old pass with no expiry date counts as expired on both sides', r.j.statuses);
    ok(r.j.sample?.length > 0 && r.j.sample.some((x) => x.sourceRef === 'OLD-1'), 'there is a sample to trace back to the source', r.j.sample);
    ok(await snapshot() === before, 'the report changes nothing');

    const copy = () => JSON.parse(JSON.stringify(extract));
    let x = copy(); x[2]['Source Status (Optional - in date, expired or not competent)'] = 'In date';
    r = await sendRecon(x);
    let diff = r.j.differences?.find((v) => v.kind === 'status' && v.email === `${BEN}@example.com`);
    ok(diff?.explained === true && /validity period/.test(diff.explanation) && r.j.acceptance.passed === true, 'a status that differs only because the old system gave no expiry date is explained, and said so', { diff, a: r.j.acceptance });
    x = copy(); x[0]['Assessment Outcome (Optional - defaults to Competent)'] = 'Not Yet Competent';
    r = await sendRecon(x);
    ok(r.j.acceptance?.passed === false && r.j.acceptance.unexplainedSafetyCritical === 1 && r.j.differences.some((v) => v.kind === 'competence' && !v.explained && v.safetyCritical), 'a different safety-critical result fails the report', r.j.acceptance);
    x = copy(); x.splice(1, 1);
    r = await sendRecon(x);
    ok(r.j.acceptance?.importedButNotInExtract === 1 && r.j.acceptance.passed === false, 'a record shown as imported that the extract does not list fails it too', r.j.acceptance);
    r = await sendRecon(extract.filter((v) => v.User !== 'Secmig Ben'));
    ok(r.j.acceptance?.passed === false && r.j.acceptance.importedButNotInExtract === 1 && r.j.differences.some((v) => v.kind === 'not in extract' && v.email === `${BEN}@example.com`), 'so does leaving a person out of the extract altogether', r.j.acceptance);
    x = copy(); x.push(record('Ben', 2, 'Competent', '2020-01-15'));
    r = await sendRecon(x);
    diff = r.j.differences?.find((v) => v.kind === 'competence' && /standard 2/.test(v.item) && v.email === `${BEN}@example.com`);
    ok(diff?.explained === true && /signed off in Capera/.test(diff.explanation), 'a later decision signed off in Capera explains the difference', diff);
    x = copy(); x.push(record('Nobody', 1, 'Competent', recent));
    r = await sendRecon(x);
    ok(r.j.differences?.some((v) => v.kind === 'person' && v.capera === 'not held') && r.j.acceptance.passed === false, 'a person who did not arrive is found', r.j.differences);
    r = await sendRecon([...copy(), record('Nobody', null, null, null)]);
    ok(r.j.acceptance?.passed === false && r.j.acceptance.missingFromCapera === 1 && r.j.acceptance.unexplainedSafetyCritical === 0, 'someone who did not arrive fails the report, even with no competence listed', r.j.acceptance);
    await q("update users set job_role_id = null where id = $1", [ANN]);
    r = await sendRecon(extract);
    await q('update users set job_role_id = $2 where id = $1', [ANN, role]);
    ok(r.j.acceptance?.passed === true && r.j.acceptance.unexplained === 1 && r.j.acceptance.missingFromCapera === 0, 'a different job role passes the rule but is still counted as to be settled', r.j.acceptance);
    x = copy(); x[3]['Training Completion Date (Required if Training Course given)'] = '2019-02-02';
    r = await sendRecon(x);
    diff = r.j.differences?.find((v) => v.kind === 'training');
    ok(diff?.explained === true && /later completion/.test(diff.explanation), 'a later course completion held in Capera is explained', diff);
    x = copy(); x[3]['Training Completion Date (Required if Training Course given)'] = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    r = await sendRecon(x);
    ok(r.j.differences?.some((v) => v.kind === 'training' && !v.explained), 'a completion that has not arrived is unexplained', r.j.differences);
    r = await sendRecon(extract, await zipOf([rows[0], M('files/h.pdf', ANN, 1)], { 'files/a.pdf': a, 'files/h.pdf': pdf('never loaded') }));
    ok(r.j.totals?.find((t) => t.measure === 'Evidence files')?.unexplained === 1 && r.j.differences.some((v) => v.kind === 'evidence' && /not been loaded/.test(v.explanation)), 'an evidence file that was never loaded is found', r.j.differences);
    r = await sendRecon('not json');
    ok(r.s === 400, 'an unreadable request is refused', r.s);
    await reallyAs('candidate');
    r = await sendRecon(extract);
    await reallyAs('super_admin');
    ok(r.s === 403, 'only an administrator can run the report', r.s);
    r = await call('GET', '/api/admin/historical-import/template');
    const heads = r.s === 200 ? XLSX.utils.sheet_to_json(XLSX.read(r.buf).Sheets.Sheet1, { header: 1 })[0] : [];
    ok(heads.includes('Source Reference (Optional)') && heads.includes('Source Status (Optional - in date, expired or not competent)'), 'the records template has the two columns the report can use', heads);
  } catch (e) { fail++; console.log('  FAIL the run stopped:', e.stack); }
  finally {
    try { await cleanup(); if (meRole) await q('update users set role = $1 where id = \'local-dev-admin\'', [meRole]); } catch (e) { console.log('cleanup failed', e.message); fail++; }
    await pool.end();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
