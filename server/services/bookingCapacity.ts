// A course session has a fixed number of seats. Seats are taken by confirmed (and completed) bookings. The check and the change happen
// together under a lock on the session, so two people cannot take the last seat at the same moment (ASVS 2.3.2, 2.3.4).
import { db } from "../db";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { courseBookings, courseTrainingSessions } from "@shared/schema";

const TAKES_A_SEAT = ["confirmed", "completed"];

export class SessionFullError extends Error {
  constructor() { super("This session is full"); }
}

async function seatsTaken(tx: any, sessionId: string, exceptBookingId?: string): Promise<number> {
  const conds = [eq(courseBookings.sessionId, sessionId), inArray(courseBookings.status, TAKES_A_SEAT)];
  if (exceptBookingId) conds.push(ne(courseBookings.id, exceptBookingId));
  const rows = await tx.select({ n: sql<number>`count(*)::int` }).from(courseBookings).where(and(...conds));
  return rows[0]?.n ?? 0;
}

async function lockSession(tx: any, sessionId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"course-session:" + sessionId}))`);
}

/** Throws SessionFullError when the session already has every seat taken. For a request that has not been confirmed yet. */
export async function assertSeatAvailable(sessionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockSession(tx, sessionId);
    const s = (await tx.select({ capacity: courseTrainingSessions.capacity }).from(courseTrainingSessions).where(eq(courseTrainingSessions.id, sessionId)))[0];
    if (s && (await seatsTaken(tx, sessionId)) >= s.capacity) throw new SessionFullError();
  });
}

/** Applies a booking update. When it confirms (or completes) the booking, the seat is checked and taken under the lock. */
export async function updateBookingWithCapacity(bookingId: string, sessionId: string, updates: Record<string, any>) {
  return db.transaction(async (tx) => {
    const takesSeat = TAKES_A_SEAT.includes(updates.status);
    if (takesSeat) {
      await lockSession(tx, sessionId);
      const s = (await tx.select({ capacity: courseTrainingSessions.capacity }).from(courseTrainingSessions).where(eq(courseTrainingSessions.id, sessionId)))[0];
      const current = (await tx.select({ status: courseBookings.status }).from(courseBookings).where(eq(courseBookings.id, bookingId)))[0];
      const alreadyHolds = current && TAKES_A_SEAT.includes(current.status);
      if (s && !alreadyHolds && (await seatsTaken(tx, sessionId, bookingId)) >= s.capacity) throw new SessionFullError();
    }
    const rows = await tx.update(courseBookings).set(updates).where(eq(courseBookings.id, bookingId)).returning();
    return rows[0];
  });
}
