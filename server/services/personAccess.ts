// Who may see or act on a particular person's assessment records (ASVS 8.2.2: per-record checks, not just "has the assessor role").
// One place, so every route answers the question the same way.
import { db } from "../db";
import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { candidateAllocations, verifierAllocations, users } from "@shared/schema";
const normalizeRole = (role: string) => role.toLowerCase().trim().replace(/[\s-]+/g, "_");

const ADMIN_ROLES = ["developer", "super_admin", "admin"];

type Subject = { candidateId: string; assessorId?: string | null };

// Everyone who reports to this person, directly or through other managers (as manager or as day-to-day supervisor).
async function isInReportingChain(requesterId: string, subjectId: string): Promise<boolean> {
  let current: string | null = subjectId;
  for (let hops = 0; current && hops < 12; hops++) {
    const row: { managerId: string | null; supervisorId: string | null } | undefined =
      (await db.select({ managerId: users.managerId, supervisorId: users.supervisorId }).from(users).where(eq(users.id, current)))[0];
    if (!row) return false;
    if (row.managerId === requesterId || row.supervisorId === requesterId) return true;
    current = row.managerId;
  }
  return false;
}

export async function assessorsOf(candidateId: string): Promise<string[]> {
  const rows = await db.select({ a: candidateAllocations.assessorId }).from(candidateAllocations)
    .where(and(eq(candidateAllocations.candidateId, candidateId), eq(candidateAllocations.isActive, true)));
  return rows.map(r => r.a);
}

/**
 * May `requesterId` (acting with `roles`) read the assessment records of `subject`?
 *  - the candidate themself
 *  - an administrator
 *  - the assessor on the assessment, or any assessor allocated to the candidate
 *  - an internal verifier allocated to one of those assessors
 *  - the candidate's manager or supervisor (anywhere up the reporting line)
 */
export async function canAccessAssessment(requesterId: string, rawRoles: string[], subject: Subject): Promise<boolean> {
  const roles = rawRoles.map(normalizeRole);
  if (!requesterId) return false;
  if (requesterId === subject.candidateId) return true;
  if (roles.some(r => ADMIN_ROLES.includes(r))) return true;
  const assessors = new Set(await assessorsOf(subject.candidateId));
  if (subject.assessorId) assessors.add(subject.assessorId);
  if (roles.includes("assessor") && assessors.has(requesterId)) return true;
  if ((roles.includes("internal_verifier") || roles.includes("external_verifier")) && assessors.size) { // an external verifier sees what an administrator has allocated, the same way
    const hit = await db.select({ id: verifierAllocations.id }).from(verifierAllocations)
      .where(and(eq(verifierAllocations.verifierId, requesterId), eq(verifierAllocations.isActive, true), or(isNull(verifierAllocations.endsOn), gt(verifierAllocations.endsOn, new Date())), inArray(verifierAllocations.assessorId, Array.from(assessors))));
    if (hit.length) return true;
  }
  if (await isInReportingChain(requesterId, subject.candidateId)) return true; // anyone set as the candidate's manager or supervisor
  return false;
}

/**
 * Everyone this person may see the personal records of, other than administrators (who see everyone: returns null).
 * Themself, everyone who reports to them (as manager or supervisor, at any depth), the candidates allocated to them as an assessor, and the
 * candidates of the assessors a verifier is allocated to.
 */
export async function accessiblePersonIds(requesterId: string, rawRoles: string[]): Promise<Set<string> | null> {
  const roles = rawRoles.map(normalizeRole);
  if (roles.some(r => ADMIN_ROLES.includes(r))) return null;
  const ids = new Set<string>([requesterId]);
  const reports = await db.execute(sql`
    with recursive r(id) as (
      select id from users where manager_id = ${requesterId} or supervisor_id = ${requesterId}
      union
      select u.id from users u join r on u.manager_id = r.id or u.supervisor_id = r.id
    ) select id from r`);
  for (const row of reports.rows as any[]) ids.add(row.id);
  const allocated = await db.execute(sql`
    select candidate_id as id from candidate_allocations where assessor_id = ${requesterId} and is_active
    union
    select ca.candidate_id as id from verifier_allocations va join candidate_allocations ca on ca.assessor_id = va.assessor_id
      where va.verifier_id = ${requesterId} and va.is_active and (va.ends_on is null or va.ends_on > now()) and ca.is_active`);
  for (const row of allocated.rows as any[]) ids.add(row.id);
  // a contractor company's administrator: that company's people, and only those
  if (roles.includes("contractor_admin")) {
    const company = await db.execute(sql`
      select id from users where employment_type = 'contractor' and contract_company_id is not null
        and contract_company_id = (select contract_company_id from users where id = ${requesterId})`);
    for (const row of company.rows as any[]) ids.add(row.id);
  }
  return ids;
}

export async function canAccessPerson(requesterId: string, rawRoles: string[], subjectId: string): Promise<boolean> {
  if (!requesterId || !subjectId) return false;
  if (requesterId === subjectId) return true;
  const scope = await accessiblePersonIds(requesterId, rawRoles);
  return scope === null || scope.has(subjectId);
}
