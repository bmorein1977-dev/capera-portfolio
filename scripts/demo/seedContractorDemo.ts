/**
 * Adds contractor management to the fictional demo company: two contracting companies, a contractor administrator for each, their people (some
 * ready to work, some not, one waiting for approval) with training and competence declared by the contractor, and an external verifier allocated
 * to two assessors. Run after seedCleanDemo.ts and after applying migrations/0053_contractor_management.sql.
 *
 *   npx tsx scripts/demo/seedContractorDemo.ts            (add; safe to run again)
 *   npx tsx scripts/demo/seedContractorDemo.ts --reset    (remove everything this script made, then add it again)
 *
 * Refuses to run unless the database name contains "demo".
 */
import { db, pool } from "../../server/db";
import * as S from "../../shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DbStorage } from "../../server/storage";

const dbName = (() => { try { return new URL(process.env.DATABASE_URL || "").pathname.replace(/^\//, ""); } catch { return ""; } })();
if (!/demo/i.test(dbName)) { console.error(`Refusing to run against "${dbName}": database name must contain "demo".`); process.exit(1); }
const RESET = process.argv.includes("--reset");
const DAY = 86400000;
const when = (days: number) => new Date(Date.now() + days * DAY);
const storage = new DbStorage();

const COMPANIES = ["Harbour Engineering Ltd", "Northern Scaffolding Services"];
type P = { id: string; first: string; last: string; email: string; co: 0 | 1; vantage?: string; state: "ready" | "gaps" | "expired" | "pending" };
const ADMINS = [
  { id: "demo-ctr-carla", first: "Carla", last: "Harbour", email: "carla.harbour@example.com", co: 0 as const },
  { id: "demo-ctr-ravi", first: "Ravi", last: "Nair", email: "ravi.nair@example.com", co: 1 as const },
];
const PEOPLE: P[] = [
  { id: "demo-ctr-jamie", first: "Jamie", last: "Rowe", email: "jamie.rowe@example.com", co: 0, vantage: "V2041187", state: "gaps" },
  { id: "demo-ctr-sophie", first: "Sophie", last: "Marsh", email: "sophie.marsh@example.com", co: 0, vantage: "V2041190", state: "ready" },
  { id: "demo-ctr-dev", first: "Dev", last: "Patel", email: "dev.patel@example.com", co: 0, vantage: "V2041203", state: "expired" },
  { id: "demo-ctr-priya", first: "Priya", last: "Sethi", email: "priya.sethi@example.com", co: 0, state: "pending" },
  { id: "demo-ctr-tom", first: "Tom", last: "Gill", email: "tom.gill@example.com", co: 1, vantage: "V2057714", state: "ready" },
  { id: "demo-ctr-aisha", first: "Aisha", last: "Karim", email: "aisha.karim@example.com", co: 1, vantage: "V2057720", state: "gaps" },
  { id: "demo-ctr-luke", first: "Luke", last: "Byrne", email: "luke.byrne@example.com", co: 1, state: "pending" },
];
const EXTERNAL = { id: "demo-ext-eva", first: "Eva", last: "Outside", email: "eva.outside@example.com" };

async function reset() {
  const ids = [...ADMINS, ...PEOPLE, EXTERNAL].map(u => u.id);
  await db.delete(S.contractorDeclarations).where(inArray(S.contractorDeclarations.userId, ids));
  await db.delete(S.trainingCompletionAudit).where(inArray(S.trainingCompletionAudit.userId, ids));
  await db.delete(S.trainingEnrollments).where(inArray(S.trainingEnrollments.userId, ids));
  await db.delete(S.assessments).where(inArray(S.assessments.candidateId, ids));
  await db.delete(S.verifierAllocations).where(inArray(S.verifierAllocations.verifierId, ids));
  await db.delete(S.users).where(inArray(S.users.id, ids));
  await db.delete(S.contractCompanies).where(inArray(S.contractCompanies.name, COMPANIES));
  console.log("Removed the contractor demo data.");
}

async function pickRole() {
  // a role with several required trainings and competence elements, so the people have something to be ready or not ready for
  const rows = (await db.execute(sql`
    select jr.id, jr.name, (select count(*)::int from role_trainings rt where rt.role_id = jr.id and rt.required and coalesce(rt.is_active, true)) t,
      (select count(*)::int from role_elements re where re.role_id = jr.id and re.required and coalesce(re.is_active, true)) e
    from job_roles jr order by (select count(*) from role_trainings rt where rt.role_id = jr.id and rt.required) desc limit 6`)).rows as any[];
  const good = rows.filter(r => r.t >= 2 && r.e >= 2);
  if (!good.length) throw new Error("No job role with required training and competence found. Run seedCleanDemo.ts first.");
  return good;
}

async function declare(userId: string, companyId: string, adminId: string, kind: "training" | "competence", refId: string, achieved: Date, expiry: Date | null, ref: string) {
  if (kind === "training") {
    const enr = await storage.createTrainingEnrollment({ userId, trainingId: refId, allocatedBy: adminId, status: "completed", achievementDate: achieved, expiryDate: expiry } as any);
    await storage.recordTrainingCompletion({ userId, trainingId: refId, enrollmentId: enr.id, method: "contractor_declared", completedAt: achieved } as any);
    await db.insert(S.contractorDeclarations).values({ userId, contractCompanyId: companyId, kind, trainingId: refId, trainingEnrollmentId: enr.id, achievedAt: achieved, expiryDate: expiry, certificateRef: ref, declaredBy: adminId });
  } else {
    const asm = await storage.createAssessment({
      candidateId: userId, elementId: refId, assessorId: adminId, assessmentDate: achieved, outcome: "competent", expiryDate: expiry,
      assessorComments: `Declared by the contractor company's administrator (certificate ${ref})`, origin: "contractor_declared", isAssignment: false, verificationStatus: "not_verified",
    } as any);
    await db.insert(S.contractorDeclarations).values({ userId, contractCompanyId: companyId, kind, elementId: refId, assessmentId: asm.id, achievedAt: achieved, expiryDate: expiry, certificateRef: ref, declaredBy: adminId });
  }
}

async function main() {
  if (RESET) await reset();
  const roles = await pickRole();

  // companies
  const companyIds: string[] = [];
  for (const name of COMPANIES) {
    const ex = (await db.select().from(S.contractCompanies).where(eq(S.contractCompanies.name, name)))[0];
    companyIds.push(ex ? ex.id : (await db.insert(S.contractCompanies).values({ name, code: name.split(" ").map(w => w[0]).join("").toUpperCase(), isActive: true }).returning())[0].id);
  }

  // administrators
  for (const a of ADMINS) {
    await db.insert(S.users).values({ id: a.id, email: a.email, firstName: a.first, lastName: a.last, role: "contractor_admin", employmentType: "contractor", contractCompanyId: companyIds[a.co], isActive: true, approvalStatus: "approved" } as any).onConflictDoNothing();
  }
  const adminOf = (co: number) => ADMINS.find(a => a.co === co)!.id;

  // people
  let n = 0;
  for (const p of PEOPLE) {
    const role = roles[n++ % roles.length];
    const existing = (await db.select().from(S.users).where(eq(S.users.id, p.id)))[0];
    if (existing) continue;
    const pending = p.state === "pending";
    await db.insert(S.users).values({
      id: p.id, email: p.email, firstName: p.first, lastName: p.last, role: "candidate", employmentType: "contractor", contractCompanyId: companyIds[p.co], jobRoleId: role.id,
      vantageNumber: p.vantage ?? null, isActive: !pending, approvalStatus: pending ? "pending" : "approved", location: "Northfield Terminal",
    } as any);
    if (pending) continue;
    await storage.assignJobRoleToUser(p.id, role.id, adminOf(p.co));
    const trainings = (await db.select().from(S.roleTrainings).where(and(eq(S.roleTrainings.roleId, role.id), eq(S.roleTrainings.required, true), eq(S.roleTrainings.isActive, true))));
    const elements = (await db.select().from(S.roleElements).where(and(eq(S.roleElements.roleId, role.id), eq(S.roleElements.required, true), eq(S.roleElements.isActive, true))));
    // one training per group, so an either-or requirement is met once
    const seen = new Set<string>(); const trs = trainings.filter(t => { const k = t.groupId ?? t.id; if (seen.has(k)) return false; seen.add(k); return true; });
    const co = companyIds[p.co], admin = adminOf(p.co);
    const cert = (i: number) => `${COMPANIES[p.co].split(" ")[0].toUpperCase().slice(0, 3)}-${p.last.toUpperCase().slice(0, 3)}-${1000 + i}`;
    if (p.state === "ready") {
      for (const [i, t] of trs.entries()) await declare(p.id, co, admin, "training", t.trainingId, when(-120 - i * 7), when(240 - i * 5), cert(i));
      for (const [i, e] of elements.entries()) await declare(p.id, co, admin, "competence", e.elementId, when(-90 - i * 3), when(400 + i * 9), cert(50 + i));
    } else if (p.state === "gaps") {
      // some done, some still missing; one competence about to lapse
      for (const [i, t] of trs.slice(0, Math.ceil(trs.length / 2)).entries()) await declare(p.id, co, admin, "training", t.trainingId, when(-60 - i * 4), when(300 - i * 6), cert(i));
      for (const [i, e] of elements.slice(0, 1).entries()) await declare(p.id, co, admin, "competence", e.elementId, when(-340), when(25 + i), cert(50 + i));
    } else if (p.state === "expired") {
      for (const [i, t] of trs.entries()) await declare(p.id, co, admin, "training", t.trainingId, when(-420 - i * 3), when(i === 0 ? -20 : 150 - i * 4), cert(i));
      for (const [i, e] of elements.entries()) await declare(p.id, co, admin, "competence", e.elementId, when(-200), when(i === 0 ? -5 : 220 + i * 7), cert(50 + i));
    }
  }

  // an external verifier, allocated to two assessors (read only)
  await db.insert(S.users).values({ id: EXTERNAL.id, email: EXTERNAL.email, firstName: EXTERNAL.first, lastName: EXTERNAL.last, role: "external_verifier", isActive: true, approvalStatus: "approved" } as any).onConflictDoNothing();
  for (const assessorId of ["demo-dan", "demo-liam"]) {
    const exists = (await db.select().from(S.users).where(eq(S.users.id, assessorId)))[0];
    if (!exists) continue;
    const has = (await db.select().from(S.verifierAllocations).where(and(eq(S.verifierAllocations.verifierId, EXTERNAL.id), eq(S.verifierAllocations.assessorId, assessorId))))[0];
    if (!has) await db.insert(S.verifierAllocations).values({ verifierId: EXTERNAL.id, assessorId, isActive: true } as any);
  }

  console.log("Contractor demo ready:");
  console.log(`  Companies: ${COMPANIES.join(", ")}`);
  console.log(`  Contractor administrators: ${ADMINS.map(a => `${a.first} ${a.last}`).join(", ")} (use Switch User, or Edit User to see them)`);
  console.log(`  People: ${PEOPLE.length} (ready, not ready, expired and two waiting for approval)`);
  console.log(`  External verifier: ${EXTERNAL.first} ${EXTERNAL.last}, allocated to Dan Kowalski and Liam Fenwick`);
}

main().then(() => pool.end()).catch(e => { console.error(e); pool.end().finally(() => process.exit(1)); });
