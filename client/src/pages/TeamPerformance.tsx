import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, ScoreBar, STATUS_LABEL, STATUS_ORDER, useIsAdmin, type AppraisalStatus, type Cycle } from "@/components/performance/shared";

interface TeamRow {
  id: string; userId: string; employeeName: string; jobRole: string | null; status: AppraisalStatus; cycleId: string; cycleName: string; year: number;
  selfSubmitted: boolean; managerSubmitted: boolean;
  scores: { objectives: number | null; performance: number | null; behaviours: number | null; feedback360: number | null } | null;
}

export default function TeamPerformance() {
  const isAdmin = useIsAdmin();
  const [showAll, setShowAll] = useState(false);
  const [cycleId, setCycleId] = useState<string>("all");
  const { data: cycles = [] } = useQuery<Array<Cycle & { appraisalTotal: number }>>({ queryKey: ["/api/performance/cycles"] });
  const { data: rows = [], isLoading } = useQuery<TeamRow[]>({
    queryKey: ["/api/performance/team", { all: showAll ? 1 : "", cycleId: cycleId === "all" ? "" : cycleId }],
  });

  const counts = STATUS_ORDER.map(s => ({ s, n: rows.filter(r => r.status === s).length })).filter(c => c.n > 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">{isAdmin && showAll ? "All Appraisals" : "My Team's Performance"}</h1>
        <p className="text-muted-foreground">Open an appraisal to agree objectives, complete reviews and sign off.</p>
      </div>

      <Card>
        <CardContent className="py-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2"><Label>Review cycle</Label>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="w-56" aria-label="Review cycle" data-testid="select-cycle"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All cycles</SelectItem>{cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select></div>
          {isAdmin && <div className="flex items-center gap-2"><Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} data-testid="switch-show-all" /><Label htmlFor="show-all">Show everyone, not just my reports</Label></div>}
          <div className="flex flex-wrap gap-2 ml-auto text-sm text-muted-foreground">{counts.map(c => <span key={c.s} data-testid={`count-${c.s}`}>{STATUS_LABEL[c.s]}: <b className="text-foreground">{c.n}</b></span>)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>People</CardTitle><CardDescription>{rows.length} appraisal{rows.length === 1 ? "" : "s"}</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-team">Nobody is in a review cycle for you yet. Appraisals are created when HR launches a cycle for people who report to you.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead>Cycle</TableHead><TableHead>Stage</TableHead><TableHead>Objectives met</TableHead><TableHead>Rating</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} data-testid={`row-team-${r.id}`}>
                    <TableCell className="font-medium">{r.employeeName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.jobRole ?? "-"}</TableCell>
                    <TableCell>{r.cycleName}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell><ScoreBar value={r.scores?.objectives} label="-" /></TableCell>
                    <TableCell><ScoreBar value={r.scores?.performance} label="-" /></TableCell>
                    <TableCell className="text-right"><Link href={`/performance/appraisals/${r.id}`}><Button size="sm" variant="outline" data-testid={`button-open-${r.id}`}>Open</Button></Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
