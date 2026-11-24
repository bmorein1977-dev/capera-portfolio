import { db } from "../db";
import { sql } from "drizzle-orm";
import { listTodo } from "./performance";
import { licensedTier } from "./licence";
import { tierForPath, tierIncludes } from "@shared/licence";
import type { DbStorage } from "../storage";
import { mine as myAnnouncements } from "./announcements";
import { summary as staffingSummary } from "./staffingCompliance";
import { listArchived } from "./retention";
import { emailStatus } from "./notifications";

// The home screen. One "briefing" per kind of person: what matters to them, worked out on the server from their roles so that nobody
// is ever sent figures that belong to someone else's job. The page (client/src/pages/Briefing.tsx) only draws what it is given.
// The figures come from the same engines as the rest of Capera (compliance overview, skills gap, training compliance, compliance
// explorer), so a number on the home screen always matches the screen it links to.

export type Severity = "critical" | "warning" | "good" | "info";
export type Tone = "good" | "warning" | "serious" | "critical" | "neutral";
export interface Hero { label: string; value: number; unit: "%" | ""; caption: string; severity: Severity; href?: string }
export interface Attention { id: string; label: string; count: number; severity: Severity; href: string; hint?: string }
export interface Kpi { id: string; label: string; value: number | string; caption?: string; severity?: Severity; href?: string }
export interface Meter { id: string; label: string; current: number; total: number; pct: number; href?: string; caption?: string }
export interface Segmented { id: string; title: string; subtitle?: string; parts: Array<{ key: string; label: string; value: number; tone: Tone }>; href?: string }
export interface BarList { id: string; title: string; subtitle?: string; items: Array<{ label: string; value: number; tone: Tone }> }
export interface Rows { id: string; title: string; empty: string; href?: string; rows: Array<{ primary: string; secondary?: string; tag?: { text: string; tone: Tone }; href?: string }> }
export interface Shortcut { label: string; href: string; icon: string }
// the assessment plan: the stages an assessment passes through, a month-by-month view of what is booked against what is due, and what to do next
export interface PlanAction { kind: "schedule" | "ready"; label: string; assessmentId?: string; candidateId?: string; elementId?: string; current?: string | null; subject: string }
export interface PlanRow { primary: string; secondary?: string; tag?: { text: string; tone: Tone }; href?: string; action?: PlanAction }
export interface Plan {
  title: string; subtitle: string; href: string; horizonMonths: number;
  stages: Array<{ key: string; label: string; value: number; tone: Tone; hint: string }>;
  timeline: Array<{ label: string; booked: number; due: number }>;
  rows: { id: string; title: string; empty: string; href?: string; rows: PlanRow[] };
}

export type Persona = "worker" | "assessor" | "verifier" | "external" | "contractor" | "manager" | "admin" | "super_admin" | "developer";
export interface Briefing {
  persona: Persona; personaLabel: string; name: string; headline: string; generatedAt: string;
  hero: Hero | null; plan: Plan | null; horizonOptions: number[]; attention: Attention[]; kpis: Kpi[]; meters: Meter[]; segments: Segmented[]; bars: BarList[]; lists: Rows[]; shortcuts: Shortcut[];
  fullView?: { label: string; href: string }; also: string[];
}

// the order decides which briefing someone gets when they hold several roles: the most senior wins
const PERSONA_ORDER: Array<{ role: string; persona: Persona; label: string }> = [
  { role: "developer", persona: "developer", label: "Developer" }, { role: "super_admin", persona: "super_admin", label: "Super administrator" },
  { role: "admin", persona: "admin", label: "Administrator" }, { role: "manager", persona: "manager", label: "Manager" },
  { role: "internal_verifier", persona: "verifier", label: "Internal verifier" }, { role: "assessor", persona: "assessor", label: "Assessor" },
  { role: "external_verifier", persona: "external", label: "External verifier" }, { role: "contractor_admin", persona: "contractor", label: "Contractor administrator" },
  { role: "candidate", persona: "worker", label: "Team member" }, { role: "trainee", persona: "worker", label: "Team member" },
];
const HAS_OWN_RECORD = new Set(["worker", "assessor", "verifier", "manager"]); // people who have a job role, training and competence of their own

// green from 90, amber from 75, red below. One rule for every percentage on the home screen.
export const tone = (pct: number): Severity => (pct >= 90 ? "good" : pct >= 75 ? "warning" : "critical");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const first = (u: { firstName: string | null; lastName: string | null; email: string | null }) => u.firstName?.trim() || u.email?.split("@")[0] || "there";
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const fmtDay = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as any[];
const num = async (q: ReturnType<typeof sql>) => Number((await rows(q))[0]?.n ?? 0);

let overviewCache: { at: number; value: any } | null = null;
async function orgOverview(storage: DbStorage) {
  if (overviewCache && Date.now() - overviewCache.at < 60_000) return overviewCache.value;
  const value = await storage.getComplianceOverview();
  overviewCache = { at: Date.now(), value };
  return value;
}

const split = (b: { current: number; expiring: number; expired: number; missing: number }): Segmented["parts"] => [
  { key: "current", label: "Current", value: b.current, tone: "good" }, { key: "expiring", label: "Expiring within 90 days", value: b.expiring, tone: "warning" },
  { key: "expired", label: "Expired", value: b.expired, tone: "critical" }, { key: "missing", label: "Not yet achieved", value: b.missing, tone: "serious" },
];

// ------------------------------------------------------------------------------------------------------------- your own record

async function ownRecord(storage: DbStorage, userId: string) {
  const [skills, training] = await Promise.all([storage.getSkillsGapAnalysis(userId).catch(() => null), storage.getTrainingComplianceStatus(userId).catch(() => null)]);
  const c = skills?.statistics, t = training?.statistics;
  return { has: !!(c || t), c, t, skills, training };
}

function ownMeters(r: Awaited<ReturnType<typeof ownRecord>>, prefix = "own"): Meter[] {
  const out: Meter[] = [];
  if (r.c) out.push({ id: `${prefix}-competence`, label: "Your competence", current: r.c.current, total: r.c.totalRequired, pct: pct(r.c.current, r.c.totalRequired), href: "/skills-gap", caption: "required competence that is current" });
  if (r.t) out.push({ id: `${prefix}-training`, label: "Your training", current: r.t.current, total: r.t.totalRequired, pct: pct(r.t.current, r.t.totalRequired), href: "/my-training", caption: "required training that is current" });
  return out;
}

// ------------------------------------------------------------------------------------------------------------- assessment planning

// How far ahead the plan looks is the person's choice (months, or 0 for no limit). Nothing is cut off at a fixed date.
export const HORIZON_OPTIONS = [3, 6, 12, 24, 36, 0];
export const DEFAULT_HORIZON = 12;
const horizonText = (months: number) => (months === 0 ? "at any date" : `in the next ${months} months`);

/**
 * Competence that will need reassessing, with nothing arranged: the latest valid assessment of each element the person's job role
 * requires, where it has expired or expires within the chosen look-ahead, and no assessment is already open for that element.
 */
async function reassessmentsDue(scope: ReturnType<typeof sql>, horizonMonths: number) {
  const within = horizonMonths > 0 ? sql`and t.expiry_date < now() + make_interval(months => ${horizonMonths}::int)` : sql``;
  return rows(sql`select t.* from (
      select distinct on (a.candidate_id, a.element_id) a.candidate_id, a.element_id, a.expiry_date, ce.name, u.first_name, u.last_name
      from assessments a join users u on u.id = a.candidate_id join competency_elements ce on ce.id = a.element_id
      where ${scope} and a.is_active and not coalesce(a.is_assignment, false) and a.outcome in ('competent', 'competent_with_minor_needs') and a.expiry_date is not null
        and coalesce(u.is_active, true) and (not coalesce(u.is_archived, false) or u.left_at > now())
        and exists (select 1 from role_elements re where re.element_id = a.element_id and re.is_active and coalesce(re.required, true) and re.role_id in (u.job_role_id, u.secondary_job_role_id))
      order by a.candidate_id, a.element_id, a.expiry_date desc) t
    where not exists (select 1 from assessments o where o.candidate_id = t.candidate_id and o.element_id = t.element_id and o.is_active and o.sign_off_at is null) ${within}
    order by t.expiry_date limit 500`);
}

/** Month by month from now to the last month that has anything in it: what is booked, and what is due but not yet planned. */
function buildTimeline(booked: Date[], due: Date[]): Plan["timeline"] {
  const now = new Date();
  const idx = (d: Date) => (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
  const cells = new Map<number, { booked: number; due: number }>();
  const bump = (i: number, k: "booked" | "due") => { const c = cells.get(i) ?? { booked: 0, due: 0 }; c[k]++; cells.set(i, c); };
  booked.forEach(d => bump(Math.max(0, idx(d)), "booked"));
  due.filter(d => d >= now).forEach(d => bump(idx(d), "due"));
  const expired = due.filter(d => d < now).length;
  const last = Math.min(60, Math.max(0, ...Array.from(cells.keys())));
  const out: Plan["timeline"] = expired ? [{ label: "Already expired", booked: 0, due: expired }] : [];
  for (let i = 0; i <= last; i++) out.push({ label: new Date(now.getFullYear(), now.getMonth() + i, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }), ...(cells.get(i) ?? { booked: 0, due: 0 }) });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------- worker

async function worker(storage: DbStorage, userId: string, b: Briefing, h: number) {
  const r = await ownRecord(storage, userId);
  const cc = r.c?.current ?? 0, ct = r.c?.totalRequired ?? 0, tc = r.t?.current ?? 0, tt = r.t?.totalRequired ?? 0;
  const readiness = pct(cc + tc, ct + tt);
  if (r.has && ct + tt > 0) {
    b.hero = { label: "Your readiness", value: readiness, unit: "%", caption: `${cc + tc} of your ${ct + tt} required competence and training items are current`, severity: tone(readiness), href: "/skills-gap" };
    const soon = (r.c?.expiringSoon30 ?? 0) + (r.t?.expiringSoon30 ?? 0);
    b.headline = soon > 0 ? `${plural(soon, "item")} will expire in the next 30 days.` : readiness >= 90 ? "You are up to date. Nothing needs you today." : "A few things need your attention.";
  } else b.headline = "You do not have a job role assigned yet, so there is nothing to measure. Ask your manager.";

  const att = b.attention;
  const expired = (r.c?.expired ?? 0), expiredT = (r.t?.expired ?? 0);
  if (expired) att.push({ id: "w-exp-c", label: "Competence has expired", count: expired, severity: "critical", href: "/skills-gap", hint: "Arrange a reassessment" });
  if (expiredT) att.push({ id: "w-exp-t", label: "Training has expired", count: expiredT, severity: "critical", href: "/my-training", hint: "Book or complete it again" });
  const s30 = (r.c?.expiringSoon30 ?? 0) + (r.t?.expiringSoon30 ?? 0);
  if (s30) att.push({ id: "w-30", label: "Expiring within 30 days", count: s30, severity: "warning", href: "/skills-gap" });
  const miss = (r.c?.missing ?? 0) + (r.t?.missing ?? 0);
  if (miss) att.push({ id: "w-miss", label: "Required items not yet achieved", count: miss, severity: "warning", href: "/skills-gap" });
  // The assessment plan: every assessment still open, from "assigned" to "planned", plus competence that will need reassessing and has nothing
  // arranged. An assessment moves: assigned, then ready (the person says so), then planned (the assessor sets a date), then signed off.
  const openRows = await rows(sql`select a.id, a.element_id, ce.name, a.candidate_ready_at r, a.planned_assessment_date p, a.planned_assessment_location loc, u.first_name fn, u.last_name ln from assessments a join competency_elements ce on ce.id = a.element_id left join users u on u.id = a.assessor_id where a.candidate_id = ${userId} and a.is_active and a.sign_off_at is null and (coalesce(a.is_assignment, false) or a.planned_assessment_date is not null or a.candidate_ready_at is not null)`);
  const nowMs = Date.now();
  const byDate = (x: any, y: any) => new Date(x.p).getTime() - new Date(y.p).getTime();
  const plannedFuture = openRows.filter(o => o.p && new Date(o.p).getTime() >= nowMs).sort(byDate);
  const plannedPast = openRows.filter(o => o.p && new Date(o.p).getTime() < nowMs).sort(byDate);
  const waitingForDate = openRows.filter(o => !o.p && o.r);
  const assignedNotReady = openRows.filter(o => !o.p && !o.r);
  const reassess = await reassessmentsDue(sql`a.candidate_id = ${userId}`, h);
  const who = (o: any) => [o.fn, o.ln].filter(Boolean).join(" ");
  const days = (d: any) => Math.ceil((new Date(d).getTime() - nowMs) / 86_400_000);
  const planRows: PlanRow[] = [
    ...plannedPast.map(o => ({ primary: o.name, secondary: `Was planned for ${fmtDay(o.p)}${who(o) ? ` with ${who(o)}` : ""}. Speak to your assessor.`, tag: { text: "Past its date", tone: "critical" as Tone }, href: "/my-assessments" })),
    ...assignedNotReady.map(o => ({ primary: o.name, secondary: "Assigned to you. Tell your assessor when you are prepared.", tag: { text: "Not ready yet", tone: "neutral" as Tone }, href: "/my-assessments", action: { kind: "ready" as const, label: "I am ready", assessmentId: o.id as string, subject: o.name as string } })),
    ...waitingForDate.map(o => ({ primary: o.name, secondary: "You are ready. Your assessor will set a date.", tag: { text: "Waiting for a date", tone: "warning" as Tone }, href: "/my-assessments" })),
    ...plannedFuture.map(o => ({ primary: o.name, secondary: `${who(o) ? `With ${who(o)}` : "Assessor to confirm"}${o.loc ? `, ${o.loc}` : ""}`, tag: { text: fmtDay(o.p), tone: "good" as Tone }, href: "/my-assessments" })),
    ...reassess.map(e => ({ primary: e.name as string, secondary: "Needs reassessing. Nothing is planned yet.", tag: { text: days(e.expiry_date) < 0 ? "Expired" : `Due ${fmtDay(e.expiry_date)}`, tone: (days(e.expiry_date) < 0 ? "critical" : "serious") as Tone }, href: "/skills-gap" })),
  ].slice(0, 12);
  b.plan = {
    title: "Your assessment plan", subtitle: "From assigned, to ready, to a date, to signed off", href: "/my-assessments", horizonMonths: h,
    stages: [
      { key: "assigned", label: "Assigned to you", value: assignedNotReady.length, tone: "neutral", hint: "Say when you are ready" },
      { key: "waiting", label: "Waiting for a date", value: waitingForDate.length, tone: "warning", hint: "Your assessor will set one" },
      { key: "planned", label: "Planned", value: plannedFuture.length, tone: "good", hint: "A date is booked" },
      { key: "past", label: "Past their date", value: plannedPast.length, tone: plannedPast.length ? "critical" : "neutral", hint: "Speak to your assessor" },
      { key: "reassess", label: "To reassess", value: reassess.length, tone: reassess.length ? "serious" : "neutral", hint: `Expired or due ${horizonText(h)}, nothing planned` },
    ],
    timeline: buildTimeline(plannedFuture.map(o => new Date(o.p)), reassess.map(e => new Date(e.expiry_date))),
    rows: { id: "w-plan", title: "Your next steps", empty: "Nothing is planned and nothing needs planning.", href: "/my-assessments", rows: planRows },
  };
  if (plannedPast.length) att.push({ id: "w-past", label: "Assessments past their planned date", count: plannedPast.length, severity: "critical", href: "/my-assessments", hint: "Speak to your assessor to set a new date" });
  if (reassess.length) att.push({ id: "w-reassess", label: "Competence to reassess with nothing planned", count: reassess.length, severity: "warning", href: "/skills-gap", hint: "Ask your assessor to plan it" });
  if (waitingForDate.length) att.push({ id: "w-wait", label: "Waiting for your assessor to set a date", count: waitingForDate.length, severity: "info", href: "/my-assessments" });
  if (assignedNotReady.length) att.push({ id: "w-assess", label: "Assessments assigned to you", count: assignedNotReady.length, severity: "info", href: "/my-assessments", hint: "Mark yourself ready when you are" });
  const nextPlanned = plannedFuture[0];
  const todo = await num(sql`select count(*)::int n from appraisals where user_id = ${userId} and is_active and status in ('objectives','self_review')`);
  if (todo) att.push({ id: "w-review", label: "Your annual review needs your input", count: todo, severity: "info", href: "/my-performance" });

  // (the competence and training figures are the meters below, so they are not repeated as tiles)
  const e90 = (r.c ? r.c.expiringSoon30 + r.c.expiringSoon60 + r.c.expiringSoon90 : 0) + (r.t ? r.t.expiringSoon30 + r.t.expiringSoon60 + r.t.expiringSoon90 : 0);
  b.kpis.push({ id: "k-90", label: "Expiring within 90 days", value: e90, severity: e90 ? "warning" : "good" });
  if (nextPlanned) b.kpis.push({ id: "k-next", label: "Next assessment", value: fmtDay(nextPlanned.p), caption: nextPlanned.name, href: "/my-assessments" });

  b.meters.push(...ownMeters(r, "w"));
  if (r.c) b.segments.push({ id: "s-comp", title: "Your competence", subtitle: `${r.c.totalRequired} required`, href: "/skills-gap", parts: split({ current: r.c.current, expiring: r.c.expiringSoon30 + r.c.expiringSoon60 + r.c.expiringSoon90, expired: r.c.expired, missing: r.c.missing }) });
  if (r.t) b.segments.push({ id: "s-train", title: "Your training", subtitle: `${r.t.totalRequired} required`, href: "/my-training", parts: split({ current: r.t.current, expiring: r.t.expiringSoon30 + r.t.expiringSoon60 + r.t.expiringSoon90, expired: r.t.expired, missing: r.t.missing }) });

  const soonest: Array<{ name: string; days: number; kind: string }> = [];
  for (const e of r.skills?.elements ?? []) if (e.required && e.daysUntilExpiry != null && e.daysUntilExpiry >= 0 && e.status.startsWith("expiring")) soonest.push({ name: e.element.name, days: e.daysUntilExpiry, kind: "Competence" });
  for (const i of r.training?.items ?? []) if (i.required && i.status.startsWith("expiring")) { const d = Math.min(...i.members.map(m => m.daysUntilExpiry ?? 9999)); if (d < 9999) soonest.push({ name: i.label, days: d, kind: "Training" }); }
  soonest.sort((a, b2) => a.days - b2.days);
  b.lists.push({ id: "l-soon", title: "Expiring soonest", empty: "Nothing is due to expire soon.", href: "/skills-gap", rows: soonest.slice(0, 6).map(s => ({ primary: s.name, secondary: s.kind, tag: { text: s.days === 0 ? "Today" : `${s.days} ${s.days === 1 ? "day" : "days"}`, tone: s.days <= 30 ? "critical" : "warning" } })) });

  b.shortcuts.push({ label: "My Training", href: "/my-training", icon: "graduation" }, { label: "My Assessments", href: "/my-assessments", icon: "assessment" }, { label: "Evidence Portal", href: "/evidence", icon: "upload" },
    { label: "Skills Gap Analysis", href: "/skills-gap", icon: "target" }, { label: "My Performance", href: "/my-performance", icon: "gauge" });
  b.fullView = { label: "Open my detailed dashboard", href: "/my-dashboard" };
}

// -------------------------------------------------------------------------------------------------------------------- assessor

async function assessor(storage: DbStorage, userId: string, b: Briefing, h: number) {
  const open = sql`a.assessor_id = ${userId} and a.is_active and a.sign_off_at is null`;
  const [ready, selfDone, overdue, week, candidates, done30] = await Promise.all([
    num(sql`select count(*)::int n from assessments a where ${open} and candidate_ready_at is not null and planned_assessment_date is null`),
    num(sql`select count(*)::int n from assessments a where ${open} and self_assessment_completed_at is not null`),
    num(sql`select count(*)::int n from assessments a where ${open} and planned_assessment_date < now()`),
    num(sql`select count(*)::int n from assessments a where ${open} and planned_assessment_date >= now() and planned_assessment_date < now() + interval '7 days'`),
    rows(sql`select distinct candidate_id from candidate_allocations where assessor_id = ${userId} and is_active`),
    num(sql`select count(*)::int n from assessments where sign_off_assessor_id = ${userId} and sign_off_at > now() - interval '30 days'`),
  ]);
  const waiting = ready + selfDone + overdue;
  b.hero = { label: "Waiting for you", value: waiting, unit: "", caption: "candidates ready to be scheduled, self-assessments to review and assessments past their date", severity: overdue ? "critical" : waiting ? "warning" : "good", href: "/assessor-dashboard" };
  const parts = [overdue ? `${plural(overdue, "assessment")} past their planned date` : "", ready ? `${plural(ready, "candidate")} ready to be scheduled` : "", selfDone ? `${plural(selfDone, "self-assessment")} to review` : ""].filter(Boolean);
  b.headline = parts.length ? `${parts.join(", ")}.`.replace(/^./, c => c.toUpperCase()) : "Nothing is waiting on you.";
  if (overdue) b.attention.push({ id: "a-over", label: "Assessments past their planned date", count: overdue, severity: "critical", href: "/assessor-dashboard", hint: "Reschedule or complete them" });
  if (ready) b.attention.push({ id: "a-ready", label: "Candidates ready to be scheduled", count: ready, severity: "warning", href: "/assessor-dashboard" });
  if (selfDone) b.attention.push({ id: "a-self", label: "Self-assessments to review", count: selfDone, severity: "warning", href: "/assessor-dashboard" });

  const ids = candidates.map(c => c.candidate_id as string);
  let team: Awaited<ReturnType<DbStorage["getComplianceExplorer"]>> | null = null;
  if (ids.length) team = await storage.getComplianceExplorer({ candidateIds: ids });
  const ppl = (team?.people ?? []).filter(p => !p.onLeave);
  const expiring = ppl.filter(p => p.competence.expiring30 > 0).length;
  if (expiring) b.attention.push({ id: "a-exp", label: "Candidates with competence expiring within 30 days", count: expiring, severity: "warning", href: "/team-compliance" });
  b.kpis.push({ id: "k-cand", label: "Candidates allocated to you", value: ids.length, href: "/assessor-dashboard" }, { id: "k-week", label: "Planned in the next 7 days", value: week, href: "/assessor-dashboard" },
    { id: "k-ready", label: "Ready to schedule", value: ready, severity: ready ? "warning" : "good" }, { id: "k-done", label: "Signed off in 30 days", value: done30 });
  if (team) {
    const sum = (f: (p: (typeof ppl)[number]) => number) => ppl.reduce((n, p) => n + f(p), 0);
    const cc = sum(p => p.competence.current), ct = sum(p => p.competence.total), tc = sum(p => p.training.current), tt = sum(p => p.training.total);
    b.meters.push({ id: "a-m-comp", label: "Your candidates' competence", current: cc, total: ct, pct: pct(cc, ct), href: "/team-compliance" }, { id: "a-m-train", label: "Your candidates' training", current: tc, total: tt, pct: pct(tc, tt), href: "/team-compliance" });
    b.segments.push({ id: "a-s", title: "Your candidates' competence", subtitle: `${ct} required items across ${plural(ppl.length, "person", "people")}`, href: "/team-compliance", parts: split({ current: cc, expiring: sum(p => p.competence.expiring30 + p.competence.expiring60 + p.competence.expiring90), expired: sum(p => p.competence.expired), missing: sum(p => p.competence.missing) }) });
    b.lists.push({ id: "a-need", title: "Candidates needing attention", empty: "Everyone is up to date.", href: "/team-compliance", rows: [...ppl].sort((x, y) => x.competence.percentage - y.competence.percentage).filter(p => p.competence.percentage < 100).slice(0, 6).map(p => ({ primary: p.name, secondary: p.jobRoleName ?? undefined, tag: { text: `${p.competence.percentage}%`, tone: (p.competence.percentage >= 90 ? "good" : p.competence.percentage >= 75 ? "warning" : "critical") as Tone } })) });
  }
  // The assessment plan across everyone this assessor looks after: where each open assessment is on its way to being done, a month-by-month
  // view of what is booked against what is due and not yet planned, and a way to set each date.
  const candidateScope = sql`a.candidate_id in (select candidate_id from candidate_allocations where assessor_id = ${userId} and is_active)`;
  const [openRows, reassess] = await Promise.all([
    rows(sql`select a.id, a.candidate_id, a.element_id, ce.name, u.first_name fn, u.last_name ln, a.candidate_ready_at r, a.planned_assessment_date p from assessments a join users u on u.id = a.candidate_id join competency_elements ce on ce.id = a.element_id where ${open} and (coalesce(a.is_assignment, false) or a.planned_assessment_date is not null or a.candidate_ready_at is not null)`),
    reassessmentsDue(candidateScope, h),
  ]);
  const nowMs = Date.now();
  const byDate = (x: any, y: any) => new Date(x.p).getTime() - new Date(y.p).getTime();
  const plannedFuture = openRows.filter(o => o.p && new Date(o.p).getTime() >= nowMs).sort(byDate);
  const plannedPast = openRows.filter(o => o.p && new Date(o.p).getTime() < nowMs).sort(byDate);
  const waitingForDate = openRows.filter(o => !o.p && o.r).sort((x, y) => new Date(x.r).getTime() - new Date(y.r).getTime());
  const assignedNotReady = openRows.filter(o => !o.p && !o.r);
  const person = (o: any) => `${o.fn ?? o.first_name ?? ""} ${o.ln ?? o.last_name ?? ""}`.trim();
  const days = (d: any) => Math.ceil((new Date(d).getTime() - nowMs) / 86_400_000);
  const act = (o: any, label: string, current: string | null): PlanAction => ({ kind: "schedule", label, assessmentId: o.id, candidateId: o.candidate_id, elementId: o.element_id, current, subject: `${person(o)}: ${o.name}` });
  const planRows: PlanRow[] = [
    ...plannedPast.map(o => ({ primary: person(o), secondary: `${o.name}, was planned for ${fmtDay(o.p)}`, tag: { text: "Past its date", tone: "critical" as Tone }, href: "/assessor-dashboard", action: act(o, "Reschedule", new Date(o.p).toISOString()) })),
    ...waitingForDate.map(o => ({ primary: person(o), secondary: `${o.name}, ready since ${fmtDay(o.r)}`, tag: { text: "Needs a date", tone: "warning" as Tone }, href: "/assessor-dashboard", action: act(o, "Set date", null) })),
    ...reassess.map(e => ({ primary: person(e), secondary: `${e.name}: reassessment needed`, tag: { text: days(e.expiry_date) < 0 ? "Expired" : `Due ${fmtDay(e.expiry_date)}`, tone: (days(e.expiry_date) < 0 ? "critical" : "serious") as Tone }, href: "/assessor-dashboard",
      action: { kind: "schedule" as const, label: "Set date", candidateId: e.candidate_id as string, elementId: e.element_id as string, current: null, subject: `${person(e)}: ${e.name}` } })),
    ...plannedFuture.map(o => ({ primary: person(o), secondary: o.name, tag: { text: fmtDay(o.p), tone: "good" as Tone }, href: "/assessor-dashboard", action: act(o, "Change date", new Date(o.p).toISOString()) })),
  ].slice(0, 14);
  b.plan = {
    title: "Assessment plan", subtitle: "Everything open across your candidates, from assigned to booked", href: "/assessor-dashboard", horizonMonths: h,
    stages: [
      { key: "notready", label: "Assigned, not ready", value: assignedNotReady.length, tone: "neutral", hint: "The candidate has not said they are ready" },
      { key: "ready", label: "Ready, needs a date", value: waitingForDate.length, tone: waitingForDate.length ? "warning" : "neutral", hint: "Set a date for these" },
      { key: "planned", label: "Planned", value: plannedFuture.length, tone: "good", hint: "Booked from today" },
      { key: "past", label: "Past their date", value: plannedPast.length, tone: plannedPast.length ? "critical" : "neutral", hint: "Reschedule or complete" },
      { key: "reassess", label: "To reassess", value: reassess.length, tone: reassess.length ? "serious" : "neutral", hint: `Expired or due ${horizonText(h)}, nothing planned` },
    ],
    timeline: buildTimeline(plannedFuture.map(o => new Date(o.p)), reassess.map(e => new Date(e.expiry_date))),
    rows: { id: "a-plan", title: "Plan and set dates", empty: "Nothing is waiting to be planned.", href: "/assessor-dashboard", rows: planRows },
  };
  if (reassess.length) b.attention.push({ id: "a-reassess", label: "Reassessments to plan", count: reassess.length, severity: "warning", href: "/assessor-dashboard", hint: `Expired or due ${horizonText(h)}, with nothing arranged` });
  b.shortcuts.push({ label: "Assessment Dashboard", href: "/assessor-dashboard", icon: "assessment" }, { label: "Assessor Workspace", href: "/assessor-workspace", icon: "clipboard" }, { label: "Team Compliance Matrix", href: "/team-compliance", icon: "map" }, { label: "Compliance Explorer", href: "/compliance-explorer", icon: "sliders" });
  b.fullView = { label: "Open the assessment dashboard", href: "/assessor-dashboard" };
}

// -------------------------------------------------------------------------------------------------------------------- verifier

async function verifier(storage: DbStorage, userId: string, b: Briefing) {
  const s = await storage.getVerifierDashboardSummary(userId);
  const owed = s.assessorQueue.reduce((n, q) => n + (q.quotaMet ? 0 : q.remainingNeeded), 0);
  const behind = s.assessorQueue.filter(q => !q.quotaMet);
  const quiet = s.assessors.filter(a => a.recentActivityCount === 0);
  b.hero = { label: "Verifications still owed this quarter", value: owed, unit: "", caption: `to bring ${plural(behind.length, "assessor")} up to their sampling target`, severity: owed === 0 ? "good" : behind.length > 1 ? "warning" : "info", href: "/verifier-dashboard" };
  b.headline = owed ? `${plural(behind.length, "assessor")} below target. ${plural(s.verifiedThisMonth, "verification")} done this month.` : "Every assessor is at their sampling target.";
  if (behind.length) b.attention.push({ id: "v-behind", label: "Assessors below their sampling target", count: behind.length, severity: "warning", href: "/verifier-dashboard" });
  if (quiet.length) b.attention.push({ id: "v-quiet", label: "Assessors with no activity in 14 days", count: quiet.length, severity: "info", href: "/verifier-dashboard" });
  b.kpis.push({ id: "k-as", label: "Assessors allocated to you", value: s.assessors.length, href: "/verifier-dashboard" }, { id: "k-vm", label: "Verified this month", value: s.verifiedThisMonth },
    { id: "k-met", label: "Assessors at target", value: `${s.assessorQueue.length - behind.length} of ${s.assessorQueue.length}`, severity: behind.length ? "warning" : "good" });
  // this quarter's sampling: how many of the verifications each assessor needs have been done (the same measure as the queue below)
  for (const q of [...s.assessorQueue].map(q => ({ q, need: q.verifiedThisQuarter + (q.quotaMet ? 0 : q.remainingNeeded) })).filter(x => x.need > 0).sort((x, y) => x.q.verifiedThisQuarter / x.need - y.q.verifiedThisQuarter / y.need).slice(0, 5)) {
    b.meters.push({ id: `v-m-${q.q.assessorId}`, label: q.q.assessorName, current: q.q.verifiedThisQuarter, total: q.need, pct: pct(q.q.verifiedThisQuarter, q.need), caption: `sampling target ${q.q.targetPercentage}% of their assessments`, href: "/verifier-dashboard" });
  }
  b.segments.push({ id: "v-s", title: "Assessors against target", subtitle: "this quarter", parts: [
    { key: "met", label: "At target", value: s.assessorQueue.length - behind.length, tone: "good" }, { key: "behind", label: "Below target", value: behind.length, tone: "warning" }] });
  b.lists.push({ id: "v-q", title: "Verification queue", empty: "Nothing is waiting to be verified.", href: "/verifier-dashboard", rows: behind.slice(0, 6).map(q => ({ primary: q.assessorName, secondary: `${plural(q.remainingNeeded, "more verification")} needed`, tag: { text: `${q.verifiedThisQuarter} done`, tone: "warning" as Tone } })) });
  b.shortcuts.push({ label: "Internal Verification", href: "/verifier-dashboard", icon: "shield" }, { label: "Team Compliance Matrix", href: "/team-compliance", icon: "map" }, { label: "Compliance Explorer", href: "/compliance-explorer", icon: "sliders" }, { label: "Training Completions", href: "/admin/training-completions", icon: "check" });
  b.fullView = { label: "Open internal verification", href: "/verifier-dashboard" };
}

// ---------------------------------------------------------------------------------------------------------------------- external verifier
// Read-only: an outside body looking at how assessments and verification are done for the assessors an administrator has allocated to them.

async function externalVerifier(userId: string, b: Briefing) {
  const al = await rows(sql`
    select u.first_name, u.last_name,
      (select count(*)::int from assessments a where a.assessor_id = u.id and a.outcome is not null and not coalesce(a.is_assignment, false) and coalesce(a.is_active, true)) as done,
      (select count(*)::int from assessments a join verifications v on v.assessment_id = a.id where a.assessor_id = u.id and coalesce(v.is_active, true)) as verified
    from verifier_allocations va join users u on u.id = va.assessor_id where va.verifier_id = ${userId} and va.is_active and (va.ends_on is null or va.ends_on > now()) order by u.last_name, u.first_name`);
  const done = al.reduce((n, r) => n + Number(r.done), 0), verified = al.reduce((n, r) => n + Number(r.verified), 0);
  b.headline = al.length ? `You can review the assessments of ${plural(al.length, "assessor")}. This is a read-only view.` : "No assessors have been allocated to you yet. Ask the administrator.";
  b.kpis.push({ id: "e-as", label: "Assessors allocated to you", value: al.length, href: "/external-verification" }, { id: "e-done", label: "Assessments to review", value: done }, { id: "e-ver", label: "Verification records", value: verified });
  b.lists.push({ id: "e-l", title: "Your assessors", empty: "No assessors have been allocated to you yet.", href: "/external-verification",
    rows: al.slice(0, 8).map(r => ({ primary: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(), secondary: `${plural(Number(r.done), "assessment")}, ${plural(Number(r.verified), "verification")}`, href: "/external-verification" })) });
  b.shortcuts.push({ label: "External Verification", href: "/external-verification", icon: "shield" });
  b.fullView = { label: "Open external verification", href: "/external-verification" };
}

// ---------------------------------------------------------------------------------------------------------------------- contractor administrator
// A contracting company's own administrator: their people, who is ready to work, and what is about to lapse.

async function contractorAdmin(storage: DbStorage, userId: string, b: Briefing) {
  const me = await storage.getUser(userId);
  const companyId = me?.contractCompanyId ?? null;
  if (!companyId) { b.headline = "Your account is not linked to a contracting company yet. Ask the administrator."; return; }
  const ppl = await rows(sql`select id, first_name, last_name, is_active, approval_status, job_role_id from users
    where contract_company_id = ${companyId} and employment_type = 'contractor' and role <> 'contractor_admin' and not coalesce(is_archived, false)`);
  const working = ppl.filter(p => p.is_active && p.approval_status === "approved" && p.job_role_id), pending = ppl.filter(p => p.approval_status === "pending");
  let ready = 0, expiring = 0, attentionRows: Array<{ name: string; why: string }> = [];
  for (const p of working) {
    const [g, t] = await Promise.all([storage.getSkillsGapAnalysis(p.id), storage.getTrainingComplianceStatus(p.id)]);
    const gaps = (g?.statistics.expired ?? 0) + (g?.statistics.missing ?? 0) + (t?.statistics.expired ?? 0) + (t?.statistics.missing ?? 0);
    const soon = (g?.statistics.expiringSoon30 ?? 0) + (t?.statistics.expiringSoon30 ?? 0);
    if (!gaps) ready++; else attentionRows.push({ name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), why: plural(gaps, "item") + " expired or missing" });
    expiring += soon;
  }
  b.hero = { label: "Your people ready to work", value: working.length ? Math.round((ready / working.length) * 100) : 0, unit: "%", caption: `${ready} of ${plural(working.length, "person", "people")} have everything current`, severity: working.length && ready === working.length ? "good" : "warning", href: "/contractor" };
  b.headline = attentionRows.length ? `${plural(attentionRows.length, "person", "people")} have training or competence expired or missing.` : working.length ? "Everyone is up to date." : "No one has been approved to work yet.";
  if (attentionRows.length) b.attention.push({ id: "c-gap", label: "People with expired or missing training or competence", count: attentionRows.length, severity: "critical", href: "/contractor" });
  if (expiring) b.attention.push({ id: "c-soon", label: "Items expiring within 30 days", count: expiring, severity: "warning", href: "/contractor" });
  if (pending.length) b.attention.push({ id: "c-pend", label: "People waiting for the host company's approval", count: pending.length, severity: "info", href: "/contractor" });
  b.kpis.push({ id: "c-p", label: "People", value: ppl.length, href: "/contractor" }, { id: "c-w", label: "Approved to work", value: working.length }, { id: "c-pend", label: "Waiting for approval", value: pending.length });
  b.lists.push({ id: "c-l", title: "Needs attention", empty: "Everyone is up to date.", href: "/contractor", rows: attentionRows.slice(0, 8).map(r => ({ primary: r.name, secondary: r.why, href: "/contractor" })) });
  b.shortcuts.push({ label: "My people", href: "/contractor", icon: "users" });
  b.fullView = { label: "Open my people", href: "/contractor" };
}

// ---------------------------------------------------------------------------------------------------------------------- manager

async function manager(storage: DbStorage, userId: string, b: Briefing) {
  const reports = await rows(sql`select id from users where manager_id = ${userId} and coalesce(is_active,true) and anonymised_at is null and (not coalesce(is_archived,false) or left_at > now())`);
  const ids = reports.map(r => r.id as string);
  const team = ids.length ? await storage.getComplianceExplorer({ candidateIds: ids }) : null;
  const ppl = (team?.people ?? []).filter(p => !p.onLeave);
  const sum = (f: (p: (typeof ppl)[number]) => number) => ppl.reduce((n, p) => n + f(p), 0);
  const cc = sum(p => p.competence.current), ct = sum(p => p.competence.total), tc = sum(p => p.training.current), tt = sum(p => p.training.total);
  const overall = pct(cc + tc, ct + tt);
  if (ids.length) {
    b.hero = { label: "Your team's readiness", value: overall, unit: "%", caption: `${cc + tc} of ${ct + tt} required competence and training items are current across ${plural(ppl.length, "person", "people")}`, severity: tone(overall), href: "/team-compliance" };
    const exp30 = sum(p => p.competence.expiring30 + p.training.expiring30);
    b.headline = exp30 ? `${plural(exp30, "item")} in your team will expire in the next 30 days.` : overall >= 90 ? "Your team is up to date." : "Some of your team need attention.";
  } else b.headline = "No one reports to you in Capera yet.";
  const withExpired = ppl.filter(p => p.competence.expired + p.training.expired > 0).length;
  if (withExpired) b.attention.push({ id: "m-exp", label: "People with expired competence or training", count: withExpired, severity: "critical", href: "/compliance-explorer" });
  const with30 = ppl.filter(p => p.competence.expiring30 + p.training.expiring30 > 0).length;
  if (with30) b.attention.push({ id: "m-30", label: "People with something expiring within 30 days", count: with30, severity: "warning", href: "/compliance-explorer" });
  const approvals = (await storage.getTrainingRequestsForApprover(userId)).filter(r => r.status === "pending").length;
  if (approvals) b.attention.push({ id: "m-appr", label: "Training requests waiting for your approval", count: approvals, severity: "warning", href: "/training-approvals" });
  const reviews = ids.length ? await num(sql`select count(*)::int n from appraisals where is_active and manager_id = ${userId} and status in ('objectives','manager_review','meeting')`) : 0;
  if (reviews) b.attention.push({ id: "m-rev", label: "Annual reviews waiting on you", count: reviews, severity: "info", href: "/team-performance" });
  const staffing = await staffingSummary().catch(() => null);
  if (staffing?.shortfall) b.attention.push({ id: "m-duty", label: "Minimum staffing not met", count: staffing.shortfall, severity: "critical", href: "/duty-to-operate", hint: "A decision on a risk assessment may be needed" });
  else if (staffing?.atRisk) b.attention.push({ id: "m-duty2", label: "Minimum staffing at risk", count: staffing.atRisk, severity: "warning", href: "/duty-to-operate" });
  b.kpis.push({ id: "k-team", label: "People in your team", value: ids.length, href: "/team-compliance" }, { id: "k-leave", label: "On leave", value: ids.length - ppl.length },
    { id: "k-sc", label: "Safety-critical competence current", value: `${pct(sum(p => p.competence.safetyCriticalCurrent), sum(p => p.competence.safetyCriticalTotal))}%`, severity: tone(pct(sum(p => p.competence.safetyCriticalCurrent), sum(p => p.competence.safetyCriticalTotal))) });
  if (ids.length) {
    b.meters.push({ id: "m-comp", label: "Team competence", current: cc, total: ct, pct: pct(cc, ct), href: "/team-compliance" }, { id: "m-train", label: "Team training", current: tc, total: tt, pct: pct(tc, tt), href: "/team-compliance" });
    b.segments.push({ id: "m-s", title: "Team competence", subtitle: `${ct} required items`, href: "/team-compliance", parts: split({ current: cc, expiring: sum(p => p.competence.expiring30 + p.competence.expiring60 + p.competence.expiring90), expired: sum(p => p.competence.expired), missing: sum(p => p.competence.missing) }) });
    b.lists.push({ id: "m-need", title: "People needing attention", empty: "Everyone is up to date.", href: "/compliance-explorer", rows: [...ppl].sort((x, y) => (x.competence.percentage + x.training.percentage) - (y.competence.percentage + y.training.percentage)).filter(p => p.competence.percentage < 100 || p.training.percentage < 100).slice(0, 6).map(p => ({ primary: p.name, secondary: p.jobRoleName ?? undefined, tag: { text: p.competence.expired + p.training.expired ? `${p.competence.expired + p.training.expired} expired` : `${Math.min(p.competence.percentage, p.training.percentage)}%`, tone: (p.competence.expired + p.training.expired ? "critical" : "warning") as Tone } })) });
  }
  b.shortcuts.push({ label: "Team Compliance Matrix", href: "/team-compliance", icon: "map" }, { label: "Compliance Explorer", href: "/compliance-explorer", icon: "sliders" }, { label: "Team Performance", href: "/team-performance", icon: "users" }, { label: "Training Approvals", href: "/training-approvals", icon: "check" }, { label: "Duty to Operate", href: "/duty-to-operate", icon: "alert" }, { label: "Org Chart", href: "/org-chart", icon: "network" });
  b.fullView = { label: "Open the executive dashboard", href: "/dashboard/executive" };
}

// ------------------------------------------------------------------------------------------------------- admin / super admin

async function admin(storage: DbStorage, userId: string, b: Briefing, governance: boolean) {
  const o = await orgOverview(storage);
  const comp = o.competenceCompliance, trn = o.trainingCompliance;
  b.hero = { label: "Organisation competence", value: comp.percentage, unit: "%", caption: `${comp.current} of ${comp.total} required competence items are current across ${plural(o.headcount, "person", "people")}`, severity: tone(comp.percentage), href: "/compliance-explorer" };
  const ex = o.expiringCertifications;
  b.headline = ex.expired ? `${plural(ex.expired, "item")} have expired and ${plural(ex.in30Days, "item")} expire in the next 30 days.` : ex.in30Days ? `${plural(ex.in30Days, "item")} expire in the next 30 days.` : "Nothing is overdue.";

  const [certs, requests, failed, queued] = await Promise.all([
    num(sql`select count(*)::int n from elearning_certificates where status = 'pending'`),
    storage.getPendingTrainingRequestsForFulfillment().then(r => r.length).catch(() => 0),
    num(sql`select count(*)::int n from notification_logs where status = 'failed' and created_at > now() - interval '30 days'`),
    num(sql`select count(*)::int n from notification_queue where sent_at is null`),
  ]);
  const staffing = await staffingSummary().catch(() => null);
  const openReviews = await num(sql`select count(*)::int n from staffing_shortfall_reviews where status = 'open'`);
  const retention = await listArchived().catch(() => null);
  const dueRemoval = retention?.settings.autoRemoveEnabled ? retention.people.filter(p => !p.removed && !p.held && p.daysLeft != null && p.daysLeft <= 30).length : 0;
  const mail = emailStatus();
  const att = b.attention;
  const pendingContractors = await num(sql`select count(*)::int n from users where approval_status = 'pending' and not coalesce(is_archived, false)`);
  if (pendingContractors) att.push({ id: "ad-cpend", label: "Contractor people waiting for your approval", count: pendingContractors, severity: "warning", href: "/admin/contractors" });
  if (ex.expired) att.push({ id: "ad-exp", label: "Competence and training expired", count: ex.expired, severity: "critical", href: "/compliance-explorer" });
  if (staffing?.shortfall) att.push({ id: "ad-short", label: "Minimum staffing not met", count: staffing.shortfall, severity: "critical", href: "/duty-to-operate", hint: openReviews ? `${plural(openReviews, "decision")} waiting` : undefined });
  else if (staffing?.atRisk) att.push({ id: "ad-risk", label: "Minimum staffing at risk", count: staffing.atRisk, severity: "warning", href: "/duty-to-operate" });
  if (requests) att.push({ id: "ad-req", label: "Training requests waiting to be arranged", count: requests, severity: "warning", href: "/admin/training-manager" });
  if (certs) att.push({ id: "ad-cert", label: "E-learning certificates waiting for approval", count: certs, severity: "info", href: "/admin/certificates" });
  if (failed) att.push({ id: "ad-mail", label: "Emails failed to send in the last 30 days", count: failed, severity: "warning", href: "/admin/notifications" });
  if (!mail.configured) att.push({ id: "ad-nomail", label: "Email is not set up, so nothing is being sent", count: 1, severity: "info", href: "/admin/notifications" });
  if (dueRemoval) att.push({ id: "ad-ret", label: "Leavers whose details will be removed within 30 days", count: dueRemoval, severity: "info", href: "/admin/archived-people" });

  b.kpis.push({ id: "k-head", label: "People in scope", value: o.headcount, caption: o.onLeaveCount ? `${o.onLeaveCount} on leave, excluded` : undefined, href: "/admin/users" },
    { id: "k-trn", label: "Training current", value: `${trn.percentage}%`, severity: tone(trn.percentage), href: "/compliance-explorer" },
    { id: "k-sct", label: "Safety-critical training", value: `${o.safetyCriticalTraining.percentage}%`, severity: tone(o.safetyCriticalTraining.percentage), href: "/compliance-explorer" },
    { id: "k-scc", label: "Safety-critical competence", value: `${o.safetyCriticalCompetence.percentage}%`, severity: tone(o.safetyCriticalCompetence.percentage), href: "/compliance-explorer" });
  b.meters.push({ id: "ad-comp", label: "Competence", current: comp.current, total: comp.total, pct: comp.percentage, href: "/compliance-explorer" }, { id: "ad-trn", label: "Training", current: trn.current, total: trn.total, pct: trn.percentage, href: "/compliance-explorer" },
    { id: "ad-scc", label: "Safety-critical competence", current: o.safetyCriticalCompetence.current, total: o.safetyCriticalCompetence.total, pct: o.safetyCriticalCompetence.percentage, href: "/compliance-explorer" },
    { id: "ad-sct", label: "Safety-critical training", current: o.safetyCriticalTraining.current, total: o.safetyCriticalTraining.total, pct: o.safetyCriticalTraining.percentage, href: "/compliance-explorer" });
  b.segments.push({ id: "ad-s-comp", title: "Competence", subtitle: `${comp.total} required items`, href: "/compliance-explorer", parts: split(o.statusBreakdown.competence) }, { id: "ad-s-trn", title: "Training", subtitle: `${trn.total} required items`, href: "/compliance-explorer", parts: split(o.statusBreakdown.training) });
  b.bars.push({ id: "ad-exp-bars", title: "When things expire", subtitle: "competence and training together", items: [
    { label: "Already expired", value: ex.expired, tone: "critical" }, { label: "Next 30 days", value: ex.in30Days, tone: "serious" }, { label: "31 to 60 days", value: ex.in60Days, tone: "warning" }, { label: "61 to 90 days", value: ex.in90Days, tone: "warning" }] });
  b.lists.push({ id: "ad-groups", title: "Groups needing attention", empty: "No groups to show.", href: "/compliance-explorer", rows: [...o.groupPerformance].sort((x: any, y: any) => x.competencePercentage - y.competencePercentage).slice(0, 6).map((g: any) => ({ primary: g.groupLabel, secondary: `${plural(g.headcount, "person", "people")}`, tag: { text: `${g.competencePercentage}%`, tone: (g.competencePercentage >= 90 ? "good" : g.competencePercentage >= 75 ? "warning" : "critical") as Tone } })) });
  const activity = await rows(sql`select actor_name, summary, occurred_at from audit_events where action <> 'sign-in' and entity_type <> 'auth' order by occurred_at desc limit 6`);
  b.lists.push({ id: "ad-act", title: "Recent changes", empty: "Nothing has been changed yet.", href: "/admin/audit-log", rows: activity.map(a => ({ primary: a.summary, secondary: `${a.actor_name ?? "Someone"}, ${fmtDay(a.occurred_at)}` })) });
  b.shortcuts.push({ label: "User Management", href: "/admin/users", icon: "users" }, { label: "Executive Dashboard", href: "/dashboard/executive", icon: "chart" }, { label: "Compliance Explorer", href: "/compliance-explorer", icon: "sliders" }, { label: "Announcements", href: "/admin/announcements", icon: "megaphone" }, { label: "Email Notifications", href: "/admin/notifications", icon: "bell" }, { label: "Audit Log", href: "/admin/audit-log", icon: "scroll" });
  b.fullView = { label: "Open the executive dashboard", href: "/dashboard/executive" };

  if (governance) {
    const days = await rows(sql`select to_char(d, 'Dy') label, coalesce(c.n, 0)::int n from generate_series(current_date - 6, current_date, '1 day') d left join (select occurred_at::date as dy, count(*) n from audit_events where occurred_at > now() - interval '7 days' and action <> 'sign-in' group by 1) c on c.dy = d::date order by d`);
    const signIns = await num(sql`select count(distinct actor_id)::int n from audit_events where action = 'sign-in' and occurred_at > now() - interval '7 days'`);
    const admins = await num(sql`select count(*)::int n from users where role in ('admin','super_admin','developer') and coalesce(is_active,true)`);
    b.bars.push({ id: "sa-activity", title: "Changes made, last 7 days", subtitle: "everything recorded in the audit log", items: days.map(d => ({ label: d.label, value: d.n, tone: "neutral" as Tone })) });
    b.kpis.push({ id: "k-signins", label: "People who signed in this week", value: signIns, caption: `of ${o.headcount}` }, { id: "k-admins", label: "Accounts with administrator access", value: admins, href: "/admin/users" },
      { id: "k-ret", label: "Leaver details", value: retention?.settings.autoRemoveEnabled ? `removed after ${retention.settings.retentionMonths} months` : "kept until you switch removal on", href: "/admin/archived-people" });
  }
  void queued;
}

// ---------------------------------------------------------------------------------------------------------------------- developer

async function developer(storage: DbStorage, userId: string, b: Briefing) {
  const [users30, total, failed, skipped, queued, events24, auditTotal, assessments, enrolments, logs] = await Promise.all([
    num(sql`select count(distinct actor_id)::int n from audit_events where action = 'sign-in' and occurred_at > now() - interval '7 days'`),
    num(sql`select count(*)::int n from users where coalesce(is_active,true) and anonymised_at is null`),
    num(sql`select count(*)::int n from notification_logs where status = 'failed' and created_at > now() - interval '30 days'`),
    num(sql`select count(*)::int n from notification_logs where status = 'skipped' and created_at > now() - interval '30 days'`),
    num(sql`select count(*)::int n from notification_queue where sent_at is null`),
    num(sql`select count(*)::int n from audit_events where occurred_at > now() - interval '24 hours'`),
    num(sql`select count(*)::int n from audit_events`), num(sql`select count(*)::int n from assessments`), num(sql`select count(*)::int n from training_enrollments`), num(sql`select count(*)::int n from notification_logs`),
  ]);
  const mail = emailStatus();
  const up = process.uptime();
  b.hero = { label: "People who signed in this week", value: users30, unit: "", caption: `of ${total} active accounts`, severity: "info", href: "/admin/audit-log" };
  b.headline = !mail.configured ? "Email is not set up, so no email is being sent." : failed ? `${plural(failed, "email")} failed to send in the last 30 days.` : "The platform is running normally.";
  if (!mail.configured) b.attention.push({ id: "d-mail", label: "Email is not set up", count: 1, severity: "warning", href: "/admin/notifications", hint: "Emails are recorded as not sent" });
  if (failed) b.attention.push({ id: "d-fail", label: "Emails failed in the last 30 days", count: failed, severity: "critical", href: "/admin/notifications" });
  if (skipped && mail.configured) b.attention.push({ id: "d-skip", label: "Emails not sent in the last 30 days", count: skipped, severity: "warning", href: "/admin/notifications" });
  if (queued) b.attention.push({ id: "d-queue", label: "Emails waiting for a digest", count: queued, severity: "info", href: "/admin/notifications" });
  b.kpis.push({ id: "k-up", label: "Server running for", value: up > 86400 ? `${Math.floor(up / 86400)}d ${Math.floor((up % 86400) / 3600)}h` : `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`, caption: `Node ${process.version}` },
    { id: "k-env", label: "Environment", value: process.env.NODE_ENV === "production" ? "Production" : "Development" },
    { id: "k-email", label: "Email", value: mail.configured ? (mail.provider ?? "Set up") : "Not set up", severity: mail.configured ? "good" : "warning", href: "/admin/notifications" },
    { id: "k-24", label: "Changes in the last 24 hours", value: events24, href: "/admin/audit-log" });
  const days = await rows(sql`select to_char(d, 'Dy') label, coalesce(c.n, 0)::int n from generate_series(current_date - 6, current_date, '1 day') d left join (select occurred_at::date as dy, count(*) n from audit_events where occurred_at > now() - interval '7 days' and action <> 'sign-in' group by 1) c on c.dy = d::date order by d`);
  b.bars.push({ id: "d-activity", title: "Changes made, last 7 days", subtitle: "everything recorded in the audit log", items: days.map(d => ({ label: d.label, value: d.n, tone: "neutral" as Tone })) },
    { id: "d-volume", title: "Data held", subtitle: "rows in the largest tables", items: [{ label: "Audit log", value: auditTotal, tone: "neutral" }, { label: "Assessments", value: assessments, tone: "neutral" }, { label: "Training enrolments", value: enrolments, tone: "neutral" }, { label: "Email log", value: logs, tone: "neutral" }] });
  const activity = await rows(sql`select actor_name, summary, occurred_at from audit_events order by occurred_at desc limit 8`);
  b.lists.push({ id: "d-act", title: "Latest activity", empty: "Nothing recorded yet.", href: "/admin/audit-log", rows: activity.map(a => ({ primary: a.summary, secondary: `${a.actor_name ?? "Someone"}, ${fmtDay(a.occurred_at)}` })) });
  b.shortcuts.push({ label: "Audit Log", href: "/admin/audit-log", icon: "scroll" }, { label: "Email Notifications", href: "/admin/notifications", icon: "bell" }, { label: "Competency Manager", href: "/admin/competency-manager", icon: "target" }, { label: "Standard Wizard", href: "/admin/standard-wizard", icon: "sparkles" }, { label: "Executive Dashboard", href: "/dashboard/executive", icon: "chart" });
  b.fullView = { label: "Open the executive dashboard", href: "/dashboard/executive" };
}

// ------------------------------------------------------------------------------------------------------------- extra capabilities

async function extras(storage: DbStorage, userId: string, roles: string[], persona: Persona, b: Briefing) {
  if (roles.includes("training_administrator") && !["admin", "super_admin", "developer"].includes(persona)) {
    const [pending, bookings] = await Promise.all([storage.getPendingTrainingRequestsForFulfillment().then(r => r.length).catch(() => 0), num(sql`select count(*)::int n from course_bookings where status = 'pending'`)]);
    b.also.push("Training administration");
    if (pending) b.attention.push({ id: "x-req", label: "Training requests waiting to be arranged", count: pending, severity: "warning", href: "/admin/training-manager" });
    if (bookings) b.attention.push({ id: "x-book", label: "Course bookings waiting for confirmation", count: bookings, severity: "warning", href: "/admin/course-bookings" });
    b.shortcuts.push({ label: "Course Bookings", href: "/admin/course-bookings", icon: "check" }, { label: "Training Sessions", href: "/admin/training-sessions", icon: "calendar" });
  }
  if (roles.includes("training_approver") && persona !== "manager") {
    const n = (await storage.getTrainingRequestsForApprover(userId)).filter(r => r.status === "pending").length;
    b.also.push("Training approvals");
    if (n) b.attention.push({ id: "x-appr", label: "Training requests waiting for your approval", count: n, severity: "warning", href: "/training-approvals" });
    b.shortcuts.push({ label: "Training Approvals", href: "/training-approvals", icon: "check" });
  }

  // Performance reviews: whatever is waiting on this person (their own self assessment, a review to complete, a report to share or sign),
  // and for administrators the gaps that stop reviews happening: people with nobody set to appraise them, and reviews running late.
  try {
    const todo = await listTodo({ id: userId, roles });
    if (todo.length) {
      const late = todo.filter(t => t.daysLeft != null && t.daysLeft < 0).length;
      b.attention.push({ id: "x-perf", label: "Performance review tasks waiting for you", count: todo.length, severity: late ? "warning" : "info", href: "/my-performance", hint: late ? `${plural(late, "task")} overdue` : "Your reviews, and your team's" });
    }
    if (["admin", "super_admin", "developer"].includes(persona)) {
      const [noAppraiser, late] = await Promise.all([
        num(sql`select count(*)::int n from users where coalesce(is_active, true) and not coalesce(is_archived, false) and manager_id is null`),
        num(sql`select count(*)::int n from appraisals a join performance_cycles c on c.id = a.cycle_id where c.status = 'open' and a.is_active and (
          (a.status = 'objectives' and coalesce(a.objectives_due_date, c.objective_deadline) < now()) or
          (a.status = 'self_review' and coalesce(a.self_review_due_date, c.self_review_deadline) < now()) or
          (a.status = 'manager_review' and coalesce(a.manager_review_due_date, c.manager_review_deadline) < now()))`),
      ]);
      if (late) b.attention.push({ id: "x-perf-late", label: "Performance reviews running late", count: late, severity: "warning", href: "/admin/performance", hint: "See who is waiting on whom under Completion" });
      if (noAppraiser) b.attention.push({ id: "x-perf-none", label: "People with nobody set to appraise them", count: noAppraiser, severity: "warning", href: "/admin/performance", hint: "Set a manager under Reporting lines" });
    }
  } catch (e) { console.error("Could not add performance items to the home briefing:", e); }
}

// ------------------------------------------------------------------------------------------------------------------------ entry

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 };

export async function buildBriefing(storage: DbStorage, userId: string, horizonMonths = DEFAULT_HORIZON): Promise<Briefing> {
  const h = HORIZON_OPTIONS.includes(horizonMonths) ? horizonMonths : DEFAULT_HORIZON;
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const roles = (await storage.getEffectiveRoles(userId)).map((r: string) => String(r).toLowerCase().replace(/[\s-]+/g, "_"));
  const chosen = PERSONA_ORDER.find(p => roles.includes(p.role)) ?? PERSONA_ORDER[PERSONA_ORDER.length - 2];
  const b: Briefing = { persona: chosen.persona, personaLabel: chosen.label, name: first(user), headline: "", generatedAt: new Date().toISOString(), hero: null, plan: null, horizonOptions: HORIZON_OPTIONS, attention: [], kpis: [], meters: [], segments: [], bars: [], lists: [], shortcuts: [], also: [] };

  switch (chosen.persona) {
    case "worker": await worker(storage, userId, b, h); break;
    case "assessor": await assessor(storage, userId, b, h); break;
    case "verifier": await verifier(storage, userId, b); break;
    case "external": await externalVerifier(userId, b); break;
    case "contractor": await contractorAdmin(storage, userId, b); break;
    case "manager": await manager(storage, userId, b); break;
    case "admin": await admin(storage, userId, b, false); break;
    case "super_admin": await admin(storage, userId, b, true); break;
    case "developer": await developer(storage, userId, b); break;
  }
  await extras(storage, userId, roles, chosen.persona, b);

  // someone who is mainly something else but also does their own training and has their own competence gets that as a quiet extra
  if (HAS_OWN_RECORD.has(chosen.persona) && chosen.persona !== "worker") {
    const own = await ownRecord(storage, userId);
    if (own.has) b.meters.push(...ownMeters(own));
  }
  const mail = await myAnnouncements(userId).catch(() => null);
  if (mail?.needsAction) b.attention.push({ id: "x-ann", label: "Important announcements to read", count: mail.needsAction, severity: "warning", href: "/announcements" });
  else if (mail?.unread) b.attention.push({ id: "x-ann2", label: "New announcements", count: mail.unread, severity: "info", href: "/announcements" });
  b.attention.sort((x, y) => RANK[x.severity] - RANK[y.severity] || y.count - x.count);

  // Bronze, Silver or Gold: take out anything that leads to a page the licence does not include, and the link (not the figure) from the rest
  const licensed = licensedTier();
  const allowed = (href?: string) => !href || tierIncludes(licensed, tierForPath(href));
  b.attention = b.attention.filter(a => allowed(a.href));
  b.kpis = b.kpis.filter(k => allowed(k.href));
  b.shortcuts = b.shortcuts.filter(s => allowed(s.href));
  if (b.fullView && !allowed(b.fullView.href)) b.fullView = undefined;
  if (b.hero && !allowed(b.hero.href)) b.hero = { ...b.hero, href: undefined };
  b.meters = b.meters.map(m => (allowed(m.href) ? m : { ...m, href: undefined }));
  b.segments = b.segments.map(s => (allowed(s.href) ? s : { ...s, href: undefined }));
  b.lists = b.lists.map(l => ({ ...l, href: allowed(l.href) ? l.href : undefined, rows: l.rows.map(r => (allowed(r.href) ? r : { ...r, href: undefined })) }));
  if (b.plan) b.plan = { ...b.plan, rows: { ...b.plan.rows, rows: b.plan.rows.rows.map(r => (allowed(r.href) ? r : { ...r, href: undefined })) } };
  return b;
}
