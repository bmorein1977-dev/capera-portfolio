// Pre-site visitor forms. A contracting company's administrator fills one in for each person coming to site for a short visit, adds the competence
// checklist and certificates, and submits it. The host company's administrators set where it is emailed and how much notice is needed, and accept it
// or send it back. Each form is filed against the visitor's own record.
//
// A contracting company's administrator only ever sees their own company's forms. Nobody else except the host's administrators sees any.
import type { Express, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "./db";
import { and, desc, eq, sql } from "drizzle-orm";
import { users, contractorVisits, contractorVisitFiles, type ContractorVisit } from "@shared/schema";
import {
  detailsSchema, privateSchema, checklistSchema, settingsSchema, stillNeeded, submitBy, lastDay, longDay, isDay,
  FILE_CATEGORIES, CERTIFICATE_EXTENSIONS, MAX_CERTIFICATE_BYTES, MAX_FILES_PER_VISIT, DEFAULT_CHECKLIST, DEFAULT_PRIVACY_NOTICE, DEFAULT_SITE_NOTES, DECLARATIONS,
  type VisitDetails, type VisitPrivate, type VisitChecklist, type VisitorSettings,
} from "@shared/visitorForm";
import type { IStorage } from "./storage";
import { checkUpload, sendFileHeaders, rateLimit } from "./security";
import { buildObjectKey, uploadObject, downloadObjectAsStream, deleteObject } from "./services/objectStorage";
import { getVisitorSettings, saveVisitorSettings, today, activeFiles, wordingFor, renderVisitHtml, companyName, emailVisitForm } from "./services/visitorForms";
import { sendNotification } from "./services/notifications";
import { recordRequestEvent, recordRecordView } from "./services/auditLog";

interface Deps { storage: IStorage; isAuthenticated: any; requireRole: (...roles: string[]) => any }

const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");
const HOST_ADMIN = ["admin", "super_admin", "developer"];
class HttpError extends Error { constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); } }

const reference = () => `VIS-${new Date().getFullYear()}-${Array.from(randomBytes(6), b => "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"[b % 32]).join("")}`;
const nameOf = (v: Pick<ContractorVisit, "visitorFirstName" | "visitorLastName">) => `${v.visitorFirstName} ${v.visitorLastName}`.trim();
const editable = (v: ContractorVisit) => v.status === "draft" || v.status === "returned";

export function registerVisitorRoutes(app: Express, { storage, isAuthenticated, requireRole }: Deps) {
  async function actor(req: any) {
    const id = req.session?.impersonatedUserId || req.user?.claims?.sub;
    const user = id ? await storage.getUser(id) : undefined;
    if (!user) throw new HttpError(401, "User not found");
    const roles = (await storage.getEffectiveRoles(id)).map(norm);
    const isHostAdmin = roles.some(r => HOST_ADMIN.includes(r));
    const isContractorAdmin = roles.includes("contractor_admin");
    if (!isHostAdmin && !isContractorAdmin) throw new HttpError(403, "Not allowed");
    if (!isHostAdmin && !user.contractCompanyId) throw new HttpError(403, "Your account is not linked to a contracting company yet. Ask the administrator.");
    return { id: id as string, user, isHostAdmin };
  }
  // the host's decisions are checked against the person being acted as, not only the signed-in session
  async function host(req: any) {
    const a = await actor(req);
    if (!a.isHostAdmin) throw new HttpError(403, "Only the host company's administrators can do this");
    return a;
  }

  // a form the person may see: the host's administrators see all, a contractor's administrator only their own company's (others answer "not found")
  async function visit(req: any, id: string) {
    const a = await actor(req);
    const v = (await db.select().from(contractorVisits).where(eq(contractorVisits.id, id)))[0];
    if (!v || (!a.isHostAdmin && v.contractCompanyId !== a.user.contractCompanyId)) throw new HttpError(404, "Visitor form not found");
    return { a, v };
  }

  const handle = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { const out = await fn(req, res); if (!res.headersSent) res.json(out); }
    catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message, ...e.extra });
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Some of the details are not valid", fields: e.issues.map(i => i.path.join(".")) });
      if (e?.code === "23505") return res.status(409).json({ error: "That email address is already used by someone in Capera" });
      console.error("Visitor form route failed:", e?.message ?? e); // the message only: the details of a form are not written to the log
      res.status(500).json({ error: "Something went wrong on our side. Please try again." });
    }
  };

  const guard = [isAuthenticated, requireRole("contractor_admin", "admin", "super_admin", "developer")];
  const hostOnly = [isAuthenticated, requireRole("admin", "super_admin", "developer")];

  const history = (v: ContractorVisit, by: string, what: string, note?: string) => [...((v.history as any[]) ?? []), { at: new Date().toISOString(), by, what, ...(note ? { note } : {}) }];
  const log = (req: Request, v: ContractorVisit, action: string, what: string) => recordRequestEvent(req, { action, entityType: "visitor-form", entityId: v.id, label: `${v.reference}: ${nameOf(v)}`, what });

  // ------------------------------------------------------------------ the host's settings
  app.get("/api/contractor/visitor-settings", ...guard, handle(async (req) => {
    const a = await actor(req);
    const s = await getVisitorSettings();
    if (a.isHostAdmin) return { ...s, defaults: { checklist: DEFAULT_CHECKLIST, privacyNotice: DEFAULT_PRIVACY_NOTICE, siteNotes: DEFAULT_SITE_NOTES } };
    const { submissionEmails, emailAttachments, ...forContractor } = s; // where the host receives forms is the host's business
    return forContractor;
  }));

  app.put("/api/contractor/visitor-settings", ...hostOnly, handle(async (req) => {
    const a = await host(req);
    const s = settingsSchema.parse(req.body ?? {}) as VisitorSettings;
    const keys = s.checklist.flatMap(c => c.items.map(i => i.key));
    if (new Set(keys).size !== keys.length) throw new HttpError(400, "Two checklist lines have the same key");
    s.submissionEmails = Array.from(new Set(s.submissionEmails));
    await saveVisitorSettings(s, a.id);
    return s;
  }));

  // ------------------------------------------------------------------ the list
  app.get("/api/contractor/visits", ...guard, handle(async (req) => {
    const a = await actor(req);
    const asked = typeof req.query.companyId === "string" ? req.query.companyId : "";
    const company = a.isHostAdmin ? asked || null : a.user.contractCompanyId!;
    const person = typeof req.query.userId === "string" ? req.query.userId : null;
    const rows = (await db.execute(sql`
      select v.id, v.reference, v.status, v.user_id as "userId", v.visitor_first_name as "firstName", v.visitor_last_name as "lastName",
        to_char(v.arrival_date, 'YYYY-MM-DD') as "arrivalDate", v.days, v.late, v.submitted_at as "submittedAt", v.updated_at as "updatedAt",
        v.details->>'safetyCritical' as "safetyCritical", v.review_note as "reviewNote", cc.name as "companyName",
        (select count(*)::int from contractor_visit_files f where f.visit_id = v.id and f.is_active) as "files"
      from contractor_visits v left join contract_companies cc on cc.id = v.contract_company_id
      where (${company}::text is null or v.contract_company_id = ${company}) and (${person}::text is null or v.user_id = ${person})
        -- a company's unfinished drafts are its own business; the host sees a form once it has been sent
        and (not ${a.isHostAdmin} or v.status <> 'draft')
      order by case v.status when 'submitted' then 0 when 'returned' then 1 when 'draft' then 2 else 3 end, v.arrival_date desc nulls last, v.created_at desc limit 500`)).rows;
    const s = await getVisitorSettings();
    return (rows as any[]).map(r => ({ ...r, submitBy: r.arrivalDate ? submitBy(r.arrivalDate, s.noticeDays) : null }));
  }));

  // ------------------------------------------------------------------ starting one
  const start = z.object({
    companyId: z.string().max(100).optional(),
    personId: z.string().trim().min(1).max(100).optional(),
    newVisitor: z.object({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email().max(254) }).strict().optional(),
  }).strict().refine(d => !!d.personId !== !!d.newVisitor, "choose a person or add a visitor");

  app.post("/api/contractor/visits", ...guard, rateLimit({ name: "visit-create", max: 60, windowMs: 10 * 60 * 1000, by: "user" }), handle(async (req, res) => {
    const a = await actor(req);
    const d = start.parse(req.body ?? {});
    const companyId = a.isHostAdmin ? d.companyId : a.user.contractCompanyId!;
    if (!companyId) throw new HttpError(400, "Choose a contracting company");
    let person: any;
    if (d.personId) {
      person = (await db.select().from(users).where(and(eq(users.id, d.personId), eq(users.contractCompanyId, companyId), eq(users.employmentType, "contractor"))))[0];
      if (!person || person.role === "contractor_admin") throw new HttpError(404, "Person not found in this contracting company");
      if (person.isArchived || person.approvalStatus === "rejected") throw new HttpError(409, "That person is marked as left or was not approved");
    } else {
      const n = d.newVisitor!;
      // someone already on this company's list with that address is the same person: file the new visit against them
      person = (await db.select().from(users).where(and(sql`lower(${users.email}) = ${n.email}`, eq(users.contractCompanyId, companyId), eq(users.employmentType, "contractor"))))[0];
      if (person && (person.isArchived || person.approvalStatus === "rejected" || person.role === "contractor_admin")) throw new HttpError(409, "That email address is already used by someone in Capera");
      // a visitor is a record to file the visit against, not a member of the workforce: inactive, so counted nowhere and sent no reminders
      if (!person) person = (await db.insert(users).values({ email: n.email, firstName: n.firstName, lastName: n.lastName, role: "candidate", employmentType: "contractor", contractCompanyId: companyId, isActive: false, approvalStatus: "visitor" } as any).returning())[0];
    }
    const v = (await db.insert(contractorVisits).values({
      reference: reference(), contractCompanyId: companyId, userId: person.id, visitorFirstName: person.firstName ?? "", visitorLastName: person.lastName ?? "",
      details: { businessEmail: person.email ?? "", safetyCritical: "" }, privateDetails: {}, checklist: {},
      history: [{ at: new Date().toISOString(), by: a.id, what: "Started" }], createdBy: a.id,
    }).returning())[0];
    await log(req, v, "create", "started a visitor form");
    res.status(201).json({ id: v.id, reference: v.reference });
  }));

  // ------------------------------------------------------------------ one form
  async function full(v: ContractorVisit, isHostAdmin: boolean) {
    const s = await getVisitorSettings();
    const files = await activeFiles(v.id);
    const wording = wordingFor(v, s);
    const needed = editable(v) ? stillNeeded({ ...v, details: v.details as VisitDetails, privateDetails: (v.privateDetails ?? {}) as VisitPrivate, checklist: v.checklist as VisitChecklist, files }, { ...s, checklist: wording.checklist }, today()) : [];
    const deadline = v.arrivalDate ? submitBy(v.arrivalDate, s.noticeDays) : null;
    return {
      ...v, companyName: await companyName(v.contractCompanyId), snapshot: undefined, createdBy: undefined,
      history: isHostAdmin ? v.history : (v.history as any[]).map(({ by, ...h }) => h),
      files: files.map(f => ({ id: f.id, category: f.category, title: f.title, fileName: f.fileName, sizeBytes: f.sizeBytes, expiryDate: f.expiryDate, expiresBeforeVisitEnds: !!(f.expiryDate && v.arrivalDate && f.expiryDate < lastDay(v.arrivalDate, v.days ?? 1)) })),
      wording, needed,
      timing: { noticeDays: s.noticeDays, lateRule: s.lateRule, submitBy: deadline, isLateNow: !!deadline && today() > deadline, maxVisitDays: s.maxVisitDays },
      canEdit: editable(v), canReview: isHostAdmin && v.status === "submitted",
    };
  }

  app.get("/api/contractor/visits/:id", ...guard, handle(async (req) => {
    const { a, v } = await visit(req, req.params.id);
    if (a.isHostAdmin && v.status === "draft") throw new HttpError(404, "Visitor form not found");
    // opening someone's emergency contact and support details is recorded
    if (a.isHostAdmin) recordRecordView(req, { entityType: "visitor-form", entityId: v.id, label: `${v.reference}: ${nameOf(v)}`, kind: "a visitor form" });
    return full(v, a.isHostAdmin);
  }));

  const save = z.object({
    visitorFirstName: z.string().trim().min(1).max(100), visitorLastName: z.string().trim().min(1).max(100),
    arrivalDate: z.string().refine(isDay, "not a date").nullable(), days: z.number().int().min(1).max(365).nullable(),
    details: detailsSchema, privateDetails: privateSchema, checklist: checklistSchema,
  }).partial().strict();

  // only the contracting company fills in its form; the host sends it back rather than changing what was declared
  const ownDraft = async (req: any) => {
    const { a, v } = await visit(req, req.params.id);
    if (!editable(v)) throw new HttpError(409, "This form has been submitted. It can be changed only if the host company sends it back.");
    if (a.isHostAdmin && v.status === "returned") throw new HttpError(409, "This form is with the contracting company to correct");
    return { a, v };
  };

  app.put("/api/contractor/visits/:id", ...guard, handle(async (req) => {
    const { a, v } = await ownDraft(req);
    const d = save.parse(req.body ?? {});
    if (d.checklist?.answers && Object.keys(d.checklist.answers).length > 200) throw new HttpError(400, "Too many checklist answers");
    const set: Record<string, unknown> = { ...d, updatedAt: new Date() };
    if (d.privateDetails) set.privateRemovedAt = null;
    const out = (await db.update(contractorVisits).set(set).where(eq(contractorVisits.id, v.id)).returning())[0];
    return full(out, a.isHostAdmin);
  }));

  // ------------------------------------------------------------------ certificates
  const oneFile = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CERTIFICATE_BYTES, files: 1, fields: 6 } }).single("file");
  const fileFields = z.object({ category: z.enum(FILE_CATEGORIES), title: z.string().trim().min(1).max(200), expiryDate: z.string().refine(v => v === "" || isDay(v), "not a date").optional() }).strict();

  app.post("/api/contractor/visits/:id/files", ...guard, rateLimit({ name: "visit-upload", max: 60, windowMs: 10 * 60 * 1000, by: "user" }), (req: Request, res: Response) => {
    oneFile(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Each certificate must be 10 MB or smaller" : "Could not read that file" });
      return handle(async () => {
        const { a, v } = await ownDraft(req);
        const file = (req as any).file as { originalname: string; buffer: Buffer; size: number } | undefined;
        if (!file) throw new HttpError(400, "Choose a file");
        const f = fileFields.parse(req.body ?? {});
        const verdict = checkUpload(file, CERTIFICATE_EXTENSIONS);
        if (!verdict.ok) throw new HttpError(400, verdict.reason);
        if ((await activeFiles(v.id)).length >= MAX_FILES_PER_VISIT) throw new HttpError(409, `A form can carry ${MAX_FILES_PER_VISIT} certificates. Combine some into one document.`);
        const fileName = file.originalname.replace(/[\\/\r\n]/g, "_").slice(-150);
        const objectKey = buildObjectKey("visitor-certificates", fileName);
        try { await uploadObject(objectKey, file.buffer); }
        catch (e) { console.error("Visitor certificate upload failed:", (e as Error).message); throw new HttpError(503, "The file store is not available, so the certificate was not saved. Ask the administrator."); }
        const row = (await db.insert(contractorVisitFiles).values({ visitId: v.id, category: f.category, title: f.title, expiryDate: f.expiryDate || null, fileName, mimeType: verdict.mime, sizeBytes: file.size, objectKey, uploadedBy: a.id }).returning())[0];
        await log(req, v, "attach-certificate", "attached a certificate to the visitor form");
        res.status(201).json({ id: row.id });
      })(req, res);
    });
  });

  app.delete("/api/contractor/visits/:id/files/:fileId", ...guard, handle(async (req) => {
    const { v } = await ownDraft(req);
    const f = (await activeFiles(v.id)).find(x => x.id === req.params.fileId);
    if (!f) throw new HttpError(404, "Certificate not found");
    await db.update(contractorVisitFiles).set({ isActive: false }).where(eq(contractorVisitFiles.id, f.id));
    // a file on a form that has never been sent is deleted; one that was part of a submission is kept, because the record shows what was sent
    if (!v.submittedAt) await deleteObject(f.objectKey).catch(err => console.error("Could not delete a visitor certificate:", err?.message));
    await log(req, v, "remove-certificate", "removed a certificate from the visitor form");
    return { success: true };
  }));

  app.get("/api/contractor/visits/:id/files/:fileId/download", ...guard, handle(async (req, res) => {
    const { a, v } = await visit(req, req.params.id);
    if (a.isHostAdmin && v.status === "draft") throw new HttpError(404, "Visitor form not found");
    const f = (await activeFiles(v.id)).find(x => x.id === req.params.fileId);
    if (!f) throw new HttpError(404, "Certificate not found");
    const stream = downloadObjectAsStream(f.objectKey);
    await new Promise<void>((resolve, reject) => {
      let started = false;
      const begin = () => { if (!started) { started = true; sendFileHeaders(res, f.mimeType, f.fileName); } };
      stream.once("error", (err) => { if (started) res.destroy(err); reject(new HttpError(404, "The file could not be read from the file store")); });
      stream.once("data", (chunk) => { begin(); res.write(chunk); stream.pipe(res); resolve(); });
      stream.once("end", () => { if (!started) { begin(); res.end(); resolve(); } });
    });
  }));

  // the printable copy (also what is attached to the email)
  app.get("/api/contractor/visits/:id/print", ...guard, handle(async (req, res) => {
    const { a, v } = await visit(req, req.params.id);
    if (a.isHostAdmin && v.status === "draft") throw new HttpError(404, "Visitor form not found");
    if (a.isHostAdmin) recordRecordView(req, { entityType: "visitor-form", entityId: v.id, label: `${v.reference}: ${nameOf(v)}`, kind: "the printable copy of a visitor form" });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
    res.send(renderVisitHtml(v, await activeFiles(v.id), await companyName(v.contractCompanyId), await getVisitorSettings()));
  }));

  // ------------------------------------------------------------------ submitting
  app.post("/api/contractor/visits/:id/submit", ...guard, rateLimit({ name: "visit-submit", max: 40, windowMs: 10 * 60 * 1000, by: "user" }), handle(async (req) => {
    const { a, v } = await ownDraft(req);
    const body = z.object({ lateReason: z.string().trim().max(500).optional() }).strict().parse(req.body ?? {});
    const s = await getVisitorSettings();
    const files = await activeFiles(v.id);
    const needed = stillNeeded({ ...v, details: v.details as VisitDetails, privateDetails: (v.privateDetails ?? {}) as VisitPrivate, checklist: v.checklist as VisitChecklist, files }, s, today());
    if (needed.length) throw new HttpError(400, "The form is not complete yet", { needed });
    // how much notice was given is judged when the form is first sent, and again only if the arrival date has been moved since
    const before = v.snapshot as null | { arrivalDate?: string };
    const judgedBefore = !!v.submittedAt && before?.arrivalDate === v.arrivalDate;
    const deadline = submitBy(v.arrivalDate!, s.noticeDays);
    const late = judgedBefore ? v.late : today() > deadline;
    const lateReason = late ? (body.lateReason || (judgedBefore ? v.lateReason : null)) : null;
    if (late && !judgedBefore) {
      if (s.lateRule === "block") throw new HttpError(409, `This form had to be submitted by ${longDay(deadline)} (${s.noticeDays} days before arrival), so it can no longer be sent. Choose a later arrival date, or speak to your host.`);
      if (!lateReason || lateReason.length < 5) throw new HttpError(400, `This form is late: it was due by ${longDay(deadline)}. Say why.`, { needsLateReason: true });
    }
    const snapshot = { arrivalDate: v.arrivalDate, noticeDays: s.noticeDays, checklist: s.checklist, checklistRule: s.checklistRule, privacyNotice: s.privacyNotice, siteNotes: s.siteNotes, siteName: s.siteName, privateRetentionDays: s.privateRetentionDays, declarations: DECLARATIONS };
    // only one submit can win, so two clicks cannot send the form twice
    const sent = (await db.update(contractorVisits).set({
      status: "submitted", late, lateReason, submittedAt: new Date(), submittedBy: a.id, snapshot, reviewedAt: null, reviewedBy: null, updatedAt: new Date(),
      history: history(v, a.id, v.submittedAt ? "Submitted again" : "Submitted", late ? `Late: ${lateReason}` : undefined),
    }).where(and(eq(contractorVisits.id, v.id), eq(contractorVisits.status, v.status))).returning())[0];
    if (!sent) throw new HttpError(409, "This form has already been submitted");
    const emailStatus = await emailVisitForm(sent, s).catch(err => { console.error("Visitor form email failed:", err?.message); return "Not emailed. The form is in Capera."; });
    await db.update(contractorVisits).set({ emailStatus }).where(eq(contractorVisits.id, v.id));
    await log(req, sent, "submit", `submitted the visitor form${late ? " late" : ""}`);
    return { status: "submitted", late, message: late ? "Submitted, and marked as late." : "Submitted." };
  }));

  // ------------------------------------------------------------------ the host's decision
  app.post("/api/contractor/visits/:id/review", ...hostOnly, handle(async (req) => {
    const a = await host(req);
    const { v } = await visit(req, req.params.id);
    const d = z.object({ decision: z.enum(["accept", "return"]), note: z.string().trim().max(1000).optional() }).strict().parse(req.body ?? {});
    if (d.decision === "return" && (d.note ?? "").length < 5) throw new HttpError(400, "Say what needs to be corrected");
    const status = d.decision === "accept" ? "accepted" : "returned";
    const out = (await db.update(contractorVisits).set({
      status, reviewedAt: new Date(), reviewedBy: a.id, reviewNote: d.note || null, updatedAt: new Date(),
      history: history(v, a.id, d.decision === "accept" ? "Accepted by the host" : "Sent back by the host", d.note),
    }).where(and(eq(contractorVisits.id, v.id), eq(contractorVisits.status, "submitted"))).returning())[0];
    if (!out) throw new HttpError(409, "Only a submitted form can be accepted or sent back");
    await log(req, out, d.decision === "accept" ? "accept" : "send-back", d.decision === "accept" ? "accepted the visitor form" : "sent back the visitor form");
    if (out.submittedBy) await sendNotification("visitor_form_decision", { userIds: [out.submittedBy], vars: { reference: out.reference, visitor: nameOf(out), decision: d.decision === "accept" ? "accepted" : "sent back", note: d.note ?? "" }, path: "/contractor/visitors", metadata: { visitId: out.id } });
    return { status };
  }));

  app.post("/api/contractor/visits/:id/cancel", ...guard, handle(async (req) => {
    const { a, v } = await visit(req, req.params.id);
    if (v.status === "cancelled") throw new HttpError(409, "Already cancelled");
    const d = z.object({ reason: z.string().trim().max(500).optional() }).strict().parse(req.body ?? {});
    const out = (await db.update(contractorVisits).set({ status: "cancelled", updatedAt: new Date(), history: history(v, a.id, "Cancelled", d.reason) }).where(eq(contractorVisits.id, v.id)).returning())[0];
    await log(req, out, "cancel", "cancelled the visitor form");
    return { status: "cancelled" };
  }));

  app.post("/api/contractor/visits/:id/resend", ...hostOnly, rateLimit({ name: "visit-resend", max: 20, windowMs: 10 * 60 * 1000, by: "user" }), handle(async (req) => {
    await host(req);
    const { v } = await visit(req, req.params.id);
    if (v.status !== "submitted" && v.status !== "accepted") throw new HttpError(409, "Only a submitted form can be emailed");
    const emailStatus = await emailVisitForm(v, await getVisitorSettings());
    await db.update(contractorVisits).set({ emailStatus }).where(eq(contractorVisits.id, v.id));
    await log(req, v, "resend", "emailed the visitor form again");
    return { message: emailStatus };
  }));

  // keeping the personal details past the usual time, for an incident or an enquiry
  app.post("/api/contractor/visits/:id/hold", ...hostOnly, handle(async (req) => {
    const a = await host(req);
    const { v } = await visit(req, req.params.id);
    const d = z.object({ hold: z.boolean(), reason: z.string().trim().max(500).optional() }).strict().parse(req.body ?? {});
    if (d.hold && (d.reason ?? "").length < 5) throw new HttpError(400, "Record why these details must be kept");
    await db.update(contractorVisits).set({ keepPrivate: d.hold, keepPrivateReason: d.hold ? d.reason! : null, updatedAt: new Date(), history: history(v, a.id, d.hold ? "Personal details to be kept" : "Hold on personal details released", d.reason) }).where(eq(contractorVisits.id, v.id));
    await log(req, v, d.hold ? "retention-hold" : "retention-release", d.hold ? "put a hold on the personal details in the visitor form" : "released the hold on the visitor form");
    return { success: true };
  }));
}
