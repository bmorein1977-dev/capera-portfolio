// What sits behind the pre-site visitor forms: the host company's settings, the printable copy of a form, the email that carries a submitted form to
// the address the host has set, and the removal of personal details once a visit is over.
import { db } from "../db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { visitorSettings, contractorVisits, contractorVisitFiles, contractCompanies, type ContractorVisit, type ContractorVisitFile } from "@shared/schema";
import {
  DEFAULT_SETTINGS, DECLARATIONS, retentionSentence, checklistNeeded, addDays, lastDay, longDay, isDay,
  type VisitorSettings, type VisitDetails, type VisitPrivate, type VisitChecklist,
} from "@shared/visitorForm";
import { escapeHtml } from "../security";
import { downloadObject, deleteObject } from "./objectStorage";
import { sendVisitorForm } from "./notifications";
import { recordSystemEvent } from "./auditLog";
import type { EmailAttachment } from "./emailService";

const ID = "default";

export async function getVisitorSettings(): Promise<VisitorSettings> {
  const row = (await db.select().from(visitorSettings).where(eq(visitorSettings.id, ID)))[0];
  return { ...DEFAULT_SETTINGS, ...((row?.settings as Partial<VisitorSettings>) ?? {}) };
}

export async function saveVisitorSettings(s: VisitorSettings, actorId: string) {
  await db.insert(visitorSettings).values({ id: ID, settings: s, updatedBy: actorId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: visitorSettings.id, set: { settings: s, updatedBy: actorId, updatedAt: new Date() } });
}

/** "Today" as the host's site sees it, as yyyy-mm-dd. */
export function today(now = new Date()): string {
  const zone = process.env.APP_TIME_ZONE || "Europe/London";
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function activeFiles(visitId: string): Promise<ContractorVisitFile[]> {
  return db.select().from(contractorVisitFiles).where(and(eq(contractorVisitFiles.visitId, visitId), eq(contractorVisitFiles.isActive, true))).orderBy(contractorVisitFiles.uploadedAt);
}

/** What the form was, or will be, judged against: the snapshot taken when it was submitted, otherwise the settings as they are now. */
export function wordingFor(v: ContractorVisit, s: VisitorSettings) {
  const snap = v.snapshot as null | { checklist: VisitorSettings["checklist"]; checklistRule: VisitorSettings["checklistRule"]; privacyNotice: string; siteNotes: string; siteName: string; privateRetentionDays: number | null; declarations: typeof DECLARATIONS };
  if (snap && (v.status === "submitted" || v.status === "accepted")) return snap;
  return { checklist: s.checklist, checklistRule: s.checklistRule, privacyNotice: s.privacyNotice, siteNotes: s.siteNotes, siteName: s.siteName, privateRetentionDays: s.privateRetentionDays, declarations: DECLARATIONS };
}

// ---------------------------------------------------------------------------------------------------------------- the printable copy

const e = escapeHtml;
const show = (v: unknown) => (String(v ?? "").trim() ? e(v).replace(/\n/g, "<br>") : '<span class="none">Not given</span>');
const yesNo = (v: unknown) => (v === "yes" ? "Yes" : v === "no" ? "No" : "Not answered");
const ANSWER: Record<string, string> = { yes: "Yes", no: "No", na: "Not applicable" };
const table = (rows: Array<[string, string]>) => `<table class="kv">${rows.map(([k, v]) => `<tr><th>${e(k)}</th><td>${v}</td></tr>`).join("")}</table>`;

/** The form as one self-contained page: every value is escaped, there is no script, and it prints or saves as a PDF from the browser. */
export function renderVisitHtml(v: ContractorVisit, files: ContractorVisitFile[], companyName: string, s: VisitorSettings): string {
  const d = (v.details ?? {}) as VisitDetails, c = (v.checklist ?? {}) as VisitChecklist;
  const p = v.privateDetails as VisitPrivate | null;
  const w = wordingFor(v, s);
  const removed = !!v.privateRemovedAt;
  const priv = (x: unknown) => (removed ? '<span class="none">Removed after the visit</span>' : show(x));
  const parts: string[] = [];
  parts.push(`<h1>Visitor notification${w.siteName ? `: ${e(w.siteName)}` : ""}</h1>
<p class="meta">Reference ${e(v.reference)}. Status: ${e(v.status)}.${v.submittedAt ? ` Submitted ${e(longDay(today(new Date(v.submittedAt))))}.` : " Not yet submitted."}${v.late ? ` <strong>Late:</strong> ${e(v.lateReason)}` : ""}</p>`);
  parts.push("<h2>1. Visitor</h2>" + table([
    ["Surname", show(v.visitorLastName)], ["Forename(s)", show(v.visitorFirstName)], ["Preferred name", show(d.preferredName)], ["Company", show(companyName)],
    ["Business email", show(d.businessEmail)], ["Business or mobile number", priv(p?.mobile)], ["Vehicle registration", priv(p?.vehicleReg)],
    ["Employer's 24 hour emergency number", priv(p?.employerEmergencyPhone)], ["Employer's address", show(d.employerAddress)], ["Business telephone", show(d.businessPhone)],
  ]));
  parts.push("<h2>2. The visit</h2>" + table([
    ["Arriving", v.arrivalDate ? e(longDay(v.arrivalDate)) : show("")], ["Length", v.days ? `${v.days} day${v.days === 1 ? "" : "s"}` : show("")], ["Expected departure", show(d.departureTime)],
    ["Host", show(d.hostName)], ["Host's telephone", show(d.hostPhone)], ["Access needed", show(d.location)], ["Purpose and scope of work", show(d.purpose)], ["Visit organiser", show(d.organiser)],
    ["Safety critical role or equipment", `<strong>${yesNo(d.safetyCritical)}</strong>`],
  ]));
  parts.push("<h2>3. Emergency contact</h2>" + table([
    ["Name", priv(p?.emergencyName)], ["Telephone", priv(p?.emergencyPhone)], ["Relationship", priv(p?.emergencyRelationship)],
    ["Contact has agreed", removed ? priv("") : p?.emergencyPermission ? "Yes" : "No"],
  ]));
  parts.push("<h2>4. Adjustments and access support</h2>" + table([
    ["Support needed", removed ? priv("") : yesNo(p?.supportNeeded)], ["Kind of support", priv((p?.supportTypes ?? []).join(", "))], ["What is needed", priv(p?.supportDetails)],
  ]));
  const ppe = (d.ppe ?? []).filter(x => x.required);
  parts.push("<h2>5. Protective equipment to be issued by the site</h2>" + (ppe.length ? table(ppe.map(x => [x.item, show(x.size || "No size given")] as [string, string])) : "<p>None asked for.</p>"));
  if (checklistNeeded(w, d)) {
    parts.push(`<h2>6. Contractor competence checklist</h2>` + table([["Contractor company", show(companyName)], ["Work scope", show(d.purpose)], ["Contractor's supervisor", show(c.supervisorName)]]));
    for (const section of w.checklist) {
      parts.push(`<h3>${e(section.title)}</h3><table class="check"><tr><th>Requirement</th><th>Evidence expected</th><th>Answer</th><th>Comments</th></tr>${section.items.map(i => {
        const a = c.answers?.[i.key];
        return `<tr><td>${e(i.text)}</td><td>${e(i.evidence)}</td><td class="${a?.answer === "no" ? "no" : ""}">${e(ANSWER[a?.answer ?? ""] ?? "Not answered")}</td><td>${e(a?.comment ?? "")}</td></tr>`;
      }).join("")}</table>`);
    }
  }
  parts.push(`<h2>Certificates attached</h2>${files.length ? `<table class="check"><tr><th>For</th><th>Certificate</th><th>File</th><th>Expires</th></tr>${files.map(f => {
    const early = f.expiryDate && v.arrivalDate && f.expiryDate < lastDay(v.arrivalDate, v.days ?? 1);
    return `<tr><td>${f.category === "equipment" ? "Equipment" : "People"}</td><td>${e(f.title)}</td><td>${e(f.fileName)}</td><td class="${early ? "no" : ""}">${f.expiryDate ? e(longDay(f.expiryDate)) : "Not given"}${early ? " (runs out before the visit ends)" : ""}</td></tr>`;
  }).join("")}</table>` : "<p>None.</p>"}`);
  const ticked = new Set(d.declarations ?? []);
  parts.push(`<h2>Declarations</h2><ul>${(w.declarations ?? DECLARATIONS).map(x => `<li>${ticked.has(x.key) ? "Confirmed" : "<strong>Not confirmed</strong>"}: ${e(x.text)}</li>`).join("")}</ul>`);
  parts.push(table([["Completed by", show(d.completedBy)], ["Signature (typed)", show(d.signature)], ["Review", v.status === "accepted" ? `Accepted${v.reviewNote ? `: ${e(v.reviewNote)}` : ""}` : v.status === "returned" ? `Sent back: ${e(v.reviewNote)}` : "Not yet reviewed"]]));
  parts.push(`<h2>Site notes</h2><ul>${w.siteNotes.split("\n").filter(Boolean).map(x => `<li>${e(x)}</li>`).join("")}</ul>`);
  parts.push(`<h2>Privacy</h2><ul>${w.privacyNotice.split("\n").filter(Boolean).map(x => `<li>${e(x)}</li>`).join("")}<li>${e(retentionSentence(w.privateRetentionDays))}</li></ul>`);
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${e(v.reference)} ${e(v.visitorFirstName)} ${e(v.visitorLastName)}</title><style>
body{font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#111;max-width:50rem;margin:2rem auto;padding:0 1rem}h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:1.6rem}h3{font-size:1rem}
table{border-collapse:collapse;width:100%;margin:.4rem 0}th,td{border:1px solid #999;padding:.3rem .5rem;text-align:left;vertical-align:top}table.kv th{width:34%;font-weight:600}table.check th{background:#eee}
.none{color:#777}.no{font-weight:700;background:#fde8e8}.meta{color:#444}@media print{body{margin:0}h2,h3{break-after:avoid}tr{break-inside:avoid}}</style></head><body>${parts.join("\n")}</body></html>`;
}

export async function companyName(id: string): Promise<string> {
  return (await db.select({ name: contractCompanies.name }).from(contractCompanies).where(eq(contractCompanies.id, id)))[0]?.name ?? "Contracting company";
}

// ---------------------------------------------------------------------------------------------------------------- the email

const MAX_EMAIL_BYTES = 10 * 1024 * 1024;

/** Sends a submitted form to the host's addresses. Returns a plain sentence saying what happened, which is kept on the form. */
export async function emailVisitForm(v: ContractorVisit, s: VisitorSettings): Promise<string> {
  if (!s.submissionEmails.length) return "No email address is set for visitor forms, so it was not emailed. It is in Capera.";
  const files = await activeFiles(v.id);
  const company = await companyName(v.contractCompanyId);
  const attachments: EmailAttachment[] = [];
  let note = "The form and certificates are in Capera.";
  if (s.emailAttachments) {
    const html = Buffer.from(renderVisitHtml(v, files, company, s), "utf8");
    attachments.push({ filename: `${v.reference}.html`, content: html, contentType: "text/html" });
    let size = html.length, missing = 0, attached = 0;
    for (const f of files) {
      if (size + f.sizeBytes > MAX_EMAIL_BYTES) { missing++; continue; }
      try { attachments.push({ filename: f.fileName, content: await downloadObject(f.objectKey), contentType: f.mimeType }); size += f.sizeBytes; attached++; }
      catch (err) { console.error("Visitor form: could not attach a certificate:", (err as Error).message); missing++; }
    }
    note = `The form${attached ? ` and ${attached} certificate${attached === 1 ? "" : "s"}` : ""} ${attached ? "are" : "is"} attached.${missing ? ` ${missing} certificate${missing === 1 ? " is" : "s are"} too large or could not be attached: open the form in Capera.` : ""}`;
  }
  const d = (v.details ?? {}) as VisitDetails;
  const sent = await sendVisitorForm(s.submissionEmails, {
    vars: {
      reference: v.reference, visitor: `${v.visitorFirstName} ${v.visitorLastName}`.trim(), company, arrival: v.arrivalDate ? longDay(v.arrivalDate) : "(no date)",
      safetyCritical: yesNo(d.safetyCritical), timing: v.late ? `Sent LATE (less than ${s.noticeDays} days' notice). Reason given: ${v.lateReason ?? "none"}` : "Sent in time.", attachmentNote: note,
    },
    path: "/admin/contractors/visitors", attachments, metadata: { visitId: v.id, reference: v.reference },
  });
  const to = s.submissionEmails.join(", ");
  if (sent.status === "sent") return `Emailed to ${to}.`;
  if (sent.status === "off") return sent.error ?? "Visitor form emails are switched off.";
  return `Not emailed to ${to}: ${sent.error ?? "email is not set up"}. The form is in Capera.`;
}

// ---------------------------------------------------------------------------------------------------------------- removing personal details

/** Daily. Removes the personal details only needed around a visit, once the set number of days has passed. Does nothing unless a number is set. */
export async function runVisitorPrivacyPurge(now = new Date()): Promise<{ removed: number }> {
  const s = await getVisitorSettings();
  if (s.privateRetentionDays === null) return { removed: 0 };
  const cutoff = today(now);
  const rows = await db.select().from(contractorVisits).where(and(isNotNull(contractorVisits.privateDetails), eq(contractorVisits.keepPrivate, false)));
  const due = rows.filter(v => {
    // a form with no date (an abandoned draft) is counted from the day it was last changed
    const end = v.arrivalDate && isDay(v.arrivalDate) ? lastDay(v.arrivalDate, v.days ?? 1) : today(new Date(v.updatedAt ?? now));
    return addDays(end, s.privateRetentionDays!) < cutoff;
  });
  for (const v of due) {
    await db.update(contractorVisits).set({
      privateDetails: null, privateRemovedAt: now,
      history: [...((v.history as any[]) ?? []), { at: now.toISOString(), what: "Personal details removed after the retention period" }],
    }).where(eq(contractorVisits.id, v.id));
  }
  if (due.length) await recordSystemEvent({ action: "remove-personal-details", entityType: "visitor-form", entityLabel: `${due.length} visitor form${due.length === 1 ? "" : "s"}`,
    summary: `Emergency contact, support, mobile and vehicle details removed from ${due.length} visitor form${due.length === 1 ? "" : "s"} (${s.privateRetentionDays} days after the visit)` });
  return { removed: due.length };
}

/** Used when a person's details are removed altogether: their visitor forms lose their names, contact details and certificates (which carry their name). */
export async function scrubVisitsFor(userId: string): Promise<void> {
  const visits = await db.select().from(contractorVisits).where(eq(contractorVisits.userId, userId));
  if (!visits.length) return;
  const files = await db.select().from(contractorVisitFiles).where(inArray(contractorVisitFiles.visitId, visits.map(v => v.id)));
  for (const f of files) {
    await deleteObject(f.objectKey).catch(err => console.error("Retention: could not delete a visitor certificate:", err?.message));
    await db.update(contractorVisitFiles).set({ isActive: false, fileName: "(removed)", title: "(removed)" }).where(eq(contractorVisitFiles.id, f.id));
  }
  for (const v of visits) {
    const d = { ...(v.details as VisitDetails) };
    for (const k of ["preferredName", "businessEmail", "businessPhone", "completedBy", "signature"] as const) delete d[k];
    const c = v.checklist as VisitChecklist;
    await db.update(contractorVisits).set({
      visitorFirstName: "Former", visitorLastName: "visitor", details: d, privateDetails: null, privateRemovedAt: v.privateRemovedAt ?? new Date(),
      checklist: { ...c, answers: Object.fromEntries(Object.entries(c.answers ?? {}).map(([k, a]) => [k, { answer: a.answer }])) },
    }).where(eq(contractorVisits.id, v.id));
  }
}
