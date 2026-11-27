// The infographic. The numbers are ours: they are counted here from the tables, in code. The AI is asked only to choose what is worth showing and to write
// the words, and it can refer to numbers only by a reference we gave it ("{{share:t1.c3.Expired}}"), which we then fill in. A sentence with any other
// number in it is thrown away. What leaves the building for the AI is counts and category names (statuses, roles, sites), never a person's name, email,
// number or any free text. Without an AI key, or if the AI fails, the infographic is built by rules from the same figures, so it always works.
import Anthropic from "@anthropic-ai/sdk";
import type { Table } from "./reportData";
import { aiEnabled } from "./aiPolicy";

const MODEL = "claude-opus-4-8";

export interface Figure { label: string; value: string; detail?: string; tone: Tone }
export type Tone = "good" | "watch" | "risk" | "info";
export interface Chart { id: string; title: string; kind: "donut" | "bar" | "column"; insight?: string; data: Array<{ label: string; value: number; tone?: Tone }> }
export interface Infographic {
  title: string; subtitle: string; generatedAt: string; preparedFor: string; aiUsed: boolean; keyFigures: Figure[]; charts: Chart[];
  insights: Array<{ title: string; text: string; tone: Tone }>; nextSteps: string[]; footnote: string;
}

// ------------------------------------------------------------------------------------------------------------ what a column is
// Only text columns whose heading is on this list are ever counted by category, so only their values can appear in a summary, a summary
// email or the request to the AI service. A heading that is not listed is left out. This is deliberately a list of what is allowed, not of
// what is blocked: a new column that names people cannot slip through because nobody thought to block it.
const CATEGORY_HEADINGS = new Set([
  "action", "area", "category", "company", "contractor company", "contract company", "competence", "competence element", "course", "criticality",
  "decision", "delivery method", "department", "business unit", "duty to operate", "element", "element code", "standard", "employment", "employment type",
  "funding", "how it was recorded", "job family", "job role", "job role name", "location", "measure", "method", "month", "month attended",
  "period", "priority", "provider", "quarter", "readiness", "review cycle", "review period", "role", "secondary role", "their role", "site",
  "site or area", "stage", "statement", "team or shift", "training", "type", "type of record", "venue", "what was declared", "year", "your part",
]);
const CATEGORY_ENDINGS = /(status|outcome|result|rating|compliance|category|type|stage|level|verdict|severity)$/i;
export const isCategoryHeading = (label: string) => { const l = label.trim().toLowerCase(); return CATEGORY_HEADINGS.has(l) || CATEGORY_ENDINGS.test(l); };
const STATUSISH = /(status|outcome|state|result|rating|compliance|ready|verdict)/i;
const BAD = /(expired|missing|overdue|not yet competent|not ready|failed|rejected|short|declined|revoked|critical|no$)/i;
const WATCH = /(expiring|pending|due|in progress|at risk|waiting|planned|watch|partial)/i;
const GOOD = /(current|competent|ready|verified|completed|approved|met|yes|signed off|active|good|compliant)/i;
const DATEWINDOW = /(expir|due|renew|valid|until|review|next|deadline|lapse)/i;

const toneOf = (label: string): Tone => (BAD.test(label) ? "risk" : WATCH.test(label) ? "watch" : GOOD.test(label) ? "good" : "info");
const fmtInt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-GB") : n.toLocaleString("en-GB", { maximumFractionDigits: 1 }));
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

interface ColProfile { ref: string; label: string; yesNo?: boolean; counts?: Array<{ label: string; value: number }>; windows?: Record<string, number>; bands?: Record<string, number>; timeline?: Array<{ label: string; value: number }>; numeric?: { sum: number; avg: number; min: number; max: number } }
interface TableProfile { ref: string; name: string; rows: number; truncated: boolean; columns: ColProfile[]; kind: string; primary?: boolean }

export type { TableProfile };
export function profileTables(tables: Table[], now = new Date()): TableProfile[] {
  const out: TableProfile[] = [];
  tables.filter(t => t.kind === "data" && t.rows.length > 0 && !t.skipCharts).forEach(t => {
    const cols: ColProfile[] = [];
    t.columns.forEach((c, ci) => {
      const ref = `${t.id}.c${ci}`;
      const values = t.rows.map(r => r[c.key]).filter(v => v !== null && v !== undefined && v !== "");
      if (!values.length) return;
      if (c.free) return;
      if (c.type === "text") {
        if (!isCategoryHeading(c.label)) return;
        if (values.some(v => typeof v === "string" && (v.includes("@") || v.length > 60 || /^[0-9a-f-]{16,}$/i.test(v) || /^\d{4}-\d{2}-\d{2}/.test(v)))) return;
        const m = new Map<string, number>(); for (const v of values) m.set(String(v), (m.get(String(v)) ?? 0) + 1);
        if (m.size >= 2 && m.size <= 12) cols.push({ ref, label: c.label, counts: Array.from(m.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) });
      } else if (c.type === "boolean") {
        const yes = values.filter(Boolean).length; cols.push({ ref, label: c.label, yesNo: true, counts: [{ label: "Yes", value: yes }, { label: "No", value: values.length - yes }].filter(x => x.value > 0) });
      } else if (c.type === "number" || c.type === "percent") {
        const nums = values.filter(v => typeof v === "number") as number[]; if (!nums.length) return;
        const sum = nums.reduce((a, b) => a + b, 0); const col: ColProfile = { ref, label: c.label, numeric: { sum, avg: sum / nums.length, min: Math.min(...nums), max: Math.max(...nums) } };
        if (c.type === "percent" || /(percentage|percent)$/i.test(c.key)) {
          const bands: Record<string, number> = { "Below 50%": 0, "50 to 74%": 0, "75 to 89%": 0, "90% and above": 0 };
          for (const v of nums) bands[v < 50 ? "Below 50%" : v < 75 ? "50 to 74%" : v < 90 ? "75 to 89%" : "90% and above"]++;
          if (nums.length >= 3) col.bands = bands;
        }
        cols.push(col);
      } else if (c.type === "date") {
        const ds = values.map(v => new Date(v as string)).filter(d => !Number.isNaN(d.getTime()));
        if (!ds.length) return;
        if (DATEWINDOW.test(c.label)) {
          const day = 86400000; const w: Record<string, number> = { "Already past": 0, "Next 30 days": 0, "31 to 60 days": 0, "61 to 90 days": 0, "Later": 0 };
          for (const d of ds) { const n = Math.ceil((d.getTime() - now.getTime()) / day); w[n < 0 ? "Already past" : n <= 30 ? "Next 30 days" : n <= 60 ? "31 to 60 days" : n <= 90 ? "61 to 90 days" : "Later"]++; }
          cols.push({ ref, label: c.label, windows: w });
        } else {
          const m = new Map<string, number>(); for (const d of ds) { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; m.set(k, (m.get(k) ?? 0) + 1); }
          const keys = Array.from(m.keys()).sort();
          if (keys.length >= 2 && keys.length <= 24) cols.push({ ref, label: c.label, timeline: keys.map(k => ({ label: new Date(k + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), value: m.get(k)! })) });
        }
      }
    });
    out.push({ ref: t.id, name: t.name, rows: t.rows.length, truncated: t.truncated, columns: cols, kind: t.kind, primary: t.primary });
  });
  return out;
}

// ------------------------------------------------------------------------------------------------------------ references
function lookup(profile: TableProfile[], ref: string): { kind: string; table: TableProfile; col?: ColProfile; arg?: string } | null {
  const colon = ref.indexOf(":"); if (colon < 1) return null;
  const kind = ref.slice(0, colon), rest = ref.slice(colon + 1); if (!rest) return null;
  const [path, ...argParts] = rest.split("."); // t1.c3.Expired => path "t1", then "c3", then the label
  const tRef = path; const cRef = argParts[0]; const arg = argParts.slice(1).join(".");
  const table = profile.find(t => t.ref === tRef); if (!table) return null;
  if (kind === "rows") return { kind, table };
  const col = table.columns.find(c => c.ref === `${tRef}.${cRef}`); if (!col) return null;
  return { kind, table, col, arg };
}
export function valueOf(profile: TableProfile[], ref: string): { text: string; num: number } | null {
  const r = lookup(profile, ref); if (!r) return null;
  if (r.kind === "rows") return { text: fmtInt(r.table.rows), num: r.table.rows };
  const c = r.col!;
  if (r.kind === "count" && c.counts) { const x = c.counts.find(k => k.label === r.arg); return x ? { text: fmtInt(x.value), num: x.value } : null; }
  if (r.kind === "share" && c.counts) { const total = c.counts.reduce((a, b) => a + b.value, 0); const x = c.counts.find(k => k.label === r.arg); return x ? { text: `${pct(x.value, total)}%`, num: pct(x.value, total) } : null; }
  if (r.kind === "win" && c.windows) { const v = c.windows[r.arg!]; return v === undefined ? null : { text: fmtInt(v), num: v }; }
  if (r.kind === "band" && c.bands) { const v = c.bands[r.arg!]; return v === undefined ? null : { text: fmtInt(v), num: v }; }
  if (c.numeric && ["sum", "avg", "min", "max"].includes(r.kind)) { const v = (c.numeric as any)[r.kind] as number; return { text: fmtInt(Math.round(v * 10) / 10), num: v }; }
  return null;
}
function seriesOf(profile: TableProfile[], ref: string): Chart["data"] | null {
  const r = lookup(profile, ref); if (!r || !r.col) return null;
  if (r.kind === "counts" && r.col.counts) return r.col.counts.slice(0, 10).map(x => ({ label: x.label, value: x.value, tone: STATUSISH.test(r.col!.label) ? toneOf(x.label) : undefined }));
  if (r.kind === "windows" && r.col.windows) return Object.entries(r.col.windows).map(([label, value]) => ({ label, value, tone: label === "Already past" ? "risk" : label === "Next 30 days" ? "watch" : undefined }));
  if (r.kind === "bands" && r.col.bands) return Object.entries(r.col.bands).map(([label, value]) => ({ label, value, tone: label === "Below 50%" ? "risk" : label === "50 to 74%" ? "watch" : label === "90% and above" ? "good" : undefined }));
  if (r.kind === "timeline" && r.col.timeline) return r.col.timeline;
  return null;
}

// ------------------------------------------------------------------------------------------------------------ the rule-based version
export function buildByRules(profile: TableProfile[], title: string, preparedFor: string, now = new Date(), figureTables: Table[] = []): Infographic {
  // the table that matches the page's own name comes first, then the biggest
  const words = title.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4);
  const relevant = (t: TableProfile) => (words.some(w => t.name.toLowerCase().includes(w)) ? 1 : 0);
  const ranked = [...profile].sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0) || relevant(b) - relevant(a) || b.rows - a.rows);
  const main = ranked[0];
  const figures: Figure[] = [], insights: Infographic["insights"] = [], next: string[] = [];
  const empty = { title, generatedAt: now.toISOString(), preparedFor, aiUsed: false, footnote: "" };
  if (!main) return { ...empty, subtitle: "There is no data on this page to report on.", keyFigures: [], charts: [], insights: [], nextSteps: [] };

  // what is written about the data comes from the main table only; the others can add charts, not commentary
  const note = (t: TableProfile, i: Infographic["insights"][number]) => { if (t === main) insights.push(i); };
  const nextStep = (t: TableProfile, s: string) => { if (t === main) next.push(s); };
  const short = (n: string) => (n.includes(": ") ? n.split(": ").pop()! : n);

  // candidate charts, each with a priority: what a manager looks at first goes first
  type Cand = { prio: number; chart: Chart };
  const cands: Cand[] = [];
  for (const t of ranked.slice(0, 2)) {
    for (const c of t.columns) {
      if (c.yesNo) continue; // yes / no flags are not a story on their own
      if (c.counts && c.counts.length >= 2) {
        const total = c.counts.reduce((a, b) => a + b.value, 0);
        const statusLike = STATUSISH.test(c.label) || c.counts.some(x => BAD.test(x.label) || GOOD.test(x.label));
        cands.push({ prio: (statusLike ? 1 : 5) + (t === main ? 0 : 10), chart: { id: c.ref, title: t === main ? c.label : `${c.label} (${t.name})`, kind: statusLike && c.counts.length <= 6 ? "donut" : "bar", data: c.counts.slice(0, 10).map(x => ({ label: x.label, value: x.value, tone: statusLike ? toneOf(x.label) : undefined })) } });
        if (statusLike) {
          const bad = c.counts.filter(x => toneOf(x.label) === "risk"), badN = bad.reduce((a, b) => a + b.value, 0);
          if (badN > 0) {
            const share = pct(badN, total);
            note(t, { title: `${c.label}: needs attention`, text: `${fmtInt(badN)} of ${fmtInt(total)} (${share}%) are ${bad.map(b => b.label.toLowerCase()).join(" or ")}.`, tone: share >= 20 ? "risk" : "watch" });
            nextStep(t, `Start with the ${fmtInt(badN)} marked ${bad[0].label.toLowerCase()}${bad.length > 1 ? " or similar" : ""}.`);
          } else if (c.counts.some(x => toneOf(x.label) === "good") && c.counts.length) {
            const good = c.counts.filter(x => toneOf(x.label) === "good").reduce((a, b) => a + b.value, 0);
            if (good === total && total > 0) note(t, { title: `${c.label}: all clear`, text: `All ${fmtInt(total)} are in good standing.`, tone: "good" });
          }
          const watch = c.counts.filter(x => toneOf(x.label) === "watch").reduce((a, b) => a + b.value, 0);
          if (watch > 0) note(t, { title: `${c.label}: coming up`, text: `${fmtInt(watch)} are ${c.counts.filter(x => toneOf(x.label) === "watch").map(x => x.label.toLowerCase()).join(" or ")}.`, tone: "watch" });
          if (figures.length < 4 && t === main) for (const x of c.counts.slice(0, 2)) if (figures.length < 4) figures.push({ label: x.label, value: fmtInt(x.value), detail: `${pct(x.value, total)}% of ${c.label.toLowerCase()}`, tone: toneOf(x.label) });
        }
      } else if (c.bands) {
        const low = c.bands["Below 50%"] + c.bands["50 to 74%"], n = Object.values(c.bands).reduce((a, b) => a + b, 0);
        cands.push({ prio: 2 + (t === main ? 0 : 10), chart: { id: c.ref, title: `${c.label}, by band`, kind: "column", data: Object.entries(c.bands).map(([label, value]) => ({ label, value, tone: label === "Below 50%" ? "risk" : label === "50 to 74%" ? "watch" : label === "90% and above" ? "good" : undefined })) } });
        if (low > 0) note(t, { title: `${c.label}: below 75%`, text: `${fmtInt(low)} of ${fmtInt(n)} (${pct(low, n)}%) are below 75%.`, tone: pct(low, n) >= 30 ? "risk" : "watch" });
        if (c.numeric && figures.length < 5 && t === main) figures.push({ label: `Average ${c.label.toLowerCase()}`, value: `${Math.round(c.numeric.avg)}%`, tone: c.numeric.avg >= 90 ? "good" : c.numeric.avg >= 75 ? "watch" : "risk" });
      } else if (c.windows) {
        cands.push({ prio: 3 + (t === main ? 0 : 10), chart: { id: c.ref, title: c.label, kind: "column", data: Object.entries(c.windows).map(([label, value]) => ({ label, value, tone: label === "Already past" ? "risk" : label === "Next 30 days" ? "watch" : undefined })) } });
        if (c.windows["Already past"] > 0) { note(t, { title: `${c.label}: already past`, text: `${fmtInt(c.windows["Already past"])} have already passed.`, tone: "risk" }); nextStep(t, `Deal with the ${fmtInt(c.windows["Already past"])} that have already passed.`); }
        if (c.windows["Next 30 days"] > 0) note(t, { title: `${c.label}: coming up`, text: `${fmtInt(c.windows["Next 30 days"])} fall within the next 30 days.`, tone: "watch" });
      } else if (c.timeline) {
        cands.push({ prio: 6 + (t === main ? 0 : 10), chart: { id: c.ref, title: `${c.label}, by month`, kind: "column", data: c.timeline } });
      }
    }
  }
  // the page's own headline figures: the percentages and counts it already works out
  for (const ft of figureTables) {
    for (const r of ft.rows) {
      if (figures.length >= 6) break;
      const v = r.value; if (typeof v !== "number" || /^(generated|filters|total matched)/i.test(String(r.measure))) continue;
      const isPct = /percent|percentage|coverage|rate/i.test(String(r.measure));
      figures.push({ label: String(r.measure), value: isPct ? `${Math.round(v)}%` : fmtInt(v), tone: isPct ? (v >= 90 ? "good" : v >= 75 ? "watch" : "risk") : "info" });
    }
  }
  figures.unshift({ label: short(main.name), value: fmtInt(main.rows), detail: "records on this page", tone: "info" });
  if (main.truncated) insights.push({ title: "Large data set", text: "The page returned more than 50,000 records; the figures use the first 50,000.", tone: "watch" });
  const charts = cands.sort((a, b) => a.prio - b.prio).map(c => c.chart).filter((c, i, all) => all.findIndex(x => x.title === c.title) === i).slice(0, 6);
  const order = { risk: 0, watch: 1, good: 2, info: 3 } as const;
  return {
    ...empty, subtitle: `${fmtInt(main.rows)} record${main.rows === 1 ? "" : "s"} in ${short(main.name)}`,
    keyFigures: figures.slice(0, 6), charts, insights: insights.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 5), nextSteps: Array.from(new Set(next)).slice(0, 4),
  };
}

// ------------------------------------------------------------------------------------------------------------ the AI version
export const aiAvailable = () => !!process.env.ANTHROPIC_API_KEY && aiEnabled("reports");

async function peopleNames(): Promise<string[]> {
  const { db } = await import("../db");
  const { users } = await import("@shared/schema");
  const rows = await db.select({ f: users.firstName, l: users.lastName }).from(users);
  return rows.map(r => `${r.f ?? ""} ${r.l ?? ""}`.trim()).filter(n => n.includes(" "));
}

const SYSTEM = `You write the content of a one-page management infographic from counted figures. You never see names of people. You are given a list of tables, each with reference ids for the figures counted from it, and a rule-based draft.
Return ONLY a JSON object: {"headline": string, "subtitle": string, "keyFigures": [{"label": string, "ref": string}], "charts": [{"ref": string, "title": string, "kind": "donut"|"bar"|"column"}], "insights": [{"title": string, "text": string, "tone": "good"|"watch"|"risk"|"info"}], "nextSteps": [string]}.
Rules: use at most 6 key figures, 6 charts, 5 insights and 4 next steps. A key figure's ref must be a "rows:", "count:", "share:", "win:", "sum:", "avg:", "min:" or "max:" reference taken from the data. A chart's ref must be a "counts:", "windows:" or "timeline:" reference taken from the data. In insight and next step text you must not write any digits at all: where a number belongs, write a reference in double braces, for example {{share:t1.c2.Expired}} or {{count:t1.c2.Expired}} or {{rows:t1}}, copied exactly from the data. Write in plain, direct language for a busy executive: what matters, what is at risk, what to do first. Be specific to this data. Do not invent anything that is not in the data.`;

function compact(profile: TableProfile[]) {
  return profile.slice(0, 5).map(t => ({
    table: t.ref, name: t.name, rows: `rows:${t.ref}`, columns: t.columns.slice(0, 14).map(c => ({
      column: c.ref, label: c.label,
      counts: c.counts ? { ref: `counts:${c.ref}`, values: c.counts.map(x => ({ label: x.label, count: x.value, countRef: `count:${c.ref}.${x.label}`, shareRef: `share:${c.ref}.${x.label}` })) } : undefined,
      windows: c.windows ? { ref: `windows:${c.ref}`, values: Object.entries(c.windows).map(([label, v]) => ({ label, count: v, ref: `win:${c.ref}.${label}` })) } : undefined,
      timeline: c.timeline ? { ref: `timeline:${c.ref}`, months: c.timeline.length } : undefined,
      numeric: c.numeric ? { sumRef: `sum:${c.ref}`, avgRef: `avg:${c.ref}`, minRef: `min:${c.ref}`, maxRef: `max:${c.ref}`, avg: Math.round(c.numeric.avg * 10) / 10 } : undefined,
    })),
  }));
}

// a sentence is allowed only if, once the references are taken out, no digits are left
export const cleanText = (profile: TableProfile[], text: unknown): string | null => {
  if (typeof text !== "string" || !text.trim() || text.length > 400) return null;
  if (/\d/.test(text.replace(/\{\{[^}]+\}\}/g, ""))) return null;
  let bad = false;
  const filled = text.replace(/\{\{([^}]+)\}\}/g, (_m, ref) => { const v = valueOf(profile, String(ref).trim()); if (!v) { bad = true; return ""; } return v.text; });
  return bad ? null : filled.trim();
};

// A second safeguard behind the heading list: if any person's name appears anywhere in what would be sent, nothing is sent.
export function mentionsAPerson(payload: string, names: string[]): boolean {
  const text = payload.toLowerCase();
  return names.some(n => { const name = n.trim().toLowerCase(); return name.includes(" ") && name.length >= 5 && text.includes(name); });
}

export async function refineWithAi(profile: TableProfile[], draft: Infographic, now = new Date(), clientOverride?: { messages: { create: (args: any) => Promise<any> } }, peopleNames: string[] = []): Promise<Infographic | null> {
  if ((!clientOverride && !aiAvailable()) || !profile.length) return null;
  try {
    const content = JSON.stringify({ page: draft.title, today: now.toISOString().slice(0, 10), tables: compact(profile), draft: { keyFigures: draft.keyFigures.map(f => f.label), charts: draft.charts.map(c => c.title), insights: draft.insights.map(i => i.title) } });
    if (mentionsAPerson(content, peopleNames)) { console.warn("[AI report] a person's name was found in the figures, so nothing was sent to the AI service"); return null; }
    const client = clientOverride ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
    const res = await client.messages.create({
      model: MODEL, max_tokens: 2500, system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const raw = res.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));

    const figures: Figure[] = [];
    for (const f of Array.isArray(j.keyFigures) ? j.keyFigures.slice(0, 6) : []) {
      const v = typeof f?.ref === "string" ? valueOf(profile, f.ref) : null;
      if (v && typeof f.label === "string" && f.label.length < 60 && !/\d/.test(f.label)) figures.push({ label: f.label, value: /^share:/.test(f.ref) ? v.text : v.text, tone: /^(share|count):/.test(f.ref) ? toneOf(f.ref.split(".").pop() ?? "") : "info" });
    }
    const charts: Chart[] = [];
    for (const c of Array.isArray(j.charts) ? j.charts.slice(0, 6) : []) {
      const data = typeof c?.ref === "string" ? seriesOf(profile, c.ref) : null;
      if (data && data.length && typeof c.title === "string" && c.title.length < 80 && !/\d/.test(c.title)) charts.push({ id: String(c.ref), title: c.title, kind: ["donut", "bar", "column"].includes(c.kind) ? c.kind : "bar", data });
    }
    const insights: Infographic["insights"] = [];
    for (const i of Array.isArray(j.insights) ? j.insights.slice(0, 5) : []) {
      const text = cleanText(profile, i?.text), t = typeof i?.title === "string" && i.title.length < 80 && !/\d/.test(i.title) ? i.title : null;
      if (text && t) insights.push({ title: t, text, tone: ["good", "watch", "risk", "info"].includes(i.tone) ? i.tone : "info" });
    }
    const next = (Array.isArray(j.nextSteps) ? j.nextSteps.slice(0, 4) : []).map((s: unknown) => cleanText(profile, s)).filter((s: string | null): s is string => !!s);
    const headline = typeof j.headline === "string" && j.headline.length < 120 && !/\d/.test(j.headline) ? j.headline : draft.title;
    const sub = cleanText(profile, j.subtitle) ?? draft.subtitle;
    // if the AI gave us too little to work with, keep the rule-based parts for what is missing
    return { ...draft, title: headline, subtitle: sub, aiUsed: true, keyFigures: figures.length >= 2 ? figures : draft.keyFigures, charts: charts.length >= 2 ? charts : draft.charts, insights: insights.length ? insights : draft.insights, nextSteps: next.length ? next : draft.nextSteps };
  } catch (e) {
    console.error("AI infographic failed, using the rule-based version:", (e as Error)?.message);
    return null;
  }
}

export async function buildInfographic(tables: Table[], title: string, preparedFor: string, wantAi: boolean): Promise<Infographic> {
  const profile = profileTables(tables);
  const draft = buildByRules(profile, title, preparedFor, new Date(), tables.filter(t => t.kind === "figures"));
  let refined: Infographic | null = null;
  if (wantAi && aiAvailable()) {
    // if the list of names cannot be read, the safeguard cannot work, so the AI step is not used
    const names = await peopleNames().catch(() => null);
    if (names) refined = await refineWithAi(profile, draft, new Date(), undefined, names);
  }
  const out = refined ?? draft;
  out.footnote = refined
    ? "Figures are counted by Capera from the live data. The headline, insights and next steps were drafted by an AI from those counts, with no names or personal details."
    : "Figures are counted by Capera from the live data.";
  return out;
}
