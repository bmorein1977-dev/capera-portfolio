import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertOctagon, AlertTriangle, ArrowRight, Bell, CheckCircle2, ChevronRight, ClipboardCheck, Calendar, GraduationCap, Gauge, Info, LayoutGrid, Megaphone, MapPin, Network, ScrollText,
  ShieldCheck, SlidersHorizontal, Sparkles, Target, TrendingUp, Upload, Users, Workflow, FileCheck, ShieldAlert, type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// The home screen: an infographic briefing for whoever has signed in. The server decides what each kind of person gets (see
// server/services/homeBriefing.ts); this page only draws it. One number leads, a short "needs you" list says what to do next,
// then status meters, split bars and short lists give the picture. Status colours are always paired with an icon and a label.

type Severity = "critical" | "warning" | "good" | "info";
type Tone = "good" | "warning" | "serious" | "critical" | "neutral";
interface PlanAction { kind: "schedule" | "ready"; label: string; assessmentId?: string; candidateId?: string; elementId?: string; current?: string | null; subject: string }
interface PlanRow { primary: string; secondary?: string; tag?: { text: string; tone: Tone }; href?: string; action?: PlanAction }
interface Plan {
  title: string; subtitle: string; href: string; horizonMonths: number;
  stages: Array<{ key: string; label: string; value: number; tone: Tone; hint: string }>;
  timeline: Array<{ label: string; booked: number; due: number }>;
  rows: { id: string; title: string; empty: string; href?: string; rows: PlanRow[] };
}
interface Briefing {
  persona: string; personaLabel: string; name: string; headline: string; generatedAt: string;
  hero: { label: string; value: number; unit: "%" | ""; caption: string; severity: Severity; href?: string } | null;
  plan: Plan | null; horizonOptions: number[];
  attention: Array<{ id: string; label: string; count: number; severity: Severity; href: string; hint?: string }>;
  kpis: Array<{ id: string; label: string; value: number | string; caption?: string; severity?: Severity; href?: string }>;
  meters: Array<{ id: string; label: string; current: number; total: number; pct: number; href?: string; caption?: string }>;
  segments: Array<{ id: string; title: string; subtitle?: string; parts: Array<{ key: string; label: string; value: number; tone: Tone }>; href?: string }>;
  bars: Array<{ id: string; title: string; subtitle?: string; items: Array<{ label: string; value: number; tone: Tone }> }>;
  lists: Array<{ id: string; title: string; empty: string; href?: string; rows: Array<{ primary: string; secondary?: string; tag?: { text: string; tone: Tone }; href?: string }> }>;
  shortcuts: Array<{ label: string; href: string; icon: string }>;
  fullView?: { label: string; href: string }; also: string[];
}

// The fixed status colours (they do not change with the theme) and the brand blue for plain magnitude.
const TONE: Record<Tone, string> = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", neutral: "hsl(var(--primary))" };
const SEVERITY: Record<Severity, { color: string; label: string; Icon: LucideIcon }> = {
  good: { color: TONE.good, label: "On track", Icon: CheckCircle2 }, warning: { color: TONE.warning, label: "Needs attention", Icon: AlertTriangle },
  critical: { color: TONE.critical, label: "Action needed", Icon: AlertOctagon }, info: { color: TONE.neutral, label: "For your information", Icon: Info },
};
const ICONS: Record<string, LucideIcon> = {
  graduation: GraduationCap, assessment: FileCheck, upload: Upload, target: Target, gauge: Gauge, clipboard: ClipboardCheck, map: MapPin, sliders: SlidersHorizontal, shield: ShieldCheck,
  check: CheckCircle2, users: Users, alert: ShieldAlert, network: Workflow, chart: LayoutGrid, megaphone: Megaphone, bell: Bell, scroll: ScrollText, sparkles: Sparkles, calendar: Calendar, trend: TrendingUp, org: Network,
};

const METER_TITLE: Record<string, string> = { worker: "Where you stand", assessor: "Where your candidates stand", verifier: "Assessors against their targets", manager: "Where your team stands", admin: "Where the organisation stands", super_admin: "Where the organisation stands", developer: "Where you stand" };

function greeting(name: string) {
  const h = new Date().getHours();
  return `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${name}`;
}

function SeverityTag({ severity }: { severity: Severity }) {
  const { color, label, Icon } = SEVERITY[severity];
  return <span className="inline-flex items-center gap-1.5 text-sm font-medium"><Icon className="h-4 w-4" style={{ color }} aria-hidden />{label}</span>;
}

// a single ratio against its limit is a meter, not a donut: a thin bar with the figures beside it
function Meter({ m }: { m: Briefing["meters"][number] }) {
  const sev = m.pct >= 90 ? "good" : m.pct >= 75 ? "warning" : "critical";
  const body = (
    <div className="space-y-1.5" data-testid={`meter-${m.id}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{m.label}</span>
        <span className="flex items-center gap-2 tabular-nums"><span className="text-muted-foreground">{m.current} of {m.total}</span>
          <span className="inline-flex items-center gap-1 font-semibold">{(() => { const { Icon, color } = SEVERITY[sev]; return <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden />; })()}{m.pct}%</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${m.label}: ${m.pct}% (${m.current} of ${m.total})`} title={`${m.current} of ${m.total} (${m.pct}%)`}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(m.pct, m.total ? 2 : 0)}%`, background: SEVERITY[sev].color }} />
      </div>
      {m.caption && <p className="text-xs text-muted-foreground">{m.caption}</p>}
    </div>
  );
  return m.href ? <Link href={m.href} className="block rounded-md p-1 -m-1 transition-colors hover:bg-muted/50">{body}</Link> : body;
}

// parts of one whole: a segmented bar with a 2px gap between fills, and a legend that carries the numbers
function Segmented({ s }: { s: Briefing["segments"][number] }) {
  const total = s.parts.reduce((n, p) => n + p.value, 0);
  const body = (
    <div className="space-y-3" data-testid={`segments-${s.id}`}>
      <div><div className="text-sm font-medium">{s.title}</div>{s.subtitle && <div className="text-xs text-muted-foreground">{s.subtitle}</div>}</div>
      {total === 0 ? <div className="h-3 rounded-full bg-muted" /> : (
        <div className="flex h-3 gap-[2px]" role="img" aria-label={`${s.title}: ${s.parts.map(p => `${p.label} ${p.value}`).join(", ")}`}>
          {s.parts.filter(p => p.value > 0).map(p => <div key={p.key} className="h-full min-w-[4px] rounded-[4px]" style={{ flexGrow: p.value, background: TONE[p.tone] }} title={`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`} />)}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {s.parts.map(p => <li key={p.key} className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE[p.tone] }} aria-hidden />{p.label}</span><span className="font-medium tabular-nums">{p.value}</span></li>)}
      </ul>
    </div>
  );
  return s.href ? <Link href={s.href} className="block rounded-md p-1 -m-1 transition-colors hover:bg-muted/50">{body}</Link> : body;
}

function Bars({ b }: { b: Briefing["bars"][number] }) {
  const max = Math.max(1, ...b.items.map(i => i.value));
  return (
    <div className="space-y-3" data-testid={`bars-${b.id}`}>
      <div><div className="text-sm font-medium">{b.title}</div>{b.subtitle && <div className="text-xs text-muted-foreground">{b.subtitle}</div>}</div>
      <ul className="space-y-2">
        {b.items.map(i => (
          <li key={i.label} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-xs" title={`${i.label}: ${i.value}`}>
            <span className="truncate text-muted-foreground">{i.label}</span>
            <span className="h-2.5 overflow-hidden rounded-[4px] bg-muted"><span className="block h-full rounded-[4px]" style={{ width: `${(i.value / max) * 100}%`, minWidth: i.value ? 4 : 0, background: TONE[i.tone] }} /></span>
            <span className="text-right font-medium tabular-nums">{i.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({ title, href, children, testId }: { title?: string; href?: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm" data-testid={testId}>
      {title && <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">{title}</h2>{href && <Link href={href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">View all</Link>}</div>}
      {children}
    </section>
  );
}

const HORIZON_KEY = "capera.planHorizon";
const horizonLabel = (m: number) => (m === 0 ? "All" : m < 12 ? `${m} mo` : `${m / 12} yr`);
const horizonWords = (m: number) => (m === 0 ? "No limit" : m < 12 ? `${m} months` : m === 12 ? "1 year" : `${m / 12} years`);
const toLocalInput = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

// month by month from now to the last month that has anything in it: booked against due-and-not-yet-planned
function Timeline({ t }: { t: Plan["timeline"] }) {
  const max = Math.max(1, ...t.flatMap(c => [c.booked, c.due]));
  return (
    <div data-testid="plan-timeline">
      <div className="overflow-x-auto pb-1">
        <ul className="flex min-w-full items-end gap-[6px]" style={{ height: 120 }} role="list">
          {t.map(c => {
            const expired = c.label === "Already expired";
            return (
              <li key={c.label} className="flex h-full min-w-[2.75rem] flex-1 flex-col justify-end gap-1" title={`${c.label}: ${c.booked} booked, ${c.due} ${expired ? "expired" : "due"} with nothing planned`} data-testid={`plan-month-${c.label.replace(/\s+/g, "-").toLowerCase()}`}>
                <div className="flex flex-1 items-end justify-center gap-[2px]">
                  {c.booked > 0 && <div className="flex w-3 flex-col items-center justify-end" style={{ height: `${(c.booked / max) * 100}%` }}><span className="mb-0.5 text-[10px] font-medium tabular-nums leading-none">{c.booked}</span><div className="w-full flex-1 rounded-t-[4px]" style={{ background: TONE.neutral }} /></div>}
                  {c.due > 0 && <div className="flex w-3 flex-col items-center justify-end" style={{ height: `${(c.due / max) * 100}%` }}><span className="mb-0.5 text-[10px] font-medium tabular-nums leading-none">{c.due}</span><div className="w-full flex-1 rounded-t-[4px]" style={{ background: expired ? TONE.critical : TONE.serious }} /></div>}
                  {c.booked === 0 && c.due === 0 && <div className="h-[2px] w-3 rounded bg-muted" />}
                </div>
                <div className="border-t pt-1 text-center text-[10px] leading-tight text-muted-foreground">{expired ? "Expired" : c.label}</div>
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE.neutral }} aria-hidden />Booked</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE.serious }} aria-hidden />Due, nothing planned</li>
        {t.some(c => c.label === "Already expired") && <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE.critical }} aria-hidden />Already expired</li>}
      </ul>
    </div>
  );
}

// the date-setting dialog: any date from today onwards, with a place and a note for the candidate
function ScheduleDialog({ action, onClose, onDone }: { action: PlanAction | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [when, setWhen] = useState(""); const [place, setPlace] = useState(""); const [notes, setNotes] = useState("");
  const [seen, setSeen] = useState<PlanAction | null>(null);
  if (action !== seen) { setSeen(action); setWhen(toLocalInput(action?.current)); setPlace(""); setNotes(""); }
  const save = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/assessments/plan", { candidateId: action!.candidateId, elementId: action!.elementId, plannedAt: new Date(when).toISOString(), location: place, notes }); return res.json(); },
    onSuccess: () => { toast({ title: "Date set", description: "The candidate has been emailed." }); onDone(); onClose(); },
    onError: (e: any) => toast({ title: "That date could not be set", description: String(e?.message ?? "").replace(/^\d+:\s*/, "").replace(/^\{"error":"(.*)"\}$/, "$1") || "Please try again.", variant: "destructive" }),
  });
  const minValue = toLocalInput(new Date().toISOString());
  return (
    <Dialog open={!!action} onOpenChange={o => !o && onClose()}>
      <DialogContent data-testid="dialog-plan-date">
        <DialogHeader><DialogTitle>{action?.current ? "Change the date" : "Set a date"}</DialogTitle><DialogDescription>{action?.subject}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="plan-when">Date and time</Label><Input id="plan-when" type="datetime-local" min={minValue} value={when} onChange={e => setWhen(e.target.value)} data-testid="input-plan-when" /></div>
          <div className="space-y-1.5"><Label htmlFor="plan-place">Where (optional)</Label><Input id="plan-place" value={place} maxLength={200} onChange={e => setPlace(e.target.value)} data-testid="input-plan-place" /></div>
          <div className="space-y-1.5"><Label htmlFor="plan-notes">Note for the candidate (optional)</Label><Textarea id="plan-notes" value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} data-testid="input-plan-notes" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!when || save.isPending} onClick={() => save.mutate()} data-testid="button-plan-save">{save.isPending ? "Saving…" : "Save and email candidate"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanPanel({ plan, options, horizon, setHorizon, refresh }: { plan: Plan; options: number[]; horizon: number; setHorizon: (h: number) => void; refresh: () => void }) {
  const { toast } = useToast();
  const [dialog, setDialog] = useState<PlanAction | null>(null);
  const ready = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/assessments/${id}/mark-ready`)).json(),
    onSuccess: () => { toast({ title: "Your assessor has been told you are ready" }); refresh(); },
    onError: () => toast({ title: "Could not update that", description: "Please try again.", variant: "destructive" }),
  });
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm" data-testid="panel-plan">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold">{plan.title}</h2><p className="text-xs text-muted-foreground">{plan.subtitle}</p></div>
        <div className="flex w-full flex-col gap-1.5 text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-2" role="group" aria-label="How far ahead to look">
          <span>Look ahead</span>
          <div className="grid w-full grid-cols-6 overflow-hidden rounded-md border sm:flex sm:w-auto">
            {options.map(o => <button key={o} type="button" onClick={() => setHorizon(o)} aria-pressed={o === horizon} aria-label={horizonWords(o)} title={horizonWords(o)} className={`px-2.5 py-1.5 font-medium transition-colors sm:py-1 ${o === horizon ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} data-testid={`horizon-${o}`}>{horizonLabel(o)}</button>)}
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="plan-stages">
        {plan.stages.map(st => (
          <li key={st.key} className="rounded-lg border p-3" data-testid={`plan-stage-${st.key}`} title={st.hint}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: TONE[st.tone] }} aria-hidden />{st.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums" data-testid={`plan-stage-value-${st.key}`}>{st.value}</div>
          </li>
        ))}
      </ul>

      <div className="mt-5"><Timeline t={plan.timeline} /></div>

      <div className="mt-5">
        <h3 className="mb-1 text-sm font-semibold">{plan.rows.title}</h3>
        {plan.rows.rows.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{plan.rows.empty}</p> : (
          <ul className="divide-y" data-testid="plan-rows">
            {plan.rows.rows.map((r, i) => (
              <li key={i} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5">
                <div className="min-w-0"><div className="text-sm font-medium sm:truncate">{r.primary}</div>{r.secondary && <div className="text-xs text-muted-foreground sm:truncate">{r.secondary}</div>}</div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  {r.tag && <span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className="h-2 w-2 rounded-full" style={{ background: TONE[r.tag.tone] }} aria-hidden />{r.tag.text}</span>}
                  {r.action?.kind === "schedule" && <Button size="sm" variant="outline" onClick={() => setDialog(r.action!)} data-testid={`button-plan-${i}`}>{r.action.label}</Button>}
                  {r.action?.kind === "ready" && <Button size="sm" variant="outline" disabled={ready.isPending} onClick={() => ready.mutate(r.action!.assessmentId!)} data-testid={`button-ready-${i}`}>{r.action.label}</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href={plan.href} className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Open full list<ArrowRight className="h-3 w-3" /></Link>
      </div>
      <ScheduleDialog action={dialog} onClose={() => setDialog(null)} onDone={refresh} />
    </section>
  );
}

export default function BriefingPage() {
  const queryClient = useQueryClient();
  // how far ahead the assessment plan looks is the person's choice, and is remembered on this device
  const [horizon, setHorizonState] = useState<number>(() => { try { const raw = localStorage.getItem(HORIZON_KEY); const v = Number(raw); return raw !== null && Number.isFinite(v) ? v : 12; } catch { return 12; } });
  const setHorizon = (h: number) => { setHorizonState(h); try { localStorage.setItem(HORIZON_KEY, String(h)); } catch { /* not remembered */ } };
  const { data, isLoading, error, refetch } = useQuery<Briefing>({ queryKey: [`/api/home/briefing?horizon=${horizon}`], refetchInterval: 5 * 60 * 1000, placeholderData: prev => prev });
  const refresh = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/home/briefing") });

  if (isLoading) {
    return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8" data-testid="briefing-loading"><Skeleton className="h-10 w-80" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-56" /><Skeleton className="h-56 lg:col-span-2" /></div><div className="grid gap-4 sm:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div></div>;
  }
  if (error || !data) {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center" data-testid="briefing-error"><h1 className="text-xl font-semibold">Your home screen could not load</h1><p className="mt-2 text-muted-foreground">Please try again. If it keeps happening, tell your administrator.</p><Button className="mt-4" onClick={() => refetch()}>Try again</Button></div>;
  }

  const b = data;
  const hero = b.hero;
  const heroSev = hero ? SEVERITY[hero.severity] : null;
  // a manager, assessor or verifier also has a competence record of their own: shown apart from the people they look after
  const ownMeters = b.meters.filter(m => m.id.startsWith("own-"));
  const mainMeters = b.meters.filter(m => !m.id.startsWith("own-"));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8 sm:py-10" data-testid={`briefing-${b.persona}`}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span data-testid="text-persona">{b.personaLabel}</span>{b.also.map(a => <span key={a} className="rounded-full border px-2 py-0.5 normal-case tracking-normal">{a}</span>)}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" data-testid="text-greeting">{greeting(b.name)}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground" data-testid="text-headline">{b.headline}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {hero && heroSev && (
          <Link href={hero.href ?? "#"} className="group flex flex-col justify-between rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md lg:col-span-1" data-testid="hero">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{hero.label}</div>
              <div className="mt-2 flex items-baseline gap-1"><span className="text-6xl font-semibold leading-none tracking-tight" data-testid="text-hero-value">{hero.value}</span>{hero.unit && <span className="text-2xl font-medium text-muted-foreground">{hero.unit}</span>}</div>
              <p className="mt-3 text-sm text-muted-foreground">{hero.caption}</p>
            </div>
            <div className="mt-5 space-y-2">
              {hero.unit === "%" && <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${hero.value}%`}><div className="h-full rounded-full" style={{ width: `${Math.max(hero.value, 2)}%`, background: heroSev.color }} /></div>}
              <div className="flex items-center justify-between"><SeverityTag severity={hero.severity} /><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
            </div>
          </Link>
        )}

        <section className={`rounded-xl border bg-card p-5 shadow-sm ${hero ? "lg:col-span-2" : "lg:col-span-3"}`} data-testid="attention">
          <h2 className="mb-3 text-sm font-semibold">{b.attention.length ? "Needs you" : "All clear"}</h2>
          {b.attention.length === 0 ? (
            <div className="flex items-center gap-3 py-6 text-muted-foreground"><CheckCircle2 className="h-6 w-6" style={{ color: TONE.good }} aria-hidden /><span>Nothing needs your attention right now.</span></div>
          ) : (
            <ul className="divide-y">
              {b.attention.slice(0, 7).map(a => {
                const { Icon, color, label } = SEVERITY[a.severity];
                return (
                  <li key={a.id}>
                    <Link href={a.href} className="group flex items-center gap-3 py-3 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md" data-testid={`attention-${a.id}`}>
                      <Icon className="h-5 w-5 shrink-0" style={{ color }} aria-label={label} />
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{a.label}</div>{a.hint && <div className="truncate text-xs text-muted-foreground">{a.hint}</div>}</div>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums">{a.count}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {b.plan && <PlanPanel plan={b.plan} options={b.horizonOptions} horizon={horizon} setHorizon={setHorizon} refresh={refresh} />}

      {b.kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="kpis">
          {b.kpis.map(k => {
            const sev = k.severity && (k.severity === "warning" || k.severity === "critical") ? SEVERITY[k.severity] : null;
            const tile = (
              <div className="h-full rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md" data-testid={`kpi-${k.id}`}>
                <div className="text-xs font-medium text-muted-foreground">{k.label}</div>
                <div className="mt-1.5 flex items-center gap-2"><span className={`${String(k.value).length > 9 ? "text-lg" : "text-2xl"} font-semibold tracking-tight`}>{k.value}</span>{sev && <sev.Icon className="h-4 w-4" style={{ color: sev.color }} aria-label={sev.label} />}</div>
                {k.caption && <div className="mt-1 truncate text-xs text-muted-foreground">{k.caption}</div>}
              </div>
            );
            return k.href ? <Link key={k.id} href={k.href} className="block">{tile}</Link> : <div key={k.id}>{tile}</div>;
          })}
        </div>
      )}

      {(mainMeters.length > 0 || ownMeters.length > 0 || b.segments.length > 0 || b.bars.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {mainMeters.length > 0 && <Panel title={METER_TITLE[b.persona] ?? "Where you stand"} testId="panel-meters"><div className="space-y-5">{mainMeters.map(m => <Meter key={m.id} m={m} />)}</div></Panel>}
          {ownMeters.length > 0 && <Panel title="Your own record" testId="panel-own"><div className="space-y-5">{ownMeters.map(m => <Meter key={m.id} m={m} />)}</div></Panel>}
          {b.segments.map(s => <Panel key={s.id}><Segmented s={s} /></Panel>)}
          {b.bars.map(x => <Panel key={x.id}><Bars b={x} /></Panel>)}
        </div>
      )}

      {b.lists.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {b.lists.map(l => (
            <Panel key={l.id} title={l.title} href={l.href} testId={`list-${l.id}`}>
              {l.rows.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{l.empty}</p> : (
                <ul className="divide-y">
                  {l.rows.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0"><div className="truncate text-sm font-medium">{r.primary}</div>{r.secondary && <div className="truncate text-xs text-muted-foreground">{r.secondary}</div>}</div>
                      {r.tag && <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium"><span className="h-2 w-2 rounded-full" style={{ background: TONE[r.tag.tone] }} aria-hidden />{r.tag.text}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      )}

      <section aria-label="Shortcuts" data-testid="shortcuts">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Go to</h2>
        <div className="flex flex-wrap gap-3">
          {b.shortcuts.map(s => { const Icon = ICONS[s.icon] ?? ChevronRight; return (
            <Link key={s.href + s.label} href={s.href} className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md" data-testid={`shortcut-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}><Icon className="h-4 w-4 text-primary" aria-hidden />{s.label}</Link>
          ); })}
        </div>
        {b.fullView && <Link href={b.fullView.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline" data-testid="link-full-view">{b.fullView.label}<ArrowRight className="h-4 w-4" /></Link>}
      </section>
    </div>
  );
}
