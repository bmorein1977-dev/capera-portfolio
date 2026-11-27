// The bulk evidence loader, for moving evidence files from a previous system. A batch is a zip file holding the files and a list (manifest.xlsx
// or manifest.csv) that says, for each file, whose it is and which standard it supports. A trial run reports every row and changes nothing.
//
// What it will not do: give one person's file to another; add anything to a decision made and signed off in Capera (that decision was not made
// on it); load a file that fails the checks an ordinary upload has to pass, or that does not match the fingerprint the old system gave.
// Running the same batch again loads nothing twice.
import { createHash } from "crypto";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { assessmentEvidence, assessments, competencyElements, users } from "@shared/schema";
import { decisionTime, isDecision } from "@shared/competence";
import { EVIDENCE_DESCRIPTION_MAX, EVIDENCE_MAX_BYTES, EVIDENCE_TITLE_MAX, evidenceTypeFrom } from "@shared/evidence";
import { checkUpload, EVIDENCE_EXTENSIONS } from "../security";
import { buildObjectKey, uploadObject } from "./objectStorage";
import type { IStorage } from "../storage";

export const BATCH_LIMITS = { zipBytes: 100 * 1024 * 1024, unpackedBytes: 400 * 1024 * 1024, rows: 2000, entries: 3000 };
export const MANIFEST_COLUMNS = ["File", "Email", "Competence Category", "Competence Element", "Title", "Evidence Type", "Description", "Original Date", "Fingerprint (SHA-256)", "Source Reference"];
export const SIGNED_OFF_MESSAGE = "The only record for this person and standard was signed off in Capera. Evidence from an old system is not added to a decision made here.";

export class BatchError extends Error {}

export interface ManifestRow {
  row: number; file: string; email: string; category: string; element: string; title: string; evidenceType: string; description: string;
  originalDate: string; fingerprint: string; sourceRef: string;
}
export interface LoadedRow {
  row: number; file: string; email: string; standard: string; sourceRef: string; size: number; fingerprint: string;
  action: "load" | "attach" | "already there" | "not loaded"; problems: string[]; warnings: string[];
}
export interface BatchResult {
  dryRun: boolean; rows: number; toLoad: number; loaded: number; alreadyThere: number; withProblems: number; unlistedFiles: string[]; detail: LoadedRow[];
}

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const tidyPath = (p: string) => p.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
const asDay = (v: unknown) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : String(v ?? "").trim());

export interface OpenBatch { rows: ManifestRow[]; read: (file: string) => Promise<Buffer | { problem: string }>; files: string[] }

/** opens the zip and reads its list. Sizes are checked before anything is unpacked. */
export async function openBatch(zipBytes: Buffer): Promise<OpenBatch> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(zipBytes); } catch { throw new BatchError("That is not a zip file that can be read."); }
  const entries = Object.values(zip.files).filter((f) => !f.dir && !/(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/i.test(f.name));
  if (entries.length > BATCH_LIMITS.entries) throw new BatchError(`The zip holds more than ${BATCH_LIMITS.entries} files. Split it into smaller batches.`);
  const sizeOf = (f: JSZip.JSZipObject): number => Number((f as any)._data?.uncompressedSize ?? 0);
  if (entries.reduce((n, f) => n + sizeOf(f), 0) > BATCH_LIMITS.unpackedBytes) throw new BatchError("The files in the zip are too large once unpacked. Split them into smaller batches.");

  const manifest = entries.filter((f) => /(^|\/)manifest\.(xlsx|csv)$/i.test(f.name)).sort((a, b) => a.name.split("/").length - b.name.split("/").length)[0];
  if (!manifest) throw new BatchError("The zip needs a list of its files, named manifest.xlsx or manifest.csv.");
  if (sizeOf(manifest) > 5 * 1024 * 1024) throw new BatchError("The list of files is too large.");
  const base = manifest.name.slice(0, manifest.name.lastIndexOf("/") + 1);

  const bytes = await manifest.async("nodebuffer");
  const book = /\.csv$/i.test(manifest.name) ? XLSX.read(bytes.toString("utf8").replace(/^﻿/, ""), { type: "string", raw: true }) : XLSX.read(bytes, { type: "buffer", cellDates: true });
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "" });
  if (!raw.length) throw new BatchError("The list of files has no rows.");
  if (raw.length > BATCH_LIMITS.rows) throw new BatchError(`The list has more than ${BATCH_LIMITS.rows} rows. Split it into smaller batches.`);
  const headings = Object.keys(raw[0]);
  const find = (...names: string[]) => headings.find((h) => names.includes(squash(h)));
  const col = {
    file: find("file", "filename", "path"), email: find("email"), category: find("competencecategory", "category"), element: find("competenceelement", "element", "standard"),
    title: find("title"), evidenceType: find("evidencetype", "type"), description: find("description"), originalDate: find("originaldate", "date"),
    fingerprint: find("fingerprintsha256", "fingerprint", "sha256"), sourceRef: find("sourcereference", "sourceref", "reference"),
  };
  const missing = (["file", "email", "category", "element"] as const).filter((k) => !col[k]);
  if (missing.length) throw new BatchError(`The list needs the columns File, Email, Competence Category and Competence Element. Missing: ${missing.join(", ")}.`);
  const text = (r: Record<string, unknown>, h?: string) => (h ? String(r[h] ?? "").trim() : "");
  const rows: ManifestRow[] = raw.map((r, i) => ({
    row: i + 2, file: tidyPath(text(r, col.file)), email: text(r, col.email).toLowerCase(), category: text(r, col.category), element: text(r, col.element),
    title: text(r, col.title), evidenceType: text(r, col.evidenceType), description: text(r, col.description), originalDate: col.originalDate ? asDay(r[col.originalDate]) : "",
    fingerprint: text(r, col.fingerprint).toLowerCase(), sourceRef: text(r, col.sourceRef),
  }));

  const byPath = new Map(entries.filter((f) => f !== manifest && f.name.startsWith(base)).map((f) => [tidyPath(f.name.slice(base.length)).toLowerCase(), f]));
  const cache = new Map<string, Buffer | { problem: string }>();
  return {
    rows,
    files: Array.from(byPath.values()).map((f) => f.name.slice(base.length)),
    read: async (file: string) => {
      const key = file.toLowerCase();
      const held = cache.get(key);
      if (held) return held;
      const entry = byPath.get(key);
      let out: Buffer | { problem: string };
      if (!entry) out = { problem: `"${file}" is not in the zip.` };
      else if (sizeOf(entry) > EVIDENCE_MAX_BYTES) out = { problem: `"${file}" is larger than ${EVIDENCE_MAX_BYTES / 1024 / 1024} MB, the most one evidence file can be.` };
      else {
        const b = await entry.async("nodebuffer");
        out = b.length > EVIDENCE_MAX_BYTES ? { problem: `"${file}" is larger than ${EVIDENCE_MAX_BYTES / 1024 / 1024} MB, the most one evidence file can be.` } : b;
      }
      cache.set(key, out);
      return out;
    },
  };
}

type Row = typeof assessments.$inferSelect;
/** the record the old evidence belongs with: the imported result if there is one, else the latest unsigned result, else the open assessment */
export function targetFor(rows: Row[]): { target?: Row; problem?: string } {
  if (!rows.length) return { problem: "There is no assessment record for this person and standard. Load the people and their records first." };
  const unsigned = rows.filter((r) => !r.signOffAt);
  if (!unsigned.length) return { problem: SIGNED_OFF_MESSAGE };
  const latest = (list: Row[]) => [...list].sort((a, b) => decisionTime(b) - decisionTime(a))[0];
  const imported = unsigned.filter((r) => r.origin === "historical_import" && isDecision(r));
  const decided = unsigned.filter(isDecision);
  return { target: imported.length ? latest(imported) : decided.length ? latest(decided) : latest(unsigned) };
}

interface Plan { out: LoadedRow; m: ManifestRow; bytes?: Buffer; mime?: string; candidateId?: string; target?: Row }

export async function runEvidenceBatch(zipBytes: Buffer, storage: IStorage, opts: { dryRun: boolean; actorId: string }): Promise<BatchResult> {
  const batch = await openBatch(zipBytes);

  const emails = Array.from(new Set(batch.rows.map((r) => r.email).filter(Boolean)));
  const people = emails.length ? await db.select().from(users).where(inArray(sql`lower(${users.email})`, emails)) : [];
  // a leaver can have more than one account with an address: the one still open is meant
  const personByEmail = new Map<string, (typeof people)[number]>();
  for (const p of people) { const k = (p.email ?? "").toLowerCase(); if (!personByEmail.has(k) || p.isActive) personByEmail.set(k, p); }

  const elements = new Map<string, typeof competencyElements.$inferSelect | { problem: string }>();
  const elementFor = async (category: string, element: string) => {
    const key = `${category}\u0000${element}`.toLowerCase();
    let found = elements.get(key);
    if (!found) {
      const c = await storage.getCompetencyCategoryByName(category);
      const e = c ? await storage.getCompetencyElementByName(c.id, element) : undefined;
      found = e ?? { problem: c ? `Competence element not found: "${element}".` : `Competence category not found: "${category}".` };
      elements.set(key, found);
    }
    return found;
  };

  // 1. each row on its own
  const plans: Plan[] = [];
  const recordsOf = new Map<string, Row[]>();
  for (const m of batch.rows) {
    const out: LoadedRow = { row: m.row, file: m.file, email: m.email, standard: m.element, sourceRef: m.sourceRef, size: 0, fingerprint: "", action: "not loaded", problems: [], warnings: [] };
    const plan: Plan = { out, m };
    plans.push(plan);
    if (!m.file) out.problems.push("No file is named.");
    else {
      const got = await batch.read(m.file);
      if (!Buffer.isBuffer(got)) out.problems.push(got.problem);
      else {
        const name = m.file.split("/").pop()!;
        const verdict = checkUpload({ originalname: name, buffer: got }, EVIDENCE_EXTENSIONS);
        out.size = got.length; out.fingerprint = sha256(got);
        if (!verdict.ok) out.problems.push(verdict.reason); else { plan.bytes = got; plan.mime = verdict.mime; }
        if (m.fingerprint && m.fingerprint !== out.fingerprint) out.problems.push("The file does not match the fingerprint in the list: it has changed or been damaged since it left the old system.");
      }
    }
    if (m.title.length > EVIDENCE_TITLE_MAX) out.problems.push(`The title is longer than ${EVIDENCE_TITLE_MAX} characters.`);
    if (m.evidenceType && !evidenceTypeFrom(m.evidenceType)) out.warnings.push(`"${m.evidenceType}" is not one of Capera's kinds of evidence, so no kind is recorded.`);
    const person = personByEmail.get(m.email);
    if (!person) out.problems.push(m.email ? `No person has the email address ${m.email}.` : "No email address is given.");
    else plan.candidateId = person.id;
    const element = await elementFor(m.category, m.element);
    if ("problem" in element) out.problems.push(element.problem);
    else if (person) {
      out.standard = element.code ? `${element.code}: ${element.name}` : element.name;
      const key = `${person.id}:${element.id}`;
      let held = recordsOf.get(key);
      if (!held) { held = await db.select().from(assessments).where(and(eq(assessments.candidateId, person.id), eq(assessments.elementId, element.id), eq(assessments.isActive, true))); recordsOf.set(key, held); }
      const t = targetFor(held);
      if (t.problem) out.problems.push(t.problem); else plan.target = t.target;
    }
  }

  // 2. across the batch: a file listed for two people cannot be trusted for either
  const owners = new Map<string, Set<string>>();
  for (const p of plans) if (p.out.fingerprint && p.candidateId) owners.set(p.out.fingerprint, (owners.get(p.out.fingerprint) ?? new Set()).add(p.candidateId));
  for (const p of plans) if ((owners.get(p.out.fingerprint)?.size ?? 0) > 1) p.out.problems.push("The same file is listed for more than one person. A file belongs to one person: check which is right.");

  // 3. against what is already held
  const hashes = Array.from(owners.keys());
  const held = hashes.length ? await db.select({ id: assessmentEvidence.id, assessmentId: assessmentEvidence.assessmentId, candidateId: assessments.candidateId, hash: assessmentEvidence.contentHash, url: assessmentEvidence.fileUrl, linkedFromId: assessmentEvidence.linkedFromId })
    .from(assessmentEvidence).innerJoin(assessments, eq(assessmentEvidence.assessmentId, assessments.id))
    .where(and(inArray(assessmentEvidence.contentHash, hashes), sql`coalesce(${assessmentEvidence.isActive}, true)`)) : [];

  const planned = new Set<string>();
  for (const p of plans) {
    if (p.out.problems.length || !p.target) continue;
    const same = held.filter((h) => h.hash === p.out.fingerprint);
    if (same.some((h) => h.candidateId !== p.candidateId)) { p.out.problems.push("This file is already held for another person."); continue; }
    const key = `${p.target.id}:${p.out.fingerprint}`;
    if (same.some((h) => h.assessmentId === p.target!.id) || planned.has(key)) { p.out.action = "already there"; continue; }
    // the same file for the same person on a second standard is attached to the first copy, not stored again
    const elsewhere = same.length > 0 || Array.from(planned).some((k) => k.endsWith(`:${p.out.fingerprint}`));
    p.out.action = elsewhere ? "attach" : "load";
    planned.add(key);
  }

  // 4. store, one row at a time, so that one failure does not lose the rest
  let loaded = 0;
  if (!opts.dryRun) {
    const stored = new Map<string, { id: string; url: string }>();
    for (const h of held) if (h.hash && h.url && !stored.has(h.hash)) stored.set(h.hash, { id: h.linkedFromId ?? h.id, url: h.url });
    for (const p of plans) {
      if (p.out.action !== "load" && p.out.action !== "attach") continue;
      try {
        const original = stored.get(p.out.fingerprint);
        if (p.out.action === "attach" && !original) throw new Error("the first copy of this file was not stored");
        const name = p.m.file.split("/").pop()!;
        let url = original?.url;
        if (!url) { url = buildObjectKey("evidence", name); await uploadObject(url, p.bytes!); }
        const about = [p.m.description, "Moved from the previous system.", p.m.originalDate && `Original date: ${p.m.originalDate}.`, p.m.sourceRef && `Source reference: ${p.m.sourceRef}.`].filter(Boolean).join(" ");
        const [row] = await db.insert(assessmentEvidence).values({
          assessmentId: p.target!.id, fileName: name, fileUrl: url, fileSize: p.out.size, mimeType: p.mime!, uploadedBy: opts.actorId,
          title: (p.m.title || name).slice(0, EVIDENCE_TITLE_MAX), evidenceType: evidenceTypeFrom(p.m.evidenceType), description: about.slice(0, EVIDENCE_DESCRIPTION_MAX), contentHash: p.out.fingerprint,
          ...(p.out.action === "attach" ? { linkedFromId: original!.id, linkedBy: opts.actorId, linkedAt: new Date() } : {}),
        }).returning({ id: assessmentEvidence.id });
        if (!original) stored.set(p.out.fingerprint, { id: row.id, url });
        loaded++;
      } catch (e: any) {
        console.error(`Evidence batch row ${p.m.row}:`, e?.message ?? e);
        p.out.action = "not loaded";
        p.out.problems.push("It could not be saved. Try the batch again: rows already loaded are skipped.");
      }
    }
  }

  for (const p of plans) if (p.out.problems.length) p.out.action = "not loaded";
  const listed = new Set(batch.rows.map((r) => r.file.toLowerCase()));
  return {
    dryRun: opts.dryRun, rows: plans.length, toLoad: plans.filter((p) => p.out.action === "load" || p.out.action === "attach").length, loaded,
    alreadyThere: plans.filter((p) => p.out.action === "already there").length, withProblems: plans.filter((p) => p.out.problems.length).length,
    unlistedFiles: batch.files.filter((f) => !listed.has(f.toLowerCase())), detail: plans.map((p) => p.out),
  };
}
