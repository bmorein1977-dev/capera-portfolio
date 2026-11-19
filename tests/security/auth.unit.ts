import express from "express";
import http from "http";
import { db } from "../../server/db";
import { sql } from "drizzle-orm";
import { requireSignedInForApi, makeUpsertUser, SignInRefused } from "../../server/replitAuth";
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
  app.get("/api/users", (_q, r) => r.json({ secret: true }));
  return app;
}
async function hit(s: Scn, path: string) {
  const server = http.createServer(appFor(s)); await new Promise<void>(r => server.listen(0, r));
  const port = (server.address() as any).port;
  try { const r = await fetch(`http://127.0.0.1:${port}${path}`); return { s: r.status, j: await r.json().catch(() => ({})) }; } finally { server.close(); }
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
  // a closed account (a leaver) cannot use the role-only routes any more
  await db.execute(sql`insert into users (id, email, first_name, last_name, role, is_archived, left_at) values ('sec-test-leaver','sec.leaver@example.com','Sec','Leaver','assessor', true, now() at time zone 'utc' - interval '2 days') on conflict (id) do nothing`);
  try {
    const r = await hit({ auth: true, user: { ...good, claims: { sub: "sec-test-leaver" } } }, "/api/users");
    ok(r.s === 403 && r.j.code === "ACCOUNT_CLOSED", "a leaver whose login still works is refused on every route", r);
  } finally { await db.execute(sql`delete from users where id='sec-test-leaver'`); }

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
  m = mk(undefined, undefined);
  await m.up({ sub: "idp-new", email: "stranger@example.com", role: "super_admin" });
  ok(m.calls.upsert[0].role === "candidate", "a brand new person is a candidate: a role claim from the provider is ignored");
  m = mk(undefined, { id: "idp-x", role: "candidate" });
  await m.up({ sub: "idp-x", email: "x@example.com", role: "super_admin" });
  ok(m.calls.upsert[0].role === "candidate", "an existing person's role cannot be raised from the provider's token");
  m = mk(undefined); err = undefined; try { await m.up({ email: "nosub@example.com" }); } catch (e) { err = e; }
  ok(err instanceof SignInRefused, "a token with no subject is refused");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
