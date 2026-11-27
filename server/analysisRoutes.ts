// Organisation-wide skills gap analysis, and records of standardisation meetings.
import type { Express } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { competencyElements, jobRoles, kpiTargets, standardisationRecords, users } from "@shared/schema";
import { standingsFor } from "./services/competenceRecords";
import { trainingStandings } from "./services/trainingStandings";
import { isValidStatus } from "@shared/competence";

export interface GapCounts { required: number; inDate: number; expiring: number; expired: number; missing: number; exempt: number; coverage: number | null }
const blank = (): GapCounts => ({ required: 0, inDate: 0, expiring: 0, expired: 0, missing: 0, exempt: 0, coverage: null });
function add(c: GapCounts, status: string, exempt = false) {
  if (exempt) { c.exempt++; return; }
  c.required++;
  if (isValidStatus(status)) { c.inDate++; if (status !== "current") c.expiring++; }
  else if (status === "expired") c.expired++;
  else c.missing++;
}
const finish = <T extends GapCounts>(list: T[]) => list.map((c) => ({ ...c, coverage: c.required ? Math.round((c.inDate / c.required) * 1000) / 10 : null }));
const worstFirst = <T extends GapCounts & { safetyCritical?: boolean }>(list: T[]) => finish(list).sort((a, b) => (b.missing + b.expired) - (a.missing + a.expired) || Number(b.safetyCritical) - Number(a.safetyCritical) || (a.coverage ?? 101) - (b.coverage ?? 101));

export interface GapFilters { jobRoleId?: string; location?: string; team?: string; safetyCriticalOnly?: boolean }

/** where the organisation (or, for a manager, their own people) falls short of what its job roles require */
export async function skillsGapAnalysis(filters: GapFilters, scope: Set<string> | null, now = new Date()) {
  const everyone = (await db.select().from(users)).filter((u) => u.isActive !== false && !u.isArchived && !u.anonymisedAt && u.approvalStatus !== "pending" && u.approvalStatus !== "visitor" && !!(u.jobRoleId || u.secondaryJobRoleId));
  const visible = everyone.filter((u) => !scope || scope.has(u.id));
  const people = visible.filter((u) => (!filters.jobRoleId || u.jobRoleId === filters.jobRoleId || u.secondaryJobRoleId === filters.jobRoleId) && (!filters.location || u.location === filters.location) && (!filters.team || u.teamShift === filters.team));
  const ids = people.map((u) => u.id);
  const byId = new Map(people.map((u) => [u.id, u]));
  const roles = new Map((await db.select().from(jobRoles)).map((r) => [r.id, r.name]));
  const [competence, training] = await Promise.all([standingsFor(ids, now), trainingStandings(ids, now)]);

  const standards = new Map<string, GapCounts & { elementId: string; code: string | null; name: string; safetyCritical: boolean; shortfall: Array<{ userId: string; name: string; status: string }> }>();
  const byRole = new Map<string, GapCounts & { name: string; people: Set<string> }>();
  const bySite = new Map<string, GapCounts & { name: string; people: Set<string> }>();
  const totals = blank(), critical = blank();
  const bucket = (m: Map<string, GapCounts & { name: string; people: Set<string> }>, name: string) => { let b = m.get(name); if (!b) { b = { ...blank(), name, people: new Set() }; m.set(name, b); } return b; };
  const personName = (id: string) => { const u = byId.get(id); return u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : ""; };

  for (const s of competence) {
    if (filters.safetyCriticalOnly && !s.requirement.safetyCritical) continue;
    const u = byId.get(s.requirement.userId)!;
    let row = standards.get(s.requirement.elementId);
    if (!row) { row = { ...blank(), elementId: s.requirement.elementId, code: s.requirement.element.code, name: s.requirement.element.name, safetyCritical: false, shortfall: [] }; standards.set(row.elementId, row); }
    row.safetyCritical = row.safetyCritical || s.requirement.safetyCritical;
    const role = bucket(byRole, (u.jobRoleId && roles.get(u.jobRoleId)) || "No job role"), site = bucket(bySite, u.location || "No location");
    role.people.add(u.id); site.people.add(u.id);
    for (const c of [row, role, site, totals, ...(s.requirement.safetyCritical ? [critical] : [])]) add(c, s.status, s.exempt);
    if (!s.exempt && !isValidStatus(s.status)) row.shortfall.push({ userId: u.id, name: personName(u.id), status: s.status });
  }

  const courses = new Map<string, GapCounts & { requirement: string; name: string; safetyCritical: boolean }>();
  const trainingTotals = blank();
  for (const t of training) {
    if (filters.safetyCriticalOnly && !t.safetyCritical) continue;
    let row = courses.get(t.requirement);
    if (!row) { row = { ...blank(), requirement: t.requirement, name: t.label, safetyCritical: false }; courses.set(t.requirement, row); }
    row.safetyCritical = row.safetyCritical || t.safetyCritical;
    add(row, t.status); add(trainingTotals, t.status);
  }

  const targets = Object.fromEntries((await db.select().from(kpiTargets)).map((t) => [t.key, t.targetPercentage]));
  const shape = (m: Map<string, GapCounts & { name: string; people: Set<string> }>) => worstFirst(Array.from(m.values()).map(({ people: set, ...r }) => ({ ...r, people: set.size })));
  return {
    generatedAt: now.toISOString(),
    people: people.length,
    competence: finish([totals])[0], safetyCriticalCompetence: finish([critical])[0], training: finish([trainingTotals])[0],
    targets,
    byStandard: worstFirst(Array.from(standards.values())),
    byRole: shape(byRole), bySite: shape(bySite),
    byTraining: worstFirst(Array.from(courses.values())),
    options: {
      jobRoles: Array.from(new Set(visible.map((u) => u.jobRoleId).filter(Boolean) as string[])).map((id) => ({ id, name: roles.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name)),
      locations: Array.from(new Set(visible.map((u) => u.location).filter(Boolean) as string[])).sort(),
      teams: Array.from(new Set(visible.map((u) => u.teamShift).filter(Boolean) as string[])).sort(),
    },
  };
}

const dayText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const record = z.object({
  heldOn: dayText, title: z.string().trim().min(3).max(300), elementId: z.string().max(100).nullable().optional(),
  attendeeIds: z.array(z.string().max(100)).min(1, "Name who attended").max(100), sampleAssessmentIds: z.array(z.string().max(100)).max(100).default([]),
  discussion: z.string().trim().min(10, "Record what was compared and discussed").max(8000), agreedApproach: z.string().max(8000).nullable().optional(),
  actions: z.array(z.object({ what: z.string().trim().min(3).max(1000), ownerId: z.string().max(100).nullable().optional(), dueOn: dayText.nullable().optional(), doneOn: dayText.nullable().optional() }).strict()).max(50).default([]),
}).strict();

export function registerAnalysisRoutes(app: Express, deps: { requireRole: (...roles: string[]) => any; actingUser: (req: any) => Promise<{ id: string; roles: string[] }>; personScope: (req: any) => Promise<Set<string> | null> }) {
  const { requireRole, actingUser, personScope } = deps;
  const guard = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { const out = await fn(req, res); if (out !== undefined && !res.headersSent) res.json(out); }
    catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message ?? "Some of the details are not valid" });
      console.error("Analysis request failed:", e);
      res.status(500).json({ error: "The request could not be completed" });
    }
  };

  app.get("/api/reports/skills-gap", requireRole("developer", "admin", "super_admin", "manager", "assessor", "internal_verifier"), guard(async (req) => {
    const q = z.object({ jobRoleId: z.string().max(100).optional(), location: z.string().max(200).optional(), team: z.string().max(200).optional(), safetyCriticalOnly: z.enum(["true", "false"]).optional() }).parse(req.query);
    return skillsGapAnalysis({ ...q, safetyCriticalOnly: q.safetyCriticalOnly === "true" }, await personScope(req));
  }));

  // ---------------------------------------------------------------------------------------------------------------- standardisation
  const readers = requireRole("developer", "admin", "super_admin", "internal_verifier", "assessor", "external_verifier");
  const writers = requireRole("developer", "admin", "super_admin", "internal_verifier");
  const isAdmin = (roles: string[]) => roles.some((r) => ["admin", "super_admin", "developer"].includes(r));

  app.get("/api/standardisation", readers, guard(async (req) => {
    const me = await actingUser(req);
    const all = await db.select().from(standardisationRecords).where(eq(standardisationRecords.isActive, true)).orderBy(desc(standardisationRecords.heldOn));
    // assessors see the meetings they took part in; verifiers, administrators and external verifiers see them all
    const seesAll = isAdmin(me.roles) || me.roles.includes("internal_verifier") || me.roles.includes("external_verifier");
    const mine = seesAll ? all : all.filter((r) => r.attendeeIds.includes(me.id) || r.facilitatorId === me.id);
    const ids = Array.from(new Set(mine.flatMap((r) => [r.facilitatorId, ...r.attendeeIds, ...r.actions.map((a) => a.ownerId)]).filter(Boolean) as string[]));
    const names = new Map(ids.length ? (await db.select().from(users).where(inArray(users.id, ids))).map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()]) : []);
    const elementIds = Array.from(new Set(mine.map((r) => r.elementId).filter(Boolean) as string[]));
    const elements = new Map(elementIds.length ? (await db.select().from(competencyElements).where(inArray(competencyElements.id, elementIds))).map((e) => [e.id, `${e.code ?? ""} ${e.name}`.trim()]) : []);
    const people = me.roles.includes("external_verifier") && !isAdmin(me.roles) ? [] : (await db.select().from(users))
      .filter((u) => u.isActive !== false && !u.isArchived && ["assessor", "internal_verifier", "admin", "super_admin"].includes(u.role))
      .map((u) => ({ id: u.id, name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() }));
    return {
      mayRecord: me.roles.includes("internal_verifier") || isAdmin(me.roles),
      people,
      records: mine.map((r) => ({ ...r, facilitatorName: names.get(r.facilitatorId) ?? null, attendeeNames: r.attendeeIds.map((i) => names.get(i) ?? "Former colleague"), elementName: r.elementId ? elements.get(r.elementId) ?? null : null,
        actions: r.actions.map((a) => ({ ...a, ownerName: a.ownerId ? names.get(a.ownerId) ?? null : null })), mayEdit: isAdmin(me.roles) || r.facilitatorId === me.id })),
    };
  }));

  app.post("/api/standardisation", writers, guard(async (req, res) => {
    const body = record.parse(req.body);
    if (body.heldOn > new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: "Record a meeting once it has been held" });
    const me = await actingUser(req);
    res.status(201);
    return (await db.insert(standardisationRecords).values({ ...body, elementId: body.elementId || null, agreedApproach: body.agreedApproach || null, facilitatorId: me.id, createdBy: me.id }).returning())[0];
  }));

  app.put("/api/standardisation/:id", writers, guard(async (req, res) => {
    const body = record.parse(req.body);
    const me = await actingUser(req);
    const existing = (await db.select().from(standardisationRecords).where(and(eq(standardisationRecords.id, req.params.id), eq(standardisationRecords.isActive, true))))[0];
    if (!existing) return res.status(404).json({ error: "Record not found" });
    if (!isAdmin(me.roles) && existing.facilitatorId !== me.id) return res.status(403).json({ error: "Only the facilitator or an administrator can change this record" });
    return (await db.update(standardisationRecords).set({ ...body, elementId: body.elementId || null, agreedApproach: body.agreedApproach || null, updatedAt: new Date() }).where(eq(standardisationRecords.id, existing.id)).returning())[0];
  }));
}
