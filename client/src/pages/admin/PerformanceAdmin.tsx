import { useEffect, useMemo, useState } from "react";
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
import { Plus, Pencil, Rocket, Lock, Play } from "lucide-react";
import { STATUS_LABEL, STATUS_ORDER, errorText, fmtDate, type Cycle } from "@/components/performance/shared";

type CycleRow = Cycle & { appraisalCounts: Record<string, number>; appraisalTotal: number };
interface Behaviour { id: string; name: string; description: string | null; indicators: string[] | null; order: number | null; isActive: boolean | null }
interface Settings {
  weightCompetence: number; weightTraining: number; weightExperience: number; weightQualifications: number; weightPerformance: number;
  experienceYearsForFull: number; reviewWindowMonths: number; perfWeightObjectives: number; perfWeightRating: number; perfWeightBehaviours: number;
  feedbackShareOfBehaviours: number; minFeedbackRaters: number; minComponentsForScore: number; includePerformanceInScore: boolean;
}
interface Person { id: string; name: string; jobRole: string | null }

const WEIGHTS: Array<[keyof Settings, string, string]> = [
  ["weightCompetence", "Competence", "Share of the role's required standards a person holds and keeps current"],
  ["weightTraining", "Training", "Share of the role's required courses completed and in date"],
  ["weightExperience", "Experience", "Years in the same kind of work, from the recorded career history"],
  ["weightQualifications", "Qualifications", "Highest qualification level held, plus a little for each additional one"],
  ["weightPerformance", "Last review", "Objectives met, overall rating and behaviours (with 360 feedback) from the latest signed-off review"],
];

export default function PerformanceAdmin() {
  const { toast } = useToast();
  const onError = (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" });

  // ---------- cycles ----------
  const { data: cycles = [] } = useQuery<CycleRow[]>({ queryKey: ["/api/performance/cycles"] });
  const { data: people = [] } = useQuery<Person[]>({ queryKey: ["/api/performance/people"] });
  const [cycleDialog, setCycleDialog] = useState<Partial<Cycle> | null>(null);
  const [launching, setLaunching] = useState<CycleRow | null>(null);
  const [fallback, setFallback] = useState<string>("none");
  const [launchMode, setLaunchMode] = useState<"open_only" | "everyone">("open_only");
  const saveCycle = useMutation({
    mutationFn: async (c: Partial<Cycle>) => (await apiRequest(c.id ? "PUT" : "POST", c.id ? `/api/performance/cycles/${c.id}` : "/api/performance/cycles", c)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/performance/cycles"] }); setCycleDialog(null); toast({ title: "Cycle saved" }); }, onError,
  });
  const cycleAction = useMutation({
    mutationFn: async (v: { url: string; body?: unknown; ok: string }) => ({ ...(await (await apiRequest("POST", v.url, v.body)).json()), _ok: v.ok }),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/cycles"] });
      const extra = r.openedOnly ? "The cycle is open. Managers can now start reviews for their own people." : r.created !== undefined ? `${r.created} appraisals created${r.skippedNoManager ? `, ${r.skippedNoManager} people skipped (no line manager)` : ""}.` : r.moved !== undefined ? `${r.moved} appraisals moved on.` : "";
      toast({ title: r._ok, description: extra || undefined });
    }, onError,
  });

  // ---------- behaviours ----------
  const { data: behaviours = [] } = useQuery<Behaviour[]>({ queryKey: ["/api/performance/behaviours", { all: 1 }] });
  const [behDialog, setBehDialog] = useState<{ id?: string; name: string; description: string; indicators: string; isActive: boolean } | null>(null);
  const refreshBehaviours = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/performance/behaviours") });
  const saveBehaviour = useMutation({
    mutationFn: async (b: NonNullable<typeof behDialog>) => (await apiRequest(b.id ? "PUT" : "POST", b.id ? `/api/performance/behaviours/${b.id}` : "/api/performance/behaviours", {
      name: b.name, description: b.description, indicators: b.indicators.split("\n").map(s => s.trim()).filter(Boolean), isActive: b.isActive, order: behaviours.length,
    })).json(),
    onSuccess: () => { refreshBehaviours(); setBehDialog(null); toast({ title: "Behaviour saved" }); }, onError,
  });
  const starter = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/performance/behaviours/starter")).json(),
    onSuccess: (r: any) => { refreshBehaviours(); toast({ title: r.created ? "Starter behaviours added" : "You already have behaviours" }); }, onError,
  });

  // ---------- talent score settings ----------
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/talent-score/settings"] });
  const [draft, setDraft] = useState<Settings | null>(null);
  useEffect(() => { if (settings) setDraft(settings); }, [settings]);
  const saveSettings = useMutation({
    mutationFn: async (s: Settings) => (await apiRequest("PUT", "/api/talent-score/settings", s)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/talent-score/settings"] }); toast({ title: "Talent Score rules saved", description: "Scores in the Talent Catalogue use the new rules straight away." }); }, onError,
  });
  const weightTotal = useMemo(() => draft ? WEIGHTS.reduce((s, [k]) => s + (draft[k] as number), 0) : 0, [draft]);
  const setNum = (k: keyof Settings, v: string) => setDraft(d => d && ({ ...d, [k]: Math.max(0, Math.round(Number(v) || 0)) }));

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Performance and Talent Score</h1>
        <p className="text-muted-foreground">Run review cycles, shape the behaviours framework and set how the Talent Score is built.</p>
      </div>

      <Tabs defaultValue="cycles">
        <TabsList><TabsTrigger value="cycles" data-testid="tab-cycles">Review cycles</TabsTrigger><TabsTrigger value="behaviours" data-testid="tab-behaviours">Behaviours</TabsTrigger><TabsTrigger value="score" data-testid="tab-score">Talent Score rules</TabsTrigger></TabsList>

        {/* CYCLES */}
        <TabsContent value="cycles" className="space-y-4">
          <Card data-testid="card-who-sees-what">
            <CardHeader className="pb-2"><CardTitle className="text-lg">Who sees what</CardTitle><CardDescription>Fixed rules, not settings. Reviews are sensitive, so each person sees only what they need.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead /><TableHead>Employee</TableHead><TableHead>Line manager</TableHead><TableHead>HR / admin</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell className="font-medium">Their own objectives and self assessment</TableCell><TableCell>Yes</TableCell><TableCell>Yes</TableCell><TableCell>Yes</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">Manager's ratings, summary and development plan</TableCell><TableCell>Only after the manager shares the report</TableCell><TableCell>Yes</TableCell><TableCell>Yes</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">360 feedback results</TableCell><TableCell>Only after sharing, and only with enough responses</TableCell><TableCell>Yes (anonymous)</TableCell><TableCell>Yes (anonymous)</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">0-100 review results, potential rating, calibration notes</TableCell><TableCell>Never</TableCell><TableCell>Yes (results, potential)</TableCell><TableCell>Yes</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium">Talent Score and the Talent Catalogue ranking</TableCell><TableCell>Never</TableCell><TableCell>Never</TableCell><TableCell>Yes</TableCell></TableRow>
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">Reminders: the person whose turn it is gets an email when their stage opens, then reminders from 30 days before the due date (and at 14, 7, 3 and 1 days, on the day, and weekly once overdue).</p>
            </CardContent>
          </Card>
          <div className="flex justify-end"><Button onClick={() => setCycleDialog({ year: new Date().getFullYear(), ratingScale: 5, includes360: true, requiresCalibration: false })} data-testid="button-new-cycle"><Plus className="h-4 w-4 mr-1" />New cycle</Button></div>
          {cycles.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">No review cycles yet. Create one, then launch it. Managers then start reviews for their own people, or you can create them for everyone.</CardContent></Card>}
          {cycles.map(c => (
            <Card key={c.id} data-testid={`card-cycle-${c.id}`}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><CardTitle className="text-lg">{c.name}</CardTitle><CardDescription>{c.year} · {c.ratingScale}-point scale · {c.includes360 ? "360 feedback on" : "no 360"}{c.requiresCalibration ? " · calibration step" : ""}</CardDescription></div>
                  <Badge variant={c.status === "open" ? "default" : "secondary"} data-testid={`badge-cycle-${c.id}`}>{c.status === "draft" ? "Draft" : c.status === "open" ? "Open" : "Closed"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {STATUS_ORDER.filter(s => c.appraisalCounts[s]).map(s => <span key={s}>{STATUS_LABEL[s]}: <b className="text-foreground">{c.appraisalCounts[s]}</b></span>)}
                  {c.appraisalTotal === 0 && <span>No appraisals created yet</span>}
                  {c.selfReviewDeadline && <span>Self review by {fmtDate(c.selfReviewDeadline)}</span>}
                  {c.managerReviewDeadline && <span>Manager review by {fmtDate(c.managerReviewDeadline)}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.status !== "closed" && <Button size="sm" variant="outline" onClick={() => setCycleDialog(c)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>}
                  {c.status !== "closed" && <Button size="sm" onClick={() => { setLaunching(c); setFallback("none"); }} data-testid={`button-launch-${c.id}`}><Rocket className="h-4 w-4 mr-1" />{c.status === "draft" ? "Launch" : "Add people who joined since"}</Button>}
                  {c.status === "open" && <Button size="sm" variant="secondary" disabled={cycleAction.isPending} onClick={() => cycleAction.mutate({ url: `/api/performance/cycles/${c.id}/open-self-reviews`, ok: "Self reviews opened" })} data-testid={`button-open-self-${c.id}`}><Play className="h-4 w-4 mr-1" />Open all self reviews</Button>}
                  {c.status === "open" && <Button size="sm" variant="outline" disabled={cycleAction.isPending} onClick={() => cycleAction.mutate({ url: `/api/performance/cycles/${c.id}/close`, ok: "Cycle closed" })} data-testid={`button-close-${c.id}`}><Lock className="h-4 w-4 mr-1" />Close cycle</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* BEHAVIOURS */}
        <TabsContent value="behaviours" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            {behaviours.length === 0 && <Button variant="outline" onClick={() => starter.mutate()} data-testid="button-starter-behaviours">Add a starter set</Button>}
            <Button onClick={() => setBehDialog({ name: "", description: "", indicators: "", isActive: true })} data-testid="button-new-behaviour"><Plus className="h-4 w-4 mr-1" />New behaviour</Button>
          </div>
          <Card><CardContent className="pt-6 overflow-x-auto">
            {behaviours.length === 0 ? <p className="text-sm text-muted-foreground">No behaviours yet. Everyone is rated on the same list, so add a starter set and edit it to match your values.</p> : (
              <Table><TableHeader><TableRow><TableHead>Behaviour</TableHead><TableHead>What good looks like</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{behaviours.map(b => (
                  <TableRow key={b.id} data-testid={`row-behaviour-${b.id}`}>
                    <TableCell className="font-medium">{b.name}<div className="text-xs font-normal text-muted-foreground">{b.description}</div></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(b.indicators ?? []).join(" · ")}</TableCell>
                    <TableCell>{b.isActive ? <Badge>In use</Badge> : <Badge variant="outline">Retired</Badge>}</TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label="Edit behaviour" onClick={() => setBehDialog({ id: b.id, name: b.name, description: b.description ?? "", indicators: (b.indicators ?? []).join("\n"), isActive: !!b.isActive })}><Pencil className="h-4 w-4" /></Button></TableCell>
                  </TableRow>))}</TableBody></Table>)}
          </CardContent></Card>
          <p className="text-xs text-muted-foreground">Changing the list affects appraisals that have not yet been rated. Retire a behaviour instead of deleting it so past reviews stay readable.</p>
        </TabsContent>

        {/* TALENT SCORE */}
        <TabsContent value="score" className="space-y-4">
          {draft && (<>
            <Card>
              <CardHeader><CardTitle className="text-lg">What goes into the score</CardTitle>
                <CardDescription>The Talent Score is a number out of 100. Each part is scored out of 100, then combined using these weights. A part that is not available for a person is left out and the rest are scaled up, so missing information never counts as zero.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {WEIGHTS.map(([k, label, help]) => (
                  <div key={k} className="grid gap-2 sm:grid-cols-[1fr_6rem_5rem] items-center">
                    <div><Label htmlFor={`w-${k}`} className="font-medium">{label}</Label><p className="text-xs text-muted-foreground">{help}</p></div>
                    <Input id={`w-${k}`} type="number" min={0} max={100} value={draft[k] as number} onChange={e => setNum(k, e.target.value)} data-testid={`input-${k}`} />
                    <span className="text-sm text-muted-foreground tabular-nums">{weightTotal > 0 ? `${Math.round(((draft[k] as number) / weightTotal) * 100)}% of the score` : ""}</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Weights are relative, so they do not need to add up to 100 (currently {weightTotal}).</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">How each part is measured</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor="exp-years">Years of experience for a full experience score</Label><Input id="exp-years" type="number" min={1} value={draft.experienceYearsForFull} onChange={e => setNum("experienceYearsForFull", e.target.value)} data-testid="input-experienceYearsForFull" /></div>
                <div className="space-y-1"><Label htmlFor="window">A review counts for this many months</Label><Input id="window" type="number" min={1} value={draft.reviewWindowMonths} onChange={e => setNum("reviewWindowMonths", e.target.value)} data-testid="input-reviewWindowMonths" /></div>
                <div className="space-y-1"><Label htmlFor="min-parts">Parts needed before a score is shown (1 to 5)</Label><Input id="min-parts" type="number" min={1} max={5} value={draft.minComponentsForScore} onChange={e => setNum("minComponentsForScore", e.target.value)} data-testid="input-minComponentsForScore" /><p className="text-xs text-muted-foreground">Stops a score built on one fact outranking someone with a full picture.</p></div>
                <div className="space-y-1"><Label htmlFor="min-raters">360 responses needed before results show</Label><Input id="min-raters" type="number" min={1} value={draft.minFeedbackRaters} onChange={e => setNum("minFeedbackRaters", e.target.value)} data-testid="input-minFeedbackRaters" /><p className="text-xs text-muted-foreground">Protects the anonymity of raters.</p></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Inside the review part</CardTitle><CardDescription>How the last review is combined (relative weights).</CardDescription></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1"><Label htmlFor="p-obj">Objectives met</Label><Input id="p-obj" type="number" min={0} max={100} value={draft.perfWeightObjectives} onChange={e => setNum("perfWeightObjectives", e.target.value)} data-testid="input-perfWeightObjectives" /></div>
                <div className="space-y-1"><Label htmlFor="p-rate">Overall rating</Label><Input id="p-rate" type="number" min={0} max={100} value={draft.perfWeightRating} onChange={e => setNum("perfWeightRating", e.target.value)} data-testid="input-perfWeightRating" /></div>
                <div className="space-y-1"><Label htmlFor="p-beh">Behaviours</Label><Input id="p-beh" type="number" min={0} max={100} value={draft.perfWeightBehaviours} onChange={e => setNum("perfWeightBehaviours", e.target.value)} data-testid="input-perfWeightBehaviours" /></div>
                <div className="space-y-1 sm:col-span-3"><Label htmlFor="p-360">Share of the behaviours result taken from 360 feedback (%)</Label><Input id="p-360" type="number" min={0} max={100} className="max-w-32" value={draft.feedbackShareOfBehaviours} onChange={e => setNum("feedbackShareOfBehaviours", e.target.value)} data-testid="input-feedbackShareOfBehaviours" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Privacy</CardTitle><CardDescription>Performance reviews are sensitive personal data. Use the score to inform decisions, not to make them.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3"><div><Label htmlFor="inc-perf">Include performance reviews in the score</Label><p className="text-xs text-muted-foreground">Turn off to build the score from competence, training, experience and qualifications only.</p></div><Switch id="inc-perf" checked={draft.includePerformanceInScore} onCheckedChange={v => setDraft({ ...draft, includePerformanceInScore: v })} data-testid="switch-includePerformance" /></div>
              </CardContent>
            </Card>
            <div className="flex justify-end"><Button disabled={saveSettings.isPending || weightTotal <= 0} onClick={() => saveSettings.mutate(draft)} data-testid="button-save-settings">Save rules</Button></div>
          </>)}
        </TabsContent>
      </Tabs>

      {/* cycle create / edit */}
      <Dialog open={!!cycleDialog} onOpenChange={o => !o && setCycleDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{cycleDialog?.id ? "Edit cycle" : "New review cycle"}</DialogTitle><DialogDescription>A cycle is one review year. Creating it does nothing until you launch it. The dates are the starting point: managers can change them for each person when they start a review.</DialogDescription></DialogHeader>
          {cycleDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <div className="space-y-1"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={cycleDialog.name ?? ""} onChange={e => setCycleDialog({ ...cycleDialog, name: e.target.value })} placeholder="2027 Annual Review" data-testid="input-cycle-name" /></div>
                <div className="space-y-1"><Label htmlFor="c-year">Year</Label><Input id="c-year" type="number" value={cycleDialog.year ?? ""} onChange={e => setCycleDialog({ ...cycleDialog, year: Number(e.target.value) })} data-testid="input-cycle-year" /></div>
              </div>
              <div className="space-y-1"><Label htmlFor="c-scale">Rating scale (3 to 10 points)</Label><Input id="c-scale" type="number" min={3} max={10} className="max-w-28" value={cycleDialog.ratingScale ?? 5} onChange={e => setCycleDialog({ ...cycleDialog, ratingScale: Number(e.target.value) })} disabled={!!cycleDialog.id && cycleDialog.status !== "draft"} /></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label htmlFor="c-obj">Objectives agreed by</Label><Input id="c-obj" type="date" value={cycleDialog.objectiveDeadline ? String(cycleDialog.objectiveDeadline).slice(0, 10) : ""} onChange={e => setCycleDialog({ ...cycleDialog, objectiveDeadline: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="c-self">Self review by</Label><Input id="c-self" type="date" value={cycleDialog.selfReviewDeadline ? String(cycleDialog.selfReviewDeadline).slice(0, 10) : ""} onChange={e => setCycleDialog({ ...cycleDialog, selfReviewDeadline: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="c-mgr">Manager review by</Label><Input id="c-mgr" type="date" value={cycleDialog.managerReviewDeadline ? String(cycleDialog.managerReviewDeadline).slice(0, 10) : ""} onChange={e => setCycleDialog({ ...cycleDialog, managerReviewDeadline: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between"><Label htmlFor="c-360">Include 360 feedback</Label><Switch id="c-360" checked={cycleDialog.includes360 ?? true} onCheckedChange={v => setCycleDialog({ ...cycleDialog, includes360: v })} /></div>
              <div className="flex items-center justify-between"><Label htmlFor="c-cal">Add a calibration step before the meeting</Label><Switch id="c-cal" checked={cycleDialog.requiresCalibration ?? false} onCheckedChange={v => setCycleDialog({ ...cycleDialog, requiresCalibration: v })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setCycleDialog(null)}>Cancel</Button><Button disabled={saveCycle.isPending || !cycleDialog?.name?.trim()} onClick={() => saveCycle.mutate(cycleDialog!)} data-testid="button-save-cycle">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* launch */}
      <Dialog open={!!launching} onOpenChange={o => !o && setLaunching(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Launch {launching?.name}</DialogTitle><DialogDescription>Choose who starts the individual reviews. Anyone who already has one is left alone, so this is safe to run again.</DialogDescription></DialogHeader>
          <div className="space-y-1"><Label>How should reviews be started?</Label>
            <Select value={launchMode} onValueChange={v => setLaunchMode(v as "open_only" | "everyone")}>
              <SelectTrigger aria-label="How reviews are started" data-testid="select-launch-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open_only">Managers start reviews for their own people</SelectItem>
                <SelectItem value="everyone">Create a review for everyone now</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground" data-testid="text-launch-mode-help">{launchMode === "open_only"
              ? "The cycle opens, nothing is created. Each manager picks a direct report from a list, sets that person's dates and starts the review. The person is emailed when it starts."
              : "A review is created for every active person who has a line manager, using the cycle's dates. Each person is asked to set their objectives."}</p></div>
          {launchMode === "everyone" && (
            <div className="space-y-1"><Label>Reviewer for people with no line manager (optional)</Label>
              <Select value={fallback} onValueChange={setFallback}>
                <SelectTrigger aria-label="Reviewer for people with no line manager" data-testid="select-fallback"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72"><SelectItem value="none">Nobody: skip them</SelectItem>{people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}{p.jobRole ? ` · ${p.jobRole}` : ""}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Senior roles often have no line manager in the system. Pick who should review them.</p></div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setLaunching(null)}>Cancel</Button>
            <Button disabled={cycleAction.isPending} data-testid="button-confirm-launch" onClick={() => { cycleAction.mutate({ url: `/api/performance/cycles/${launching!.id}/launch`, body: { mode: launchMode, fallbackReviewerId: launchMode === "everyone" && fallback !== "none" ? fallback : null }, ok: "Cycle launched" }); setLaunching(null); }}>Launch</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* behaviour edit */}
      <Dialog open={!!behDialog} onOpenChange={o => !o && setBehDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{behDialog?.id ? "Edit behaviour" : "New behaviour"}</DialogTitle><DialogDescription>Describe the behaviour and what it looks like in practice.</DialogDescription></DialogHeader>
          {behDialog && (
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="b-name">Name</Label><Input id="b-name" value={behDialog.name} onChange={e => setBehDialog({ ...behDialog, name: e.target.value })} data-testid="input-behaviour-name" /></div>
              <div className="space-y-1"><Label htmlFor="b-desc">Description</Label><Textarea id="b-desc" rows={2} value={behDialog.description} onChange={e => setBehDialog({ ...behDialog, description: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="b-ind">Examples of it at its best (one per line)</Label><Textarea id="b-ind" rows={4} value={behDialog.indicators} onChange={e => setBehDialog({ ...behDialog, indicators: e.target.value })} /></div>
              <div className="flex items-center justify-between"><Label htmlFor="b-active">In use</Label><Switch id="b-active" checked={behDialog.isActive} onCheckedChange={v => setBehDialog({ ...behDialog, isActive: v })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setBehDialog(null)}>Cancel</Button><Button disabled={saveBehaviour.isPending || !behDialog?.name.trim()} onClick={() => saveBehaviour.mutate(behDialog!)} data-testid="button-save-behaviour">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
