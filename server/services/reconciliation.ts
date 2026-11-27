// The migration reconciliation report: what the old system held, against what Capera holds now. It changes nothing.
//
// A difference is "explained" only when the records themselves show why (a decision made in Capera since, a later completion, an exemption, or
// an expiry Capera had to work out because the old system gave none). Anything else is unexplained and is someone's job to settle. The report
// passes only when no safety-critical difference is unexplained, nothing in the extract is missing from Capera, no record shown as imported is
// absent from the extract, and every row could be compared. Lesser unexplained differences are counted and still have to be settled.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { assessmentEvidence, assessments, competencyElements, jobRoles, trainingEnrollments, trainings, users } from "@shared/schema";
import { decisionTime, effectiveExpiry, groupByPair, isCompetentDecision, isDecision, isValidStatus, standingFor, statusFromExpiry, trainingExpiry } from "@shared/competence";
import { drawOrder } from "@shared/sampling";
import { assessmentRowsFor, pairKey, requirementsFor } from "./competenceRecords";
import { isProtected, OUTCOMES, syntheticEmail, type ImportRow } from "./historicalImportCheck";
import { openBatch } from "./evidenceBatch";
import { createHash } from "crypto";
import type { IStorage } from "../storage";

export type SourceRow = ImportRow & { sourceStatus?: string; sourceRef?: string };
export type PlainStatus = "in date" | "expired" | "not competent" | "exempt";
export type Kind = "person" | "competence" | "status" | "training" | "evidence" | "not in extract" | "extract";

export interface Difference { kind: Kind; row: number | null; sourceRef: string; person: string; email: string; item: string; safetyCritical: boolean; oldSystem: string; capera: string; explained: boolean; explanation: string }
export interface StatusLine { person: string; email: string; standard: string; safetyCritical: boolean; oldSystem: PlainStatus; oldSystemBasis: "stated" | "worked out"; capera: PlainStatus; caperaExpiry: string; agrees: boolean; explanation: string }
export interface Total { measure: string; oldSystem: number; matched: number; explained: number; unexplained: number }
export interface SampleLine { row: number; sourceRef: string; person: string; item: string; detail: string }
export interface Reconciliation {
  generatedAt: string; totals: Total[]; differences: Difference[]; statuses: StatusLine[]; sample: SampleLine[];
  acceptance: { unexplained: number; unexplainedSafetyCritical: number; missingFromCapera: number; importedButNotInExtract: number; rowsNotCompared: number; passed: boolean };
}

const DAY = 86_400_000;
/** the same calendar day, allowing for the time zone a spreadsheet date was read in */
const sameDay = (a?: Date | string | null, b?: Date | string | null) => !!a && !!b && Math.abs(new Date(a).getTime() - new Date(b).getTime()) < DAY;
const show = (d?: Date | string | null) => (d && !Number.isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : "none");
const valid = (d: Date | undefined) => !!d && !Number.isNaN(new Date(d).getTime());
const outcomeOf = (r: SourceRow) => (r.assessmentOutcome ? r.assessmentOutcome.trim().toLowerCase().replace(/\s+/g, "_") : "competent");
const words = (s: string) => s.replace(/_/g, " ");

/** the old system's own word for where someone stood, if it is one we can read */
export function statedStatus(v: string | undefined): PlainStatus | null {
  const s = (v ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!s) return null;
  if (["in date", "competent", "valid", "current", "expiring", "due soon", "due"].includes(s)) return "in date";
  if (["expired", "lapsed", "out of date", "overdue"].includes(s)) return "expired";
  if (["not competent", "not yet competent", "incomplete", "missing", "not held"].includes(s)) return "not competent";
  if (["exempt", "not required", "in training"].includes(s)) return "exempt";
  return null;
}

export async function reconcile(source: SourceRow[], storage: IStorage, opts: { evidenceZip?: Buffer; now?: Date } = {}): Promise<Reconciliation> {
  const now = opts.now ?? new Date();
  const differences: Difference[] = [], statuses: StatusLine[] = [], matchedForSample: SampleLine[] = [];
  const totals = new Map<string, Total>();
  const count = (measure: string, result: "matched" | "explained" | "unexplained") => {
    const t = totals.get(measure) ?? { measure, oldSystem: 0, matched: 0, explained: 0, unexplained: 0 };
    t.oldSystem++; t[result]++; totals.set(measure, t);
  };
  let rowsNotCompared = 0;

  // ---------------------------------------------------------------- people
  const emailOf = (r: SourceRow) => (r.email?.trim() || syntheticEmail(r.userName ?? "")).toLowerCase();
  const rows = source.map((r, i) => ({ r, row: i + 2, person: (r.userName ?? "").trim() }));
  const named = rows.filter((x) => {
    if (x.person.split(" ").length >= 2) return true;
    rowsNotCompared++;
    differences.push({ kind: "extract", row: x.row, sourceRef: x.r.sourceRef ?? "", person: x.person, email: "", item: "Row", safetyCritical: false, oldSystem: "no usable name", capera: "", explained: false, explanation: "The row has no first and last name, so it cannot be compared." });
    return false;
  });
  const emails = Array.from(new Set(named.map((x) => emailOf(x.r))));
  const found = emails.length ? await db.select().from(users).where(inArray(sql`lower(${users.email})`, emails)) : [];
  const byEmail = new Map<string, (typeof found)[number]>();
  for (const u of found) { const k = (u.email ?? "").toLowerCase(); if (!byEmail.has(k) || u.isActive) byEmail.set(k, u); }
  const roleNames = new Map((await db.select().from(jobRoles)).map((j) => [j.id, j.name]));

  for (const email of emails) {
    const mine = named.filter((x) => emailOf(x.r) === email);
    const first = mine[0], user = byEmail.get(email);
    const base = { kind: "person" as const, row: first.row, sourceRef: first.r.sourceRef ?? "", person: first.person, email, safetyCritical: false };
    if (!user) { count("People", "unexplained"); differences.push({ ...base, item: "Person", oldSystem: first.person, capera: "not held", explained: false, explanation: "This person is not in Capera." }); continue; }
    const wantedRole = [...mine].reverse().find((x) => x.r.jobRoleName)?.r.jobRoleName?.trim();
    const heldRole = user.jobRoleId ? roleNames.get(user.jobRoleId) : undefined;
    if (wantedRole && wantedRole.toLowerCase() !== (heldRole ?? "").toLowerCase()) {
      count("People", "unexplained");
      differences.push({ ...base, item: "Job role", oldSystem: wantedRole, capera: heldRole ?? "none", explained: false, explanation: "The job role differs. It decides what this person is required to hold." });
    } else count("People", "matched");
  }

  // ---------------------------------------------------------------- competence
  const userIds = Array.from(new Set(Array.from(byEmail.values()).map((u) => u.id)));
  const [required, held] = await Promise.all([requirementsFor(userIds), assessmentRowsFor(userIds)]);
  const records = groupByPair(held);
  const categories = new Map<string, string | null>();
  const elements = new Map<string, typeof competencyElements.$inferSelect | null>();
  const elementFor = async (category: string, name: string) => {
    const key = `${category}\u0000${name}`.toLowerCase();
    if (!elements.has(key)) {
      if (!categories.has(category.toLowerCase())) categories.set(category.toLowerCase(), (await storage.getCompetencyCategoryByName(category))?.id ?? null);
      const c = categories.get(category.toLowerCase());
      elements.set(key, (c ? await storage.getCompetencyElementByName(c, name) : undefined) ?? null);
    }
    return elements.get(key)!;
  };

  const competence = new Map<string, { email: string; element: typeof competencyElements.$inferSelect; list: typeof named }>();
  for (const x of named.filter((n) => n.r.competenceCategoryName || n.r.competenceElementName)) {
    const element = await elementFor(x.r.competenceCategoryName ?? "", x.r.competenceElementName ?? "");
    const problem = !element ? "This standard is not set up in Capera." : !valid(x.r.assessmentDate) ? "The row has no valid assessment date." : !OUTCOMES.includes(outcomeOf(x.r)) ? `The outcome "${x.r.assessmentOutcome}" is not one Capera records.` : "";
    if (problem) {
      rowsNotCompared++; count("Competence results", "unexplained");
      differences.push({ kind: "competence", row: x.row, sourceRef: x.r.sourceRef ?? "", person: x.person, email: emailOf(x.r), item: x.r.competenceElementName ?? "", safetyCritical: element ? element.safetyCriticality === "High" : true, oldSystem: `${x.r.assessmentOutcome ?? "Competent"} on ${show(x.r.assessmentDate)}`, capera: "not compared", explained: false, explanation: problem });
      continue;
    }
    const key = `${emailOf(x.r)}\u0000${element!.id}`;
    const group = competence.get(key) ?? { email: emailOf(x.r), element: element!, list: [] };
    group.list.push(x); competence.set(key, group);
  }

  const seenPairs = new Set<string>();
  for (const { email, element, list } of Array.from(competence.values())) {
    // what the old system says now is its latest dated result
    const latest = [...list].sort((a, b) => new Date(a.r.assessmentDate!).getTime() - new Date(b.r.assessmentDate!).getTime())[list.length - 1];
    const user = byEmail.get(email);
    const need = user ? required.get(pairKey(user.id, element.id)) : undefined;
    const own = user ? records.get(pairKey(user.id, element.id)) ?? [] : [];
    if (user) seenPairs.add(pairKey(user.id, element.id));
    const safetyCritical = need ? need.safetyCritical : element.safetyCriticality === "High";
    const item = element.code ? `${element.code}: ${element.name}` : element.name;
    const base = { row: latest.row, sourceRef: latest.r.sourceRef ?? "", person: latest.person, email, item, safetyCritical };
    const outcome = outcomeOf(latest.r), said = `${words(outcome)} on ${show(latest.r.assessmentDate)}${valid(latest.r.expiryDate) ? `, expires ${show(latest.r.expiryDate)}` : ""}`;

    const match = own.find((a) => isDecision(a) && a.outcome === outcome && (sameDay(a.assessmentDate, latest.r.assessmentDate) || sameDay(new Date(decisionTime(a)), latest.r.assessmentDate)));
    const signedSince = own.filter((a) => isProtected(a) && decisionTime(a) >= new Date(latest.r.assessmentDate!).getTime() - DAY).sort((a, b) => decisionTime(b) - decisionTime(a))[0];
    const standing = standingFor(own, element, need, now);

    if (match) {
      const kept = effectiveExpiry(match, element, need);
      if (isCompetentDecision(match) && valid(latest.r.expiryDate) && !sameDay(kept, latest.r.expiryDate)) {
        count("Competence results", "unexplained");
        differences.push({ kind: "competence", ...base, oldSystem: said, capera: `${words(match.outcome)}, expires ${show(kept)}`, explained: false, explanation: "The expiry date differs." });
      } else {
        count("Competence results", "matched");
        matchedForSample.push({ row: latest.row, sourceRef: base.sourceRef, person: latest.person, item, detail: said });
      }
    } else if (signedSince) {
      count("Competence results", "explained");
      differences.push({ kind: "competence", ...base, oldSystem: said, capera: `${words(signedSince.outcome)}, signed off in Capera on ${show(signedSince.signOffAt)}`, explained: true, explanation: "A decision has been signed off in Capera since. An import does not replace it." });
    } else {
      count("Competence results", "unexplained");
      const shown = standing.row && isDecision(standing.row) ? `${words(standing.row.outcome)} on ${show(new Date(decisionTime(standing.row)))}` : own.length ? "assigned, no result" : "not held";
      const earlierKept = list.some((x) => x !== latest && own.some((a) => isDecision(a) && a.outcome === outcomeOf(x.r) && sameDay(a.assessmentDate, x.r.assessmentDate)));
      differences.push({ kind: "competence", ...base, oldSystem: said, capera: shown, explained: false, explanation: !user ? "This person is not in Capera." : earlierKept ? "Capera holds an earlier result from this extract: the file lists it after the later one, and the import keeps the last row. Put the rows in date order and load again." : own.length ? "Capera holds something different." : "The result has not been loaded." });
    }

    // where the person stands: the old system against Capera, by the same rule every Capera screen uses
    const stated = statedStatus(latest.r.sourceStatus);
    const worked: PlainStatus = isCompetentDecision({ outcome } as any)
      ? (isValidStatus(statusFromExpiry(valid(latest.r.expiryDate) ? new Date(latest.r.expiryDate!) : effectiveExpiry({ outcome, assessmentDate: latest.r.assessmentDate } as any, element, need), now)) ? "in date" : "expired")
      : "not competent";
    const before = stated ?? worked;
    const caperaNow: PlainStatus = standing.exempt ? "exempt" : isValidStatus(standing.status) ? "in date" : standing.status === "expired" ? "expired" : "not competent";
    const agrees = before === caperaNow;
    let why = "", explained = false;
    if (!agrees) {
      if (standing.exempt) { why = "An exemption is recorded in Capera."; explained = true; }
      else if (standing.row && isProtected(standing.row) && decisionTime(standing.row) >= new Date(latest.r.assessmentDate!).getTime() - DAY) { why = `A decision was signed off in Capera on ${show(standing.row.signOffAt)}.`; explained = true; }
      else if (match && stated && !valid(latest.r.expiryDate) && standing.expiry) { why = `The extract gives no expiry date. Capera worked it out from the validity period: ${show(standing.expiry)}. The standards owner should confirm it.`; explained = true; }
      else why = stated && stated !== worked ? "The old system's stated status does not follow from its own dates. Settle which is right." : "No reason for this can be seen in the records.";
    }
    const line: StatusLine = { person: latest.person, email, standard: item, safetyCritical, oldSystem: before, oldSystemBasis: stated ? "stated" : "worked out", capera: caperaNow, caperaExpiry: standing.expiry ? show(standing.expiry) : "", agrees, explanation: why };
    statuses.push(line);
    count("Compliance status", agrees ? "matched" : explained ? "explained" : "unexplained");
    if (!agrees) differences.push({ kind: "status", ...base, oldSystem: before, capera: caperaNow, explained, explanation: why });
  }

  // Every record marked as imported, anywhere in Capera, must be in the extract: otherwise it has no source to be traced to. That includes
  // a person the extract leaves out altogether, so the report needs the complete extract.
  const imported = await db.select().from(assessments).where(and(eq(assessments.origin, "historical_import"), eq(assessments.isActive, true)));
  const strays = imported.filter((a) => !seenPairs.has(pairKey(a.candidateId, a.elementId)));
  if (strays.length) {
    const ids = Array.from(new Set(strays.map((a) => a.candidateId)));
    const names = new Map((await db.select().from(competencyElements).where(inArray(competencyElements.id, Array.from(new Set(strays.map((a) => a.elementId)))))).map((e) => [e.id, e]));
    const people = new Map((await db.select().from(users).where(inArray(users.id, ids))).map((u) => [u.id, { email: (u.email ?? "").toLowerCase(), name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() }]));
    for (const a of strays) {
      const e = names.get(a.elementId), p = people.get(a.candidateId) ?? { email: "", name: "Unknown person" };
      differences.push({ kind: "not in extract", row: null, sourceRef: "", person: p.name, email: p.email, item: e ? (e.code ? `${e.code}: ${e.name}` : e.name) : "Unknown standard", safetyCritical: e?.safetyCriticality === "High", oldSystem: "not listed", capera: `${words(a.outcome)} on ${show(a.assessmentDate)} (marked as imported)`, explained: false, explanation: "Capera shows this as imported, but this extract does not list it. Reconcile against the complete extract, or trace where it came from." });
    }
  }

  // ---------------------------------------------------------------- training
  const courses = new Map<string, typeof trainings.$inferSelect | null>();
  const enrolled = userIds.length ? await db.select().from(trainingEnrollments).where(and(inArray(trainingEnrollments.userId, userIds), eq(trainingEnrollments.isActive, true))) : [];
  const completions = new Map<string, { x: (typeof named)[number]; email: string; course: typeof trainings.$inferSelect | null }>();
  for (const x of named.filter((n) => n.r.trainingName)) {
    const k = x.r.trainingName!.trim().toLowerCase();
    if (!courses.has(k)) courses.set(k, (await storage.getTrainingByName(x.r.trainingName!)) ?? null);
    const key = `${emailOf(x.r)}\u0000${k}`;
    const prev = completions.get(key);
    if (!prev || new Date(x.r.trainingCompletionDate ?? 0).getTime() >= new Date(prev.x.r.trainingCompletionDate ?? 0).getTime()) completions.set(key, { x, email: emailOf(x.r), course: courses.get(k)! });
  }
  for (const { x, email, course } of Array.from(completions.values())) {
    const user = byEmail.get(email);
    const base = { kind: "training" as const, row: x.row, sourceRef: x.r.sourceRef ?? "", person: x.person, email, item: course?.name ?? x.r.trainingName!, safetyCritical: !!course?.isSafetyCritical };
    const said = `completed ${show(x.r.trainingCompletionDate)}${valid(x.r.trainingExpiryDate) ? `, expires ${show(x.r.trainingExpiryDate)}` : ""}`;
    if (!course || !valid(x.r.trainingCompletionDate)) { rowsNotCompared++; count("Training records", "unexplained"); differences.push({ ...base, oldSystem: said, capera: "not compared", explained: false, explanation: !course ? "This course is not set up in Capera." : "The row has no valid completion date." }); continue; }
    const own = user ? enrolled.filter((e) => e.userId === user.id && e.trainingId === course.id && e.achievementDate) : [];
    const match = own.find((e) => sameDay(e.achievementDate, x.r.trainingCompletionDate));
    const later = own.filter((e) => e.achievementDate!.getTime() > new Date(x.r.trainingCompletionDate!).getTime() + DAY).sort((a, b) => b.achievementDate!.getTime() - a.achievementDate!.getTime())[0];
    if (match && (!valid(x.r.trainingExpiryDate) || sameDay(trainingExpiry(match, course), x.r.trainingExpiryDate))) { count("Training records", "matched"); matchedForSample.push({ row: x.row, sourceRef: base.sourceRef, person: x.person, item: course.name, detail: said }); }
    else if (match) { count("Training records", "unexplained"); differences.push({ ...base, oldSystem: said, capera: `expires ${show(trainingExpiry(match, course))}`, explained: false, explanation: "The expiry date differs." }); }
    else if (later) { count("Training records", "explained"); differences.push({ ...base, oldSystem: said, capera: `completed again ${show(later.achievementDate)}`, explained: true, explanation: "Capera holds a later completion of this course." }); }
    else { count("Training records", "unexplained"); differences.push({ ...base, oldSystem: said, capera: own.length ? `completed ${show(own[0].achievementDate)}` : "not held", explained: false, explanation: own.length ? "The completion date differs." : "The completion has not been loaded." }); }
  }

  // ---------------------------------------------------------------- evidence files
  if (opts.evidenceZip) {
    const batch = await openBatch(opts.evidenceZip);
    const addresses = Array.from(new Set(batch.rows.map((r) => r.email).filter(Boolean)));
    const owners = addresses.length ? await db.select().from(users).where(inArray(sql`lower(${users.email})`, addresses)) : [];
    const ownerOf = new Map<string, (typeof owners)[number]>();
    for (const u of owners) { const k = (u.email ?? "").toLowerCase(); if (!ownerOf.has(k) || u.isActive) ownerOf.set(k, u); }
    const ids = Array.from(new Set(Array.from(ownerOf.values()).map((u) => u.id)));
    const files = ids.length ? await db.select({ hash: assessmentEvidence.contentHash, candidateId: assessments.candidateId, elementId: assessments.elementId })
      .from(assessmentEvidence).innerJoin(assessments, eq(assessmentEvidence.assessmentId, assessments.id))
      .where(and(inArray(assessments.candidateId, ids), eq(assessments.isActive, true), sql`coalesce(${assessmentEvidence.isActive}, true)`)) : [];
    for (const m of batch.rows) {
      const owner = ownerOf.get(m.email);
      const element = await elementFor(m.category, m.element);
      const got = m.file ? await batch.read(m.file) : { problem: "No file is named." };
      const hash = Buffer.isBuffer(got) ? createHash("sha256").update(got).digest("hex") : m.fingerprint;
      const base = { kind: "evidence" as const, row: m.row, sourceRef: m.sourceRef, person: owner ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() : "", email: m.email, item: `${m.element}: ${m.file}`, safetyCritical: !!element && element.safetyCriticality === "High" };
      const bad = (capera: string, explanation: string) => { count("Evidence files", "unexplained"); differences.push({ ...base, oldSystem: "listed", capera, explained: false, explanation }); };
      if (!owner) { bad("not held", "No person in Capera has this email address."); continue; }
      if (!element) { bad("not held", "This standard is not set up in Capera."); continue; }
      if (m.fingerprint && Buffer.isBuffer(got) && m.fingerprint !== hash) { bad("not compared", "The file in the zip does not match the fingerprint in the list."); continue; }
      if (!hash) { bad("not compared", Buffer.isBuffer(got) ? "" : (got as { problem: string }).problem); continue; }
      const mine = files.filter((f) => f.candidateId === owner.id && f.hash === hash);
      if (mine.some((f) => f.elementId === element.id)) { count("Evidence files", "matched"); matchedForSample.push({ row: m.row, sourceRef: m.sourceRef, person: base.person, item: base.item, detail: `evidence file, fingerprint ${hash.slice(0, 12)}` }); }
      else bad(mine.length ? "held against another standard" : "not held", mine.length ? "The file is on this person's record, but not against this standard." : "The file has not been loaded.");
    }
  }

  // a sample to trace by hand back to the source: one in twenty of what matched, at least ten, drawn so that it cannot be chosen
  const size = Math.min(matchedForSample.length, Math.max(10, Math.ceil(matchedForSample.length / 20)));
  const seed = now.toISOString().slice(0, 10);
  const sample = [...matchedForSample].sort((a, b) => drawOrder(`${seed}:${a.row}:${a.item}`) - drawOrder(`${seed}:${b.row}:${b.item}`)).slice(0, size).sort((a, b) => a.row - b.row);

  // a status difference and its result difference are the same problem seen twice, but both are listed; acceptance counts each person and standard once
  const open = differences.filter((d) => !d.explained);
  const criticalPairs = new Set(open.filter((d) => d.safetyCritical).map((d) => `${d.email}\u0000${d.item}`));
  // something the old system held that did not arrive, or arrived in the wrong place
  const missing = open.filter((d) => ["not held", "assigned, no result", "held against another standard"].includes(d.capera)).length;
  const order: Record<string, number> = { People: 0, "Competence results": 1, "Compliance status": 2, "Training records": 3, "Evidence files": 4 };
  const strayCount = differences.filter((d) => d.kind === "not in extract").length;
  differences.sort((a, b) => Number(a.explained) - Number(b.explained) || Number(b.safetyCritical) - Number(a.safetyCritical) || a.person.localeCompare(b.person) || a.item.localeCompare(b.item));
  return {
    generatedAt: now.toISOString(), totals: Array.from(totals.values()).sort((a, b) => order[a.measure] - order[b.measure]), differences, statuses, sample,
    acceptance: { unexplained: open.length, unexplainedSafetyCritical: criticalPairs.size, missingFromCapera: missing, importedButNotInExtract: strayCount, rowsNotCompared, passed: criticalPairs.size === 0 && missing === 0 && strayCount === 0 && rowsNotCompared === 0 },
  };
}
