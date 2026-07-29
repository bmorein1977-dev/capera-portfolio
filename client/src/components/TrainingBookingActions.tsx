import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CalendarPlus, MapPin, Send } from "lucide-react";
import { format } from "date-fns";
import type { CourseTrainingSession, TrainingRequest } from "@shared/schema";

const REQUIREMENT_LABELS: Record<string, string> = { M: "Mandatory", R: "Role Specific", D: "Discretionary" };

interface Props {
  trainingId: string;
  trainingName: string;
  requirementLevel: string | null;
  myRequests: TrainingRequest[];
}

// The self-service booking/request actions for an External training on My Training. Nothing is
// shown for Internal trainings (LearningContentList already covers those) or when the training
// isn't a formal requirement of the person's own job role (requirementLevel null) - there's
// nothing sensible to book or request approval for in that case.
export default function TrainingBookingActions({ trainingId, trainingName, requirementLevel, myRequests }: Props) {
  const { toast } = useToast();
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [preferredVenue, setPreferredVenue] = useState("");

  const isMandatory = requirementLevel === 'M';
  const isDiscretionaryOrRole = requirementLevel === 'D' || requirementLevel === 'R';

  // A prior request for this training that's still live - blocks re-requesting until it's
  // resolved (fulfilled/rejected/cancelled all clear it, at which point a fresh request can be
  // made, e.g. after a rejection with new justification).
  const activeRequest = myRequests.find(r => r.trainingId === trainingId && ['pending', 'approved'].includes(r.status));

  const { data: sessions = [] } = useQuery<Array<CourseTrainingSession & { venueName?: string }>>({
    queryKey: [`/api/trainings/${trainingId}/external-sessions`],
    enabled: isMandatory && !activeRequest,
  });

  const bookMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest('POST', '/api/course-bookings', { sessionId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Booked", description: `Your booking for ${trainingName} is pending confirmation.` });
      setIsBookOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/course-bookings'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/training-requests', {
        trainingId,
        requestType: isMandatory ? 'date_request' : 'approval',
        comment,
        preferredVenue: isMandatory ? (preferredVenue || undefined) : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: isMandatory ? "Dates requested" : "Approval requested",
        description: isMandatory ? "The Training Administrator has been notified." : "Your manager has been notified.",
      });
      setIsRequestOpen(false);
      setComment("");
      setPreferredVenue("");
      queryClient.invalidateQueries({ queryKey: ['/api/training-requests/mine'] });
    },
    onError: (error: any) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  if (!requirementLevel) return null;

  if (activeRequest) {
    const label = activeRequest.status === 'approved'
      ? 'Approved - awaiting booking'
      : activeRequest.requestType === 'date_request' ? 'Dates requested' : 'Awaiting approval';
    return <Badge variant="outline" data-testid={`badge-request-status-${trainingId}`}>{label}</Badge>;
  }

  if (isMandatory && sessions.length > 0) {
    return (
      <Dialog open={isBookOpen} onOpenChange={setIsBookOpen}>
        <DialogTrigger asChild>
          <Button size="sm" data-testid={`button-book-${trainingId}`}>
            <CalendarPlus className="h-4 w-4 mr-2" />Book
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book {trainingName}</DialogTitle>
            <DialogDescription>Choose a session</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between border rounded-md p-3" data-testid={`session-option-${s.id}`}>
                <div className="text-sm">
                  <div className="font-medium">{format(new Date(s.startAt), 'MMM dd, yyyy HH:mm')}</div>
                  {s.venueName && (
                    <div className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{s.venueName}
                    </div>
                  )}
                  <div className="text-muted-foreground">{s.seatsRemaining} seat(s) remaining</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => bookMutation.mutate(s.id)}
                  disabled={bookMutation.isPending}
                  data-testid={`button-confirm-book-${s.id}`}
                >
                  Book
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isMandatory) {
    return (
      <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" data-testid={`button-request-dates-${trainingId}`}>
            <Send className="h-4 w-4 mr-2" />Request Dates
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request dates for {trainingName}</DialogTitle>
            <DialogDescription>
              No sessions are currently scheduled. Let the Training Administrator know your preferred
              dates and they'll arrange it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`comment-${trainingId}`}>Preferred dates *</Label>
              <Textarea
                id={`comment-${trainingId}`}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="e.g., Any week in March, avoiding the 10th-14th"
                data-testid={`input-preferred-dates-${trainingId}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`venue-${trainingId}`}>Preferred venue (if different from usual)</Label>
              <Input
                id={`venue-${trainingId}`}
                value={preferredVenue}
                onChange={e => setPreferredVenue(e.target.value)}
                data-testid={`input-preferred-venue-${trainingId}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestOpen(false)}>Cancel</Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={!comment.trim() || requestMutation.isPending}
              data-testid={`button-submit-request-dates-${trainingId}`}
            >
              {requestMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (isDiscretionaryOrRole) {
    return (
      <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" data-testid={`button-request-approval-${trainingId}`}>
            <Send className="h-4 w-4 mr-2" />Request Approval
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request approval for {trainingName}</DialogTitle>
            <DialogDescription>
              {REQUIREMENT_LABELS[requirementLevel]} training - your manager (and any Training
              Approver) will be notified to review this.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`justification-${trainingId}`}>Justification *</Label>
            <Textarea
              id={`justification-${trainingId}`}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Why do you need this training?"
              data-testid={`input-justification-${trainingId}`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestOpen(false)}>Cancel</Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={!comment.trim() || requestMutation.isPending}
              data-testid={`button-submit-request-approval-${trainingId}`}
            >
              {requestMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
