// Training evaluations: the forms, what is accepted from a browser, how a course is rated and when results are held back. No database needed.
import {
  buildForm, checkAnswers, allQuestions, formTypeFor, settingsSchema, defaultSettings, FORM_TYPES, SECTION_KEYS, DEFAULT_STATEMENTS,
  type Answers, type FormType, type Stage,
} from "../../shared/trainingEvaluation";
import { summarise, verdict, questionResults, comments, grouped, type Row } from "../../server/services/trainingEvaluationAnalysis";

let pass = 0, fail = 0;
const ok = (c: unknown, m: string, extra?: unknown) => { if (c) { pass++; console.log("  PASS", m); } else { fail++; console.log("  FAIL", m, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : ""); } };

console.log("The forms");
for (const t of FORM_TYPES) {
  const f = buildForm(t, "course"), keys = allQuestions(f).map(q => q.key);
  ok(new Set(keys).size === keys.length && SECTION_KEYS.every(k => f.sections.some(s => s.key === k)) && ["overall", "suitable", "recommend", "level", "length", "confidence_before", "confidence_after", "expect_use", "barriers", "safety", "best", "improve", "further"].every(k => keys.includes(k)),
    `${t}: all six rated areas and every fixed question, none twice`);
}
const texts = (t: FormType) => allQuestions(buildForm(t, "course")).map(q => q.text).join(" ");
ok(/instructor/i.test(texts("practical")) && /hands-on/i.test(texts("practical")) && !/instructor/i.test(texts("elearning")) && /device/i.test(texts("elearning")) && /coach/i.test(texts("ojt")), "e-learning is asked about the online experience, practical courses about the instructor and hands-on work, on-the-job training about the coach");
ok(buildForm("practical", "followup").sections.map(s => s.key).join() === "followup,safety", "the follow-up is short: use at work, then safety");
ok(settingsSchema.safeParse(defaultSettings("2027-01-01")).success, "the standard settings are valid");
ok(!settingsSchema.safeParse({ ...defaultSettings("2027-01-01"), statements: { ...DEFAULT_STATEMENTS, practical: { ...DEFAULT_STATEMENTS.practical, suitability: [] } } }).success, "the relevance statements cannot all be removed");

console.log("What is accepted from a browser");
const form = buildForm("practical", "course");
const full = (over: Answers = {}, f = form): Answers => {
  const a: Answers = {};
  for (const q of allQuestions(f)) {
    if (q.onlyIf || q.kind === "text") continue;
    a[q.key] = q.kind === "multi" ? ["none"] : q.kind === "choice" ? q.options![q.key === "level" || q.key === "length" ? 1 : 0].value : 4;
  }
  return { ...a, ...over };
};
ok(checkAnswers(form, full()).missing.length === 0, "a complete reply has nothing missing", checkAnswers(form, full()).missing);
ok(checkAnswers(form, {}).missing.length > 25, "an empty reply lists what is needed");
const dirty = checkAnswers(form, { ...full(), "ps-1": 9, "ps-2": "5", "ps-3": "na", overall: "na", suitable: "maybe", injected: "x", barriers: ["none", "practice", "made-up", "practice"], best: "   " });
ok(!("ps-1" in dirty.answers) && !("ps-2" in dirty.answers) && dirty.answers["ps-3"] === "na" && !("overall" in dirty.answers) && !("suitable" in dirty.answers) && !("injected" in dirty.answers) && !("best" in dirty.answers),
  "out-of-range, wrongly typed, unknown and blank answers are dropped; N/A is kept only where it is offered", dirty.answers);
ok(JSON.stringify(dirty.answers.barriers) === '["practice"]', '"nothing is in the way" cannot sit beside something that is', dirty.answers.barriers);
ok(checkAnswers(form, full({ safety: "yes" })).missing.some(m => m.key === "safety_details"), "saying there was a safety concern means saying what it was");
ok(!("safety_details" in checkAnswers(form, full({ safety: "no", safety_details: "left over" })).answers), "and nothing is kept if the answer is no");
ok((checkAnswers(form, full({ best: "x".repeat(5000) })).answers.best as string).length === 2000, "long text is cut to 2000 characters");

console.log("Which form a course uses");
ok(formTypeFor({ trainingSource: "TC" }) === "practical" && formTypeFor({ trainingSource: "E" }) === "elearning" && formTypeFor({ trainingSource: "OJT" }) === "ojt" && formTypeFor({}) === "classroom", "from how the course is recorded");
ok(formTypeFor({ trainingSource: "TC", modality: "Online" }) === "classroom" && formTypeFor({ trainingSource: "TC", viaElearning: true }) === "elearning" && formTypeFor({ trainingSource: "E", override: "practical" }) === "practical" && formTypeFor({ trainingSource: "TC", override: "none" }) === "none", "how it was actually delivered comes first, and the administrator's choice before that");

console.log("Rating a course");
let n = 0;
const row = (over: Partial<Row> = {}, answers: Answers = {}, stage: Stage = "course"): Row => {
  const f = buildForm("practical", stage);
  const base = stage === "course" ? full({}, f) : { used: "often", "fu-prepared": 4, "fu-difference": 4, confidence_now: 4, barriers: ["none"], refresher: "no", safety: "no" } as Answers;
  n++;
  return { id: `r${String(n).padStart(3, "0")}`, courseKey: "c1", courseTitle: "Confined space entry", categoryName: "Safety", formType: "practical", stage, status: "submitted", answers: { ...base, ...answers }, form: f, providerName: "North Training", venueName: "Yard", instructor: "A. Trainer", jobRoleName: "Technician", completedOn: "2027-02-10", opensOn: "2027-02-10", named: false, userName: "Someone", ...over };
};
const T = "2027-06-01";
const good = [row({}, { confidence_before: 2 }), row({}, { confidence_before: 2 }), row({}, { confidence_before: 3 })];
let s = summarise(good, 3, T);
ok(s.asked === 3 && s.replies === 3 && s.responseRatePct === 100 && s.overall === 4 && s.suitablePct === 100 && s.confidenceGain === 1.67 && s.sections.length === 6, "figures add up", s);
ok(verdict(s, 3).key === "suitable", "a course people rate well is suitable", verdict(s, 3));
const poorRelevance = [1, 2, 3].map(() => row({}, { "ps-1": 2, "ps-2": 2, "ps-3": 3, "ps-4": 2 }));
let v = verdict(summarise(poorRelevance, 3, T), 3);
ok(v.key === "review" && v.reasons.some(r => /Relevance to the job scores 2\.3/.test(r)), "poor relevance to the job means a review, and says why", v);
v = verdict(summarise([row({}, { suitable: "no" }), row(), row(), row()], 3, T), 3);
ok(v.key === "review" && v.reasons.some(r => /25% say it did not meet/.test(r)), "enough people saying it did not meet their need means a review", v);
v = verdict(summarise([1, 2, 3].map(() => row({}, { "pp-1": 3, "pp-2": 2, "pp-3": 3, "pp-4": 3, "pp-5": 4, "pp-6": 3, level: "too_basic" })), 3, T), 3);
ok(v.key === "watch" && v.reasons.some(r => /Practice and activities scores 3\.0/.test(r)) && v.reasons.some(r => /100% say the level was not right \(mostly too basic\)/.test(r)), "weak hands-on practice and the wrong level are pointed out", v);
v = verdict(summarise([...good, ...[1, 2, 3].map(() => row({}, { used: "not_relevant", "fu-prepared": 2 }, "followup"))], 3, T), 3);
ok(v.key === "review" && v.reasons.some(r => /follow-up, 100% say it is not relevant/.test(r)) && v.reasons.some(r => /preparation for the job scores 2\.0/.test(r)), "a good course on the day can still fail the follow-up", v);
ok(verdict(summarise([row(), row()], 3, T), 3).key === "too_few", "two replies are not enough to rate a course");
ok(verdict(summarise([row({ named: true }), row({ named: true })], 1, T), 1).key === "too_few", "even where results can be shown, a rating needs three");
s = summarise([...good, row({ status: "declined" }), row({ status: "cancelled" }), row({ status: "open" }), row({ status: "expired" }), row({ stage: "followup", status: "open", opensOn: "2027-12-01" }, {}, "followup")], 3, T);
ok(s.asked === 5 && s.replies === 3 && s.notAttended === 1 && s.waiting === 1 && s.followUp.asked === 0, "withdrawn and not-attended requests are not counted as asked, and a follow-up not yet open is not either", s);

console.log("Anonymity");
const two = [row({}, { best: "ALPHA comment" }), row({}, { improve: "BETA comment", safety: "yes", safety_details: "GAMMA concern" })];
s = summarise(two, 3, T);
ok(s.hidden && s.replies === 2 && s.overall === null && s.sections.length === 0 && s.suitable.length === 0, "with too few replies given without names, no scores are shown", s);
ok(s.safetyConcerns === 1, "but a safety concern is still counted");
ok(questionResults(two, 3).length === 0 && comments(two, 3, true).length === 0, "nor statement scores or comments, even to whoever manages evaluations");
const three = [...two, row()];
const shown = comments(three, 3, true);
ok(shown.length === 2 && shown.every(c => c.name === null && c.month === "2027-02"), "with enough, comments show without names and with the month only", shown);
ok(!JSON.stringify(shown).includes("GAMMA"), "what was written about safety is not in the comment list");
const named = comments([row({ named: true }, { best: "DELTA" })], 3, true);
ok(named.length === 1 && named[0].name === "Someone", "replies given with names show them to whoever manages evaluations");
ok(comments([row({ named: true }, { best: "DELTA" })], 3, false)[0].name === null, "and not to someone who may only view results");
ok(grouped([...three, row({ instructor: "B. Trainer" })], "instructor", 3, T).find(g => g.key === "B. Trainer")!.summary.hidden, "narrowing to a small group holds it back too");
ok(questionResults(three, 3).some(q => q.section === "Delivery" && q.average === 4), "statement scores are reported by area");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
