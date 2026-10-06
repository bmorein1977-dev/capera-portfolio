import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { RATER_LABEL, RatingInput, errorText, type Cycle } from "@/components/performance/shared";

interface InboxItem { id: string; status: string; raterType: string; subjectName: string; cycleName: string; ratingScale: number }
interface FormData {
  request: { id: string; status: string; raterType: string };
  subjectName: string; cycle: Cycle;
  behaviours: Array<{ id: string; name: string; description: string | null; indicators: string[] | null }>;
}

// Rater side of 360 feedback: a list of requests, and the form for one of them
export default function FeedbackInbox({ id }: { id?: string }) {
  return id ? <FeedbackForm id={id} /> : <InboxList />;
}

function InboxList() {
  const { data: items = [], isLoading } = useQuery<InboxItem[]>({ queryKey: ["/api/performance/feedback-inbox"] });
  const open = items.filter(i => i.status === "approved");
  const done = items.filter(i => i.status === "completed");
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Feedback requests</h1>
        <p className="text-muted-foreground">Colleagues who have asked for your view of how they work.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Waiting for you</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && open.length === 0 && <p className="text-sm text-muted-foreground" data-testid="text-inbox-empty">Nothing waiting. You are up to date.</p>}
          {open.map(i => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-3" data-testid={`row-request-${i.id}`}>
              <div><div className="font-medium">{i.subjectName}</div><div className="text-xs text-muted-foreground">{i.cycleName} · you were asked as a {RATER_LABEL[i.raterType]?.toLowerCase() ?? i.raterType}</div></div>
              <Link href={`/performance/feedback/${i.id}`}><Button size="sm" data-testid={`button-give-${i.id}`}>Give feedback</Button></Link>
            </div>
          ))}
        </CardContent>
      </Card>
      {done.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base">Already given</CardTitle></CardHeader>
          <CardContent className="space-y-1">{done.map(i => <div key={i.id} className="flex items-center justify-between text-sm"><span>{i.subjectName} · {i.cycleName}</span><Badge variant="secondary">Thank you</Badge></div>)}</CardContent></Card>
      )}
    </div>
  );
}

function FeedbackForm({ id }: { id: string }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useQuery<FormData>({ queryKey: [`/api/performance/feedback/${id}`] });
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [development, setDevelopment] = useState("");

  useEffect(() => { setRatings({}); }, [id]);

  const submit = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/performance/feedback/${id}`, {
      ratings: Object.entries(ratings).map(([behaviourId, rating]) => ({ behaviourId, rating })), strengthsComment: strengths, developmentComment: development,
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/feedback-inbox"] });
      toast({ title: "Thank you", description: "Your feedback has been sent anonymously." });
      navigate("/performance/feedback");
    },
    onError: (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" }),
  });
  const decline = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/performance/feedback/${id}/decline`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/performance/feedback-inbox"] }); navigate("/performance/feedback"); },
    onError: (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" }),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (error || !data) return <div className="p-6"><Alert variant="destructive"><AlertDescription>{errorText(error)}</AlertDescription></Alert></div>;
  const scale = data.cycle.ratingScale;
  const complete = data.behaviours.every(b => ratings[b.id] != null);
  const closed = data.request.status !== "approved";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <Link href="/performance/feedback"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
      <Card>
        <CardHeader>
          <CardTitle data-testid="text-subject">Feedback for {data.subjectName}</CardTitle>
          <CardDescription>Rate each behaviour from 1 (low) to {scale} (high), based on what you have seen first-hand.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert><ShieldCheck className="h-4 w-4" /><AlertDescription>Your answers are anonymous. {data.subjectName} sees only averages, and only once enough people have responded.</AlertDescription></Alert>
        </CardContent>
      </Card>

      {closed ? (
        <Card><CardContent className="py-6 text-center text-muted-foreground">{data.request.status === "completed" ? "You have already given this feedback." : "This request is no longer open."}</CardContent></Card>
      ) : (
        <>
          {data.behaviours.map(b => (
            <Card key={b.id}>
              <CardContent className="py-4 space-y-2">
                <div className="font-medium">{b.name}</div>
                <p className="text-sm text-muted-foreground">{b.description}</p>
                {b.indicators && b.indicators.length > 0 && <ul className="list-disc pl-5 text-xs text-muted-foreground">{b.indicators.map(i => <li key={i}>{i}</li>)}</ul>}
                <RatingInput label={`Rating ${b.name}`} scale={scale} value={ratings[b.id]} onChange={n => setRatings(r => ({ ...r, [b.id]: n }))} />
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="space-y-1"><Label htmlFor="strengths">What do they do especially well?</Label><Textarea id="strengths" rows={3} value={strengths} onChange={e => setStrengths(e.target.value)} data-testid="input-strengths" /></div>
              <div className="space-y-1"><Label htmlFor="development">What one thing could they develop?</Label><Textarea id="development" rows={3} value={development} onChange={e => setDevelopment(e.target.value)} data-testid="input-development" /></div>
              <p className="text-xs text-muted-foreground">Please keep comments about work behaviours and avoid anything that would identify you.</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!complete || submit.isPending} onClick={() => submit.mutate()} data-testid="button-submit-feedback">Send feedback</Button>
                <Button variant="outline" disabled={decline.isPending} onClick={() => decline.mutate()} data-testid="button-decline-feedback">I would rather not</Button>
                {!complete && <span className="self-center text-sm text-muted-foreground">Rate every behaviour to send.</span>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
