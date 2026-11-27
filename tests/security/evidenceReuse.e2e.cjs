// One candidate's evidence can be attached to any of that candidate's assessments, and can never reach another candidate's. This test tries every way
// there is to get it across. Against a running demo server (port 5056, LOCAL_DEV_AUTH=true NODE_ENV=development, SESSION_SECRET=test,
// LOCAL_OBJECT_STORAGE_DIR set for the server and the test) and the demo database with migration 0060. Removes everything it made.
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
const pdf = (words) => Buffer.from(`%PDF-1.4\n% ${words}\n`);
const send = (assessmentId, title, files = [], description = 'SEC REUSE words') => { const f = new FormData(); f.append('assessmentId', assessmentId); f.append('evidenceType', 'Document'); f.append('evidenceTitle', title); f.append('description', description); for (const x of files) f.append('files', new Blob([x.data]), x.name); return call('POST', '/api/evidence', f); };
const portfolio = (id) => call('GET', `/api/assessments/${id}/portfolio-evidence`);
const attach = (id, evidenceIds) => call('POST', `/api/assessments/${id}/portfolio-evidence`, { evidenceIds });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const ANN = 'sec-re-ann', BEN = 'sec-re-ben', ASSESSOR = 'sec-re-assessor', STRANGER = 'sec-re-stranger', MGR = 'sec-re-manager';
  const people = [ANN, BEN, ASSESSOR, STRANGER, MGR];
  const startedAt = (await q("select (now() at time zone 'utc')::text t"))[0].t;
  const cleanup = async () => {
    await q('delete from assessment_evidence where assessment_id in (select id from assessments where candidate_id = any($1))', [people]);
    await q('delete from candidate_allocations where candidate_id = any($1)', [people]);
    await q('delete from assessments where candidate_id = any($1)', [people]);
    await q("delete from notification_logs where created_at >= $1::timestamp and (body like '%SEC REUSE%' or subject like '%SEC REUSE%')", [startedAt]);
    await q('delete from users where id = any($1)', [people]);
  };
  try {
    await cleanup();
    const mk = (id, role, last) => q("insert into users (id,email,first_name,last_name,role,employment_type,is_active,approval_status) values ($1,$2,'Sec',$3,$4,'employee',true,'approved')", [id, `${id}@example.com`, last, role]);
    await mk(ASSESSOR, 'assessor', 'Assessor'); await mk(STRANGER, 'assessor', 'Stranger'); await mk(MGR, 'manager', 'Manager'); await mk(ANN, 'candidate', 'Ann'); await mk(BEN, 'candidate', 'Ben');
    await q('update users set manager_id = $1 where id = any($2)', [MGR, [ANN, BEN]]);
    // one assessor assesses both candidates, so having access to both is not what stops evidence crossing
    const el = (await q('select id from competency_elements order by code limit 4')).map(r => r.id);
    const asmt = async (who, element, o = {}) => (await q("insert into assessments (candidate_id, element_id, assessor_id, outcome, is_assignment, is_active, sign_off_at) values ($1,$2,$3,$4,$5,true,$6) returning id",
      [who, element, ASSESSOR, o.signed ? 'competent' : 'not_yet_competent', !o.signed, o.signed ? new Date(Date.now() - 86400000).toISOString() : null]))[0].id;
    const A1 = await asmt(ANN, el[0]), A2 = await asmt(ANN, el[1]), ASIGNED = await asmt(ANN, el[2], { signed: true }), B1 = await asmt(BEN, el[0]), B2 = await asmt(BEN, el[1]);
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");
    const rowsOn = async (id) => q('select * from assessment_evidence where assessment_id = $1 and is_active order by created_at', [id]);
    const evidenceCount = async () => Number((await q('select count(*)::int n from assessment_evidence where assessment_id in (select id from assessments where candidate_id = any($1))', [people]))[0].n);

    await as(ANN, () => send(A1, 'SEC REUSE ann certificate', [{ name: 'ann.pdf', data: pdf('SEC REUSE ANN FILE') }]));
    await as(ANN, () => send(A1, 'SEC REUSE ann note'));
    await as(BEN, () => send(B1, 'SEC REUSE ben certificate', [{ name: 'ben.pdf', data: pdf('SEC REUSE BEN FILE') }]));
    const annFile = (await rowsOn(A1)).find(r => r.title === 'SEC REUSE ann certificate'), annNote = (await rowsOn(A1)).find(r => r.title === 'SEC REUSE ann note'), benFile = (await rowsOn(B1))[0];
    ok(annFile?.content_hash && benFile?.content_hash && annFile.content_hash !== benFile.content_hash, 'each uploaded file is fingerprinted', [annFile?.content_hash, benFile?.content_hash]);

    console.log("The assessor attaches from the candidate's portfolio");
    let p = await as(ASSESSOR, () => portfolio(A2));
    ok(p.s === 200 && p.j.items.length === 2 && p.j.items.every(i => /ann/.test(i.title)) && !JSON.stringify(p.j).includes('ben'), "the picker holds this candidate's evidence only", p.j);
    ok(!/fileUrl|file_url|contentHash|evidence\//.test(JSON.stringify(p.j)), 'and no storage address');
    let r = await as(ASSESSOR, () => attach(A2, [annFile.id, annNote.id]));
    ok(r.s === 200 && r.j.attached === 2, 'two items are attached to a second assessment', r);
    const onA2 = await rowsOn(A2);
    ok(onA2.length === 2 && onA2.every(x => x.linked_from_id && x.linked_by === ASSESSOR && x.uploaded_by === ANN) && onA2.find(x => x.title === annFile.title).file_url === annFile.file_url, 'the same stored file, still recorded as the candidate\'s, with who attached it', onA2);
    ok((await rowsOn(A1)).length === 2, 'the originals stay where they were');
    ok((await as(ASSESSOR, () => attach(A2, [annFile.id]))).s === 409 && (await as(ASSESSOR, () => portfolio(A2))).j.items.length === 0, 'nothing can be attached twice');
    const dl = await as(ANN, () => raw('GET', `/api/assessment-evidence/${onA2.find(x => x.file_url).id}/download`));
    ok(dl.status === 200 && Buffer.from(await dl.arrayBuffer()).equals(pdf('SEC REUSE ANN FILE')), 'the attached item opens the same file');

    console.log('Any assessment in the portfolio, including a signed-off one');
    r = await as(ASSESSOR, () => attach(ASIGNED, [onA2.find(x => x.file_url).id]));
    ok(r.s === 200, 'an item can be attached to a signed-off assessment, even by way of another attached copy', r);
    const onSigned = await rowsOn(ASIGNED);
    ok(onSigned.length === 1 && onSigned[0].linked_from_id === annFile.id, 'it points back to the original, not to the copy', onSigned.map(x => x.linked_from_id));
    const listSigned = await as(ASSESSOR, () => call('GET', `/api/assessment-evidence?assessmentId=${ASIGNED}`));
    ok(listSigned.j[0].linked?.afterSignOff === true && !!listSigned.j[0].linked.fromCode && /Sec Assessor/.test(listSigned.j[0].linked.byName), 'it is shown as attached after sign-off, from where and by whom', listSigned.j[0]?.linked);
    const listA2 = await as(ASSESSOR, () => call('GET', `/api/assessment-evidence?assessmentId=${A2}`));
    ok(listA2.j.every(x => x.linked && x.linked.afterSignOff === false && x.canRemoveAttachment === true && x.contentHash === undefined), 'on an open assessment it is not marked that way', listA2.j.map(x => x.linked));
    const mine = await as(ANN, () => call('GET', '/api/my-evidence'));
    ok(mine.j.evidence.filter(e => e.linked).length === 3, 'the candidate sees where each attached item came from', mine.j.evidence.map(e => !!e.linked));

    console.log('Nothing crosses from one candidate to another');
    let before = await evidenceCount();
    r = await as(ASSESSOR, () => attach(B2, [annFile.id]));
    ok(r.s === 404, "the assessor of both cannot attach Ann's evidence to Ben", r);
    r = await as(ASSESSOR, () => attach(A2, [benFile.id]));
    ok(r.s === 404, "nor Ben's to Ann", r);
    r = await as(ASSESSOR, () => attach(B2, [benFile.id, annNote.id]));
    ok(r.s === 404 && (await rowsOn(B2)).length === 0, "if one item in a request is someone else's, nothing is attached at all", r);
    ok((await call('POST', `/api/assessments/${B2}/portfolio-evidence`, { evidenceIds: [annFile.id] })).s === 404, 'an administrator cannot either');
    ok((await call('POST', `/api/assessments/${B2}/portfolio-evidence`, { evidenceIds: [annFile.id], candidateId: ANN })).s === 400, 'extra fields in the request are refused');
    r = await as(BEN, () => send(B1, 'SEC REUSE ben copy', [{ name: 'renamed.pdf', data: pdf('SEC REUSE ANN FILE') }]));
    ok(r.s === 409 && /another candidate/.test(r.j.error), "Ben cannot upload Ann's file under another name", r);
    r = await as(ASSESSOR, () => send(B2, 'SEC REUSE moved by assessor', [{ name: 'x.pdf', data: pdf('SEC REUSE ANN FILE') }]));
    ok(r.s === 409 && !/Ann/.test(r.j.error), "nor can the assessor download it and upload it to Ben, and the refusal does not name whose it is", r);
    r = await as(ASSESSOR, () => send(B2, 'SEC REUSE mixed', [{ name: 'fine.pdf', data: pdf('SEC REUSE NEW FILE') }, { name: 'ann.pdf', data: pdf('SEC REUSE ANN FILE') }]));
    ok(r.s === 409 && (await rowsOn(B2)).length === 0, 'one such file stops the whole upload', r);
    ok((await evidenceCount()) === before, 'after all of that, not one record was made', (await evidenceCount()) - before);
    ok((await as(ANN, () => send(A2, 'SEC REUSE ann again', [{ name: 'again.pdf', data: pdf('SEC REUSE ANN FILE') }]))).s === 201, 'the same candidate may upload their own file again');

    console.log('The other ways in are closed');
    for (const [m, path, body, what] of [
      ['POST', '/api/assessment-evidence', { assessmentId: B2, fileName: 'x.pdf', fileUrl: annFile.file_url, uploadedBy: BEN }, 'creating a record that points at a stored file'],
      ['PATCH', `/api/assessment-evidence/${benFile.id}`, { fileUrl: annFile.file_url }, 'pointing an existing record at another file'],
      ['PATCH', `/api/assessment-evidence/${annFile.id}`, { assessmentId: B2 }, "moving a record to another candidate's assessment"],
    ]) ok((await call(m, path, body)).s === 404, `no route for ${what}`);
    const recorded = await as(ASSESSOR, () => call('POST', `/api/assessments/${B2}/result`, { outcome: 'competent', assessmentMethods: ['Observation'], knowledgeOutcomes: 'SEC REUSE k', performanceOutcomes: 'SEC REUSE p', overallComment: 'SEC REUSE o', evidence: [{ fileName: 'x.pdf', fileUrl: 'https://example.com/x.pdf' }] }));
    ok(recorded.s === 200 && (await rowsOn(B2)).length === 0, 'a result that is accepted cannot slip in an evidence record with it', recorded);
    r = await call('PATCH', `/api/assessments/${A1}`, { candidateId: BEN });
    ok(r.s === 400 && (await q('select candidate_id from assessments where id = $1', [A1]))[0].candidate_id === ANN, 'an assessment, and its evidence with it, cannot be moved to another candidate', r);

    console.log('The database refuses it by itself');
    const dbRefuses = async (sqlText, args) => { try { await q(sqlText, args); return false; } catch (e) { return /same candidate|belongs to another candidate/.test(e.message); } };
    ok(await dbRefuses("insert into assessment_evidence (assessment_id, file_name, file_url, uploaded_by, linked_from_id) values ($1,'x','evidence/sec-reuse-new',$2,$3)", [B1, BEN, annNote.id]), 'a link from one candidate to another');
    ok(await dbRefuses("insert into assessment_evidence (assessment_id, file_name, file_url, uploaded_by) values ($1,'x',$2,$3)", [B1, annFile.file_url, BEN]), "a record on Ben pointing at Ann's stored file");
    ok(await dbRefuses("insert into assessment_evidence (assessment_id, file_name, file_url, uploaded_by, content_hash) values ($1,'x','evidence/sec-reuse-other',$2,$3)", [B1, BEN, annFile.content_hash]), "the same file contents on Ben");
    ok(await dbRefuses('update assessment_evidence set assessment_id = $1 where id = $2', [B1, annFile.id]), "moving Ann's record to Ben");

    console.log('Who may attach');
    for (const [who, label] of [[ANN, 'the candidate'], [BEN, 'another candidate'], [STRANGER, 'an assessor with no link to this candidate'], [MGR, "the candidate's manager"]]) {
      const l = await as(who, () => portfolio(A1)), w = await as(who, () => attach(A1, [onA2[0].id]));
      ok(l.s === 403 && w.s === 403, `${label} cannot open the picker or attach`, [l.s, w.s]);
    }
    ok((await as(STRANGER, () => call('POST', `/api/assessment-evidence/${annFile.id}/reject`, { reason: 'SEC REUSE no right' }))).s === 403, 'an unrelated assessor cannot reject evidence');
    ok((await as(STRANGER, () => call('POST', `/api/assessment-evidence/${annFile.id}/ai-review`))).s === 403, 'or run the AI review on it');
    await q('insert into candidate_allocations (assessor_id, candidate_id, is_active) values ($1,$2,true)', [STRANGER, ANN]);
    ok((await as(STRANGER, () => portfolio(A1))).s === 200 && (await as(STRANGER, () => portfolio(B1))).s === 403, 'once allocated to a candidate they can work with that candidate only');

    console.log('Taking back an attachment');
    const copy = (await rowsOn(A2)).find(x => x.linked_from_id === annNote.id);
    ok((await as(ASSESSOR, () => call('DELETE', `/api/assessments/${A1}/portfolio-evidence/${annFile.id}`))).s === 404, 'an original cannot be removed this way');
    ok((await as(ANN, () => call('DELETE', `/api/assessments/${A2}/portfolio-evidence/${copy.id}`))).s === 403, 'the candidate cannot remove an attachment');
    ok((await as(ASSESSOR, () => call('DELETE', `/api/assessments/${A2}/portfolio-evidence/${copy.id}`))).s === 200 && (await q('select is_active from assessment_evidence where id = $1', [annNote.id]))[0].is_active, 'the assessor removes an attachment; the original stays');
    ok((await as(ASSESSOR, () => attach(A2, [annNote.id]))).s === 200, 'and it can be attached again');
    const second = (await rowsOn(A2)).find(x => x.linked_from_id === annNote.id);
    await q("update assessments set sign_off_at = now() + interval '1 minute' where id = $1", [A2]);
    ok((await as(ASSESSOR, () => call('DELETE', `/api/assessments/${A2}/portfolio-evidence/${second.id}`))).s === 409, 'once signed off with it in place, it stays on the record');

    console.log('A rejection stays with the assessment it was made on');
    await as(ASSESSOR, () => call('POST', `/api/assessment-evidence/${annFile.id}/reject`, { reason: 'SEC REUSE not for this unit' }));
    const state = await q('select assessment_id, rejected_at from assessment_evidence where (id = $1 or linked_from_id = $1) and is_active', [annFile.id]);
    ok(state.filter(x => x.rejected_at).length === 1 && state.length >= 3, 'the attached copies are not rejected with it', state.length);
    await q("update assessments set sign_off_at = null where id = $1", [A2]);
    const fresh = await asmt(ANN, el[3]);
    p = await as(ASSESSOR, () => portfolio(fresh));
    const item = p.j.items.find(i => i.title === annFile.title);
    ok(item && item.notAccepted.some(n => n.reason === 'SEC REUSE not for this unit') && item.usedOn.length >= 3, 'the picker lists each item once, where it is used, and where it was not accepted', item);
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
