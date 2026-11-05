import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import {
  auditEvents, users, jobRoles, locations, teams, businessUnits, contractCompanies, jobFamilies, trainings,
  competencyElements, notificationSettings, absences, staffingRequirements,
} from "@shared/schema";

// The audit log. Every successful change made through the application (anything that is not just reading) is
// written here from the request pipeline, so a new feature is covered without anyone remembering to log it.
// Each entry says who did it (and who they were acting as, if they were impersonating), what it was done to, and,
// for the main record types, exactly which fields changed from what to what. Sign-ins are recorded too.
//
// Nothing in the application edits or deletes these rows.

// Parts of a URL that only group routes and are not the thing being changed: /api/org/locations is about locations.
const GROUPING_SEGMENTS = new Set(["admin", "org", "performance", "swp", "training", "hr", "onboarding"]);

// Requests that are learner telemetry or housekeeping rather than a change anyone would need to account for.
const SKIP: RegExp[] = [
  /^\/api\/training-content\/[^/]+\/(scorm-progress|progress)$/,
  /^\/api\/expiry-alerts\/[^/]+\/read$/,
  /^\/api\/translation\//,
  /^\/api\/notifications\/[^/]*\/?read/,
];

// Records whose before and after can be read, so the log can show field by field what changed.
// key = the entity segment of the URL; label = how to name the record in a sentence.
const SNAPSHOT: Record<string, { table: any; label: (r: any) => string }> = {
  users: { table: users, label: (r) => [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email || r.id },
  "job-roles": { table: jobRoles, label: (r) => r.name },
  locations: { table: locations, label: (r) => r.name },
  teams: { table: teams, label: (r) => r.name },
  "business-units": { table: businessUnits, label: (r) => r.name },
  "contract-companies": { table: contractCompanies, label: (r) => r.name },
  "job-families": { table: jobFamilies, label: (r) => r.name },
  trainings: { table: trainings, label: (r) => r.name ?? r.title },
  "competency-elements": { table: competencyElements, label: (r) => r.name ?? r.title ?? r.code },
  "notification-settings": { table: notificationSettings, label: (r) => r.name ?? r.notificationType ?? r.type },
  absences: { table: absences, label: (r) => r.absenceType },
  "staffing-requirements": { table: staffingRequirements, label: (r) => r.legalReference || "staffing requirement" },
};

const SENSITIVE = /pass(word)?|secret|token|api[-_]?key|cmi|suspend|authorization|cookie|signature|cvcontent|base64|^data:/i;
const IGNORED_FIELDS = new Set(["updatedAt", "createdAt", "lastLoginAt", "password"]);
const MAX_FIELDS = 40;

function clip(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v.length > 200 ? v.slice(0, 197) + "…" : v;
  if (typeof v === "object") { const s = JSON.stringify(v); return s.length > 200 ? s.slice(0, 197) + "…" : v; }
  return v;
}

type Change = { field: string; from?: unknown; to?: unknown };

function diff(before: any, after: any): Change[] {
  const out: Change[] = [];
  for (const key of Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]))) {
    if (IGNORED_FIELDS.has(key)) continue;
    const a = JSON.stringify(before?.[key] ?? null), b = JSON.stringify(after?.[key] ?? null);
    if (a === b) continue;
    out.push(SENSITIVE.test(key) ? { field: key, from: "[hidden]", to: "[hidden]" } : { field: key, from: clip(before?.[key]), to: clip(after?.[key]) });
    if (out.length >= MAX_FIELDS) break;
  }
  return out;
}

function sentFields(body: any): Change[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.entries(body).filter(([k]) => !IGNORED_FIELDS.has(k)).slice(0, MAX_FIELDS)
    .map(([k, v]) => ({ field: k, to: SENSITIVE.test(k) ? "[hidden]" : clip(v) }));
}

// Drops the "api" prefix and any grouping segments, so the first segment is what is being changed. Staffing is the one
// group whose pieces are named for what they are: /api/staffing/requirements is "staffing-requirements".
function leadingSegments(path: string): string[] {
  const segs = path.split("/").filter(Boolean).slice(1);
  while (segs.length > 1 && GROUPING_SEGMENTS.has(segs[0])) segs.shift();
  if (segs[0] === "staffing" && segs[1]) segs.splice(0, 2, `staffing-${segs[1]}`);
  return segs;
}

// "/api/org/locations/:id" -> { entity: "locations", param: "id", verb: undefined }; "/api/users/:id/archive" -> verb "archive"
function parseRoute(pattern: string) {
  const segs = leadingSegments(pattern);
  const entity = segs[0] ?? "system";
  const rest = segs.slice(1);
  const paramIdx = rest.findIndex(s => s.startsWith(":"));
  const param = paramIdx >= 0 ? rest[paramIdx].slice(1) : undefined;
  const afterParam = paramIdx >= 0 ? rest.slice(paramIdx + 1).filter(s => !s.startsWith(":")) : rest.filter(s => !s.startsWith(":"));
  return { entity, param, verb: afterParam.join("-") || undefined };
}

function readable(entity: string): string {
  const s = entity.replace(/-/g, " ");
  return s.endsWith("ies") ? s.slice(0, -3) + "y" : s.endsWith("ses") ? s.slice(0, -2) : s.endsWith("s") && !s.endsWith("ss") ? s.slice(0, -1) : s;
}

const PAST: Record<string, string> = { create: "created", update: "updated", delete: "deleted" };

const nameCache = new Map<string, { at: number; name: string; role: string }>();
async function who(id?: string | null): Promise<{ name: string | null; role: string | null }> {
  if (!id) return { name: null, role: null };
  const hit = nameCache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit;
  const u = (await db.select().from(users).where(eq(users.id, id)))[0];
  const entry = { at: Date.now(), name: u ? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || id) : id, role: u?.role ?? "" };
  nameCache.set(id, entry);
  return entry;
}

async function fetchRow(entity: string, id: string): Promise<any | null> {
  const def = SNAPSHOT[entity];
  if (!def || !id) return null;
  try { return (await db.select().from(def.table).where(eq(def.table.id, id)))[0] ?? null; } catch { return null; }
}

async function insert(e: typeof auditEvents.$inferInsert) {
  try { await db.insert(auditEvents).values(e); } catch (err) { console.error("Audit log write failed:", (err as Error).message); }
}

/** Records that someone signed in. Called from the sign-in callback, which is a GET and so not seen by the middleware. */
export async function recordSignIn(userId: string, ip?: string) {
  const w = await who(userId);
  await insert({ actorId: userId, actorName: w.name, actorRole: w.role, action: "sign-in", entityType: "user", entityId: userId, entityLabel: w.name,
    summary: `${w.name ?? userId} signed in`, method: "GET", path: "/api/callback", statusCode: 200, ipAddress: ip ?? null });
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS" || !req.path.startsWith("/api") || SKIP.some(r => r.test(req.path))) return next();

  // Read the record before the handler changes it, so the log can say what it used to be.
  const urlSegs = leadingSegments(req.path);
  const beforeKey = SNAPSHOT[urlSegs[0]] ? urlSegs[0] : undefined;
  const beforeId = beforeKey ? urlSegs[1] : undefined;
  const beforeP: Promise<any | null> = beforeKey && beforeId && method !== "POST" ? fetchRow(beforeKey, beforeId) : Promise.resolve(null);

  let responseBody: any;
  const json = res.json;
  res.json = function (this: Response, body: any, ...rest: any[]) { responseBody = body; return (json as any).apply(this, [body, ...rest]); } as any;

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    void (async () => {
      try {
        const route = (req as any).route?.path ? String((req as any).route.path) : req.path;
        const { entity, param, verb } = parseRoute(route);
        const entityId: string | undefined = (param && (req.params as any)?.[param]) || (typeof responseBody?.id === "string" ? responseBody.id : undefined);
        const action = verb ?? (method === "POST" ? "create" : method === "DELETE" ? "delete" : "update");
        const real = (req as any).user?.claims?.sub as string | undefined;
        const imp = (req as any).session?.impersonatedUserId as string | undefined;

        const before = await beforeP;
        const def = SNAPSHOT[entity];
        const after = def && entityId && action !== "delete" ? await fetchRow(entity, entityId) : null;
        let changes: Change[] = before && after ? diff(before, after) : sentFields(req.body);
        if (action === "create" && after) changes = sentFields(req.body);
        const rowForLabel = after ?? before ?? responseBody;
        const label = def && rowForLabel ? String(def.label(rowForLabel) ?? "") || null
          : (typeof responseBody?.name === "string" ? responseBody.name : typeof responseBody?.title === "string" ? responseBody.title : null);

        const a = await who(real), o = imp && imp !== real ? await who(imp) : { name: null, role: null };
        const kind = readable(entity);
        const done = PAST[action] ?? `ran "${action}" on`;
        const fields = changes.length ? ` (${changes.slice(0, 6).map(c => c.field).join(", ")}${changes.length > 6 ? ` and ${changes.length - 6} more` : ""})` : "";
        const summary = `${a.name ?? "Someone"}${o.name ? ` (as ${o.name})` : ""} ${done} ${kind}${label ? ` "${label}"` : ""}${action === "update" ? fields : ""}`;

        await insert({
          actorId: real ?? null, actorName: a.name, actorRole: a.role, actingAsId: imp && imp !== real ? imp : null, actingAsName: o.name,
          action, entityType: entity, entityId: entityId ?? null, entityLabel: label, summary, changes: changes as any,
          method, path: req.originalUrl.split("?")[0], statusCode: res.statusCode, ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null,
        });
      } catch (err) {
        console.error("Audit log failed:", (err as Error).message);
      }
    })();
  });
  next();
}

export interface AuditFilter { from?: string; to?: string; actorId?: string; entityType?: string; entityId?: string; action?: string; q?: string; limit?: number; offset?: number }

function where(f: AuditFilter) {
  const c: any[] = [];
  if (f.from) c.push(gte(auditEvents.occurredAt, new Date(f.from)));
  if (f.to) { const d = new Date(f.to); if (!f.to.includes("T")) d.setUTCHours(23, 59, 59, 999); c.push(lte(auditEvents.occurredAt, d)); }
  if (f.actorId) c.push(eq(auditEvents.actorId, f.actorId));
  if (f.entityType) c.push(eq(auditEvents.entityType, f.entityType));
  if (f.entityId) c.push(eq(auditEvents.entityId, f.entityId));
  if (f.action) c.push(eq(auditEvents.action, f.action));
  if (f.q?.trim()) { const p = `%${f.q.trim()}%`; c.push(or(ilike(auditEvents.summary, p), ilike(auditEvents.entityLabel, p), ilike(auditEvents.actorName, p))); }
  return c.length ? and(...c) : undefined;
}

export async function listAuditEvents(f: AuditFilter) {
  const limit = Math.min(Math.max(Number(f.limit) || 50, 1), 500), offset = Math.max(Number(f.offset) || 0, 0);
  const rows = await db.select().from(auditEvents).where(where(f)).orderBy(desc(auditEvents.occurredAt)).limit(limit).offset(offset);
  const total = Number((await db.select({ n: sql<number>`count(*)::int` }).from(auditEvents).where(where(f)))[0]?.n ?? 0);
  return { events: rows, total, limit, offset };
}

export async function auditFilterOptions() {
  const types = await db.selectDistinct({ v: auditEvents.entityType }).from(auditEvents).orderBy(auditEvents.entityType);
  const actions = await db.selectDistinct({ v: auditEvents.action }).from(auditEvents).orderBy(auditEvents.action);
  const actors = await db.selectDistinct({ id: auditEvents.actorId, name: auditEvents.actorName }).from(auditEvents).orderBy(auditEvents.actorName);
  return { entityTypes: types.map(t => t.v), actions: actions.map(a => a.v), actors: actors.filter(a => a.id).map(a => ({ id: a.id!, name: a.name ?? a.id! })) };
}

const csvCell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function auditCsv(f: AuditFilter): Promise<string> {
  const { events } = await listAuditEvents({ ...f, limit: 500, offset: 0 });
  // the export may be larger than one page: keep paging until done, capped so one click cannot pull the whole table
  const all = [...events];
  for (let off = 500; events.length === 500 && off < 10000; off += 500) {
    const page = (await listAuditEvents({ ...f, limit: 500, offset: off })).events;
    all.push(...page);
    if (page.length < 500) break;
  }
  const head = ["When", "Who", "Acting as", "Action", "Type", "Record", "What changed", "Summary"];
  const lines = all.map(e => [
    e.occurredAt ? new Date(e.occurredAt).toISOString() : "", e.actorName, e.actingAsName, e.action, e.entityType, e.entityLabel,
    ((e.changes as Change[] | null) ?? []).map(c => c.from !== undefined ? `${c.field}: ${c.from ?? "(blank)"} -> ${c.to ?? "(blank)"}` : `${c.field}: ${c.to ?? "(blank)"}`).join("; "), e.summary,
  ].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\r\n");
}
