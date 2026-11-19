// Browser-facing protections applied to every response, written without extra packages so there is nothing new to keep patched.
// Maps to ASVS 5.0.0: 3.2.x, 3.3.x, 3.4.x (headers, CSP, framing), 3.5.x (cross-site requests), 4.x, 16.5.x, 2.4.x (rate limits).
import type { Request, RequestHandler, Response, NextFunction } from "express";

const isProduction = process.env.NODE_ENV === "production";
// Production and any run that sets CAPERA_STRICT_CSP get the strict policy. The development server (Vite) needs inline scripts for hot reload.
export const strictCsp = isProduction || process.env.CAPERA_STRICT_CSP === "true";

// Everything the pages load comes from Capera itself, apart from web fonts (to be hosted by Capera later; see security/asvs).
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", strictCsp ? CONTENT_SECURITY_POLICY : "frame-ancestors 'self'");
  if (isProduction) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
};

// Data from the API is personal and changes often: never keep a copy in the browser or a proxy unless a route says otherwise.
export const apiNoStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

// A request that changes something must come from Capera's own pages. Browsers say where a request came from (Sec-Fetch-Site and Origin);
// a request from another website, including a hidden form post, is refused. Tools that send neither header (curl, scheduled jobs, tests) are unaffected.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const extraOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
export const sameOriginForChanges: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const site = req.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return refuse(res);
  const origin = req.get("origin");
  if (origin) {
    let host: string | null = null;
    try { host = new URL(origin).host; } catch { host = null; }
    const own = (req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0].trim();
    if (!host || (host !== own && !extraOrigins.includes(origin))) return refuse(res);
  }
  next();
};
function refuse(res: Response) {
  return res.status(403).json({ message: "This request did not come from Capera's own pages, so it was refused." });
}

// Fixed-window counters in memory. Enough to stop a script hammering sign-in or the paid AI calls from one place or one account; a company
// running several copies of the app behind a load balancer would move this to the shared store.
const buckets = new Map<string, { n: number; resetAt: number }>();
setInterval(() => { const now = Date.now(); buckets.forEach((v, k) => { if (v.resetAt <= now) buckets.delete(k); }); }, 60_000).unref();

export function rateLimit(opts: { name: string; max: number; windowMs: number; by?: "ip" | "user" }): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user?.claims?.sub;
    const who = opts.by === "user" && user ? `u:${user}` : `ip:${req.ip}`;
    const key = `${opts.name}|${who}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) { b = { n: 0, resetAt: now + opts.windowMs }; buckets.set(key, b); }
    b.n++;
    if (b.n > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
      return res.status(429).json({ message: "Too many requests. Please wait a little and try again." });
    }
    next();
  };
}

// What to show a person when something fails: a plain message. The detail goes to the log (ASVS 16.5.1).
export function publicError(status: number, fallback: string, err: unknown): { status: number; body: { message: string } } {
  if (status >= 500) { console.error(fallback, err); return { status, body: { message: fallback } }; }
  return { status, body: { message: err instanceof Error && err.message ? err.message : fallback } };
}

// Serving a file somebody uploaded. Only a short list of types is ever shown inside the browser (a PDF or a picture); everything else, including
// HTML and SVG that could run script on Capera's own address, is downloaded under a neutral type (ASVS 1.3.4, 3.2.1, 5.3.2).
export const SAFE_INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);
export function contentDisposition(kind: "inline" | "attachment", name: string): string {
  const ascii = (name || "file").replace(/[^\x20-\x7e]/g, "_").replace(/["\\\r\n;]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name || "file")}`;
}
export function sendFileHeaders(res: Response, declaredType: string | null | undefined, fileName: string | null | undefined) {
  const type = (declaredType ?? "").split(";")[0].trim().toLowerCase();
  const inline = SAFE_INLINE_TYPES.has(type);
  res.setHeader("Content-Type", inline ? type : "application/octet-stream");
  res.setHeader("Content-Disposition", contentDisposition(inline ? "inline" : "attachment", fileName || "file"));
  res.setHeader("Cache-Control", "private, no-store");
  // a download is never run; a PDF or picture shown in the browser keeps the page-wide policy (the browser's PDF viewer does not work inside a sandbox)
  if (!inline) res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
}

// What an uploaded file claims to be is checked against what it is: the extension must be on the list for that kind of upload, and for
// the common formats the first bytes must match (a .pdf that is really HTML is refused). ASVS 5.2.2, 5.2.3, 1.3.4.
const FILE_TYPES: Record<string, { mime: string; magic?: (b: Buffer) => boolean }> = {
  pdf: { mime: "application/pdf", magic: b => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  png: { mime: "image/png", magic: b => b.length > 8 && b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG" },
  jpg: { mime: "image/jpeg", magic: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  jpeg: { mime: "image/jpeg", magic: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  gif: { mime: "image/gif", magic: b => b.subarray(0, 4).toString("latin1") === "GIF8" },
  webp: { mime: "image/webp", magic: b => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: b => b[0] === 0x50 && b[1] === 0x4b },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: b => b[0] === 0x50 && b[1] === 0x4b },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", magic: b => b[0] === 0x50 && b[1] === 0x4b },
  doc: { mime: "application/msword", magic: b => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 },
  xls: { mime: "application/vnd.ms-excel", magic: b => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 },
  ppt: { mime: "application/vnd.ms-powerpoint", magic: b => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 },
  txt: { mime: "text/plain" },
  csv: { mime: "text/csv" },
  mp4: { mime: "video/mp4" },
  mov: { mime: "video/quicktime" },
  mp3: { mime: "audio/mpeg" },
  m4a: { mime: "audio/mp4" },
  wav: { mime: "audio/wav" },
};
export const EVIDENCE_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "docx", "xlsx", "pptx", "doc", "xls", "ppt", "txt", "csv", "mp4", "mov", "mp3", "m4a", "wav"];
export const CV_EXTENSIONS = ["pdf", "doc", "docx"];
export const AVATAR_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

export function checkUpload(file: { originalname: string; buffer: Buffer }, allowed: string[]): { ok: true; mime: string } | { ok: false; reason: string } {
  const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
  const t = FILE_TYPES[ext];
  if (!t || !allowed.includes(ext)) return { ok: false, reason: `Files of type .${ext || "(none)"} are not accepted here. Allowed: ${allowed.join(", ")}.` };
  if (t.magic && !t.magic(file.buffer)) return { ok: false, reason: `"${file.originalname}" does not look like a real .${ext} file.` };
  return { ok: true, mime: t.mime };
}

// Text from a person or an imported document is turned into plain characters before it goes into a page, an email or a file (ASVS 1.2.1, 1.1.2).
export function escapeHtml(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// A spreadsheet treats a cell that starts with = + - @ (or a tab or return) as a formula; a leading apostrophe keeps it as text.
export function csvSafe(v: unknown): string {
  const s = String(v ?? "");
  if (/^-\d+(\.\d+)?$/.test(s)) return s; // an ordinary negative number stays a number
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
// Only web links and addresses inside Capera are kept; javascript: and data: links are dropped (ASVS 1.2.2).
export function safeHttpUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  try { const u = new URL(t); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}
