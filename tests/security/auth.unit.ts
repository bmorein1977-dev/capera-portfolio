import express from "express";
import http from "http";
import { db } from "../../server/db";
import { sql } from "drizzle-orm";
import { requireSignedInForApi, makeUpsertUser, SignInRefused, newIdentityDecision, accountState, forgetAccountState } from "../../server/replitAuth";
import { makeRunnerPass, RUNNER_HEADER } from "../../server/services/reportRunnerAuth";
let pass = 0, fail = 0;
const ok = (c: boolean, m: string, x?: unknown) => { if (c) { pass++; console.log("  PASS", m); } else { fail++; console.log("  FAIL", m, x ?? ""); } };

type Scn = { auth?: boolean; user?: any; session?: any };
function appFor(s: Scn) {
  const app = express();
  app.use((req: any, _res, next) => {
    req.isAuthenticated = () => !!s.auth;
    req.user = s.user;
    req.session = { ...(s.session ?? {}), destroy: (cb: any) => cb() };
    next();
  });
  app.use("/api", requireSignedInForApi);
  app.get("/api/login", (_q, r) => r.json({ public: true }));
  app.get("/api/health", (_q, r) => r.json({ ok: true }));
  app.get("/api/users", (q: any, r) => r.json({ secret: true, who: q.user?.claims?.sub }));
  app.post("/api/users", (_q, r) => r.json({ changed: true }));
  return app;
}
async function hit(s: Scn, path: string, init: { headers?: Record<string, string>; method?: string } = {}) {
  const server = http.createServer(appFor(s)); await new Promise<void>(r => server.listen(0, r));
  const port = (server.address() as any).port;
  try { const r = await fetch(`http://127.0.0.1:${port}${path}`, init); return { s: r.status, j: await r.json().catch(() => ({})) }; } finally { server.close(); }
}
const now = Date.now(), nowS = Math.floor(now / 1000);
const good = { claims: { sub: "demo-dan" }, expires_at: nowS + 3000, authenticated_at: now - 60_000, refresh_token: "r" };

(async () => {
  console.log("The sign-in gate on /api");
  ok((await hit({ auth: false }, "/api/users")).s === 401, "no sign-in: refused");
  ok((await hit({ auth: false }, "/api/login")).s === 200 && (await hit({ auth: false }, "/api/health")).s === 200, "sign-in and health routes stay open");
  ok((await hit({ auth: true, user: good }, "/api/users")).s === 200, "a signed-in person gets through");
  const old = await hit({ auth: true, user: { ...good, authenticated_at: now - 13 * 3600_000 } }, "/api/users");
  ok(old.s === 401 && old.j.code === "SESSION_EXPIRED", "a sign-in older than 12 hours must be repeated, and says why", old);
  const { authenticated_at, ...legacy } = good;
  ok((await hit({ auth: true, user: legacy }, "/api/users")).s === 401, "a session from before this check (no start time) signs in again once");
  ok((await hit({ auth: true, user: good, session: { lastSeen: now - 61 * 60_000 } }, "/api/users")).s === 401, "idle for over an hour: refused");
  ok((await hit({ auth: true, user: good, session: { lastSeen: now - 10 * 60_000 } }, "/api/users")).s === 200, "active 10 minutes ago: fine");
  ok((await hit({ auth: true, user: { ...good, expires_at: nowS - 10, refresh_token: undefined } }, "/api/users")).s === 401, "expired token with nothing to refresh it: refused");
  ok((await hit({ auth: true, user: { ...good, expires_at: undefined } }, "/api/users")).s === 401, "no expiry on the token: refused");
  // a scheduled report reads data as its owner with a short-lived pass made by the server (see services/reportRunnerAuth.ts)
  const passFor = (id: string) => ({ headers: { [RUNNER_HEADER]: makeRunnerPass(id) } });
  const withPass = await hit({ auth: false }, "/api/users", passFor("demo-dan"));
  ok(withPass.s === 200 && withPass.j.who === "demo-dan", "a valid pass, from the server itself, is signed in as the person it names", withPass);
  ok((await hit({ auth: false }, "/api/users", { headers: { [RUNNER_HEADER]: makeRunnerPass("demo-dan").slice(0, -3) + "abc" } })).s === 401, "a damaged pass is refused");
  ok((await hit({ auth: false }, "/api/users", { headers: { ...passFor("demo-dan").headers, "x-forwarded-for": "203.0.113.9" } })).s === 401, "a pass that arrived through the proxy is refused");
  ok((await hit({ auth: false }, "/api/users", { ...passFor("demo-dan"), method: "POST" })).s === 401, "a pass cannot be used to change anything");
  // a closed account (a leaver) cannot use the role-only routes any more
  await db.execute(sql`insert into users (id, email, first_name, last_name, role, is_archived, left_at) values ('sec-test-leaver','sec.leaver@example.com','Sec','Leaver','assessor', true, now() at time zone 'utc' - interval '2 days') on conflict (id) do nothing`);
  try {
    const r = await hit({ auth: true, user: { ...good, claims: { sub: "sec-test-leaver" } } }, "/api/users");
    ok(r.s === 403 && r.j.code === "ACCOUNT_CLOSED", "a leaver whose login still works is refused on every route", r);
    const viaPass = await hit({ auth: false }, "/api/users", passFor("sec-test-leaver"));
    ok(viaPass.s === 403 && viaPass.j.code === "ACCOUNT_CLOSED", "and a pass for a leaver gets nowhere either", viaPass);
  } finally { await db.execute(sql`delete from users where id='sec-test-leaver'`); }

  // an outside body's account with an end date: open until the date, closed from it, whatever their own login says
  console.log("An account end date (external verifiers)");
  await db.execute(sql`insert into users (id, email, first_name, last_name, role, access_ends_on) values
    ('sec-test-ext-ended','sec.ext.ended@example.com','Sec','Ended','external_verifier', now() - interval '1 hour'),
    ('sec-test-ext-future','sec.ext.future@example.com','Sec','Future','external_verifier', now() + interval '7 days'),
    ('sec-test-ext-none','sec.ext.none@example.com','Sec','None','external_verifier', null) on conflict (id) do nothing`);
  try {
    const as = (id: string) => ({ auth: true, user: { ...good, claims: { sub: id } } });
    const ended = await hit(as("sec-test-ext-ended"), "/api/users");
    ok(ended.s === 403 && ended.j.code === "ACCESS_ENDED", "an account whose end date has passed is refused on every route, and told its access has ended", ended);
    ok(!/left/i.test(String(ended.j.message)), "and is not told they have left");
    const viaEnded = await hit({ auth: false }, "/api/users", passFor("sec-test-ext-ended"));
    ok(viaEnded.s === 403 && viaEnded.j.code === "ACCESS_ENDED", "a pass for an ended account gets nowhere either", viaEnded);
    ok((await hit(as("sec-test-ext-future"), "/api/users")).s === 200, "an end date still in the future changes nothing yet");
    ok((await hit(as("sec-test-ext-none"), "/api/users")).s === 200, "no end date: no limit");
    // moving the date takes effect (after the one-minute lookup cache is dropped, which the route does)
    const { forgetAccountState } = await import("../../server/replitAuth");
    await db.execute(sql`update users set access_ends_on = null where id = 'sec-test-ext-ended'`); forgetAccountState("sec-test-ext-ended");
    ok((await hit(as("sec-test-ext-ended"), "/api/users")).s === 200, "clearing the end date gives the access back");
    await db.execute(sql`update users set access_ends_on = now() - interval '1 minute' where id = 'sec-test-ext-none'`); forgetAccountState("sec-test-ext-none");
    ok((await hit(as("sec-test-ext-none"), "/api/users")).s === 403, "and a date that has just passed takes it away");
  } finally { await db.execute(sql`delete from users where id in ('sec-test-ext-ended','sec-test-ext-future','sec-test-ext-none')`); }

  console.log("Linking a first sign-in to an account an administrator created");
  const mk = (byEmail: any, byId?: any) => {
    const calls: any = { reconcile: [] as any[], upsert: [] as any[] };
    const storage: any = {
      getUserByEmail: async () => byEmail, getUser: async () => byId,
      reconcileUserId: async (...a: any[]) => { calls.reconcile.push(a); },
      upsertUser: async (u: any) => { calls.upsert.push(u); },
    };
    return { up: makeUpsertUser(storage), calls };
  };
  const preprov = { id: "pre-1", email: "new.person@example.com", providerSub: null, role: "assessor" };
  let m = mk(preprov);
  await m.up({ sub: "idp-1", email: "new.person@example.com" });
  ok(m.calls.reconcile.length === 1, "an account with no identity yet is linked on first sign-in (provider sends no verified flag)");
  m = mk(preprov);
  await m.up({ sub: "idp-1", email: "new.person@example.com", email_verified: true });
  ok(m.calls.reconcile.length === 1, "and when the provider says the email is verified");
  m = mk(preprov);
  let err: any; try { await m.up({ sub: "idp-1", email: "new.person@example.com", email_verified: false }); } catch (e) { err = e; }
  ok(err instanceof SignInRefused && m.calls.reconcile.length === 0, "an address the provider says is NOT verified is refused");
  process.env.REQUIRE_EMAIL_VERIFIED = "true";
  m = mk(preprov); err = undefined; try { await m.up({ sub: "idp-1", email: "new.person@example.com" }); } catch (e) { err = e; }
  ok(err instanceof SignInRefused, "with REQUIRE_EMAIL_VERIFIED=true, a missing flag is refused too");
  m = mk(preprov);
  await m.up({ sub: "idp-1", email: "new.person@example.com", email_verified: true });
  ok(m.calls.reconcile.length === 1, "and a verified one is accepted");
  delete process.env.REQUIRE_EMAIL_VERIFIED;
  const linked = { id: "admin-1", email: "boss@example.com", providerSub: "idp-boss", role: "super_admin" };
  m = mk(linked); err = undefined; try { await m.up({ sub: "idp-attacker", email: "boss@example.com", email_verified: true }); } catch (e) { err = e; }
  ok(err instanceof SignInRefused && m.calls.reconcile.length === 0, "an account already tied to one identity cannot be taken over by another identity with the same email");
  m = mk({ ...linked, id: "idp-boss" }, { id: "idp-boss", role: "super_admin" });
  await m.up({ sub: "idp-boss", email: "boss@example.com" });
  ok(m.calls.reconcile.length === 0 && m.calls.upsert.length === 1 && m.calls.upsert[0].role === "super_admin", "the real owner signing in again just updates their record, keeping their role");
  m = mk(undefined, undefined); err = undefined; try { await m.up({ sub: "idp-new", email: "stranger@example.com", role: "super_admin" }); } catch (e) { err = e; }
  ok(err instanceof SignInRefused && m.calls.upsert.length === 0, "someone no administrator has added is refused, and no account is made");
  process.env.ALLOW_SELF_REGISTRATION = "true";
  m = mk(undefined, undefined);
  await m.up({ sub: "idp-new", email: "stranger@example.com", role: "super_admin" });
  ok(m.calls.upsert[0].role === "candidate", "where self-registration is switched on, a new person is a candidate and a role claim is ignored");
  delete process.env.ALLOW_SELF_REGISTRATION;
  const none: any = { getAllUsers: async () => [] }, has: any = { getAllUsers: async () => [{ role: "super_admin", isActive: true }] };
  const boot = { BOOTSTRAP_ADMIN_EMAILS: "first@example.com" } as any;
  ok(await newIdentityDecision("First@example.com", true, none, boot) === "super_admin", "the named first administrator of a new system becomes one");
  ok(await newIdentityDecision("first@example.com", true, has, boot) === "refuse", "but not once there is already a super administrator");
  ok(await newIdentityDecision("first@example.com", false, none, boot) === "refuse", "nor with an unverified address");
  ok(await newIdentityDecision("other@example.com", true, none, boot) === "refuse", "and nobody else");
  console.log("Closed accounts");
  try {
    await db.execute(sql`delete from users where id = 'sec-test-deleted'`);
    await db.execute(sql`insert into users (id, email, role, is_active) values ('sec-test-deleted', 'sec-test-deleted@example.com', 'candidate', false)`);
    forgetAccountState("sec-test-deleted");
    ok(await accountState("sec-test-deleted") === "left", "a deleted account is closed, even if the person's sign-in still works");
    await db.execute(sql`update users set is_active = true where id = 'sec-test-deleted'`);
    forgetAccountState("sec-test-deleted");
    ok(await accountState("sec-test-deleted") === "open", "and open again once reactivated");
  } finally { await db.execute(sql`delete from users where id = 'sec-test-deleted'`); }
  m = mk(undefined, { id: "idp-x", role: "candidate" });
  await m.up({ sub: "idp-x", email: "x@example.com", role: "super_admin" });
  ok(m.calls.upsert[0].role === "candidate", "an existing person's role cannot be raised from the provider's token");
  m = mk(undefined); err = undefined; try { await m.up({ email: "nosub@example.com" }); } catch (e) { err = e; }
  ok(err instanceof SignInRefused, "a token with no subject is refused");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
