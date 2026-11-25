// Training suitability, from what the people who attended say: a rating for every course with its reasons, comparisons, and the follow-up actions.
import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORM_TYPES, FORM_TYPE_LABEL } from "@shared/trainingEvaluation";
import { GroupTable, Stat, VerdictBadge, gain, percent, score, type Group, type Summary } from "@/components/evaluations/results";
import { CourseDetail } from "@/components/evaluations/CourseDetail";
import { AwaitingTab, SafetyTab, SettingsTab } from "@/components/evaluations/ManageTabs";
import { dayText, problem } from "@/components/evaluations/shared";

interface Course extends Group { categoryName: string | null; formTypes: string[]; lastReview: { decision: string; on: string; nextReviewOn: string | null } | null }
interface Analysis {
  canManage: boolean; enabled: boolean; startFrom: string; minGroup: number; showNames: boolean; thresholds: { reviewScore: number; watchScore: number; reviewNotSuitablePct: number; watchSuitablePct: number; watchLevelPct: number; reviewNotRelevantPct: number };
  providers: string[]; openSafety: number | null; total: Summary; courses: Course[]; groupBy: string; groups: Group[];
}
const GROUP_LABEL: Record<string, string> = { provider: "Provider", instructor: "Instructor", venue: "Venue", formType: "Kind of course", category: "Category", jobRole: "Job role", quarter: "Quarter" };
const ALL = "all";

export default function TrainingEvaluations() {
  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(params.get("tab") ?? "courses");
  const [course, setCourse] = useState<string | null>(null);
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [formType, setFormType] = useState(ALL), [provider, setProvider] = useState(ALL), [groupBy, setGroupBy] = useState("provider");

  const filters = new URLSearchParams();
  if (from) filters.set("from", from);
  if (to) filters.set("to", to);
  if (formType !== ALL) filters.set("formType", formType);
  if (provider !== ALL) filters.set("provider", provider);
  const filterText = filters.toString();
  const query = new URLSearchParams(filters);
  query.set("groupBy", groupBy);
  const { data, isLoading, error } = useQuery<Analysis>({ queryKey: [`/api/training-evaluations/analysis?${query}`], staleTime: 0, placeholderData: keepPreviousData, enabled: !course });

  const needReview = data?.courses.filter(c => c.verdict.key === "review").length ?? 0;
  const filterRow = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5"><Label htmlFor="ev-from">Attended from</Label><Input id="ev-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="ev-to">Attended to</Label><Input id="ev-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Kind of course</Label>
        <Select value={formType} onValueChange={setFormType}><SelectTrigger data-testid="filter-form-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All kinds</SelectItem>{FORM_TYPES.map(t => <SelectItem key={t} value={t}>{FORM_TYPE_LABEL[t]}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Provider</Label>
        <Select value={provider} onValueChange={setProvider}><SelectTrigger data-testid="filter-provider"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>All providers</SelectItem>{data?.providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
    </div>
  );

  return (
    <div className="container mx-auto space-y-6 p-4 sm:p-6" data-testid="page-training-evaluations">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Training Evaluations</h1>
        <p className="text-muted-foreground">What the people who attended say about each course, and whether it is suitable for the job.</p>
      </div>
      {data && !data.enabled && <p className="rounded-md border p-3 text-sm">Asking for feedback is switched off, so no new requests are being made.</p>}
      <Tabs value={tab} onValueChange={v => { setTab(v); setCourse(null); }}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="courses" data-testid="tab-courses">Courses</TabsTrigger>
          <TabsTrigger value="compare" data-testid="tab-compare">Compare</TabsTrigger>
          {data?.canManage && <TabsTrigger value="awaiting" data-testid="tab-awaiting">Waiting for replies</TabsTrigger>}
          {data?.canManage && <TabsTrigger value="safety" data-testid="tab-safety">Safety concerns{data.openSafety ? ` (${data.openSafety})` : ""}</TabsTrigger>}
          {data?.canManage && <TabsTrigger value="settings" data-testid="tab-settings">Settings and forms</TabsTrigger>}
        </TabsList>

        <TabsContent value="courses" className="space-y-5">
          {filterRow}
          {course ? <CourseDetail courseKey={course} query={filterText} onBack={() => setCourse(null)} /> : (
            <>
              {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
              {error && <p className="text-sm text-destructive">{problem(error).message}</p>}
              {data && (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <Stat testId="stat-replies" label="Replies" value={`${data.total.replies} of ${data.total.asked}`} caption={data.total.responseRatePct === null ? "Nobody has been asked yet" : `${data.total.responseRatePct}% reply rate`} />
                    <Stat testId="stat-overall" label="Overall rating" value={`${score(data.total.overall)} / 5`} />
                    <Stat testId="stat-suitable" label="Fully met the job need" value={percent(data.total.suitablePct)} />
                    <Stat testId="stat-gain" label="Confidence gain" value={gain(data.total.confidenceGain)} caption="points out of 5" />
                    <Stat testId="stat-review" label="Courses needing review" value={String(needReview)} caption={data.openSafety ? `${data.openSafety} open safety concern${data.openSafety === 1 ? "" : "s"}` : undefined} />
                  </div>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Course suitability</CardTitle><CardDescription>Those needing attention come first. Open a course for the detail and to record what you decide.</CardDescription></CardHeader>
                    <CardContent>
                      {data.courses.length === 0 && <p className="py-4 text-sm text-muted-foreground">No evaluations yet. People are asked about training completed from {dayText(data.startFrom)}.</p>}
                      <div className="divide-y">
                        {data.courses.map(c => (
                          <div key={c.key} className="flex flex-wrap items-start gap-3 py-3" data-testid={`row-course-${c.key}`}>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.label}</span><VerdictBadge verdict={c.verdict} /></div>
                              <div className="text-sm text-muted-foreground">{c.formTypes.join(", ")} · {c.summary.replies} of {c.summary.asked} replied{c.summary.overall !== null ? ` · overall ${score(c.summary.overall)}` : ""}{c.summary.suitablePct !== null ? ` · ${c.summary.suitablePct}% met job need` : ""}{c.summary.followUp.usedPct !== null ? ` · ${c.summary.followUp.usedPct}% used it at work` : ""}</div>
                              {(c.verdict.key === "review" || c.verdict.key === "watch") && <div className="text-sm">{c.verdict.reasons.slice(0, 3).join(". ")}{c.verdict.reasons.length > 3 ? `. And ${c.verdict.reasons.length - 3} more` : ""}.</div>}
                              {c.lastReview && <div className="text-xs text-muted-foreground">Last decision {dayText(c.lastReview.on)}: {c.lastReview.decision}{c.lastReview.nextReviewOn ? `. Look again on ${dayText(c.lastReview.nextReviewOn)}` : ""}</div>}
                            </div>
                            <Button size="sm" variant="outline" onClick={() => setCourse(c.key)} data-testid={`button-open-course-${c.key}`}>Open</Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <details className="rounded-lg border p-4 text-sm">
                    <summary className="cursor-pointer font-medium">How the rating is worked out</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                      <li><b>Not enough replies:</b> fewer than {Math.max(3, data.minGroup)}.</li>
                      <li><b>Review needed</b> if any of these: relevance to the job or the overall rating below {data.thresholds.reviewScore.toFixed(1)}; {data.thresholds.reviewNotSuitablePct}% or more say it did not meet their job need; at follow-up, preparation below {data.thresholds.reviewScore.toFixed(1)} or {data.thresholds.reviewNotRelevantPct}% or more say it is not relevant to their work.</li>
                      <li><b>Keep an eye on it</b> if any of these: an area, the overall rating, confidence afterwards or follow-up preparation below {data.thresholds.watchScore.toFixed(1)}; fewer than {data.thresholds.watchSuitablePct}% say it fully met their job need; {data.thresholds.watchLevelPct}% or more say the level or length was wrong.</li>
                      <li>The rating is a prompt to look. The decision about a course is yours, and is recorded on the course.</li>
                    </ul>
                  </details>
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="compare" className="space-y-5">
          {filterRow}
          <div className="max-w-xs space-y-1.5"><Label>Compare by</Label>
            <Select value={groupBy} onValueChange={setGroupBy}><SelectTrigger data-testid="select-group-by"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(GROUP_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
          <Card>
            <CardHeader><CardTitle className="text-base">By {GROUP_LABEL[groupBy].toLowerCase()}</CardTitle><CardDescription>Different courses are mixed within a row, so check the course itself before judging a provider or an instructor.{data && !data.showNames ? ` Rows with fewer than ${data.minGroup} replies are held back.` : ""}</CardDescription></CardHeader>
            <CardContent>{data && data.groupBy === groupBy ? <GroupTable heading={GROUP_LABEL[groupBy]} rows={data.groups} /> : <p className="py-4 text-sm text-muted-foreground">Loading...</p>}</CardContent>
          </Card>
        </TabsContent>
        {data?.canManage && <TabsContent value="awaiting"><AwaitingTab /></TabsContent>}
        {data?.canManage && <TabsContent value="safety"><SafetyTab /></TabsContent>}
        {data?.canManage && <TabsContent value="settings"><SettingsTab /></TabsContent>}
      </Tabs>
    </div>
  );
}
