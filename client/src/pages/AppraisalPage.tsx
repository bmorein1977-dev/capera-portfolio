import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, Trash2, Pencil, MessageSquarePlus, Info } from "lucide-react";
import {
  type AppraisalDetail, type Objective, type Outcome, OUTCOME_LABEL, POTENTIAL_LABEL, RATER_LABEL,
  OutcomeBadge, RatingInput, ScoreBar, StatusBadge, StatusStepper, fmtDate, errorText, toDateInput,
} from "@/components/performance/shared";

interface Person { id: string; name: string; jobRole: string | null }

interface FormState {
  selfSummary: string; selfPerformanceRating: number | null; careerAspirations: string; mobility: string;
  managerSummary: string; performanceRating: number | null; potentialRating: number | null; developmentPlan: string;
  objectives: Record<string, { selfOutcome: Outcome | ""; selfComment: string; managerOutcome: Outcome | ""; managerComment: string }>;
  behaviours: Record<string, { selfRating: number | null; selfComment: string; managerRating: number | null; managerComment: string }>;
}

const initForm = (d: AppraisalDetail): FormState => ({
  selfSummary: d.appraisal.selfSummary ?? "", selfPerformanceRating: d.appraisal.selfPerformanceRating ?? null,
  careerAspirations: d.appraisal.careerAspirations ?? "", mobility: d.appraisal.mobility ?? "",
  managerSummary: d.appraisal.managerSummary ?? "", performanceRating: d.appraisal.performanceRating ?? null,
  potentialRating: d.appraisal.potentialRating ?? null, developmentPlan: d.appraisal.developmentPlan ?? "",
  objectives: Object.fromEntries(d.objectives.map(o => [o.id, { selfOutcome: o.selfOutcome ?? "", selfComment: o.selfComment ?? "", managerOutcome: o.managerOutcome ?? "", managerComment: o.managerComment ?? "" }])),
  behaviours: Object.fromEntries(d.behaviours.map(b => [b.behaviour.id, { selfRating: b.selfRating, selfComment: b.selfComment ?? "", managerRating: b.managerRating, managerComment: b.managerComment ?? "" }])),
});

const CATEGORY_LABEL: Record<string, string> = { delivery: "Delivery", safety: "Safety", people: "People", development: "Development" };

function OutcomeSelect({ value, onChange, label }: { value: Outcome | ""; onChange: (v: Outcome) => void; label: string }) {
  return (
    <Select value={value || undefined} onValueChange={v => onChange(v as Outcome)}>
      <SelectTrigger aria-label={label} className="w-44" data-testid={`select-${label.replace(/\s+/g, "-").toLowerCase()}`}><SelectValue placeholder="Choose outcome" /></SelectTrigger>
      <SelectContent>{(Object.keys(OUTCOME_LABEL) as Outcome[]).map(o => <SelectItem key={o} value={o}>{OUTCOME_LABEL[o]}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// The three due dates for this person's review. The manager (or HR) can change them; everyone involved can see them.
function DatesCard({ appraisal, canEdit, saving, onSave }: { appraisal: AppraisalDetail["appraisal"]; canEdit: boolean; saving: boolean; onSave: (d: { objectivesDueDate: string | null; selfReviewDueDate: string | null; managerReviewDueDate: string | null }) => void }) {
  const initial = { objectivesDueDate: toDateInput(appraisal.objectivesDueDate), selfReviewDueDate: toDateInput(appraisal.selfReviewDueDate), managerReviewDueDate: toDateInput(appraisal.managerReviewDueDate) };
  const [d, setD] = useState(initial);
  useEffect(() => { setD(initial); }, [appraisal.objectivesDueDate, appraisal.selfReviewDueDate, appraisal.managerReviewDueDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = d.objectivesDueDate !== initial.objectivesDueDate || d.selfReviewDueDate !== initial.selfReviewDueDate || d.managerReviewDueDate !== initial.managerReviewDueDate;
  const items: Array<[keyof typeof d, string]> = [["objectivesDueDate", "Objectives agreed by"], ["selfReviewDueDate", "Self assessment due"], ["managerReviewDueDate", "Manager review due"]];
  if (!canEdit && !items.some(([k]) => d[k])) return null;
  return (
    <Card data-testid="card-dates">
      <CardContent className="py-4 flex flex-wrap items-end gap-4">
        {items.map(([k, label]) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={`date-${k}`} className="text-xs text-muted-foreground">{label}</Label>
            {canEdit
              ? <Input id={`date-${k}`} type="date" className="w-44" value={d[k]} onChange={e => setD({ ...d, [k]: e.target.value })} data-testid={`input-${k}`} />
              : <div className="text-sm font-medium" data-testid={`text-${k}`}>{d[k] ? fmtDate(d[k]) : "No date set"}</div>}
          </div>
        ))}
        {canEdit && <Button size="sm" variant="outline" disabled={!changed || saving} onClick={() => onSave({ objectivesDueDate: d.objectivesDueDate || null, selfReviewDueDate: d.selfReviewDueDate || null, managerReviewDueDate: d.managerReviewDueDate || null })} data-testid="button-save-dates">Save dates</Button>}
        <p className="basis-full text-xs text-muted-foreground">Reminders are sent from 30 days before each date.</p>
      </CardContent>
    </Card>
  );
}

export default function AppraisalPage({ id }: { id: string }) {
  const { toast } = useToast();
  const key = `/api/performance/appraisals/${id}`;
  const { data, isLoading, error } = useQuery<AppraisalDetail>({ queryKey: [key] });
  const { data: people = [] } = useQuery<Person[]>({ queryKey: ["/api/performance/people"] });
  const [form, setForm] = useState<FormState | null>(null);
  const [objDialog, setObjDialog] = useState<Partial<Objective> | null>(null);
  const [checkIn, setCheckIn] = useState<{ objective: Objective; note: string; progress: string } | null>(null);
  const [raterDialog, setRaterDialog] = useState<{ raterId: string; raterType: string } | null>(null);
  const [meetingDate, setMeetingDate] = useState("");
  const [signComment, setSignComment] = useState("");
  const [calibration, setCalibration] = useState<{ performanceRating: number | null; potentialRating: number | null; note: string }>({ performanceRating: null, potentialRating: null, note: "" });

  useEffect(() => { if (data) { setForm(initForm(data)); setCalibration(c => ({ ...c, performanceRating: data.appraisal.performanceRating ?? null, potentialRating: data.appraisal.potentialRating ?? null })); setSignComment(data.appraisal.employeeComments ?? ""); } }, [data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [key] });
    queryClient.invalidateQueries({ queryKey: ["/api/performance/my"] });
    queryClient.invalidateQueries({ queryKey: ["/api/performance/team"] });
  };
  const run = useMutation({
    mutationFn: async (v: { method: string; url: string; body?: unknown; ok: string }) => (await apiRequest(v.method, v.url, v.body)).json(),
    onSuccess: (_r, v) => { refresh(); toast({ title: v.ok }); },
    onError: (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" }),
  });

  const totalWeight = useMemo(() => (data?.objectives ?? []).reduce((s, o) => s + o.weighting, 0), [data]);

  if (isLoading || !form) return <div className="p-6 text-muted-foreground">Loading appraisal...</div>;
  if (error || !data) return (
    <div className="p-6 space-y-3">
      <Alert variant="destructive"><AlertTitle>You cannot open this appraisal</AlertTitle><AlertDescription>{errorText(error)}</AlertDescription></Alert>
      <Link href="/my-performance"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
    </div>
  );

  const { appraisal, cycle, employee, manager, objectives, behaviours, feedback, permissions: p } = data;
  const scale = cycle.ratingScale;
  const editingSelf = p.canSubmitSelf;
  const editingMgr = p.canSubmitManager;
  // the employee sees the manager's side only after the manager has held the discussion and shared the report
  const managerVisible = p.isManager || p.isAdmin || !!appraisal.sharedAt;
  const employeeView = p.isEmployee && !p.isManager && !p.isAdmin;
  const reviewStarted = appraisal.status !== "objectives";
  const allAgreed = objectives.length > 0 && objectives.every(o => o.status !== "draft");

  const setObj = (oid: string, patch: Partial<FormState["objectives"][string]>) => setForm(f => f && ({ ...f, objectives: { ...f.objectives, [oid]: { ...f.objectives[oid], ...patch } } }));
  const setBeh = (bid: string, patch: Partial<FormState["behaviours"][string]>) => setForm(f => f && ({ ...f, behaviours: { ...f.behaviours, [bid]: { ...f.behaviours[bid], ...patch } } }));

  const selfPayload = () => ({
    selfSummary: form.selfSummary, selfPerformanceRating: form.selfPerformanceRating, careerAspirations: form.careerAspirations, mobility: form.mobility,
    objectives: objectives.map(o => ({ id: o.id, selfOutcome: form.objectives[o.id].selfOutcome || null, selfComment: form.objectives[o.id].selfComment })),
    behaviours: behaviours.map(b => ({ behaviourId: b.behaviour.id, selfRating: form.behaviours[b.behaviour.id].selfRating, selfComment: form.behaviours[b.behaviour.id].selfComment })),
  });
  const managerPayload = () => ({
    managerSummary: form.managerSummary, performanceRating: form.performanceRating, potentialRating: form.potentialRating, developmentPlan: form.developmentPlan,
    objectives: objectives.map(o => ({ id: o.id, managerOutcome: form.objectives[o.id].managerOutcome || null, managerComment: form.objectives[o.id].managerComment })),
    behaviours: behaviours.map(b => ({ behaviourId: b.behaviour.id, managerRating: form.behaviours[b.behaviour.id].managerRating, managerComment: form.behaviours[b.behaviour.id].managerComment })),
  });

  // plain-English "whose turn is it" for the signed-in person
  let nextStep = "";
  if (appraisal.status === "objectives") nextStep = p.canEditObjectives ? (allAgreed ? (p.isManager || p.isAdmin ? "Objectives are agreed. Start the self assessment when the review period begins: the employee is emailed and reminders begin." : "Your objectives are agreed. Your manager will open your self assessment when the review period begins, and you will be emailed.") : "Set objectives with weightings that add up to 100%. Your manager then agrees them.") : "";
  if (appraisal.status === "self_review") nextStep = p.isEmployee ? "Your turn: complete your self review and submit it to your manager." : "Waiting for the employee to submit their self review.";
  if (appraisal.status === "manager_review") nextStep = (p.isManager || p.isAdmin) ? "Your turn: complete the manager review. Rate each objective and behaviour, then submit." : "Your self review is with your manager.";
  if (appraisal.status === "calibration") nextStep = p.isAdmin ? "Calibration: review the ratings for consistency, then send on for the review discussion." : "HR is checking ratings for consistency before your discussion.";
  if (appraisal.status === "meeting") nextStep = appraisal.sharedAt
    ? (p.isEmployee ? "Your manager has shared your report. Read it and sign it off when you are happy." : "The report has been shared. Sign off once you have both agreed it.")
    : (p.isManager || p.isAdmin ? "Your review is complete. Hold the discussion with them, then share the report." : "Your manager has finished their review. They will discuss it with you and then share the report.");
  if (appraisal.status === "signed_off") nextStep = "This appraisal is complete.";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <Link href={p.isEmployee && !p.isManager ? "/my-performance" : "/team-performance"}>
        <Button variant="ghost" size="sm" data-testid="button-back"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      </Link>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl" data-testid="text-employee-name">{employee?.name}</CardTitle>
              <CardDescription>{employee?.jobRole ?? "No job role"} · {cycle.name}{manager ? ` · Manager: ${manager.name}` : ""}</CardDescription>
            </div>
            <StatusBadge status={appraisal.status} />
          </div>
          <StatusStepper status={appraisal.status} requiresCalibration={cycle.requiresCalibration} />
        </CardHeader>
        {nextStep && (
          <CardContent><Alert><Info className="h-4 w-4" /><AlertDescription data-testid="text-next-step">{nextStep}</AlertDescription></Alert></CardContent>
        )}
      </Card>

      <DatesCard appraisal={appraisal} canEdit={p.canEditDates} saving={run.isPending}
        onSave={dates => run.mutate({ method: "PUT", url: `${key}/dates`, body: dates, ok: "Dates saved" })} />

      <Tabs defaultValue={appraisal.status === "objectives" ? "objectives" : appraisal.status === "meeting" || appraisal.status === "signed_off" ? "signoff" : "review"}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="objectives" data-testid="tab-objectives">Objectives</TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review">Reviews</TabsTrigger>
          {cycle.includes360 && <TabsTrigger value="feedback" data-testid="tab-feedback">360 feedback</TabsTrigger>}
          <TabsTrigger value="signoff" data-testid="tab-signoff">Discussion and sign-off</TabsTrigger>
        </TabsList>

        {/* ---------------- OBJECTIVES ---------------- */}
        <TabsContent value="objectives" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              Total weighting: <span className={totalWeight === 100 ? "font-semibold text-green-600" : "font-semibold text-amber-600"} data-testid="text-total-weight">{totalWeight}%</span>
              <span className="text-muted-foreground"> (must be 100% to agree)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.canEditObjectives && <Button size="sm" onClick={() => setObjDialog({ category: "delivery", weighting: Math.max(0, 100 - totalWeight) })} data-testid="button-add-objective"><Plus className="h-4 w-4 mr-1" />Add objective</Button>}
              {(p.isManager || p.isAdmin) && appraisal.status === "objectives" && !allAgreed && objectives.length > 0 && (
                <Button size="sm" variant="secondary" disabled={run.isPending} onClick={() => run.mutate({ method: "POST", url: `${key}/agree-objectives`, ok: "Objectives agreed" })} data-testid="button-agree-objectives">Agree objectives</Button>
              )}
              {(p.isManager || p.isAdmin) && appraisal.status === "objectives" && allAgreed && (
                <Button size="sm" variant="secondary" disabled={run.isPending} onClick={() => run.mutate({ method: "POST", url: `${key}/start-self-review`, ok: "Self review started" })} data-testid="button-start-self-review">Start self review</Button>
              )}
            </div>
          </div>
          {objectives.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">No objectives yet. {p.canEditObjectives ? "Add the first one to get started." : ""}</CardContent></Card>}
          {objectives.map(o => (
            <Card key={o.id} data-testid={`card-objective-${o.id}`}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{o.title}</CardTitle>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{CATEGORY_LABEL[o.category] ?? o.category}</Badge>
                      <Badge variant="secondary">{o.weighting}% of total</Badge>
                      <Badge variant="outline">{o.status === "draft" ? "Not yet agreed" : o.status === "complete" ? "Complete" : "Agreed"}</Badge>
                      {o.targetDate && <span className="text-muted-foreground self-center">Due {fmtDate(o.targetDate)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {appraisal.status !== "signed_off" && <Button size="sm" variant="outline" onClick={() => setCheckIn({ objective: o, note: "", progress: String(o.progressPercent) })} data-testid={`button-checkin-${o.id}`}><MessageSquarePlus className="h-4 w-4 mr-1" />Check-in</Button>}
                    {p.canEditObjectives && <Button size="icon" variant="ghost" aria-label="Edit objective" onClick={() => setObjDialog(o)}><Pencil className="h-4 w-4" /></Button>}
                    {p.canEditObjectives && <Button size="icon" variant="ghost" aria-label="Delete objective" onClick={() => run.mutate({ method: "DELETE", url: `/api/performance/objectives/${o.id}`, ok: "Objective removed" })}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {o.description && <p>{o.description}</p>}
                {o.successMeasure && <p><span className="text-muted-foreground">How it will be measured: </span>{o.successMeasure}</p>}
                <div className="flex items-center gap-3"><span className="text-muted-foreground">Progress</span><ScoreBar value={o.progressPercent} /></div>
                {o.updates.length > 0 && (
                  <ul className="space-y-1.5 border-l-2 pl-3">
                    {o.updates.slice(0, 4).map(u => <li key={u.id} className="text-muted-foreground"><span className="text-foreground">{u.note}</span>{u.progressPercent != null ? ` (${u.progressPercent}%)` : ""} · {fmtDate(u.createdAt)}</li>)}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ---------------- REVIEWS ---------------- */}
        <TabsContent value="review" className="space-y-4">
          {!reviewStarted ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Reviews open once the objectives are agreed and the self review has started.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-lg">Objectives: how did they turn out?</CardTitle><CardDescription>Each objective is judged by the employee and by the manager.</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                  {objectives.map(o => (
                    <div key={o.id} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr] border-b pb-4 last:border-0">
                      <div><div className="font-medium">{o.title}</div><div className="text-xs text-muted-foreground">{o.weighting}% of total</div></div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Employee</Label>
                        {editingSelf ? (<>
                          <OutcomeSelect label={`Self outcome ${o.title}`} value={form.objectives[o.id].selfOutcome} onChange={v => setObj(o.id, { selfOutcome: v })} />
                          <Textarea rows={2} placeholder="Evidence and comments" value={form.objectives[o.id].selfComment} onChange={e => setObj(o.id, { selfComment: e.target.value })} />
                        </>) : (<><OutcomeBadge outcome={o.selfOutcome} />{o.selfComment && <p className="text-sm">{o.selfComment}</p>}</>)}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Manager</Label>
                        {editingMgr ? (<>
                          <OutcomeSelect label={`Manager outcome ${o.title}`} value={form.objectives[o.id].managerOutcome} onChange={v => setObj(o.id, { managerOutcome: v })} />
                          <Textarea rows={2} placeholder="Your assessment" value={form.objectives[o.id].managerComment} onChange={e => setObj(o.id, { managerComment: e.target.value })} />
                        </>) : managerVisible ? (<><OutcomeBadge outcome={o.managerOutcome} />{o.managerComment && <p className="text-sm">{o.managerComment}</p>}</>) : <span className="text-sm text-muted-foreground">Shared after your discussion</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Behaviours: how it was done</CardTitle><CardDescription>Rate each behaviour from 1 (low) to {scale} (high).</CardDescription></CardHeader>
                <CardContent className="space-y-5">
                  {behaviours.map(b => (
                    <div key={b.behaviour.id} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr] border-b pb-4 last:border-0">
                      <div>
                        <div className="font-medium">{b.behaviour.name}</div>
                        <div className="text-xs text-muted-foreground">{b.behaviour.description}</div>
                        {b.behaviour.indicators && b.behaviour.indicators.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">{b.behaviour.indicators.map(i => <li key={i}>{i}</li>)}</ul>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Employee</Label>
                        <RatingInput label={`Self ${b.behaviour.name}`} scale={scale} value={editingSelf ? form.behaviours[b.behaviour.id].selfRating : b.selfRating} onChange={editingSelf ? n => setBeh(b.behaviour.id, { selfRating: n }) : undefined} />
                        {editingSelf ? <Input placeholder="Example (optional)" value={form.behaviours[b.behaviour.id].selfComment} onChange={e => setBeh(b.behaviour.id, { selfComment: e.target.value })} /> : b.selfComment && <p className="text-sm">{b.selfComment}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Manager</Label>
                        {editingMgr ? (<>
                          <RatingInput label={`Manager ${b.behaviour.name}`} scale={scale} value={form.behaviours[b.behaviour.id].managerRating} onChange={n => setBeh(b.behaviour.id, { managerRating: n })} />
                          <Input placeholder="Example (optional)" value={form.behaviours[b.behaviour.id].managerComment} onChange={e => setBeh(b.behaviour.id, { managerComment: e.target.value })} />
                        </>) : managerVisible ? (<><RatingInput label={`Manager view ${b.behaviour.name}`} scale={scale} value={b.managerRating} />{b.managerComment && <p className="text-sm">{b.managerComment}</p>}</>) : <span className="text-sm text-muted-foreground">Shared after your discussion</span>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Employee summary</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1"><Label>Summary of my year</Label>
                      {editingSelf ? <Textarea rows={4} value={form.selfSummary} onChange={e => setForm({ ...form, selfSummary: e.target.value })} data-testid="input-self-summary" /> : <p className="text-sm whitespace-pre-wrap">{appraisal.selfSummary || "Not yet written"}</p>}</div>
                    <div className="space-y-1"><Label>Overall rating of my performance</Label>
                      <RatingInput label="Self overall" scale={scale} value={editingSelf ? form.selfPerformanceRating : appraisal.selfPerformanceRating} onChange={editingSelf ? n => setForm({ ...form, selfPerformanceRating: n }) : undefined} /></div>
                    <div className="space-y-1"><Label>Career aspirations</Label>
                      {editingSelf ? <Textarea rows={2} value={form.careerAspirations} onChange={e => setForm({ ...form, careerAspirations: e.target.value })} /> : <p className="text-sm whitespace-pre-wrap">{appraisal.careerAspirations || "Not provided"}</p>}</div>
                    <div className="space-y-1"><Label>Mobility (sites and roles I would consider)</Label>
                      {editingSelf ? <Input value={form.mobility} onChange={e => setForm({ ...form, mobility: e.target.value })} /> : <p className="text-sm">{appraisal.mobility || "Not provided"}</p>}</div>
                    {editingSelf && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate({ method: "PUT", url: `${key}/self-review`, body: selfPayload(), ok: "Draft saved" })} data-testid="button-save-self">Save draft</Button>
                        <Button disabled={run.isPending} onClick={() => run.mutate({ method: "PUT", url: `${key}/self-review?submit=1`, body: selfPayload(), ok: "Self review submitted to your manager" })} data-testid="button-submit-self">Submit self review</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">Manager summary</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {!(editingMgr || managerVisible) ? <p className="text-sm text-muted-foreground">Shared after your discussion with your manager.</p> : (<>
                      <div className="space-y-1"><Label>Manager's summary</Label>
                        {editingMgr ? <Textarea rows={4} value={form.managerSummary} onChange={e => setForm({ ...form, managerSummary: e.target.value })} data-testid="input-manager-summary" /> : <p className="text-sm whitespace-pre-wrap">{appraisal.managerSummary || "Not yet written"}</p>}</div>
                      <div className="space-y-1"><Label>Overall performance rating</Label>
                        <RatingInput label="Manager overall" scale={scale} value={editingMgr ? form.performanceRating : appraisal.performanceRating} onChange={editingMgr ? n => setForm({ ...form, performanceRating: n }) : undefined} /></div>
                      {(editingMgr || p.isManager || p.isAdmin) && (
                        <div className="space-y-1"><Label>Potential (not shown to the employee)</Label>
                          <div className="flex gap-2">{[1, 2, 3].map(n => (
                            <Button key={n} type="button" size="sm" variant={(editingMgr ? form.potentialRating : appraisal.potentialRating) === n ? "default" : "outline"} disabled={!editingMgr}
                              onClick={() => setForm({ ...form, potentialRating: n })} data-testid={`potential-${n}`}>{POTENTIAL_LABEL[n]}</Button>))}</div></div>
                      )}
                      <div className="space-y-1"><Label>Development plan</Label>
                        {editingMgr ? <Textarea rows={3} value={form.developmentPlan} onChange={e => setForm({ ...form, developmentPlan: e.target.value })} /> : <p className="text-sm whitespace-pre-wrap">{appraisal.developmentPlan || "Not yet written"}</p>}</div>
                      {editingMgr && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate({ method: "PUT", url: `${key}/manager-review`, body: managerPayload(), ok: "Draft saved" })} data-testid="button-save-manager">Save draft</Button>
                          <Button disabled={run.isPending} onClick={() => run.mutate({ method: "PUT", url: `${key}/manager-review?submit=1`, body: managerPayload(), ok: "Manager review submitted" })} data-testid="button-submit-manager">Submit manager review</Button>
                        </div>
                      )}
                    </>)}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------------- 360 ---------------- */}
        {cycle.includes360 && feedback && (
          <TabsContent value="feedback" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><CardTitle className="text-lg">Who has been asked</CardTitle><CardDescription>Colleagues rate the same behaviours. Answers are anonymous and only shown as averages once at least {feedback.summary.minRaters} people have responded.</CardDescription></div>
                  {appraisal.status !== "signed_off" && cycle.status === "open" && <Button size="sm" onClick={() => setRaterDialog({ raterId: "", raterType: "peer" })} data-testid="button-add-rater"><Plus className="h-4 w-4 mr-1" />Add a rater</Button>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {feedback.requests.length === 0 && <p className="text-sm text-muted-foreground">Nobody has been asked yet. Aim for at least {feedback.summary.minRaters} people.</p>}
                {feedback.requests.map(r => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2" data-testid={`rater-${r.id}`}>
                    <div className="text-sm">{r.raterName ?? "A colleague"} <span className="text-muted-foreground">· {RATER_LABEL[r.raterType] ?? r.raterType}</span></div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "completed" ? "default" : r.status === "proposed" ? "outline" : "secondary"}>{r.status === "approved" ? "Waiting for answer" : r.status === "proposed" ? "Waiting for manager approval" : r.status === "completed" ? "Answered" : r.status}</Badge>
                      {r.status === "proposed" && (p.isManager || p.isAdmin) && (<>
                        <Button size="sm" onClick={() => run.mutate({ method: "POST", url: `/api/performance/raters/${r.id}/decision`, body: { approve: true }, ok: "Rater approved" })}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => run.mutate({ method: "POST", url: `/api/performance/raters/${r.id}/decision`, body: { approve: false }, ok: "Rater declined" })}>Reject</Button>
                      </>)}
                      {r.status !== "completed" && (p.isManager || p.isAdmin || r.proposedByMe) && <Button size="icon" variant="ghost" aria-label="Remove rater" onClick={() => run.mutate({ method: "DELETE", url: `/api/performance/raters/${r.id}`, ok: "Rater removed" })}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">What they said</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {!feedback.summary.visible ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-feedback-hidden">
                    {feedback.summary.completedCount} of the minimum {feedback.summary.minRaters} responses received. Results appear once enough people have answered{employeeView ? " and your manager has shared your report" : ""}.
                  </p>
                ) : (<>
                  <div className="space-y-2">
                    {behaviours.map(b => {
                      const avg = feedback.summary.overall?.[b.behaviour.id];
                      return (
                        <div key={b.behaviour.id} className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
                          <span className="text-sm">{b.behaviour.name}</span>
                          <div className="hidden sm:block"><ScoreBar value={avg != null ? ((avg - 1) / (scale - 1)) * 100 : null} /></div>
                          <span className="text-sm tabular-nums">{avg != null ? `${avg.toFixed(1)} / ${scale}` : "n/a"}</span>
                        </div>
                      );
                    })}
                  </div>
                  {feedback.summary.groups && feedback.summary.groups.length > 0 && (
                    <div className="text-sm text-muted-foreground">Groups with enough responses to show separately: {feedback.summary.groups.map(g => `${RATER_LABEL[g.raterType] ?? g.raterType} (${g.count})`).join(", ")}.</div>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><div className="mb-1 text-sm font-medium">Strengths mentioned</div><ul className="list-disc pl-5 text-sm space-y-1">{(feedback.summary.strengths ?? []).map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                    <div><div className="mb-1 text-sm font-medium">Areas to develop</div><ul className="list-disc pl-5 text-sm space-y-1">{(feedback.summary.development ?? []).map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  </div>
                </>)}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ---------------- SIGN-OFF ---------------- */}
        <TabsContent value="signoff" className="space-y-4">
          {appraisal.scores && !employeeView && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Results</CardTitle><CardDescription>A summary of the ratings, for managers and HR. It is not shown to the employee.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between"><span className="text-sm">Objectives met</span><ScoreBar value={appraisal.scores.objectives} /></div>
                <div className="flex items-center justify-between"><span className="text-sm">Overall rating</span><ScoreBar value={appraisal.scores.performance} /></div>
                <div className="flex items-center justify-between"><span className="text-sm">Behaviours (manager)</span><ScoreBar value={appraisal.scores.behaviours} /></div>
                <div className="flex items-center justify-between"><span className="text-sm">360 feedback</span><ScoreBar value={appraisal.scores.feedback360} label="Not enough responses" /></div>
              </CardContent>
            </Card>
          )}

          {p.canCalibrate && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Calibration</CardTitle><CardDescription>Adjust ratings only where needed for consistency, and explain why.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1"><Label>Overall performance rating</Label><RatingInput label="Calibrated overall" scale={scale} value={calibration.performanceRating} onChange={n => setCalibration({ ...calibration, performanceRating: n })} /></div>
                <div className="space-y-1"><Label>Potential</Label><div className="flex gap-2">{[1, 2, 3].map(n => <Button key={n} size="sm" variant={calibration.potentialRating === n ? "default" : "outline"} onClick={() => setCalibration({ ...calibration, potentialRating: n })}>{POTENTIAL_LABEL[n]}</Button>)}</div></div>
                <Textarea rows={2} placeholder="Calibration note" value={calibration.note} onChange={e => setCalibration({ ...calibration, note: e.target.value })} />
                <Button disabled={run.isPending} onClick={() => run.mutate({ method: "POST", url: `${key}/calibrate`, body: { performanceRating: calibration.performanceRating, potentialRating: calibration.potentialRating, calibrationNote: calibration.note }, ok: "Calibration complete" })}>Send on for the discussion</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-lg">Discussion, sharing and sign-off</CardTitle><CardDescription>The manager completes their review, meets the employee, then shares the final report. Sign-off follows.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {appraisal.sharedAt
                ? <div className="text-sm" data-testid="text-shared">Discussion held {appraisal.meetingDate ? fmtDate(appraisal.meetingDate) : ""}. Report shared {fmtDate(appraisal.sharedAt)}.</div>
                : <div className="text-sm text-muted-foreground" data-testid="text-not-shared">{appraisal.status === "meeting" ? (employeeView ? "Your manager will discuss the review with you and then share the report." : "Not shared yet.") : "Not shared yet. This happens after the manager review is complete."}</div>}
              {p.canShare && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm">When you have held the discussion, record the date and share the report. {employee?.name ?? "They"} will be notified and can then read the full review and sign it off.</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1"><Label htmlFor="meeting-date">Date of the discussion</Label><Input id="meeting-date" type="date" max={new Date().toISOString().slice(0, 10)} value={meetingDate} onChange={e => setMeetingDate(e.target.value)} data-testid="input-discussion-date" /></div>
                    <Button disabled={run.isPending} onClick={() => run.mutate({ method: "POST", url: `${key}/share`, body: { meetingDate: meetingDate || undefined }, ok: "Report shared" })} data-testid="button-share-report">Discussion held: share the report</Button>
                  </div>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>Employee: {appraisal.employeeSignedOffAt ? <Badge>Signed {fmtDate(appraisal.employeeSignedOffAt)}</Badge> : <Badge variant="outline">Not yet signed</Badge>}</div>
                <div>Manager: {appraisal.managerSignedOffAt ? <Badge>Signed {fmtDate(appraisal.managerSignedOffAt)}</Badge> : <Badge variant="outline">Not yet signed</Badge>}</div>
              </div>
              {p.canSignOff && (
                <div className="space-y-2">
                  {p.isEmployee && <div className="space-y-1"><Label htmlFor="sign-comment">Your comments (optional)</Label><Textarea id="sign-comment" rows={2} value={signComment} onChange={e => setSignComment(e.target.value)} /></div>}
                  {((p.isEmployee && !appraisal.employeeSignedOffAt) || ((p.isManager || p.isAdmin) && !p.isEmployee && !appraisal.managerSignedOffAt)) && (
                    <Button disabled={run.isPending} onClick={() => run.mutate({ method: "POST", url: `${key}/sign-off`, body: { comments: signComment }, ok: "Signed off" })} data-testid="button-sign-off">Sign off</Button>
                  )}
                </div>
              )}
              {!p.isEmployee && appraisal.employeeComments && <div className="text-sm"><span className="text-muted-foreground">Employee comments: </span>{appraisal.employeeComments}</div>}
              {p.isAdmin && appraisal.status !== "objectives" && (
                <div className="border-t pt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">HR correction:</span>
                  <Select onValueChange={v => run.mutate({ method: "POST", url: `${key}/reopen`, body: { status: v }, ok: "Appraisal reopened" })}>
                    <SelectTrigger className="w-56" aria-label="Reopen at stage"><SelectValue placeholder="Reopen at an earlier stage" /></SelectTrigger>
                    <SelectContent><SelectItem value="objectives">Objectives</SelectItem><SelectItem value="self_review">Self review</SelectItem><SelectItem value="manager_review">Manager review</SelectItem><SelectItem value="meeting">Discussion (not yet shared)</SelectItem></SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* objective add / edit */}
      <Dialog open={!!objDialog} onOpenChange={o => !o && setObjDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{objDialog?.id ? "Edit objective" : "New objective"}</DialogTitle><DialogDescription>Say what will be achieved and how you will know. Editing an agreed objective sends it back for agreement.</DialogDescription></DialogHeader>
          {objDialog && (
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="obj-title">Title</Label><Input id="obj-title" value={objDialog.title ?? ""} onChange={e => setObjDialog({ ...objDialog, title: e.target.value })} data-testid="input-objective-title" /></div>
              <div className="space-y-1"><Label htmlFor="obj-desc">Description</Label><Textarea id="obj-desc" rows={2} value={objDialog.description ?? ""} onChange={e => setObjDialog({ ...objDialog, description: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="obj-measure">How will it be measured?</Label><Input id="obj-measure" value={objDialog.successMeasure ?? ""} onChange={e => setObjDialog({ ...objDialog, successMeasure: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label htmlFor="obj-weight">Weighting %</Label><Input id="obj-weight" type="number" min={0} max={100} value={objDialog.weighting ?? 0} onChange={e => setObjDialog({ ...objDialog, weighting: Number(e.target.value) })} data-testid="input-objective-weighting" /></div>
                <div className="space-y-1"><Label>Category</Label>
                  <Select value={objDialog.category ?? "delivery"} onValueChange={v => setObjDialog({ ...objDialog, category: v })}><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label htmlFor="obj-date">Target date</Label><Input id="obj-date" type="date" value={objDialog.targetDate ? String(objDialog.targetDate).slice(0, 10) : ""} onChange={e => setObjDialog({ ...objDialog, targetDate: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjDialog(null)}>Cancel</Button>
            <Button disabled={run.isPending || !objDialog?.title?.trim()} data-testid="button-save-objective" onClick={() => {
              const o = objDialog!; const body = { title: o.title, description: o.description, successMeasure: o.successMeasure, weighting: o.weighting, category: o.category, targetDate: o.targetDate || null };
              run.mutate({ method: o.id ? "PUT" : "POST", url: o.id ? `/api/performance/objectives/${o.id}` : `${key}/objectives`, body, ok: o.id ? "Objective updated" : "Objective added" });
              setObjDialog(null);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* check-in */}
      <Dialog open={!!checkIn} onOpenChange={o => !o && setCheckIn(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Check-in</DialogTitle><DialogDescription>{checkIn?.objective.title}</DialogDescription></DialogHeader>
          {checkIn && (
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="ci-note">What has happened since the last update?</Label><Textarea id="ci-note" rows={3} value={checkIn.note} onChange={e => setCheckIn({ ...checkIn, note: e.target.value })} data-testid="input-checkin-note" /></div>
              <div className="space-y-1"><Label htmlFor="ci-progress">Progress %</Label><Input id="ci-progress" type="number" min={0} max={100} value={checkIn.progress} onChange={e => setCheckIn({ ...checkIn, progress: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckIn(null)}>Cancel</Button>
            <Button disabled={run.isPending || !checkIn?.note.trim()} data-testid="button-save-checkin" onClick={() => {
              run.mutate({ method: "POST", url: `/api/performance/objectives/${checkIn!.objective.id}/updates`, body: { note: checkIn!.note, progressPercent: Number(checkIn!.progress) }, ok: "Check-in saved" });
              setCheckIn(null);
            }}>Save check-in</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* add rater */}
      <Dialog open={!!raterDialog} onOpenChange={o => !o && setRaterDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a rater</DialogTitle><DialogDescription>Choose a colleague who has seen {employee?.name}'s work. {p.isEmployee && !p.isManager ? "Your manager approves the list before anyone is asked." : ""}</DialogDescription></DialogHeader>
          {raterDialog && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Person</Label>
                <Select value={raterDialog.raterId || undefined} onValueChange={v => setRaterDialog({ ...raterDialog, raterId: v })}>
                  <SelectTrigger aria-label="Person" data-testid="select-rater"><SelectValue placeholder="Choose a colleague" /></SelectTrigger>
                  <SelectContent className="max-h-72">{people.filter(x => x.id !== employee?.id && x.id !== manager?.id).map(x => <SelectItem key={x.id} value={x.id}>{x.name}{x.jobRole ? ` · ${x.jobRole}` : ""}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Their working relationship</Label>
                <Select value={raterDialog.raterType} onValueChange={v => setRaterDialog({ ...raterDialog, raterType: v })}>
                  <SelectTrigger aria-label="Relationship"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(RATER_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRaterDialog(null)}>Cancel</Button>
            <Button disabled={run.isPending || !raterDialog?.raterId} data-testid="button-save-rater" onClick={() => {
              run.mutate({ method: "POST", url: `${key}/raters`, body: raterDialog, ok: p.isManager || p.isAdmin ? "Rater added" : "Rater proposed to your manager" });
              setRaterDialog(null);
            }}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
