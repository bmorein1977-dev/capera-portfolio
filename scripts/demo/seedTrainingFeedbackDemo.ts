/**
 * Adds sample course feedback to the fictional demo company, so Training Evaluations has something to show: about a year of replies on eight courses
 * that between them show every rating, follow-ups, two safety concerns (one open, one dealt with), a recorded course decision, and requests still
 * waiting, including some for the two team members offered under Switch User so the forms can be filled in during a demonstration.
 * Everything in it is invented: the people are the demo company's own, and the instructors and comments are made up.
 * Run after seedCleanDemo.ts and after applying migrations/0058_training_evaluations.sql.
 *
 *   npx tsx scripts/demo/seedTrainingFeedbackDemo.ts            (add; does nothing if it is already there)
 *   npx tsx scripts/demo/seedTrainingFeedbackDemo.ts --reset    (remove the sample feedback and add it again with today's dates)
 *   npx tsx scripts/demo/seedTrainingFeedbackDemo.ts --remove   (remove the sample feedback only)
 *
 * Only the rows this script made are ever removed. No email is sent. Refuses to run unless the database name contains "demo".
 */
import { db, pool } from "../../server/db";
import * as S from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { DbStorage } from "../../server/storage";
import { buildForm, allQuestions, NA, REVIEW_DECISION_LABEL, type Answers, type FormType, type Stage, type SectionKey } from "../../shared/trainingEvaluation";
import { getSettings, today, addDays } from "../../server/services/trainingEvaluations";
import { summarise, verdict, grouped, type Row } from "../../server/services/trainingEvaluationAnalysis";

const dbName = (() => { try { return new URL(process.env.DATABASE_URL || "").pathname.replace(/^\//, ""); } catch { return ""; } })();
if (!/demo/i.test(dbName)) { console.error(`Refusing to run against "${dbName}": database name must contain "demo".`); process.exit(1); }
const RESET = process.argv.includes("--reset"), REMOVE = process.argv.includes("--remove");
const MARK = "sample:"; // every row this script makes carries it
const storage = new DbStorage();

const NORTHGATE = "Northgate Learning Academy", FIELDSTONE = "Fieldstone Safety Training", SUMMIT = "Summit Technical Institute";

interface Profile {
  /** average agreement (1 to 5) for each rated area */
  scores: Record<SectionKey, number>;
  before: number; after: number; overall: number;
  suitable: string[]; level: string[]; length: string[]; recommend: string[]; barriers: string[][];
  /** follow-up: how it has been used, and how well it prepared them */
  used: string[]; prepared: number; difference: number; confidenceNow: number; refresher: string[];
}
const STRONG: Profile = {
  scores: { suitability: 4.4, content: 4.3, delivery: 4.6, practice: 4.4, environment: 4.1, assessment: 4.3 },
  before: 2.4, after: 4.2, overall: 4.5, suitable: ["yes", "yes", "yes", "yes", "yes", "yes", "partly"], level: ["about_right"], length: ["about_right", "about_right", "about_right", "about_right", "too_short"],
  recommend: ["yes"], barriers: [["none"], ["none"], ["opportunity"]], used: ["often", "sometimes", "often", "sometimes", "no_chance"], prepared: 4.3, difference: 4.1, confidenceNow: 4.2, refresher: ["no", "no", "no", "unsure"],
};
const make = (over: Partial<Profile> & { scores?: Partial<Profile["scores"]> }): Profile => ({ ...STRONG, ...over, scores: { ...STRONG.scores, ...(over.scores ?? {}) } });

interface Reply { text?: Partial<Record<"best" | "improve" | "further" | "missing", string>>; safety?: { what: string; closed?: string } }
interface Plan {
  course: string; formType: FormType; provider: string | null; venue: string | null; instructor: string | null; profile: Profile;
  /** how many days ago each reply attended */
  attended: number[];
  /** people asked who did not reply in time */
  silent?: number;
  /** written answers and safety concerns, by the position of the reply */
  words?: Record<number, Reply>; followUpWords?: Record<number, string>;
}

const PLANS: Plan[] = [
  { course: "Confined Space Entry (Entrant)", formType: "practical", provider: FIELDSTONE, venue: "Fieldstone training centre", instructor: "Gemma Ashdown", profile: STRONG, silent: 1,
    attended: [312, 280, 244, 205, 171, 138, 112, 74, 31],
    words: { 1: { text: { best: "Doing the entry and rescue drills in the training vessel, not just talking about them." } }, 4: { text: { best: "The instructor made everyone practise the gas test until they could do it without prompting.", further: "A short refresher on the escape set before the next shutdown." } }, 7: { text: { improve: "Send the pre-course reading a bit earlier." } } },
    followUpWords: { 2: "Our vessel entry paperwork is slightly different from the one used on the course." } },

  { course: "Working at Height Practitioner", formType: "practical", provider: FIELDSTONE, venue: "Fieldstone training centre", instructor: "Martin Keel", profile: make({ scores: { practice: 4.2 } }),
    attended: [298, 232, 186, 143, 96, 47],
    words: { 0: { text: { best: "Plenty of time on the tower and each person had their harness checked and explained." } }, 3: { text: { best: "Realistic rescue exercise." } } } },

  { course: "Working at Height Practitioner", formType: "practical", provider: SUMMIT, venue: "Summit workshop", instructor: "Declan Frost", silent: 2,
    profile: make({ scores: { delivery: 3.7, practice: 2.3, environment: 3.1 }, after: 3.3, overall: 3.2, suitable: ["partly", "yes", "partly", "yes", "partly"], length: ["too_short", "too_short", "about_right"], recommend: ["unsure", "yes", "no"], barriers: [["practice"], ["practice", "equipment"], ["equipment"]], prepared: 3.2, difference: 3.1, confidenceNow: 3.1, refresher: ["yes", "unsure", "no"] }),
    attended: [265, 177, 129, 118, 52],
    words: { 0: { text: { improve: "Twelve of us and one tower. Most of the afternoon was spent waiting." } }, 1: { text: { improve: "More time clipped on and moving, fewer slides." }, safety: { what: "One harness handed out for the practical had a faded inspection tag and I could not tell whether it was in date." } }, 3: { text: { improve: "The anchor points and lanyards were not the type we use on site.", further: "Practice with our own fall arrest equipment." } } },
    followUpWords: { 1: "Moving between anchor points on a pipe rack was not covered." } },

  { course: "Instrument Loop Testing", formType: "practical", provider: SUMMIT, venue: "Summit instrument lab", instructor: "Declan Frost", silent: 1,
    profile: make({ scores: { suitability: 2.6, content: 3.0, delivery: 3.8, practice: 2.8, environment: 3.6, assessment: 3.4 }, before: 2.6, after: 3.1, overall: 2.8, suitable: ["partly", "no", "partly", "yes", "no", "partly", "partly"], level: ["too_basic", "about_right", "too_basic"], recommend: ["no", "unsure", "yes"], barriers: [["equipment", "procedures"], ["equipment"], ["procedures"]], used: ["no_chance", "sometimes", "not_relevant", "not_confident"], prepared: 2.7, difference: 2.4, confidenceNow: 2.8, refresher: ["yes", "yes", "unsure"] }),
    attended: [290, 249, 214, 162, 133, 101, 58],
    words: { 0: { text: { improve: "The training rig used a different kind of transmitter and communicator from ours." } }, 1: { text: { improve: "Pitched at someone who has never opened a loop diagram. We needed fault finding.", further: "Fault finding on the transmitters and positioners we actually have." } }, 4: { text: { improve: "Use our loop check sheet so the method matches site procedure." } }, 5: { text: { best: "A clear explanation of the basics for anyone new to it." } } },
    followUpWords: { 0: "Anything on the communicator we use. I had to learn it from a colleague." } },

  { course: "Basic Site Safety Induction", formType: "elearning", provider: NORTHGATE, venue: "Online", instructor: null, silent: 2,
    profile: make({ scores: { suitability: 4.3, content: 4.2, delivery: 4.2, practice: 3.8, environment: 4.4, assessment: 4.0 }, before: 3.0, after: 4.3, overall: 4.2 }),
    attended: [318, 287, 251, 226, 198, 167, 149, 121, 88, 66, 39, 24],
    words: { 2: { text: { best: "Short sections, so I could do it between jobs without losing my place." } }, 6: { text: { best: "The muster point questions used our own site layout." } }, 9: { text: { improve: "Captions on the second video ran ahead of the speaker." } } } },

  { course: "Process Safety Fundamentals", formType: "elearning", provider: NORTHGATE, venue: "Online", instructor: null, silent: 3,
    profile: make({ scores: { suitability: 4.1, content: 4.0, delivery: 3.7, practice: 3.1, environment: 2.9, assessment: 3.6 }, before: 2.8, after: 3.7, overall: 3.6, suitable: ["yes", "yes", "partly", "yes", "yes", "partly", "yes", "yes"], length: ["too_long", "about_right", "too_long", "about_right"], recommend: ["yes", "unsure", "yes"], barriers: [["none"], ["time"], ["time"]], prepared: 3.8, difference: 3.6, confidenceNow: 3.7 }),
    attended: [301, 238, 190, 154, 126, 97, 61, 28],
    words: { 1: { text: { improve: "It lost my place twice and I had to start module three again." } }, 3: { text: { improve: "Too long to do in one sitting on a shift. Break it into shorter parts.", best: "The incident case study was the part that stuck." } }, 6: { text: { improve: "Would not run properly on the control room computer." } } } },

  { course: "Incident Investigation Techniques", formType: "classroom", provider: SUMMIT, venue: "Summit workshop", instructor: "Priyanka Rao", silent: 1,
    profile: make({ scores: { suitability: 4.2, content: 4.3, delivery: 4.5, practice: 4.1, environment: 3.8, assessment: 3.9 }, before: 2.3, after: 3.9, overall: 4.2 }),
    attended: [272, 209, 158, 115, 68, 35],
    words: { 2: { text: { best: "Working through a whole investigation in small groups." } }, 4: { text: { further: "To sit in on a real investigation with someone experienced." } } } },

  { course: "Control Room Operations", formType: "ojt", provider: NORTHGATE, venue: "Control room", instructor: "Shift coach (sample)",
    profile: make({ scores: { suitability: 4.6, content: 4.2, delivery: 4.4, practice: 4.2, environment: 3.7, assessment: 4.0 }, before: 2.2, after: 3.9, overall: 4.3, barriers: [["none"], ["time"], ["none"]] }),
    attended: [254, 181, 140, 104, 45],
    words: { 1: { text: { best: "Same coach throughout, so nothing was missed between shifts." } }, 2: { text: { improve: "Training was dropped whenever the shift got busy." }, safety: { what: "I was asked to carry out a valve line-up on my own before anyone had signed me off to do it.", closed: "Spoke to the shift team leaders: no trainee carries out a line-up alone until signed off. Added to the training plan and briefed at handover." } } } },

  { course: "Gas Testing Equipment", formType: "practical", provider: SUMMIT, venue: "Summit workshop", instructor: "Martin Keel", profile: STRONG, attended: [43, 19] },
];

/** requests still waiting for a reply: how many days ago each was attended, and by whom */
const WAITING: Array<{ course: string; formType: FormType; provider: string; venue: string; instructor: string | null; daysAgo: number; who: "switch" | "others" }> = [
  { course: "Breathing Apparatus", formType: "practical", provider: FIELDSTONE, venue: "Fieldstone training centre", instructor: "Gemma Ashdown", daysAgo: 3, who: "switch" },
  { course: "Hot Work Awareness", formType: "elearning", provider: NORTHGATE, venue: "Online", instructor: null, daysAgo: 2, who: "switch" },
  { course: "Fire Warden", formType: "practical", provider: NORTHGATE, venue: "Site training room", instructor: "Gemma Ashdown", daysAgo: 6, who: "others" },
];

const at = (day: string, hour = 10) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
// a steady spread of whole numbers whose average is the target, the same every time the script runs
const spread = (target: number, i: number, j = 0) => { const low = Math.floor(target); const part = ((i + 1) * 0.618034 + j * 0.381966) % 1; return Math.max(1, Math.min(5, low + (part < target - low ? 1 : 0))); };
const pick = <T>(list: T[], i: number): T => list[i % list.length];

function answersFor(formType: FormType, stage: Stage, form: ReturnType<typeof buildForm>, p: Profile, i: number, words: Reply | undefined, followUpWord: string | undefined): Answers {
  const a: Answers = {};
  const sectionOf = new Map<string, string>(); for (const s of form.sections) for (const q of s.questions) sectionOf.set(q.key, s.key);
  let j = 0;
  for (const q of allQuestions(form)) {
    j++;
    if (q.onlyIf || q.kind === "text") continue;
    if (q.kind === "rating") {
      const target = stage === "followup" ? (q.key === "fu-prepared" ? p.prepared : p.difference) : p.scores[sectionOf.get(q.key) as SectionKey];
      // now and then a statement does not apply to someone
      a[q.key] = stage === "course" && (i * 7 + j) % 53 === 0 ? NA : spread(target, i, j);
    } else if (q.kind === "confidence") a[q.key] = spread(q.key === "confidence_before" ? p.before : q.key === "confidence_after" ? p.after : p.confidenceNow, i, j);
    else if (q.kind === "stars") a[q.key] = spread(p.overall, i);
    else if (q.kind === "multi") a[q.key] = pick(p.barriers, i);
    else a[q.key] = q.key === "suitable" ? pick(p.suitable, i) : q.key === "level" ? pick(p.level, i) : q.key === "length" ? pick(p.length, i) : q.key === "recommend" ? pick(p.recommend, i)
      : q.key === "expect_use" ? pick(["month", "quarter", "month", "later"], i) : q.key === "used" ? pick(p.used, i) : q.key === "refresher" ? pick(p.refresher, i) : "no";
  }
  if (stage === "course" && words) {
    for (const [k, v] of Object.entries(words.text ?? {})) a[k] = v;
    if (words.safety) { a.safety = "yes"; a.safety_details = words.safety.what; }
  }
  if (stage === "followup" && followUpWord) a.missing = followUpWord;
  return a;
}

async function remove() {
  const gone = await db.execute(sql`delete from training_evaluations where source_ref like ${MARK + "%"} returning id`);
  await db.execute(sql`delete from training_course_reviews where figures->>'sample' = 'true'`);
  return gone.rows.length;
}

async function main() {
  const has = (await db.execute(sql`select to_regclass('public.training_evaluations') t`)).rows[0] as any;
  if (!has.t) throw new Error("The feedback tables are not there yet. Apply migrations/0058_training_evaluations.sql first.");
  if (REMOVE) { console.log(`Removed ${await remove()} sample feedback rows.`); return; }
  const already = Number(((await db.execute(sql`select count(*)::int n from training_evaluations where source_ref like ${MARK + "%"}`)).rows[0] as any).n);
  if (already && !RESET) { console.log(`The sample feedback is already there (${already} rows). Add --reset to rebuild it with today's dates.`); return; }
  if (RESET) await remove();

  const settings = await getSettings();
  const day = today();
  const trainings = new Map((await db.execute(sql`select t.id, t.name, c.name category from trainings t left join training_categories c on c.id = t.category_id`)).rows.map((r: any) => [r.name as string, r]));
  const missing = Array.from(new Set([...PLANS, ...WAITING].map(p => p.course))).filter(n => !trainings.has(n));
  if (missing.length) throw new Error(`These demo courses were not found: ${missing.join(", ")}. Run seedCleanDemo.ts first.`);

  // the same people Switch User offers as team members, so there is something waiting for whoever is chosen in a demonstration
  const all = await storage.getAllUsers();
  const team = all.filter(u => u.role === "candidate" && u.isActive !== false && !u.isArchived && !u.anonymisedAt && u.approvalStatus !== "pending" && /^demo-/.test(u.id) && u.employmentType !== "contractor");
  if (team.length < 20) throw new Error("Too few demo team members were found. Run seedCleanDemo.ts first.");
  const switchUsers = team.slice(0, 2);
  const others = team.slice(2).sort((a, b) => a.id.localeCompare(b.id));
  const roleNames = new Map((await db.select().from(S.jobRoles)).map(r => [r.id, r.name]));

  let cursor = 0;
  const nextPeople = (n: number) => Array.from({ length: n }, () => others[(cursor++ * 7) % others.length]);
  let replies = 0, followUps = 0, waiting = 0;

  const base = (course: string, userId: string, jobRoleId: string | null, formType: FormType, provider: string | null, venue: string | null, instructor: string | null, completedOn: string) => {
    const t: any = trainings.get(course);
    return { userId, trainingId: t.id as string, courseKey: t.id as string, courseTitle: course, categoryName: (t.category as string | null) ?? null, formType, source: "record", sourceRef: `${MARK}${t.id}:${userId}:${completedOn}`,
      providerName: provider, venueName: venue, instructor, jobRoleName: jobRoleId ? roleNames.get(jobRoleId) ?? null : null, completedOn, named: false };
  };
  const add = async (row: typeof S.trainingEvaluations.$inferInsert) => (await db.insert(S.trainingEvaluations).values(row).onConflictDoNothing().returning({ id: S.trainingEvaluations.id })).length;

  let followIndex = 0;
  for (const [n, plan] of Array.from(PLANS.entries())) {
    const people = nextPeople(plan.attended.length + (plan.silent ?? 0));
    for (const [i, ago] of Array.from(plan.attended.entries())) {
      const who = people[i], completedOn = addDays(day, -ago);
      const common = base(plan.course, who.id, who.jobRoleId, plan.formType, plan.provider, plan.venue, plan.instructor, completedOn);
      const form = buildForm(plan.formType, "course", settings.statements);
      const words = plan.words?.[i];
      const sent = addDays(completedOn, 1 + (i % 5)) > day ? day : addDays(completedOn, 1 + (i % 5));
      replies += await add({ ...common, stage: "course", opensOn: completedOn, dueOn: addDays(completedOn, settings.windowDays), status: "submitted", answers: answersFor(plan.formType, "course", form, plan.profile, i + n, words, undefined), form,
        invitedAt: at(completedOn, 17), submittedAt: at(sent), safetyConcern: !!words?.safety, safetyClosedAt: words?.safety?.closed ? at(addDays(sent, 4) > day ? day : addDays(sent, 4)) : null,
        safetyClosedBy: words?.safety?.closed ? "demo-sophie" : null, safetyAction: words?.safety?.closed ?? null });

      // the follow-up, where one is due: answered, still open, not answered, or not yet due
      if (settings.followUpDays <= 0) continue;
      const opensOn = addDays(completedOn, settings.followUpDays), dueOn = addDays(opensOn, settings.windowDays);
      if (opensOn > day) { await add({ ...common, stage: "followup", opensOn, dueOn, status: "open" }); continue; }
      const k = followIndex++;
      const answered = k % 3 !== 2 || !!plan.followUpWords?.[i];
      const followForm = buildForm(plan.formType, "followup", settings.statements);
      if (answered) {
        const when = addDays(opensOn, 2) > day ? day : addDays(opensOn, 2);
        followUps += await add({ ...common, stage: "followup", opensOn, dueOn, status: "submitted", answers: answersFor(plan.formType, "followup", followForm, plan.profile, i, undefined, plan.followUpWords?.[i]), form: followForm, invitedAt: at(opensOn, 8), submittedAt: at(when) });
      } else await add({ ...common, stage: "followup", opensOn, dueOn, status: dueOn < day ? "expired" : "open", invitedAt: dueOn < day ? at(opensOn, 8) : new Date() });
    }
    // asked, and the time to reply has gone
    for (const who of people.slice(plan.attended.length)) {
      const completedOn = addDays(day, -(settings.windowDays + 20 + (who.id.length % 40)));
      await add({ ...base(plan.course, who.id, who.jobRoleId, plan.formType, plan.provider, plan.venue, plan.instructor, completedOn), stage: "course", opensOn: completedOn, dueOn: addDays(completedOn, settings.windowDays), status: "expired", invitedAt: at(completedOn, 17) });
    }
  }

  // someone who says they were not there
  const absent = nextPeople(1)[0];
  await add({ ...base("Fire Warden", absent.id, absent.jobRoleId, "practical", NORTHGATE, "Site training room", "Gemma Ashdown", addDays(day, -12)), stage: "course", opensOn: addDays(day, -12), dueOn: addDays(day, -12 + settings.windowDays), status: "declined",
    declineReason: "I was on nights that week and did not attend. The booking should have been moved.", invitedAt: at(addDays(day, -12), 17) });

  // requests still waiting. They are marked as invited now, so the first reminder is a full interval away
  const otherWaiting = nextPeople(3);
  for (const w of WAITING) {
    for (const who of w.who === "switch" ? switchUsers : otherWaiting) {
      const completedOn = addDays(day, -w.daysAgo);
      const common = base(w.course, who.id, who.jobRoleId, w.formType, w.provider, w.venue, w.instructor, completedOn);
      waiting += await add({ ...common, stage: "course", opensOn: completedOn, dueOn: addDays(day, settings.windowDays - w.daysAgo), status: "open", invitedAt: new Date() });
      if (settings.followUpDays > 0) await add({ ...common, stage: "followup", opensOn: addDays(completedOn, settings.followUpDays), dueOn: addDays(completedOn, settings.followUpDays + settings.windowDays), status: "open" });
    }
  }
  // and a follow-up open for each of the Switch User team members, after training they have already given feedback on
  for (const [i, who] of Array.from(switchUsers.entries())) {
    const completedOn = addDays(day, -(settings.followUpDays > 0 ? settings.followUpDays + 5 : 95) - i);
    const plan = PLANS[0];
    const common = base("Lifting Operations Awareness", who.id, who.jobRoleId, "practical", SUMMIT, "Summit workshop", "Martin Keel", completedOn);
    const form = buildForm("practical", "course", settings.statements);
    replies += await add({ ...common, stage: "course", opensOn: completedOn, dueOn: addDays(completedOn, settings.windowDays), status: "submitted", answers: answersFor("practical", "course", form, plan.profile, i + 2, undefined, undefined), form, invitedAt: at(completedOn, 17), submittedAt: at(addDays(completedOn, 2)) });
    if (settings.followUpDays > 0) waiting += await add({ ...common, stage: "followup", opensOn: addDays(completedOn, settings.followUpDays), dueOn: addDays(day, settings.windowDays - 5), status: "open", invitedAt: new Date() });
  }

  // a decision recorded on the weakest course, with the figures as they stood
  const rows = (await db.select().from(S.trainingEvaluations)).filter(e => e.sourceRef.startsWith(MARK)).map((e): Row => ({
    id: e.id, courseKey: e.courseKey, courseTitle: e.courseTitle, categoryName: e.categoryName, formType: e.formType as FormType, stage: e.stage as Stage, status: e.status, answers: e.status === "submitted" ? (e.answers as Answers) : null,
    form: e.form as any, providerName: e.providerName, venueName: e.venueName, instructor: e.instructor, jobRoleName: e.jobRoleName, completedOn: e.completedOn, opensOn: e.opensOn, named: e.named,
  }));
  const weak: any = trainings.get("Instrument Loop Testing");
  const then = addDays(day, -20);
  const asItStood = summarise(rows.filter(r => r.courseKey === weak.id && r.completedOn <= then), settings.minGroup, then);
  const admin = (await db.select().from(S.users).where(eq(S.users.id, "demo-sophie")))[0];
  await db.insert(S.trainingCourseReviews).values({ courseKey: weak.id, courseTitle: "Instrument Loop Testing", decision: "improve", createdBy: "demo-sophie", createdByName: admin ? [admin.firstName, admin.lastName].filter(Boolean).join(" ") : null, createdAt: at(then),
    note: "Met the provider. They will use our transmitter type and communicator on the rig, follow our loop check sheet, and add a fault finding exercise for experienced technicians. Check the next two courses before booking more.", nextReviewOn: addDays(day, 70),
    figures: { sample: true, rating: verdict(asItStood, settings.minGroup).label, replies: asItStood.replies, asked: asItStood.asked, overall: asItStood.overall, suitablePct: asItStood.suitablePct } });

  console.log(`Sample course feedback added: ${replies} replies, ${followUps} follow-ups answered, ${waiting} requests waiting.`);
  console.log("Course ratings it shows:");
  for (const c of grouped(rows, "course", settings.minGroup, day)) console.log(`  ${c.verdict.label.padEnd(18)} ${c.label} (${c.summary.replies} of ${c.summary.asked} replied)${c.verdict.key === "review" || c.verdict.key === "watch" ? ": " + c.verdict.reasons.slice(0, 2).join("; ") : ""}`);
  console.log(`Course decision recorded on Instrument Loop Testing: ${REVIEW_DECISION_LABEL.improve}.`);
  console.log(`To fill a form in during a demonstration, use Switch User and choose ${switchUsers.map(u => `${u.firstName} ${u.lastName}`).join(" or ")}, then My Course Feedback.`);
}

main().then(() => pool.end()).catch(e => { console.error(e.message ?? e); pool.end().finally(() => process.exit(1)); });
