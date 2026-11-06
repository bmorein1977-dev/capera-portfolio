import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { errorText, fmtDate } from "@/components/performance/shared";
import { CheckCircle2, Megaphone } from "lucide-react";

// What administrators have told this person. Notices that need attention come first; the rest follow, and expired ones sit under
// "Earlier". An important notice, or one that must be confirmed, also shows as a banner until it has been dealt with.

interface Item {
  id: string; title: string; body: string; importance: string; requiresAcknowledgement: boolean; goesLiveAt: string | null; expiresAt: string | null; expired: boolean; edited: boolean;
  readAt: string | null; acknowledgedAt: string | null; needsAction: boolean; sender: string | null;
}

export default function Announcements() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ announcements: Item[]; unread: number; needsAction: number }>({ queryKey: ["/api/announcements/mine"] });
  const items = data?.announcements ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/announcements/mine"] });
  const onError = (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" });
  const read = useMutation({ mutationFn: (id: string) => apiRequest("POST", `/api/announcements/${id}/read`), onSuccess: refresh, onError });
  const ack = useMutation({ mutationFn: (id: string) => apiRequest("POST", `/api/announcements/${id}/acknowledge`), onSuccess: () => { toast({ title: "Thank you", description: "Your confirmation has been recorded." }); refresh(); }, onError });

  const current = items.filter(i => !i.expired);
  const earlier = items.filter(i => i.expired);

  const card = (i: Item) => (
    <Card key={i.id} className={i.needsAction ? "border-amber-300" : ""} data-testid={`announcement-${i.id}`}>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{i.title}</h2>
            <p className="text-xs text-muted-foreground">{i.goesLiveAt ? fmtDate(i.goesLiveAt) : ""}{i.sender ? ` · from ${i.sender}` : ""}{i.edited ? " · updated since it was first posted" : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {i.importance === "important" && <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200" data-testid={`badge-important-${i.id}`}>Important</Badge>}
            {i.requiresAcknowledgement && <Badge variant="outline">Please confirm</Badge>}
            {!i.readAt && !i.expired && <Badge variant="secondary" data-testid={`badge-new-${i.id}`}>New</Badge>}
          </div>
        </div>
        <div className="whitespace-pre-wrap text-sm" data-testid={`text-body-${i.id}`}>{i.body}</div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          {i.acknowledgedAt ? (
            <span className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400"><CheckCircle2 className="h-4 w-4" />You confirmed this on {fmtDate(i.acknowledgedAt)}</span>
          ) : i.readAt && !i.requiresAcknowledgement ? (
            <span className="text-sm text-muted-foreground">You read this on {fmtDate(i.readAt)}</span>
          ) : <span className="text-sm text-muted-foreground">{i.expiresAt ? `Shown until ${fmtDate(i.expiresAt)}` : ""}</span>}
          {!i.acknowledgedAt && i.requiresAcknowledgement && !i.expired && <Button onClick={() => ack.mutate(i.id)} disabled={ack.isPending} data-testid={`button-acknowledge-${i.id}`}>I have read and understood this</Button>}
          {!i.readAt && !i.requiresAcknowledgement && !i.expired && <Button variant="outline" onClick={() => read.mutate(i.id)} disabled={read.isPending} data-testid={`button-read-${i.id}`}>Mark as read</Button>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Megaphone className="h-6 w-6" />Announcements</h1>
        <p className="mt-1 text-muted-foreground">Notices from your administrators that are meant for you.</p>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {!isLoading && items.length === 0 && <p className="rounded-md border p-8 text-center text-muted-foreground" data-testid="text-no-announcements">There are no announcements for you at the moment.</p>}
      {current.map(card)}
      {earlier.length > 0 && (
        <div className="space-y-4" data-testid="section-earlier">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Earlier</h2>
          {earlier.map(card)}
        </div>
      )}
    </div>
  );
}
