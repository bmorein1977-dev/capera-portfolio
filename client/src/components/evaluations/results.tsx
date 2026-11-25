// The pieces the results screens are drawn from, and the shapes the server sends.
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Eye, HelpCircle } from "lucide-react";
import type { Summary, Verdict, VerdictKey, Share } from "../../../../server/services/trainingEvaluationAnalysis";
import { BARRIER_OPTIONS, LEVEL_OPTIONS, LENGTH_OPTIONS, SUITABLE_OPTIONS, USED_OPTIONS, EXPECT_USE_OPTIONS, type Option } from "@shared/trainingEvaluation";

export type { Summary, Verdict, Share };
export interface Group { key: string; label: string; summary: Summary; verdict: Verdict }

const VERDICT: Record<VerdictKey, { icon: typeof Eye; className: string }> = {
  review: { icon: AlertTriangle, className: "border-red-600/50 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" },
  watch: { icon: Eye, className: "border-amber-600/50 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  suitable: { icon: CheckCircle2, className: "border-green-600/50 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" },
  too_few: { icon: HelpCircle, className: "text-muted-foreground" },
};
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict.key];
  const Icon = v.icon;
  return <Badge variant="outline" className={`gap-1 whitespace-nowrap ${v.className}`}><Icon className="h-3.5 w-3.5" aria-hidden />{verdict.label}</Badge>;
}

export const score = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n.toFixed(1));
export const percent = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${n}%`);
export const gain = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${n > 0 ? "+" : ""}${n.toFixed(1)}`);

export function Stat({ label, value, caption, testId }: { label: string; value: string; caption?: string; testId?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4" data-testid={testId}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {caption && <div className="mt-1 text-xs text-muted-foreground">{caption}</div>}
    </div>
  );
}

/** A labelled bar on a fixed scale. One colour: the length carries the value, and the number is written beside it. */
export function Bar({ label, value, max, text, caption }: { label: string; value: number; max: number; text: string; caption?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
      <div className="text-sm">{label}{caption && <span className="text-muted-foreground"> · {caption}</span>}</div>
      <div className="text-sm font-medium tabular-nums">{text}</div>
      <div className="col-span-2 h-2 overflow-hidden rounded-sm bg-muted" role="img" aria-label={`${label}: ${text}`}>
        <div className="h-full rounded-r bg-primary" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
      </div>
    </div>
  );
}

const LISTS = { level: LEVEL_OPTIONS, length: LENGTH_OPTIONS, suitable: SUITABLE_OPTIONS, used: USED_OPTIONS, expectUse: EXPECT_USE_OPTIONS, barriers: BARRIER_OPTIONS } satisfies Record<string, Option[]>;
export function Shares({ title, kind, shares, note }: { title: string; kind: keyof typeof LISTS; shares: Share[]; note?: string }) {
  const options = LISTS[kind];
  // answers with a natural order are shown in it; reasons are shown most common first
  const ordered = kind === "barriers" ? shares : options.map(o => shares.find(s => s.value === o.value) ?? { value: o.value, count: 0, pct: 0 });
  return (
    <div className="space-y-3">
      <div><h3 className="text-sm font-semibold">{title}</h3>{note && <p className="text-xs text-muted-foreground">{note}</p>}</div>
      {shares.length === 0 ? <p className="text-sm text-muted-foreground">No answers yet.</p>
        : ordered.map(s => <Bar key={s.value} label={options.find(o => o.value === s.value)?.label ?? s.value} value={s.pct} max={100} text={`${s.pct}%`} caption={`${s.count}`} />)}
    </div>
  );
}

export function GroupTable({ rows, heading, onOpen }: { rows: Group[]; heading: string; onOpen?: (key: string) => void }) {
  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">Nothing recorded for this yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead><tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-3 font-medium">{heading}</th><th className="py-2 pr-3 font-medium">Rating</th><th className="py-2 pr-3 text-right font-medium">Replies</th>
          <th className="py-2 pr-3 text-right font-medium">Overall /5</th><th className="py-2 pr-3 text-right font-medium">Met job need</th><th className="py-2 pr-3 text-right font-medium">Confidence gain</th><th className="py-2 text-right font-medium">Used at work</th>
        </tr></thead>
        <tbody>
          {rows.map(g => (
            <tr key={g.key} className="border-b align-top last:border-0">
              <td className="py-2 pr-3">{onOpen ? <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => onOpen(g.key)}>{g.label}</button> : g.label}</td>
              <td className="py-2 pr-3"><VerdictBadge verdict={g.verdict} /></td>
              <td className="py-2 pr-3 text-right tabular-nums">{g.summary.replies} of {g.summary.asked}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{score(g.summary.overall)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{percent(g.summary.suitablePct)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{gain(g.summary.confidenceGain)}</td>
              <td className="py-2 text-right tabular-nums">{percent(g.summary.followUp.usedPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
