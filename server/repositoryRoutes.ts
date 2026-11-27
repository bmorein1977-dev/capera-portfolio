// The restricted certification and audit evidence repository.
//
// - Every document has a version history. A new or replacement document waits until someone other than the person who uploaded it
//   approves it; the version it replaces stays in use until then, and is kept afterwards.
// - Nothing is destroyed from here: a document is withdrawn with a reason.
// - Each file's fingerprint is stored when it arrives and checked every time it is opened.
// - Administrators manage it. An external verifier or auditor can read only the current documents an administrator has shared with them.
//   Every opening of a document is written to the audit log.
import type { Express } from "express";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "./db";
import { opitoDocuments, repositoryHeadings, users, OPITO_CATEGORIES } from "@shared/schema";
import { buildObjectKey, uploadObject, downloadObject } from "./services/objectStorage";
import { checkUpload, sendFileHeaders, EVIDENCE_EXTENSIONS } from "./security";
import { recordSystemEvent } from "./services/auditLog";

const MANAGERS = ["admin", "super_admin", "developer"];
const READERS = [...MANAGERS, "external_verifier"];

class Refused extends Error { constructor(public status: number, message: string) { super(message); } }
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("").transform(() => null));
const fields = z.object({
  categoryKey: z.string().trim().min(1).max(40), title: z.string().trim().min(1).max(300), description: z.string().max(4000).optional().nullable(),
  reviewDueOn: day, validUntil: day, visibleToAuditors: z.enum(["true", "false"]).optional(), replacesId: z.string().max(100).optional(),
});

export async function allHeadings() {
  const own = await db.select().from(repositoryHeadings).orderBy(asc(repositoryHeadings.section), asc(repositoryHeadings.key));
  const byKey = new Map<string, { key: string; section: string; title: string; core: boolean; builtIn: boolean; isActive: boolean }>();
  for (const c of OPITO_CATEGORIES) byKey.set(c.key, { key: c.key, section: c.section, title: c.title, core: !!(c as { core?: boolean }).core, builtIn: true, isActive: true });
  for (const h of own) byKey.set(h.key, { key: h.key, section: h.section, title: h.title, core: !!h.isCore, builtIn: byKey.has(h.key), isActive: h.isActive !== false });
  return Array.from(byKey.values()).sort((a, b) => a.section.localeCompare(b.section) || a.key.localeCompare(b.key, undefined, { numeric: true }));
}

export const dueState = (d: { reviewDueOn: string | null; validUntil: string | null }, today = new Date().toISOString().slice(0, 10)) => {
  const soon = new Date(Date.parse(today) + 60 * 86_400_000).toISOString().slice(0, 10);
  if (d.validUntil && d.validUntil < today) return "out_of_date" as const;
  if (d.reviewDueOn && d.reviewDueOn < today) return "review_overdue" as const;
  if ((d.reviewDueOn && d.reviewDueOn <= soon) || (d.validUntil && d.validUntil <= soon)) return "due_soon" as const;
  return "in_date" as const;
};

export function registerRepositoryRoutes(app: Express, deps: { requireRole: (...roles: string[]) => any; actingUser: (req: any) => Promise<{ id: string; roles: string[] }>; upload: { single: (name: string) => any }; ownNameOnly: any }) {
  const { requireRole, actingUser, upload, ownNameOnly } = deps;
  const manage = requireRole(...MANAGERS);
  const read = requireRole(...READERS);

  const handle = (fn: (req: any, res: any, me: { id: string; roles: string[]; manager: boolean }) => Promise<unknown>) => async (req: any, res: any) => {
    try {
      const me = await actingUser(req);
      const out = await fn(req, res, { ...me, manager: me.roles.some((r) => MANAGERS.includes(r)) });
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (e: any) {
      if (e instanceof Refused) return res.status(e.status).json({ error: e.message });
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Some of the details are not valid" });
      console.error("Repository request failed:", e);
      res.status(500).json({ error: "The request could not be completed" });
    }
  };
  const log = (me: { id: string }, action: string, doc: { id: string; title: string; version: number | null }, summary: string) =>
    recordSystemEvent({ actorId: me.id, action, entityType: "Audit evidence document", entityId: doc.id, entityLabel: `${doc.title} (version ${doc.version ?? 1})`, summary }).catch(() => {});
  const find = async (id: string) => {
    const d = (await db.select().from(opitoDocuments).where(eq(opitoDocuments.id, id)))[0];
    if (!d || d.isActive === false) throw new Refused(404, "Document not found");
    return d;
  };
  /** an outside reader sees only what is current and has been shared with them; anything else does not exist to them */
  const mayRead = (me: { manager: boolean }, d: { status: string | null; visibleToAuditors: boolean | null }) => me.manager || (d.status === "current" && !!d.visibleToAuditors);

  app.get("/api/opito/headings", read, handle(async () => allHeadings()));
  app.put("/api/opito/headings/:key", manage, handle(async (req, _res, me) => {
    const body = z.object({ section: z.string().trim().min(1).max(200), title: z.string().trim().min(1).max(300), isCore: z.boolean().default(false), isActive: z.boolean().default(true) }).strict().parse(req.body);
    const key = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/).parse(req.params.key);
    await db.insert(repositoryHeadings).values({ key, ...body }).onConflictDoUpdate({ target: repositoryHeadings.key, set: { ...body, updatedAt: new Date() } });
    await recordSystemEvent({ actorId: me.id, action: "Changed a repository heading", entityType: "Audit evidence heading", entityId: key, entityLabel: body.title, summary: body.isActive ? "Added or changed" : "Switched off" }).catch(() => {});
    return allHeadings();
  }));

  app.get("/api/opito/documents", read, handle(async (req, _res, me) => {
    const { categoryKey, history } = req.query as Record<string, string | undefined>;
    const rows = (await db.select().from(opitoDocuments).where(eq(opitoDocuments.isActive, true)).orderBy(desc(opitoDocuments.createdAt)))
      .filter((d) => (!categoryKey || d.categoryKey === categoryKey) && mayRead(me, d) && (history === "1" || d.status === "current" || d.status === "awaiting_approval"));
    const ids = Array.from(new Set(rows.flatMap((d) => [d.uploadedBy, d.approvedBy, d.withdrawnBy]).filter(Boolean) as string[]));
    const names = new Map(ids.length ? (await db.select().from(users).where(inArray(users.id, ids))).map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()]) : []);
    return rows.map(({ objectKey: _key, contentHash: _hash, ...d }) => ({
      ...d, due: dueState(d), uploadedByName: d.uploadedBy ? names.get(d.uploadedBy) ?? null : null, approvedByName: d.approvedBy ? names.get(d.approvedBy) ?? null : null,
      withdrawnByName: d.withdrawnBy ? names.get(d.withdrawnBy) ?? null : null,
      mayApprove: me.manager && d.status === "awaiting_approval" && d.uploadedBy !== me.id, fingerprinted: !!_hash,
    }));
  }));

  app.post("/api/opito/documents", manage, upload.single("file"), handle(async (req, res, me) => {
    const body = fields.parse(req.body);
    if (!req.file) throw new Refused(400, "No file uploaded");
    const verdict = checkUpload(req.file, EVIDENCE_EXTENSIONS);
    if (!verdict.ok) throw new Refused(400, verdict.reason);
    const heading = (await allHeadings()).find((h) => h.key === body.categoryKey && h.isActive);
    if (!heading) throw new Refused(400, "That heading does not exist");
    let series: string | null = null, version = 1;
    if (body.replacesId) {
      const old = await find(body.replacesId);
      series = old.seriesId ?? old.id;
      const family = await db.select().from(opitoDocuments).where(eq(opitoDocuments.seriesId, series));
      if (family.some((d) => d.isActive !== false && d.status === "awaiting_approval")) throw new Refused(409, "A new version of this document is already waiting for approval");
      version = Math.max(old.version ?? 1, ...family.map((d) => d.version ?? 1)) + 1;
      if (!old.seriesId) await db.update(opitoDocuments).set({ seriesId: series }).where(eq(opitoDocuments.id, old.id));
    }
    const objectKey = buildObjectKey("opito-documents", req.file.originalname);
    await uploadObject(objectKey, req.file.buffer);
    const id = randomUUID();
    const row = (await db.insert(opitoDocuments).values({
      id, categoryKey: body.categoryKey, title: body.title, description: body.description?.trim() || null, objectKey, fileName: req.file.originalname,
      mimeType: verdict.mime, fileSize: req.file.size, uploadedBy: me.id, version, seriesId: series ?? id, status: "awaiting_approval",
      reviewDueOn: body.reviewDueOn ?? null, validUntil: body.validUntil ?? null, visibleToAuditors: body.visibleToAuditors === "true",
      contentHash: createHash("sha256").update(req.file.buffer).digest("hex"),
    }).returning())[0];
    await log(me, version > 1 ? "Added a new document version" : "Added a document", row, `Under ${heading.key} ${heading.title}; waiting for approval`);
    res.status(201);
    const { objectKey: _k, contentHash: _h, ...safe } = row;
    return safe;
  }));

  app.post("/api/opito/documents/:id/approve", manage, ownNameOnly, handle(async (req, _res, me) => {
    const d = await find(req.params.id);
    if (d.status !== "awaiting_approval") throw new Refused(409, "This document is not waiting for approval");
    if (d.uploadedBy === me.id) throw new Refused(403, "Someone other than the person who uploaded it must approve it");
    await db.transaction(async (tx) => {
      const claimed = await tx.update(opitoDocuments).set({ status: "current", approvedBy: me.id, approvedAt: new Date(), updatedAt: new Date() }).where(and(eq(opitoDocuments.id, d.id), eq(opitoDocuments.status, "awaiting_approval"))).returning();
      if (!claimed.length) throw new Refused(409, "Someone else has just decided on this document");
      if (d.seriesId) await tx.update(opitoDocuments).set({ status: "superseded", updatedAt: new Date() }).where(and(eq(opitoDocuments.seriesId, d.seriesId), eq(opitoDocuments.status, "current"), ne(opitoDocuments.id, d.id)));
    });
    await log(me, "Approved a document", d, "Now the current version");
    return { ok: true };
  }));

  app.patch("/api/opito/documents/:id", manage, handle(async (req, _res, me) => {
    const d = await find(req.params.id);
    const body = z.object({ reviewDueOn: day, validUntil: day, visibleToAuditors: z.boolean().optional() }).strict().parse(req.body);
    await db.update(opitoDocuments).set({ ...body, updatedAt: new Date() }).where(eq(opitoDocuments.id, d.id));
    await log(me, "Changed document dates or sharing", d, Object.entries(body).map(([k, v]) => `${k}: ${v ?? "none"}`).join(", "));
    return { ok: true };
  }));

  const withdraw = handle(async (req, _res, me) => {
    const d = await find(req.params.id);
    if (d.status === "withdrawn") throw new Refused(409, "It has already been withdrawn");
    const reason = z.string().trim().min(5, "Say why").max(1000).safeParse(req.body?.reason);
    if (!reason.success) throw new Refused(400, "Say why the document is being withdrawn (at least 5 characters)");
    await db.update(opitoDocuments).set({ status: "withdrawn", withdrawnReason: reason.data, withdrawnBy: me.id, withdrawnAt: new Date(), updatedAt: new Date() }).where(eq(opitoDocuments.id, d.id));
    await log(me, "Withdrew a document", d, reason.data);
    return { ok: true, success: true };
  });
  app.post("/api/opito/documents/:id/withdraw", manage, withdraw);
  app.delete("/api/opito/documents/:id", manage, withdraw); // removal from the repository is a withdrawal: the file and its history are kept

  app.get("/api/opito/documents/:id/download", read, handle(async (req, res, me) => {
    const d = await find(req.params.id);
    if (!mayRead(me, d)) throw new Refused(404, "Document not found");
    const bytes = await downloadObject(d.objectKey);
    if (d.contentHash && createHash("sha256").update(bytes).digest("hex") !== d.contentHash) {
      await log(me, "Integrity check failed", d, "The stored file no longer matches the fingerprint taken when it was uploaded");
      throw new Refused(409, "This file does not match the one that was uploaded, so it has not been opened. Tell your system administrator.");
    }
    await log(me, "Opened a document", d, d.contentHash ? "Fingerprint checked" : "Uploaded before fingerprints were taken");
    sendFileHeaders(res, d.mimeType, d.fileName);
    res.end(bytes);
  }));
}
