// Export what a page shows, for managers and administrators: an Excel workbook, or an infographic (drafted with AI from counted figures).
//   POST /api/export/prepare      {path, title, urls[]}      -> the data sources found on the page, with row counts (held for 15 minutes)
//   POST /api/export/xlsx         {id, include[]}            -> the workbook
//   POST /api/export/infographic  {id, include[], ai}        -> the infographic, as data for the page to draw
// Every call to read a page's data is made again here as the same person, so what is exported is exactly what they are allowed to see.
import type { Express } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import type { IStorage } from "./storage";
import { cleanUrls, gatherWithNotes, pageFilters, type Table } from "./services/reportData";
import { buildWorkbook } from "./services/reportWorkbook";
import { aiAvailable, buildInfographic } from "./services/reportInfographic";
import { recordSystemEvent } from "./services/auditLog";
import { contentDisposition, rateLimit } from "./security";

interface Deps { storage: IStorage; isAuthenticated: any; requireRole: (...roles: string[]) => any }

interface Held { userId: string; expires: number; title: string; path: string; urls: string[]; tables: Table[]; notes: string[]; preparedFor: string; role: string }
const held = new Map<string, Held>();
const TTL = 15 * 60 * 1000;
setInterval(() => { const now = Date.now(); held.forEach((v, k) => { if (v.expires < now) held.delete(k); }); }, 60_000).unref();

// an export this person has open (not yet expired): what a scheduled report is made from, so its data addresses are ones just read successfully as them
export function heldExport(id: unknown, userId: string): { title: string; path: string; urls: string[] } | null {
  const h = typeof id === "string" ? held.get(id) : undefined;
  return h && h.userId === userId && h.expires >= Date.now() ? { title: h.title, path: h.path, urls: h.urls } : null;
}

const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");
const REPORT_ROLES = ["manager", "admin", "super_admin", "developer"];

export function registerExportRoutes(app: Express, { storage, isAuthenticated, requireRole }: Deps) {
  const guard = [isAuthenticated, requireRole(...REPORT_ROLES)];

  async function who(req: any) {
    const id = req.session?.impersonatedUserId || req.user?.claims?.sub;
    const user = id ? await storage.getUser(id) : undefined;
    const roles = id ? (await storage.getEffectiveRoles(id)).map(norm) : [];
    const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || id : String(id);
    const top = ["developer", "super_admin", "admin", "manager"].find(r => roles.includes(r)) ?? roles[0] ?? "user";
    return { id: id as string, name, role: top.replace(/_/g, " "), roles };
  }
  // the same server, as the same person: their own cookie goes with each read
  function loopback(req: any) {
    const port = req.socket?.localPort ?? process.env.PORT ?? 5000;
    const headers: Record<string, string> = { cookie: String(req.headers.cookie ?? "") };
    if (process.env.NODE_ENV === "production") headers["x-forwarded-proto"] = "https";
    if (process.env.LOCAL_DEV_AUTH === "true" && req.headers["x-tmp-act-as"]) headers["x-tmp-act-as"] = String(req.headers["x-tmp-act-as"]);
    return { base: `http://127.0.0.1:${port}`, headers };
  }
  const own = (id: unknown, userId: string): Held => {
    const h = typeof id === "string" ? held.get(id) : undefined;
    if (!h || h.userId !== userId || h.expires < Date.now()) throw Object.assign(new Error("This export has expired. Open Export again."), { status: 410 });
    return h;
  };
  const pick = (h: Held, include: unknown): Table[] => {
    const ids = Array.isArray(include) ? new Set(include.filter(x => typeof x === "string")) : null;
    const t = h.tables.filter(x => (ids ? ids.has(x.id) : x.kind !== "reference") && (x.rows.length > 0));
    if (!t.length) throw Object.assign(new Error("Choose at least one data source that has rows."), { status: 400 });
    return t;
  };
  const fail = (res: any, e: any) => {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    if (e instanceof z.ZodError) return res.status(400).json({ error: "The request was not valid" });
    console.error("Export failed:", e);
    return res.status(500).json({ error: "The export could not be built. Please try again." });
  };

  app.post("/api/export/prepare", ...guard, rateLimit({ name: "export-prepare", max: 60, windowMs: 3600_000, by: "user" }), async (req: any, res) => {
    try {
      const b = z.object({ path: z.string().max(300), title: z.string().trim().min(1).max(120), urls: z.array(z.string().max(600)).max(40) }).parse(req.body ?? {});
      const urls = cleanUrls(b.urls);
      if (!urls.length) return res.status(400).json({ error: "There is no data on this page to export." });
      const me = await who(req);
      const { base, headers } = loopback(req);
      const { tables, notes } = await gatherWithNotes(base, urls, headers);
      if (!tables.length) return res.status(404).json({ error: "This page has no data you can export." });
      const id = randomBytes(18).toString("base64url");
      // each person holds a handful at a time
      const mine = Array.from(held.entries()).filter(([, v]) => v.userId === me.id).sort((a, b) => a[1].expires - b[1].expires);
      while (mine.length >= 6) held.delete(mine.shift()![0]);
      held.set(id, { userId: me.id, expires: Date.now() + TTL, title: b.title, path: b.path, urls, tables, notes, preparedFor: me.name, role: me.role });
      res.json({
        id, title: b.title, aiAvailable: aiAvailable(), filters: [...pageFilters(urls), ...notes],
        sources: tables.map(t => ({ id: t.id, name: t.name, kind: t.kind, rows: t.rows.length, columns: t.columns.length, truncated: t.truncated, defaultOn: t.kind !== "reference" && t.rows.length > 0 })),
      });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/export/xlsx", ...guard, rateLimit({ name: "export-xlsx", max: 60, windowMs: 3600_000, by: "user" }), async (req: any, res) => {
    try {
      const me = await who(req);
      const h = own(req.body?.id, me.id);
      const tables = pick(h, req.body?.include);
      const generatedAt = new Date();
      const file0 = await buildWorkbook(tables, { title: h.title, pagePath: h.path, preparedFor: me.name, role: me.role, generatedAt, filters: [...pageFilters(h.urls), ...h.notes] });
      const file = `Capera - ${h.title.replace(/[^\w\s\-&,.()]/g, "").slice(0, 70)} - ${generatedAt.toISOString().slice(0, 10)}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", contentDisposition("attachment", file));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Length", String(file0.length));
      res.end(file0);
      void recordSystemEvent({ actorId: me.id, action: "Exported page data to Excel", entityType: "Report", entityLabel: h.title, summary: `${tables.length} sheet${tables.length === 1 ? "" : "s"}, ${tables.reduce((n, t) => n + t.rows.length, 0)} rows, from ${h.path}` }).catch(() => {});
    } catch (e) { if (!res.headersSent) fail(res, e); else res.end(); }
  });

  app.post("/api/export/infographic", ...guard, rateLimit({ name: "export-info", max: 30, windowMs: 3600_000, by: "user" }), async (req: any, res) => {
    try {
      const me = await who(req);
      const h = own(req.body?.id, me.id);
      const tables = pick(h, req.body?.include);
      const wantAi = req.body?.ai !== false;
      const info = await buildInfographic(tables, h.title, `${me.name}, ${me.role}`, wantAi);
      res.json(info);
      void recordSystemEvent({ actorId: me.id, action: info.aiUsed ? "Created an AI infographic" : "Created an infographic", entityType: "Report", entityLabel: h.title,
        summary: info.aiUsed ? "Counted figures and category names (no names or personal details) were sent to the AI service to draft the wording" : "Built from counted figures, no AI used" }).catch(() => {});
    } catch (e) { fail(res, e); }
  });
}
