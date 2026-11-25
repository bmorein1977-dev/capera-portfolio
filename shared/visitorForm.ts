// The pre-site visitor form: a contracting company's administrator tells the host company who is coming for a short visit, and sends the competence
// checklist and the certificates for the people and equipment. The screen and the server both read this file, so what the screen asks for is exactly
// what the server insists on.
//
// All wording here is Capera's own default. A host company changes any of it on Contractor Management, Visitor form settings; nothing in it belongs
// to a particular company or site.
import { z } from "zod";

export type ChecklistAnswer = "yes" | "no" | "na";
export interface ChecklistItem { key: string; text: string; evidence: string }
export interface ChecklistSection {
  key: "personnel" | "tasks" | "supervision" | "equipment";
  title: string;
  naAllowed: boolean; // whether "not applicable" is a possible answer in this section
  items: ChecklistItem[];
}

export const DEFAULT_CHECKLIST: ChecklistSection[] = [
  {
    key: "personnel", title: "Competence of the people attending", naAllowed: false, items: [
      { key: "p-technical", text: "Each person is technically competent for the work they will do", evidence: "Trade or professional qualifications" },
      { key: "p-training", text: "Industry training relevant to the work has been completed", evidence: "Training records" },
      { key: "p-experience", text: "Their experience suits the role", evidence: "CV or experience record" },
      { key: "p-assessed", text: "Their competence in the role has been assessed", evidence: "Assessment records" },
      { key: "p-specialist", text: "Certification for any specialist activity is in date", evidence: "For example electrical, lifting or confined space certificates" },
      { key: "p-permit", text: "They understand how a permit to work system operates", evidence: "Permit to work training or briefing record" },
      { key: "p-isolation", text: "They understand isolation procedures", evidence: "Lock-out and tag-out (isolation) training" },
      { key: "p-procedures", text: "They can work to the site's operating procedures", evidence: "Record of similar work" },
      { key: "p-risk", text: "They understand risk assessment", evidence: "Risk assessment or toolbox talk training" },
      { key: "p-supervisors", text: "Their supervisors have experience of hazardous workplaces", evidence: "Supervisor's CV" },
    ],
  },
  {
    key: "tasks", title: "Competence for particular activities", naAllowed: true, items: [
      { key: "t-electrical", text: "Electrical work", evidence: "Electrical trade qualification, with hazardous area (for example CompEx or IECEx) certification where needed" },
      { key: "t-mechanical", text: "Mechanical maintenance", evidence: "Mechanical qualification" },
      { key: "t-instrument", text: "Instrumentation work", evidence: "Instrument technician qualification, with hazardous area (for example CompEx or IECEx) certification where needed" },
      { key: "t-control", text: "Control system work", evidence: "Training on the control system concerned" },
      { key: "t-hot", text: "Hot work", evidence: "Hot work training" },
      { key: "t-height", text: "Work at height", evidence: "Work at height certificate" },
      { key: "t-confined", text: "Entry into confined spaces", evidence: "Confined space certificate" },
      { key: "t-lifting", text: "Lifting operations", evidence: "Evidence of lifting competence" },
      { key: "t-pressure", text: "Work on pressure systems", evidence: "Evidence of pressure systems experience" },
      { key: "t-isolation", text: "Isolating and reinstating plant", evidence: "Isolation training" },
    ],
  },
  {
    key: "supervision", title: "Supervision of the work", naAllowed: true, items: [
      { key: "s-control", text: "A named supervisor is responsible for controlling the work", evidence: "The supervisor's defined role" },
    ],
  },
  {
    key: "equipment", title: "Equipment and tools being brought to site", naAllowed: true, items: [
      { key: "e-hazardous", text: "Equipment used in a hazardous area is suitable for it", evidence: "Hazardous area (for example ATEX) certification" },
      { key: "e-inspection", text: "Inspection certificates are available", evidence: "Inspection records" },
      { key: "e-calibration", text: "Calibration is in date", evidence: "Calibration certificates" },
      { key: "e-tools", text: "Tools are suitable for the work", evidence: "Equipment specification" },
      { key: "e-portable", text: "Portable electrical equipment has been tested", evidence: "Portable appliance test records" },
      { key: "e-pressure", text: "Pressure equipment is certified", evidence: "Pressure equipment certificates" },
      { key: "e-gas", text: "Gas detectors being brought are working and calibrated", evidence: "Calibration records" },
      { key: "e-lifting", text: "Lifting equipment is certified", evidence: "Thorough examination certificates (LOLER)" },
      { key: "e-ppe", text: "Protective equipment suits the work (ask the site before travelling if unsure of the minimum)", evidence: "Protective equipment inspection" },
      { key: "e-emergency", text: "Any emergency equipment needed is available", evidence: "Equipment list" },
    ],
  },
];

export const DECLARATIONS: Array<{ key: string; text: string }> = [
  { key: "accurate", text: "The details on this form are correct, and only what is needed for this visit has been given." },
  { key: "identity", text: "The visitor knows they may be asked to prove who they are when they arrive." },
  { key: "contact", text: "The emergency contact has agreed to their details being held for use in an emergency during this visit." },
  { key: "support", text: "The visitor knows that any access or support information is used only to arrange a safe visit." },
  { key: "rules", text: "The visitor will follow the site rules, complete any induction, wear the protective equipment required and stay with their host where asked to." },
];

export const SUPPORT_TYPES = ["Mobility or access", "Sight", "Hearing or communication", "Other"];

export const DEFAULT_PRIVACY_NOTICE = [
  "The company you are visiting is responsible for the information on this form. Ask your host who to contact with a privacy question.",
  "It is used to arrange the visit, control who is on site, keep the site secure, plan for emergencies and meet safety and legal duties.",
  "It is seen by the people who need it to arrange or support the visit, such as site security, the host, the visit organiser and emergency responders.",
  "Give only what is needed. Any access or health information is used only to support a safe and fair visit.",
  "You can ask to see or correct your information, ask for it to be deleted or restricted, or object to its use, as the law allows. You can also complain to your data protection regulator.",
  "If you give another person's details, make sure they know and agree.",
].join("\n");

export const DEFAULT_SITE_NOTES = [
  "The host makes sure visitors are met, briefed and accompanied as the site requires.",
  "If the vehicle registration is not known in advance, give it to security on arrival.",
  "Follow the parking arrangements and speed limits on site.",
].join("\n");

export interface VisitorSettings {
  submissionEmails: string[];      // where a submitted form is sent
  noticeDays: number;              // how many days before arrival it must be submitted
  lateRule: "flag" | "block";      // a late form is accepted and marked late (with a reason), or refused
  checklistRule: "always" | "safety_critical";
  maxVisitDays: number;            // longer than this is not a short visit
  siteName: string;
  accessLocations: string[];
  ppeItems: string[];
  siteNotes: string;
  privacyNotice: string;
  privateRetentionDays: number | null; // emergency contact, support details, mobile and vehicle are removed this long after the visit; null = not removed automatically
  emailAttachments: boolean;       // the email carries the form and certificates, or only says one is waiting
  checklist: ChecklistSection[];
}

export const DEFAULT_SETTINGS: VisitorSettings = {
  submissionEmails: [], noticeDays: 3, lateRule: "flag", checklistRule: "always", maxVisitDays: 5, siteName: "",
  accessLocations: ["Main gate (visitor reception)", "Site office"],
  ppeItems: ["Safety footwear", "Safety helmet", "Flame-resistant coveralls", "High-visibility jacket", "Eye protection", "Gloves"],
  siteNotes: DEFAULT_SITE_NOTES, privacyNotice: DEFAULT_PRIVACY_NOTICE, privateRetentionDays: null, emailAttachments: true, checklist: DEFAULT_CHECKLIST,
};

// What the notice says about keeping the information follows the setting, so it cannot promise something the system does not do.
export function retentionSentence(days: number | null): string {
  return days === null
    ? "How long this form is kept is set by the company's records policy."
    : `Emergency contact, access and support details, mobile number, employer emergency number and vehicle registration are removed ${days} day${days === 1 ? "" : "s"} after the visit ends, unless they have to be kept for an incident, a security enquiry or a legal duty. The rest of the form and the competence evidence are kept as the record of the checks made.`;
}

// ---------------------------------------------------------------------------------------------------------------- what is saved

const text = (max = 200) => z.string().trim().max(max);

/** The visit itself. Saved as a draft in any state of completeness; what must be filled in is checked when it is submitted. */
export const detailsSchema = z.object({
  preferredName: text(100), employerAddress: text(500), businessPhone: text(60), businessEmail: text(254), departureTime: text(100),
  hostName: text(150), hostPhone: text(60), location: text(200), purpose: text(2000), organiser: text(150),
  safetyCritical: z.enum(["", "yes", "no"]),
  ppe: z.array(z.object({ item: text(100), required: z.boolean(), size: text(100) }).strict()).max(40),
  declarations: z.array(text(40)).max(20),
  completedBy: text(150), signature: text(150),
}).partial().strict();
export type VisitDetails = z.infer<typeof detailsSchema>;

/** Personal details that are only needed around the visit. Kept apart so they can be removed afterwards without losing the record of the checks. */
export const privateSchema = z.object({
  mobile: text(60), employerEmergencyPhone: text(60), vehicleReg: text(60),
  emergencyName: text(150), emergencyPhone: text(60), emergencyRelationship: text(100), emergencyPermission: z.boolean(),
  supportNeeded: z.enum(["", "yes", "no"]), supportTypes: z.array(text(60)).max(8), supportDetails: text(1000),
}).partial().strict();
export type VisitPrivate = z.infer<typeof privateSchema>;

export const checklistSchema = z.object({
  supervisorName: text(150),
  answers: z.record(z.string().max(60), z.object({ answer: z.enum(["", "yes", "no", "na"]), comment: text(1000) }).partial().strict()),
}).partial().strict();
export type VisitChecklist = z.infer<typeof checklistSchema>;

export const FILE_CATEGORIES = ["personnel", "equipment"] as const;
export type FileCategory = typeof FILE_CATEGORIES[number];
export const CERTIFICATE_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "docx", "doc"];
export const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_VISIT = 30;

// ---------------------------------------------------------------------------------------------------------------- dates (plain yyyy-mm-dd, no time of day)

export const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
export function addDays(day: string, n: number): string { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/** The last day a form can be submitted on and still be in time. */
export const submitBy = (arrival: string, noticeDays: number) => addDays(arrival, -noticeDays);
/** The last day of the visit. */
export const lastDay = (arrival: string, days: number) => addDays(arrival, Math.max(1, days) - 1);
export const longDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// ---------------------------------------------------------------------------------------------------------------- what must be there to submit

export interface VisitForCheck {
  visitorFirstName: string; visitorLastName: string; arrivalDate: string | null; days: number | null;
  details: VisitDetails; privateDetails: VisitPrivate; checklist: VisitChecklist;
  files: Array<{ category: string }>;
}

export const checklistNeeded = (s: Pick<VisitorSettings, "checklistRule">, d: VisitDetails) => s.checklistRule === "always" || d.safetyCritical === "yes";

/** Everything still to be done before the form can be submitted, in plain words. Empty means it is ready. */
export function stillNeeded(v: VisitForCheck, s: VisitorSettings, today: string): string[] {
  const out: string[] = [];
  const d = v.details ?? {}, p = v.privateDetails ?? {}, c = v.checklist ?? {};
  const need = (value: unknown, what: string) => { if (!String(value ?? "").trim()) out.push(what); };

  need(v.visitorFirstName, "Visitor's forename");
  need(v.visitorLastName, "Visitor's surname");
  need(d.businessEmail, "Visitor's business email");
  need(p.mobile, "Visitor's business or mobile number");

  if (!v.arrivalDate || !isDay(v.arrivalDate)) out.push("Date of arrival");
  else if (v.arrivalDate < today) out.push("A date of arrival that is not in the past");
  if (!v.days || v.days < 1) out.push("How many days the visit lasts");
  else if (v.days > s.maxVisitDays) out.push(`A visit of ${s.maxVisitDays} days or less (a longer stay is not a short visit: add the person under People instead)`);

  need(d.hostName, "Host's name");
  need(d.hostPhone, "Host's telephone number");
  need(d.location, "Where access is needed");
  need(d.purpose, "Purpose of the visit and scope of work");
  need(d.organiser, "Visit organiser");
  if (d.safetyCritical !== "yes" && d.safetyCritical !== "no") out.push("Whether the visit involves a safety critical role or equipment");

  need(p.emergencyName, "Emergency contact's name");
  need(p.emergencyPhone, "Emergency contact's telephone number");
  if (!p.emergencyPermission) out.push("Confirmation that the emergency contact has agreed");
  if (p.supportNeeded !== "yes" && p.supportNeeded !== "no") out.push("Whether any adjustments or access support are needed");
  else if (p.supportNeeded === "yes" && !(p.supportTypes?.length || p.supportDetails?.trim())) out.push("What support is needed");

  if (checklistNeeded(s, d)) {
    need(c.supervisorName, "Contractor's supervisor (checklist)");
    let unanswered = 0, uncommented = 0, equipmentYes = false;
    for (const section of s.checklist) {
      for (const item of section.items) {
        const a = c.answers?.[item.key];
        if (!a?.answer || (a.answer === "na" && !section.naAllowed)) { unanswered++; continue; }
        if (a.answer === "no" && !a.comment?.trim()) uncommented++;
        if (a.answer === "yes" && section.key === "equipment") equipmentYes = true;
      }
    }
    if (unanswered) out.push(`${unanswered} checklist question${unanswered === 1 ? "" : "s"} still to answer`);
    if (uncommented) out.push(`A comment on each checklist answer of "No" (${uncommented} missing)`);
    if (!v.files.some(f => f.category === "personnel")) out.push("At least one certificate for the people attending");
    if (equipmentYes && !v.files.some(f => f.category === "equipment")) out.push("At least one certificate for the equipment being brought");
  }

  const ticked = new Set(d.declarations ?? []);
  if (DECLARATIONS.some(x => !ticked.has(x.key))) out.push("All the declarations");
  need(d.completedBy, "Who completed the form");
  need(d.signature, "Signature (type your full name)");
  return out;
}

// ---------------------------------------------------------------------------------------------------------------- the host's settings

const lines = (max: number, each = 200) => z.array(z.string().trim().min(1).max(each)).max(max);
export const settingsSchema = z.object({
  submissionEmails: z.array(z.string().trim().toLowerCase().email().max(254)).max(5),
  noticeDays: z.number().int().min(0).max(90),
  lateRule: z.enum(["flag", "block"]),
  checklistRule: z.enum(["always", "safety_critical"]),
  maxVisitDays: z.number().int().min(1).max(60),
  siteName: z.string().trim().max(150),
  accessLocations: lines(30).refine(a => a.length > 0, "at least one location"),
  ppeItems: lines(40, 100),
  siteNotes: z.string().trim().max(4000),
  privacyNotice: z.string().trim().min(20).max(6000),
  privateRetentionDays: z.number().int().min(1).max(3650).nullable(),
  emailAttachments: z.boolean(),
  checklist: z.array(z.object({
    key: z.enum(["personnel", "tasks", "supervision", "equipment"]), title: z.string().trim().min(1).max(150), naAllowed: z.boolean(),
    items: z.array(z.object({ key: z.string().regex(/^[a-z0-9-]{1,60}$/), text: z.string().trim().min(1).max(300), evidence: z.string().trim().max(300) }).strict()).max(40),
  }).strict()).max(4),
}).strict();
