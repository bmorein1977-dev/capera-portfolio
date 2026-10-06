import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ListChecks, UserCircle } from "lucide-react";
import { StatusBadge, dueText, type AppraisalStatus, type TodoItem } from "@/components/performance/shared";

interface MyAppraisal { id: string; status: AppraisalStatus; shared: boolean; cycleId: string; cycleName: string; year: number; cycleStatus: string }

export default function MyPerformance() {
  const { data: appraisals = [], isLoading } = useQuery<MyAppraisal[]>({ queryKey: ["/api/performance/my"] });
  const { data: todo = [] } = useQuery<TodoItem[]>({ queryKey: ["/api/performance/todo"] });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">My Performance</h1>
        <p className="text-muted-foreground">Your objectives, reviews and feedback for each review year.</p>
      </div>

      {todo.length > 0 && (
        <Card className="border-primary/40" data-testid="card-todo">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><ListChecks className="h-5 w-5 text-primary" />To do</CardTitle><CardDescription>Things waiting for you, soonest first.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {todo.map((t, i) => (
              <Link key={`${t.kind}-${t.appraisalId ?? t.requestId}-${i}`} href={t.path}>
                <div className="flex items-center justify-between gap-3 rounded-md border px-4 py-3 hover-elevate cursor-pointer" data-testid={`todo-${t.kind}-${i}`}>
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.detail}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {t.daysLeft != null && <Badge variant={t.daysLeft < 0 ? "destructive" : t.daysLeft <= 7 ? "default" : "secondary"} data-testid={`todo-due-${i}`}>{dueText(t.daysLeft)}</Badge>}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Review years</CardTitle><CardDescription>Open one to set objectives, complete your self assessment or read your report.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && appraisals.length === 0 && <p className="text-sm text-muted-foreground" data-testid="text-no-appraisals">You are not part of a review cycle yet. Your manager starts your review when the cycle is open.</p>}
          {appraisals.map(a => (
            <Link key={a.id} href={`/performance/appraisals/${a.id}`}>
              <div className="flex items-center justify-between gap-3 rounded-md border px-4 py-3 hover-elevate cursor-pointer" data-testid={`row-appraisal-${a.id}`}>
                <div><div className="font-medium">{a.cycleName}</div><div className="text-xs text-muted-foreground">{a.cycleStatus === "closed" ? "Cycle closed" : "Cycle open"}</div></div>
                <div className="flex items-center gap-3">
                  {a.status === "meeting" && !a.shared ? <Badge variant="secondary" data-testid="status-awaiting-discussion">Awaiting your discussion</Badge> : <StatusBadge status={a.status} />}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5" />Career history and qualifications</CardTitle>
          <CardDescription>Keep these up to date. They feed your experience and qualifications in the talent pool.</CardDescription></CardHeader>
        <CardContent><Link href="/career"><Button variant="outline" data-testid="button-open-career">Update my career profile</Button></Link></CardContent>
      </Card>
    </div>
  );
}
