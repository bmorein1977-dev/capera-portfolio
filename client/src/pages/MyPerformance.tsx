import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, MessageSquareText, UserCircle } from "lucide-react";
import { StatusBadge, type AppraisalStatus } from "@/components/performance/shared";

interface MyAppraisal { id: string; status: AppraisalStatus; cycleId: string; cycleName: string; year: number; cycleStatus: string }
interface InboxItem { id: string; status: string; raterType: string; subjectName: string; cycleName: string }

export default function MyPerformance() {
  const { data: appraisals = [], isLoading } = useQuery<MyAppraisal[]>({ queryKey: ["/api/performance/my"] });
  const { data: inbox = [] } = useQuery<InboxItem[]>({ queryKey: ["/api/performance/feedback-inbox"] });
  const waiting = inbox.filter(i => i.status === "approved");

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">My Performance</h1>
        <p className="text-muted-foreground">Your objectives, reviews and feedback for each review year.</p>
      </div>

      {waiting.length > 0 && (
        <Card className="border-primary/40">
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><MessageSquareText className="h-5 w-5 text-primary" /><span data-testid="text-feedback-waiting">{waiting.length} colleague{waiting.length > 1 ? "s have" : " has"} asked for your feedback.</span></div>
            <Link href="/performance/feedback"><Button size="sm" data-testid="button-open-inbox">Give feedback</Button></Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Review years</CardTitle><CardDescription>Open one to set objectives, complete your self review or see your results.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && appraisals.length === 0 && <p className="text-sm text-muted-foreground" data-testid="text-no-appraisals">You are not part of a review cycle yet. If you think you should be, ask your manager or HR.</p>}
          {appraisals.map(a => (
            <Link key={a.id} href={`/performance/appraisals/${a.id}`}>
              <div className="flex items-center justify-between gap-3 rounded-md border px-4 py-3 hover-elevate cursor-pointer" data-testid={`row-appraisal-${a.id}`}>
                <div><div className="font-medium">{a.cycleName}</div><div className="text-xs text-muted-foreground">{a.cycleStatus === "closed" ? "Cycle closed" : "Cycle open"}</div></div>
                <div className="flex items-center gap-3"><StatusBadge status={a.status} /><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
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
