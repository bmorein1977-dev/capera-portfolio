// One course's results: the rating and why, what scored well and badly, whether it has been used since, what people wrote, and what was decided.
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";
import { REVIEW_DECISIONS, REVIEW_DECISION_LABEL, TEXT_LABEL, type ReviewDecision } from "@shared/trainingEvaluation";
import type { Comment, QuestionResult } from "../../../../server/services/trainingEvaluationAnalysis";
import { Bar, GroupTable, Shares, Stat, VerdictBadge, gain, percent, score, type Group, type Summary, type Verdict } from "./results";
import { dayText, monthText, problem, refreshEvaluations } from "./shared";

interface Detail {
  canManage: boolean; minGroup: number; courseKey: string; courseTitle: string; categoryName: string | null; formTypes: string[]; summary: Summary; verdict: Verdict;
  questions: QuestionResult[]; comments: Comment[]; byProvider: Group[]; byInstructor: Group[]; byVenue: Group[]; byQuarter: Group[];
  reviews: Array<{ id: string; decision: string; note: string; nextReviewOn: string | null; by: string | null; on: string; figures: { rating?: string; replies?: number } | null }>;
}

function ReviewForm({ courseKey }: { courseKey: string }) {
  const { toast } = useToast();
  const [decision, setDecision] = useState<ReviewDecision | "">("");
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const save = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/training-evaluations/reviews", { courseKey, decision, note, nextReviewOn: next || null }),
    onSuccess: () => { setDecision(""); setNote(""); setNext(""); refreshEvaluations(); toast({ title: "Decision recorded" }); },
    onError: e => toast({ title: "Could not record the decision", description: problem(e).message, variant: "destructive" }),
  });
  return (
    <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div className="space-y-1.5"><Label>Decision</Label>
        <Select value={decision} onValueChange={v => setDecision(v as ReviewDecision)}><SelectTrigger data-testid="select-review-decision"><SelectValue placeholder="Choose" /></SelectTrigger>
          <SelectContent>{REVIEW_DECISIONS.map(d => <SelectItem key={d} value={d}>{REVIEW_DECISION_LABEL[d]}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="rv-next">Look again on (optional)</Label><Input id="rv-next" type="date" value={next} onChange={e => setNext(e.target.value)} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="rv-note">Reason and any actions</Label><Textarea id="rv-note" value={note} maxLength={2000} onChange={e => setNote(e.target.value)} data-testid="input-review-note" /></div>
      <div><Button disabled={!decision || note.trim().length < 5 || save.isPending} onClick={() => save.mutate()} data-testid="button-save-review">Record decision</Button></div>
    </div>
  );
}

export function CourseDetail({ courseKey, query, onBack }: { courseKey: string; query: string; onBack: () => void }) {
  const url = `/api/training-evaluations/course?key=${encodeURIComponent(courseKey)}${query ? `&${query}` : ""}`;
  const { data, isLoading, error } = useQuery<Detail>({ queryKey: [url], staleTime: 0 });
  const back = <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2" data-testid="button-back-to-courses"><ArrowLeft className="mr-1 h-4 w-4" />All courses</Button>;
  if (isLoading) return <div className="space-y-3">{back}<p className="text-sm text-muted-foreground">Loading...</p></div>;
  if (error || !data) return <div className="space-y-3">{back}<p className="text-sm text-destructive">{problem(error).message}</p></div>;
  const s = data.summary, fu = s.followUp;
  const sections = Array.from(new Set(data.questions.map(q => q.section)));
  return (
    <div className="space-y-5" data-testid="course-detail">
      {back}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3"><CardTitle>{data.courseTitle}</CardTitle><VerdictBadge verdict={data.verdict} /></div>
          <CardDescription>{[data.categoryName, data.formTypes.join(", ")].filter(Boolean).join(" · ")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="verdict-reasons">{data.verdict.reasons.map(r => <li key={r}>{r}</li>)}</ul>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Replies" value={`${s.replies} of ${s.asked}`} caption={s.responseRatePct === null ? undefined : `${s.responseRatePct}% reply rate${s.notAttended ? `, ${s.notAttended} said they did not attend` : ""}`} />
            <Stat label="Overall" value={`${score(s.overall)} / 5`} caption={s.recommendPct === null ? undefined : `${s.recommendPct}% would recommend it`} />
            <Stat label="Fully met the job need" value={percent(s.suitablePct)} />
            <Stat label="Confidence gain" value={gain(s.confidenceGain)} caption={s.confidenceBefore === null ? undefined : `from ${score(s.confidenceBefore)} before to ${score(s.confidenceAfter)} after`} />
          </div>
          {s.hidden && <p className="rounded-md bg-muted p-3 text-sm" data-testid="text-held-back">Scores and comments are held back until there are at least {data.minGroup} replies, so that nobody can be picked out.</p>}
          {s.safetyConcerns > 0 && <p className="rounded-md border border-destructive p-3 text-sm">{s.safetyConcerns} safety concern{s.safetyConcerns === 1 ? " was" : "s were"} raised about this course.{data.canManage ? " See the Safety concerns tab." : ""}</p>}
        </CardContent>
      </Card>

      {!s.hidden && s.replies > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Score by area</CardTitle><CardDescription>Average out of 5. Below 3.5 is worth watching.</CardDescription></CardHeader>
            <CardContent className="space-y-3">{s.sections.map(x => <Bar key={x.key} label={x.label} value={x.average} max={5} text={x.average.toFixed(1)} caption={`${x.favourablePct}% agree`} />)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Is it pitched right?</CardTitle></CardHeader>
            <CardContent className="space-y-5"><Shares title="Met what they need for the job" kind="suitable" shares={s.suitable} /><Shares title="Level" kind="level" shares={s.level} /><Shares title="Length" kind="length" shares={s.length} /></CardContent></Card>
        </div>
      )}

      {data.questions.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base">Every statement</CardTitle><CardDescription>Weakest first within each area. A reworded statement is counted separately from the old wording.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {sections.map(sec => (
              <div key={sec} className="space-y-3"><h3 className="text-sm font-semibold">{sec}</h3>
                {data.questions.filter(q => q.section === sec).map(q => <Bar key={q.text} label={q.text} value={q.average} max={5} text={q.average.toFixed(1)} caption={`${q.favourablePct}% agree, ${q.answers} answer${q.answers === 1 ? "" : "s"}${q.notApplicable ? `, ${q.notApplicable} not applicable` : ""}`} />)}
              </div>
            ))}
          </CardContent></Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Follow-up: has it been used?</CardTitle><CardDescription>{fu.replies} of {fu.asked} follow-ups answered</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {fu.hidden ? <p className="text-sm text-muted-foreground">Held back until there are at least {data.minGroup} replies.</p> : fu.replies === 0 ? <p className="text-sm text-muted-foreground">No follow-up replies yet.</p> : (
              <>
                <div className="grid grid-cols-2 gap-3"><Stat label="Prepared them for the job" value={`${score(fu.prepared)} / 5`} /><Stat label="Confidence now" value={`${score(fu.confidenceNow)} / 5`} /><Stat label="Made a difference" value={`${score(fu.difference)} / 5`} /><Stat label="Need a refresher" value={percent(fu.refresherPct)} /></div>
                <Shares title="Used at work" kind="used" shares={fu.used} />
                <Shares title="In the way now" kind="barriers" shares={fu.barriers} note="People could choose more than one." />
              </>
            )}
          </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Straight after the course</CardTitle></CardHeader>
          <CardContent className="space-y-5"><Shares title="Expect to use it" kind="expectUse" shares={s.expectUse} /><Shares title="Likely to get in the way" kind="barriers" shares={s.barriers} note="People could choose more than one." /></CardContent></Card>
      </div>

      {[["Provider", data.byProvider], ["Instructor", data.byInstructor], ["Venue", data.byVenue], ["Quarter", data.byQuarter]].map(([heading, rows]) => (
        (rows as Group[]).length > 0 && <Card key={heading as string}><CardHeader><CardTitle className="text-base">By {(heading as string).toLowerCase()}</CardTitle></CardHeader><CardContent><GroupTable heading={heading as string} rows={rows as Group[]} /></CardContent></Card>
      ))}

      <Card><CardHeader><CardTitle className="text-base">What people wrote</CardTitle></CardHeader>
        <CardContent>
          {data.comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments to show.</p> : (
            <ul className="divide-y">
              {data.comments.map((c, i) => (
                <li key={i} className="py-2"><div className="text-xs text-muted-foreground">{TEXT_LABEL[c.kind] ?? c.kind} · attended {monthText(c.month)}{c.provider ? ` · ${c.provider}` : ""}{c.name ? ` · ${c.name}` : ""}</div><p className="whitespace-pre-wrap text-sm">{c.text}</p></li>
              ))}
            </ul>
          )}
        </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Suitability decisions</CardTitle><CardDescription>What was decided about this course, and why. Earlier decisions are kept.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {data.reviews.length === 0 && <p className="text-sm text-muted-foreground">No decision has been recorded yet.</p>}
          {data.reviews.map(r => (
            <div key={r.id} className="border-b pb-3 last:border-0" data-testid="row-review">
              <div className="font-medium">{r.decision}</div>
              <div className="text-xs text-muted-foreground">{dayText(r.on)}{r.by ? ` by ${r.by}` : ""}{r.figures?.rating ? `. Rating at the time: ${r.figures.rating} (${r.figures.replies} replies)` : ""}{r.nextReviewOn ? `. Look again on ${dayText(r.nextReviewOn)}` : ""}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{r.note}</p>
            </div>
          ))}
          {data.canManage && <ReviewForm courseKey={data.courseKey} />}
        </CardContent></Card>
    </div>
  );
}
