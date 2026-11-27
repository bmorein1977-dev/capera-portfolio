// The integration interface, /api/v1: for a company's own systems (an HR system sending starters, movers and leavers; a reporting tool
// reading competence status). It is separate from the interface the screens use.
//
// - A system signs in with a key an administrator creates. Only a fingerprint of the key is stored; the key is shown once. Each key has
//   scopes (what it may do), may have an end date, can be revoked, and is rate limited. Its use is recorded.
// - People are matched by employee number. Nothing here can change anyone's role in Capera, or touch an administrator's account.
// - A change can always be tried first ("dryRun": true), and is applied completely or not at all unless the caller asks otherwise.
// The description of the interface is served at /api/v1/openapi.json.
import type { Express, RequestHandler } from "express";
import { createHash, randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { apiKeys, competencyElements, competencyElementVersions, jobRoles, users } from "@shared/schema";
import { standingsFor } from "./services/competenceRecords";
import { trainingStandings } from "./services/trainingStandings";
import { openApiDocument } from "./services/openApi";
import { recordSystemEvent } from "./services/auditLog";
import type { IStorage } from "./storage";

export const API_SCOPES = {
  "people:read": "Read people and where they sit in the organisation",
  "competence:read": "Read competence status, training status and standards",
  "people:write": "Add, update and mark as left people from an HR system",
} as const;
export type ApiScope = keyof typeof API_SCOPES;

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
const PROTECTED_ROLES = ["developer", "super_admin", "admin"];
const WINDOW_MS = 600_000, MAX_PER_WINDOW = 600;
const uses = new Map<string, { n: number; resetAt: number }>();

function withKey(scope: ApiScope): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const presented = /^Bearer\s+(capk_[A-Za-z0-9_-]{20,100})$/.exec(req.get("authorization") ?? "")?.[1];
      if (!presented) return res.status(401).json({ error: "Send the key as: Authorization: Bearer <key>" });
      const key = (await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hashKey(presented))))[0];
      if (!key || key.revokedAt || (key.expiresAt && key.expiresAt.getTime() <= Date.now())) return res.status(401).json({ error: "That key is not valid" });
      if (!key.scopes.includes(scope)) return res.status(403).json({ error: `This key does not have the ${scope} scope` });
      const now = Date.now();
      let u = uses.get(key.id);
      if (!u || u.resetAt <= now) { u = { n: 0, resetAt: now + WINDOW_MS }; uses.set(key.id, u); }
      if (++u.n > MAX_PER_WINDOW) { res.setHeader("Retry-After", String(Math.ceil((u.resetAt - now) / 1000))); return res.status(429).json({ error: "Too many requests" }); }
      if (!key.lastUsedAt || now - key.lastUsedAt.getTime() > 60_000) await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
      req.apiKey = key;
      next();
    } catch (error) {
      console.error("API key check failed:", error);
      res.status(503).json({ error: "The key could not be checked just now" });
    }
  };
}

const paging = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(1000).default(200) });
const page = <T,>(list: T[], p: { page: number; pageSize: number }) => ({ page: p.page, pageSize: p.pageSize, total: list.length, items: list.slice((p.page - 1) * p.pageSize, p.page * p.pageSize) });
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const dayOf = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);

const dayText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const syncPerson = z.object({
  employeeNumber: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(200).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  jobRoleCode: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
  team: z.string().trim().max(200).optional(),
  managerEmployeeNumber: z.string().trim().max(60).nullable().optional(),
  employmentType: z.enum(["employee", "contractor"]).optional(),
  startDate: dayText.optional(),
  leavingDate: dayText.nullable().optional(),
}).strict();
const syncBody = z.object({ dryRun: z.boolean().default(true), applyValidRowsOnly: z.boolean().default(false), people: z.array(z.unknown()).min(1).max(2000) }).strict();

export interface SyncRow { row: number; employeeNumber: string | null; action: "create" | "update" | "leaver" | "return" | "unchanged" | "error"; changes: string[]; message?: string }
type Planned = SyncRow & { data?: z.infer<typeof syncPerson>; userId?: string; set: Record<string, unknown>; newRoleId?: string | null };

/** works out, without changing anything, what a batch from an HR system would do */
export async function planSync(rawRows: unknown[]): Promise<Planned[]> {
  const everyone = await db.select().from(users);
  const roles = await db.select().from(jobRoles);
  const roleByCode = new Map(roles.map((r) => [r.code.toLowerCase(), r]));
  const byNumber = new Map<string, typeof everyone>();
  for (const u of everyone) if (u.companyNumber) { const k = u.companyNumber.trim().toLowerCase(); byNumber.set(k, [...(byNumber.get(k) ?? []), u]); }
  const byEmail = new Map(everyone.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]));
  const parsed = rawRows.map((r) => syncPerson.safeParse(r));
  const seen = new Set<string>(), seenEmails = new Set<string>();
  const inBatch = new Set(parsed.flatMap((p) => (p.success ? [p.data.employeeNumber.toLowerCase()] : [])));

  return parsed.map((p, i): Planned => {
    const fail = (message: string, n: string | null = null): Planned => ({ row: i + 1, employeeNumber: n, action: "error", changes: [], message, set: {} });
    if (!p.success) return fail(p.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`).join("; "), typeof (rawRows[i] as any)?.employeeNumber === "string" ? (rawRows[i] as any).employeeNumber : null);
    const d = p.data, n = d.employeeNumber.toLowerCase();
    if (seen.has(n)) return fail("This employee number appears more than once in the batch", d.employeeNumber);
    seen.add(n);
    const email = d.email?.toLowerCase();
    if (email) { if (seenEmails.has(email)) return fail("This email address appears more than once in the batch", d.employeeNumber); seenEmails.add(email); }
    const matches = byNumber.get(n) ?? [];
    if (matches.length > 1) return fail("More than one person in Capera has this employee number", d.employeeNumber);
    let existing = matches[0];
    const emailOwner = email ? byEmail.get(email) : undefined;
    if (!existing && emailOwner && !emailOwner.companyNumber) existing = emailOwner; // first sync: an account without a number is matched by email, once
    if (emailOwner && existing && emailOwner.id !== existing.id) return fail("That email address belongs to someone else in Capera", d.employeeNumber);
    if (emailOwner && !existing) return fail("That email address belongs to someone with a different employee number", d.employeeNumber);
    if (existing && PROTECTED_ROLES.includes(existing.role)) return fail("This is an administrator's account, which the HR feed may not change", d.employeeNumber);
    if (existing?.anonymisedAt) return fail("This person's details have been removed, so the record cannot be changed", d.employeeNumber);
    const role = d.jobRoleCode ? roleByCode.get(d.jobRoleCode.toLowerCase()) : undefined;
    if (d.jobRoleCode && !role) return fail(`There is no job role with the code ${d.jobRoleCode}`, d.employeeNumber);
    if (d.managerEmployeeNumber) {
      const m = d.managerEmployeeNumber.toLowerCase();
      if (m === n) return fail("A person cannot be their own manager", d.employeeNumber);
      if (!byNumber.has(m) && !inBatch.has(m)) return fail(`The manager ${d.managerEmployeeNumber} is not in Capera or in this batch`, d.employeeNumber);
    }
    if (!existing && (!d.email || !d.firstName || !d.lastName)) return fail("A new person needs an email address, first name and last name", d.employeeNumber);

    const set: Record<string, unknown> = {}, changes: string[] = [];
    const change = (field: string, label: string, value: unknown, current: unknown) => { if (value !== undefined && value !== current) { set[field] = value; changes.push(label); } };
    change("firstName", "first name", d.firstName, existing?.firstName);
    change("lastName", "last name", d.lastName, existing?.lastName);
    if (email && email !== existing?.email?.toLowerCase()) { set.email = d.email; changes.push("email"); }
    change("location", "location", d.location, existing?.location);
    change("teamShift", "team", d.team, existing?.teamShift);
    change("employmentType", "employment type", d.employmentType, existing?.employmentType);
    if (d.startDate && d.startDate !== dayOf(existing?.startDate)) { set.startDate = new Date(`${d.startDate}T00:00:00Z`); changes.push("start date"); }
    if (existing && !existing.companyNumber) { set.companyNumber = d.employeeNumber; changes.push("employee number"); }
    const newRoleId = role && role.id !== existing?.jobRoleId ? role.id : null;
    if (newRoleId) changes.push("job role");
    if (d.managerEmployeeNumber !== undefined) {
      const current = existing?.managerId ? everyone.find((u) => u.id === existing!.managerId)?.companyNumber?.toLowerCase() ?? null : null;
      if ((d.managerEmployeeNumber?.toLowerCase() ?? null) !== current) changes.push("manager");
    }
    let action: SyncRow["action"] = existing ? (changes.length ? "update" : "unchanged") : "create";
    if (d.leavingDate !== undefined) {
      if (d.leavingDate && (dayOf(existing?.leftAt) !== d.leavingDate || !existing?.isArchived)) { set.leftAt = new Date(`${d.leavingDate}T23:59:59Z`); set.isArchived = true; changes.push("leaving date"); action = existing ? "leaver" : "create"; }
      if (d.leavingDate === null && existing?.isArchived) { set.leftAt = null; set.isArchived = false; set.isActive = true; changes.push("returned"); action = "return"; }
    }
    return { row: i + 1, employeeNumber: d.employeeNumber, action, changes, data: d, userId: existing?.id, set, newRoleId };
  });
}

export async function applySync(plan: Planned[], storage: IStorage, actorLabel: string): Promise<void> {
  const idByNumber = new Map((await db.select({ id: users.id, n: users.companyNumber }).from(users)).filter((u) => u.n).map((u) => [u.n!.trim().toLowerCase(), u.id]));
  const live = plan.filter((p) => p.action !== "error" && p.action !== "unchanged");
  // people first, then reporting lines, so that a manager in the same batch exists before anyone points at them
  for (const p of live) {
    if (p.action === "create" && !p.userId) {
      const id = randomUUID();
      await db.insert(users).values({ id, role: "candidate", companyNumber: p.data!.employeeNumber, isActive: true, approvalStatus: "approved", employmentType: p.data!.employmentType ?? "employee", ...(p.set as any) });
      p.userId = id;
    } else if (Object.keys(p.set).length) {
      await db.update(users).set({ ...(p.set as any), updatedAt: new Date() }).where(eq(users.id, p.userId!));
    }
    idByNumber.set(p.data!.employeeNumber.toLowerCase(), p.userId!);
  }
  for (const p of live) {
    const m = p.data!.managerEmployeeNumber;
    if (m !== undefined) await db.update(users).set({ managerId: m ? idByNumber.get(m.toLowerCase()) ?? null : null, updatedAt: new Date() }).where(eq(users.id, p.userId!));
    if (p.newRoleId && p.action !== "leaver") {
      await db.update(users).set({ jobRoleId: p.newRoleId, updatedAt: new Date() }).where(eq(users.id, p.userId!));
      await storage.assignJobRoleToUser(p.userId!, p.newRoleId);
    }
  }
  const count = (a: SyncRow["action"]) => live.filter((p) => p.action === a).length;
  await recordSystemEvent({ actorName: actorLabel, action: "HR feed applied", entityType: "People", entityLabel: `${live.length} people`, summary: `${count("create")} added, ${count("update")} updated, ${count("leaver")} marked as leaving, ${count("return")} returned` }).catch(() => {});
}

export function registerIntegrationRoutes(app: Express, deps: { storage: IStorage; requireRole: (...roles: string[]) => any; actingUser: (req: any) => Promise<{ id: string }>; ownNameOnly: any }) {
  const { storage, requireRole, actingUser, ownNameOnly } = deps;
  const admin = requireRole("admin", "super_admin", "developer");
  const guard = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { const out = await fn(req, res); if (out !== undefined && !res.headersSent) res.json(out); }
    catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "The request is not valid", details: e.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
      console.error("Integration request failed:", e);
      res.status(500).json({ error: "The request could not be completed" });
    }
  };

  // ---------------------------------------------------------------------------------------------------------------- keys (administrators)
  app.get("/api/api-keys", admin, guard(async () => {
    const list = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    return { scopes: API_SCOPES, keys: list.map(({ keyHash: _h, ...k }) => k) };
  }));
  app.post("/api/api-keys", admin, ownNameOnly, guard(async (req, res) => {
    const body = z.object({ name: z.string().trim().min(3).max(100), scopes: z.array(z.enum(Object.keys(API_SCOPES) as [ApiScope, ...ApiScope[]])).min(1), expiresOn: dayText.optional() }).strict().parse(req.body);
    const me = await actingUser(req);
    const key = `capk_${randomBytes(30).toString("base64url")}`;
    // a key lasts a year unless a shorter or longer time is chosen, and never more than two
    const latest = new Date(Date.now() + 730 * 86_400_000);
    let expiresAt = body.expiresOn ? new Date(`${body.expiresOn}T23:59:59Z`) : new Date(Date.now() + 365 * 86_400_000);
    if (expiresAt > latest) expiresAt = latest;
    if (expiresAt <= new Date()) return res.status(400).json({ error: "The end date must be in the future" });
    const row = (await db.insert(apiKeys).values({ name: body.name, prefix: key.slice(0, 10), keyHash: hashKey(key), scopes: body.scopes, createdBy: me.id, expiresAt }).returning())[0];
    await recordSystemEvent({ actorId: me.id, action: "Created an integration key", entityType: "Integration key", entityId: row.id, entityLabel: row.name, summary: `Scopes: ${body.scopes.join(", ")}` }).catch(() => {});
    res.status(201);
    const { keyHash: _h, ...safe } = row;
    return { ...safe, key };
  }));
  app.post("/api/api-keys/:id/revoke", admin, guard(async (req, res) => {
    const me = await actingUser(req);
    const row = (await db.update(apiKeys).set({ revokedAt: new Date(), revokedBy: me.id }).where(and(eq(apiKeys.id, req.params.id), sql`${apiKeys.revokedAt} is null`)).returning())[0];
    if (!row) return res.status(404).json({ error: "That key was not found or is already revoked" });
    await recordSystemEvent({ actorId: me.id, action: "Revoked an integration key", entityType: "Integration key", entityId: row.id, entityLabel: row.name, summary: "No longer accepted" }).catch(() => {});
    return { ok: true };
  }));

  // ---------------------------------------------------------------------------------------------------------------- /api/v1
  app.get("/api/v1/openapi.json", (_req, res) => res.json(openApiDocument(API_SCOPES)));

  app.get("/api/v1/people", withKey("people:read"), guard(async (req) => {
    const q = paging.extend({ updatedSince: z.string().datetime({ offset: true }).optional() }).parse(req.query);
    const [all, roles] = await Promise.all([db.select().from(users).orderBy(asc(users.lastName), asc(users.firstName), asc(users.id)), db.select().from(jobRoles)]);
    const role = new Map(roles.map((r) => [r.id, r]));
    const byId = new Map(all.map((u) => [u.id, u]));
    const since = q.updatedSince ? Date.parse(q.updatedSince) : null;
    const list = all.filter((u) => !u.anonymisedAt && u.approvalStatus !== "pending" && u.approvalStatus !== "rejected" && (since === null || new Date(u.updatedAt ?? u.createdAt ?? 0).getTime() >= since))
      .map((u) => ({
        id: u.id, employeeNumber: u.companyNumber, email: u.email, firstName: u.firstName, lastName: u.lastName,
        jobRoleCode: u.jobRoleId ? role.get(u.jobRoleId)?.code ?? null : null, jobRoleName: u.jobRoleId ? role.get(u.jobRoleId)?.name ?? null : null,
        location: u.location, team: u.teamShift, employmentType: u.employmentType,
        managerEmployeeNumber: u.managerId ? byId.get(u.managerId)?.companyNumber ?? null : null,
        startDate: dayOf(u.startDate), leavingDate: dayOf(u.leftAt), active: u.isActive !== false && !u.isArchived, updatedAt: iso(u.updatedAt),
      }));
    return page(list, q);
  }));

  const workforce = async () => (await db.select().from(users)).filter((u) => u.isActive !== false && !u.isArchived && !u.anonymisedAt && u.approvalStatus !== "pending" && u.approvalStatus !== "visitor");

  app.get("/api/v1/competence", withKey("competence:read"), guard(async (req) => {
    const q = paging.parse(req.query);
    const people = await workforce();
    const byId = new Map(people.map((u) => [u.id, u]));
    const rows = (await standingsFor(people.map((u) => u.id)))
      .map((s) => ({
        personId: s.requirement.userId, employeeNumber: byId.get(s.requirement.userId)?.companyNumber ?? null,
        standardCode: s.requirement.element.code, standardName: s.requirement.element.name, safetyCritical: s.requirement.safetyCritical,
        status: s.exempt ? "exempt" : s.status, valid: !s.exempt && s.status !== "missing" && s.status !== "expired",
        outcome: s.status === "missing" && !s.exempt ? null : s.row?.outcome ?? null,
        decidedAt: iso(s.row?.signOffAt ?? (s.status !== "missing" ? s.row?.assessmentDate : null)), expiryDate: dayOf(s.expiry),
        verification: s.status !== "missing" ? s.row?.verificationStatus ?? null : null,
      }))
      .sort((a, b) => a.personId.localeCompare(b.personId) || String(a.standardCode).localeCompare(String(b.standardCode)));
    return { asAt: new Date().toISOString(), ...page(rows, q) };
  }));

  app.get("/api/v1/training", withKey("competence:read"), guard(async (req) => {
    const q = paging.parse(req.query);
    const people = await workforce();
    const byId = new Map(people.map((u) => [u.id, u]));
    const rows = (await trainingStandings(people.map((u) => u.id)))
      .map((t) => ({ personId: t.userId, employeeNumber: byId.get(t.userId)?.companyNumber ?? null, requirement: t.label, safetyCritical: t.safetyCritical, status: t.status, valid: t.status !== "missing" && t.status !== "expired", achievedOn: dayOf(t.achievedOn), expiryDate: dayOf(t.expiry) }))
      .sort((a, b) => a.personId.localeCompare(b.personId) || a.requirement.localeCompare(b.requirement));
    return { asAt: new Date().toISOString(), ...page(rows, q) };
  }));

  app.get("/api/v1/standards", withKey("competence:read"), guard(async (req) => {
    const q = paging.parse(req.query);
    const elements = await db.select().from(competencyElements).where(eq(competencyElements.isActive, true)).orderBy(asc(competencyElements.code));
    const ids = elements.map((e) => e.currentVersionId).filter(Boolean) as string[];
    const versions = new Map(ids.length ? (await db.select({ id: competencyElementVersions.id, n: competencyElementVersions.versionNumber }).from(competencyElementVersions).where(inArray(competencyElementVersions.id, ids))).map((v) => [v.id, v.n]) : []);
    return page(elements.map((e) => ({ code: e.code, name: e.name, safetyCriticality: e.safetyCriticality, validityMonths: e.validityMonths ?? (e.reassessmentYears ? e.reassessmentYears * 12 : null), currentVersion: e.currentVersionId ? versions.get(e.currentVersionId) ?? null : null, changeControl: !!e.changeControl })), q);
  }));

  app.post("/api/v1/people/sync", withKey("people:write"), guard(async (req, res) => {
    const body = syncBody.parse(req.body);
    const plan = await planSync(body.people);
    const errors = plan.filter((p) => p.action === "error").length;
    const apply = !body.dryRun && (errors === 0 || body.applyValidRowsOnly);
    const batch = randomUUID();
    if (apply) await applySync(plan, storage, `HR feed (${req.apiKey.name})`);
    const summary = plan.reduce((m, p) => ({ ...m, [p.action]: (m[p.action] ?? 0) + 1 }), {} as Record<string, number>);
    if (!body.dryRun && !apply) res.status(422);
    return { batch, dryRun: body.dryRun, applied: apply, received: plan.length, summary,
      message: body.dryRun ? "Nothing was changed. Send dryRun: false to apply." : apply ? "Applied." : "Nothing was changed because some rows have errors. Correct them, or send applyValidRowsOnly: true.",
      rows: plan.map(({ data: _d, set: _s, newRoleId: _r, userId: _u, ...r }) => r) };
  }));
}
