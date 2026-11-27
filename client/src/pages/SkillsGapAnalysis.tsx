import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { againstTarget } from "@shared/kpi";

type Counts = { required: number; inDate: number; expiring: number; expired: number; missing: number; exempt: number; coverage: number | null };
type Data = {
  generatedAt: string; people: number; competence: Counts; safetyCriticalCompetence: Counts; training: Counts; targets: Record<string, number>;
  byStandard: Array<Counts & { elementId: string; code: string | null; name: string; safetyCritical: boolean; shortfall: Array<{ userId: string; name: string; status: string }> }>;
  byRole: Array<Counts & { name: string; people: number }>; bySite: Array<Counts & { name: string; people: number }>;
  byTraining: Array<Counts & { requirement: string; name: string; safetyCritical: boolean }>;
  options: { jobRoles: Array<{ id: string; name: string }>; locations: string[]; teams: string[] };
};
const SELECT = "rounded-md border bg-background p-2 text-sm";
const pct = (n: number | null) => (n === null ? "None required" : `${n}%`);
const TONE = { green: "text-green-700 dark:text-green-400", amber: "text-amber-700 dark:text-amber-400", red: "text-red-700 dark:text-red-400" } as const;

function Figure({ title, c, target }: { title: string; c: Counts; target?: number }) {
  const tone = againstTarget(c.coverage, target ?? null);
  return (
    <Card>
      <CardHeader className="pb-2"><CardDescription>{title}</CardDescription><CardTitle className={`text-3xl ${tone ? TONE[tone] : ""}`}>{pct(c.coverage)}</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">{c.inDate} of {c.required} in date. {c.missing} not held, {c.expired} expired, {c.expiring} due within 90 days.{target !== undefined ? ` Target ${target}%.` : ""}</CardContent>
    </Card>
  );
}

function CountsTable({ title, description, first, rows }: { title: string; description?: string; first: string; rows: Array<Counts & { key: string; label: React.ReactNode }> }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 15);
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>{first}</TableHead><TableHead className="text-right">Required</TableHead><TableHead className="text-right">Not held</TableHead><TableHead className="text-right">Expired</TableHead><TableHead className="text-right">Due in 90 days</TableHead><TableHead className="text-right">In date</TableHead></TableRow></TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.key}><TableCell>{r.label}</TableCell><TableCell className="text-right">{r.required}</TableCell><TableCell className="text-right">{r.missing}</TableCell><TableCell className="text-right">{r.expired}</TableCell><TableCell className="text-right">{r.expiring}</TableCell><TableCell className="text-right font-medium">{pct(r.coverage)}</TableCell></TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nothing is required for this selection.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {rows.length > 15 && <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll(!all)}>{all ? "Show the first 15" : `Show all ${rows.length}`}</Button>}
      </CardContent>
    </Card>
  );
}

export default function SkillsGapAnalysis() {
  const [filters, setFilters] = useState({ jobRoleId: "", location: "", team: "", safetyCriticalOnly: false });
  const [openStandard, setOpenStandard] = useState<string | null>(null);
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, String(v));
  const data = useQuery<Data>({ queryKey: ["/api/reports/skills-gap", query.toString()], queryFn: () => api("GET", `/api/reports/skills-gap?${query}`) });
  const d = data.data;
  const set = (k: string, v: string | boolean) => setFilters((f) => ({ ...f, [k]: v }));
  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="page-skills-gap-analysis">
      <div><h1 className="text-2xl font-bold">Skills Gap Analysis</h1><p className="text-muted-foreground">What your job roles require compared with what people hold now{d ? `, across ${d.people} people` : ""}.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={SELECT} aria-label="Job role" value={filters.jobRoleId} onChange={(e) => set("jobRoleId", e.target.value)} data-testid="select-gap-role"><option value="">All job roles</option>{d?.options.jobRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select className={SELECT} aria-label="Location" value={filters.location} onChange={(e) => set("location", e.target.value)}><option value="">All locations</option>{d?.options.locations.map((l) => <option key={l}>{l}</option>)}</select>
        <select className={SELECT} aria-label="Team" value={filters.team} onChange={(e) => set("team", e.target.value)}><option value="">All teams</option>{d?.options.teams.map((l) => <option key={l}>{l}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.safetyCriticalOnly} onChange={(e) => set("safetyCriticalOnly", e.target.checked)} data-testid="check-gap-critical" />Safety critical only</label>
      </div>
      {data.isLoading ? <p className="text-muted-foreground">Working it out...</p> : data.error ? <p className="text-destructive">{(data.error as Error).message}</p> : d && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Figure title="Competence in date" c={d.competence} target={d.targets.competence_overall} />
            <Figure title="Safety-critical competence in date" c={d.safetyCriticalCompetence} target={d.targets.competence_safety_critical} />
            <Figure title="Required training in date" c={d.training} target={d.targets.training_overall} />
          </div>
          <CountsTable title="Competence standards: biggest gaps first" description="Select a standard to see who has the gap." first="Standard"
            rows={d.byStandard.map((r) => ({ ...r, key: r.elementId, label: (
              <div>
                <button className="text-left underline-offset-2 hover:underline" onClick={() => setOpenStandard(openStandard === r.elementId ? null : r.elementId)} data-testid={`button-gap-${r.elementId}`}>{r.code} {r.name}</button>
                {r.safetyCritical && <Badge variant="destructive" className="ml-2">Safety critical</Badge>}
                {openStandard === r.elementId && <ul className="mt-2 text-xs text-muted-foreground">{r.shortfall.length ? r.shortfall.map((p) => <li key={p.userId}>{p.name}: {p.status === "expired" ? "expired" : "not held"}</li>) : <li>Nobody</li>}</ul>}
              </div>
            ) }))} />
          <CountsTable title="By job role" first="Job role" rows={d.byRole.map((r) => ({ ...r, key: r.name, label: `${r.name} (${r.people})` }))} />
          <CountsTable title="By location" first="Location" rows={d.bySite.map((r) => ({ ...r, key: r.name, label: `${r.name} (${r.people})` }))} />
          <CountsTable title="Training requirements: biggest gaps first" first="Training" rows={d.byTraining.map((r) => ({ ...r, key: r.requirement, label: <span>{r.name}{r.safetyCritical && <Badge variant="destructive" className="ml-2">Safety critical</Badge>}</span> }))} />
        </>
      )}
    </div>
  );
}
