// Database side of shared/competence.ts: the validity period that applies to a person, and where people stand against what their roles require.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { assessments, competencyElements, roleElements, users } from "@shared/schema";
import { groupByPair, standingFor, type RoleValidity, type Standing } from "@shared/competence";

type AssessmentRow = typeof assessments.$inferSelect;
type ElementRow = typeof competencyElements.$inferSelect;

const chunks = <T,>(list: T[], size = 500): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
export const pairKey = (candidateId: string, elementId: string) => `${candidateId}:${elementId}`;

export interface Requirement { userId: string; elementId: string; required: boolean; validityYears: number | null; safetyCritical: boolean; element: ElementRow }

/**
 * What each person's primary and secondary job roles require. Where both roles ask for the same standard, the shorter validity period and the
 * stricter safety-critical setting apply.
 */
export async function requirementsFor(userIds: string[]): Promise<Map<string, Requirement>> {
  const out = new Map<string, Requirement>();
  for (const part of chunks(userIds)) {
    if (!part.length) continue;
    const rows = await db.select({ userId: users.id, re: roleElements, el: competencyElements }).from(users)
      .innerJoin(roleElements, sql`${roleElements.roleId} in (${users.jobRoleId}, ${users.secondaryJobRoleId})`)
      .innerJoin(competencyElements, eq(roleElements.elementId, competencyElements.id))
      .where(and(inArray(users.id, part), eq(roleElements.isActive, true)));
    for (const r of rows) {
      const key = pairKey(r.userId, r.re.elementId);
      const prev = out.get(key);
      const years = r.re.validityYears ?? null;
      const critical = r.re.safetyCritical ?? r.el.safetyCriticality === "High";
      out.set(key, {
        userId: r.userId, elementId: r.re.elementId, element: r.el,
        required: !!(prev?.required || (r.re.required ?? true)),
        validityYears: prev?.validityYears && years ? Math.min(prev.validityYears, years) : years ?? prev?.validityYears ?? null,
        safetyCritical: !!(prev?.safetyCritical || critical),
      });
    }
  }
  return out;
}

/** the role's own validity period for one person and one standard, if their role sets one */
export async function roleValidityFor(candidateId: string, elementId: string): Promise<RoleValidity | null> {
  const r = (await requirementsFor([candidateId])).get(pairKey(candidateId, elementId));
  return r?.validityYears ? { validityYears: r.validityYears } : null;
}

export async function assessmentRowsFor(userIds: string[]): Promise<AssessmentRow[]> {
  const out: AssessmentRow[] = [];
  for (const part of chunks(userIds)) if (part.length) out.push(...await db.select().from(assessments).where(and(inArray(assessments.candidateId, part), eq(assessments.isActive, true))));
  return out;
}

export interface PersonStanding extends Standing<AssessmentRow> { requirement: Requirement; rows: AssessmentRow[] }

/** where these people stand against every standard their roles require */
export async function standingsFor(userIds: string[], now = new Date()): Promise<PersonStanding[]> {
  const [required, rows] = await Promise.all([requirementsFor(userIds), assessmentRowsFor(userIds)]);
  const byPair = groupByPair(rows);
  return Array.from(required.values()).filter((r) => r.required).map((r) => {
    const own = byPair.get(pairKey(r.userId, r.elementId)) ?? [];
    return { ...standingFor(own, r.element, r, now), requirement: r, rows: own };
  });
}
