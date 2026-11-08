import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCombobox } from "@/components/UserCombobox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertTriangle } from "lucide-react";
import { errorText } from "@/components/performance/shared";

export interface ReportingLine {
  id: string; name: string; role: string; jobRole: string | null; location: string | null; department: string | null;
  managerId: string | null; managerName: string | null; supervisorId: string | null; supervisorName: string | null; manages: number; supervises: number;
}

const PAGE = 50;

// Who appraises whom. An administrator sets each person's manager (who rates them, holds the discussion and signs off) and, if wanted, a
// supervisor (who follows the review and adds comments). What is set here decides who gets the team side of performance, whatever their role.
export function ReportingLinesTab({ initialSearch = "" }: { initialSearch?: string }) {
  const { toast } = useToast();
  const { data: lines = [], isLoading } = useQuery<ReportingLine[]>({ queryKey: ["/api/performance/reporting-lines"] });
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<"all" | "no_manager" | "no_supervisor" | "appraisers">("all");
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkManager, setBulkManager] = useState<string | null>(null);
  const [bulkSupervisor, setBulkSupervisor] = useState<string | null>(null);

  const options = useMemo(() => lines.map(l => ({ id: l.id, label: l.name, sublabel: l.jobRole })), [lines]);
  const noManager = lines.filter(l => !l.managerId).length;
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return lines.filter(l => {
      if (filter === "no_manager" && l.managerId) return false;
      if (filter === "no_supervisor" && l.supervisorId) return false;
      if (filter === "appraisers" && !(l.manages || l.supervises)) return false;
      return !s || `${l.name} ${l.jobRole ?? ""} ${l.location ?? ""} ${l.managerName ?? ""} ${l.supervisorName ?? ""}`.toLowerCase().includes(s);
    });
  }, [lines, search, filter]);
  const visible = filtered.slice(0, shown);

  const refresh = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/performance") });
  const onError = (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" });
  const setOne = useMutation({
    mutationFn: async (v: { userId: string; managerId?: string | null; supervisorId?: string | null }) => {
      const { userId, ...body } = v;
      return (await apiRequest("PUT", `/api/performance/reporting-lines/${userId}`, body)).json();
    },
    onSuccess: (r: any) => {
      refresh();
      toast({ title: "Saved", description: r.appraisalsUpdated ? `${r.appraisalsUpdated} unfinished review${r.appraisalsUpdated === 1 ? " now belongs" : "s now belong"} to the new ${r.managerChanged ? "manager" : "supervisor"}.` : undefined });
    },
    onError,
  });
  const setMany = useMutation({
    mutationFn: async (body: { managerId?: string | null; supervisorId?: string | null }) => (await apiRequest("POST", "/api/performance/reporting-lines/bulk", { userIds: Array.from(picked), ...body })).json(),
    onSuccess: (r: any) => {
      refresh(); setPicked(new Set());
      toast({ title: `${r.updated} ${r.updated === 1 ? "person" : "people"} updated`, description: r.failed?.length ? `${r.failed.length} could not be changed: ${r.failed.slice(0, 2).map((f: any) => f.error).join("; ")}` : undefined, variant: r.failed?.length ? "destructive" : undefined });
    },
    onError,
  });

  const allVisiblePicked = visible.length > 0 && visible.every(l => picked.has(l.id));
  const toggleAll = (on: boolean) => setPicked(p => { const n = new Set(p); visible.forEach(l => (on ? n.add(l.id) : n.delete(l.id))); return n; });
  const toggle = (id: string, on: boolean) => setPicked(p => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  return (
    <div className="space-y-4" data-testid="tab-reporting-lines">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Who appraises whom</CardTitle>
          <CardDescription>
            Set each person's <b>manager</b>, who rates them, holds the discussion and signs off, and, if you want one, a <b>supervisor</b>, who follows the review and adds comments.
            Anyone you name here gets the team side of performance on their own profile, whatever their role is called. If you change someone's manager, their unfinished reviews move to the new manager.
          </CardDescription>
        </CardHeader>
        {noManager > 0 && (
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/20" data-testid="alert-no-manager">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
              <span><b>{noManager}</b> {noManager === 1 ? "person has" : "people have"} no manager, so they are left out of every review period until one is set.</span>
              <Button size="sm" variant="outline" onClick={() => { setFilter("no_manager"); setShown(PAGE); }} data-testid="button-show-no-manager">Show them</Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Input className="max-w-xs" placeholder="Search people, roles or places" aria-label="Search people" value={search} onChange={e => { setSearch(e.target.value); setShown(PAGE); }} data-testid="input-search-lines" />
            <Select value={filter} onValueChange={v => { setFilter(v as typeof filter); setShown(PAGE); }}>
              <SelectTrigger className="w-56" aria-label="Show" data-testid="select-line-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="no_manager">No manager set</SelectItem>
                <SelectItem value="no_supervisor">No supervisor set</SelectItem>
                <SelectItem value="appraisers">Managers and supervisors only</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground" data-testid="text-lines-count">{filtered.length} of {lines.length} people</span>
          </div>

          {picked.size > 0 && (
            <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/40 p-3" data-testid="bulk-bar">
              <div className="text-sm font-medium">{picked.size} selected</div>
              <div className="w-60"><UserCombobox testId="bulk-manager" placeholder="Choose a manager..." allowClear options={options} value={bulkManager} onChange={setBulkManager} /></div>
              <Button size="sm" disabled={!bulkManager || setMany.isPending} onClick={() => setMany.mutate({ managerId: bulkManager })} data-testid="button-bulk-manager">Set as manager</Button>
              <div className="w-60"><UserCombobox testId="bulk-supervisor" placeholder="Choose a supervisor..." allowClear options={options} value={bulkSupervisor} onChange={setBulkSupervisor} /></div>
              <Button size="sm" variant="outline" disabled={!bulkSupervisor || setMany.isPending} onClick={() => setMany.mutate({ supervisorId: bulkSupervisor })} data-testid="button-bulk-supervisor">Set as supervisor</Button>
              <Button size="sm" variant="ghost" disabled={setMany.isPending} onClick={() => setMany.mutate({ supervisorId: null })} data-testid="button-bulk-clear-supervisor">Remove supervisor</Button>
              <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear selection</Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox aria-label="Select everyone shown" checked={allVisiblePicked} onCheckedChange={v => toggleAll(v === true)} data-testid="checkbox-all" /></TableHead>
                  <TableHead>Person</TableHead><TableHead className="min-w-56">Manager (appraiser)</TableHead><TableHead className="min-w-56">Supervisor</TableHead><TableHead className="text-right">Appraises</TableHead><TableHead className="text-right">Supervises</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>}
                {!isLoading && visible.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground" data-testid="text-no-lines">No one matches.</TableCell></TableRow>}
                {visible.map(l => (
                  <TableRow key={l.id} data-testid={`row-line-${l.id}`}>
                    <TableCell><Checkbox aria-label={`Select ${l.name}`} checked={picked.has(l.id)} onCheckedChange={v => toggle(l.id, v === true)} data-testid={`checkbox-${l.id}`} /></TableCell>
                    <TableCell><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{[l.jobRole, l.location].filter(Boolean).join(" · ") || "No job role"}</div></TableCell>
                    <TableCell>
                      <UserCombobox testId={`manager-${l.id}`} placeholder="No manager set" allowClear value={l.managerId} onChange={id => setOne.mutate({ userId: l.id, managerId: id })} options={options.filter(o => o.id !== l.id)} />
                    </TableCell>
                    <TableCell>
                      <UserCombobox testId={`supervisor-${l.id}`} placeholder="No supervisor" allowClear value={l.supervisorId} onChange={id => setOne.mutate({ userId: l.id, supervisorId: id })} options={options.filter(o => o.id !== l.id)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.manages ? <Badge variant="secondary">{l.manages}</Badge> : <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.supervises ? <Badge variant="outline">{l.supervises}</Badge> : <span className="text-muted-foreground">-</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > shown && <div className="flex justify-center"><Button variant="outline" size="sm" onClick={() => setShown(s => s + PAGE)} data-testid="button-show-more">Show {Math.min(PAGE, filtered.length - shown)} more</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}
