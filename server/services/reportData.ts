// Collecting what a page shows, as tables. A page is made of one or more API calls; the browser tells us which ones, and we make the same calls again
// here, as the same signed-in person (their cookie, so every permission and every "only your own people" rule applies exactly as it does on screen).
// Nothing a browser sends us is ever treated as data, only as the list of places to look: an export cannot be forged.

export type ColType = "text" | "number" | "date" | "percent" | "boolean";
export interface Col { key: string; label: string; type: ColType }
export type TableKind = "data" | "reference" | "figures";
export interface Table { id: string; name: string; source: string; kind: TableKind; columns: Col[]; rows: Array<Record<string, any>>; truncated: boolean }

const MAX_URLS = 14;
const MAX_ROWS = 50_000;
const MAX_BYTES = 12 * 1024 * 1024;

// ------------------------------------------------------------------------------------------------------------ which addresses may be read
// Only reading, only inside the app's own data calls, and never the ones that stream files, start a sign-in or are the export itself.
const OK_URL = /^\/api\/[A-Za-z0-9_\-\/.%]*(\?[A-Za-z0-9_\-=&.%,:+]*)?$/;
const DENY = [/^\/api\/auth\//, /^\/api\/export\//, /^\/api\/(login|logout|callback)/, /\/(download|cv|avatar|export|certificate-file)(\/|\?|$)/, /^\/api\/(test|admin\/seed)/, /^\/api\/health/];
export function allowedUrl(u: unknown): u is string {
  return typeof u === "string" && u.length < 600 && OK_URL.test(u) && !u.includes("..") && !u.includes("//") && !DENY.some(r => r.test(u));
}
export function cleanUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return Array.from(new Set(urls.filter(allowedUrl))).slice(0, MAX_URLS);
}

// ------------------------------------------------------------------------------------------------------------ fetching
export async function fetchJson(base: string, url: string, headers: Record<string, string>): Promise<unknown | null> {
  try {
    const r = await fetch(base + url, { headers: { accept: "application/json", ...headers }, signal: AbortSignal.timeout(25_000) });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return null;
    const text = await r.text();
    if (text.length > MAX_BYTES) return null;
    return JSON.parse(text);
  } catch { return null; }
}

// ------------------------------------------------------------------------------------------------------------ naming
const LOOKUP = /\/(job-roles|locations|business-units|teams|contract-companies|competency-categories|training-categories|training-levels|proficiency[^/]*|settings|permissions|roles|shifts|org\/business-units|users\/by-effective-role[^?]*)(\?|$)/;
const SECRET = /(token|secret|password|passcode|objectkey|object_key|providersub|refresh|hash|apikey|cookie|session)/i;
const BORING = /^(id|createdat|updatedat|isactive|isarchived|deletedat|version|sortorder|order|colour|color|icon|generatedat|filtersapplied|totalmatched)$/i;

// "jobRoleName" -> "Job role name": sentence case, with ID kept in capitals
export const humanise = (s: string) => {
  const words = s.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().split(" ").map(w => (/^(id|url|kpi|sla)$/i.test(w) ? w.toUpperCase() : w.toLowerCase()));
  const out = words.join(" "); return out.charAt(0).toUpperCase() + out.slice(1);
};
function nameFromUrl(url: string): string {
  const path = url.split("?")[0].replace(/^\/api\//, "").split("/").filter(p => p && !/^[0-9a-f-]{8,}$/i.test(p) && !/^(demo|test|manual)-/.test(p));
  // the last part names the page's data ("compliance-explorer"); a generic last part ("summary", "all") borrows the one before it
  const generic = /^(summary|all|list|mine|overview|status|data|report|reports)$/i;
  const last = (path.length > 1 && generic.test(path[path.length - 1]) ? path.slice(-2) : path.slice(-1)).join(" ").replace(/[-_]/g, " ");
  return humanise(last || "Data");
}
const isIso = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v) && !Number.isNaN(Date.parse(v));
const isIdKey = (k: string) => /(^|\.)id$|[a-z0-9]Id$|_id$|uuid$/.test(k);

// ------------------------------------------------------------------------------------------------------------ flattening
type Flat = Record<string, any>;
function flatten(obj: any, prefix: string, out: Flat, depth: number) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (SECRET.test(k)) continue;
    if (v === null || v === undefined) { out[key] = null; continue; }
    if (Array.isArray(v)) {
      if (v.every(x => x === null || ["string", "number", "boolean"].includes(typeof x))) out[key] = v.filter(x => x !== null).join("; ").slice(0, 400);
      else out[`${key} (count)`] = v.length;
    } else if (typeof v === "object") { if (depth < 3) flatten(v, key, out, depth + 1); }
    else out[key] = v;
  }
}

function inferType(key: string, values: any[]): ColType {
  const real = values.filter(v => v !== null && v !== undefined && v !== "");
  if (!real.length) return "text";
  if (real.every(v => typeof v === "boolean")) return "boolean";
  if (real.every(v => typeof v === "number")) {
    if (/(percent|percentage|pct|coverage|rate)$/i.test(key.split(".").pop()!) && real.every(v => v >= 0 && v <= 100)) return "percent";
    return "number";
  }
  if (real.every(isIso)) return "date";
  return "text";
}

function buildTable(source: string, name: string, kind: TableKind, rawRows: any[], idPrefix: string): Table | null {
  const truncated = rawRows.length > MAX_ROWS;
  const flat: Flat[] = rawRows.slice(0, MAX_ROWS).map(r => { const o: Flat = {}; if (r && typeof r === "object") flatten(r, "", o, 0); else o.value = r; return o; });
  const keys: string[] = [];
  for (const r of flat) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
  // leave out identifiers and housekeeping, and columns with nothing in them
  const useful = keys.filter(k => !isIdKey(k) && !BORING.test(k.split(".").pop()!) && flat.some(r => r[k] !== null && r[k] !== undefined && r[k] !== ""));
  const shown = (useful.length ? useful : keys).slice(0, 60);
  if (!shown.length) return null;
  const labels = new Map<string, number>();
  const columns: Col[] = shown.map(k => {
    const parts = k.split(".");
    // "competence.percentage" reads as "Competence percentage", "user.email" as "User email"
    const label = humanise(parts.length > 1 ? `${parts[parts.length - 2]} ${parts[parts.length - 1]}` : parts[0]);
    const n = (labels.get(label) ?? 0) + 1; labels.set(label, n);
    return { key: k, label: n > 1 ? `${label} (${n})` : label, type: inferType(k, flat.map(r => r[k])) };
  });
  const table: Table = { id: idPrefix, name, source, kind, columns, rows: flat, truncated };
  addReadiness(table);
  return table;
}

// A people table that carries competence and training counts (the compliance pages) gets one plain column that says where each person stands.
function addReadiness(t: Table) {
  const has = (k: string) => t.columns.some(c => c.key === k);
  if (!has("competence.expired") || !has("training.expired")) return;
  const n = (r: Record<string, any>, k: string) => (typeof r[k] === "number" ? r[k] : 0);
  for (const r of t.rows) {
    const gaps = n(r, "competence.expired") + n(r, "competence.missing") + n(r, "training.expired") + n(r, "training.missing");
    const soon = n(r, "competence.expiring30") + n(r, "training.expiring30");
    r["__readiness"] = r["onLeave"] === true ? "On leave" : gaps > 0 ? "Not ready" : soon > 0 ? "Expiring soon" : "Ready";
  }
  const at = Math.min(t.columns.length, Math.max(1, t.columns.findIndex(c => /job ?role/i.test(c.label)) + 1 || 1));
  t.columns.splice(at, 0, { key: "__readiness", label: "Readiness", type: "text" });
}

// find tables inside a response: the response itself if it is a list, or any lists of records inside it; the single numbers become a "figures" table
export function toTables(url: string, json: unknown, startIndex: number): Table[] {
  const base = nameFromUrl(url);
  const kind: TableKind = LOOKUP.test(url) ? "reference" : "data";
  const out: Table[] = [];
  const add = (t: Table | null) => { if (t) out.push(t); };
  const isRecords = (v: any) => Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x === "object" && !Array.isArray(x));
  if (isRecords(json)) { add(buildTable(url, base, kind, json as any[], `t${startIndex + out.length}`)); return out; }
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const figures: Array<Record<string, any>> = [];
    const walk = (obj: any, path: string[], depth: number) => {
      for (const [k, v] of Object.entries(obj)) {
        if (SECRET.test(k)) continue;
        const p = [...path, k];
        if (isRecords(v)) add(buildTable(url, path.length || out.length ? `${base}: ${humanise(p.join(" "))}` : humanise(k), kind, v as any[], `t${startIndex + out.length}`));
        else if (v && typeof v === "object" && !Array.isArray(v)) { if (depth < 3) walk(v, p, depth + 1); }
        else if (v !== null && v !== undefined && !Array.isArray(v) && !isIdKey(k) && !BORING.test(k)) figures.push({ measure: humanise(p.slice(-2).join(" ")), value: v });
      }
    };
    walk(json as any, [], 0);
    if (figures.length) {
      const t = buildTable(url, `${base}: Figures`, "figures", figures, `t${startIndex + out.length}`);
      if (t) { t.columns = [{ key: "measure", label: "Measure", type: "text" }, { key: "value", label: "Value", type: "text" }]; out.unshift(t); }
    }
  }
  return out;
}

export async function gather(base: string, urls: string[], headers: Record<string, string>): Promise<Table[]> {
  const results = await Promise.all(urls.map(async u => ({ u, json: await fetchJson(base, u, headers) })));
  const tables: Table[] = [];
  for (const { u, json } of results) if (json !== null && json !== undefined) tables.push(...toTables(u, json, tables.length + 1));
  // sheet names must be unique and the first words should say what is inside
  const seen = new Map<string, number>();
  for (const t of tables) { const n = (seen.get(t.name) ?? 0) + 1; seen.set(t.name, n); if (n > 1) t.name = `${t.name} (${n})`; }
  return tables;
}

export const pageFilters = (urls: string[]): string[] => {
  const out: string[] = [];
  for (const u of urls) {
    const q = u.split("?")[1]; if (!q) continue;
    new URLSearchParams(q).forEach((v, k) => { if (v && !/^(limit|offset|page)$/.test(k)) out.push(`${humanise(k)}: ${v}`); });
  }
  return Array.from(new Set(out));
};
