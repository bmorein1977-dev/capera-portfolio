import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, XCircle, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import type { TrainingRequest } from "@shared/schema";

type PendingApproval = TrainingRequest & { requestorName: string; trainingName: string };

const REQUIREMENT_LABELS: Record<string, string> = { R: "Role Specific", D: "Discretionary" };

function ApprovalCard({ request }: { request: PendingApproval }) {
  const { toast } = useToast();
  const [reviewComment, setReviewComment] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async (decision: 'approved' | 'rejected') => {
      const res = await apiRequest('PUT', `/api/training-requests/${request.id}/review`, { decision, reviewComment: reviewComment || undefined });
      return res.json();
    },
    onSuccess: (_data, decision) => {
      toast({
        title: decision === 'approved' ? "Approved" : "Rejected",
        description: decision === 'approved'
          ? "The Training Administrator has been notified to book this."
          : `${request.requestorName} has been notified.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/training-requests/for-approval'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="border rounded-lg p-4 space-y-3" data-testid={`approval-request-${request.id}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold" data-testid={`text-training-name-${request.id}`}>{request.trainingName}</div>
          <div className="text-sm text-muted-foreground">
            Requested by {request.requestorName} on {request.createdAt ? format(new Date(request.createdAt), 'MMM dd, yyyy') : '—'}
          </div>
        </div>
        <Badge variant="outline">{REQUIREMENT_LABELS[request.requirementLevel || ''] || request.requirementLevel}</Badge>
      </div>
      <div className="text-sm">
        <span className="font-medium">Justification:</span>
        <p className="text-muted-foreground mt-1">{request.comment}</p>
      </div>
      <Textarea
        value={reviewComment}
        onChange={e => setReviewComment(e.target.value)}
        placeholder="Optional comment for the requestor..."
        rows={2}
        data-testid={`input-review-comment-${request.id}`}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => reviewMutation.mutate('rejected')}
          disabled={reviewMutation.isPending}
          data-testid={`button-reject-${request.id}`}
        >
          <XCircle className="h-4 w-4 mr-2" />Reject
        </Button>
        <Button
          size="sm"
          onClick={() => reviewMutation.mutate('approved')}
          disabled={reviewMutation.isPending}
          data-testid={`button-approve-${request.id}`}
        >
          <CheckCircle className="h-4 w-4 mr-2" />Approve
        </Button>
      </div>
    </div>
  );
}

export default function TrainingApprovals() {
  const { data: requests = [], isLoading } = useQuery<PendingApproval[]>({
    queryKey: ['/api/training-requests/for-approval'],
  });

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-training-approvals">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Training Approvals</h1>
        <p className="text-muted-foreground">Discretionary and role-specific training requests awaiting your decision</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Pending Requests ({requests.length})
          </CardTitle>
          <CardDescription>Your direct reports' requests, plus any others if you've been granted Training Approver access</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No requests awaiting your decision</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map(r => <ApprovalCard key={r.id} request={r} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
