import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ClipboardCheck, CheckCircle2 } from "lucide-react";
import type { CompetencyElement } from "@shared/schema";

interface ReviewStatusRow extends CompetencyElement {
  dueDate: string | null;
  daysUntilDue: number | null;
  ownerName: string | null;
  approverName: string | null;
  reviewerName: string | null;
}

function urgencyBadge(daysUntilDue: number | null) {
  if (daysUntilDue === null) return null;
  if (daysUntilDue < 0) return <Badge variant="destructive">Overdue by {Math.abs(daysUntilDue)}d</Badge>;
  if (daysUntilDue <= 30) return <Badge variant="destructive">Due in {daysUntilDue}d</Badge>;
  if (daysUntilDue <= 60) return <Badge variant="outline" className="text-amber-600 dark:text-amber-400">Due in {daysUntilDue}d</Badge>;
  if (daysUntilDue <= 90) return <Badge variant="outline">Due in {daysUntilDue}d</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Due in {daysUntilDue}d</Badge>;
}

export default function CompetenceStandardsReviewAdmin() {
  const { toast } = useToast();
  const [confirmingElement, setConfirmingElement] = useState<ReviewStatusRow | null>(null);
  const [comment, setComment] = useState('');

  const { data: rows = [], isLoading } = useQuery<ReviewStatusRow[]>({
    queryKey: ['/api/competency-elements/review-status'],
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) =>
      apiRequest('POST', `/api/competency-elements/${id}/confirm-review`, { comment: comment || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/competency-elements/review-status'] });
      setConfirmingElement(null);
      setComment('');
      toast({ title: 'Review Confirmed', description: 'The review cycle has been reset from today.' });
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const overdueOrDueSoon = rows.filter(r => (r.daysUntilDue ?? Infinity) <= 90);
  const upcoming = rows.filter(r => (r.daysUntilDue ?? Infinity) > 90);

  const renderTable = (list: ReviewStatusRow[], emptyText: string) => (
    list.length === 0 ? (
      <div className="text-sm text-muted-foreground py-4">{emptyText}</div>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Standard</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Approver</TableHead>
            <TableHead>Reviewer</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map(row => (
            <TableRow key={row.id} data-testid={`row-standard-review-${row.id}`}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{row.dueDate ? format(new Date(row.dueDate), 'PP') : '—'}</TableCell>
              <TableCell>{urgencyBadge(row.daysUntilDue)}</TableCell>
              <TableCell className="text-muted-foreground">{row.ownerName || '—'}</TableCell>
              <TableCell className="text-muted-foreground">{row.approverName || '—'}</TableCell>
              <TableCell className="text-muted-foreground">{row.reviewerName || '—'}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmingElement(row)}
                  data-testid={`button-confirm-review-${row.id}`}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  return (
    <div className="p-6 space-y-6" data-testid="page-competence-standards-review-admin">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" />
          Competence Standards Review
        </h1>
        <p className="text-muted-foreground">
          Standards with a review cycle configured (set on the element in Competency Manager). Owner/approver/reviewer
          are emailed automatically at 90/60/30 days before a standard's review falls due.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No competence standards have a review cycle configured yet. Set one on an element in Competency Manager.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Due for Review ({overdueOrDueSoon.length})</CardTitle>
              <CardDescription>Overdue or within 90 days of their review due date.</CardDescription>
            </CardHeader>
            <CardContent>{renderTable(overdueOrDueSoon, "Nothing due for review right now.")}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming ({upcoming.length})</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(upcoming, "Nothing further out.")}</CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!confirmingElement} onOpenChange={(open) => { if (!open) { setConfirmingElement(null); setComment(''); } }}>
        <DialogContent data-testid="dialog-confirm-standard-review">
          <DialogHeader>
            <DialogTitle>Confirm Review</DialogTitle>
            <DialogDescription>
              Confirms "{confirmingElement?.name}" has been reviewed today, and resets its review cycle from now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="Optional review notes..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              data-testid="textarea-review-comment"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingElement(null)}>Cancel</Button>
            <Button
              onClick={() => confirmingElement && confirmMutation.mutate({ id: confirmingElement.id, comment })}
              disabled={confirmMutation.isPending}
              data-testid="button-confirm-review-submit"
            >
              Confirm Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
