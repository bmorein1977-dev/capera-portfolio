// How a scheduled report reads the data as the person it is for. There is nobody at a screen when it runs, so there is no sign-in cookie to pass along.
// Instead the server makes a short-lived pass for that one person: a signed note saying "this call is for user X, until time T".
// The pass is only honoured when ALL of these are true, so it is of no use to anyone who gets hold of one:
//   - the call comes from the server itself (the loopback address, with no forwarding headers, so it did not come through the proxy from outside);
//   - it is a read (GET), so it can never change anything;
//   - the signature is right (made with a key only the server has) and it has not run out (two minutes).
// The person is still checked as usual afterwards (a closed account is refused), and every permission and "only your own people" rule applies to them exactly as at a screen.
import { createHmac, timingSafeEqual } from "crypto";

export const RUNNER_HEADER = "x-capera-report-pass";
const LIFETIME_MS = 2 * 60 * 1000;

// the key is made from the session secret, so a pass cannot be made without it, and a pass is not a usable session secret itself
function key(): string {
  const secret = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "local-dev-only-secret");
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return "capera-report-pass:" + secret;
}
const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

export function makeRunnerPass(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: now + LIFETIME_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** The person a request carries a valid pass for, or null. Never throws. */
export function runnerUserId(req: { headers: Record<string, any>; method?: string; socket?: { remoteAddress?: string } }, now = Date.now()): string | null {
  try {
    const raw = req.headers?.[RUNNER_HEADER];
    if (typeof raw !== "string" || raw.length > 600) return null;
    if (req.method !== "GET") return null;
    if (!LOOPBACK.has(req.socket?.remoteAddress ?? "")) return null;
    if (req.headers["x-forwarded-for"] || req.headers["forwarded"] || req.headers["x-real-ip"]) return null;
    const [payload, sig, extra] = raw.split(".");
    if (!payload || !sig || extra !== undefined) return null;
    const want = Buffer.from(sign(payload)), got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof body?.u !== "string" || !body.u || typeof body.e !== "number" || body.e < now || body.e > now + LIFETIME_MS + 5000) return null;
    return body.u;
  } catch { return null; }
}
