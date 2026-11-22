import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CalendarClock, Mail, Pause, Play, Send, Trash2 } from "lucide-react";

// The reports a manager or administrator has asked to have emailed to them every week or month. A report is always for the person who set it up and shows only what
// they are allowed to see. Reports are set up from the Export button on any page; this is where they are looked after.

interface Schedule {
  id: string; title: string; pagePath: string; when: string; format: "both" | "summary" | "excel"; useAi: boolean; enabled: boolean; nextRunAt: string | null; lastRunAt: string | null;
  lastStatus: "sent" | "not_sent" | "failed" | "blocked" | null; lastMessage: string | null; filters: string[]; mine: boolean; owner?: string;
}
interface Listing { aiAvailable: boolean; max: number; canSeeAll: boolean; schedules: Schedule[] }

const FORMAT: Record<Schedule["format"], string> = { both: "Summary and Excel workbook", summary: "Summary only", excel: "Excel workbook only" };
const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "Sent", cls: "bg-green-100 text-green-800" }, not_sent: { label: "Not sent", cls: "bg-amber-100 text-amber-800" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-800" }, blocked: { label: "Blocked", cls: "bg-red-100 text-red-800" },
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "not yet");
// the server's reply to a refused request arrives as "409: {...}"; show its own plain message
const plain = (e: any) => { const text = String(e?.message ?? ""), at = text.indexOf("{"); if (at >= 0) { try { return JSON.parse(text.slice(at)).error ?? text; } catch { /* fall through */ } } return String(e?.message ?? "Something went wrong."); };

export default function ScheduledReports() {
  const { toast } = useToast();
  const [everyone, setEveryone] = useState(false);
  const [deleting, setDeleting] = useState<Schedule | null>(null);
  const key = everyone ? "/api/report-schedules?all=1" : "/api/report-schedules";
  const { data, isLoading } = useQuery<Listing>({ queryKey: [key] });
  const refresh = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/report-schedules") });
  const fail = (title: string) => (e: any) => toast({ title, description: plain(e), variant: "destructive" });

  const pause = useMutation({
    mutationFn: async (v: { id: string; enabled: boolean }) => (await apiRequest("PATCH", `/api/report-schedules/${v.id}`, { enabled: v.enabled })).json(),
    onSuccess: (_d, v) => { toast({ title: v.enabled ? "Report resumed" : "Report paused" }); refresh(); }, onError: fail("Could not change it"),
  });
  const sendNow = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/report-schedules/${id}/send-now`, {})).json() as Promise<{ status: string; message: string }>,
    onSuccess: d => { toast({ title: d.status === "sent" ? "Report sent" : "Report not sent", description: d.message, variant: d.status === "sent" ? undefined : "destructive" }); refresh(); }, onError: fail("Could not send it"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/report-schedules/${id}`)).json(),
    onSuccess: () => { toast({ title: "Scheduled report deleted" }); setDeleting(null); refresh(); }, onError: fail("Could not delete it"),
  });

  const list = data?.schedules ?? [];
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6" data-testid="page-scheduled-reports">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><CalendarClock className="h-6 w-6" />Scheduled reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Reports emailed to you every week or month. Each one shows only what you are allowed to see, and goes only to you. To add one, open any page, choose Export, then "Email me this regularly".</p>
        </div>
        {data?.canSeeAll && <div className="flex items-center gap-2"><Switch id="everyone" checked={everyone} onCheckedChange={setEveryone} data-testid="switch-everyone" /><Label htmlFor="everyone" className="text-sm">Show everyone's</Label></div>}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && list.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Mail className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No scheduled reports yet</p>
          <p className="max-w-md text-sm text-muted-foreground">Open a page such as Compliance Explorer, Duty to Operate or the Audit Log, choose Export, then "Email me this regularly".</p>
          <Link href="/compliance-explorer"><Button variant="outline" size="sm" className="mt-2">Open Compliance Explorer</Button></Link>
        </CardContent></Card>
      )}

      {list.map(s => {
        const st = s.lastStatus ? STATUS[s.lastStatus] : null;
        return (
          <Card key={s.id} className={s.enabled ? "" : "opacity-70"} data-testid={`schedule-${s.id}`}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={s.pagePath} className="text-lg font-semibold hover:underline">{s.title}</Link>
                  <div className="text-sm text-muted-foreground">{s.when}</div>
                  {s.owner && <div className="text-xs text-muted-foreground">For {s.owner}{s.mine ? " (you)" : ""}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!s.enabled && <Badge variant="secondary">Paused</Badge>}
                  {st && <Badge className={st.cls} data-testid="badge-status">{st.label}</Badge>}
                </div>
              </div>
              <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">What you get: </span>{FORMAT[s.format]}{s.useAi ? ", with AI wording" : ""}</div>
                <div><span className="text-muted-foreground">Next: </span>{s.enabled ? when(s.nextRunAt) : "paused"}</div>
                <div><span className="text-muted-foreground">Last: </span>{when(s.lastRunAt)}</div>
                {s.filters.length > 0 && <div className="sm:col-span-2"><span className="text-muted-foreground">Filters: </span>{s.filters.join("; ")}</div>}
              </div>
              {s.lastMessage && <p className="rounded-md bg-muted p-2 text-xs" data-testid="text-last-message">{s.lastMessage}</p>}
              <div className="flex flex-wrap gap-2">
                {s.mine && <Button size="sm" variant="outline" onClick={() => sendNow.mutate(s.id)} disabled={sendNow.isPending} data-testid="button-send-now"><Send className="mr-1 h-4 w-4" />Send now</Button>}
                {(s.mine || s.enabled) && <Button size="sm" variant="outline" onClick={() => pause.mutate({ id: s.id, enabled: !s.enabled })} disabled={pause.isPending} data-testid="button-pause">
                  {s.enabled ? <><Pause className="mr-1 h-4 w-4" />Pause</> : <><Play className="mr-1 h-4 w-4" />Resume</>}</Button>}
                <Button size="sm" variant="outline" onClick={() => setDeleting(s)} data-testid="button-delete"><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {data && <p className="text-xs text-muted-foreground">You can have up to {data.max} scheduled reports. Excel workbooks include people's names, so they are sent only to your own Capera email address.</p>}

      <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this scheduled report?</AlertDialogTitle><AlertDialogDescription>{deleting?.title} will no longer be emailed. Past emails are not affected.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id)} data-testid="button-confirm-delete">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
