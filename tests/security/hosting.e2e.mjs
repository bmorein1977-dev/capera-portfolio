// A company installation, from nothing: the PRODUCTION build, a standard OpenID Connect provider (a small stand-in for one, such as
// Microsoft Entra ID), files on the server's own disk, an empty database built by the upgrade tool, and nothing from Replit.
//
//   1. npm run build
//   2. DATABASE_URL=<an EMPTY database> node scripts/db/migrate.mjs
//   3. DATABASE_URL=<the same> node tests/security/hosting.e2e.mjs
//
// It starts and stops its own stand-in provider and server. It adds people to the database it is given, so never point it at one in use.
import http from "node:http";
import { spawn } from "node:child_process";
import { createSign, generateKeyPairSync, randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = 5071, IDP = 5072;
const PUBLIC = "https://competence.test.localhost";
const ISSUER = `http://127.0.0.1:${IDP}`;
const CLIENT = "capera-test-client", SECRET = "capera-test-client-secret";
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log("  PASS", m); } else { fail++; console.log("  FAIL", m, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ""); } };

// ---------------------------------------------------------------------------------------------------------- the stand-in provider
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
const jwt = (claims) => { const body = `${b64({ alg: "RS256", kid: "k1", typ: "JWT" })}.${b64(claims)}`; return `${body}.${createSign("RSA-SHA256").update(body).sign(privateKey).toString("base64url")}`; };
const codes = new Map();
let nextPerson = null; // the claims of whoever "signs in" next
const provider = http.createServer((req, res) => {
  const u = new URL(req.url, ISSUER);
  const send = (v, s = 200) => { res.statusCode = s; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(v)); };
  if (u.pathname === "/.well-known/openid-configuration") return send({ issuer: ISSUER, authorization_endpoint: `${ISSUER}/authorize`, token_endpoint: `${ISSUER}/token`, jwks_uri: `${ISSUER}/keys`, end_session_endpoint: `${ISSUER}/logout`, response_types_supported: ["code"], subject_types_supported: ["pairwise"], id_token_signing_alg_values_supported: ["RS256"], code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["client_secret_post"] });
  if (u.pathname === "/keys") return send({ keys: [jwk] });
  if (u.pathname === "/authorize") {
    const code = randomUUID();
    codes.set(code, { claims: nextPerson, nonce: u.searchParams.get("nonce"), challenge: u.searchParams.get("code_challenge"), redirect: u.searchParams.get("redirect_uri"), client: u.searchParams.get("client_id") });
    const back = new URL(u.searchParams.get("redirect_uri"));
    back.searchParams.set("code", code);
    if (u.searchParams.get("state")) back.searchParams.set("state", u.searchParams.get("state"));
    res.statusCode = 302; res.setHeader("location", back.toString()); return res.end();
  }
  if (u.pathname === "/token" && req.method === "POST") {
    let raw = ""; req.on("data", (d) => (raw += d)); req.on("end", () => {
      const f = new URLSearchParams(raw), got = codes.get(f.get("code"));
      codes.delete(f.get("code"));
      if (!got) return send({ error: "invalid_grant" }, 400);
      const secretOk = f.get("client_secret") === SECRET && f.get("client_id") === CLIENT;
      const pkceOk = !got.challenge || createHash("sha256").update(f.get("code_verifier") ?? "").digest("base64url") === got.challenge;
      if (!secretOk || !pkceOk) return send({ error: "invalid_client" }, 401);
      const now = Math.floor(Date.now() / 1000);
      send({ access_token: randomUUID(), token_type: "Bearer", expires_in: 3600, refresh_token: randomUUID(), id_token: jwt({ iss: ISSUER, aud: CLIENT, iat: now, exp: now + 3600, ...(got.nonce ? { nonce: got.nonce } : {}), ...got.claims }) });
    });
    return;
  }
  send({ error: "not found" }, 404);
});

// ---------------------------------------------------------------------------------------------------------- a browser, of sorts
function browser() {
  const jar = new Map();
  const go = async (url, o = {}) => {
    const target = url.startsWith("/") ? `http://127.0.0.1:${APP}${url}` : url.replace(PUBLIC, `http://127.0.0.1:${APP}`);
    const toApp = target.startsWith(`http://127.0.0.1:${APP}`);
    // the proxy in front of a real installation ends the encrypted connection and says so
    const headers = { ...(toApp ? { "x-forwarded-proto": "https", "x-forwarded-host": new URL(PUBLIC).host, host: new URL(PUBLIC).host } : {}), ...(toApp && jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}), ...(o.headers || {}) };
    const r = await new Promise((resolve, reject) => {
      const u = new URL(target);
      const q = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: o.method || "GET", headers }, (res) => { const parts = []; res.on("data", (d) => parts.push(d)); res.on("end", () => resolve({ s: res.statusCode, h: res.headers, body: Buffer.concat(parts) })); });
      q.on("error", reject); if (o.body) q.write(o.body); q.end();
    });
    if (toApp) for (const c of r.h["set-cookie"] || []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    r.text = r.body.toString(); try { r.j = JSON.parse(r.text); } catch { r.j = null; }
    return r;
  };
  const signIn = async (claims) => {
    nextPerson = claims;
    const start = await go("/api/login");
    if (start.s !== 302) return { start };
    const atProvider = await go(start.h.location);
    const done = await go(atProvider.h.location);
    return { start, atProvider, done };
  };
  const json = (method, url, body) => go(url, { method, headers: { "content-type": "application/json", origin: PUBLIC, "sec-fetch-site": "same-origin" }, body: JSON.stringify(body) });
  return { go, signIn, json, jar };
}

// ---------------------------------------------------------------------------------------------------------- the run
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "capera-company-"));
const baseEnv = {
  PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: "production", PORT: String(APP), SESSION_SECRET: "a-test-session-secret-of-more-than-32-characters",
  OIDC_ISSUER_URL: ISSUER, OIDC_ALLOW_HTTP: "true", OIDC_CLIENT_ID: CLIENT, OIDC_CLIENT_SECRET: SECRET, APP_BASE_URL: PUBLIC,
  OIDC_ALLOWED_TENANT: "company-tenant", OIDC_REQUIRE_MFA: "true", REQUIRE_EMAIL_VERIFIED: "false",
  STORAGE_DRIVER: "filesystem", STORAGE_DIR: storeDir, EMAIL_SERVICE: "none", AI_FEATURES: "off", BOOTSTRAP_ADMIN_EMAILS: "first.admin@company.test",
};
let log = "";
function startServer(env) {
  const p = spawn(process.execPath, ["dist/index.js"], { env, cwd: process.cwd() });
  p.stdout.on("data", (d) => (log += d)); p.stderr.on("data", (d) => (log += d));
  return p;
}
const waitUp = async () => { for (let i = 0; i < 90; i++) { try { const r = await browser().go("/api/health"); if (r.s === 200) return r; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 1000)); } return null; };
const person = (sub, email, extra = {}) => ({ sub, preferred_username: email, given_name: "Test", family_name: sub, tid: "company-tenant", amr: ["pwd", "mfa"], ...extra });

let server;
try {
  if (!fs.existsSync("dist/index.js")) throw new Error("Run npm run build first");
  await new Promise((r) => provider.listen(IDP, "127.0.0.1", r));

  console.log("It will not start half-configured");
  const broken = startServer({ ...baseEnv, OIDC_CLIENT_ID: "" });
  const code = await new Promise((r) => { const t = setTimeout(() => { broken.kill(); r("still running"); }, 120000); broken.on("exit", (c) => { clearTimeout(t); r(c); }); });
  ok(code !== 0 && code !== "still running" && /OIDC_CLIENT_ID/.test(log), "without a client id it stops and says what is missing", [code, log.slice(-600)]);
  log = "";

  server = startServer(baseEnv);
  const up = await waitUp();
  ok(up?.j?.status === "ok", "the production server starts on the new database and reports healthy", log.slice(-800));
  const anon = browser();
  ok((await anon.go("/api/users")).s === 401, "nothing is readable without signing in");
  const page = await anon.go("/");
  ok(page.s === 200 && /<div id="root">/.test(page.text), "the application page is served");
  ok(/default-src/.test(page.h["content-security-policy"] || ""), "with the strict content policy");
  ok((await anon.go("/api/test/anything")).s !== 200 && (await anon.json("POST", "/api/auth/impersonate", { userId: "x" })).s === 401, "there is no way in without the identity provider");

  console.log("Single sign-on");
  const admin = browser();
  let r = await admin.signIn(person("admin-sub", "first.admin@company.test"));
  ok(r.start.s === 302 && r.start.h.location.startsWith(`${ISSUER}/authorize`) && r.start.h.location.includes(encodeURIComponent(`${PUBLIC}/api/callback`)), "sign-in goes to the company's provider and comes back to the company address", r.start.h.location);
  ok(/code_challenge=/.test(r.start.h.location), "with proof-key protection (PKCE)");
  ok(r.done?.s === 302 && !/login-refused/.test(r.done.h.location), "the first administrator signs in", r.done?.h?.location);
  const cookie = (r.done?.h?.["set-cookie"] || []).join(";");
  ok(/HttpOnly/i.test(cookie) && /Secure/i.test(cookie) && /SameSite=Lax/i.test(cookie), "the session cookie is HttpOnly, Secure and SameSite", cookie);
  let me = await admin.go("/api/auth/user");
  ok(me.s === 200 && me.j?.role === "super_admin" && me.j?.email === "first.admin@company.test", "and is the first super administrator, with the name and address from the provider", me.j);

  const stranger = browser();
  r = await stranger.signIn(person("stranger-sub", "not.added@company.test"));
  ok(/login-refused/.test(r.done?.h?.location || "") && (await stranger.go("/api/auth/user")).s === 401, "someone the company has not added is refused", r.done?.h?.location);
  r = await browser().signIn(person("x1", "first.admin@company.test", { sub: "x1", tid: "another-tenant" }));
  ok(/login-refused/.test(r.done?.h?.location || ""), "a sign-in from another organisation is refused");
  r = await browser().signIn(person("x2", "second.admin@company.test", { amr: ["pwd"] }));
  ok(/login-refused/.test(r.done?.h?.location || ""), "a sign-in without multi-factor authentication is refused");

  r = await admin.json("POST", "/api/admin/users", { firstName: "Casey", lastName: "Starter", email: "casey.starter@company.test", role: "candidate" });
  ok(r.s < 300, "the administrator adds a person", r.j || r.text.slice(0, 200));
  const casey = browser();
  r = await casey.signIn(person("casey-sub", "casey.starter@company.test"));
  me = await casey.go("/api/auth/user");
  ok(me.s === 200 && me.j?.role === "candidate", "who can then sign in, matched by email, with the role set in Capera", me.j || r.done?.h?.location);
  r = await browser().signIn(person("impostor-sub", "casey.starter@company.test"));
  ok(/login-refused/.test(r.done?.h?.location || ""), "a different identity cannot take over that account");
  ok((await casey.go("/api/users/admin-sub")).s === 403, "a candidate cannot read an administrator's record");
  ok((await casey.go("/api/audit-log")).s === 403, "or the audit log");
  const evil = await admin.go("/api/admin/users", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", "sec-fetch-site": "cross-site" }, body: "{}" });
  ok(evil.s === 403, "a change requested from another website is refused", evil.s);

  console.log("Files stay on the company's own storage");
  const heading = await admin.go("/api/opito/headings");
  ok(heading.s === 200 && heading.j.length > 0, "the audit evidence repository is there");
  const boundary = "----capera" + randomUUID();
  const part = (n, v) => `--${boundary}\r\nContent-Disposition: form-data; name="${n}"\r\n\r\n${v}\r\n`;
  const file = "%PDF-1.4\n% company hosting check\n";
  const body = part("categoryKey", heading.j[0].key) + part("title", "Hosting check") + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="check.pdf"\r\nContent-Type: application/pdf\r\n\r\n${file}\r\n--${boundary}--\r\n`;
  r = await admin.go("/api/opito/documents", { method: "POST", headers: { "content-type": `multipart/form-data; boundary=${boundary}`, origin: PUBLIC, "sec-fetch-site": "same-origin", "content-length": Buffer.byteLength(body) }, body });
  ok(r.s === 201, "a document is uploaded", r.j || r.text.slice(0, 200));
  const stored = fs.existsSync(path.join(storeDir, "opito-documents")) ? fs.readdirSync(path.join(storeDir, "opito-documents")) : [];
  ok(stored.length === 1, "and is on the company's disk", stored);
  if (r.j?.id) { const dl = await admin.go(`/api/opito/documents/${r.j.id}/download`); ok(dl.s === 200 && dl.text === file, "and comes back unchanged", dl.s); }

  console.log("Nothing from Replit is needed");
  ok(!/replit/i.test(log), "the server's log never mentions Replit", log.match(/.{0,80}replit.{0,80}/i)?.[0]);
  ok(!/casey|first\.admin/i.test(log.split("\n").filter((l) => /\[express\]/.test(l)).join("\n")), "request logs hold no names or addresses");
  console.log("Integration keys on a company system");
  const made = await admin.json("POST", "/api/api-keys", { name: "Hosting check", scopes: ["competence:read"] });
  const bearer = { authorization: `Bearer ${made.j?.key}` };
  ok(made.s === 201 && (await browser().go("/api/v1/standards", { headers: bearer })).s === 200, "a key works on the integration interface with no sign-in", made.j || made.s);
  ok((await browser().go("/api/v1/standards")).s === 401, "without a key it does not");
  ok((await browser().go("/api/users", { headers: bearer })).s === 401, "and a key opens none of the screens' own addresses");

  r = await admin.go("/api/logout");
  ok(r.s === 302 && r.h.location.startsWith(`${ISSUER}/logout`) && r.h.location.includes("post_logout_redirect_uri"), "signing out also signs out at the provider", r.h.location);
  ok((await admin.go("/api/auth/user")).s === 401, "and the session is over");
} catch (e) { fail++; console.log("  FAIL the run stopped:", e.stack); console.log(log.slice(-1500)); }
finally {
  server?.kill();
  provider.close();
  fs.rmSync(storeDir, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
