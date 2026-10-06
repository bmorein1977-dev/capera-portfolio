/**
 * Adds performance-review demo data on top of the fictional demo tenant (run seedCleanDemo.ts first):
 * the behaviours framework, each person's career history and qualifications, a completed 2025 review
 * cycle (objectives, behaviour ratings, 360 feedback, scores) and an open 2026 cycle at mixed stages.
 *
 * Everything is invented. Refuses to run unless the database name contains "demo". Re-run with --reset
 * to clear only the performance tables and rebuild them.
 *
 *   DATABASE_URL=<demo db url> npx tsx scripts/demo/seedPerformanceDemo.ts [--reset]
 */
import { db, pool } from "../../server/db";
import * as S from "../../shared/schema";
import * as perf from "../../server/services/performance";
import { and, eq, sql } from "drizzle-orm";

const dbName = (() => { try { return new URL(process.env.DATABASE_URL || "").pathname.replace(/^\//, ""); } catch { return ""; } })();
if (!/demo/i.test(dbName)) { console.error(`Refusing to run against "${dbName}": database name must contain "demo".`); process.exit(1); }
const RESET = process.argv.includes("--reset");

let seedState = 20261006;
const rnd = () => { seedState |= 0; seedState = (seedState + 0x6d2b79f5) | 0; let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p: number) => rnd() < p;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const DAY = 86400000;
const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * DAY);
const addYears = (d: Date, y: number) => new Date(d.getTime() + y * 365.25 * DAY);

const EMPLOYERS = ["Harbourline Gas Ltd", "Calder Process Systems", "Brightwater Utilities", "Ironbridge Engineering", "Kestrel Offshore Services", "Stonegate Power Services", "Meadowbank Water Treatment"];
const LADDER: Record<string, string[]> = {
  FOPS: ["Trainee Plant Operator", "Plant Operator"], FMNT: ["Apprentice Technician", "Maintenance Technician"],
  FTEC: ["Graduate Engineer", "Process Engineer"], FLDR: ["Technician", "Senior Technician"],
};
// name, level (0-8), awarding body
const QUALS: Record<string, Array<[string, number, string]>> = {
  "OPS-CRO": [["City & Guilds Level 3 Process Operations", 3, "City & Guilds"], ["Level 3 Award in Process Safety", 3, "Process Skills Council"]],
  "OPS-SCRO": [["City & Guilds Level 3 Process Operations", 3, "City & Guilds"], ["ILM Level 3 Team Leading", 3, "ILM"]],
  "OPS-FO": [["Level 2 Diploma in Process Operations", 2, "City & Guilds"], ["Level 2 Award in Health & Safety at Work", 2, "Process Skills Council"]],
  "OPS-STL": [["HNC Process Plant Operations", 4, "Northern Technical College"], ["ILM Level 4 First Line Management", 4, "ILM"]],
  "MNT-MT": [["ONC Engineering (Mechanical)", 3, "Northern Technical College"], ["Level 3 Diploma in Mechanical Maintenance", 3, "City & Guilds"]],
  "MNT-ET": [["HNC Electrical & Electronic Engineering", 4, "Northern Technical College"], ["18th Edition Wiring Regulations", 3, "Electrical Training Board"]],
  "MNT-ICT": [["HNC Instrumentation & Control", 4, "Northern Technical College"], ["Level 3 Diploma in Control Systems", 3, "City & Guilds"]],
  "MNT-SUP": [["HNC Engineering Management", 4, "Northern Technical College"], ["ILM Level 4 First Line Management", 4, "ILM"]],
  "ENG-PE": [["BEng (Hons) Chemical Engineering", 6, "Riverside University"], ["Process Safety Management Certificate", 5, "Process Safety Institute"]],
  "HSE-ADV": [["National General Certificate in Occupational Health & Safety", 3, "NEBOSH"], ["Level 5 Diploma in Health & Safety Management", 5, "NEBOSH"]],
  "LC-LEAD": [["Level 3 Award in Assessing Competence", 3, "City & Guilds"], ["Certificate in Learning & Development", 5, "CIPD"]],
  "MGT-SM": [["BSc (Hons) Engineering Management", 6, "Riverside University"], ["ILM Level 5 Leadership & Management", 5, "ILM"]],
};

const OBJECTIVES: Record<string, Array<{ title: string; measure: string; category: string }>> = {
  ops: [
    { title: "Operate with no lost-time incidents or process-safety events", measure: "Zero recordable events on shift for the year", category: "safety" },
    { title: "Cut standing alarms on my console", measure: "Standing alarms reduced by 30% against last year", category: "delivery" },
    { title: "Complete all assigned competence assessments on schedule", measure: "100% of assigned standards signed off before their due date", category: "development" },
    { title: "Coach a trainee operator to competence", measure: "Trainee signed off on two core standards", category: "people" },
  ],
  maint: [
    { title: "Deliver planned maintenance to schedule", measure: "95% of planned work orders closed on time", category: "delivery" },
    { title: "Reduce repeat failures on critical equipment", measure: "Repeat call-outs down by 25%", category: "delivery" },
    { title: "Complete isolation and permit refresher and extend my authorisations", measure: "All authorisations renewed before expiry", category: "development" },
    { title: "Keep work orders and calibration records audit-ready", measure: "No findings in the annual records audit", category: "safety" },
  ],
  lead: [
    { title: "Deliver the team's safety and competence plan", measure: "All team members current on required standards", category: "safety" },
    { title: "Close investigation actions within agreed dates", measure: "90% of actions closed on time", category: "delivery" },
    { title: "Develop two direct reports towards the next role", measure: "Development plans agreed and reviewed twice", category: "people" },
    { title: "Improve handover and shift communication", measure: "Handover quality score above 85%", category: "delivery" },
  ],
  eng: [
    { title: "Support start-up and performance of the process units", measure: "Units meet agreed stability targets", category: "delivery" },
    { title: "Complete assigned hazard studies and close actions", measure: "All study actions tracked to close-out", category: "safety" },
    { title: "Build technical depth through a recognised development route", measure: "Chartership or equivalent milestone achieved", category: "development" },
  ],
};
const FAMILY_TO_POOL: Record<string, string> = { FOPS: "ops", FMNT: "maint", FTEC: "eng", FLDR: "lead" };
const STRENGTHS = ["Calm and clear under pressure", "Always willing to help colleagues", "Raises safety concerns early", "Shares knowledge generously", "Reliable and follows through", "Communicates clearly with other teams"];
const DEV_POINTS = ["Could delegate more", "Would benefit from broader exposure to other sites", "Keep building confidence in presenting to senior people", "Plan own development time more firmly", "Share progress earlier when plans change"];
const SELF_TEXT = ["I met the main commitments this year and want to build on the strengths my team recognises.", "A strong year on delivery. I want more responsibility and to develop others.", "I made good progress on my objectives and learned a lot from changes on site."];
const MGR_TEXT = ["Consistently reliable with a positive effect on the team. Ready for a broader remit with the right support.", "Solid year. Strong on delivery, with scope to grow influence beyond the immediate team.", "Met the core expectations. Clear development areas agreed for the coming year."];

async function main() {
  const perfTables = ["appraisal_behaviour_ratings", "appraisals", "behaviours", "feedback_requests", "feedback_responses", "objective_updates", "performance_cycles", "performance_objectives", "user_experience", "user_qualifications", "talent_score_settings"];
  const existing = await db.select({ id: S.performanceCycles.id }).from(S.performanceCycles).limit(1);
  if (existing.length) {
    if (!RESET) { console.error("Performance data already exists. Re-run with --reset to rebuild it."); process.exit(1); }
    await pool.query(`truncate table ${perfTables.map(t => `"${t}"`).join(", ")} restart identity cascade`);
    console.log("reset: cleared the performance tables");
  }
  const people = (await db.select().from(S.users).where(eq(S.users.isActive, true))).filter(u => u.jobRoleId && u.role !== "super_admin");
  if (people.length < 10) { console.error("Run seedCleanDemo.ts first."); process.exit(1); }
  const roles = await db.select().from(S.jobRoles);
  const families = await db.select().from(S.jobFamilies);
  const roleById = new Map(roles.map(r => [r.id, r]));
  const familyCode = (id: string | null | undefined) => families.find(f => f.id === id)?.code ?? "FLDR";

  // ---- behaviours and settings
  await perf.ensureStarterBehaviours();
  const behavs = await perf.listBehaviours();
  await db.insert(S.talentScoreSettings).values({} as any);

  // ---- career history and qualifications
  const expRows: any[] = [], qualRows: any[] = [];
  for (const u of people) {
    const role = roleById.get(u.jobRoleId!)!;
    const start = u.startDate ? new Date(u.startDate) : addYears(now, -2);
    const tenure = Math.max(0.5, (now.getTime() - start.getTime()) / (365.25 * DAY));
    const prior = Math.max(0, (u.yearsOfExperience ?? 5) - tenure);
    expRows.push({ userId: u.id, employer: "Northgate Energy Services", title: role.name, jobRoleId: role.id, jobFamilyId: role.jobFamilyId, startDate: start, endDate: null, source: "manual", verified: true, description: "Current role." });
    const n = prior >= 8 ? 2 : prior >= 2 ? 1 : 0;
    let cursor = start, left = prior;
    const code = familyCode(role.jobFamilyId);
    for (let i = 0; i < n; i++) {
      const span = i === n - 1 ? left : Math.max(2, Math.round(left / 2)); left -= span;
      const from = addYears(cursor, -span);
      const roll = rnd();
      const famId = roll < 0.8 ? role.jobFamilyId : roll < 0.92 ? null : pick(families).id;
      const ladder = LADDER[code] || LADDER.FLDR;
      expRows.push({ userId: u.id, employer: pick(EMPLOYERS), title: ladder[Math.min(ladder.length - 1, n - 1 - i)], jobFamilyId: famId, jobRoleId: null, startDate: from, endDate: cursor, source: chance(0.5) ? "cv_extracted" : "manual", verified: chance(0.4), description: null });
      cursor = from;
    }
    const q = QUALS[role.code] ?? [];
    q.forEach(([name, level, body], i) => {
      if (i === 0 || chance(0.7)) qualRows.push({ userId: u.id, name, level, awardingBody: body, awardedDate: addYears(now, -between(2, 20)), source: chance(0.4) ? "cv_extracted" : "manual", verified: chance(0.85) });
    });
    if (["ENG-PE", "MGT-SM"].includes(role.code) && chance(0.15)) qualRows.push({ userId: u.id, name: "MSc Engineering Management", level: 7, awardingBody: "Riverside University", awardedDate: addYears(now, -between(1, 8)), source: "manual", verified: true });
  }
  for (let i = 0; i < expRows.length; i += 300) await db.insert(S.userExperience).values(expRows.slice(i, i + 300));
  for (let i = 0; i < qualRows.length; i += 300) await db.insert(S.userQualifications).values(qualRows.slice(i, i + 300));

  // ---- 2025 cycle: completed
  const c25 = await perf.saveCycle({ name: "2025 Annual Review", year: 2025, startDate: "2025-01-01", endDate: "2025-12-31", objectiveDeadline: "2025-02-28", selfReviewDeadline: "2026-01-16", managerReviewDeadline: "2026-02-13", ratingScale: 5, includes360: true, requiresCalibration: false });
  await perf.launchCycle(c25.id);
  const apps25 = await db.select().from(S.appraisals).where(eq(S.appraisals.cycleId, c25.id));
  const userById = new Map(people.map(u => [u.id, u]));
  const level = new Map<string, "strong" | "solid" | "developing">();
  for (const a of apps25) { const r = rnd(); level.set(a.userId, r < 0.3 ? "strong" : r < 0.75 ? "solid" : "developing"); }

  const outcomeFor = (lv: string): S.ObjectiveOutcome => {
    const r = rnd();
    if (lv === "strong") return r < 0.35 ? "exceeded" : r < 0.9 ? "met" : "partially_met";
    if (lv === "solid") return r < 0.1 ? "exceeded" : r < 0.65 ? "met" : r < 0.93 ? "partially_met" : "not_met";
    return r < 0.1 ? "met" : r < 0.6 ? "partially_met" : "not_met";
  };
  const objRows: any[] = [], ratingRows: any[] = [], fbRows: any[] = [];
  let signed = 0;
  for (const a of apps25) {
    const u = userById.get(a.userId); if (!u) continue;
    const lv = level.get(a.userId)!;
    const role = roleById.get(u.jobRoleId!)!;
    const pool = OBJECTIVES[FAMILY_TO_POOL[familyCode(role.jobFamilyId)] || "lead"];
    const chosen = [...pool].sort(() => rnd() - 0.5).slice(0, between(3, Math.min(4, pool.length)));
    const weights = chosen.length === 3 ? [40, 30, 30] : [30, 30, 20, 20];
    const mgrRating = clamp(lv === "strong" ? between(4, 5) : lv === "solid" ? between(3, 4) : between(2, 3), 1, 5);
    const finalStatus = rnd() < 0.88 ? "signed_off" : rnd() < 0.7 ? "meeting" : "manager_review";
    chosen.forEach((o, i) => {
      objRows.push({ appraisalId: a.id, userId: a.userId, cycleId: c25.id, title: o.title, successMeasure: o.measure, category: o.category, weighting: weights[i], targetDate: new Date("2025-12-31"), status: "complete", progressPercent: 100, agreedAt: new Date("2025-02-20"),
        selfOutcome: outcomeFor(lv === "developing" ? "solid" : lv), selfComment: "Delivered against the measure; evidence on file.",
        managerOutcome: finalStatus === "manager_review" ? null : outcomeFor(lv), managerComment: finalStatus === "manager_review" ? null : "Agreed with the evidence provided." });
    });
    for (const b of behavs) {
      const m = clamp(mgrRating + between(-1, 1), 1, 5);
      ratingRows.push({ appraisalId: a.id, behaviourId: b.id, selfRating: clamp(m + between(0, 1), 1, 5), selfComment: null, managerRating: finalStatus === "manager_review" ? null : m, managerComment: null });
    }
    const potential = lv === "strong" ? (chance(0.7) ? 3 : 2) : lv === "solid" ? (chance(0.2) ? 3 : 2) : (chance(0.5) ? 2 : 1);
    const signDate = new Date(2026, 1, between(10, 28));
    const patch: any = {
      status: finalStatus, selfSummary: pick(SELF_TEXT), selfPerformanceRating: clamp(mgrRating + between(0, 1), 1, 5),
      careerAspirations: pick(["Move into a team leader role within two years", "Broaden into a technical authority route", "Stay in role and deepen specialist expertise", "Interested in a cross-site move"]),
      mobility: pick(["Open to other sites", "Prefers current site", "Open to relocation for the right role"]),
      selfSubmittedAt: new Date(2026, 0, between(5, 14)),
    };
    if (finalStatus !== "manager_review") {
      Object.assign(patch, { managerSummary: pick(MGR_TEXT), performanceRating: mgrRating, potentialRating: potential, developmentPlan: pick(["Complete the leadership programme and shadow a shift lead for two rotations", "Lead one cross-team improvement project and present results", "Take the next competence standards in the role progression path"]), managerSubmittedAt: new Date(2026, 1, between(1, 9)), meetingDate: new Date(2026, 1, between(10, 27)) });
      // the report is shared after the discussion. Signed-off reviews were all shared; some "meeting" ones are still waiting for the manager to share.
      if (finalStatus === "signed_off" || chance(0.5)) patch.sharedAt = patch.meetingDate;
    }
    if (finalStatus === "signed_off") { patch.employeeSignedOffAt = signDate; patch.managerSignedOffAt = signDate; patch.employeeComments = "Thanks for a fair and constructive discussion."; signed++; }
    await db.update(S.appraisals).set(patch).where(eq(S.appraisals.id, a.id));

    // 360 raters: a few people have too few responses, to show how small groups are held back
    if (finalStatus === "signed_off" || finalStatus === "meeting") {
      const sparse = chance(0.1);
      const wanted = sparse ? 2 : between(4, 6);
      const reports = people.filter(p => p.managerId === a.userId && p.id !== a.userId);
      const peers = people.filter(p => p.managerId === u.managerId && p.id !== a.userId);
      const others = people.filter(p => p.id !== a.userId && p.id !== a.managerId);
      const used = new Set<string>(); const picks: Array<[string, string]> = [];
      const tryAdd = (list: typeof people, type: string) => { const c = list.filter(p => !used.has(p.id)); if (c.length) { const p = pick(c); used.add(p.id); picks.push([p.id, type]); } };
      while (picks.length < wanted) {
        const before = picks.length;
        tryAdd(peers, "peer"); if (picks.length < wanted) tryAdd(reports, "direct_report"); if (picks.length < wanted) tryAdd(others, "stakeholder");
        if (picks.length === before) break;
      }
      for (const [raterId, raterType] of picks) {
        const done = chance(0.95);
        fbRows.push({ appraisalId: a.id, subjectUserId: a.userId, raterId, raterType, status: done ? "completed" : "approved", proposedBy: a.userId, approvedBy: a.managerId, approvedAt: new Date(2025, 11, between(1, 15)),
          strengthsComment: done ? pick(STRENGTHS) : null, developmentComment: done ? pick(DEV_POINTS) : null, completedAt: done ? new Date(2026, 0, between(5, 20)) : null, _mgr: mgrRating });
      }
    }
  }
  for (let i = 0; i < objRows.length; i += 300) await db.insert(S.performanceObjectives).values(objRows.slice(i, i + 300));
  for (let i = 0; i < ratingRows.length; i += 300) await db.insert(S.appraisalBehaviourRatings).values(ratingRows.slice(i, i + 300));
  const toInsert = fbRows.map(({ _mgr, ...r }) => r);
  const inserted: any[] = [];
  for (let i = 0; i < toInsert.length; i += 300) inserted.push(...await db.insert(S.feedbackRequests).values(toInsert.slice(i, i + 300)).returning());
  const respRows: any[] = [];
  inserted.filter(r => r.status === "completed").forEach(r => {
    const src = fbRows.find(f => f.appraisalId === r.appraisalId && f.raterId === r.raterId)!;
    for (const b of behavs) respRows.push({ requestId: r.id, behaviourId: b.id, rating: clamp(src._mgr + between(-1, 1), 1, 5) });
  });
  for (let i = 0; i < respRows.length; i += 300) await db.insert(S.feedbackResponses).values(respRows.slice(i, i + 300));
  for (const a of apps25) { if (["signed_off", "meeting", "manager_review"].includes((await db.select({ s: S.appraisals.status }).from(S.appraisals).where(eq(S.appraisals.id, a.id)))[0].s)) await perf.recomputeAppraisalScores(a.id); }
  await perf.closeCycle(c25.id);

  // ---- 2026 cycle: open, at mixed stages
  const c26 = await perf.saveCycle({ name: "2026 Annual Review", year: 2026, startDate: "2026-01-01", endDate: "2026-12-31", objectiveDeadline: "2026-02-27", selfReviewDeadline: "2027-01-15", managerReviewDeadline: "2027-02-12", ratingScale: 5, includes360: true, requiresCalibration: false });
  await perf.launchCycle(c26.id);
  const apps26 = await db.select().from(S.appraisals).where(eq(S.appraisals.cycleId, c26.id));
  const obj26: any[] = [];
  for (const a of apps26) {
    const u = userById.get(a.userId); if (!u) continue;
    const role = roleById.get(u.jobRoleId!)!;
    const pool = OBJECTIVES[FAMILY_TO_POOL[familyCode(role.jobFamilyId)] || "lead"];
    const chosen = [...pool].sort(() => rnd() - 0.5).slice(0, 3);
    const r = rnd();
    const stage = r < 0.55 ? "agreed" : r < 0.8 ? "self_review" : r < 0.92 ? "manager_review" : "draft";
    chosen.forEach((o, i) => {
      const progress = stage === "draft" ? 0 : between(20, 95);
      obj26.push({ appraisalId: a.id, userId: a.userId, cycleId: c26.id, title: o.title, successMeasure: o.measure, category: o.category, weighting: [40, 30, 30][i], targetDate: new Date("2026-12-31"),
        status: stage === "draft" ? "draft" : progress > 0 ? "in_progress" : "agreed", agreedAt: stage === "draft" ? null : new Date(2026, 1, between(1, 25)), progressPercent: progress,
        selfOutcome: stage === "manager_review" ? pick(["met", "met", "partially_met", "exceeded"]) : null, selfComment: stage === "manager_review" ? "Delivered the main outcome; some scope moved." : null });
    });
    const status = stage === "agreed" ? "objectives" : stage === "draft" ? "objectives" : stage;
    const patch: any = { status, initiatedBy: a.managerId };
    // staggered due dates so the To do list and 30-day reminders have something to show today
    if (stage === "self_review") patch.selfReviewDueDate = daysFromNow(between(3, 28));
    if (stage === "manager_review") { patch.selfReviewDueDate = daysFromNow(-between(2, 10)); patch.managerReviewDueDate = daysFromNow(between(-3, 25)); }
    if (stage === "draft" || stage === "agreed") patch.objectivesDueDate = daysFromNow(between(-10, 20));
    if (stage === "manager_review") { patch.selfSummary = pick(SELF_TEXT); patch.selfPerformanceRating = between(3, 5); patch.selfSubmittedAt = daysFromNow(-between(1, 10)); }
    await db.update(S.appraisals).set(patch).where(eq(S.appraisals.id, a.id));
    if (stage === "manager_review") for (const b of behavs) ratingRows.push({ appraisalId: a.id, behaviourId: b.id, selfRating: between(3, 5), selfComment: null });
  }
  for (let i = 0; i < obj26.length; i += 300) await db.insert(S.performanceObjectives).values(obj26.slice(i, i + 300));
  const rr26 = ratingRows.filter(r => apps26.some(a => a.id === r.appraisalId));
  for (let i = 0; i < rr26.length; i += 300) await db.insert(S.appraisalBehaviourRatings).values(rr26.slice(i, i + 300)).onConflictDoNothing();
  // a few 360 requests in flight: some waiting for manager approval, some waiting for the rater
  const sample = apps26.filter(() => chance(0.25)).slice(0, 10);
  const inflight: any[] = [];
  for (const a of sample) {
    const cands = people.filter(p => p.id !== a.userId && p.id !== a.managerId);
    const raters = [...cands].sort(() => rnd() - 0.5).slice(0, 3);
    raters.forEach((p, i) => inflight.push({ appraisalId: a.id, subjectUserId: a.userId, raterId: p.id, raterType: ["peer", "stakeholder", "direct_report"][i], status: i === 0 ? "proposed" : "approved", proposedBy: a.userId, approvedBy: i === 0 ? null : a.managerId, approvedAt: i === 0 ? null : daysFromNow(-between(1, 20)) }));
  }
  // and give the demo admin a feedback inbox so that screen has content
  const admin = (await db.select().from(S.users).where(eq(S.users.role, "super_admin")))[0];
  if (admin) for (const a of apps26.filter(() => chance(0.1)).slice(0, 3)) if (a.userId !== admin.id) inflight.push({ appraisalId: a.id, subjectUserId: a.userId, raterId: admin.id, raterType: "stakeholder", status: "approved", proposedBy: a.userId, approvedBy: a.managerId, approvedAt: daysFromNow(-3) });
  const seen = new Set<string>();
  const uniq = inflight.filter(r => { const k = r.appraisalId + r.raterId; if (seen.has(k)) return false; seen.add(k); return true; });
  if (uniq.length) await db.insert(S.feedbackRequests).values(uniq).onConflictDoNothing();

  // ---- 2027 cycle: open with NO reviews yet, so a manager can start one for a direct report during the demo
  const c27 = await perf.saveCycle({ name: "2027 Annual Review", year: 2027, startDate: "2027-01-01", endDate: "2027-12-31", objectiveDeadline: "2027-02-26", selfReviewDeadline: "2028-01-14", managerReviewDeadline: "2028-02-11", ratingScale: 5, includes360: true, requiresCalibration: false });
  await perf.launchCycle(c27.id, null, "open_only");

  const count = async (t: any, l: string) => `${l}=${(await db.select({ n: sql<number>`count(*)::int` }).from(t))[0].n}`;
  console.log(`Seeded performance demo data into ${dbName}`);
  console.log([await count(S.behaviours, "behaviours"), await count(S.userExperience, "experience"), await count(S.userQualifications, "qualifications"), await count(S.performanceCycles, "cycles"),
    await count(S.appraisals, "appraisals"), await count(S.performanceObjectives, "objectives"), await count(S.feedbackRequests, "360_requests"), await count(S.feedbackResponses, "360_responses")].join("  "), `| signed off in 2025: ${signed}`);
  await pool.end();
}
main().catch(async e => { console.error("SEED FAILED:", e?.message || e); try { await pool.end(); } catch {} process.exit(1); });
