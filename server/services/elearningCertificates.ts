import { randomInt } from "crypto";
import { db } from "../db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  elearningCertificates, certificateSettings, trainings, trainingContent, trainingContentProgress, trainingCompletionAudit, users,
  CERTIFICATE_MODES, type ElearningCertificate, type CertificateSettings,
} from "@shared/schema";
import { sendNotification } from "./notifications";
import { recordSystemEvent } from "./auditLog";

// E-learning certificates. Created when someone finishes every piece of e-learning content for a training (see
// maybeCompleteTrainingFromContent in storage.ts). In "auto" mode the certificate is issued straight away; in "manual" mode it
// waits for an administrator to approve it. A training can override the organisation default, or switch certificates off.

export class CertificateError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const bad = (m: string) => new CertificateError(400, m);

export const CERTIFICATE_SETTING_ID = "certificates";
export const COURSE_MODES = [...CERTIFICATE_MODES, "none"] as const;

export async function getSettings(): Promise<CertificateSettings> {
  const rows = await db.select().from(certificateSettings).limit(1);
  if (rows[0]) return rows[0];
  return (await db.insert(certificateSettings).values({}).returning())[0];
}

export async function updateSettings(input: { defaultMode?: unknown; issuerName?: unknown; signatoryName?: unknown; signatoryTitle?: unknown; title?: unknown; accentColour?: unknown }, actorId: string): Promise<CertificateSettings> {
  const current = await getSettings();
  const mode = input.defaultMode === undefined ? current.defaultMode : String(input.defaultMode);
  if (!(CERTIFICATE_MODES as readonly string[]).includes(mode)) throw bad("Choose automatic or manual");
  const text = (v: unknown, keep: string | null) => (v === undefined ? keep : String(v).trim().slice(0, 120) || null);
  const issuer = text(input.issuerName, current.issuerName);
  if (!issuer) throw bad("The certificate needs the name of the organisation issuing it");
  const title = text(input.title, current.title);
  if (!title) throw bad("The certificate needs a heading, for example Certificate of Completion");
  const colour = input.accentColour === undefined ? current.accentColour : String(input.accentColour).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(colour)) throw bad("Choose a colour in the form #1d4ed8");
  return (await db.update(certificateSettings).set({
    defaultMode: mode, issuerName: issuer, signatoryName: text(input.signatoryName, current.signatoryName), signatoryTitle: text(input.signatoryTitle, current.signatoryTitle),
    title, accentColour: colour,
    updatedBy: actorId, updatedAt: new Date(),
  }).where(eq(certificateSettings.id, current.id)).returning())[0];
}

const LOGO_MAX_BYTES = 1_000_000;

/** Stores the customer's logo (png, jpeg or webp) in the settings row. The file type is checked from the file itself, not its name. */
export async function setLogo(file: { buffer: Buffer; size: number } | undefined, actorId: string): Promise<CertificateSettings> {
  if (!file) throw bad("Choose an image file");
  if (file.size > LOGO_MAX_BYTES) throw bad("The logo must be under 1 MB. Use a smaller image.");
  const b = file.buffer;
  const mime = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "image/png"
    : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "image/jpeg"
    : b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp" : null;
  if (!mime) throw bad("The logo must be a PNG, JPEG or WebP image");
  const current = await getSettings();
  return (await db.update(certificateSettings).set({ logoData: `data:${mime};base64,${b.toString("base64")}`, updatedBy: actorId, updatedAt: new Date() }).where(eq(certificateSettings.id, current.id)).returning())[0];
}

export async function removeLogo(actorId: string): Promise<CertificateSettings> {
  const current = await getSettings();
  return (await db.update(certificateSettings).set({ logoData: null, updatedBy: actorId, updatedAt: new Date() }).where(eq(certificateSettings.id, current.id)).returning())[0];
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

const NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0 or 1, which are easily misread
function newNumber(now: Date): string {
  let tail = "";
  for (let i = 0; i < 6; i++) tail += NUMBER_ALPHABET[randomInt(NUMBER_ALPHABET.length)];
  return `CAP-${now.getFullYear()}-${tail}`;
}

/** The certificate mode that applies to a training: its own override, else the organisation default. */
export function effectiveMode(trainingMode: string | null | undefined, defaultMode: string): "auto" | "manual" | "none" {
  const m = trainingMode || defaultMode;
  return m === "none" ? "none" : m === "manual" ? "manual" : "auto";
}

async function evidenceFor(userId: string, trainingId: string) {
  const items = await db.select().from(trainingContent).where(and(eq(trainingContent.trainingId, trainingId), eq(trainingContent.isActive, true))).orderBy(trainingContent.order);
  const progress = items.length ? await db.select().from(trainingContentProgress).where(and(eq(trainingContentProgress.userId, userId), inArray(trainingContentProgress.contentId, items.map(i => i.id)))) : [];
  return items.map(i => {
    const p = progress.find(x => x.contentId === i.id);
    return { title: i.title, type: i.contentType, scormVersion: i.scormVersion ?? null, status: p?.status ?? "not_started", completedAt: p?.completedAt ? new Date(p.completedAt).toISOString() : null, scoreRaw: p?.scoreRaw ?? null, successStatus: p?.successStatus ?? null };
  });
}

/**
 * Called when someone has just completed every e-learning item for a training. Creates the certificate (issued at once in
 * auto mode, pending in manual mode). Safe to call more than once for the same completion. Never throws: a problem here
 * must not stop the completion itself being recorded.
 */
export async function createForCompletion(args: { userId: string; trainingId: string; enrollmentId?: string | null; completedAt: Date }): Promise<ElearningCertificate | null> {
  try {
    const training = (await db.select().from(trainings).where(eq(trainings.id, args.trainingId)))[0];
    if (!training) return null;
    const settings = await getSettings();
    const mode = effectiveMode(training.certificateMode, settings.defaultMode);
    if (mode === "none") return null;

    // one live certificate per completion: skip if this enrollment (or, with no enrollment, this person and training) already has one
    const existing = await db.select().from(elearningCertificates).where(and(
      eq(elearningCertificates.userId, args.userId), eq(elearningCertificates.trainingId, args.trainingId), inArray(elearningCertificates.status, ["pending", "issued"]),
      args.enrollmentId ? eq(elearningCertificates.enrollmentId, args.enrollmentId) : sql`true`));
    if (existing[0]) return existing[0];

    const person = (await db.select().from(users).where(eq(users.id, args.userId)))[0];
    if (!person) return null;
    const learnerName = [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "Learner";
    const now = new Date();
    const values = {
      userId: args.userId, trainingId: args.trainingId, enrollmentId: args.enrollmentId ?? null, status: mode === "auto" ? "issued" : "pending", mode,
      learnerName, courseName: training.name, completedAt: args.completedAt,
      expiryDate: training.validityPeriod ? addMonths(args.completedAt, training.validityPeriod) : null,
      issuedAt: mode === "auto" ? now : null, evidence: await evidenceFor(args.userId, args.trainingId),
    };
    let cert: ElearningCertificate | undefined;
    for (let attempt = 0; attempt < 5 && !cert; attempt++) {
      try { cert = (await db.insert(elearningCertificates).values({ ...values, certificateNumber: newNumber(now) }).returning())[0]; }
      catch (error: any) { if (error?.code !== "23505") throw error; } // number clash: try another
    }
    if (!cert) return null;
    await recordSystemEvent({ actorId: null, action: mode === "auto" ? "certificate-issued" : "certificate-pending", entityType: "certificate", entityId: cert.id, entityLabel: `${cert.certificateNumber}`,
      summary: `${mode === "auto" ? "Certificate issued automatically" : "Certificate awaiting approval"} for "${training.name}" (${cert.certificateNumber})` });
    if (mode === "auto") await tellLearner(cert);
    return cert;
  } catch (error) {
    console.error("Could not create the e-learning certificate:", (error as Error).message);
    return null;
  }
}

async function tellLearner(cert: ElearningCertificate) {
  await sendNotification("certificate_issued", { userIds: [cert.userId], aboutUserId: cert.userId, vars: { course: cert.courseName, number: cert.certificateNumber }, path: "/my-training", dedupKey: `certificate:${cert.id}`, settingId: CERTIFICATE_SETTING_ID });
}

async function load(id: string): Promise<ElearningCertificate> {
  const cert = (await db.select().from(elearningCertificates).where(eq(elearningCertificates.id, id)))[0];
  if (!cert) throw new CertificateError(404, "Certificate not found");
  return cert;
}

async function actorName(id: string): Promise<string | null> {
  const u = (await db.select().from(users).where(eq(users.id, id)))[0];
  return u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email : null;
}

export async function approve(id: string, actorId: string): Promise<ElearningCertificate> {
  const cert = await load(id);
  if (cert.status !== "pending") throw new CertificateError(409, cert.status === "issued" ? "This certificate has already been issued" : `A ${cert.status} certificate cannot be approved`);
  const updated = (await db.update(elearningCertificates).set({ status: "issued", issuedAt: new Date(), decidedBy: actorId, updatedAt: new Date() }).where(eq(elearningCertificates.id, id)).returning())[0];
  await recordSystemEvent({ actorId, action: "certificate-approved", entityType: "certificate", entityId: id, entityLabel: cert.certificateNumber, summary: `Certificate approved and issued for ${cert.learnerName}: "${cert.courseName}" (${cert.certificateNumber})` });
  await tellLearner(updated);
  return updated;
}

export async function decline(id: string, actorId: string, reason: string | undefined): Promise<ElearningCertificate> {
  const cert = await load(id);
  if (cert.status !== "pending") throw new CertificateError(409, "Only a certificate waiting for approval can be declined");
  const why = (reason ?? "").trim();
  if (why.length < 5) throw bad("Say why it is being declined, so the learner and the record both know");
  const updated = (await db.update(elearningCertificates).set({ status: "declined", decidedBy: actorId, decisionNote: why, updatedAt: new Date() }).where(eq(elearningCertificates.id, id)).returning())[0];
  await recordSystemEvent({ actorId, action: "certificate-declined", entityType: "certificate", entityId: id, entityLabel: cert.certificateNumber, summary: `Certificate declined for ${cert.learnerName}: "${cert.courseName}". Reason: ${why}` });
  await sendNotification("certificate_declined", { userIds: [cert.userId], aboutUserId: cert.userId, vars: { course: cert.courseName, reason: why }, path: "/my-training", dedupKey: `certificate-declined:${cert.id}`, settingId: CERTIFICATE_SETTING_ID });
  return updated;
}

export async function revoke(id: string, actorId: string, reason: string | undefined): Promise<ElearningCertificate> {
  const cert = await load(id);
  if (cert.status !== "issued") throw new CertificateError(409, "Only an issued certificate can be revoked");
  const why = (reason ?? "").trim();
  if (why.length < 5) throw bad("Say why it is being revoked, so there is a record");
  const updated = (await db.update(elearningCertificates).set({ status: "revoked", decidedBy: actorId, decisionNote: why, updatedAt: new Date() }).where(eq(elearningCertificates.id, id)).returning())[0];
  await recordSystemEvent({ actorId, action: "certificate-revoked", entityType: "certificate", entityId: id, entityLabel: cert.certificateNumber, summary: `Certificate revoked for ${cert.learnerName}: "${cert.courseName}" (${cert.certificateNumber}). Reason: ${why}` });
  return updated;
}

export interface CertificateRow extends ElearningCertificate { decidedByName: string | null }

export async function listForUser(userId: string): Promise<ElearningCertificate[]> {
  return db.select().from(elearningCertificates).where(eq(elearningCertificates.userId, userId)).orderBy(desc(elearningCertificates.completedAt));
}

export async function listAll(status?: string): Promise<CertificateRow[]> {
  const rows = await db.select().from(elearningCertificates).where(status && status !== "all" ? eq(elearningCertificates.status, status) : undefined).orderBy(desc(elearningCertificates.createdAt)).limit(1000);
  const ids = Array.from(new Set(rows.map(r => r.decidedBy).filter((x): x is string => !!x)));
  const names = new Map<string, string | null>();
  for (const id of ids) names.set(id, await actorName(id));
  return rows.map(r => ({ ...r, decidedByName: r.decidedBy ? names.get(r.decidedBy) ?? null : null }));
}

export async function getOne(id: string): Promise<ElearningCertificate> { return load(id); }

/** Trainings that have e-learning content, with the certificate mode that applies to each. */
export async function listCourseModes() {
  const settings = await getSettings();
  const rows = await db.select({ id: trainings.id, name: trainings.name, certificateMode: trainings.certificateMode, items: sql<number>`count(${trainingContent.id})::int` })
    .from(trainings).innerJoin(trainingContent, and(eq(trainingContent.trainingId, trainings.id), eq(trainingContent.isActive, true)))
    .where(eq(trainings.isActive, true)).groupBy(trainings.id, trainings.name, trainings.certificateMode).orderBy(trainings.name);
  return { defaultMode: settings.defaultMode, courses: rows.map(r => ({ ...r, effective: effectiveMode(r.certificateMode, settings.defaultMode) })) };
}

export async function setCourseMode(trainingId: string, mode: string | null) {
  if (mode !== null && !(COURSE_MODES as readonly string[]).includes(mode)) throw bad("Choose automatic, manual, none or the default");
  const rows = await db.update(trainings).set({ certificateMode: mode, updatedAt: new Date() }).where(eq(trainings.id, trainingId)).returning({ id: trainings.id });
  if (!rows[0]) throw new CertificateError(404, "Training not found");
}

/** Creates certificates for completions that happened before certificates existed (or while a course was set to none). */
export async function backfill(): Promise<{ created: number; skipped: number }> {
  const done = await db.select().from(trainingCompletionAudit).where(eq(trainingCompletionAudit.method, "content_completed"));
  const have = await db.select({ userId: elearningCertificates.userId, trainingId: elearningCertificates.trainingId }).from(elearningCertificates);
  const haveKey = new Set(have.map(h => `${h.userId}:${h.trainingId}`));
  let created = 0, skipped = 0;
  for (const c of done) {
    if (haveKey.has(`${c.userId}:${c.trainingId}`)) { skipped++; continue; }
    haveKey.add(`${c.userId}:${c.trainingId}`);
    const cert = await createForCompletion({ userId: c.userId, trainingId: c.trainingId, enrollmentId: c.enrollmentId, completedAt: new Date(c.completedAt) });
    if (cert) created++; else skipped++;
  }
  return { created, skipped };
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

/**
 * A self-contained, printable certificate page (A4 landscape). The browser's Print dialog saves it as a PDF. The customer's
 * logo, heading and colour come from the certificate settings. "Date awarded" is the date the learner completed the training;
 * "Valid until" only appears when the training has a validity period; "Issued" is when an administrator or the system issued it.
 */
export async function renderHtml(cert: ElearningCertificate): Promise<string> {
  const s = await getSettings();
  const accent = /^#[0-9a-fA-F]{6}$/.test(s.accentColour) ? s.accentColour : "#1d4ed8";
  const logo = s.logoData && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.logoData) ? s.logoData : null;
  const evidence = (cert.evidence as Array<{ title: string; type: string; scormVersion: string | null; successStatus: string | null; scoreRaw: string | null }> | null) ?? [];
  const items = evidence.map(e => `<li>${esc(e.title)} <span class="muted">(${e.type === "scorm" ? `SCORM${e.scormVersion ? ` ${esc(e.scormVersion)}` : ""}` : esc(String(e.type).replace(/_/g, " "))}${e.scoreRaw ? `, score ${esc(e.scoreRaw)}` : ""}${e.successStatus && e.successStatus !== "unknown" ? `, ${esc(e.successStatus)}` : ""})</span></li>`).join("");
  const voided = cert.status === "revoked";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Certificate ${esc(cert.certificateNumber)}</title>
<style>
@page { size: A4 landscape; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; background: #eceff3; font-family: Georgia, "Times New Roman", serif; color: #1c2430 }
.bar { text-align: center; padding: 12px; font-family: system-ui, sans-serif }
.bar button { font: inherit; padding: 8px 18px; border: 0; border-radius: 6px; background: ${accent}; color: #fff; cursor: pointer }
.sheet { position: relative; width: 297mm; max-width: 100%; min-height: 210mm; margin: 0 auto 24px; background: #fff; padding: 14mm; box-shadow: 0 2px 12px rgba(0,0,0,.15) }
.frame { border: 3px double ${accent}; min-height: 182mm; padding: 12mm 18mm; text-align: center; display: flex; flex-direction: column; justify-content: space-between }
.logo { max-height: 26mm; max-width: 80mm; object-fit: contain; margin: 0 auto 6px; display: block }
h1 { font-size: 38px; letter-spacing: 5px; text-transform: uppercase; margin: 4px 0; color: ${accent} }
.sub { font-size: 16px; color: #5b6573; margin: 0 }
.name { font-size: 38px; margin: 16px 0 6px; border-bottom: 1px solid #c8ced6; display: inline-block; padding: 0 30px 6px }
.course { font-size: 26px; font-weight: bold; margin: 8px 0 }
.dates { display: flex; justify-content: center; gap: 40px; margin: 14px 0 4px; font-family: system-ui, sans-serif }
.dates div { text-align: center }
.dates span { display: block; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #6b7380 }
.dates strong { font-size: 16px }
.muted { color: #6b7380 }
ul { list-style: none; padding: 0; margin: 10px 0 0; font-size: 12px; font-family: system-ui, sans-serif }
.foot { display: flex; justify-content: space-between; align-items: flex-end; font-size: 13px; font-family: system-ui, sans-serif; text-align: left }
.sig { border-top: 1px solid #1c2430; padding-top: 4px; min-width: 60mm; text-align: center }
.void { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: bold 90px system-ui; color: rgba(185, 28, 28, .25); transform: rotate(-20deg); pointer-events: none }
@media (max-width: 900px) { .sheet { padding: 6mm } .frame { padding: 8mm 6mm } h1 { font-size: 24px; letter-spacing: 2px } .name { font-size: 26px } .course { font-size: 20px } .dates { gap: 20px } }
@media print { body { background: #fff } .bar { display: none } .sheet { box-shadow: none; margin: 0; width: 297mm; max-width: none } }
</style></head><body>
<div class="bar"><button onclick="window.print()">Print or save as PDF</button></div>
<div class="sheet">${voided ? '<div class="void">REVOKED</div>' : ""}
<div class="frame">
<div>${logo ? `<img class="logo" src="${logo}" alt="${esc(s.issuerName)}">` : ""}<p class="sub">${esc(s.issuerName)}</p><h1>${esc(s.title)}</h1><p class="sub">This is to certify that</p></div>
<div><div class="name">${esc(cert.learnerName)}</div><p class="sub">has successfully completed the e-learning course</p><p class="course">${esc(cert.courseName)}</p>
<div class="dates"><div><span>Date awarded</span><strong>${esc(fmt(cert.completedAt))}</strong></div>${cert.expiryDate ? `<div><span>Valid until</span><strong>${esc(fmt(cert.expiryDate))}</strong></div>` : ""}</div>
${items ? `<ul>${items}</ul>` : ""}</div>
<div class="foot"><div><div>Certificate number</div><strong>${esc(cert.certificateNumber)}</strong><div class="muted">Issued ${esc(fmt(cert.issuedAt))}</div></div>
<div class="sig">${esc(s.signatoryName || s.issuerName)}${s.signatoryTitle ? `<div class="muted">${esc(s.signatoryTitle)}</div>` : ""}</div></div>
</div></div></body></html>`;
}

/** A made-up certificate for the settings screen's Preview, so a logo and colours can be checked before anyone has completed a course. */
export async function renderSample(): Promise<string> {
  const now = new Date();
  const expiry = new Date(now); expiry.setFullYear(expiry.getFullYear() + 2);
  return renderHtml({
    id: "sample", certificateNumber: "CAP-SAMPLE-ABC234", userId: "sample", trainingId: "sample", enrollmentId: null, status: "issued", mode: "auto", learnerName: "Alex Example",
    courseName: "Sample E-learning Course", completedAt: now, expiryDate: expiry, issuedAt: now, decidedBy: null, decisionNote: null,
    evidence: [{ title: "Module 1: Introduction", type: "scorm", scormVersion: "2004", status: "completed", completedAt: now.toISOString(), scoreRaw: "90", successStatus: "passed" }],
    createdAt: now, updatedAt: now,
  } as ElearningCertificate);
}
