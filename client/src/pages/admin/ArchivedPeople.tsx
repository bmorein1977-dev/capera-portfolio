import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { errorText, fmtDate } from "@/components/performance/shared";
import { Archive, Lock, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";

// Leavers and how long their personal details are kept. After the retention period their name, contact and personal details
// are removed while their competence and training history stays, so audit evidence and compliance figures still add up.

interface Person {
  id: string; name: string; email: string | null; jobRole: string | null; location: string | null; leftAt: string | null;
  removeOn: string | null; daysLeft: number | null; held: boolean; holdReason: string | null; removed: boolean; removedAt: string | null;
}
interface Settings { autoRemoveEnabled: boolean; retentionMonths: number; warnDays: number }

export default function ArchivedPeople() {
  const { toast } = useToast();
  const onError = (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["/api/retention/archived"] }); queryClient.invalidateQueries({ queryKey: ["/api/users"] }); };
  const { data, isLoading } = useQuery<{ settings: Settings; people: Person[] }>({ queryKey: ["/api/retention/archived"] });
  const people = data?.people ?? [];

  const [search, setSearch] = useState("");
  const [rule, setRule] = useState<{ auto: boolean; months: string; warn: string } | null>(null);
  const [holding, setHolding] = useState<{ person: Person; reason: string } | null>(null);
  const [removing, setRemoving] = useState<{ person: Person; confirm: string } | null>(null);
  const [restoring, setRestoring] = useState<Person | null>(null);

  const s = data?.settings;
  const shown = rule ?? (s ? { auto: s.autoRemoveEnabled, months: String(s.retentionMonths), warn: String(s.warnDays) } : null);
  const dirty = !!rule && !!s && (rule.auto !== s.autoRemoveEnabled || rule.months !== String(s.retentionMonths) || rule.warn !== String(s.warnDays));

  const saveRule = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/retention/settings", { autoRemoveEnabled: rule!.auto, retentionMonths: Number(rule!.months), warnDays: Number(rule!.warn) }),
    onSuccess: () => { toast({ title: "Retention rule saved" }); setRule(null); refresh(); }, onError,
  });
  const hold = useMutation({
    mutationFn: (v: { id: string; hold: boolean; reason?: string }) => apiRequest("POST", `/api/retention/${v.id}/hold`, { hold: v.hold, reason: v.reason }),
    onSuccess: () => { toast({ title: "Saved" }); setHolding(null); refresh(); }, onError,
  });
  const removeNow = useMutation({
    mutationFn: (v: { id: string; confirm: string }) => apiRequest("POST", `/api/retention/${v.id}/remove-now`, { confirm: v.confirm }),
    onSuccess: () => { toast({ title: "Personal details removed" }); setRemoving(null); refresh(); }, onError,
  });
  const restore = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/users/${id}/reactivate`),
    onSuccess: () => { toast({ title: "Person restored", description: "They can sign in again and are back in all reports." }); setRestoring(null); refresh(); }, onError,
  });
  const runNow = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/retention/run")).json() as Promise<{ removed: number; warned: number }>,
    onSuccess: (r) => { toast({ title: "Check finished", description: `${r.removed} removed, ${r.warned} warned about.` }); refresh(); }, onError,
  });

  const q = search.trim().toLowerCase();
  const list = people.filter(p => !q || `${p.name} ${p.email ?? ""} ${p.jobRole ?? ""} ${p.location ?? ""}`.toLowerCase().includes(q));

  const status = (p: Person) => {
    if (p.removed) return <Badge variant="secondary" data-testid={`badge-removed-${p.id}`}>Details removed {fmtDate(p.removedAt)}</Badge>;
    if (p.held) return <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200" data-testid={`badge-held-${p.id}`}><Lock className="h-3 w-3" />On hold</Badge>;
    if (!p.removeOn) return <span className="text-sm text-muted-foreground">No leaving date</span>;
    const due = (p.daysLeft ?? 0) <= 0;
    return (
      <span className="text-sm" data-testid={`text-remove-on-${p.id}`}>
        {fmtDate(p.removeOn)}
        <span className="block text-xs text-muted-foreground">{!s?.autoRemoveEnabled ? "automatic removal is off" : due ? "due at the next daily check" : `in ${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"}`}</span>
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Archive className="h-6 w-6" />Archived people</h1>
        <p className="mt-1 text-muted-foreground">People who have left. Their personal details are removed once the retention period has passed; their competence and training history is kept as a former employee.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retention rule</CardTitle>
          <CardDescription>Counted from each person's leaving date. Nothing is removed automatically until you turn this on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {shown && (
            <>
              <div className="flex items-start justify-between gap-4 rounded-md border p-3">
                <div><Label htmlFor="auto-remove">Remove personal details automatically</Label><p className="text-xs text-muted-foreground">Checked once a day. Removal cannot be undone.</p></div>
                <Switch id="auto-remove" checked={shown.auto} onCheckedChange={v => setRule({ ...shown, auto: v })} data-testid="switch-auto-remove" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="months">Keep details for (months after leaving)</Label><Input id="months" type="number" min={1} max={120} value={shown.months} onChange={e => setRule({ ...shown, months: e.target.value })} data-testid="input-retention-months" /></div>
                <div className="space-y-1.5"><Label htmlFor="warn">Warn administrators (days beforehand)</Label><Input id="warn" type="number" min={1} max={180} value={shown.warn} onChange={e => setRule({ ...shown, warn: e.target.value })} data-testid="input-warn-days" /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveRule.mutate()} disabled={!dirty || saveRule.isPending} data-testid="button-save-retention">{saveRule.isPending ? "Saving..." : "Save rule"}</Button>
                <Button variant="outline" onClick={() => runNow.mutate()} disabled={runNow.isPending || dirty || !s?.autoRemoveEnabled} data-testid="button-run-retention">Run the check now</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="text-base">Everyone archived</CardTitle><CardDescription>{isLoading ? "Loading..." : `${people.length} ${people.length === 1 ? "person" : "people"}`}</CardDescription></div>
          <Input className="sm:max-w-xs" placeholder="Search by name, role or location" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-archived" />
        </CardHeader>
        <CardContent className="p-0">
          {!isLoading && list.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground" data-testid="text-no-archived">{people.length ? "Nobody matches that search." : "Nobody has been archived."}</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Left</TableHead><TableHead>Details removed on</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.map(p => (
                  <TableRow key={p.id} data-testid={`row-archived-${p.id}`}>
                    <TableCell className="text-sm"><span className="font-medium">{p.name}</span><span className="block text-xs text-muted-foreground">{[p.jobRole, p.location].filter(Boolean).join(" · ") || p.email || ""}</span>{p.held && p.holdReason && <span className="block text-xs text-amber-700 dark:text-amber-300">Kept: {p.holdReason}</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{p.leftAt ? fmtDate(p.leftAt) : "—"}</TableCell>
                    <TableCell>{status(p)}</TableCell>
                    <TableCell className="text-right">
                      {p.removed ? <span className="text-xs text-muted-foreground">Cannot be restored</span> : (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setRestoring(p)} data-testid={`button-restore-${p.id}`}><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore</Button>
                          {p.held
                            ? <Button variant="outline" size="sm" onClick={() => hold.mutate({ id: p.id, hold: false })} data-testid={`button-release-${p.id}`}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Release hold</Button>
                            : <Button variant="outline" size="sm" onClick={() => setHolding({ person: p, reason: "" })} data-testid={`button-hold-${p.id}`}><Lock className="mr-1 h-3.5 w-3.5" />Keep</Button>}
                          <Button variant="outline" size="sm" onClick={() => setRemoving({ person: p, confirm: "" })} data-testid={`button-remove-${p.id}`}><Trash2 className="mr-1 h-3.5 w-3.5" />Remove now</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!restoring} onOpenChange={o => !o && setRestoring(null)}>
        <DialogContent data-testid="dialog-restore">
          <DialogHeader><DialogTitle>Restore {restoring?.name}?</DialogTitle><DialogDescription>They become a current employee again, can sign in, and return to all reports. Their leaving date is cleared.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setRestoring(null)}>Cancel</Button><Button onClick={() => restoring && restore.mutate(restoring.id)} disabled={restore.isPending} data-testid="button-confirm-restore">Restore</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!holding} onOpenChange={o => !o && setHolding(null)}>
        <DialogContent data-testid="dialog-hold">
          <DialogHeader><DialogTitle>Keep {holding?.person.name}'s details</DialogTitle><DialogDescription>Their details will not be removed automatically while this is on, for example during an investigation or a claim. Say why, so there is a record.</DialogDescription></DialogHeader>
          <Textarea value={holding?.reason ?? ""} onChange={e => holding && setHolding({ ...holding, reason: e.target.value })} placeholder="Why must these details be kept?" data-testid="input-hold-reason" />
          <DialogFooter><Button variant="outline" onClick={() => setHolding(null)}>Cancel</Button><Button onClick={() => holding && hold.mutate({ id: holding.person.id, hold: true, reason: holding.reason })} disabled={hold.isPending || (holding?.reason.trim().length ?? 0) < 5} data-testid="button-confirm-hold">Keep their details</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={o => !o && setRemoving(null)}>
        <DialogContent data-testid="dialog-remove">
          <DialogHeader><DialogTitle>Remove {removing?.person.name}'s personal details now?</DialogTitle>
            <DialogDescription>Their name, email, date of birth, numbers, photo, CV, career history, qualifications and absence notes are permanently removed. Their competence and training history stays, as a former employee. This cannot be undone.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="confirm-remove">Type REMOVE to confirm</Label><Input id="confirm-remove" value={removing?.confirm ?? ""} onChange={e => removing && setRemoving({ ...removing, confirm: e.target.value })} data-testid="input-confirm-remove" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="destructive" onClick={() => removing && removeNow.mutate({ id: removing.person.id, confirm: removing.confirm })} disabled={removeNow.isPending || removing?.confirm !== "REMOVE"} data-testid="button-confirm-remove">Remove details</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
