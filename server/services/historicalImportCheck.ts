// A trial run of the historical records import: what each row would do, and which rows would fail, without changing anything.
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { assessments, trainingEnrollments } from "@shared/schema";
import type { IStorage } from "../storage";

export interface ImportRow {
  userName?: string; email?: string; jobRoleName?: string; competenceCategoryName?: string; competenceElementName?: string; assessmentOutcome?: string;
  assessorName?: string; assessmentDate?: Date; expiryDate?: Date; trainingName?: string; trainingCompletionDate?: Date; trainingExpiryDate?: Date;
}
export interface CheckedRow { row: number; person: string; actions: string[]; problems: string[]; warnings: string[] }
export interface ImportCheck {
  rows: number; rowsWithProblems: number; rowsWithWarnings: number;
  totals: { peopleToCreate: number; peopleToUpdate: number; competenceToCreate: number; competenceToReplace: number; competenceProtected: number; trainingToCreate: number; trainingToReplace: number; rowsWithoutEmail: number };
  detail: CheckedRow[];
}
export const OUTCOMES = ["competent", "not_yet_competent", "competent_with_minor_needs"];
export const syntheticEmail = (name: string) => { const [first, ...rest] = name.trim().split(" "); return `${first.toLowerCase()}.${rest.join("").toLowerCase().replace(/\s+/g, "")}@imported.local`; };
const valid = (d: Date | undefined) => !!d && !Number.isNaN(d.getTime());

/** the one thing an import must never do: replace a decision that was made and signed off in Capera */
export const PROTECTED_MESSAGE = "This person already has a decision signed off in Capera for this standard. An import does not replace it.";
export const isProtected = (a: { signOffAt: Date | null } | undefined) => !!a?.signOffAt;

export async function checkHistoricalImport(rows: ImportRow[], storage: IStorage): Promise<ImportCheck> {
  const totals = { peopleToCreate: 0, peopleToUpdate: 0, competenceToCreate: 0, competenceToReplace: 0, competenceProtected: 0, trainingToCreate: 0, trainingToReplace: 0, rowsWithoutEmail: 0 };
  const newPeople = new Set<string>(), updated = new Set<string>(), pairs = new Set<string>(), trainingPairs = new Set<string>();
  const detail: CheckedRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], out: CheckedRow = { row: i + 2, person: (r.userName ?? "").trim(), actions: [], problems: [], warnings: [] };
    detail.push(out);
    if (!out.person || out.person.split(" ").length < 2) { out.problems.push(`Invalid user name "${out.person}". Expected "FirstName LastName".`); continue; }
    const email = r.email?.trim() || syntheticEmail(out.person);
    if (!r.email?.trim()) { totals.rowsWithoutEmail++; out.warnings.push("No email address: a placeholder would be used, and this person could not sign in with it."); }
    if (r.jobRoleName && !(await storage.getJobRoleByName(r.jobRoleName))) out.problems.push(`Job role not found: "${r.jobRoleName}".`);
    const user = await storage.getUserByEmail(email);
    const key = email.toLowerCase();
    if (!user && !newPeople.has(key)) { newPeople.add(key); totals.peopleToCreate++; out.actions.push("Create the person"); }
    else if (user && !updated.has(key)) { updated.add(key); totals.peopleToUpdate++; out.actions.push("Use the existing person"); }

    if (r.competenceCategoryName || r.competenceElementName) {
      const category = r.competenceCategoryName ? await storage.getCompetencyCategoryByName(r.competenceCategoryName) : undefined;
      const element = category && r.competenceElementName ? await storage.getCompetencyElementByName(category.id, r.competenceElementName) : undefined;
      if (!category) out.problems.push(`Competence category not found: "${r.competenceCategoryName ?? ""}".`);
      else if (!element) out.problems.push(`Competence element not found: "${r.competenceElementName ?? ""}".`);
      if (!r.assessorName || r.assessorName.trim().split(" ").length < 2) out.problems.push("An assessor's first and last name is needed.");
      if (r.assessmentOutcome && !OUTCOMES.includes(r.assessmentOutcome.trim().toLowerCase().replace(/\s+/g, "_"))) out.problems.push(`Invalid outcome: "${r.assessmentOutcome}".`);
      if (!valid(r.assessmentDate)) out.problems.push("A valid assessment date is needed.");
      else if (r.assessmentDate!.getTime() > Date.now()) out.problems.push("The assessment date is in the future.");
      if (valid(r.assessmentDate) && valid(r.expiryDate) && r.expiryDate! < r.assessmentDate!) out.problems.push("The expiry date is before the assessment date.");
      if (element) {
        const pair = `${key}:${element.id}`;
        if (pairs.has(pair)) out.warnings.push("This file has more than one row for the same person and standard: the later row replaces the earlier one.");
        pairs.add(pair);
        const existing = user ? (await db.select().from(assessments).where(and(eq(assessments.candidateId, user.id), eq(assessments.elementId, element.id), eq(assessments.isActive, true)))) : [];
        if (existing.some(isProtected)) { totals.competenceProtected++; out.problems.push(PROTECTED_MESSAGE); }
        else if (existing.length) { totals.competenceToReplace++; out.actions.push("Replace the existing competence record"); if (!existing[0].isAssignment) out.warnings.push("A result already held for this standard would be replaced."); }
        else { totals.competenceToCreate++; out.actions.push("Add the competence record"); }
      }
    }
    if (r.trainingName) {
      const training = await storage.getTrainingByName(r.trainingName);
      if (!training) out.problems.push(`Training course not found: "${r.trainingName}".`);
      if (!valid(r.trainingCompletionDate)) out.problems.push("A valid training completion date is needed.");
      if (training) {
        const pair = `${key}:${training.id}`;
        const existing = user ? (await db.select().from(trainingEnrollments).where(and(eq(trainingEnrollments.userId, user.id), eq(trainingEnrollments.trainingId, training.id), eq(trainingEnrollments.isActive, true))))[0] : undefined;
        if (existing || trainingPairs.has(pair)) { totals.trainingToReplace++; out.actions.push("Replace the training record"); } else { totals.trainingToCreate++; out.actions.push("Add the training record"); }
        trainingPairs.add(pair);
      }
    }
  }
  return { rows: rows.length, rowsWithProblems: detail.filter((d) => d.problems.length).length, rowsWithWarnings: detail.filter((d) => d.warnings.length).length, totals, detail };
}
