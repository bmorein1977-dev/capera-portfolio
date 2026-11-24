// Learning packages from a separate address, without the real server or storage: the address setting, the signed link, the script that gives a package its
// SCORM runtime, and the handler that answers on that address and nothing else.
import vm from "vm";
import http from "http";
import { Readable } from "stream";
import express from "express";
import { contentOrigin, makeContentToken, readContentToken, launchUrl, bridgeScript, injectBridge, seedCmi, contentHost, TOKEN_LIFETIME_MS } from "../../server/services/contentOrigin";

process.env.SESSION_SECRET = "unit-test-secret";
let pass = 0, fail = 0;
const ok = (c: boolean, m: string, x?: unknown) => { if (c) { pass++; console.log("  PASS", m); } else { fail++; console.log("  FAIL", m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ""); } };

console.log("The content address setting");
ok(contentOrigin({}) === null && contentOrigin({ CONTENT_ORIGIN: "  " }) === null, "not configured means packages stay on the application's own address");
ok(contentOrigin({ CONTENT_ORIGIN: "https://content.example.com" })?.host === "content.example.com", "an https address is accepted");
ok(contentOrigin({ CONTENT_ORIGIN: "https://content.example.com/" })?.origin === "https://content.example.com", "a trailing slash is fine");
ok(contentOrigin({ CONTENT_ORIGIN: "http://127.0.0.1:5056" })?.host === "127.0.0.1:5056", "plain http is accepted for local testing");
ok(contentOrigin({ CONTENT_ORIGIN: "http://content.example.com", NODE_ENV: "production" }) === null, "plain http is refused in production");
ok(contentOrigin({ CONTENT_ORIGIN: "https://content.example.com/some/path" }) === null && contentOrigin({ CONTENT_ORIGIN: "https://user@content.example.com" }) === null && contentOrigin({ CONTENT_ORIGIN: "not a url" }) === null && contentOrigin({ CONTENT_ORIGIN: "javascript:alert(1)" }) === null, "a path, a user name, junk or a script address is refused");

console.log("The signed link");
const now = Date.now();
const t = makeContentToken({ contentId: "c1", userId: "u1", appOrigin: "https://app.example.com" }, now);
const r = readContentToken(t, now + 1000);
ok(!!r && r.c === "c1" && r.u === "u1" && r.a === "https://app.example.com", "a link names the package, the learner and the application's address");
ok(readContentToken(t, now + TOKEN_LIFETIME_MS + 60_000) === null, "a link runs out after a few hours");
ok(readContentToken(t, now - 60_000) !== null, "a clock slightly behind does not matter");
const [pl, sig] = t.split(".");
const forged = Buffer.from(JSON.stringify({ c: "other", u: "u1", a: "https://app.example.com", n: "x", e: now + 1000 })).toString("base64url");
ok(readContentToken(`${forged}.${sig}`, now) === null, "changing which package it names breaks the signature");
const swapped = Buffer.from(JSON.stringify({ c: "c1", u: "someone-else", a: "https://app.example.com", n: "x", e: now + 1000 })).toString("base64url");
ok(readContentToken(`${swapped}.${sig}`, now) === null, "changing the learner breaks it too");
ok(readContentToken(`${pl}.${sig.slice(0, -2)}AA`, now) === null && readContentToken("", now) === null && readContentToken("a.b.c", now) === null && readContentToken("x".repeat(2000), now) === null, "a damaged, empty, malformed or oversized link is refused");
const other = (() => { process.env.SESSION_SECRET = "another-secret"; const x = makeContentToken({ contentId: "c1", userId: "u1", appOrigin: "https://app.example.com" }, now); process.env.SESSION_SECRET = "unit-test-secret"; return x; })();
ok(readContentToken(other, now) === null, "a link made with a different secret is refused");
ok(makeContentToken({ contentId: "c1", userId: "u1", appOrigin: "a" }, now) !== makeContentToken({ contentId: "c1", userId: "u1", appOrigin: "a" }, now), "every launch gets its own link");
ok(launchUrl({ origin: "https://content.example.com", host: "content.example.com" }, "TOK", "course files/start page.html") === "https://content.example.com/c/TOK/course%20files/start%20page.html", "the launch address encodes the file name");

console.log("Seed values for the package");
const s12 = seedCmi("scorm12", { id: "u1", firstName: "Ada", lastName: "Lovelace", email: "a@x" }, null);
ok(s12["cmi.core.student_id"] === "u1" && s12["cmi.core.student_name"] === "Ada Lovelace" && s12["cmi.core.lesson_status"] === "not attempted" && s12["cmi.core.entry"] === "", "SCORM 1.2 starts with the learner and 'not attempted'");
const s04 = seedCmi("scorm2004", { id: "u1", email: "a@x" }, { cmiData: { "cmi.completion_status": "incomplete", "cmi.location": "p3" }, suspendData: "abc" });
ok(s04["cmi.learner_name"] === "a@x" && s04["cmi.entry"] === "resume" && s04["cmi.completion_status"] === "incomplete" && s04["cmi.location"] === "p3" && s04["cmi.suspend_data"] === "abc", "SCORM 2004 resumes from what was saved");

console.log("The script that gives a package its runtime");
const evil = seedCmi("scorm12", { id: "u1", firstName: "</script><script>alert(1)</script>", lastName: " " }, null);
const sc = bridgeScript({ version: "scorm12", contentId: "c1", nonce: "n1", appOrigin: "https://app.example.com", cmi: evil });
ok((sc.match(/<\/script/gi) ?? []).length === 1 && (sc.match(/<script/gi) ?? []).length === 1, "a learner's name cannot close the script early");
ok(!sc.includes(" ") && !sc.includes(" "), "line-separator characters are escaped");

function run(version: "scorm12" | "scorm2004", cmi: Record<string, string>, storage: Record<string, string> | "blocked" = {}) {
  const sent: any[] = [];
  const store = storage === "blocked" ? null : (storage as Record<string, string>);
  const win: any = {
    top: { postMessage: (m: any, origin: string) => sent.push({ m, origin }) },
    addEventListener: (ev: string, fn: () => void) => { (win.__l ??= {})[ev] = fn; },
    sessionStorage: store ? { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = v; } } : { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } },
  };
  win.window = win;
  const code = bridgeScript({ version, contentId: "c1", nonce: "n1", appOrigin: "https://app.example.com", cmi }).replace(/^<script>/, "").replace(/<\/script>$/, "");
  vm.runInNewContext(code, win);
  return { win, sent, store };
}
const a = run("scorm12", { "cmi.core.student_name": "Ada", "cmi.core.lesson_status": "not attempted" });
ok(typeof a.win.API?.LMSInitialize === "function" && a.win.API_1484_11 === undefined, "a SCORM 1.2 package gets API (and not the 2004 one)");
ok(a.win.API.LMSInitialize("") === "true" && a.win.API.LMSGetValue("cmi.core.student_name") === "Ada", "it starts with the learner's values");
a.win.API.LMSSetValue("cmi.core.lesson_status", "completed");
ok(a.win.API.LMSGetValue("cmi.core.lesson_status") === "completed" && a.win.API.LMSGetValue("cmi.core.nothing") === "" && a.win.API.LMSGetLastError() === "0", "values set are read back; unknown ones are empty");
ok(a.sent.length === 0, "nothing is sent until the package commits");
a.win.API.LMSCommit("");
ok(a.sent.length === 1 && a.sent[0].origin === "https://app.example.com" && a.sent[0].m.capera === "scorm" && a.sent[0].m.type === "commit" && a.sent[0].m.contentId === "c1" && a.sent[0].m.cmi["cmi.core.lesson_status"] === "completed", "a commit tells the player, addressed to the application only, with the values");
a.win.API.LMSFinish("");
ok(a.sent.length === 2, "finishing commits too");
a.win.__l.beforeunload();
ok(a.sent.length === 3, "closing the page sends the latest values once more");
// the next page of the same package, same visit: the values are still there (kept for the visit, not for ever)
const b = run("scorm12", { "cmi.core.lesson_status": "not attempted" }, a.store as Record<string, string>);
ok(b.win.API.LMSGetValue("cmi.core.lesson_status") === "completed", "another page of the package in the same visit sees what the first one set");
const c = run("scorm2004", { "cmi.learner_name": "Ada" });
ok(typeof c.win.API_1484_11?.Initialize === "function" && c.win.API === undefined && c.win.API_1484_11.GetValue("cmi.learner_name") === "Ada", "a SCORM 2004 package gets API_1484_11");
c.win.API_1484_11.SetValue("cmi.score.raw", 90); c.win.API_1484_11.Terminate("");
ok(c.sent[0].m.cmi["cmi.score.raw"] === "90", "values are kept as text");
const d = run("scorm12", { "cmi.core.student_name": "Ada" }, "blocked");
d.win.API.LMSSetValue("cmi.x", "1");
ok(d.win.API.LMSGetValue("cmi.x") === "1" && d.win.API.LMSGetValue("cmi.core.student_name") === "Ada", "if the browser blocks storage it still works for the page");

console.log("Putting the script into a page");
const S = "<script>X</script>";
ok(injectBridge("<html><head><title>t</title></head><body></body></html>", S).startsWith("<html><head><script>X</script><title>"), "it goes straight after <head>, before the package's own scripts");
ok(injectBridge("<HTML><HEAD lang=en><script src=a.js></script></HEAD>", S).indexOf(S) < injectBridge("<HTML><HEAD lang=en><script src=a.js></script></HEAD>", S).indexOf("a.js"), "upper case and attributes are fine");
ok(injectBridge("<html><body>hi</body></html>", S).startsWith("<html><script>X"), "a page with no head gets it after <html>");
ok(injectBridge("just text", S) === S + "just text", "a fragment gets it first");

console.log("The content address");
type Files = Record<string, { mime: string; body: string }>;
const FILES: Files = {
  "index.html": { mime: "text/html", body: "<html><head><title>Course</title></head><body><script src=\"a.js\"></script></body></html>" },
  "a.js": { mime: "application/javascript", body: "console.log(1)" },
  "dir/page two.html": { mime: "text/html", body: "<html><body>two</body></html>" },
};
const deps = {
  file: async (contentId: string, rel: string) => (contentId === "c1" && FILES[rel] ? { objectKey: rel, mimeType: FILES[rel].mime } : undefined),
  open: (key: string) => Readable.from([Buffer.from(FILES[key].body)]),
  context: async (contentId: string, userId: string) => (contentId === "c1" ? { version: "scorm12" as const, user: { id: userId, firstName: "Ada", lastName: "Lovelace" }, progress: null } : null),
};
const CO = { origin: "http://content.test", host: "content.test" };
const app = express();
app.use(contentHost(CO, deps));
app.get("/api/ping", (_req, res) => res.json({ app: true }));
app.get("/", (_req, res) => res.send("the application"));

function call(host: string, path: string, method = "GET", headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const srv = app.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as any).port;
      const req = http.request({ host: "127.0.0.1", port, path, method, headers: { host, ...headers } }, (res) => {
        const chunks: Buffer[] = []; res.on("data", c => chunks.push(c)); res.on("end", () => { srv.close(); resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }); });
      });
      req.on("error", e => { srv.close(); reject(e); });
      req.end();
    });
  });
}
(async () => {
  const link = makeContentToken({ contentId: "c1", userId: "u1", appOrigin: "http://app.test" });
  const page = await call("content.test", `/c/${link}/index.html`);
  ok(page.status === 200 && !!page.headers["content-type"]?.startsWith("text/html") && page.body.includes("window.API="), "the launch page is served on the content address", page.status);
  ok(page.body.indexOf("<script>(function(){") < page.body.indexOf('src="a.js"') && page.body.includes("Ada Lovelace"), "with the runtime ahead of the package's own scripts and the learner's name in it");
  ok(String(page.headers["content-security-policy"]).includes("frame-ancestors http://app.test") && page.headers["x-content-type-options"] === "nosniff" && page.headers["referrer-policy"] === "no-referrer", "only the application may frame it; no sniffing; no referrer", page.headers);
  ok(page.headers["cache-control"] === "no-store", "a page that carries the learner's values is not stored");
  ok(!("set-cookie" in page.headers), "no cookie is ever set on this address");
  const js = await call("content.test", `/c/${link}/a.js`);
  ok(js.status === 200 && js.body === "console.log(1)" && js.headers["content-type"]?.startsWith("application/javascript") && !js.body.includes("capera"), "other files are served as they are");
  const sub = await call("content.test", `/c/${link}/dir/page%20two.html`);
  ok(sub.status === 200 && sub.body.includes("two") && sub.body.includes("window.API"), "a page in a folder, with a space in its name, works and gets the runtime too");
  const head = await call("content.test", `/c/${link}/a.js`, "HEAD");
  ok(head.status === 200 && head.body === "", "HEAD works");
  ok((await call("content.test", `/c/${link}/missing.html`)).status === 404, "a file that is not in the package is not found");
  ok((await call("content.test", `/c/${link}/../index.html`)).status !== 200 && (await call("content.test", `/c/${link}/dir/%2e%2e/index.html`)).status === 400 && (await call("content.test", `/c/${link}/%00`)).status === 400, "climbing out of the package is refused");
  ok((await call("content.test", `/c/${link.slice(0, -3)}abc/index.html`)).status === 403 && (await call("content.test", "/c/not-a-link/index.html")).status === 403, "a damaged or invented link is refused");
  const old = makeContentToken({ contentId: "c1", userId: "u1", appOrigin: "http://app.test" }, Date.now() - TOKEN_LIFETIME_MS - 120_000);
  ok((await call("content.test", `/c/${old}/index.html`)).status === 403, "a link that has run out is refused");
  const otherPkg = makeContentToken({ contentId: "c2", userId: "u1", appOrigin: "http://app.test" });
  ok((await call("content.test", `/c/${otherPkg}/index.html`)).status === 404, "a link for one package opens nothing of another");
  ok((await call("content.test", "/api/ping")).status === 404 && (await call("content.test", "/")).status === 404 && (await call("content.test", "/api/auth/user")).status === 404, "nothing of the application is reachable on this address");
  ok((await call("content.test", `/c/${link}/index.html`, "POST")).status === 405 && (await call("content.test", `/c/${link}/index.html`, "DELETE")).status === 405, "it only ever reads");
  ok((await call("CONTENT.TEST", `/c/${link}/a.js`)).status === 200, "the host name is not case sensitive");
  const appHost = await call("app.test", "/api/ping");
  ok(appHost.status === 200 && appHost.body.includes('"app":true'), "the application's own address is untouched");
  ok((await call("app.test", `/c/${link}/index.html`)).status === 404, "and does not serve packages (that route does not exist there)");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
