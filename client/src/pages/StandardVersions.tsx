import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { VERSION_STATUS_LABEL, type Change, type CriterionSnapshot, type StandardSnapshot, type VersionStatus } from "@shared/standardVersions";

type OverviewRow = { id: string; code: string | null; name: string; changeControl: boolean; currentVersion: number | null; currentStatus: string | null; open: { id: string; versionNumber: number; status: VersionStatus } | null };
type VersionRow = { id: string; versionNumber: number; status: VersionStatus; changeSummary: string | null; snapshot: StandardSnapshot; createdByName: string | null; submittedByName: string | null; decidedByName: string | null; createdAt: string; submittedAt: string | null; decidedAt: string | null; decisionNote: string | null; mayDecide: boolean; blockedBecause: string | null };
type Detail = { element: { id: string; code: string | null; name: string; changeControl: boolean; approverName: string | null }; levels: Array<{ id: string; name: string }>; live: StandardSnapshot; versions: VersionRow[] };
type Waiting = { id: string; elementId: string; code: string | null; name: string; versionNumber: number; changeSummary: string | null; submittedAt: string | null };

const when = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const SELECT = "w-full rounded-md border bg-background p-2 text-sm";

function ChangeList({ changes, comparedWith }: { changes: Change[]; comparedWith: string | null }) {
  if (!changes.length) return <p className="text-sm text-muted-foreground">No differences{comparedWith ? ` from ${comparedWith}` : ""}.</p>;
  return (
    <div className="space-y-2" data-testid="list-version-changes">
      {comparedWith && <p className="text-sm text-muted-foreground">Compared with {comparedWith}</p>}
      {changes.map((c, i) => (
        <div key={i} className="rounded-md border p-2 text-sm">
          <p className="font-medium">{c.what}</p>
          {c.before !== null && <p className="text-muted-foreground line-through whitespace-pre-wrap">{c.before}</p>}
          {c.after !== null && <p className="whitespace-pre-wrap">{c.after}</p>}
        </div>
      ))}
    </div>
  );
}

function Wording({ snapshot }: { snapshot: StandardSnapshot }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">{snapshot.element.code} {snapshot.element.name}</p>
      {snapshot.element.description && <p className="whitespace-pre-wrap text-muted-foreground">{snapshot.element.description}</p>}
      {(["knowledge", "performance"] as const).map((type) => {
        const list = snapshot.criteria.filter((c) => c.type === type);
        return list.length ? (
          <div key={type}>
            <p className="font-medium capitalize">{type}</p>
            <ul className="space-y-1">{list.map((c, i) => <li key={c.id ?? i}><span className="font-mono text-xs">{c.code}</span> {c.criteriaText}</li>)}</ul>
          </div>
        ) : null;
      })}
    </div>
  );
}

function DraftEditor({ version, levels, onDone }: { version: VersionRow; levels: Detail["levels"]; onDone: () => void }) {
  const { toast } = useToast();
  const [snap, setSnap] = useState<StandardSnapshot>(version.snapshot);
  const [summary, setSummary] = useState(version.changeSummary ?? "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setSnap(version.snapshot); setSummary(version.changeSummary ?? ""); setDirty(false); }, [version.id]);
  const el = (k: string, v: unknown) => { setSnap((s) => ({ ...s, element: { ...s.element, [k]: v } })); setDirty(true); };
  const crit = (i: number, patch: Partial<CriterionSnapshot>) => { setSnap((s) => ({ ...s, criteria: s.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) })); setDirty(true); };
  const add = (type: "knowledge" | "performance") => {
    const own = snap.criteria.filter((c) => c.type === type);
    const n = own.reduce((m, c) => Math.max(m, c.criteriaNumber || 0), 0) + 1;
    setSnap((s) => ({ ...s, criteria: [...s.criteria, { id: null, code: `${type === "knowledge" ? "K" : "P"} ${n}`, type, criteriaText: "", criteriaNumber: n, required: true, levelId: null }] }));
    setDirty(true);
  };
  const body = () => ({
    changeSummary: summary,
    snapshot: { element: { ...snap.element, description: snap.element.description ?? null }, criteria: snap.criteria.map((c) => ({ ...c, criteriaNumber: Number(c.criteriaNumber) || 0 })) },
  });
  const fail = (e: Error) => toast({ title: "Not saved", description: e.message, variant: "destructive" });
  const save = useMutation({ mutationFn: () => api("PUT", `/api/standard-versions/${version.id}`, body()), onSuccess: () => { setDirty(false); toast({ title: "Draft saved" }); onDone(); }, onError: fail });
  const send = useMutation({
    mutationFn: async () => { await api("PUT", `/api/standard-versions/${version.id}`, body()); return api("POST", `/api/standard-versions/${version.id}/submit`); },
    onSuccess: () => { toast({ title: "Sent for approval" }); onDone(); }, onError: fail,
  });
  return (
    <div className="space-y-4" data-testid="panel-draft-editor">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Title</Label><Input value={snap.element.name ?? ""} onChange={(e) => el("name", e.target.value)} data-testid="input-draft-title" /></div>
        <div><Label>Code</Label><Input value={snap.element.code ?? ""} onChange={(e) => el("code", e.target.value)} /></div>
        <div><Label>Safety criticality</Label>
          <select className={SELECT} value={snap.element.safetyCriticality ?? "Medium"} onChange={(e) => el("safetyCriticality", e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></div>
        <div><Label>Validity in months</Label><Input type="number" min={1} value={snap.element.validityMonths ?? ""} onChange={(e) => el("validityMonths", e.target.value ? Number(e.target.value) : null)} /></div>
      </div>
      <div><Label>Description</Label><Textarea value={snap.element.description ?? ""} onChange={(e) => el("description", e.target.value)} data-testid="input-draft-description" /></div>
      {(["knowledge", "performance"] as const).map((type) => (
        <div key={type} className="space-y-2">
          <div className="flex items-center justify-between"><p className="font-medium capitalize">{type} criteria</p><Button size="sm" variant="outline" onClick={() => add(type)} data-testid={`button-add-${type}`}>Add criterion</Button></div>
          {snap.criteria.map((c, i) => c.type !== type ? null : (
            <div key={c.id ?? `new-${i}`} className="grid gap-2 rounded-md border p-2 md:grid-cols-[7rem_1fr_auto]">
              <div className="space-y-1">
                <Input aria-label="Code" value={c.code} onChange={(e) => crit(i, { code: e.target.value })} />
                {levels.length > 0 && <select aria-label="Level" className={SELECT} value={c.levelId ?? ""} onChange={(e) => crit(i, { levelId: e.target.value || null })}><option value="">All levels</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
              </div>
              <Textarea aria-label="Wording" value={c.criteriaText} onChange={(e) => crit(i, { criteriaText: e.target.value })} />
              <Button size="sm" variant="ghost" onClick={() => { setSnap((s) => ({ ...s, criteria: s.criteria.filter((_, j) => j !== i) })); setDirty(true); }}>Remove</Button>
            </div>
          ))}
        </div>
      ))}
      <div><Label>What has changed, and why</Label><Textarea value={summary} onChange={(e) => { setSummary(e.target.value); setDirty(true); }} data-testid="input-change-summary" /></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending || !dirty} data-testid="button-save-draft">Save draft</Button>
        <Button onClick={() => send.mutate()} disabled={send.isPending || summary.trim().length < 5} data-testid="button-submit-version">Send for approval</Button>
      </div>
    </div>
  );
}

function Decision({ versionId, onDone }: { versionId: string; onDone: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") => api("POST", `/api/standard-versions/${versionId}/decide`, { decision, note }),
    onSuccess: (_d, decision) => { toast({ title: decision === "approve" ? "Approved and now in use" : "Sent back" }); onDone(); },
    onError: (e: Error) => toast({ title: "Not recorded", description: e.message, variant: "destructive" }),
  });
  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label>Note (needed if you send it back)</Label>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-decision-note" />
      <div className="flex gap-2">
        <Button onClick={() => decide.mutate("approve")} disabled={decide.isPending} data-testid="button-approve-version">Approve</Button>
        <Button variant="outline" onClick={() => decide.mutate("reject")} disabled={decide.isPending || note.trim().length < 5} data-testid="button-reject-version">Send back</Button>
      </div>
    </div>
  );
}

function VersionPanel({ elementId, onChanged }: { elementId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const key = ["/api/standards", elementId, "versions"];
  const { data, isLoading, error } = useQuery<Detail>({ queryKey: key, queryFn: () => api("GET", `/api/standards/${elementId}/versions`) });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [elementId]);
  const open = data?.versions.find((v) => v.status === "draft" || v.status === "in_review");
  const shownId = selected ?? open?.id ?? data?.versions[0]?.id ?? null;
  const shown = data?.versions.find((v) => v.id === shownId);
  const compare = useQuery<{ changes: Change[]; comparedWith: string | null }>({ queryKey: ["/api/standard-versions", shownId, shown?.status], queryFn: () => api("GET", `/api/standard-versions/${shownId}`), enabled: !!shownId });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: key }); queryClient.invalidateQueries({ queryKey: ["/api/standard-versions"] }); onChanged(); };
  const fail = (e: Error) => toast({ title: "Not done", description: e.message, variant: "destructive" });
  const start = useMutation({ mutationFn: () => api("POST", `/api/standards/${elementId}/versions`), onSuccess: () => { setSelected(null); refresh(); }, onError: fail });
  const control = useMutation({ mutationFn: (on: boolean) => api("PUT", `/api/standards/${elementId}/change-control`, { on }), onSuccess: refresh, onError: fail });
  const withdraw = useMutation({ mutationFn: (id: string) => api("POST", `/api/standard-versions/${id}/withdraw`), onSuccess: () => { setSelected(null); refresh(); }, onError: fail });
  if (isLoading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading...</CardContent></Card>;
  if (error || !data) return <Card><CardContent className="p-6 text-sm text-destructive">{(error as Error)?.message ?? "Not found"}</CardContent></Card>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.element.code} {data.element.name}</CardTitle>
        <CardDescription>{data.element.approverName ? `Named approver: ${data.element.approverName}. ` : "Any administrator who did not write the version can approve it. "}Each sign-off keeps the wording that was assessed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <div><p className="text-sm font-medium">Change control</p><p className="text-sm text-muted-foreground">When on, this standard can only be changed through an approved version.</p></div>
          <Switch checked={data.element.changeControl} onCheckedChange={(v) => control.mutate(v)} aria-label="Change control" data-testid="switch-change-control" />
        </div>
        {!open && <Button onClick={() => start.mutate()} disabled={start.isPending} data-testid="button-new-version">Start a new version</Button>}
        <div className="flex flex-wrap gap-2" data-testid="list-versions">
          {data.versions.map((v) => (
            <Button key={v.id} size="sm" variant={v.id === shownId ? "default" : "outline"} onClick={() => setSelected(v.id)}>v{v.versionNumber} <span className="ml-1 text-xs opacity-80">{VERSION_STATUS_LABEL[v.status]}</span></Button>
          ))}
          {!data.versions.length && <p className="text-sm text-muted-foreground">No versions yet. Start one, or the first is recorded at the next sign-off.</p>}
        </div>
        {shown && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={shown.status === "approved" ? "default" : "outline"}>{VERSION_STATUS_LABEL[shown.status]}</Badge>
              <span className="text-muted-foreground">
                {shown.createdByName ? `Written by ${shown.createdByName}, ${when(shown.createdAt)}. ` : `Recorded ${when(shown.createdAt)}. `}
                {shown.submittedByName ? `Submitted by ${shown.submittedByName}, ${when(shown.submittedAt)}. ` : ""}
                {shown.decidedByName ? `Decided by ${shown.decidedByName}, ${when(shown.decidedAt)}. ` : ""}
              </span>
              {(shown.status === "draft" || shown.status === "in_review") && <Button size="sm" variant="ghost" onClick={() => withdraw.mutate(shown.id)}>Withdraw</Button>}
            </div>
            {shown.changeSummary && <p className="text-sm"><span className="font-medium">Reason: </span>{shown.changeSummary}</p>}
            {shown.decisionNote && <p className="text-sm"><span className="font-medium">Decision note: </span>{shown.decisionNote}</p>}
            {shown.status === "draft" ? <DraftEditor version={shown} levels={data.levels} onDone={refresh} /> : (
              <>
                {compare.data && <ChangeList changes={compare.data.changes} comparedWith={compare.data.comparedWith} />}
                {shown.status === "in_review" && (shown.mayDecide ? <Decision versionId={shown.id} onDone={refresh} /> : <p className="text-sm text-muted-foreground">{shown.blockedBecause}</p>)}
                <details><summary className="cursor-pointer text-sm font-medium">Full wording of this version</summary><div className="pt-2"><Wording snapshot={shown.snapshot} /></div></details>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MyApprovals() {
  const waiting = useQuery<Waiting[]>({ queryKey: ["/api/standard-versions/waiting/mine"], queryFn: () => api("GET", "/api/standard-versions/waiting/mine") });
  const [open, setOpen] = useState<string | null>(null);
  const detail = useQuery<{ changes: Change[] }>({ queryKey: ["/api/standard-versions/waiting", open], queryFn: () => api("GET", `/api/standard-versions/waiting/${open}`), enabled: !!open });
  if (!waiting.data?.length) return null;
  return (
    <Card data-testid="card-my-approvals">
      <CardHeader><CardTitle>Waiting for your approval</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {waiting.data.map((w) => (
          <div key={w.id} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm font-medium">{w.code} {w.name}, version {w.versionNumber}</p><p className="text-sm text-muted-foreground">{w.changeSummary}</p></div>
              <Button size="sm" variant="outline" onClick={() => setOpen(open === w.id ? null : w.id)}>{open === w.id ? "Close" : "Review"}</Button>
            </div>
            {open === w.id && detail.data && <><ChangeList changes={detail.data.changes} comparedWith="the wording in use now" /><Decision versionId={w.id} onDone={() => { setOpen(null); queryClient.invalidateQueries({ queryKey: ["/api/standard-versions"] }); queryClient.invalidateQueries({ queryKey: ["/api/standard-versions/waiting/mine"] }); }} /></>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function StandardVersions() {
  const overview = useQuery<OverviewRow[]>({ queryKey: ["/api/standard-versions", "overview"], queryFn: () => api("GET", "/api/standard-versions/overview"), retry: false });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useMemo(() => (overview.data ?? []).filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(search.toLowerCase())), [overview.data, search]);
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Standard Versions</h1>
        <p className="text-muted-foreground">Draft changes to competence standards, have them approved by someone else, and keep every version.</p>
      </div>
      <MyApprovals />
      {overview.data && (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card>
            <CardContent className="space-y-2 p-3">
              <Input placeholder="Find a standard" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-find-standard" />
              <div className="max-h-[70vh] space-y-1 overflow-y-auto">
                {list.map((r) => (
                  <button key={r.id} onClick={() => setSelected(r.id)} className={`w-full rounded-md border p-2 text-left text-sm ${selected === r.id ? "border-primary bg-muted" : ""}`} data-testid={`row-standard-${r.id}`}>
                    <span className="font-medium">{r.code} {r.name}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{r.currentVersion ? `v${r.currentVersion}` : "No version yet"}</Badge>
                      {r.changeControl && <Badge variant="secondary">Change control</Badge>}
                      {r.open && <Badge>{VERSION_STATUS_LABEL[r.open.status]}</Badge>}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          {selected ? <VersionPanel elementId={selected} onChanged={() => overview.refetch()} /> : <Card><CardContent className="p-6 text-sm text-muted-foreground">Choose a standard to see its versions.</CardContent></Card>}
        </div>
      )}
    </div>
  );
}
