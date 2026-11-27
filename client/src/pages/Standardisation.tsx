import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Action = { what: string; ownerId?: string | null; dueOn?: string | null; doneOn?: string | null; ownerName?: string | null };
type Rec = { id: string; heldOn: string; title: string; elementId: string | null; elementName: string | null; facilitatorName: string | null; attendeeIds: string[]; attendeeNames: string[]; sampleAssessmentIds: string[]; discussion: string; agreedApproach: string | null; actions: Action[]; mayEdit: boolean };
type Data = { mayRecord: boolean; people: Array<{ id: string; name: string }>; records: Rec[] };
const today = () => new Date().toISOString().slice(0, 10);
const when = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const empty = { id: "", heldOn: today(), title: "", elementId: "", attendeeIds: [] as string[], discussion: "", agreedApproach: "", actions: [] as Action[], sampleAssessmentIds: [] as string[] };

export default function Standardisation() {
  const { toast } = useToast();
  const data = useQuery<Data>({ queryKey: ["/api/standardisation"], queryFn: () => api("GET", "/api/standardisation") });
  const [form, setForm] = useState<typeof empty | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const { id, ...body } = form!;
      const clean = { ...body, elementId: body.elementId || null, actions: body.actions.filter((a) => a.what.trim()).map((a) => ({ what: a.what, ownerId: a.ownerId || null, dueOn: a.dueOn || null, doneOn: a.doneOn || null })) };
      return api(id ? "PUT" : "POST", id ? `/api/standardisation/${id}` : "/api/standardisation", clean);
    },
    onSuccess: () => { toast({ title: "Saved" }); setForm(null); queryClient.invalidateQueries({ queryKey: ["/api/standardisation"] }); },
    onError: (e: Error) => toast({ title: "Not saved", description: e.message, variant: "destructive" }),
  });
  const action = (i: number, patch: Partial<Action>) => setForm((f) => f && { ...f, actions: f.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="page-standardisation">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Standardisation</h1><p className="text-muted-foreground">Meetings where assessors and verifiers compare judgements, so that the same evidence gets the same decision.</p></div>
        {data.data?.mayRecord && !form && <Button onClick={() => setForm({ ...empty })} data-testid="button-new-meeting">Record a meeting</Button>}
      </div>
      {form && (
        <Card>
          <CardHeader><CardTitle>{form.id ? "Change a record" : "Record a meeting"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
              <div><Label>Date held</Label><Input type="date" max={today()} value={form.heldOn} onChange={(e) => setForm({ ...form, heldOn: e.target.value })} /></div>
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-meeting-title" /></div>
            </div>
            <div><Label>Who attended</Label>
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border p-2 md:grid-cols-3">
                {data.data!.people.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.attendeeIds.includes(p.id)} onChange={(e) => setForm({ ...form, attendeeIds: e.target.checked ? [...form.attendeeIds, p.id] : form.attendeeIds.filter((x) => x !== p.id) })} />{p.name}</label>)}
              </div>
            </div>
            <div><Label>What was compared and discussed</Label><Textarea rows={4} value={form.discussion} onChange={(e) => setForm({ ...form, discussion: e.target.value })} data-testid="input-meeting-discussion" /></div>
            <div><Label>Agreed approach</Label><Textarea rows={3} value={form.agreedApproach} onChange={(e) => setForm({ ...form, agreedApproach: e.target.value })} /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Actions</Label><Button size="sm" variant="outline" onClick={() => setForm({ ...form, actions: [...form.actions, { what: "" }] })}>Add action</Button></div>
              {form.actions.map((a, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[1fr_12rem_10rem_10rem]">
                  <Input placeholder="What" value={a.what} onChange={(e) => action(i, { what: e.target.value })} />
                  <select className="rounded-md border bg-background p-2 text-sm" aria-label="Owner" value={a.ownerId ?? ""} onChange={(e) => action(i, { ownerId: e.target.value })}><option value="">Owner</option>{data.data!.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  <Input type="date" aria-label="Due" value={a.dueOn ?? ""} onChange={(e) => action(i, { dueOn: e.target.value })} />
                  <Input type="date" aria-label="Done" value={a.doneOn ?? ""} onChange={(e) => action(i, { doneOn: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending || form.title.trim().length < 3 || !form.attendeeIds.length || form.discussion.trim().length < 10} data-testid="button-save-meeting">Save</Button>
              <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {data.isLoading ? <p className="text-muted-foreground">Loading...</p> : data.error ? <p className="text-destructive">{(data.error as Error).message}</p> : !data.data!.records.length ? <p className="text-muted-foreground">No meetings recorded yet.</p> : data.data!.records.map((r) => (
        <Card key={r.id} data-testid={`card-meeting-${r.id}`}>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div><CardTitle className="text-base">{r.title}</CardTitle><CardDescription>{when(r.heldOn)}. Led by {r.facilitatorName}. Attended: {r.attendeeNames.join(", ")}.{r.elementName ? ` Standard: ${r.elementName}.` : ""}</CardDescription></div>
            {r.mayEdit && <Button size="sm" variant="outline" onClick={() => setForm({ id: r.id, heldOn: r.heldOn.slice(0, 10), title: r.title, elementId: r.elementId ?? "", attendeeIds: r.attendeeIds, discussion: r.discussion, agreedApproach: r.agreedApproach ?? "", actions: r.actions.map(({ ownerName: _n, ...a }) => a), sampleAssessmentIds: r.sampleAssessmentIds })}>Change</Button>}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap">{r.discussion}</p>
            {r.agreedApproach && <p className="whitespace-pre-wrap"><span className="font-medium">Agreed: </span>{r.agreedApproach}</p>}
            {r.actions.map((a, i) => <p key={i} className="flex flex-wrap items-center gap-2"><Badge variant={a.doneOn ? "outline" : a.dueOn && a.dueOn < today() ? "destructive" : "secondary"}>{a.doneOn ? "Done" : a.dueOn && a.dueOn < today() ? "Overdue" : "Open"}</Badge>{a.what}{a.ownerName ? `, ${a.ownerName}` : ""}{a.dueOn ? `, due ${when(a.dueOn)}` : ""}</p>)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
