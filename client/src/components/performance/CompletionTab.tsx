import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertOctagon, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { fmtDate, PERIOD_LABEL } from "@/components/performance/shared";

interface Row {
  userId: string; name: string; jobRole: string | null; location: string | null; managerId: string | null; managerName: string | null; supervisorId: string | null; supervisorName: string | null;
  appraisalId: string | null; stage: string; stageLabel: string; waitingOn: string; selfSubmitted: boolean; managerSubmitted: boolean; shared: boolean; dueDate: string | null; overdue: boolean;
}
interface Completion {
  cycle: { id: string; name: string; year: number; status: string; periodType: string } | null;
  cycles: Array<{ id: string; name: string; year: number; status: string; periodType: string }>;
  summary: { total: number; byStage: Record<string, number>; complete: number; completePct: number; overdue: number; noAppraiser: number; notStarted: number; inProgress: number } | null;
  rows: Row[];
  managers: Array<{ managerId: string; name: string; people: number; complete: number; overdue: number; notStarted: number }>;
}

// fixed status colours, always paired with an icon or a word
const COLOUR = { good: "#0ca30c", neutral: "hsl(var(--primary))", warning: "#fab219", critical: "#d03b3b" };
const STAGES: Array<[string, string]> = [["no_appraiser", "No appraiser"], ["not_started", "Not started"], ["objectives", "Objectives"], ["self_review", "Self assessment"], ["manager_review", "Manager review"], ["calibration", "Calibration"], ["meeting", "Discussion and sign-off"], ["signed_off", "Complete"]];

function csvCell(v: unknown) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

// Every active person against one review period: who has not started, where each review is, who is overdue and who has nobody to appraise them.
export function CompletionTab({ onSetAppraiser }: { onSetAppraiser: (name: string) => void }) {
  const [cycleId, setCycleId] = useState<string>("");
  const { data, isLoading } = useQuery<Completion>({ queryKey: [`/api/performance/completion${cycleId ? `?cycleId=${cycleId}` : ""}`] });
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [manager, setManager] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => {
      if (stage !== "all" && r.stage !== stage) return false;
      if (manager !== "all" && r.managerId !== manager) return false;
      if (overdueOnly && !r.overdue) return false;
      return !s || `${r.name} ${r.jobRole ?? ""} ${r.location ?? ""} ${r.managerName ?? ""}`.toLowerCase().includes(s);
    });
  }, [rows, search, stage, manager, overdueOnly]);

  const exportCsv = () => {
    const head = ["Person", "Job role", "Location", "Manager", "Supervisor", "Stage", "Waiting on", "Due", "Overdue"];
    const lines = [head, ...filtered.map(r => [r.name, r.jobRole, r.location, r.managerName, r.supervisorName, r.stageLabel, r.waitingOn, r.dueDate ? fmtDate(r.dueDate) : "", r.overdue ? "Yes" : ""])];
    const blob = new Blob([lines.map(l => l.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `performance-completion-${(data?.cycle?.name ?? "reviews").replace(/\s+/g, "-").toLowerCase()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!data?.cycle || !data.summary) return <Card><CardContent className="py-8 text-center text-muted-foreground" data-testid="text-no-periods">There are no review periods yet. Use "Schedule the year" on the Review periods tab to set them up.</CardContent></Card>;
  const S = data.summary;
  const parts: Array<{ key: string; label: string; value: number; colour: string }> = [
    { key: "complete", label: "Complete", value: S.complete, colour: COLOUR.good },
    { key: "progress", label: "In progress", value: S.inProgress, colour: COLOUR.neutral },
    { key: "notstarted", label: "Not started", value: S.notStarted, colour: COLOUR.warning },
    { key: "noappraiser", label: "No appraiser", value: S.noAppraiser, colour: COLOUR.critical },
  ];

  return (
    <div className="space-y-4" data-testid="tab-completion">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={data.cycle.id} onValueChange={setCycleId}>
          <SelectTrigger className="w-72" aria-label="Review period" data-testid="select-completion-cycle"><SelectValue /></SelectTrigger>
          <SelectContent>{data.cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.status === "draft" ? " (draft)" : c.status === "closed" ? " (closed)" : ""}</SelectItem>)}</SelectContent>
        </Select>
        <Badge variant="outline">{PERIOD_LABEL[data.cycle.periodType] ?? data.cycle.periodType}</Badge>
        <Badge variant={data.cycle.status === "open" ? "default" : "secondary"}>{data.cycle.status === "draft" ? "Not open yet" : data.cycle.status === "open" ? "Open" : "Closed"}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1" data-testid="card-completion-hero">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-muted-foreground">Reviews complete</div>
            <div className="mt-2 flex items-baseline gap-1"><span className="text-6xl font-semibold leading-none tracking-tight" data-testid="text-complete-pct">{S.completePct}</span><span className="text-2xl text-muted-foreground">%</span></div>
            <p className="mt-3 text-sm text-muted-foreground" data-testid="text-complete-detail">{S.complete} of {S.total} people</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 pt-6">
            <div className="flex h-3 gap-[2px]" role="img" aria-label={`Completion: ${parts.map(p => `${p.label} ${p.value}`).join(", ")}`}>
              {parts.filter(p => p.value > 0).map(p => <div key={p.key} className="h-full min-w-[4px] rounded-[4px]" style={{ flexGrow: p.value, background: p.colour }} title={`${p.label}: ${p.value}`} />)}
            </div>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
              {parts.map(p => <li key={p.key} className="flex items-center justify-between gap-2" data-testid={`legend-${p.key}`}><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.colour }} aria-hidden />{p.label}</span><span className="font-semibold tabular-nums">{p.value}</span></li>)}
            </ul>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5" data-testid="text-overdue">{S.overdue > 0 ? <AlertOctagon className="h-4 w-4" style={{ color: COLOUR.critical }} aria-hidden /> : <CheckCircle2 className="h-4 w-4" style={{ color: COLOUR.good }} aria-hidden />}<b>{S.overdue}</b> overdue</span>
              {S.noAppraiser > 0 && <button type="button" className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline" onClick={() => setStage("no_appraiser")} data-testid="button-no-appraiser"><AlertTriangle className="h-4 w-4" style={{ color: COLOUR.warning }} aria-hidden /><b>{S.noAppraiser}</b> with nobody set to appraise them</button>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Where everyone is</CardTitle><CardDescription>Choose a stage to see who is in it.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {STAGES.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setStage(stage === k ? "all" : k)} aria-pressed={stage === k}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${stage === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`} data-testid={`stage-${k}`}>
              {label}: <b className="tabular-nums">{S.byStage[k] ?? 0}</b>
            </button>
          ))}
        </CardContent>
      </Card>

      {data.managers.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">By manager</CardTitle><CardDescription>Managers with the most overdue come first.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Manager</TableHead><TableHead className="text-right">People</TableHead><TableHead className="text-right">Complete</TableHead><TableHead className="text-right">Not started</TableHead><TableHead className="text-right">Overdue</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.managers.slice(0, 12).map(m => (
                  <TableRow key={m.managerId} data-testid={`row-manager-${m.managerId}`}>
                    <TableCell><button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => setManager(manager === m.managerId ? "all" : m.managerId)}>{m.name}</button></TableCell>
                    <TableCell className="text-right tabular-nums">{m.people}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.complete}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.notStarted || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.overdue ? <span className="inline-flex items-center gap-1 font-semibold"><AlertOctagon className="h-3.5 w-3.5" style={{ color: COLOUR.critical }} aria-hidden />{m.overdue}</span> : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.managers.length > 12 && <p className="mt-2 text-xs text-muted-foreground">Showing the 12 managers who need the most attention. Use the filter below to look at any manager.</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="text-lg">Everyone</CardTitle><CardDescription data-testid="text-people-count">{filtered.length} of {rows.length} people</CardDescription></div>
            <Button size="sm" variant="outline" onClick={exportCsv} data-testid="button-export-completion"><Download className="mr-1.5 h-4 w-4" />Download as a spreadsheet</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input className="max-w-xs" placeholder="Search people" aria-label="Search people" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-completion" />
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="w-52" aria-label="Stage" data-testid="select-stage"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Every stage</SelectItem>{STAGES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={manager} onValueChange={setManager}>
              <SelectTrigger className="w-56" aria-label="Manager" data-testid="select-manager"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72"><SelectItem value="all">Every manager</SelectItem>{data.managers.slice().sort((a, b) => a.name.localeCompare(b.name)).map(m => <SelectItem key={m.managerId} value={m.managerId}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant={overdueOnly ? "default" : "outline"} aria-pressed={overdueOnly} onClick={() => setOverdueOnly(o => !o)} data-testid="button-overdue-only">Overdue only</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Manager</TableHead><TableHead>Supervisor</TableHead><TableHead>Stage</TableHead><TableHead>Waiting on</TableHead><TableHead>Due</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No one matches.</TableCell></TableRow>}
                {filtered.slice(0, 200).map(r => (
                  <TableRow key={r.userId} data-testid={`row-person-${r.userId}`}>
                    <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{[r.jobRole, r.location].filter(Boolean).join(" · ")}</div></TableCell>
                    <TableCell className="text-sm">{r.managerName ?? <span className="text-muted-foreground">Not set</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.supervisorName ?? "-"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm" data-testid={`stage-text-${r.userId}`}>
                        {r.stage === "signed_off" ? <CheckCircle2 className="h-4 w-4" style={{ color: COLOUR.good }} aria-hidden /> : r.stage === "no_appraiser" ? <AlertOctagon className="h-4 w-4" style={{ color: COLOUR.critical }} aria-hidden /> : r.stage === "not_started" ? <AlertTriangle className="h-4 w-4" style={{ color: COLOUR.warning }} aria-hidden /> : <span className="h-2 w-2 rounded-full" style={{ background: COLOUR.neutral }} aria-hidden />}
                        {r.stageLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.waitingOn || "-"}</TableCell>
                    <TableCell className="text-sm">{r.dueDate ? <span className={r.overdue ? "inline-flex items-center gap-1 font-medium" : "text-muted-foreground"}>{r.overdue && <AlertOctagon className="h-3.5 w-3.5" style={{ color: COLOUR.critical }} aria-label="Overdue" />}{fmtDate(r.dueDate)}</span> : <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-right">
                      {r.appraisalId ? <Link href={`/performance/appraisals/${r.appraisalId}`}><Button size="sm" variant="outline" data-testid={`button-open-${r.userId}`}>Open</Button></Link>
                        : r.stage === "no_appraiser" ? <Button size="sm" variant="outline" onClick={() => onSetAppraiser(r.name)} data-testid={`button-set-appraiser-${r.userId}`}>Set appraiser</Button> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 200 && <p className="text-xs text-muted-foreground">Showing the first 200. Narrow the list with the filters, or download the spreadsheet for everyone.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
