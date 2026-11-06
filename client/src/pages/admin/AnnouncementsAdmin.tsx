import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { errorText, fmtDate } from "@/components/performance/shared";
import { Megaphone, Plus } from "lucide-react";

// Announcements: write a notice, say who it is for (everyone, or any mix of business units, job roles and locations), publish or
// schedule it, and see who has read or confirmed it.

interface Row {
  id: string; title: string; body: string; importance: string; requiresAcknowledgement: boolean; audienceAll: boolean; businessUnitIds: string[] | null; jobRoleIds: string[] | null; locationIds: string[] | null;
  status: "draft" | "published" | "withdrawn"; sendEmail: boolean; publishAt: string | null; expiresAt: string | null; publishedAt: string | null; emailedAt: string | null;
  audienceCount: number; readCount: number; acknowledgedCount: number; scheduled: boolean; expired: boolean; audienceText: string;
}
interface Named { id: string; name: string }
interface Reader { userId: string; name: string; email: string | null; location: string | null; readAt: string | null; acknowledgedAt: string | null }

interface Form {
  id?: string; title: string; body: string; audienceAll: boolean; businessUnitIds: string[]; jobRoleIds: string[]; locationIds: string[];
  importance: "normal" | "important"; requiresAcknowledgement: boolean; sendEmail: boolean; schedule: boolean; publishAt: string; hasExpiry: boolean; expiresAt: string; status?: Row["status"]; emailedAt?: string | null;
}
const blank = (): Form => ({ title: "", body: "", audienceAll: false, businessUnitIds: [], jobRoleIds: [], locationIds: [], importance: "normal", requiresAcknowledgement: false, sendEmail: false, schedule: false, publishAt: "", hasExpiry: false, expiresAt: "" });
const toLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
const fromRow = (r: Row): Form => ({
  id: r.id, title: r.title, body: r.body, audienceAll: r.audienceAll, businessUnitIds: r.businessUnitIds ?? [], jobRoleIds: r.jobRoleIds ?? [], locationIds: r.locationIds ?? [], importance: r.importance as Form["importance"],
  requiresAcknowledgement: r.requiresAcknowledgement, sendEmail: r.sendEmail, schedule: !!r.publishAt, publishAt: toLocal(r.publishAt), hasExpiry: !!r.expiresAt, expiresAt: toLocal(r.expiresAt), status: r.status, emailedAt: r.emailedAt,
});

function Picker({ title, items, selected, onChange, testId }: { title: string; items: Named[]; selected: string[]; onChange: (ids: string[]) => void; testId: string }) {
  const [search, setSearch] = useState("");
  const shown = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><Label>{title}{selected.length > 0 && <span className="ml-2 text-xs text-muted-foreground">{selected.length} chosen</span>}</Label>
        {items.length > 8 && <Input className="h-8 max-w-[10rem]" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />}</div>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2" data-testid={testId}>
        {shown.length === 0 && <p className="text-xs text-muted-foreground">None to choose from.</p>}
        {shown.map(i => (
          <label key={i.id} className="flex items-center gap-2 text-sm"><Checkbox checked={selected.includes(i.id)} onCheckedChange={v => onChange(v === true ? [...selected, i.id] : selected.filter(x => x !== i.id))} data-testid={`${testId}-${i.id}`} />{i.name}</label>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ r }: { r: Row }) {
  if (r.status === "draft") return <Badge variant="secondary">Draft</Badge>;
  if (r.status === "withdrawn") return <Badge variant="outline">Withdrawn</Badge>;
  if (r.scheduled) return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200">Scheduled {fmtDate(r.publishAt)}</Badge>;
  if (r.expired) return <Badge variant="outline">Expired</Badge>;
  return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-200">Live</Badge>;
}

export default function AnnouncementsAdmin() {
  const { toast } = useToast();
  const onError = (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" });
  const refresh = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/announcements") });
  const { data: rows = [], isLoading } = useQuery<Row[]>({ queryKey: ["/api/announcements"] });
  const { data: units = [] } = useQuery<Named[]>({ queryKey: ["/api/org/business-units"] });
  const { data: roles = [] } = useQuery<Named[]>({ queryKey: ["/api/job-roles"] });
  const { data: places = [] } = useQuery<Named[]>({ queryKey: ["/api/org/locations"] });

  const [form, setForm] = useState<Form | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [withdrawing, setWithdrawing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const audienceQuery = form ? `/api/announcements/audience?all=${form.audienceAll ? 1 : 0}&businessUnitIds=${form.businessUnitIds.join(",")}&jobRoleIds=${form.jobRoleIds.join(",")}&locationIds=${form.locationIds.join(",")}` : "";
  const hasAudience = !!form && (form.audienceAll || form.businessUnitIds.length + form.jobRoleIds.length + form.locationIds.length > 0);
  const { data: reach } = useQuery<{ count: number; withoutEmail: number }>({ queryKey: [audienceQuery], enabled: hasAudience });
  const { data: readers } = useQuery<{ people: Reader[] }>({ queryKey: [`/api/announcements/${viewing?.id}/readers`], enabled: !!viewing });

  const payload = (f: Form) => ({
    title: f.title, body: f.body, audienceAll: f.audienceAll, businessUnitIds: f.businessUnitIds, jobRoleIds: f.jobRoleIds, locationIds: f.locationIds,
    importance: f.importance, requiresAcknowledgement: f.requiresAcknowledgement, sendEmail: f.sendEmail, publishAt: f.schedule ? toIso(f.publishAt) : null, expiresAt: f.hasExpiry ? toIso(f.expiresAt) : null,
  });
  const save = useMutation({
    mutationFn: async (v: { publish: boolean }) => {
      const f = form!;
      if (f.id) { await apiRequest("PUT", `/api/announcements/${f.id}`, payload(f)); if (v.publish && f.status !== "published") await apiRequest("POST", `/api/announcements/${f.id}/publish`); }
      else await apiRequest("POST", "/api/announcements", { ...payload(f), publish: v.publish });
    },
    onSuccess: (_d, v) => { toast({ title: v.publish ? "Published" : "Saved as a draft" }); setForm(null); refresh(); }, onError,
  });
  const act = useMutation({
    mutationFn: async (v: { id: string; what: "publish" | "withdraw" | "remind" }) => (await apiRequest("POST", `/api/announcements/${v.id}/${v.what}`)).json(),
    onSuccess: (r: any, v) => { toast({ title: v.what === "remind" ? `Reminder sent to ${r.reminded} ${r.reminded === 1 ? "person" : "people"}` : v.what === "publish" ? "Published" : "Withdrawn" }); setWithdrawing(null); refresh(); }, onError,
  });
  const del = useMutation({ mutationFn: (id: string) => apiRequest("DELETE", `/api/announcements/${id}`), onSuccess: () => { toast({ title: "Draft deleted" }); setDeleting(null); refresh(); }, onError });

  const canSave = !!form && form.title.trim() && form.body.trim() && hasAudience && (!form.schedule || form.publishAt) && (!form.hasExpiry || form.expiresAt);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Megaphone className="h-6 w-6" />Announcements</h1>
          <p className="mt-1 text-muted-foreground">Tell everyone, or chosen business units, job roles or locations, something they need to know, and see who has read it.</p>
        </div>
        <Button onClick={() => setForm(blank())} data-testid="button-new-announcement"><Plus className="mr-2 h-4 w-4" />New announcement</Button>
      </div>

      <Card><CardContent className="p-0">
        {!isLoading && rows.length === 0 ? <p className="p-8 text-center text-muted-foreground" data-testid="text-no-announcements-admin">No announcements yet.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Announcement</TableHead><TableHead>For</TableHead><TableHead>Status</TableHead><TableHead>Read</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} data-testid={`row-announcement-${r.id}`}>
                  <TableCell className="text-sm"><span className="font-medium">{r.title}</span>
                    <span className="mt-1 flex flex-wrap gap-1">{r.importance === "important" && <Badge variant="outline" className="text-red-700">Important</Badge>}{r.requiresAcknowledgement && <Badge variant="outline">Confirm</Badge>}{r.sendEmail && <Badge variant="outline">Email</Badge>}</span></TableCell>
                  <TableCell className="max-w-[14rem] text-sm">{r.audienceText}<span className="block text-xs text-muted-foreground">{r.audienceCount} {r.audienceCount === 1 ? "person" : "people"}</span></TableCell>
                  <TableCell><StatusBadge r={r} /></TableCell>
                  <TableCell className="whitespace-nowrap text-sm" data-testid={`text-read-${r.id}`}>{r.status === "draft" ? "—" : `${r.readCount} of ${r.audienceCount}`}{r.requiresAcknowledgement && r.status !== "draft" && <span className="block text-xs text-muted-foreground">{r.acknowledgedCount} confirmed</span>}</TableCell>
                  <TableCell className="text-right"><div className="flex flex-wrap justify-end gap-2">
                    {r.status !== "draft" && <Button variant="outline" size="sm" onClick={() => setViewing(r)} data-testid={`button-readers-${r.id}`}>Who has read it</Button>}
                    {r.status === "published" && <Button variant="outline" size="sm" onClick={() => act.mutate({ id: r.id, what: "remind" })} disabled={act.isPending} data-testid={`button-remind-${r.id}`}>Chase</Button>}
                    {r.status !== "withdrawn" && <Button variant="outline" size="sm" onClick={() => setForm(fromRow(r))} data-testid={`button-edit-${r.id}`}>Edit</Button>}
                    {r.status === "draft" && <Button size="sm" onClick={() => act.mutate({ id: r.id, what: "publish" })} disabled={act.isPending} data-testid={`button-publish-${r.id}`}>Publish</Button>}
                    {r.status === "withdrawn" && <Button size="sm" onClick={() => act.mutate({ id: r.id, what: "publish" })} disabled={act.isPending} data-testid={`button-republish-${r.id}`}>Publish again</Button>}
                    {r.status === "published" && <Button variant="outline" size="sm" onClick={() => setWithdrawing(r)} data-testid={`button-withdraw-${r.id}`}>Withdraw</Button>}
                    {r.status === "draft" && <Button variant="outline" size="sm" onClick={() => setDeleting(r)} data-testid={`button-delete-${r.id}`}>Delete</Button>}
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Dialog open={!!form} onOpenChange={o => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="dialog-announcement">
          {form && (
            <>
              <DialogHeader><DialogTitle>{form.id ? "Edit announcement" : "New announcement"}</DialogTitle><DialogDescription>{form.status === "published" ? "This is live. People will see your changes, with a note that it was updated. Nobody is emailed again." : "Write it, say who it is for, then save it as a draft or publish it."}</DialogDescription></DialogHeader>
              <div className="space-y-5">
                <div className="space-y-1.5"><Label htmlFor="ann-title">Title</Label><Input id="ann-title" value={form.title} maxLength={150} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-ann-title" /></div>
                <div className="space-y-1.5"><Label htmlFor="ann-body">Message</Label><Textarea id="ann-body" rows={7} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} data-testid="input-ann-body" /><p className="text-xs text-muted-foreground">Plain text. A blank line starts a new paragraph.</p></div>

                <section className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between"><Label htmlFor="ann-all">Everyone</Label><Switch id="ann-all" checked={form.audienceAll} onCheckedChange={v => setForm({ ...form, audienceAll: v })} data-testid="switch-ann-all" /></div>
                  {!form.audienceAll && (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">Or choose groups. Someone is included if they match any one of them. A business unit includes the units beneath it.</p>
                      <Picker title="Business units" items={units} selected={form.businessUnitIds} onChange={ids => setForm({ ...form, businessUnitIds: ids })} testId="pick-units" />
                      <Picker title="Job roles (main or secondary)" items={roles} selected={form.jobRoleIds} onChange={ids => setForm({ ...form, jobRoleIds: ids })} testId="pick-roles" />
                      <Picker title="Locations" items={places} selected={form.locationIds} onChange={ids => setForm({ ...form, locationIds: ids })} testId="pick-locations" />
                    </div>
                  )}
                  <p className="text-sm font-medium" data-testid="text-reach">{!hasAudience ? "Choose who it is for." : reach ? `This reaches ${reach.count} ${reach.count === 1 ? "person" : "people"}${reach.withoutEmail ? `, ${reach.withoutEmail} of them with no email address` : ""}.` : "Counting..."}</p>
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start justify-between gap-3 rounded-md border p-3"><div><Label htmlFor="ann-important">Important</Label><p className="text-xs text-muted-foreground">Shows a banner on every page until they have read it.</p></div><Switch id="ann-important" checked={form.importance === "important"} onCheckedChange={v => setForm({ ...form, importance: v ? "important" : "normal" })} data-testid="switch-ann-important" /></div>
                  <div className="flex items-start justify-between gap-3 rounded-md border p-3"><div><Label htmlFor="ann-ack">Ask people to confirm</Label><p className="text-xs text-muted-foreground">Each person ticks "I have read and understood". You can see who has.</p></div><Switch id="ann-ack" checked={form.requiresAcknowledgement} onCheckedChange={v => setForm({ ...form, requiresAcknowledgement: v })} data-testid="switch-ann-ack" /></div>
                  <div className="flex items-start justify-between gap-3 rounded-md border p-3"><div><Label htmlFor="ann-email">Also send an email</Label><p className="text-xs text-muted-foreground">Once, when it goes live.{form.emailedAt ? " Already sent." : ""}</p></div><Switch id="ann-email" checked={form.sendEmail} disabled={!!form.emailedAt} onCheckedChange={v => setForm({ ...form, sendEmail: v })} data-testid="switch-ann-email" /></div>
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between"><Label htmlFor="ann-schedule">Go live later</Label><Switch id="ann-schedule" checked={form.schedule} onCheckedChange={v => setForm({ ...form, schedule: v })} data-testid="switch-ann-schedule" /></div>
                    {form.schedule && <Input type="datetime-local" value={form.publishAt} onChange={e => setForm({ ...form, publishAt: e.target.value })} data-testid="input-ann-publish-at" />}
                    <div className="flex items-center justify-between pt-1"><Label htmlFor="ann-expiry">Stop showing it on a date</Label><Switch id="ann-expiry" checked={form.hasExpiry} onCheckedChange={v => setForm({ ...form, hasExpiry: v })} data-testid="switch-ann-expiry" /></div>
                    {form.hasExpiry && <Input type="datetime-local" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} data-testid="input-ann-expires-at" />}
                  </div>
                </section>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
                {form.status !== "published" && <Button variant="outline" disabled={!canSave || save.isPending} onClick={() => save.mutate({ publish: false })} data-testid="button-save-draft">Save as draft</Button>}
                <Button disabled={!canSave || save.isPending} onClick={() => save.mutate({ publish: form.status !== "published" })} data-testid="button-save-publish">{form.status === "published" ? "Save changes" : form.schedule ? "Schedule it" : "Publish now"}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="dialog-readers">
          <DialogHeader><DialogTitle>{viewing?.title}</DialogTitle><DialogDescription>{viewing ? `${viewing.readCount} of ${viewing.audienceCount} have read it${viewing.requiresAcknowledgement ? `, ${viewing.acknowledgedCount} have confirmed` : ""}. People who have not are listed first.` : ""}</DialogDescription></DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(readers?.people ?? []).map(p => (
                <TableRow key={p.userId} data-testid={`row-reader-${p.userId}`}>
                  <TableCell className="text-sm">{p.name}{!p.email && <span className="block text-xs text-muted-foreground">no email address</span>}</TableCell>
                  <TableCell className="text-sm">{p.location ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.acknowledgedAt ? <span className="text-green-700">Confirmed {fmtDate(p.acknowledgedAt)}</span> : p.readAt ? <span>Read {fmtDate(p.readAt)}{viewing?.requiresAcknowledgement ? ", not confirmed" : ""}</span> : <span className="text-amber-700">Not read</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={!!withdrawing} onOpenChange={o => !o && setWithdrawing(null)}>
        <DialogContent data-testid="dialog-withdraw">
          <DialogHeader><DialogTitle>Withdraw "{withdrawing?.title}"?</DialogTitle><DialogDescription>It disappears for everyone straight away. The record of who read it is kept, and you can publish it again later.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setWithdrawing(null)}>Cancel</Button><Button variant="destructive" onClick={() => withdrawing && act.mutate({ id: withdrawing.id, what: "withdraw" })} disabled={act.isPending} data-testid="button-confirm-withdraw">Withdraw</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <DialogContent data-testid="dialog-delete">
          <DialogHeader><DialogTitle>Delete this draft?</DialogTitle><DialogDescription>"{deleting?.title}" was never published, so nothing is lost but the draft.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" onClick={() => deleting && del.mutate(deleting.id)} disabled={del.isPending} data-testid="button-confirm-delete">Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
