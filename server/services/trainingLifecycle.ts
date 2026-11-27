// What the training policy requires before a course can be booked, and what happens when a person attends it.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  bookingApprovals, courseBookings, courseTrainingSessions, externalTrainingCourses, trainingCompletionAudit, trainingEnrollments,
  trainingPolicyMatrix, trainings, users,
} from "@shared/schema";
import { addMonths } from "@shared/competence";

export type ApproverRole = "manager" | "training_approver" | "training_administrator" | "admin";
export interface ApprovalStep { level: number; role: ApproverRole }
export interface BookingRule { notApplicable: boolean; steps: ApprovalStep[]; reasons: string[]; costCap: number | null; courseCost: number | null }

const KNOWN: ApproverRole[] = ["manager", "training_approver", "training_administrator", "admin"];
const roleName = (v: unknown): ApproverRole => {
  const r = String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_").replace("line_manager", "manager").replace("super_admin", "admin").replace("administrator", "admin").replace("training_admin", "training_administrator");
  return (KNOWN as string[]).includes(r) ? (r as ApproverRole) : "training_approver";
};
/** the first number in a text price such as "500.00 USD" or "£1,200" */
export const money = (v: unknown): number | null => {
  const m = String(v ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** The rule that applies to one person booking one course: the strictest of what their primary and secondary job roles say. */
export function ruleFrom(policies: Array<{ policyStatus: string; requiresApproval: boolean | null; costCap: string | null; approverChain: unknown }>, courseCost: number | null): BookingRule {
  const reasons: string[] = [];
  if (!policies.length) return { notApplicable: false, steps: [], reasons, costCap: null, courseCost };
  const applicable = policies.filter((p) => p.policyStatus !== "NA");
  if (!applicable.length) return { notApplicable: true, steps: [], reasons: ["The training policy says this course does not apply to your job role"], costCap: null, courseCost };
  const caps = applicable.map((p) => money(p.costCap)).filter((n): n is number => n !== null);
  const costCap = caps.length ? Math.min(...caps) : null;
  const chain: ApprovalStep[] = [];
  for (const p of applicable) {
    const list = Array.isArray(p.approverChain) ? (p.approverChain as Array<{ role?: unknown; level?: unknown }>) : [];
    if (p.requiresApproval) {
      reasons.push("The training policy requires approval for this course");
      list.forEach((s, i) => chain.push({ level: Number(s.level) || i + 1, role: roleName(s.role) }));
      if (!list.length) chain.push({ level: 1, role: "manager" });
    }
  }
  if (costCap !== null && courseCost !== null && courseCost > costCap) {
    reasons.push(`The course costs more than the limit of ${costCap} for your job role`);
    chain.push({ level: 90, role: "training_approver" });
  }
  // one step for each level and role, in order
  const steps = Array.from(new Map(chain.sort((a, b) => a.level - b.level).map((s) => [`${s.level}:${s.role}`, s])).values()).map((s, i) => ({ ...s, level: i + 1 }));
  return { notApplicable: false, steps, reasons: Array.from(new Set(reasons)), costCap, courseCost };
}

export async function bookingRule(userId: string, sessionId: string): Promise<BookingRule> {
  const row = (await db.select({ course: externalTrainingCourses }).from(courseTrainingSessions)
    .innerJoin(externalTrainingCourses, eq(courseTrainingSessions.courseId, externalTrainingCourses.id)).where(eq(courseTrainingSessions.id, sessionId)))[0];
  const person = (await db.select().from(users).where(eq(users.id, userId)))[0];
  const roleIds = [person?.jobRoleId, person?.secondaryJobRoleId].filter((v): v is string => !!v);
  if (!row || !roleIds.length) return ruleFrom([], money(row?.course.cost));
  const policies = await db.select().from(trainingPolicyMatrix).where(and(eq(trainingPolicyMatrix.courseId, row.course.id), inArray(trainingPolicyMatrix.jobRoleId, roleIds), eq(trainingPolicyMatrix.isActive, true)));
  return ruleFrom(policies, money(row.course.cost));
}

/** records the approval steps a booking needs; steps already given (an approved training request) are marked as approved */
export async function openApprovals(bookingId: string, steps: ApprovalStep[], already?: { by: string; at: Date; comment: string } | null): Promise<void> {
  for (const s of steps) {
    const done = !!already && s.level === 1;
    await db.insert(bookingApprovals).values({ bookingId, step: s.level, approverRole: s.role, state: done ? "approved" : "pending", approverId: done ? already!.by : null, decidedAt: done ? already!.at : null, comment: done ? already!.comment : null });
  }
}

export const approvalsFor = (bookingId: string) => db.select().from(bookingApprovals).where(eq(bookingApprovals.bookingId, bookingId)).orderBy(asc(bookingApprovals.step));

/** why a booking cannot be confirmed or completed yet, or null when nothing stands in the way */
export async function approvalBlock(bookingId: string): Promise<string | null> {
  const steps = await approvalsFor(bookingId);
  if (steps.some((s) => s.state === "rejected")) return "An approver has refused this booking";
  const waiting = steps.find((s) => s.state === "pending");
  return waiting ? `Waiting for approval, step ${waiting.step} of ${steps.length} (${waiting.approverRole.replace(/_/g, " ")})` : null;
}

export async function mayDecideStep(step: { approverRole: string }, approver: { id: string; roles: string[] }, bookerId: string): Promise<boolean> {
  if (approver.id === bookerId) return false; // nobody approves their own booking
  if (approver.roles.includes("super_admin") || approver.roles.includes("developer")) return true;
  if (step.approverRole === "manager") {
    const booker = (await db.select({ managerId: users.managerId }).from(users).where(eq(users.id, bookerId)))[0];
    return booker?.managerId === approver.id;
  }
  if (step.approverRole === "admin") return approver.roles.includes("admin");
  return approver.roles.includes(step.approverRole);
}

/**
 * A person attended and completed a booked course. Their training record gets the date achieved and, where the course has a validity
 * period, the date it runs out. A later completion is a new record, so the earlier one stays as history.
 */
export async function recordAttendance(bookingId: string, completedAt: Date): Promise<{ enrollmentId: string; expiryDate: Date | null } | null> {
  const row = (await db.select({ booking: courseBookings, session: courseTrainingSessions, course: externalTrainingCourses }).from(courseBookings)
    .innerJoin(courseTrainingSessions, eq(courseBookings.sessionId, courseTrainingSessions.id))
    .innerJoin(externalTrainingCourses, eq(courseTrainingSessions.courseId, externalTrainingCourses.id))
    .where(eq(courseBookings.id, bookingId)))[0];
  if (!row?.course.trainingId) return null; // the course is not linked to a training record, so there is nothing to update
  const training = (await db.select().from(trainings).where(eq(trainings.id, row.course.trainingId)))[0];
  if (!training) return null;
  const expiryDate = training.validityPeriod ? addMonths(completedAt, training.validityPeriod) : null;
  const mine = await db.select().from(trainingEnrollments).where(and(
    eq(trainingEnrollments.userId, row.booking.userId), eq(trainingEnrollments.trainingId, training.id), eq(trainingEnrollments.isActive, true),
  )).orderBy(desc(trainingEnrollments.createdAt));
  const sameDay = (d: Date | null) => !!d && d.toISOString().slice(0, 10) === completedAt.toISOString().slice(0, 10);
  // an unfinished record is completed; a record already completed on this day is the same event; anything else is a new cycle
  const target = mine.find((e) => e.status !== "completed") ?? mine.find((e) => sameDay(e.achievementDate));
  const values = { status: "completed", achievementDate: completedAt, expiryDate, updatedAt: new Date() };
  const enrollmentId = target
    ? (await db.update(trainingEnrollments).set(values).where(eq(trainingEnrollments.id, target.id)).returning())[0].id
    : (await db.insert(trainingEnrollments).values({ ...values, userId: row.booking.userId, trainingId: training.id, allocatedBy: row.booking.requestedBy ?? row.booking.userId, allocatedDate: new Date() }).returning())[0].id;
  const logged = await db.select({ id: trainingCompletionAudit.id }).from(trainingCompletionAudit).where(and(eq(trainingCompletionAudit.enrollmentId, enrollmentId), eq(trainingCompletionAudit.completedAt, completedAt)));
  if (!logged.length) await db.insert(trainingCompletionAudit).values({ userId: row.booking.userId, trainingId: training.id, enrollmentId, method: "course_attendance", completedAt } as any);
  return { enrollmentId, expiryDate };
}
