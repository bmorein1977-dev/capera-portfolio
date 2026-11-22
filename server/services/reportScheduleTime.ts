// When a scheduled report is next due. Kept apart from everything that needs a database so it can be tested on its own.
export type Frequency = "weekly" | "monthly";
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface When { frequency: Frequency; weekday: number; dayOfMonth: number; hour: number; timezone: string }

// ------------------------------------------------------------------------------------------------------------ when is the next one?
export function validTimezone(tz: unknown): string {
  if (typeof tz !== "string" || !tz || tz.length > 60) return "Europe/London";
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); return tz; } catch { return "Europe/London"; }
}

// the local calendar date and time in a zone for an instant
function localParts(at: number, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(at))) if (x.type !== "literal") p[x.type] = Number(x.value);
  return p;
}
// how far the zone is ahead of UTC at an instant (milliseconds)
const offsetAt = (at: number, tz: string) => { const p = localParts(at, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at / 1000) * 1000; };
// the instant at which the wall clock in a zone reads this date and hour (looked up twice so a daylight-saving change on the day is handled)
function zonedInstant(y: number, m: number, d: number, hour: number, tz: string): number {
  const wall = Date.UTC(y, m - 1, d, hour, 0, 0);
  const first = wall - offsetAt(wall, tz);
  return wall - offsetAt(first, tz);
}

/** The first run time strictly after `from`. */
export function nextRunAfter(w: When, from: Date): Date {
  const tz = validTimezone(w.timezone);
  const today = localParts(from.getTime(), tz);
  for (let i = 0; i <= 400; i++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
    const hit = w.frequency === "weekly" ? day.getUTCDay() === w.weekday : d === w.dayOfMonth;
    if (!hit) continue;
    const at = zonedInstant(y, m, d, w.hour, tz);
    if (at > from.getTime()) return new Date(at);
  }
  return new Date(from.getTime() + 7 * 86400000);
}

export const describeWhen = (w: When) =>
  `${w.frequency === "weekly" ? `Every ${WEEKDAYS[w.weekday] ?? "Monday"}` : `On day ${w.dayOfMonth} of every month`} at ${String(w.hour).padStart(2, "0")}:00 (${w.timezone.replace(/_/g, " ")})`;

