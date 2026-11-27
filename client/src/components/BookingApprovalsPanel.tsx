import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Waiting = { id: string; bookingId: string; step: number; steps: number; approverRole: string; personName: string; courseTitle: string; cost: string | null; listPrice: string | null; startAt: string };

/** course bookings whose next approval step, under the training policy, is the signed-in person's */
export default function BookingApprovalsPanel() {
  const { toast } = useToast();
  const list = useQuery<Waiting[]>({ queryKey: ["/api/booking-approvals/mine"], queryFn: () => api("GET", "/api/booking-approvals/mine") });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const decide = useMutation({
    mutationFn: ({ w, decision }: { w: Waiting; decision: "approve" | "reject" }) => api("POST", `/api/course-bookings/${w.bookingId}/approvals/decide`, { decision, comment: notes[w.id] ?? "" }),
    onSuccess: (_r, v) => { toast({ title: v.decision === "approve" ? "Approved" : "Refused" }); queryClient.invalidateQueries({ queryKey: ["/api/booking-approvals/mine"] }); },
    onError: (e: Error) => toast({ title: "Not recorded", description: e.message, variant: "destructive" }),
  });
  if (!list.data?.length) return null;
  return (
    <Card data-testid="card-booking-approvals">
      <CardHeader>
        <CardTitle>Course bookings waiting for your approval ({list.data.length})</CardTitle>
        <CardDescription>The training policy needs your decision before these can be confirmed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.data.map((w) => (
          <div key={w.id} className="space-y-2 rounded-md border p-3" data-testid={`row-booking-approval-${w.bookingId}`}>
            <p className="font-medium">{w.personName}: {w.courseTitle}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(w.startAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              {w.cost || w.listPrice ? `, cost ${w.cost ?? w.listPrice}` : ""}. Step {w.step} of {w.steps} ({w.approverRole.replace(/_/g, " ")}).
            </p>
            <div className="flex flex-wrap gap-2">
              <Input className="max-w-sm" placeholder="Comment (needed to refuse)" value={notes[w.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))} />
              <Button size="sm" onClick={() => decide.mutate({ w, decision: "approve" })} disabled={decide.isPending} data-testid={`button-approve-booking-${w.bookingId}`}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => decide.mutate({ w, decision: "reject" })} disabled={decide.isPending || (notes[w.id] ?? "").trim().length < 3}>Refuse</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
