// Serving SCORM packages from a separate address (ASVS 1.3.5 and 3.5.4).
//
// A learning package is a set of web pages and scripts made by someone else. Served from Capera's own address, its scripts would run with the
// signed-in person's session and could read or change anything that person can. So when CONTENT_ORIGIN is set (for example
// https://content.example.com, a second name for this same server) packages are served only from there:
//   - that address never receives the sign-in cookie (cookies are tied to the application's own host name), so a package's scripts have nothing to act with;
//   - the page is opened with a signed link that names one package and one learner and runs out after a few hours, so the address cannot be used to browse;
//   - the package cannot call the application's API, because it is a different site and the policy says so;
//   - it talks to Capera only by messages (the "bridge" below), which the player on the application's page checks and passes on as the signed-in person.
// With CONTENT_ORIGIN unset, packages are served from the application's own address as before (fine for a demo; the security notes list it as an accepted risk).
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Readable } from "stream";
import type { Request, RequestHandler, Response } from "express";

export const TOKEN_LIFETIME_MS = 4 * 60 * 60 * 1000;
const MAX_HTML_BYTES = 8 * 1024 * 1024;

export interface ContentOrigin { origin: string; host: string }

/** The separate content address, or null if none is configured (or it is unusable). A plain http address is accepted only outside production, for local testing. */
export function contentOrigin(env: Record<string, string | undefined> = process.env): ContentOrigin | null {
  const raw = (env.CONTENT_ORIGIN ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const production = env.NODE_ENV === "production";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && !production)) return null;
    if (u.pathname !== "/" || u.search || u.hash || u.username) return null;
    return { origin: u.origin, host: u.host };
  } catch { return null; }
}

function key(): string {
  const secret = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "local-dev-only-secret");
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return "capera-content-link:" + secret;
}
const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

export interface ContentLink { c: string; u: string; a: string; n: string; e: number }

/** A signed link for one learner to open one package: names the package, the learner and the application's address, and runs out. */
export function makeContentToken(link: { contentId: string; userId: string; appOrigin: string }, now = Date.now()): string {
  const body: ContentLink = { c: link.contentId, u: link.userId, a: link.appOrigin, n: randomBytes(9).toString("base64url"), e: now + TOKEN_LIFETIME_MS };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readContentToken(token: string, now = Date.now()): ContentLink | null {
  try {
    if (typeof token !== "string" || token.length > 900) return null;
    const [payload, sig, extra] = token.split(".");
    if (!payload || !sig || extra !== undefined) return null;
    const want = Buffer.from(sign(payload)), got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const b = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof b?.c !== "string" || typeof b?.u !== "string" || typeof b?.a !== "string" || typeof b?.n !== "string" || typeof b?.e !== "number") return null;
    if (b.e < now || b.e > now + TOKEN_LIFETIME_MS + 5 * 60_000) return null; // five minutes of slack for clocks that differ between servers
    return b as ContentLink;
  } catch { return null; }
}

const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");
export function launchUrl(co: ContentOrigin, token: string, launchPath: string): string {
  return `${co.origin}/c/${token}/${encodePath(launchPath)}`;
}

// ---------------------------------------------------------------- the bridge

// A script added to every page of a package. It gives the package the SCORM runtime it looks for (API for SCORM 1.2, API_1484_11 for 2004) inside its own
// page, keeps the learner's values for the length of the visit, and tells the player on Capera's page (by a message, to that address only) whenever the
// package commits or finishes. It carries no secret: the link already names the learner, and saving happens on the player's side, as the signed-in person.
export function bridgeScript(cfg: { version: "scorm12" | "scorm2004"; contentId: string; nonce: string; appOrigin: string; cmi: Record<string, string> }): string {
  const json = JSON.stringify(cfg).replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");
  return `<script>(function(){
var C=${json};var KEY='capera-cmi-'+C.nonce;var mem=null;
function load(){try{var s=window.sessionStorage.getItem(KEY);if(s)return JSON.parse(s);}catch(e){}return mem||C.cmi||{};}
function save(o){mem=o;try{window.sessionStorage.setItem(KEY,JSON.stringify(o));}catch(e){}}
function tell(o){try{window.top.postMessage({capera:'scorm',type:'commit',contentId:C.contentId,nonce:C.nonce,cmi:o},C.appOrigin);}catch(e){}}
function get(el){var o=load();return o[el]===undefined?'':String(o[el]);}
function set(el,v){var o=load();o[el]=String(v);save(o);return 'true';}
function done(){tell(load());return 'true';}
function ok(){return 'true';}function zero(){return '0';}function empty(){return '';}
if(C.version==='scorm2004'){window.API_1484_11={Initialize:ok,Terminate:done,GetValue:get,SetValue:set,Commit:done,GetLastError:zero,GetErrorString:empty,GetDiagnostic:empty};}
else{window.API={LMSInitialize:ok,LMSFinish:done,LMSGetValue:get,LMSSetValue:set,LMSCommit:done,LMSGetLastError:zero,LMSGetErrorString:empty,LMSGetDiagnostic:empty};}
window.addEventListener('beforeunload',function(){tell(load());});
})();</script>`;
}

/** Puts the bridge at the top of a package's HTML page, before the package's own scripts run. */
export function injectBridge(html: string, script: string): string {
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + script + html.slice(head.index + head[0].length);
  const root = /<html[^>]*>/i.exec(html);
  if (root) return html.slice(0, root.index + root[0].length) + script + html.slice(root.index + root[0].length);
  return script + html;
}

/** What the package sees as the learner's current values when it starts: the same set the player used to build on the application's own page. */
export function seedCmi(version: "scorm12" | "scorm2004", user: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null },
  progress: { cmiData?: unknown; suspendData?: string | null } | null): Record<string, string> {
  const prior = ((progress?.cmiData as Record<string, string> | null) ?? {});
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "";
  const resume = !!progress?.suspendData;
  const suspend = progress?.suspendData ?? prior["cmi.suspend_data"] ?? "";
  return version === "scorm2004"
    ? { ...prior, "cmi.learner_id": user.id, "cmi.learner_name": name, "cmi.credit": "credit", "cmi.mode": "normal", "cmi.entry": resume ? "resume" : "ab-initio",
        "cmi.completion_status": prior["cmi.completion_status"] ?? "not attempted", "cmi.success_status": prior["cmi.success_status"] ?? "unknown", "cmi.suspend_data": suspend }
    : { ...prior, "cmi.core.student_id": user.id, "cmi.core.student_name": name, "cmi.core.credit": "credit", "cmi.core.lesson_mode": "normal",
        "cmi.core.entry": resume ? "resume" : "", "cmi.core.lesson_status": prior["cmi.core.lesson_status"] ?? "not attempted", "cmi.suspend_data": suspend };
}

// ---------------------------------------------------------------- the content address

export interface ContentDeps {
  file(contentId: string, relativePath: string): Promise<{ objectKey: string; mimeType: string | null } | undefined>;
  open(objectKey: string): Readable;
  /** the package's version and the learner's saved values, for the bridge */
  context(contentId: string, userId: string): Promise<{ version: "scorm12" | "scorm2004"; user: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null }; progress: { cmiData?: unknown; suspendData?: string | null } | null } | null>;
}

const CONTENT_POLICY = (appOrigin: string) =>
  `default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ${appOrigin}`;

function plain(res: Response, status: number, text: string) {
  res.status(status).set({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }).send(text);
}

function readAll(stream: Readable, limit: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let n = 0;
    stream.on("data", (c: Buffer) => { n += c.length; if (n > limit) { stream.destroy(); resolve(null); } else chunks.push(c); });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Answers every request that arrives on the content address, and nothing else: it is installed before anything of the application, so a request for
 * the content address never reaches a sign-in, a session or an API route. Only /c/<signed link>/<file in the package> is served.
 */
export function contentHost(co: ContentOrigin, deps: ContentDeps): RequestHandler {
  return async (req: Request, res: Response, next) => {
    if ((req.headers.host ?? "").toLowerCase() !== co.host.toLowerCase()) return next();
    try {
      if (req.method !== "GET" && req.method !== "HEAD") return plain(res, 405, "Not allowed");
      const m = /^\/c\/([^/]+)\/(.+)$/.exec(req.path);
      if (!m) return plain(res, 404, "Not found");
      const link = readContentToken(m[1]);
      if (!link) return plain(res, 403, "This link is not valid or has run out. Open the learning again from Capera.");
      let relativePath: string;
      try { relativePath = decodeURIComponent(m[2]); } catch { return plain(res, 400, "Bad address"); }
      if (relativePath.includes("\0") || relativePath.split("/").some(p => p === ".." || p === ".")) return plain(res, 400, "Bad address");
      const file = await deps.file(link.c, relativePath);
      if (!file) return plain(res, 404, "Not found");

      const mime = file.mimeType || "application/octet-stream";
      res.set({
        "Content-Type": mime, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cross-Origin-Resource-Policy": "same-site",
        "Cache-Control": "private, max-age=3600", "Content-Security-Policy": CONTENT_POLICY(link.a),
      });
      if (/^text\/html\b/i.test(mime)) {
        const ctx = await deps.context(link.c, link.u);
        if (!ctx) return plain(res, 404, "Not found");
        const raw = await readAll(deps.open(file.objectKey), MAX_HTML_BYTES);
        if (!raw) return plain(res, 413, "This page is too large");
        const script = bridgeScript({ version: ctx.version, contentId: link.c, nonce: link.n, appOrigin: link.a, cmi: seedCmi(ctx.version, ctx.user, ctx.progress) });
        const body = Buffer.from(injectBridge(raw.toString("utf8"), script), "utf8");
        res.set("Cache-Control", "no-store");
        return void res.status(200).send(req.method === "HEAD" ? undefined : body);
      }
      if (req.method === "HEAD") return void res.status(200).end();
      const stream = deps.open(file.objectKey);
      stream.on("error", (err) => { console.error("Error streaming package file:", err?.message); if (!res.headersSent) plain(res, 500, "Could not read this file"); else res.destroy(); });
      stream.pipe(res);
    } catch (err: any) {
      console.error("Error serving package file:", err?.message);
      if (!res.headersSent) plain(res, 500, "Could not read this file");
    }
  };
}
