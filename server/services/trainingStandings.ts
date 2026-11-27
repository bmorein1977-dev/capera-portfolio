// Where people stand against the training their job roles require. Where any one of several courses meets a requirement, the best counts.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { roleTrainings, trainingEnrollments, trainings, users } from "@shared/schema";
import { statusFromExpiry, trainingExpiry, type CompetenceStatus } from "@shared/competence";

export interface TrainingStanding { userId: string; requirement: string; label: string; safetyCritical: boolean; status: CompetenceStatus; achievedOn: Date | null; expiry: Date | null }
const RANK: Record<CompetenceStatus, number> = { current: 0, expiring_90: 1, expiring_60: 2, expiring_30: 3, expired: 4, missing: 5 };
const chunks = <T,>(list: T[], size = 500): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

export async function trainingStandings(userIds: string[], now = new Date()): Promise<TrainingStanding[]> {
  const out: TrainingStanding[] = [];
  for (const part of chunks(userIds)) {
    if (!part.length) continue;
    const needed = await db.select({ userId: users.id, rt: roleTrainings, t: trainings }).from(users)
      .innerJoin(roleTrainings, sql`${roleTrainings.roleId} in (${users.jobRoleId}, ${users.secondaryJobRoleId})`)
      .innerJoin(trainings, eq(roleTrainings.trainingId, trainings.id))
      .where(and(inArray(users.id, part), sql`coalesce(${roleTrainings.isActive}, true)`, sql`coalesce(${roleTrainings.required}, true)`));
    const held = await db.select().from(trainingEnrollments).where(and(inArray(trainingEnrollments.userId, part), eq(trainingEnrollments.isActive, true)));
    const byPair = new Map<string, typeof held>();
    for (const e of held) if (e.achievementDate) byPair.set(`${e.userId}:${e.trainingId}`, [...(byPair.get(`${e.userId}:${e.trainingId}`) ?? []), e]);
    const groups = new Map<string, typeof needed>();
    for (const n of needed) { const k = `${n.userId}:${n.rt.groupId ?? n.rt.trainingId}`; groups.set(k, [...(groups.get(k) ?? []), n]); }
    for (const [key, members] of Array.from(groups.entries())) {
      const results = members.map((m) => {
        const latest = (byPair.get(`${m.userId}:${m.rt.trainingId}`) ?? []).sort((a, b) => b.achievementDate!.getTime() - a.achievementDate!.getTime())[0];
        const expiry = latest ? trainingExpiry(latest, m.t) : null;
        const status: CompetenceStatus = latest ? statusFromExpiry(expiry, now) : "missing";
        return { m, status, expiry, achievedOn: latest?.achievementDate ?? null };
      });
      const best = results.reduce((a, b) => (RANK[a.status] <= RANK[b.status] ? a : b));
      const names = Array.from(new Set(members.map((m) => m.t.name)));
      out.push({ userId: members[0].userId, requirement: key.split(":")[1], label: names.length > 1 ? `Any one of: ${names.join(", ")}` : names[0], safetyCritical: members.some((m) => !!m.t.isSafetyCritical), status: best.status, achievedOn: best.achievedOn, expiry: best.expiry });
    }
  }
  return out;
}
