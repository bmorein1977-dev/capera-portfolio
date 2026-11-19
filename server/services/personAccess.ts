// Who may see or act on a particular person's assessment records (ASVS 8.2.2: per-record checks, not just "has the assessor role").
// One place, so every route answers the question the same way.
import { db } from "../db";
import { and, eq, inArray } from "drizzle-orm";
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
  if (roles.includes("internal_verifier") && assessors.size) {
    const hit = await db.select({ id: verifierAllocations.id }).from(verifierAllocations)
      .where(and(eq(verifierAllocations.verifierId, requesterId), eq(verifierAllocations.isActive, true), inArray(verifierAllocations.assessorId, Array.from(assessors))));
    if (hit.length) return true;
  }
  if (roles.includes("manager") && await isInReportingChain(requesterId, subject.candidateId)) return true;
  return false;
}
