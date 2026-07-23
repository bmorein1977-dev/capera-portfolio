import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Video, FileText, Link as LinkIcon, PlayCircle, CheckCircle2, ExternalLink } from "lucide-react";
import type { TrainingContentWithProgress } from "@shared/schema";

const TYPE_ICONS: Record<string, any> = {
  video_upload: Video,
  video_link: PlayCircle,
  document: FileText,
  link: LinkIcon,
};

function itemHref(item: TrainingContentWithProgress["content"]): string | null {
  if (item.contentType === 'video_upload' || item.contentType === 'document') {
    return item.objectKey ? `/api/training-content/${item.id}/download` : null;
  }
  return item.externalUrl || null;
}

export default function LearningContentList({ trainingId }: { trainingId: string }) {
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<TrainingContentWithProgress[]>({
    queryKey: ['/api/trainings', trainingId, 'content-progress'],
    enabled: !!trainingId,
  });

  const progressMutation = useMutation({
    mutationFn: async ({ contentId, status }: { contentId: string; status: 'in_progress' | 'completed' }) =>
      apiRequest('POST', `/api/training-content/${contentId}/progress`, {
        status,
        progressPercentage: status === 'completed' ? 100 : 50,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainings', trainingId, 'content-progress'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update progress", variant: "destructive" });
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading learning content...</div>;
  if (items.length === 0) return null;

  const completedCount = items.filter(i => i.progress?.status === 'completed').length;

  return (
    <div className="space-y-2" data-testid="learning-content-list">
      <div className="flex items-center gap-3">
        <Progress value={items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0} className="flex-1 h-1.5" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{completedCount} / {items.length} content items</span>
      </div>
      <div className="space-y-1.5">
        {items.map(({ content, progress }) => {
          const Icon = TYPE_ICONS[content.contentType] || FileText;
          const href = itemHref(content);
          const isComplete = progress?.status === 'completed';
          return (
            <div key={content.id} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2" data-testid={`learning-content-item-${content.id}`}>
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline inline-flex items-center gap-1"
                    onClick={() => { if (!progress || progress.status === 'not_started') progressMutation.mutate({ contentId: content.id, status: 'in_progress' }); }}
                    data-testid={`link-content-${content.id}`}
                  >
                    {content.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="font-medium">{content.title}</span>
                )}
                {content.durationSeconds != null && (
                  <span className="text-xs text-muted-foreground ml-2">{Math.round(content.durationSeconds / 60)} min</span>
                )}
              </div>
              {isComplete ? (
                <Badge variant="outline" className="text-green-600 dark:text-green-400 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Complete
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => progressMutation.mutate({ contentId: content.id, status: 'completed' })}
                  disabled={progressMutation.isPending}
                  data-testid={`button-complete-content-${content.id}`}
                >
                  Mark Complete
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
