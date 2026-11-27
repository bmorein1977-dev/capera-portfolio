// One-off correction: saves the expiry date on competent decisions that were recorded without one.
//
// The application already works these dates out when it shows them, so running this changes nothing anyone sees. It makes the saved record
// carry the date, so that a later change to a standard's validity period does not move it.
//
//   npx tsx scripts/data/backfillAssessmentExpiry.ts                      review only: counts, and a list to check
//   npx tsx scripts/data/backfillAssessmentExpiry.ts --list review.csv    the same, and writes every proposed date to a file
//   npx tsx scripts/data/backfillAssessmentExpiry.ts --apply              saves the dates (take a database backup first)
//
// It only ever fills an empty date on a competent decision. It never changes a date that is already there.
import fs from "fs";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, pool } from "../../server/db";
import { assessments, competencyElements, users } from "../../shared/schema";
import { requirementsFor, pairKey } from "../../server/services/competenceRecords";
import { COMPETENT_OUTCOMES, effectiveExpiry } from "../../shared/competence";
import { recordSystemEvent } from "../../server/services/auditLog";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const listAt = args.indexOf("--list");
  const listFile = listAt >= 0 ? args[listAt + 1] : null;
  const dbName = (await db.execute(sql`select current_database() as d`)).rows[0]?.d;

  const rows = (await db.select().from(assessments).where(and(
    eq(assessments.isActive, true), isNull(assessments.expiryDate), inArray(assessments.outcome, [...COMPETENT_OUTCOMES]),
  ))).filter((a) => !a.isAssignment);
  const candidateIds = Array.from(new Set(rows.map((r) => r.candidateId)));
  const required = await requirementsFor(candidateIds);
  const elements = new Map((await db.select().from(competencyElements)).map((e) => [e.id, e]));
  const people = new Map(candidateIds.length ? (await db.select().from(users).where(inArray(users.id, candidateIds))).map((u) => [u.id, `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()]) : []);

  const proposed = rows.map((a) => ({ a, expiry: effectiveExpiry(a, elements.get(a.elementId), required.get(pairKey(a.candidateId, a.elementId))) }));
  const dated = proposed.filter((p) => p.expiry);
  const lapsed = dated.filter((p) => p.expiry!.getTime() <= Date.now()).length;

  console.log(`Database: ${dbName}`);
  console.log(`Competent decisions with no saved expiry date: ${rows.length}`);
  console.log(`  a date can be saved for: ${dated.length} (${lapsed} of those have already passed)`);
  console.log(`  left empty because the standard is set not to lapse, or there is no decision date: ${rows.length - dated.length}`);

  if (listFile) {
    const cell = (v: unknown) => { const s = String(v ?? ""); return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`; };
    const lines = [["Assessment id", "Person", "Standard", "Outcome", "Decided on", "Proposed expiry", "Already passed"].map(cell).join(",")];
    for (const p of proposed) {
      const el = elements.get(p.a.elementId);
      const decided = p.a.signOffAt ?? p.a.assessmentDate ?? p.a.createdAt;
      lines.push([p.a.id, people.get(p.a.candidateId), `${el?.code ?? ""} ${el?.name ?? ""}`.trim(), p.a.outcome, decided?.toISOString().slice(0, 10), p.expiry?.toISOString().slice(0, 10) ?? "does not lapse", p.expiry && p.expiry.getTime() <= Date.now() ? "yes" : ""].map(cell).join(","));
    }
    fs.writeFileSync(listFile, "﻿" + lines.join("\r\n"));
    console.log(`Review list written to ${listFile}`);
  }

  if (!apply) { console.log("Nothing has been changed. Run again with --apply to save the dates."); return; }
  let saved = 0;
  await db.transaction(async (tx) => {
    for (const p of dated) {
      const r = await tx.update(assessments).set({ expiryDate: p.expiry }).where(and(eq(assessments.id, p.a.id), isNull(assessments.expiryDate))).returning({ id: assessments.id });
      saved += r.length;
    }
  });
  await recordSystemEvent({ actorId: null as any, action: "Saved missing expiry dates", entityType: "Assessments", entityId: "backfill", entityLabel: `${saved} records`, summary: "One-off correction: expiry dates worked out from the decision date and validity period were saved on records that had none" }).catch(() => {});
  console.log(`Saved ${saved} expiry dates.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
