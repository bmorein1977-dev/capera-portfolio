import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ClipboardCheck, PartyPopper } from "lucide-react";
import type { OnboardingChecklist } from "@shared/schema";

const CATEGORY_LABELS: Record<string, string> = {
  administrative: "Administrative",
  safety: "Safety",
  training: "Training",
  social: "Social",
  general: "General",
};

export default function MyOnboarding() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: checklist, isLoading } = useQuery<OnboardingChecklist | null>({
    queryKey: ['/api/users', user?.id, 'onboarding'],
    enabled: !!user?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ taskId, complete }: { taskId: string; complete: boolean }) => {
      if (!checklist) return;
      return complete
        ? apiRequest('POST', `/api/onboarding/assignments/${checklist.assignment.id}/tasks/${taskId}/complete`, {})
        : apiRequest('DELETE', `/api/onboarding/assignments/${checklist.assignment.id}/tasks/${taskId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', user?.id, 'onboarding'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update task", variant: "destructive" });
    },
  });

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">My Onboarding</h1>
          <p className="text-muted-foreground">Your induction checklist - work through each step below</p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-96" />
          </div>
        )}

        {!isLoading && !checklist && (
          <Alert data-testid="alert-no-onboarding">
            <ClipboardCheck className="h-4 w-4" />
            <AlertDescription>
              You don't have an active induction program assigned. Speak to your manager or an administrator if you're expecting one.
            </AlertDescription>
          </Alert>
        )}

        {checklist && (
          <>
            <Card data-testid="card-onboarding-summary">
              <CardHeader>
                <CardTitle className="text-lg">{checklist.program.name}</CardTitle>
                {checklist.program.description && <CardDescription>{checklist.program.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Progress value={checklist.statistics.completionPercentage} className="flex-1" data-testid="progress-onboarding" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap" data-testid="text-onboarding-progress">
                    {checklist.statistics.completedTasks} / {checklist.statistics.totalTasks} required tasks
                  </span>
                </div>
                {checklist.assignment.status === 'complete' && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium" data-testid="text-onboarding-complete">
                    <PartyPopper className="h-4 w-4" />
                    Induction complete - nice work!
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {checklist.tasks.map(({ task, completion }) => {
                    const done = !!completion?.completedAt;
                    return (
                      <div key={task.id} className="flex items-start gap-3 px-6 py-4" data-testid={`row-onboarding-task-${task.id}`}>
                        <Checkbox
                          checked={done}
                          onCheckedChange={checked => toggleMutation.mutate({ taskId: task.id, complete: !!checked })}
                          className="mt-1"
                          data-testid={`checkbox-onboarding-task-${task.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium ${done ? 'line-through text-muted-foreground' : ''}`} data-testid={`text-task-name-${task.id}`}>
                            {task.name}
                            {!task.required && <span className="text-xs text-muted-foreground ml-2 font-normal">(optional)</span>}
                          </div>
                          {task.description && (
                            <div className="text-sm text-muted-foreground mt-0.5">{task.description}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline">{CATEGORY_LABELS[task.category || 'general']}</Badge>
                            {task.dueOffsetDays != null && !done && (
                              <span className="text-xs text-muted-foreground">
                                due within {task.dueOffsetDays} day{task.dueOffsetDays === 1 ? '' : 's'} of start
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
