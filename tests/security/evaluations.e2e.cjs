// Training course evaluations, against a running demo server (port 5056, LOCAL_DEV_AUTH=true NODE_ENV=development, SESSION_SECRET=test, started
// fresh and with email NOT set up) and the demo database. Creates throwaway people, courses and bookings, and removes everything it made.
const { Pool } = require('pg');
const { execSync } = require('child_process');
const B = 'http://localhost:5056';
let pass = 0, fail = 0, cookie = '';
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''); } };
const raw = async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return r;
};
const call = async (m, p, b) => { const r = await raw(m, p, b); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const as = async (id, fn) => { await call('POST', '/api/auth/impersonate', { userId: id }); try { return await fn(); } finally { await call('POST', '/api/auth/stop-impersonating'); } };
const day = (ahead) => new Date(Date.now() + ahead * 86400000).toISOString().slice(0, 10);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const helper = (args) => { const out = execSync(`npx tsx tests/security/runEvaluationReminders.ts ${args}`, { encoding: 'utf8' }); return JSON.parse(out.split('\n').find(l => l.startsWith('RESULT ')).slice(7)); };
const SECRET = ['ZZBEST-WORDS', 'ZZIMPROVE-WORDS', 'ZZFURTHER-WORDS', 'ZZCONCERN-WORDS', 'ZZNOTATTEND-WORDS'];

const API = '/api/training-evaluations';
const answer = (form, over = {}) => {
  const a = {};
  for (const sec of form.sections) for (const q of sec.questions) {
    if (q.onlyIf || q.kind === 'text') continue;
    a[q.key] = q.kind === 'multi' ? ['none'] : q.kind === 'choice' ? q.options[q.key === 'level' || q.key === 'length' ? 1 : 0].value : 4;
  }
  return { ...a, ...over };
};

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (s, a) => (await pool.query(s, a || [])).rows;
  const C = ['sec-ev-c1', 'sec-ev-c2', 'sec-ev-c3', 'sec-ev-c4'], VIEWER = 'sec-ev-viewer', TADMIN = 'sec-ev-tadmin', OTHER = 'sec-ev-other';
  // as text, in UTC, like the stored times: a Date would be sent in this machine's own time zone
  const startedAt = (await q("select (now() at time zone 'utc')::text t"))[0].t;
  const settingsBefore = (await q("select settings from training_evaluation_settings where id = 'default'"))[0];
  const permBefore = await q("select role, area, action, allowed from training_permissions where area = 'evaluations'");
  const ids = {};
  const cleanup = async () => {
    const people = [...C, VIEWER, TADMIN, OTHER];
    await q('delete from training_evaluations where user_id = any($1) or created_at >= $2', [people, startedAt]);
    await q("delete from training_course_reviews where course_title like 'SEC EVAL%'");
    await q("delete from notification_logs where setting_id = 'training-evaluations' and created_at >= $1", [startedAt]);
    await q('delete from training_completion_audit where user_id = any($1)', [people]);
    await q('delete from contractor_declarations where user_id = any($1)', [people]);
    await q('delete from course_bookings where user_id = any($1)', [people]);
    await q("delete from course_training_sessions where instructor like 'SEC EVAL%'");
    await q("delete from external_training_courses where title like 'SEC EVAL%'");
    await q("delete from training_venues where name like 'SEC EVAL%'");
    await q("delete from training_providers where name like 'SEC EVAL%'");
    await q('delete from training_enrollments where user_id = any($1)', [people]);
    await q("delete from trainings where name like 'SEC EVAL%'");
    await q('delete from user_role_assignments where user_id = any($1)', [people]);
    await q('delete from users where id = any($1)', [people]);
  };
  try {
    await cleanup();
    await q("delete from training_evaluation_settings where id = 'default'");
    await q("delete from training_permissions where area = 'evaluations'");
    const mk = (id, role, last) => q("insert into users (id,email,first_name,last_name,role,employment_type,is_active,approval_status) values ($1,$2,'Eve',$3,$4,'employee',true,'approved')", [id, `${id}@example.com`, last, role]);
    for (let i = 0; i < C.length; i++) await mk(C[i], 'candidate', `ZZCAND${i + 1}`);
    await mk(OTHER, 'candidate', 'Bystander'); await mk(VIEWER, 'manager', 'Viewer'); await mk(TADMIN, 'candidate', 'TrainingAdmin');
    await q("insert into user_role_assignments (user_id, role, is_active) values ($1, 'training_administrator', true)", [TADMIN]);
    const category = (await q('select id from training_categories limit 1'))[0].id;
    const training = async (name, source) => (await q('insert into trainings (category_id, name, training_source, is_active) values ($1,$2,$3,true) returning id', [category, name, source]))[0].id;
    ids.practical = await training('SEC EVAL practical rigging', 'TC');
    ids.elearn = await training('SEC EVAL e-learning module', 'E');
    ids.ojt = await training('SEC EVAL on the job task', 'OJT');
    const provider = (await q("insert into training_providers (name) values ('SEC EVAL Provider North') returning id"))[0].id;
    const venue = (await q("insert into training_venues (name, city) values ('SEC EVAL Yard', 'Testville') returning id"))[0].id;
    const course = (await q("insert into external_training_courses (training_id, title, provider_id) values ($1, 'SEC EVAL practical rigging', $2) returning id", [ids.practical, provider]))[0].id;
    const session = (await q("insert into course_training_sessions (course_id, start_at, end_at, capacity, seats_remaining, venue_id, instructor) values ($1, now() - interval '2 days', now() - interval '1 day', 20, 20, $2, 'SEC EVAL Instructor Ina') returning id", [course, venue]))[0].id;
    const book = async (user) => (await q("insert into course_bookings (user_id, session_id, status) values ($1,$2,'confirmed') returning id", [user, session]))[0].id;
    const bookings = {}; for (const c of C) bookings[c] = await book(c);
    await q("update users set role = 'super_admin' where id = 'local-dev-admin'");

    console.log('Settings');
    const s0 = await call('GET', `${API}/settings`);
    ok(s0.s === 200 && s0.j.settings.enabled && s0.j.settings.windowDays === 30 && s0.j.settings.reminderEveryDays === 7 && s0.j.settings.maxReminders === 3 && s0.j.settings.followUpDays === 90 && s0.j.settings.showNames === false && s0.j.settings.minGroup === 3 && s0.j.settings.startFrom === day(0),
      'sensible starting settings; asking starts from today, so past training is not chased', s0.j.settings && { ...s0.j.settings, statements: undefined });
    const base = { ...s0.j.settings, startFrom: day(-10) };
    ok((await call('PUT', `${API}/settings`, base)).s === 200, 'an administrator can change them');
    ok((await call('PUT', `${API}/settings`, { ...base, extra: 1 })).s === 400 && (await call('PUT', `${API}/settings`, { ...base, windowDays: 0 })).s === 400, 'unknown or out-of-range settings are refused');
    for (const [path, method] of [['analysis', 'GET'], ['settings', 'GET'], ['awaiting', 'GET'], ['safety', 'GET'], ['remind', 'POST']]) {
      const r = await as(C[0], () => call(method, `${API}/${path}`, method === 'POST' ? {} : undefined));
      ok(r.s === 403, `a candidate is refused ${path}`, r.s);
    }

    console.log('A request is made when attendance is recorded');
    const done = await call('PUT', `/api/course-bookings/${bookings[C[0]]}`, { status: 'completed' });
    ok(done.s === 200, 'a booking is marked completed', done);
    for (const c of C.slice(1)) await call('PUT', `/api/course-bookings/${bookings[c]}`, { status: 'completed' });
    await wait(4000);
    let rows = await q('select * from training_evaluations where user_id = $1 order by stage', [C[0]]);
    const first = rows.find(r => r.stage === 'course'), fu = rows.find(r => r.stage === 'followup');
    ok(rows.length === 2 && first && fu, 'one request for the course and one follow-up, although the booking also made a training record', rows.map(r => [r.stage, r.source]));
    ok(first && first.form_type === 'practical' && first.source === 'booking' && first.provider_name === 'SEC EVAL Provider North' && first.instructor === 'SEC EVAL Instructor Ina' && /SEC EVAL Yard/.test(first.venue_name), 'it knows the form, provider, instructor and venue', first);
    ok(first && first.invited_at && !fu.invited_at, 'the invitation has gone for the course; the follow-up is not asked yet');
    const invites = await q("select * from notification_logs where type_key = 'training_evaluation_invite' and recipient_id = $1 and created_at >= $2", [C[0], startedAt]);
    ok(invites.length === 1 && invites[0].status === 'skipped' && /SEC EVAL practical rigging/.test(invites[0].body), 'one invitation, recorded as not sent because email is not set up', invites.map(i => i.status));

    await q("insert into training_completion_audit (user_id, training_id, method, completed_at) values ($1,$2,'content_completed', now())", [C[0], ids.elearn]);
    const enr = (await q("insert into training_enrollments (user_id, training_id, status) values ($1,$2,'in_progress') returning id", [C[0], ids.ojt]))[0].id;
    await call('PATCH', `/api/training-enrollments/${enr}`, { status: 'completed' });
    const old = (await q("insert into training_enrollments (user_id, training_id, status, achievement_date) values ($1,$2,'completed', now() - interval '400 days') returning id", [OTHER, ids.ojt]))[0].id;
    const declared = (await q("insert into training_enrollments (user_id, training_id, status, achievement_date) values ($1,$2,'completed', now() - interval '2 days') returning id", [OTHER, ids.elearn]))[0].id;
    await q("insert into contractor_declarations (user_id, contract_company_id, kind, training_enrollment_id, achieved_at, declared_by) values ($1,'sec-ev-co','training',$2, now(), 'sec-ev-viewer')", [OTHER, declared]);
    await wait(1500);
    const mine = await as(C[0], () => call('GET', `${API}/mine`));
    const types = (mine.j.open || []).map(e => e.formType).sort();
    ok(mine.s === 200 && mine.j.open.length === 3 && types.join() === 'elearning,ojt,practical', 'finished e-learning and a recorded on-the-job completion are asked about too, each with its own form', types);
    const others = await as(OTHER, () => call('GET', `${API}/mine`));
    ok(others.s === 200 && others.j.open.length === 0, 'a record from before evaluations began, and a past certificate a contractor declared, are not asked about', others.j.open);

    console.log('Only the person themself can see or answer their request');
    for (const [m, p, b] of [['GET', ''], ['PUT', '/draft', { answers: {} }], ['POST', '/submit', { answers: {}, namesShown: false }], ['POST', '/not-attended', { reason: 'not me at all' }]]) {
      const r = await as(OTHER, () => call(m, `${API}/mine/${first.id}${p}`, b));
      ok(r.s === 404, `someone else: ${m} ${p || '(read)'} answers "not found"`, r.s);
    }
    ok((await call('GET', `${API}/mine/${first.id}`)).s === 404, "an administrator cannot open another person's form through the candidate address");
    ok((await as(C[0], () => call('GET', `${API}/mine/${fu.id}`))).s === 404, 'a follow-up cannot be answered before it opens');

    console.log('Answering');
    const open = await as(C[0], () => call('GET', `${API}/mine/${first.id}`));
    ok(open.s === 200 && open.j.namesShown === false && /not shown/.test(open.j.privacy) && open.j.form.sections.length === 10, 'the form says what happens to their name, before they answer', open.j.form?.sections.map(s => s.key));
    const empty = await as(C[0], () => call('POST', `${API}/mine/${first.id}/submit`, { answers: {}, namesShown: false }));
    ok(empty.s === 400 && empty.j.missing.length > 25, 'an empty reply is refused and says what is missing', empty.j.missing?.length);
    ok((await as(C[0], () => call('PUT', `${API}/mine/${first.id}/draft`, { answers: { 'ps-1': 5, injected: 'x', best: 'ZZBEST-WORDS' } }))).s === 200, 'a draft can be saved');
    const draft = (await q('select answers, status from training_evaluations where id = $1', [first.id]))[0];
    ok(draft.status === 'open' && draft.answers['ps-1'] === 5 && !('injected' in draft.answers), 'only answers the form has are kept', draft.answers);
    const good = answer(open.j.form, { best: 'ZZBEST-WORDS', improve: 'ZZIMPROVE-WORDS', further: 'ZZFURTHER-WORDS', safety: 'yes', safety_details: 'ZZCONCERN-WORDS' });
    const wrongPromise = await as(C[0], () => call('POST', `${API}/mine/${first.id}/submit`, { answers: good, namesShown: true }));
    ok(wrongPromise.s === 409 && wrongPromise.j.reload, 'a reply written under a different promise about names is not accepted', wrongPromise);
    const noDetail = await as(C[0], () => call('POST', `${API}/mine/${first.id}/submit`, { answers: { ...good, safety_details: '' }, namesShown: false }));
    ok(noDetail.s === 400 && noDetail.j.missing.includes('safety_details'), 'a safety concern needs saying what it is');
    const sent = await as(C[0], () => call('POST', `${API}/mine/${first.id}/submit`, { answers: good, namesShown: false }));
    ok(sent.s === 200 && sent.j.safetyConcern === true, 'a complete reply is accepted', sent);
    ok((await as(C[0], () => call('POST', `${API}/mine/${first.id}/submit`, { answers: good, namesShown: false }))).s === 409, 'it cannot be sent twice');
    ok((await as(C[0], () => call('PUT', `${API}/mine/${first.id}/draft`, { answers: {} }))).s === 409, 'nor changed afterwards');
    const kept = (await q('select * from training_evaluations where id = $1', [first.id]))[0];
    ok(kept.status === 'submitted' && kept.named === false && kept.safety_concern && kept.form.sections.length === 10 && kept.entered_by === 'local-dev-admin', 'the wording asked is kept with the reply, and that it was entered while viewing as them');
    await wait(1500);
    const alerts = await q("select * from notification_logs where type_key = 'training_safety_concern' and created_at >= $1", [startedAt]);
    ok(alerts.length > 0 && alerts.some(a => a.recipient_id === TADMIN) && alerts.every(a => !a.body.includes('ZZCONCERN-WORDS') && !a.body.includes('ZZCAND1')), 'administrators and training administrators are told at once; the email carries neither the words nor the name', alerts.length);

    console.log('Results held back until nobody can be picked out');
    let an = await call('GET', `${API}/analysis`);
    let line = an.j.courses?.find(c => c.key === ids.practical);
    ok(an.s === 200 && line && line.summary.replies === 1 && line.summary.hidden && line.summary.overall === null && line.verdict.key === 'too_few' && line.summary.safetyConcerns === 1, 'with one reply: counted, no scores, safety concern still shown', line?.summary);
    let det = await call('GET', `${API}/course?key=${ids.practical}`);
    ok(det.s === 200 && det.j.comments.length === 0 && det.j.questions.length === 0 && !JSON.stringify(det.j).includes('ZZ'), 'no comments or statement scores either, even for a full administrator', JSON.stringify(det.j).match(/ZZ[A-Z-]+\d?/g));
    for (const [i, c] of [[1, C[1]], [2, C[2]]]) {
      const r = (await q("select id from training_evaluations where user_id = $1 and stage = 'course'", [c]))[0];
      const f = (await as(c, () => call('GET', `${API}/mine/${r.id}`))).j.form;
      const res = await as(c, () => call('POST', `${API}/mine/${r.id}/submit`, { answers: answer(f, i === 1 ? { suitable: 'no' } : {}), namesShown: false }));
      if (res.s !== 200) ok(false, 'second and third replies are accepted', res);
    }
    an = await call('GET', `${API}/analysis?groupBy=instructor`);
    line = an.j.courses.find(c => c.key === ids.practical);
    ok(line.summary.replies === 3 && !line.summary.hidden && line.summary.overall === 4 && line.summary.asked === 4 && line.summary.responseRatePct === 75, 'with three replies the figures show', line.summary);
    ok(line.verdict.key === 'review' && line.verdict.reasons.some(r => /33% say it did not meet/.test(r)), 'one in three saying it did not meet their need marks the course for review, with the reason', line.verdict);
    ok(an.j.groups.some(g => g.label === 'SEC EVAL Instructor Ina' && g.summary.replies === 3), 'it can be compared by instructor');
    det = await call('GET', `${API}/course?key=${ids.practical}`);
    ok(det.j.comments.length === 3 && det.j.comments.every(c => c.name === null && /^\d{4}-\d{2}$/.test(c.month)) && det.j.questions.length > 20, 'comments show without names, by month only', det.j.comments);
    ok(!JSON.stringify(det.j).includes('ZZCAND') && !JSON.stringify(an.j).includes('ZZCAND') && !JSON.stringify(det.j).includes('ZZCONCERN'), "nothing in the results names anyone or carries the safety wording");

    console.log('The administrator decides who sees what');
    ok((await as(VIEWER, () => call('GET', `${API}/analysis`))).s === 403, 'a manager sees nothing by default');
    await q("insert into training_permissions (role, area, action, allowed) values ('manager','evaluations','view',true)");
    await wait(31000); // the permission table is cached for half a minute
    const v = await as(VIEWER, () => call('GET', `${API}/course?key=${ids.practical}`));
    ok(v.s === 200 && v.j.canManage === false && v.j.comments.every(c => c.name === null), 'given "view", they see results without names', v.s);
    for (const [m, p, b] of [['GET', 'awaiting'], ['GET', 'safety'], ['GET', 'settings'], ['POST', 'remind', {}], ['POST', 'reviews', { courseKey: ids.practical, decision: 'keep', note: 'looks fine to me' }], ['POST', `${first.id}/safety-close`, { action: 'closing it without the right' }], ['PUT', 'settings', base]]) {
      const r = await as(VIEWER, () => call(m, `${API}/${p}`, b));
      ok(r.s === 403, `but not ${p.replace(first.id, ':id')}`, r.s);
    }
    const ta = await as(TADMIN, () => call('GET', `${API}/awaiting`));
    ok(ta.s === 200 && ta.j.awaiting.some(a => a.person.includes('ZZCAND4')) && !JSON.stringify(ta.j).includes('ZZBEST'), 'a training administrator sees who has not replied, never what anyone said', ta.s);

    console.log('Safety concerns');
    const list = await as(TADMIN, () => call('GET', `${API}/safety`));
    const concern = list.j.find(c => c.id === first.id);
    ok(concern && concern.concern === 'ZZCONCERN-WORDS' && concern.person.includes('ZZCAND1') && !JSON.stringify(list.j).includes('ZZBEST'), 'the concern is shown with the name, as the form said, and with nothing else they wrote', concern);
    const brief = await as(TADMIN, () => call('GET', '/api/home/briefing'));
    ok(brief.j.attention?.some(a => a.id === 'x-eval-safety' && a.severity === 'critical'), 'and it is on their home screen', brief.j.attention);
    ok((await as(TADMIN, () => call('POST', `${API}/${first.id}/safety-close`, { action: 'ok' }))).s === 400, 'closing it needs saying what was done');
    ok((await as(TADMIN, () => call('POST', `${API}/${first.id}/safety-close`, { action: 'Spoke to the provider; guard refitted' }))).s === 200 && (await as(TADMIN, () => call('POST', `${API}/${first.id}/safety-close`, { action: 'Spoke to the provider again' }))).s === 404, 'it is closed once, with the action recorded');

    console.log('Decisions about a course');
    const decided = await as(TADMIN, () => call('POST', `${API}/reviews`, { courseKey: ids.practical, decision: 'change_provider', note: 'Raise hands-on time with the provider', nextReviewOn: day(90) }));
    const after = await call('GET', `${API}/course?key=${ids.practical}`);
    ok(decided.s === 200 && after.j.reviews.length === 1 && after.j.reviews[0].decision === 'Change provider or instructor' && after.j.reviews[0].figures.rating === 'Review needed' && after.j.reviews[0].figures.replies === 3 && /TrainingAdmin/.test(after.j.reviews[0].by), 'the decision is kept with who made it and the figures at the time', after.j.reviews);

    console.log('Did not attend, and corrections');
    const mine4 = (await q("select id from training_evaluations where user_id = $1 and stage = 'course'", [C[3]]))[0];
    ok((await as(C[3], () => call('POST', `${API}/mine/${mine4.id}/not-attended`, { reason: 'no' }))).s === 400, 'saying "I did not attend" needs a reason');
    ok((await as(C[3], () => call('POST', `${API}/mine/${mine4.id}/not-attended`, { reason: 'ZZNOTATTEND-WORDS I was on leave' }))).s === 200, 'it is recorded');
    const states = await q('select stage, status from training_evaluations where user_id = $1 order by stage', [C[3]]);
    ok(states.map(s => `${s.stage}:${s.status}`).join() === 'course:declined,followup:cancelled', 'and the follow-up is withdrawn with it', states);
    const correct = await book(OTHER);
    await call('PUT', `/api/course-bookings/${correct}`, { status: 'completed' });
    await wait(2500);
    await q("update course_bookings set status = 'cancelled' where id = $1", [correct]);
    await q('update training_enrollments set is_active = false where user_id = $1 and training_id = $2', [OTHER, ids.practical]);
    let o = await as(OTHER, () => call('GET', `${API}/mine`));
    ok(o.j.open.length === 0, 'when a booking and its training record are corrected, the request is withdrawn', o.j.open);
    ok((await q("select count(*)::int n from training_evaluations where user_id = $1 and training_id = $2 and status = 'cancelled'", [OTHER, ids.practical]))[0].n === 2, 'and its follow-up with it');
    await q("update course_bookings set status = 'completed' where id = $1", [correct]);
    o = await as(OTHER, () => call('GET', `${API}/mine`));
    ok(o.j.open.length === 1 && (await q('select count(*)::int n from training_evaluations where user_id = $1 and training_id = $2', [OTHER, ids.practical]))[0].n === 2, 'and it comes back, not twice, if the booking is completed again', o.j.open);
    const back = await q('select stage, status, opens_on::text o, due_on::text d from training_evaluations where user_id = $1 and training_id = $2', [OTHER, ids.practical]);
    ok(back.length === 2 && back.every(b => b.status === 'open' && b.d > b.o), 'with the follow-up again open for its full reply time after it opens, not closing before it', back);
    const mineOther = (await q("select id from training_evaluations where user_id = $1 and training_id = $2 and stage = 'course'", [OTHER, ids.practical]))[0];
    const formOther = (await as(OTHER, () => call('GET', `${API}/mine/${mineOther.id}`))).j.form;
    await q("update training_evaluations set course_title = 'SEC EVAL practical rigging' where id = $1", [mineOther.id]);
    ok((await as(OTHER, () => call('POST', `${API}/mine/${mineOther.id}/submit`, { answers: answer(formOther), namesShown: false }))).s === 200, 'the restored request can be answered');
    await q("update course_bookings set status = 'cancelled' where id = $1", [correct]);
    await q('update training_enrollments set is_active = false where user_id = $1 and training_id = $2', [OTHER, ids.practical]);
    await as(OTHER, () => call('GET', `${API}/mine`));
    const afterSent = await q('select stage, status from training_evaluations where user_id = $1 and training_id = $2 order by stage', [OTHER, ids.practical]);
    ok(afterSent.map(a => `${a.stage}:${a.status}`).join() === 'course:submitted,followup:cancelled', 'correcting the record after feedback was sent keeps the reply and withdraws the follow-up', afterSent);

    console.log('Reminders');
    const homeC = await as(C[0], () => call('GET', '/api/home/briefing'));
    ok(homeC.j.attention?.some(a => a.id === 'x-eval' && a.count === 2 && a.href === '/my-training-feedback'), 'outstanding feedback is on the home screen', homeC.j.attention);
    const nomail = await call('POST', `${API}/remind`, {});
    ok(nomail.s === 200 && nomail.j.people === 0 && /Email is not set up/.test(nomail.j.message), 'with no email set up, "remind everyone" says nothing was sent', nomail.j);
    const count = async () => (await q("select coalesce(sum(reminder_count),0)::int n from training_evaluations where user_id = $1 and stage = 'course' and status = 'open'", [C[0]]))[0].n;
    let r = helper('8 off');
    ok(r.skipped === 'Email is not set up' && (await count()) === 0, 'and no reminder is used up', r);
    r = helper('5');
    ok(r.emails.every(e => !e.to.startsWith('sec-ev-')), 'nothing before the interval has passed', r.emails.map(e => e.to));
    r = helper('8 fail');
    ok((await count()) === 0, 'a failed send does not use one up either', r);
    r = helper('16');
    let own = r.emails.filter(e => e.to === `${C[0]}@example.com`);
    ok(own.length === 1 && /Reminder/.test(own[0].subject) && /SEC EVAL e-learning module/.test(own[0].html) && /SEC EVAL on the job task/.test(own[0].html) && !/practical rigging/.test(own[0].html), 'one reminder lists everything still owed, and not what has been answered', own);
    ok(!r.emails.some(e => e.to === `${C[3]}@example.com` || e.to === `${C[1]}@example.com`), 'nobody who has replied, or said they did not attend, is reminded');
    r = helper('16');
    ok(r.emails.filter(e => e.to === `${C[0]}@example.com`).length === 0, 'running again the same day sends nothing more', r.emails.map(e => e.to));
    helper('24'); helper('28');
    r = helper('29');
    const total = (await q("select max(reminder_count)::int m from training_evaluations where user_id = $1", [C[0]]))[0].m;
    ok(total <= 3, 'never more than the maximum', total);
    helper('close 40');
    const closed = await q("select status, stage from training_evaluations where user_id = $1 and stage = 'course' and training_id = any($2)", [C[0], [ids.elearn, ids.ojt]]);
    ok(closed.length === 2 && closed.every(c => c.status === 'expired'), 'after the reply time the request closes', closed);
    const late = (await q("select id from training_evaluations where user_id = $1 and status = 'expired' limit 1", [C[0]]))[0];
    ok((await as(C[0], () => call('POST', `${API}/mine/${late.id}/submit`, { answers: {}, namesShown: false }))).s === 409, 'and cannot be answered late');

    console.log('Exports and the logs');
    const urls = [`${API}/analysis?groupBy=provider`, `${API}/course?key=${ids.practical}`, `${API}/safety`, `${API}/settings`, `${API}/mine`, `${API}/mine/${first.id}`];
    const prep = await call('POST', '/api/export/prepare', { path: '/admin/training-evaluations', title: 'Training Evaluations', urls });
    const names = (prep.j.sources || []).map(s => s.name);
    ok(prep.s === 200 && names.includes('Course suitability') && names.includes('Comments') && !names.some(n => /safety|setting|mine/i.test(n)), 'the results export to Excel with their own layout; safety concerns, settings and personal forms are never picked up', names);
    const auditRows = await q('select * from audit_events where occurred_at >= $1', [startedAt]);
    ok(auditRows.length > 10, 'the audit log has this run in it', auditRows.length);
    const audit = JSON.stringify(auditRows);
    ok(!SECRET.some(w => audit.includes(w)), 'nothing anyone wrote is copied into the audit log', SECRET.filter(w => audit.includes(w)));
    ok(/sent training feedback for/.test(audit) && /recorded the action on a safety concern/.test(audit), 'but the log shows that feedback was sent and a concern dealt with');

    console.log('Names shown, when the administrator chooses it');
    ok((await call('PUT', `${API}/settings`, { ...base, showNames: true })).s === 200, 'names switched on');
    const still = await call('GET', `${API}/course?key=${ids.practical}`);
    ok(still.j.comments.every(c => c.name === null), 'replies already sent without names stay without them', still.j.comments);

    console.log('Leavers');
    helper(`scrub ${C[0]}`);
    const scrubbed = await q('select * from training_evaluations where user_id = $1', [C[0]]);
    ok(scrubbed.length === 1 && scrubbed[0].status === 'submitted' && !SECRET.some(w => JSON.stringify(scrubbed).includes(w)) && scrubbed[0].answers.overall === 4, "removing a person's details takes out what they wrote and anything unanswered, and keeps the ratings", scrubbed.map(s => [s.stage, s.status]));
  } catch (e) {
    ok(false, 'the test stopped early: ' + (e && e.stack || e));
  } finally {
    await cleanup().catch(e => console.log('  cleanup problem', e.message));
    await q("delete from training_evaluation_settings where id = 'default'");
    if (settingsBefore) await q("insert into training_evaluation_settings (id, settings) values ('default', $1)", [settingsBefore.settings]);
    await q("delete from training_permissions where area = 'evaluations'");
    for (const p of permBefore) await q('insert into training_permissions (role, area, action, allowed) values ($1,$2,$3,$4)', [p.role, p.area, p.action, p.allowed]);
    await q("update users set role = 'developer' where id = 'local-dev-admin'");
    await pool.end();
  }
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
