import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface VerificationTask {
  id: string;
  assessmentId: string;
  assessorId: string;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  verifiedAt: string | null;
  candidateName: string;
  elementCode: string;
  elementName: string;
  outcome: string;
  assessmentDate: string;
  knowledgeOutcomes: string;
  performanceOutcomes: string;
  overallComment: string;
  assessmentMethods: string[];
}

export default function VerifierDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<VerificationTask | null>(null);
  const [verifierComment, setVerifierComment] = useState("");
  const [statusFilter, setStatusFilter] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending');

  // Fetch verifier's pending tasks
  const { data: tasks = [], isLoading } = useQuery<VerificationTask[]>({
    queryKey: [`/api/verifier/${user?.id}/tasks`],
    enabled: !!user?.id,
  });

  // Filter tasks by status
  const filteredTasks = tasks.filter(task => {
    if (statusFilter === 'all') return true;
    return task.status === statusFilter;
  });

  // Approve/Reject mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ taskId, decision, comment }: { taskId: string; decision: 'verified' | 'rejected'; comment?: string }) => {
      return await apiRequest('POST', `/api/verifier/tasks/${taskId}/decision`, { decision, comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/verifier/${user?.id}/tasks`] });
      setSelectedTask(null);
      setVerifierComment('');
      toast({
        title: "Verification Complete",
        description: "The assessment verification decision has been recorded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to record verification decision.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "verified":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case "competent":
        return <Badge variant="default" className="bg-green-600">Competent</Badge>;
      case "not_yet_competent":
        return <Badge variant="destructive">Not Yet Competent</Badge>;
      case "competent_with_minor_needs":
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Minor Needs</Badge>;
      default:
        return <Badge>{outcome}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Verification Queue</h1>
          <p className="text-muted-foreground">Review and verify completed assessments</p>
        </div>
        <ClipboardCheck className="h-10 w-10 text-primary" />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'pending').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'verified').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'rejected').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Verification Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Tasks</CardTitle>
          <CardDescription>Assessments awaiting your verification</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
              <TabsTrigger value="verified" data-testid="tab-verified">Verified</TabsTrigger>
              <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={statusFilter} className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No {statusFilter !== 'all' ? statusFilter : ''} verification tasks</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className="border rounded-lg p-4 hover-elevate"
                      data-testid={`task-${task.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{task.candidateName}</h3>
                            {getStatusBadge(task.status)}
                            {getOutcomeBadge(task.outcome)}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm">
                              <span className="font-medium">{task.elementCode}:</span> {task.elementName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Assessed on {format(new Date(task.assessmentDate), 'PPP')}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {task.assessmentMethods.map((method) => (
                              <Badge key={method} variant="outline" className="text-xs">{method}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedTask(task)}
                            data-testid={`button-view-task-${task.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => {
        if (!open) {
          setSelectedTask(null);
          setVerifierComment('');
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0">
          <DialogHeader>
            <DialogTitle>Assessment Verification</DialogTitle>
            <DialogDescription>
              {selectedTask?.elementCode}: {selectedTask?.elementName}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6 pb-4">
              {/* Candidate & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Candidate</Label>
                  <p className="font-semibold">{selectedTask?.candidateName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Assessment Outcome</Label>
                  <div className="mt-1">{selectedTask && getOutcomeBadge(selectedTask.outcome)}</div>
                </div>
              </div>

              <Separator />

              {/* Assessment Outcomes */}
              <div className="space-y-4">
                <div>
                  <Label>Knowledge Outcomes</Label>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{selectedTask?.knowledgeOutcomes}</p>
                </div>

                <div>
                  <Label>Performance Outcomes</Label>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{selectedTask?.performanceOutcomes}</p>
                </div>

                <div>
                  <Label>Overall Comment</Label>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{selectedTask?.overallComment}</p>
                </div>
              </div>

              <Separator />

              {/* Assessment Methods */}
              <div>
                <Label>Assessment Methods Used</Label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {selectedTask?.assessmentMethods.map((method) => (
                    <Badge key={method} variant="outline">{method}</Badge>
                  ))}
                </div>
              </div>

              {/* Verification Actions (only for pending tasks) */}
              {selectedTask?.status === 'pending' && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="verifier-comment">Verifier Comment (Optional)</Label>
                      <Textarea
                        id="verifier-comment"
                        placeholder="Add any comments or feedback..."
                        value={verifierComment}
                        onChange={(e) => setVerifierComment(e.target.value)}
                        rows={3}
                        data-testid="textarea-verifier-comment"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => selectedTask && verifyMutation.mutate({
                          taskId: selectedTask.id,
                          decision: 'verified',
                          comment: verifierComment || undefined
                        })}
                        disabled={verifyMutation.isPending}
                        data-testid="button-approve"
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => selectedTask && verifyMutation.mutate({
                          taskId: selectedTask.id,
                          decision: 'rejected',
                          comment: verifierComment || undefined
                        })}
                        disabled={verifyMutation.isPending}
                        data-testid="button-reject"
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
