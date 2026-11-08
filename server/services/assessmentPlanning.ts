import { db } from "../db";
import { sql } from "drizzle-orm";
import type { DbStorage } from "../storage";
import { sendNotification } from "./notifications";

// Setting the date of an assessment from the plan on the home screen. If the assessment is already open (assigned, or ready) its date is set;
// if the competence is simply coming up for reassessment and nothing is open yet, an open assessment is created for it first, then dated.
// Either way the candidate is emailed the date, exactly as when an assessor schedules from the assessor dashboard.

export class PlanningError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const bad = (m: string) => new PlanningError(400, m);

export interface PlanInput { candidateId?: unknown; elementId?: unknown; plannedAt?: unknown; location?: unknown; notes?: unknown }

export async function planAssessment(storage: DbStorage, actor: { id: string; isAdmin: boolean }, input: PlanInput) {
  const candidateId = String(input.candidateId ?? ""), elementId = String(input.elementId ?? "");
  if (!candidateId || !elementId) throw bad("Choose the person and the competence");
  const when = new Date(String(input.plannedAt ?? ""));
  if (isNaN(when.getTime())) throw bad("Choose a date and time");
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  if (when < startOfToday) throw bad("The date cannot be in the past");
  if (when.getTime() > Date.now() + 5 * 365 * 86_400_000) throw bad("That date is too far ahead");
  const location = String(input.location ?? "").trim().slice(0, 200) || null;
  const notes = String(input.notes ?? "").trim().slice(0, 1000) || null;

  const candidate = await storage.getUser(candidateId);
  const element = await storage.getCompetencyElement(elementId);
  if (!candidate || !element) throw new PlanningError(404, "That person or competence was not found");
  if (candidate.isActive === false || (candidate.isArchived && (!candidate.leftAt || new Date(candidate.leftAt) <= new Date()))) throw bad("That person is no longer here");

  // an assessor can only plan for candidates allocated to them; an administrator can plan for anyone
  if (!actor.isAdmin) {
    const allocated = (await db.execute(sql`select 1 from candidate_allocations where assessor_id = ${actor.id} and candidate_id = ${candidateId} and is_active limit 1`)).rows.length > 0;
    if (!allocated) throw new PlanningError(403, "That candidate is not allocated to you");
  }

  const open = (await db.execute(sql`select id, assessor_id from assessments where candidate_id = ${candidateId} and element_id = ${elementId} and is_active and sign_off_at is null order by created_at desc limit 1`)).rows[0] as { id: string; assessor_id: string } | undefined;
  if (open && open.assessor_id !== actor.id && !actor.isAdmin) throw new PlanningError(403, "That assessment belongs to another assessor");

  let assessmentId: string, created = false;
  if (open) assessmentId = open.id;
  else {
    const made = await storage.createAssessment({
      candidateId, elementId, assessorId: actor.id, outcome: "not_yet_competent", assessmentMethods: [], assessorComments: "Reassessment planned",
      isAssignment: true, origin: "reassessment_plan", verificationStatus: "not_verified",
    } as any);
    assessmentId = made.id; created = true;
  }
  await storage.updateAssessment(assessmentId, { plannedAssessmentDate: when, plannedAssessmentLocation: location, plannedAssessmentNotes: notes } as any);

  await sendNotification("assessment_scheduled", {
    userIds: [candidateId], aboutUserId: candidateId, path: "/my-assessments",
    vars: { element: element.name, dateTime: when.toLocaleString("en-GB"), locationText: location ? `Location: ${location}` : "", notesText: notes ? `Notes from your assessor: ${notes}` : "" },
  });
  return { assessmentId, created, plannedAt: when.toISOString() };
}
