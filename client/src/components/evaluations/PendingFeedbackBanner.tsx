// A reminder on My Training while course feedback is waiting.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MessageSquareText } from "lucide-react";
import { useLicence } from "@/hooks/useAuth";
import { tierForPath, tierIncludes } from "@shared/licence";
import { dayText, type MyEvaluation } from "./shared";

export function PendingFeedbackBanner() {
  const included = tierIncludes(useLicence(), tierForPath("/my-training-feedback"));
  const { data } = useQuery<{ open: MyEvaluation[] }>({ queryKey: ["/api/training-evaluations/mine"], staleTime: 0, enabled: included });
  const open = data?.open ?? [];
  if (!open.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4" data-testid="banner-pending-feedback">
      <MessageSquareText className="h-5 w-5 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{open.length === 1 ? `Your feedback is wanted on ${open[0].courseTitle}` : `Your feedback is wanted on ${open.length} courses`}</div>
        <div className="text-sm text-muted-foreground">Please reply by {dayText(open[0].dueOn)}.</div>
      </div>
      <Button asChild size="sm"><Link href={open.length === 1 ? `/my-training-feedback/${open[0].id}` : "/my-training-feedback"} data-testid="link-give-feedback">Give feedback</Link></Button>
    </div>
  );
}
