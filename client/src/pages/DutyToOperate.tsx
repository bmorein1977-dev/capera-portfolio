import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { errorText, fmtDate, useIsAdmin } from "@/components/performance/shared";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";

// Minimum staffing ("duty to operate"). Administrators say how many people holding a role must be available at a
// location, team or business unit. The page shows how each is being met, and records the decision on whether a
// risk assessment is needed when one is not.

interface Requirement {
  id: string; scopeType: "location" | "team" | "business_unit"; scopeId: string; jobRoleId: string; minimumCount: number;
  countBy: "primary" | "secondary" | "either"; onlyCompetent: boolean | null; excludeAbsent: boolean | null; dutyToOperate: boolean | null;
  legalReference: string | null; notes: string | null; notifyUserIds: string[] | null;
}
interface Person { userId: string; name: string; source: string; counted: boolean; reason: string | null; competent: boolean | null; onAbsence: boolean; expiresInDays: number | null; leavingInDays: number | null; atRisk: boolean }
interface Review { id: string; status: "open" | "decided" | "resolved"; decision: string | null; decisionComment: string | null; riskAssessmentRef: string | null; detectedAt: string; decidedAt: string | null; resolvedAt: string | null }
interface Status {
  requirement: Requirement; roleName: string; scopeName: string; required: number; actual: number; shortfall: number; atRiskCount: number;
  status: "met" | "at_risk" | "shortfall"; competenceDefined: boolean; people: Person[]; review: Review | null;
}
interface ReviewRow extends Review { roleName: string; scopeName: string; dutyToOperate: boolean | null; legalReference: string | null; decidedByName: string | null; requiredCount: number; actualCount: number }
interface Named { id: string; name: string }
interface UserLite { id: string; firstName: string | null; lastName: string | null; role: string }

const SCOPE_LABEL = { location: "Location", team: "Team or shift", business_unit: "Business unit" } as const;
const COUNT_LABEL = { primary: "Primary job role only", secondary: "Secondary job role only", either: "Primary or secondary job role" } as const;
const DECISION_LABEL: Record<string, string> = { risk_assessment_required: "Risk assessment required", no_risk_assessment_needed: "No risk assessment needed" };

function StatusBadge({ status }: { status: Status["status"] }) {
  if (status === "met") return <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-200"><CheckCircle2 className="h-3.5 w-3.5" />Met</Badge>;
  if (status === "at_risk") return <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200"><AlertTriangle className="h-3.5 w-3.5" />At risk</Badge>;
  return <Badge className="gap-1 bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200"><ShieldAlert className="h-3.5 w-3.5" />Shortfall</Badge>;
}

const blankForm = () => ({
  scopeType: "location" as Requirement["scopeType"], scopeId: "", jobRoleId: "", minimumCount: "1", countBy: "either" as Requirement["countBy"],
  onlyCompetent: true, excludeAbsent: true, dutyToOperate: true, legalReference: "", notes: "", notifyUserIds: [] as string[],
});

export default function DutyToOperate() {
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const onError = (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" });
  const refresh = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/staffing") });

  const { data: statuses = [], isLoading } = useQuery<Status[]>({ queryKey: ["/api/staffing/status"] });
  const { data: reviews = [] } = useQuery<ReviewRow[]>({ queryKey: ["/api/staffing/reviews"] });
  const { data: locations = [] } = useQuery<Named[]>({ queryKey: ["/api/org/locations"], enabled: isAdmin });
  const { data: teams = [] } = useQuery<Named[]>({ queryKey: ["/api/org/teams"], enabled: isAdmin });
  const { data: units = [] } = useQuery<Named[]>({ queryKey: ["/api/org/business-units"], enabled: isAdmin });
  const { data: roles = [] } = useQuery<Named[]>({ queryKey: ["/api/job-roles"], enabled: isAdmin });
  const { data: people = [] } = useQuery<UserLite[]>({ queryKey: ["/api/users"], enabled: isAdmin });

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<(ReturnType<typeof blankForm> & { id?: string }) | null>(null);
  const [deciding, setDeciding] = useState<{ status: Status; decision: string; comment: string; ref: string } | null>(null);
  const [removing, setRemoving] = useState<Status | null>(null);

  const counts = useMemo(() => ({
    met: statuses.filter(s => s.status === "met").length,
    atRisk: statuses.filter(s => s.status === "at_risk").length,
    shortfall: statuses.filter(s => s.status === "shortfall").length,
    awaiting: statuses.filter(s => s.review?.status === "open").length,
  }), [statuses]);

  const scopeOptions = form?.scopeType === "team" ? teams : form?.scopeType === "business_unit" ? units : locations;
  const notifyChoices = people.filter(p => ["admin", "super_admin", "manager"].includes(p.role)).sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));

  const save = useMutation({
    mutationFn: async (f: NonNullable<typeof form>) => {
      const body = { ...f, minimumCount: Number(f.minimumCount) };
      return (await apiRequest(f.id ? "PUT" : "POST", f.id ? `/api/staffing/requirements/${f.id}` : "/api/staffing/requirements", body)).json();
    },
    onSuccess: () => { refresh(); setForm(null); toast({ title: "Requirement saved" }); },
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/staffing/requirements/${id}`)).json(),
    onSuccess: () => { refresh(); setRemoving(null); toast({ title: "Requirement removed" }); },
    onError,
  });
  const decide = useMutation({
    mutationFn: async (d: NonNullable<typeof deciding>) => (await apiRequest("POST", `/api/staffing/reviews/${d.status.review!.id}/decision`, { decision: d.decision, comment: d.comment, riskAssessmentRef: d.ref })).json(),
    onSuccess: () => { refresh(); setDeciding(null); toast({ title: "Decision recorded" }); },
    onError,
  });
  const runCheck = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/staffing/run-check")).json(),
    onSuccess: (r: any) => { refresh(); toast({ title: "Check complete", description: `${r.opened} new shortfall${r.opened === 1 ? "" : "s"} opened, ${r.resolved} resolved, ${r.notified} alert${r.notified === 1 ? "" : "s"} sent.` }); },
    onError,
  });

  const edit = (s: Status) => setForm({
    id: s.requirement.id, scopeType: s.requirement.scopeType, scopeId: s.requirement.scopeId, jobRoleId: s.requirement.jobRoleId, minimumCount: String(s.requirement.minimumCount),
    countBy: s.requirement.countBy, onlyCompetent: s.requirement.onlyCompetent ?? true, excludeAbsent: s.requirement.excludeAbsent ?? true, dutyToOperate: s.requirement.dutyToOperate ?? true,
    legalReference: s.requirement.legalReference ?? "", notes: s.requirement.notes ?? "", notifyUserIds: s.requirement.notifyUserIds ?? [],
  });

  const tile = (label: string, n: number, tone: string, testid: string) => (
    <Card><CardContent className="py-4"><div className={`text-3xl font-bold ${tone}`} data-testid={testid}>{n}</div><div className="text-sm text-muted-foreground">{label}</div></CardContent></Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Duty to Operate</h1>
          <p className="text-muted-foreground">The minimum number of competent people needed at each location, team or business unit, and whether it is being met.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" disabled={runCheck.isPending} onClick={() => runCheck.mutate()} data-testid="button-run-check">{runCheck.isPending ? "Checking..." : "Run the check now"}</Button>
            <Button onClick={() => setForm(blankForm())} data-testid="button-add-requirement"><Plus className="h-4 w-4 mr-1.5" />Add a requirement</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile("Met", counts.met, "text-green-700 dark:text-green-400", "count-met")}
        {tile("Met, but at risk", counts.atRisk, "text-amber-700 dark:text-amber-400", "count-at-risk")}
        {tile("Shortfall", counts.shortfall, "text-red-700 dark:text-red-400", "count-shortfall")}
        {tile("Awaiting a decision", counts.awaiting, "text-foreground", "count-awaiting")}
      </div>

      <Tabs defaultValue="status">
        <TabsList><TabsTrigger value="status" data-testid="tab-status">How it is being met</TabsTrigger><TabsTrigger value="decisions" data-testid="tab-decisions">Decisions ({reviews.length})</TabsTrigger></TabsList>

        <TabsContent value="status" className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && statuses.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground" data-testid="text-no-requirements">
              {isAdmin ? "No requirements yet. Add one to say how many people holding a role must be available at a location." : "No staffing requirements have been set up yet."}
            </CardContent></Card>
          )}
          {statuses.map(s => {
            const pct = Math.min(100, Math.round((s.actual / s.required) * 100));
            const r = s.requirement;
            return (
              <Card key={r.id} data-testid={`card-requirement-${r.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{s.roleName} at {s.scopeName}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{SCOPE_LABEL[r.scopeType]}</span><span>{COUNT_LABEL[r.countBy]}</span>
                        {r.dutyToOperate && <Badge variant="outline">Duty to operate</Badge>}
                        {r.legalReference && <span>{r.legalReference}</span>}
                      </CardDescription>
                    </div>
                    <div className="text-right space-y-1">
                      <StatusBadge status={s.status} />
                      <div className="text-2xl font-semibold tabular-nums" data-testid={`text-actual-${r.id}`}>{s.actual} <span className="text-base font-normal text-muted-foreground">of {s.required} needed</span></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-label={`${s.actual} of ${s.required} available`}>
                    <div className={`h-full rounded-full ${s.status === "met" ? "bg-green-500" : s.status === "at_risk" ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  {s.status === "at_risk" && <p className="text-sm text-amber-800 dark:text-amber-300">The minimum is met today, but {s.atRiskCount} of the people counted have competence expiring within 60 days or are leaving within 90 days.</p>}
                  {s.status === "shortfall" && <p className="text-sm text-red-800 dark:text-red-300">{s.shortfall} short of the minimum. {s.review?.status === "open" ? "A decision on whether a risk assessment is needed has not been recorded yet." : s.review?.decision ? `Decision: ${DECISION_LABEL[s.review.decision]}.` : ""}</p>}
                  {!s.competenceDefined && r.onlyCompetent && <p className="text-sm text-muted-foreground">This role has no competence requirements defined, so everyone holding it counts as competent.</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })} data-testid={`button-people-${r.id}`}>
                      {open[r.id] ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}{open[r.id] ? "Hide" : "Show"} the {s.people.length} {s.people.length === 1 ? "person" : "people"}
                    </Button>
                    {s.review && s.review.status !== "resolved" && (
                      <Button size="sm" variant={s.review.status === "open" ? "default" : "outline"} onClick={() => setDeciding({ status: s, decision: s.review?.decision ?? "", comment: s.review?.decisionComment ?? "", ref: s.review?.riskAssessmentRef ?? "" })} data-testid={`button-decide-${r.id}`}>
                        {s.review.status === "open" ? "Record the risk assessment decision" : "Change the decision"}
                      </Button>
                    )}
                    {isAdmin && <Button variant="ghost" size="sm" onClick={() => edit(s)} data-testid={`button-edit-${r.id}`}><Pencil className="h-4 w-4 mr-1" />Edit</Button>}
                    {isAdmin && <Button variant="ghost" size="sm" onClick={() => setRemoving(s)} data-testid={`button-remove-${r.id}`}><Trash2 className="h-4 w-4 mr-1" />Remove</Button>}
                  </div>
                  {open[r.id] && (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Holds the role as</TableHead><TableHead>Counted</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {s.people.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Nobody holds this role here.</TableCell></TableRow>}
                          {s.people.map(p => (
                            <TableRow key={p.userId}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell className="capitalize">{p.source === "both" ? "primary and secondary" : p.source} role</TableCell>
                              <TableCell>{p.counted ? <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400"><CheckCircle2 className="h-4 w-4" />Yes</span> : <span className="text-red-700 dark:text-red-400">No</span>}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {p.reason ?? ""}
                                {p.counted && p.expiresInDays !== null && p.expiresInDays <= 60 && `Competence expires in ${p.expiresInDays} day${p.expiresInDays === 1 ? "" : "s"}. `}
                                {p.counted && p.leavingInDays !== null && `Leaving in ${p.leavingInDays} day${p.leavingInDays === 1 ? "" : "s"}.`}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="decisions">
          <Card><CardContent className="pt-6 overflow-x-auto">
            {reviews.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-no-reviews">No shortfalls have been recorded yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Found</TableHead><TableHead>Requirement</TableHead><TableHead>Count</TableHead><TableHead>Status</TableHead><TableHead>Decision</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reviews.map(rv => (
                    <TableRow key={rv.id} data-testid={`row-review-${rv.id}`}>
                      <TableCell className="whitespace-nowrap">{fmtDate(rv.detectedAt)}</TableCell>
                      <TableCell className="font-medium">{rv.roleName} at {rv.scopeName}{rv.dutyToOperate && <Badge variant="outline" className="ml-2">Duty to operate</Badge>}</TableCell>
                      <TableCell className="tabular-nums">{rv.actualCount} of {rv.requiredCount}</TableCell>
                      <TableCell className="capitalize">{rv.status === "open" ? "Awaiting a decision" : rv.status === "decided" ? "Decided, still short" : "Resolved"}{rv.resolvedAt && ` ${fmtDate(rv.resolvedAt)}`}</TableCell>
                      <TableCell className="text-sm">
                        {rv.decision ? (<><div className="font-medium">{DECISION_LABEL[rv.decision]}</div><div className="text-muted-foreground">{rv.decisionComment}</div>{rv.riskAssessmentRef && <div className="text-muted-foreground">Reference: {rv.riskAssessmentRef}</div>}<div className="text-xs text-muted-foreground">{rv.decidedByName} on {fmtDate(rv.decidedAt)}</div></>) : <span className="text-muted-foreground">Not yet decided</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* add / edit a requirement */}
      <Dialog open={!!form} onOpenChange={o => !o && setForm(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Edit the requirement" : "Add a requirement"}</DialogTitle><DialogDescription>For example: at Northfield Terminal, at least 4 people holding the Emergency Response Team Member role.</DialogDescription></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Applies to</Label>
                  <Select value={form.scopeType} onValueChange={v => setForm({ ...form, scopeType: v as any, scopeId: "" })}>
                    <SelectTrigger aria-label="Applies to" data-testid="select-scope-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(SCOPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label>{SCOPE_LABEL[form.scopeType]}</Label>
                  <Select value={form.scopeId || undefined} onValueChange={v => setForm({ ...form, scopeId: v })}>
                    <SelectTrigger aria-label="Scope" data-testid="select-scope"><SelectValue placeholder="Choose one" /></SelectTrigger>
                    <SelectContent className="max-h-64">{scopeOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-1.5"><Label>Job role that must be covered</Label>
                  <Select value={form.jobRoleId || undefined} onValueChange={v => setForm({ ...form, jobRoleId: v })}>
                    <SelectTrigger aria-label="Job role" data-testid="select-role"><SelectValue placeholder="Choose a job role" /></SelectTrigger>
                    <SelectContent className="max-h-64">{roles.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label htmlFor="min">Minimum number</Label><Input id="min" type="number" min={1} value={form.minimumCount} onChange={e => setForm({ ...form, minimumCount: e.target.value })} data-testid="input-minimum" /></div>
              </div>
              <div className="space-y-1.5"><Label>Which of a person's job roles counts</Label>
                <Select value={form.countBy} onValueChange={v => setForm({ ...form, countBy: v as any })}>
                  <SelectTrigger aria-label="Which job role counts" data-testid="select-count-by"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(COUNT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Use "secondary" for duties held on top of a main job, such as emergency response team membership.</p></div>
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3"><div><Label htmlFor="only-comp">Only count people who are currently competent</Label><p className="text-xs text-muted-foreground">They must hold a valid sign-off for every competence element the role requires.</p></div><Switch id="only-comp" checked={form.onlyCompetent} onCheckedChange={v => setForm({ ...form, onlyCompetent: v })} data-testid="switch-only-competent" /></div>
                <div className="flex items-center justify-between gap-3"><div><Label htmlFor="excl-abs">Do not count people on long-term absence</Label></div><Switch id="excl-abs" checked={form.excludeAbsent} onCheckedChange={v => setForm({ ...form, excludeAbsent: v })} data-testid="switch-exclude-absent" /></div>
                <div className="flex items-center justify-between gap-3"><div><Label htmlFor="duty">This is a duty-to-operate requirement</Label><p className="text-xs text-muted-foreground">Required by the safety case or regulation, as opposed to a local target.</p></div><Switch id="duty" checked={form.dutyToOperate} onCheckedChange={v => setForm({ ...form, dutyToOperate: v })} data-testid="switch-duty" /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="legal">Reference (optional)</Label><Input id="legal" value={form.legalReference} onChange={e => setForm({ ...form, legalReference: e.target.value })} placeholder="e.g. Safety case, section 4.2" data-testid="input-legal" /></div>
              <div className="space-y-1.5"><Label htmlFor="notes">Notes (optional)</Label><Textarea id="notes" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Who is alerted when it is not met</Label>
                <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1.5" data-testid="list-notify">
                  {notifyChoices.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notifyUserIds.includes(p.id)} onChange={e => setForm({ ...form, notifyUserIds: e.target.checked ? [...form.notifyUserIds, p.id] : form.notifyUserIds.filter(x => x !== p.id) })} />{`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()} <span className="text-muted-foreground capitalize">({p.role.replace("_", " ")})</span></label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">If nobody is chosen, all administrators are alerted.</p></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button disabled={save.isPending || !form?.scopeId || !form?.jobRoleId || !Number(form?.minimumCount)} onClick={() => form && save.mutate(form)} data-testid="button-save-requirement">{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* the decision */}
      <Dialog open={!!deciding} onOpenChange={o => !o && setDeciding(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Is a risk assessment needed?</DialogTitle>
            <DialogDescription>{deciding && `${deciding.status.roleName} at ${deciding.status.scopeName}: ${deciding.status.actual} of ${deciding.status.required} available.`} Record your decision and why, so there is a trail.</DialogDescription></DialogHeader>
          {deciding && (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Decision</Label>
                <Select value={deciding.decision || undefined} onValueChange={v => setDeciding({ ...deciding, decision: v })}>
                  <SelectTrigger aria-label="Decision" data-testid="select-decision"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{Object.entries(DECISION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label htmlFor="why">Reason</Label><Textarea id="why" rows={3} value={deciding.comment} onChange={e => setDeciding({ ...deciding, comment: e.target.value })} data-testid="input-decision-comment" /></div>
              {deciding.decision === "risk_assessment_required" && <div className="space-y-1.5"><Label htmlFor="ref">Risk assessment reference (optional)</Label><Input id="ref" value={deciding.ref} onChange={e => setDeciding({ ...deciding, ref: e.target.value })} data-testid="input-decision-ref" /></div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeciding(null)}>Cancel</Button>
            <Button disabled={decide.isPending || !deciding?.decision || (deciding?.comment.trim().length ?? 0) < 5} onClick={() => deciding && decide.mutate(deciding)} data-testid="button-save-decision">{decide.isPending ? "Saving..." : "Record decision"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={o => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove this requirement?</DialogTitle><DialogDescription>{removing && `${removing.roleName} at ${removing.scopeName} will no longer be checked. Past decisions are kept.`}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => removing && remove.mutate(removing.requirement.id)} data-testid="button-confirm-remove">Remove</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
