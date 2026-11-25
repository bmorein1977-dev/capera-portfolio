// Training course evaluations: what a candidate is asked after attending a course, and the rules the server and the browser share.
//
// There are four forms, one for each kind of delivery. They have the same six rated sections, so courses can be compared, but the statements in
// the delivery, practice and arrangements sections differ: an e-learning module is not judged on its instructor, and a practical course is.
// A short follow-up some weeks later asks whether the training has been of use at work.
//
// An administrator can reword, add and remove the rated statements. The remaining questions (confidence, level, length, suitability, safety,
// overall) are fixed because the suitability rating is worked out from them. Each submitted evaluation keeps a copy of the form as it was asked.
import { z } from "zod";

export const FORM_TYPES = ["elearning", "practical", "classroom", "ojt"] as const;
export type FormType = typeof FORM_TYPES[number];
export const FORM_TYPE_LABEL: Record<FormType, string> = {
  elearning: "E-learning", practical: "Practical technical course", classroom: "Classroom or virtual course", ojt: "On-the-job training",
};
export type Stage = "course" | "followup";

export const SECTION_KEYS = ["suitability", "content", "delivery", "practice", "environment", "assessment"] as const;
export type SectionKey = typeof SECTION_KEYS[number];
/** the name a section is reported under, whatever the kind of course */
export const SECTION_LABEL: Record<SectionKey | "followup", string> = {
  suitability: "Relevance to the job", content: "Objectives and content", delivery: "Delivery", practice: "Practice and activities",
  environment: "Arrangements and access", assessment: "Assessment and feedback", followup: "Use at work",
};
/** the heading the candidate sees, which says what the section is about for this kind of course */
export const SECTION_TITLE: Record<FormType, Record<SectionKey, string>> = {
  elearning: { suitability: "Relevance to your job", content: "Objectives and content", delivery: "The online learning", practice: "Activities and interaction", environment: "Access and technology", assessment: "Knowledge checks and feedback" },
  practical: { suitability: "Relevance to your job", content: "Objectives and content", delivery: "Instructor and teaching", practice: "Hands-on practice and equipment", environment: "Booking, venue and facilities", assessment: "Assessment and feedback" },
  classroom: { suitability: "Relevance to your job", content: "Objectives and content", delivery: "Instructor and teaching", practice: "Exercises and materials", environment: "Booking, venue and joining", assessment: "Assessment and feedback" },
  ojt: { suitability: "Relevance to your job", content: "Objectives and content", delivery: "Your coach", practice: "Practice under supervision", environment: "Time and arrangements", assessment: "Checking and feedback" },
};

export interface Statement { key: string; text: string }
export type SectionStatements = Record<SectionKey, Statement[]>;

const s = (prefix: string, ...texts: string[]): Statement[] => texts.map((text, i) => ({ key: `${prefix}-${i + 1}`, text }));

const RELEVANCE = [
  "The training was relevant to the work I do",
  "It was pitched at the right level for my experience",
  "It came at the right time for me",
  "I can use what I learned in my job",
];

export const DEFAULT_STATEMENTS: Record<FormType, SectionStatements> = {
  elearning: {
    suitability: s("es", ...RELEVANCE),
    content: s("ec",
      "The objectives were clear from the start",
      "The module met its objectives",
      "The content was accurate and up to date",
      "The content matched the procedures and standards used where I work",
      "The material was set out in a logical order"),
    delivery: s("ed",
      "Explanations were clear and easy to follow",
      "I could go at my own pace and go back over anything I needed to",
      "Pictures, video and audio helped me understand",
      "Text, audio and captions were easy to read and hear"),
    practice: s("ep",
      "The activities and scenarios made me think about real situations",
      "The interactive parts held my attention",
      "The module did more than ask me to click through pages"),
    environment: s("ee",
      "It was easy to find and start the module",
      "It worked properly on the device I used",
      "My progress was saved and recorded correctly",
      "I had suitable time and somewhere suitable to complete it",
      "I knew where to get help if I was stuck"),
    assessment: s("ea",
      "The questions tested what the module had taught",
      "The feedback on my answers helped me learn"),
  },
  practical: {
    suitability: s("ps", ...RELEVANCE),
    content: s("pc",
      "The objectives were clear from the start",
      "The course met its objectives",
      "The content was accurate and up to date",
      "The methods taught matched the procedures and standards used where I work",
      "Theory and practical work supported each other"),
    delivery: s("pd",
      "The instructor knew the subject and had practical experience of it",
      "The instructor explained and demonstrated clearly",
      "The instructor made it easy to ask questions",
      "The instructor gave each learner enough attention"),
    practice: s("pp",
      "I had enough hands-on practice",
      "The equipment and tools were like those I use at work",
      "The equipment was in good condition and there was enough of it",
      "The practical exercises were realistic",
      "Safety briefings, controls and supervision during practical work were good",
      "The number of learners was right for the practical work"),
    environment: s("pe",
      "Booking and joining instructions were clear and arrived in good time",
      "I was told what to bring and what I needed to know beforehand",
      "The venue and facilities were suitable",
      "Protective equipment was suitable and available"),
    assessment: s("pa",
      "The assessment reflected what was taught and practised",
      "The assessment was carried out fairly",
      "I was given useful feedback on how I did"),
  },
  classroom: {
    suitability: s("cs", ...RELEVANCE),
    content: s("cc",
      "The objectives were clear from the start",
      "The course met its objectives",
      "The content was accurate and up to date",
      "The content matched the procedures and standards used where I work",
      "The course was set out in a logical order"),
    delivery: s("cd",
      "The instructor knew the subject well",
      "The instructor explained things clearly",
      "There was time for questions and discussion",
      "The instructor used examples that meant something in my work"),
    practice: s("cp",
      "Exercises and discussion helped me apply the learning",
      "Course materials were clear and useful to keep",
      "The size of the group was right"),
    environment: s("ce",
      "Booking and joining instructions were clear and arrived in good time",
      "The room, or the online meeting, worked well",
      "I could see and hear everything I needed to",
      "Breaks and timings were suitable"),
    assessment: s("ca",
      "Any test or check reflected what was taught",
      "I knew how well I had done and what to work on"),
  },
  ojt: {
    suitability: s("os", ...RELEVANCE),
    content: s("oc",
      "I knew what I was expected to be able to do by the end",
      "The training covered what I needed",
      "I was taught the approved procedure rather than shortcuts"),
    delivery: s("od",
      "My coach knew the task well",
      "My coach explained and showed the task clearly",
      "My coach was patient and made it easy to ask questions",
      "My coach had enough time for me"),
    practice: s("op",
      "I had enough opportunity to practise under supervision",
      "I practised on the equipment and in the conditions I will work in",
      "Risks were explained and controlled while I was learning",
      "I was not asked to work alone before I was ready"),
    environment: s("oe",
      "Time was set aside for the training and work pressure did not crowd it out",
      "The training was planned rather than left to chance",
      "Procedures and reference material were available when I needed them"),
    assessment: s("oa",
      "My progress was checked as I went",
      "I was given useful feedback on how I did",
      "What I had covered was recorded"),
  },
};

// ------------------------------------------------------------------------------------------------------------ the questions as asked

export interface Option { value: string; label: string }
export type Kind = "rating" | "confidence" | "stars" | "choice" | "multi" | "text";
export interface Question {
  key: string; text: string; kind: Kind; required: boolean;
  options?: Option[];
  /** only asked, and then required, when another question has this answer */
  onlyIf?: { key: string; value: string };
  help?: string;
}
export interface FormSection { key: string; title: string; questions: Question[] }
export interface EvaluationForm { formType: FormType; stage: Stage; sections: FormSection[] }

export const AGREE_LABELS = ["Strongly disagree", "Disagree", "Neither", "Agree", "Strongly agree"];
export const CONFIDENCE_LABELS = ["Not at all", "A little", "Fairly", "Very", "Completely"];
export const OVERALL_LABELS = ["Very poor", "Poor", "Fair", "Good", "Excellent"];
export const NA = "na";

const o = (...pairs: Array<[string, string]>): Option[] => pairs.map(([value, label]) => ({ value, label }));
export const SUITABLE_OPTIONS = o(["yes", "Yes"], ["partly", "Partly"], ["no", "No"]);
export const LEVEL_OPTIONS = o(["too_basic", "Too basic"], ["about_right", "About right"], ["too_advanced", "Too advanced"]);
export const LENGTH_OPTIONS = o(["too_short", "Too short"], ["about_right", "About right"], ["too_long", "Too long"]);
export const RECOMMEND_OPTIONS = o(["yes", "Yes"], ["unsure", "Not sure"], ["no", "No"]);
export const EXPECT_USE_OPTIONS = o(["month", "Within a month"], ["quarter", "Within three months"], ["later", "Later than that"], ["never", "I do not expect to"]);
export const USED_OPTIONS = o(["often", "Yes, often"], ["sometimes", "Yes, a few times"], ["no_chance", "Not yet: no opportunity"], ["not_confident", "Not yet: I do not feel ready"], ["not_relevant", "No: it is not relevant to my work"]);
export const REFRESHER_OPTIONS = o(["no", "No"], ["unsure", "Not sure"], ["yes", "Yes"]);
export const YES_NO = o(["no", "No"], ["yes", "Yes"]);
export const BARRIER_OPTIONS = o(
  ["none", "Nothing is in the way"], ["opportunity", "No opportunity to use it yet"], ["equipment", "The equipment I use is different"],
  ["procedures", "Site procedures are different"], ["practice", "I need more practice"], ["time", "Not enough time"],
  ["support", "Not enough support from my team or supervisor"], ["other", "Something else"]);

const TEXT_MAX = 2000;
const q = (key: string, text: string, kind: Kind, extra: Partial<Question> = {}): Question => ({ key, text, kind, required: kind !== "text", ...extra });

const safetySection = (when: Stage): FormSection => ({
  key: "safety", title: "Safety",
  questions: [
    q("safety", when === "course" ? "Did anything in this training raise a safety concern?" : "Since the training, has anything about what you were taught raised a safety concern?", "choice",
      { options: YES_NO, help: "If something is dangerous now, report it straight away in the usual way. Do not rely on this form." }),
    q("safety_details", "What was the concern?", "text", { required: true, onlyIf: { key: "safety", value: "yes" } }),
  ],
});

export function buildForm(formType: FormType, stage: Stage, statements: Record<FormType, SectionStatements> = DEFAULT_STATEMENTS): EvaluationForm {
  if (stage === "followup") {
    return {
      formType, stage, sections: [
        { key: "followup", title: "Using the training at work", questions: [
          q("used", "Have you used what you learned in your work?", "choice", { options: USED_OPTIONS }),
          q("fu-prepared", "The training prepared me well enough to do this at work", "rating"),
          q("fu-difference", "The training has made a difference to how I do my work", "rating"),
          q("confidence_now", "How confident are you now in doing what the training covered?", "confidence"),
          q("barriers", "Is anything getting in the way of using it? Choose all that apply.", "multi", { options: BARRIER_OPTIONS }),
          q("refresher", "Do you need further or refresher training on it?", "choice", { options: REFRESHER_OPTIONS }),
          q("missing", "Is there anything you have needed at work that the training did not cover?", "text"),
        ] },
        safetySection(stage),
      ],
    };
  }
  const rated = (key: SectionKey): FormSection => ({ key, title: SECTION_TITLE[formType][key], questions: statements[formType][key].map(st => q(st.key, st.text, "rating")) });
  return {
    formType, stage, sections: [
      ...SECTION_KEYS.map(rated).filter(sec => sec.questions.length > 0),
      { key: "level", title: "Level and length", questions: [
        q("level", "How was the level?", "choice", { options: LEVEL_OPTIONS }),
        q("length", formType === "elearning" ? "How was the time it took?" : "How was the length?", "choice", { options: LENGTH_OPTIONS }),
      ] },
      { key: "learning", title: "What you learned", questions: [
        q("confidence_before", "Before the training, how confident were you in what it covers?", "confidence"),
        q("confidence_after", "How confident are you now?", "confidence"),
        q("expect_use", "When do you expect to use it at work?", "choice", { options: EXPECT_USE_OPTIONS }),
        q("barriers", "Is anything likely to get in the way of using it? Choose all that apply.", "multi", { options: BARRIER_OPTIONS }),
      ] },
      safetySection(stage),
      { key: "overall", title: "Overall", questions: [
        q("overall", "Overall, how would you rate this training?", "stars"),
        q("suitable", "Did it meet what you need for your job?", "choice", { options: SUITABLE_OPTIONS }),
        q("recommend", "Would you recommend it to a colleague in a similar job?", "choice", { options: RECOMMEND_OPTIONS }),
        q("best", "What was most useful?", "text"),
        q("improve", "What should be changed or improved?", "text"),
        q("further", "What further training or support do you need?", "text"),
      ] },
    ],
  };
}

export const allQuestions = (form: EvaluationForm): Question[] => form.sections.flatMap(sec => sec.questions);
export const TEXT_KEYS = ["best", "improve", "further", "missing", "safety_details"] as const;
export const TEXT_LABEL: Record<string, string> = { best: "Most useful", improve: "Should change", further: "Further training or support", missing: "Not covered", safety_details: "Safety concern" };

export type AnswerValue = number | string | string[];
export type Answers = Record<string, AnswerValue>;

const asked = (question: Question, answers: Answers) => !question.onlyIf || answers[question.onlyIf.key] === question.onlyIf.value;

/** Keeps only answers that fit the form, and lists the required questions still unanswered. Nothing else a browser sends is kept. */
export function checkAnswers(form: EvaluationForm, input: unknown): { answers: Answers; missing: Array<{ key: string; text: string }> } {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const answers: Answers = {};
  const scale = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5 ? v : undefined);
  for (const question of allQuestions(form)) {
    if (!Object.prototype.hasOwnProperty.call(raw, question.key)) continue;
    const v = raw[question.key];
    let clean: AnswerValue | undefined;
    if (question.kind === "rating") clean = v === NA ? NA : scale(v);
    else if (question.kind === "confidence" || question.kind === "stars") clean = scale(v);
    else if (question.kind === "choice") clean = typeof v === "string" && question.options!.some(x => x.value === v) ? v : undefined;
    else if (question.kind === "multi") {
      const picked = Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === "string" && question.options!.some(opt => opt.value === x)))) : [];
      // "nothing is in the way" cannot sit alongside something that is
      const kept = picked.length > 1 ? picked.filter(x => x !== "none") : picked;
      clean = kept.length ? kept : undefined;
    } else clean = typeof v === "string" && v.trim() ? v.trim().slice(0, TEXT_MAX) : undefined;
    if (clean !== undefined) answers[question.key] = clean;
  }
  for (const question of allQuestions(form)) if (!asked(question, answers)) delete answers[question.key];
  const missing = allQuestions(form).filter(x => x.required && asked(x, answers) && answers[x.key] === undefined).map(x => ({ key: x.key, text: x.text }));
  return { answers, missing };
}

// ------------------------------------------------------------------------------------------------------------ settings

export const MAX_STATEMENTS = 12;
const statementSchema = z.object({ key: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/), text: z.string().trim().min(3).max(200) }).strict();
const sectionStatementsSchema = z.object(Object.fromEntries(SECTION_KEYS.map(k => [k, z.array(statementSchema).max(MAX_STATEMENTS)])) as Record<SectionKey, z.ZodArray<typeof statementSchema>>).strict()
  .refine(v => v.suitability.length > 0, { message: "Keep at least one statement about relevance to the job: the suitability rating uses it" });

export const settingsSchema = z.object({
  enabled: z.boolean(),
  /** completions before this day are never asked about */
  startFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowDays: z.number().int().min(3).max(180),
  reminderEveryDays: z.number().int().min(1).max(60),
  maxReminders: z.number().int().min(0).max(10),
  /** days after the course before the follow-up opens; 0 switches the follow-up off */
  followUpDays: z.number().int().min(0).max(365),
  showNames: z.boolean(),
  /** with names not shown, results are held back until a group has at least this many replies */
  minGroup: z.number().int().min(1).max(20),
  /** a course that should use a different form from the one worked out for it, or none at all, keyed by training id */
  courseForms: z.record(z.string().max(64), z.enum([...FORM_TYPES, "none"])),
  statements: z.object(Object.fromEntries(FORM_TYPES.map(t => [t, sectionStatementsSchema])) as Record<FormType, typeof sectionStatementsSchema>).strict(),
}).strict();
export type EvaluationSettings = z.infer<typeof settingsSchema>;

export const defaultSettings = (today: string): EvaluationSettings => ({
  enabled: true, startFrom: today, windowDays: 30, reminderEveryDays: 7, maxReminders: 3, followUpDays: 90, showNames: false, minGroup: 3, courseForms: {},
  statements: DEFAULT_STATEMENTS,
});

/** What the candidate is told about their name before they answer. The same words are used on the form and checked on submission. */
export const privacyStatement = (showNames: boolean) => showNames
  ? "Your name is shown with your answers to the people who manage training evaluations."
  : "Your name is not shown with your answers in results or reports. Capera keeps a link between you and your reply so it knows you have replied. A comment can still identify you if you name yourself or describe something only you would know. If you report a safety concern, your name is shown with that concern so it can be followed up.";

/** Which form fits a course: the administrator's choice for it first, then how it was actually delivered. */
export function formTypeFor(args: { override?: FormType | "none"; viaElearning?: boolean; trainingSource?: string | null; modality?: string | null }): FormType | "none" {
  if (args.override) return args.override;
  if (args.viaElearning) return "elearning";
  const modality = (args.modality ?? "").toLowerCase();
  if (/e-?learning|self.?paced/.test(modality)) return "elearning";
  const source = (args.trainingSource ?? "").trim().toUpperCase();
  if (/online|virtual|remote|webinar/.test(modality)) return "classroom";
  if (source === "OJT") return "ojt";
  if (source === "TC") return "practical";
  if (source === "E") return "elearning";
  return "classroom";
}

export const REVIEW_DECISIONS = ["keep", "improve", "change_provider", "replace", "withdraw"] as const;
export type ReviewDecision = typeof REVIEW_DECISIONS[number];
export const REVIEW_DECISION_LABEL: Record<ReviewDecision, string> = {
  keep: "Suitable: keep as it is", improve: "Keep, with changes agreed", change_provider: "Change provider or instructor", replace: "Replace with another course", withdraw: "Stop using it",
};
export const reviewSchema = z.object({
  courseKey: z.string().min(1).max(80),
  decision: z.enum(REVIEW_DECISIONS),
  note: z.string().trim().min(5).max(2000),
  nextReviewOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).strict();
