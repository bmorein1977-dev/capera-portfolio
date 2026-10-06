import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import { StatusBadge, ScoreBar, STATUS_LABEL, STATUS_ORDER, errorText, fmtDate, toDateInput, useIsAdmin, type AppraisalStatus, type Cycle } from "@/components/performance/shared";

interface TeamRow {
  id: string; userId: string; employeeName: string; jobRole: string | null; status: AppraisalStatus; cycleId: string; cycleName: string; year: number;
  selfSubmitted: boolean; managerSubmitted: boolean; shared: boolean; dueDate: string | null;
  scores: { objectives: number | null; performance: number | null; behaviours: number | null; feedback360: number | null } | null;
}
interface Report { id: string; name: string; jobRole: string | null; hasManager: boolean; appraisalId: string | null }

// What the manager is waiting for, in plain words
function nextStep(r: TeamRow): string {
  switch (r.status) {
    case "objectives": return "Objectives being set";
    case "self_review": return r.selfSubmitted ? "Self assessment in" : "Waiting for their self assessment";
    case "manager_review": return "Your review is due";
    case "calibration": return "With HR for calibration";
    case "meeting": return r.shared ? "Waiting for sign-off" : "Hold the discussion, then share";
    default: return "Complete";
  }
}

export default function TeamPerformance() {
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showAll, setShowAll] = useState(false);
  const [cycleId, setCycleId] = useState<string>("all");
  const { data: cycles = [] } = useQuery<Array<Cycle & { appraisalTotal: number }>>({ queryKey: ["/api/performance/cycles"] });
  const { data: rows = [], isLoading } = useQuery<TeamRow[]>({
    queryKey: ["/api/performance/team", { all: showAll ? 1 : "", cycleId: cycleId === "all" ? "" : cycleId }],
  });
  const openCycles = cycles.filter(c => c.status === "open");

  // ---- start an appraisal for one of my people
  const [start, setStart] = useState<{ cycleId: string; userId: string; objectivesDueDate: string; selfReviewDueDate: string; managerReviewDueDate: string } | null>(null);
  const { data: reports = [], isLoading: loadingReports } = useQuery<Report[]>({
    queryKey: ["/api/performance/my-reports", { cycleId: start?.cycleId ?? "" }],
    enabled: !!start?.cycleId,
  });
  const cycleFor = (id: string) => cycles.find(c => c.id === id);
  const applyCycleDates = (id: string) => {
    const c = cycleFor(id);
    return { objectivesDueDate: toDateInput(c?.objectiveDeadline), selfReviewDueDate: toDateInput(c?.selfReviewDeadline), managerReviewDueDate: toDateInput(c?.managerReviewDeadline) };
  };
  const openStart = () => {
    const id = openCycles[0]?.id ?? "";
    setStart({ cycleId: id, userId: "", ...applyCycleDates(id) });
  };
  const available = reports.filter(r => !r.appraisalId);
  const alreadyStarted = reports.length - available.length;
  useEffect(() => { if (start?.userId && !available.some(r => r.id === start.userId)) setStart(s => (s ? { ...s, userId: "" } : s)); }, [reports]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useMutation({
    mutationFn: async (s: NonNullable<typeof start>) => (await apiRequest("POST", "/api/performance/appraisals", {
      userId: s.userId, cycleId: s.cycleId,
      objectivesDueDate: s.objectivesDueDate || null, selfReviewDueDate: s.selfReviewDueDate || null, managerReviewDueDate: s.managerReviewDueDate || null,
    })).json(),
    onSuccess: (a: { id: string }) => {
      queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/performance") });
      setStart(null);
      toast({ title: "Review started", description: "They have been notified and asked to draft their objectives." });
      navigate(`/performance/appraisals/${a.id}`);
    },
    onError: (e: any) => toast({ title: "Could not start the review", description: errorText(e), variant: "destructive" }),
  });

  const counts = STATUS_ORDER.map(s => ({ s, n: rows.filter(r => r.status === s).length })).filter(c => c.n > 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">{isAdmin && showAll ? "All Appraisals" : "My Team's Performance"}</h1>
          <p className="text-muted-foreground">Start a review for someone in your team, then agree objectives, complete the review, hold the discussion and share the report.</p>
        </div>
        <Button onClick={openStart} disabled={openCycles.length === 0} data-testid="button-start-appraisal"><Plus className="h-4 w-4 mr-1.5" />Start an appraisal</Button>
      </div>
      {openCycles.length === 0 && <p className="text-sm text-muted-foreground" data-testid="text-no-open-cycle">There is no open review cycle. HR needs to launch one before you can start reviews.</p>}

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
            <p className="text-sm text-muted-foreground" data-testid="text-no-team">You have not started any reviews yet. Choose "Start an appraisal" to pick someone from your team.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead>Cycle</TableHead><TableHead>Stage</TableHead><TableHead>What is next</TableHead><TableHead>Due</TableHead><TableHead>Objectives met</TableHead><TableHead>Rating</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} data-testid={`row-team-${r.id}`}>
                    <TableCell className="font-medium">{r.employeeName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.jobRole ?? "-"}</TableCell>
                    <TableCell>{r.cycleName}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-sm">{nextStep(r)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.dueDate ? fmtDate(r.dueDate) : "-"}</TableCell>
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

      <Dialog open={!!start} onOpenChange={o => !o && setStart(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Start an appraisal</DialogTitle>
            <DialogDescription>Choose the person and set the dates. They are emailed straight away, and reminders start 30 days before each due date.</DialogDescription>
          </DialogHeader>
          {start && (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Review cycle</Label>
                <Select value={start.cycleId} onValueChange={v => setStart({ ...start, cycleId: v, userId: "", ...applyCycleDates(v) })}>
                  <SelectTrigger aria-label="Review cycle" data-testid="select-start-cycle"><SelectValue placeholder="Choose a cycle" /></SelectTrigger>
                  <SelectContent>{openCycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label>Who is the review for?</Label>
                <Select value={start.userId} onValueChange={v => setStart({ ...start, userId: v })}>
                  <SelectTrigger aria-label="Person" data-testid="select-start-person"><SelectValue placeholder={available.length ? "Choose from your direct reports" : "No one left to start"} /></SelectTrigger>
                  <SelectContent>{available.map(r => <SelectItem key={r.id} value={r.id}>{r.name}{r.jobRole ? ` - ${r.jobRole}` : ""}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground" data-testid="text-start-hint">
                  {loadingReports ? "Loading your team..." : reports.length === 0 ? "No one reports to you in Capera yet. HR can set your team on each person's profile." : alreadyStarted > 0 ? `${alreadyStarted} of your ${reports.length} direct report${reports.length === 1 ? "" : "s"} already ${alreadyStarted === 1 ? "has" : "have"} a review in this cycle.` : `${reports.length} direct report${reports.length === 1 ? "" : "s"}.`}
                </p></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label htmlFor="d-obj">Objectives agreed by</Label><Input id="d-obj" type="date" value={start.objectivesDueDate} onChange={e => setStart({ ...start, objectivesDueDate: e.target.value })} data-testid="input-due-objectives" /></div>
                <div className="space-y-1.5"><Label htmlFor="d-self">Self assessment due</Label><Input id="d-self" type="date" value={start.selfReviewDueDate} onChange={e => setStart({ ...start, selfReviewDueDate: e.target.value })} data-testid="input-due-self" /></div>
                <div className="space-y-1.5"><Label htmlFor="d-mgr">Your review due</Label><Input id="d-mgr" type="date" value={start.managerReviewDueDate} onChange={e => setStart({ ...start, managerReviewDueDate: e.target.value })} data-testid="input-due-manager" /></div>
              </div>
              <p className="text-xs text-muted-foreground">The dates start from the cycle's dates. Change them for this person if you need to.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStart(null)}>Cancel</Button>
            <Button disabled={!start?.userId || !start?.cycleId || create.isPending} onClick={() => start && create.mutate(start)} data-testid="button-confirm-start">{create.isPending ? "Starting..." : "Start review"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
