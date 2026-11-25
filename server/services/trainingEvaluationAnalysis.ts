// The sums behind the training evaluation results. Nothing here reads the database, so every figure and every suitability rating can be tested on
// its own. A rating is never a bare score: it always comes with the reasons for it, in words.
//
// Anonymity: when replies were given without names, a group with fewer replies than the administrator's minimum is held back, so that a single
// person cannot be picked out by narrowing the filters. This lowers that risk; it cannot remove it.
import { SECTION_KEYS, SECTION_LABEL, NA, allQuestions, TEXT_KEYS, type Answers, type EvaluationForm, type FormType, type Stage } from "@shared/trainingEvaluation";

export interface Row {
  id: string; courseKey: string; courseTitle: string; categoryName: string | null; formType: FormType; stage: Stage;
  status: string; answers: Answers | null; form: EvaluationForm | null; providerName: string | null; venueName: string | null; instructor: string | null;
  jobRoleName: string | null; completedOn: string; opensOn: string; named: boolean; userName?: string | null;
}

export interface SectionScore { key: string; label: string; average: number; favourablePct: number; answers: number }
export interface Share { value: string; count: number; pct: number }
export interface FollowUp { asked: number; replies: number; hidden: boolean; usedPct: number | null; used: Share[]; prepared: number | null; difference: number | null; confidenceNow: number | null; refresherPct: number | null; barriers: Share[] }
export interface Summary {
  asked: number; replies: number; waiting: number; notAttended: number; responseRatePct: number | null;
  /** true when there are replies but too few, given anonymously, to show */
  hidden: boolean;
  overall: number | null; suitablePct: number | null; recommendPct: number | null; suitable: Share[]; level: Share[]; length: Share[]; expectUse: Share[]; barriers: Share[];
  sections: SectionScore[]; confidenceBefore: number | null; confidenceAfter: number | null; confidenceGain: number | null;
  safetyConcerns: number; followUp: FollowUp;
}

export type VerdictKey = "review" | "watch" | "suitable" | "too_few";
export interface Verdict { key: VerdictKey; label: string; reasons: string[] }

export const THRESHOLDS = { reviewScore: 3.0, watchScore: 3.5, reviewNotSuitablePct: 20, watchSuitablePct: 70, watchLevelPct: 40, reviewNotRelevantPct: 25 } as const;

const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places;
const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 2) : null);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const numbers = (rows: Row[], key: string) => rows.map(r => r.answers?.[key]).filter((v): v is number => typeof v === "number");
function shares(rows: Row[], key: string): Share[] {
  const counts = new Map<string, number>();
  let people = 0;
  for (const r of rows) {
    const v = r.answers?.[key];
    if (v === undefined) continue;
    people++;
    for (const one of Array.isArray(v) ? v : [String(v)]) counts.set(one, (counts.get(one) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([value, count]) => ({ value, count, pct: pct(count, people)! })).sort((a, b) => b.count - a.count);
}
const shareOf = (list: Share[], ...values: string[]) => list.filter(x => values.includes(x.value)).reduce((a, x) => a + x.pct, 0);

/** the section a rated statement belongs to, read from the copy of the form that person was asked */
function sectionOfKeys(row: Row): Map<string, string> {
  const m = new Map<string, string>();
  for (const sec of row.form?.sections ?? []) for (const q of sec.questions) if (q.kind === "rating") m.set(q.key, sec.key);
  return m;
}

function sectionScores(rows: Row[]): SectionScore[] {
  const bucket = new Map<string, number[]>();
  for (const r of rows) {
    const where = sectionOfKeys(r);
    for (const [key, section] of Array.from(where.entries())) {
      const v = r.answers?.[key];
      if (typeof v !== "number") continue;
      (bucket.get(section) ?? bucket.set(section, []).get(section)!).push(v);
    }
  }
  return SECTION_KEYS.filter(k => bucket.has(k)).map(k => {
    const xs = bucket.get(k)!;
    return { key: k, label: SECTION_LABEL[k], average: mean(xs)!, favourablePct: pct(xs.filter(x => x >= 4).length, xs.length)!, answers: xs.length };
  });
}

const tooFew = (replies: Row[], minGroup: number) => replies.length > 0 && replies.length < minGroup && replies.some(r => !r.named);

/** `rows` may hold both course evaluations and follow-ups; `today` decides which follow-ups have opened. */
export function summarise(rows: Row[], minGroup: number, today: string): Summary {
  // someone who says they did not attend, or a request an administrator has withdrawn, was never really asked
  const live = rows.filter(r => r.status !== "cancelled");
  const course = live.filter(r => r.stage === "course");
  const counted = course.filter(r => r.status !== "declined");
  const replies = counted.filter(r => r.status === "submitted");
  const hidden = tooFew(replies, minGroup);
  const seen = hidden ? [] : replies;

  const fuCounted = live.filter(r => r.stage === "followup" && r.status !== "declined" && (r.status === "submitted" || r.opensOn <= today));
  const fuReplies = fuCounted.filter(r => r.status === "submitted");
  const fuHidden = tooFew(fuReplies, minGroup);
  const fuSeen = fuHidden ? [] : fuReplies;
  const used = shares(fuSeen, "used");

  const suitable = shares(seen, "suitable");
  const recommend = shares(seen, "recommend");
  const before = mean(numbers(seen, "confidence_before")), after = mean(numbers(seen, "confidence_after"));
  return {
    asked: counted.length, replies: replies.length, waiting: counted.filter(r => r.status === "open").length, notAttended: course.length - counted.length,
    responseRatePct: pct(replies.length, counted.length), hidden,
    overall: mean(numbers(seen, "overall")), suitablePct: suitable.length ? shareOf(suitable, "yes") : null, recommendPct: recommend.length ? shareOf(recommend, "yes") : null,
    suitable, level: shares(seen, "level"), length: shares(seen, "length"), expectUse: shares(seen, "expect_use"), barriers: shares(seen, "barriers"),
    sections: sectionScores(seen), confidenceBefore: before, confidenceAfter: after, confidenceGain: before !== null && after !== null ? round(after - before, 2) : null,
    // a safety concern is counted whether or not there are enough replies to show the rest
    safetyConcerns: [...replies, ...fuReplies].filter(r => r.answers?.safety === "yes").length,
    followUp: {
      asked: fuCounted.length, replies: fuReplies.length, hidden: fuHidden,
      usedPct: used.length ? shareOf(used, "often", "sometimes") : null, used,
      prepared: mean(numbers(fuSeen, "fu-prepared")), difference: mean(numbers(fuSeen, "fu-difference")), confidenceNow: mean(numbers(fuSeen, "confidence_now")),
      refresherPct: used.length ? shareOf(shares(fuSeen, "refresher"), "yes") : null, barriers: shares(fuSeen, "barriers"),
    },
  };
}

export const VERDICT_LABEL: Record<VerdictKey, string> = { review: "Review needed", watch: "Keep an eye on it", suitable: "Suitable", too_few: "Not enough replies" };

export function verdict(sum: Summary, minGroup: number): Verdict {
  const need = Math.max(minGroup, 3);
  const make = (key: VerdictKey, reasons: string[]): Verdict => ({ key, label: VERDICT_LABEL[key], reasons });
  if (sum.replies < need) return make("too_few", [`${sum.replies} ${sum.replies === 1 ? "reply" : "replies"} so far. A rating needs at least ${need}.`]);
  const review: string[] = [], watch: string[] = [];
  const f = (n: number) => n.toFixed(1);
  const relevance = sum.sections.find(s => s.key === "suitability");
  if (relevance && relevance.average < THRESHOLDS.reviewScore) review.push(`${relevance.label} scores ${f(relevance.average)} out of 5`);
  if (sum.overall !== null && sum.overall < THRESHOLDS.reviewScore) review.push(`Overall rating is ${f(sum.overall)} out of 5`);
  else if (sum.overall !== null && sum.overall < THRESHOLDS.watchScore) watch.push(`Overall rating is ${f(sum.overall)} out of 5`);
  const notSuitable = shareOf(sum.suitable, "no");
  if (notSuitable >= THRESHOLDS.reviewNotSuitablePct) review.push(`${notSuitable}% say it did not meet what they need for their job`);
  else if (sum.suitablePct !== null && sum.suitablePct < THRESHOLDS.watchSuitablePct) watch.push(`Only ${sum.suitablePct}% say it fully met what they need for their job`);
  for (const s of sum.sections) {
    if (s.key === "suitability" && s.average < THRESHOLDS.reviewScore) continue;
    if (s.average < THRESHOLDS.watchScore) watch.push(`${s.label} scores ${f(s.average)} out of 5`);
  }
  for (const [list, word] of [[sum.level, "level"], [sum.length, "length"]] as const) {
    const off = list.filter(x => x.value !== "about_right").sort((a, b) => b.count - a.count);
    const total = off.reduce((a, x) => a + x.pct, 0);
    if (total >= THRESHOLDS.watchLevelPct) watch.push(`${total}% say the ${word} was not right (mostly ${off[0].value.replace("_", " ")})`);
  }
  if (sum.confidenceAfter !== null && sum.confidenceAfter < THRESHOLDS.watchScore) watch.push(`Confidence after the training is ${f(sum.confidenceAfter)} out of 5`);
  const fu = sum.followUp;
  if (!fu.hidden && fu.replies >= need) {
    if (fu.prepared !== null && fu.prepared < THRESHOLDS.reviewScore) review.push(`At follow-up, preparation for the job scores ${f(fu.prepared)} out of 5`);
    else if (fu.prepared !== null && fu.prepared < THRESHOLDS.watchScore) watch.push(`At follow-up, preparation for the job scores ${f(fu.prepared)} out of 5`);
    const irrelevant = shareOf(fu.used, "not_relevant");
    if (irrelevant >= THRESHOLDS.reviewNotRelevantPct) review.push(`At follow-up, ${irrelevant}% say it is not relevant to their work`);
  }
  if (sum.hidden) return make("too_few", ["Replies are held back until there are enough of them."]);
  if (review.length) return make("review", [...review, ...watch]);
  if (watch.length) return make("watch", watch);
  return make("suitable", ["Every measure is at or above the level expected"]);
}

export interface QuestionResult { section: string; text: string; average: number; favourablePct: number; answers: number; notApplicable: number }
/** Each rated statement on its own, matched on its wording so that a reworded statement is not mixed with the old one. */
export function questionResults(rows: Row[], minGroup: number): QuestionResult[] {
  const replies = rows.filter(r => r.status === "submitted");
  const m = new Map<string, { section: string; text: string; xs: number[]; na: number }>();
  for (const stage of ["course", "followup"] as const) {
    const these = replies.filter(r => r.stage === stage);
    if (tooFew(these, minGroup)) continue;
    for (const r of these) for (const sec of r.form?.sections ?? []) for (const q of sec.questions) {
      if (q.kind !== "rating") continue;
      const v = r.answers?.[q.key];
      if (v === undefined) continue;
      const k = `${sec.key}\n${q.text}`;
      const entry = m.get(k) ?? { section: sec.key, text: q.text, xs: [], na: 0 };
      if (v === NA) entry.na++; else if (typeof v === "number") entry.xs.push(v);
      m.set(k, entry);
    }
  }
  const order = [...SECTION_KEYS, "followup"] as string[];
  return Array.from(m.values()).filter(e => e.xs.length)
    .map(e => ({ section: SECTION_LABEL[e.section as keyof typeof SECTION_LABEL] ?? e.section, key: e.section, text: e.text, average: mean(e.xs)!, favourablePct: pct(e.xs.filter(x => x >= 4).length, e.xs.length)!, answers: e.xs.length, notApplicable: e.na }))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key) || a.average - b.average)
    .map(({ key: _key, ...rest }) => rest);
}

export interface Comment { kind: string; text: string; month: string; course: string; provider: string | null; name: string | null }
/** Written comments. Safety concerns are not listed here: they have their own list for the people who follow them up. */
export function comments(rows: Row[], minGroup: number, canSeeNames: boolean): Comment[] {
  const out: Array<Comment & { id: string }> = [];
  for (const stage of ["course", "followup"] as const) {
    const these = rows.filter(r => r.stage === stage && r.status === "submitted");
    if (tooFew(these, minGroup)) continue;
    for (const r of these) {
      const known = new Set(r.form ? allQuestions(r.form).map(q => q.key) : []);
      for (const key of TEXT_KEYS) {
        if (key === "safety_details" || !known.has(key)) continue;
        const text = r.answers?.[key];
        if (typeof text === "string" && text) out.push({ id: `${r.id}:${key}`, kind: key, text, month: r.completedOn.slice(0, 7), course: r.courseTitle, provider: r.providerName, name: canSeeNames && r.named ? r.userName ?? null : null });
      }
    }
  }
  // newest month first, then in no meaningful order, so the order of arrival does not point to a person
  return out.sort((a, b) => b.month.localeCompare(a.month) || a.id.localeCompare(b.id)).map(({ id: _id, ...c }) => c);
}

export const GROUPS = ["course", "formType", "provider", "instructor", "venue", "jobRole", "category", "quarter"] as const;
export type GroupBy = typeof GROUPS[number];
const quarterOf = (day: string) => `${day.slice(0, 4)} Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}`;
export function groupKey(r: Row, by: GroupBy): string | null {
  if (by === "course") return r.courseKey;
  if (by === "formType") return r.formType;
  if (by === "provider") return r.providerName;
  if (by === "instructor") return r.instructor;
  if (by === "venue") return r.venueName;
  if (by === "jobRole") return r.jobRoleName;
  if (by === "category") return r.categoryName;
  return quarterOf(r.completedOn);
}

export function grouped(rows: Row[], by: GroupBy, minGroup: number, today: string): Array<{ key: string; label: string; summary: Summary; verdict: Verdict }> {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = groupKey(r, by);
    if (!k) continue;
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return Array.from(m.entries()).map(([key, these]) => {
    const summary = summarise(these, minGroup, today);
    return { key, label: by === "course" ? these[these.length - 1].courseTitle : key, summary, verdict: verdict(summary, minGroup) };
  }).filter(g => g.summary.asked > 0 || g.summary.followUp.replies > 0);
}
