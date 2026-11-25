// A candidate's own course feedback: what is waiting, the form itself, and what they have already sent.
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";
import type { Answers, EvaluationForm } from "@shared/trainingEvaluation";
import { Questions } from "@/components/evaluations/Questions";
import { dayText, problem, refreshEvaluations, type MyEvaluation } from "@/components/evaluations/shared";

const LIST_URL = "/api/training-evaluations/mine";
interface Detail { evaluation: MyEvaluation; form: EvaluationForm; answers: Answers; namesShown: boolean; privacy: string }

const where = (e: MyEvaluation) => [e.providerName, e.venueName, e.instructor ? `with ${e.instructor}` : null].filter(Boolean).join(", ");
const whatFor = (e: MyEvaluation) => (e.stage === "followup" ? "Follow-up: using it at work" : `Your feedback (${e.formTypeLabel.toLowerCase()})`);

function NotAttendedDialog({ id, open, onClose, onDone }: { id: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: async () => apiRequest("POST", `${LIST_URL}/${id}/not-attended`, { reason }),
    onSuccess: () => { toast({ title: "Noted", description: "We will not ask you about this one again." }); onClose(); onDone(); },
    onError: e => toast({ title: "Could not record that", description: problem(e).message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>You did not attend this?</DialogTitle><DialogDescription>Your training record is not changed. The people who manage training see your reason so the record can be checked.</DialogDescription></DialogHeader>
        <div className="space-y-1.5"><Label htmlFor="na-reason">What happened</Label><Textarea id="na-reason" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} data-testid="input-not-attended-reason" /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={reason.trim().length < 5 || send.isPending} onClick={() => send.mutate()} data-testid="button-confirm-not-attended">I did not attend</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OneEvaluation({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const url = `${LIST_URL}/${id}`;
  const { data, isLoading, error } = useQuery<Detail>({ queryKey: [url], staleTime: 0, gcTime: 0 });
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [notAttended, setNotAttended] = useState(false);
  useEffect(() => { if (data && answers === null) setAnswers(data.answers); }, [data, answers]);
  const back = () => setLocation("/my-training-feedback");

  const draft = useMutation({
    mutationFn: async () => apiRequest("PUT", `${url}/draft`, { answers }),
    onSuccess: () => { refreshEvaluations(); toast({ title: "Saved", description: "You can finish it later." }); },
    onError: e => toast({ title: "Could not save", description: problem(e).message, variant: "destructive" }),
  });
  const submit = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${url}/submit`, { answers, namesShown: data!.namesShown })).json() as Promise<{ safetyConcern: boolean }>,
    onSuccess: r => {
      refreshEvaluations();
      toast({ title: "Thank you", description: r.safetyConcern ? "Your feedback has been sent, and the safety concern has been passed to the people who manage training." : "Your feedback has been sent." });
      back();
    },
    onError: e => {
      const p = problem(e);
      if (p.missing?.length) { setMissing(p.missing); setTimeout(() => document.getElementById(`q-${p.missing![0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }
      if (p.reload) queryClient.invalidateQueries({ queryKey: [url] });
      toast({ title: "Not sent yet", description: p.message, variant: "destructive" });
    },
  });

  if (isLoading || (data && answers === null)) return <p className="p-6 text-muted-foreground">Loading...</p>;
  if (error || !data) return <div className="space-y-3 p-6"><p className="text-destructive">{problem(error).message}</p><Button variant="outline" onClick={back}>Back to my feedback</Button></div>;
  const e = data.evaluation;
  const closed = e.status !== "open";
  return (
    <div className="container mx-auto max-w-3xl space-y-5 p-4 sm:p-6" data-testid="page-evaluation-form">
      <Button variant="ghost" size="sm" onClick={back} className="-ml-2"><ArrowLeft className="mr-1 h-4 w-4" />My course feedback</Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{e.courseTitle}</h1>
        <p className="text-muted-foreground">{whatFor(e)}. Attended {dayText(e.completedOn)}{where(e) ? `. ${where(e)}` : ""}.</p>
        {!closed && <p className="text-sm text-muted-foreground">Please reply by {dayText(e.dueOn)}. It takes about {e.stage === "followup" ? "two" : "five"} minutes.</p>}
      </div>
      <p className="rounded-md bg-muted p-3 text-sm" data-testid="text-privacy">{data.privacy}</p>
      {e.status === "submitted" && <Badge>Sent</Badge>}
      {(e.status === "expired" || e.status === "declined") && <p className="text-sm">{e.status === "expired" ? "This one has closed." : "You told us you did not attend."}</p>}
      {(e.status === "open" || e.status === "submitted") && (
        <Questions form={data.form} answers={answers!} onChange={a => { setAnswers(a); setMissing(m => m.filter(k => a[k] === undefined)); }} disabled={closed} missing={missing} />
      )}
      {!closed && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => submit.mutate()} disabled={submit.isPending} data-testid="button-send-evaluation">Send my feedback</Button>
          <Button variant="outline" onClick={() => draft.mutate()} disabled={draft.isPending} data-testid="button-save-evaluation">Save and finish later</Button>
          {e.stage === "course" && <Button variant="ghost" onClick={() => setNotAttended(true)} data-testid="button-not-attended">I did not attend this</Button>}
        </div>
      )}
      <NotAttendedDialog id={id} open={notAttended} onClose={() => setNotAttended(false)} onDone={() => { refreshEvaluations(); back(); }} />
    </div>
  );
}

export default function MyTrainingFeedback({ id }: { id?: string }) {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = useQuery<{ open: MyEvaluation[]; done: MyEvaluation[] }>({ queryKey: [LIST_URL], staleTime: 0, enabled: !id });
  if (id) return <OneEvaluation key={id} id={id} />;
  const row = (e: MyEvaluation, open: boolean) => (
    <div key={e.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`row-evaluation-${e.id}`}>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{e.courseTitle}</div>
        <div className="text-sm text-muted-foreground">{whatFor(e)}. Attended {dayText(e.completedOn)}{open ? `. Reply by ${dayText(e.dueOn)}` : ""}</div>
      </div>
      {!open && <Badge variant={e.status === "submitted" ? "default" : "outline"}>{e.status === "submitted" ? "Sent" : e.status === "declined" ? "Did not attend" : "Closed"}</Badge>}
      <Button size="sm" variant={open ? "default" : "outline"} onClick={() => setLocation(`/my-training-feedback/${e.id}`)} data-testid={`button-open-evaluation-${e.id}`}>{open ? (e.started ? "Finish" : "Give feedback") : "View"}</Button>
    </div>
  );
  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6" data-testid="page-my-training-feedback">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">My Course Feedback</h1>
        <p className="text-muted-foreground">Tell us how the training you attended went, and later whether you have been able to use it.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Waiting for you</CardTitle><CardDescription>{data ? `${data.open.length} to reply to` : ""}</CardDescription></CardHeader>
        <CardContent>
          {isLoading && <p className="py-4 text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="py-4 text-sm text-destructive">{problem(error).message}</p>}
          {data && data.open.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nothing is waiting. You will be asked after your next course.</p>}
          <div className="divide-y">{data?.open.map(e => row(e, true))}</div>
        </CardContent>
      </Card>
      {!!data?.done.length && (
        <Card>
          <CardHeader><CardTitle className="text-base">Earlier</CardTitle></CardHeader>
          <CardContent><div className="divide-y">{data.done.map(e => row(e, false))}</div></CardContent>
        </Card>
      )}
    </div>
  );
}
