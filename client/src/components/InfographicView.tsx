import { useRef, useState } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { elementToPngBlob } from "@/lib/domToPng";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Printer, Sparkles } from "lucide-react";

// The infographic, drawn from the figures the server counted. It is always a light page so it reads the same on a screen, on paper and as a picture.

export type Tone = "good" | "watch" | "risk" | "info";
export interface InfographicData {
  title: string; subtitle: string; generatedAt: string; preparedFor: string; aiUsed: boolean;
  keyFigures: Array<{ label: string; value: string; detail?: string; tone: Tone }>;
  charts: Array<{ id: string; title: string; kind: "donut" | "bar" | "column"; insight?: string; data: Array<{ label: string; value: number; tone?: Tone }> }>;
  insights: Array<{ title: string; text: string; tone: Tone }>; nextSteps: string[]; footnote: string;
}

const TONE: Record<Tone, string> = { good: "#15803d", watch: "#d97706", risk: "#dc2626", info: "#1b2230" };
const SERIES = ["#b4532a", "#1b2230", "#4b6a88", "#c9a227", "#6b8e5a", "#8a5a83", "#2f7f79", "#a3a3a3", "#d98a62", "#52606d"];
const colourFor = (d: { tone?: Tone }, i: number) => (d.tone && d.tone !== "info" ? TONE[d.tone] : SERIES[i % SERIES.length]);
const total = (d: Array<{ value: number }>) => d.reduce((a, b) => a + b.value, 0);

function ChartCard({ c }: { c: InfographicData["charts"][number] }) {
  const sum = total(c.data);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4" data-testid={`chart-${c.id}`}>
      <div className="mb-3 text-sm font-semibold text-neutral-900">{c.title}</div>
      {c.kind === "donut" ? (
        <div className="flex items-center gap-4">
          <div className="h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={c.data} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="92%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                {c.data.map((d, i) => <Cell key={i} fill={colourFor(d, i)} />)}</Pie></PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
            {c.data.map((d, i) => (
              <li key={i} className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colourFor(d, i) }} />
                <span className="min-w-0 flex-1 truncate text-neutral-700">{d.label}</span>
                <span className="tabular-nums font-medium text-neutral-900">{d.value.toLocaleString("en-GB")}</span>
                <span className="w-10 text-right tabular-nums text-neutral-500">{sum ? Math.round((d.value / sum) * 100) : 0}%</span></li>
            ))}
          </ul>
        </div>
      ) : c.kind === "column" ? (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={c.data} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#52606d" }} interval={0} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {c.data.map((d, i) => <Cell key={i} fill={colourFor(d, 0)} />)}
                <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "#1b2230", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: Math.max(120, c.data.length * 30 + 10) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={c.data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#374151" }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
                {c.data.map((d, i) => <Cell key={i} fill={colourFor(d, 0)} />)}
                <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "#1b2230", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {c.insight && <p className="mt-3 text-xs text-neutral-600">{c.insight}</p>}
    </div>
  );
}

export function Infographic({ data }: { data: InfographicData }) {
  return (
    <div id="infographic-root" className="w-[920px] max-w-full bg-[#faf7f4] p-8 text-neutral-900" data-testid="infographic">
      <div className="mb-6 flex items-start justify-between gap-6 border-b-4 border-[#b4532a] pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b4532a]">Capera report</div>
          <h1 className="mt-1 text-3xl font-bold leading-tight" data-testid="infographic-title">{data.title}</h1>
          <p className="mt-1 text-base text-neutral-600">{data.subtitle}</p>
        </div>
        <div className="shrink-0 text-right text-xs text-neutral-500">
          <div>{new Date(data.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
          <div>{data.preparedFor}</div>
        </div>
      </div>

      {data.keyFigures.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.keyFigures.map((f, i) => (
            <div key={i} className="rounded-xl bg-white p-4 shadow-sm" style={{ borderLeft: `6px solid ${TONE[f.tone]}` }} data-testid={`figure-${i}`}>
              <div className="text-3xl font-bold tabular-nums" style={{ color: f.tone === "info" ? "#1b2230" : TONE[f.tone] }}>{f.value}</div>
              <div className="mt-1 text-sm font-medium text-neutral-800">{f.label}</div>
              {f.detail && <div className="text-xs text-neutral-500">{f.detail}</div>}
            </div>
          ))}
        </div>
      )}

      {data.charts.length > 0 && <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">{data.charts.map(c => <ChartCard key={c.id} c={c} />)}</div>}

      {data.insights.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-bold">What this shows</h2>
          <ul className="space-y-3">
            {data.insights.map((i, n) => (
              <li key={n} className="flex gap-3 rounded-xl bg-white p-4 shadow-sm" data-testid={`insight-${n}`}>
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: TONE[i.tone] }} />
                <div><div className="font-semibold">{i.title}</div><p className="text-sm text-neutral-700">{i.text}</p></div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.nextSteps.length > 0 && (
        <div className="mb-6 rounded-xl bg-[#1b2230] p-5 text-white">
          <h2 className="mb-2 text-lg font-bold">What to do first</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">{data.nextSteps.map((s, i) => <li key={i} data-testid={`step-${i}`}>{s}</li>)}</ol>
        </div>
      )}
      <p className="text-[11px] leading-snug text-neutral-500">{data.footnote} Confidential: may relate to people in your organisation.</p>
    </div>
  );
}

export default function InfographicDialog({ data, onClose }: { data: InfographicData | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const node = ref.current.querySelector("#infographic-root") as HTMLElement;
      const blob = await elementToPngBlob(node, 2, "#faf7f4");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); setTimeout(() => URL.revokeObjectURL(a.href), 10000); a.download = `Capera - ${data?.title.replace(/[^\w\s\-&,.()]/g, "").slice(0, 70)} - infographic.png`; a.click();
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!data} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-[980px] overflow-y-auto" data-testid="dialog-infographic">
        <style>{`@media print { body * { visibility: hidden !important; } #infographic-root, #infographic-root * { visibility: visible !important; } #infographic-root { position: absolute; left: 0; top: 0; width: 100% !important; } @page { margin: 12mm; } }`}</style>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Infographic {data?.aiUsed && <span className="inline-flex items-center gap-1 rounded-full bg-[#b4532a]/10 px-2 py-0.5 text-xs font-medium text-[#b4532a]"><Sparkles className="h-3 w-3" />AI-drafted wording</span>}</DialogTitle>
          <DialogDescription>Save it as a picture, or print it or save it as a PDF.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy} data-testid="button-save-image"><Download className="mr-1 h-4 w-4" />{busy ? "Preparing..." : "Download picture"}</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} data-testid="button-print"><Printer className="mr-1 h-4 w-4" />Print or save as PDF</Button>
        </div>
        <div ref={ref} className="overflow-x-auto rounded-lg border bg-[#faf7f4]">{data && <Infographic data={data} />}</div>
      </DialogContent>
    </Dialog>
  );
}
