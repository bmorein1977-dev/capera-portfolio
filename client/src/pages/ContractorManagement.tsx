import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { VisitorsTab, VisitRows, type VisitRow } from "@/components/visitors/VisitorsTab";
import { VisitorSettingsTab } from "@/components/visitors/VisitorSettingsTab";
import { refreshContractorData } from "@/components/visitors/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { HardHat, Plus, ShieldCheck } from "lucide-react";

// Contractor management. A contracting company's administrator looks after that company's people: sees where each stands, adds and removes people,
// and records their training and competence. Entries count straight away and are marked as declared by the contractor; the host company can review
// and revoke them, and approves any person the contractor adds before they count. The host company's administrators use the same page and choose a company.

interface Company { id: string; name: string }
interface Stats { totalRequired: number; current: number; expired: number; missing: number; expiringSoon30: number }
interface Person {
  id: string; firstName: string | null; lastName: string | null; email: string | null; vantageNumber: string | null; jobRoleName: string | null; status: "active" | "pending" | "left" | "rejected" | "visitor";
  competence: Stats | null; training: Stats | null; verified: boolean;
}
interface Item { code?: string; name?: string; label?: string; required: boolean; status: string; expiryDate: string | null }
interface PersonDetail { person: { id: string; firstName: string | null; lastName: string | null; isActive: boolean; approvalStatus: string }; competence: Item[]; training: Item[] }
interface Declaration { id: string; kind: string; status: string; achievedAt: string; expiryDate: string | null; certificateRef: string | null; what: string; firstName: string | null; lastName: string | null; companyName: string | null; declaredAt: string; revokedReason: string | null }
interface Catalogue { trainings: Array<{ id: string; name: string; validityPeriod: number | null }>; elements: Array<{ id: string; code: string | null; name: string; reassessmentYears: number | null }> }

const nm = (f?: string | null, l?: string | null) => `${f ?? ""} ${l ?? ""}`.trim() || "Unnamed";
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No expiry");
const STATUS_LABEL: Record<string, string> = { current: "Current", expiring_30: "Expires in 30 days", expiring_60: "Expires in 60 days", expiring_90: "Expires in 90 days", expired: "Expired", missing: "Missing", exempt: "Exempt" };
const statusTone = (s: string) => (s === "current" ? "default" : s === "expired" || s === "missing" ? "destructive" : "secondary") as "default" | "destructive" | "secondary";
const errMsg = async (e: any) => { try { const j = await e.json(); return j.error || j.message; } catch { return e?.message || "Something went wrong"; } };

function useCompanyParam(companyId: string) { return companyId ? `?companyId=${companyId}` : ""; }

function AddPersonDialog({ open, onClose, companyId }: { open: boolean; onClose: () => void; companyId: string }) {
  const { toast } = useToast();
  const { data: roles = [] } = useQuery<Array<{ id: string; name: string }>>({ queryKey: ["/api/job-roles"], enabled: open });
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", jobRoleId: "", location: "", vantageNumber: "" });
  const m = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/contractor/people", { companyId: companyId || undefined, ...f, jobRoleId: f.jobRoleId || null, location: f.location || null, vantageNumber: f.vantageNumber || null }); return r.json(); },
    onSuccess: (d) => { toast({ title: "Person added", description: d.message }); refreshContractorData(); setF({ firstName: "", lastName: "", email: "", jobRoleId: "", location: "", vantageNumber: "" }); onClose(); },
    onError: async (e: any) => toast({ title: "Could not add the person", description: await errMsg(e), variant: "destructive" }),
  });
  const set = (k: string) => (e: any) => setF(s => ({ ...s, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent data-testid="dialog-add-contractor-person">
        <DialogHeader><DialogTitle>Add a person</DialogTitle><DialogDescription>They will count once the host company has approved them.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3"><div><Label>First name</Label><Input value={f.firstName} onChange={set("firstName")} data-testid="input-first-name" /></div><div><Label>Last name</Label><Input value={f.lastName} onChange={set("lastName")} data-testid="input-last-name" /></div></div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={set("email")} data-testid="input-email" /></div>
          <div><Label>Job role</Label>
            <Select value={f.jobRoleId} onValueChange={v => setF(s => ({ ...s, jobRoleId: v }))}><SelectTrigger data-testid="select-job-role"><SelectValue placeholder="Choose a job role" /></SelectTrigger>
              <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Location</Label><Input value={f.location} onChange={set("location")} /></div><div><Label>Vantage number</Label><Input value={f.vantageNumber} onChange={set("vantageNumber")} /></div></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={m.isPending || !f.firstName || !f.lastName || !f.email} onClick={() => m.mutate()} data-testid="button-save-person">Add person</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordDialog({ kind, personId, companyId, onClose }: { kind: "training" | "competence" | null; personId: string; companyId: string; onClose: () => void }) {
  const { toast } = useToast();
  const { data: cat } = useQuery<Catalogue>({ queryKey: [`/api/contractor/catalogue${useCompanyParam(companyId)}`], enabled: !!kind });
  const [f, setF] = useState({ what: "", date: "", expiry: "", ref: "", note: "" });
  const sel = kind === "training" ? cat?.trainings.find(t => t.id === f.what) : cat?.elements.find(e => e.id === f.what);
  const hint = kind === "training" ? ((sel as any)?.validityPeriod ? `If you leave this blank it expires ${(sel as any).validityPeriod} months after the date achieved.` : "") : ((sel as any)?.reassessmentYears ? `If you leave this blank it expires ${(sel as any).reassessmentYears} years after the date achieved.` : "An expiry date is needed for this competence.");
  const m = useMutation({
    mutationFn: async () => {
      const body = kind === "training"
        ? { companyId: companyId || undefined, trainingId: f.what, completedOn: f.date, expiryDate: f.expiry || null, certificateRef: f.ref || null, note: f.note || null }
        : { companyId: companyId || undefined, elementId: f.what, achievedOn: f.date, expiryDate: f.expiry || null, certificateRef: f.ref || null, note: f.note || null };
      const r = await apiRequest("POST", `/api/contractor/people/${personId}/${kind}`, body); return r.json();
    },
    onSuccess: () => { toast({ title: "Recorded", description: "It counts now and is marked as declared by the contractor." }); refreshContractorData(); setF({ what: "", date: "", expiry: "", ref: "", note: "" }); onClose(); },
    onError: async (e: any) => toast({ title: "Could not record it", description: await errMsg(e), variant: "destructive" }),
  });
  return (
    <Dialog open={!!kind} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent data-testid="dialog-record">
        <DialogHeader><DialogTitle>{kind === "training" ? "Record training" : "Record competence"}</DialogTitle><DialogDescription>Entered by the contractor company. It counts straight away, is marked as declared by the contractor, and the host company can review it.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div><Label>{kind === "training" ? "Training" : "Competence"}</Label>
            <Select value={f.what} onValueChange={v => setF(s => ({ ...s, what: v }))}><SelectTrigger data-testid="select-what"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{kind === "training" ? cat?.trainings.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>) : cat?.elements.map(e => <SelectItem key={e.id} value={e.id}>{e.code} {e.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date achieved</Label><Input type="date" value={f.date} onChange={e => setF(s => ({ ...s, date: e.target.value }))} data-testid="input-date" /></div>
            <div><Label>Expiry date</Label><Input type="date" value={f.expiry} onChange={e => setF(s => ({ ...s, expiry: e.target.value }))} data-testid="input-expiry" /></div>
          </div>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <div><Label>Certificate number or reference</Label><Input value={f.ref} onChange={e => setF(s => ({ ...s, ref: e.target.value }))} data-testid="input-ref" /></div>
          <div><Label>Note</Label><Textarea value={f.note} onChange={e => setF(s => ({ ...s, note: e.target.value }))} rows={2} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={m.isPending || !f.what || !f.date} onClick={() => m.mutate()} data-testid="button-save-record">Record</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemList({ title, items }: { title: string; items: Item[] }) {
  return (
    <div>
      <div className="mb-2 font-medium">{title} ({items.length})</div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing is required of this person yet.</p>}
      <div className="divide-y">
        {items.map((i, n) => (
          <div key={n} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <div className="min-w-0 flex-1"><div className="truncate">{i.code ? `${i.code} ` : ""}{i.name ?? i.label}{!i.required && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}</div><div className="text-xs text-muted-foreground">{day(i.expiryDate)}</div></div>
            <Badge variant={statusTone(i.status)}>{STATUS_LABEL[i.status] ?? i.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonDialog({ personId, companyId, onClose, onOpenVisit }: { personId: string | null; companyId: string; onClose: () => void; onOpenVisit: (id: string) => void }) {
  // the visitor forms filed on this person's record
  const { data: visits = [] } = useQuery<VisitRow[]>({ queryKey: [`/api/contractor/visits?userId=${personId}`], enabled: !!personId, staleTime: 0 });
  const [rec, setRec] = useState<"training" | "competence" | null>(null);
  const { data, isLoading } = useQuery<PersonDetail>({ queryKey: [`/api/contractor/people/${personId}${useCompanyParam(companyId)}`], enabled: !!personId });
  const ok = data?.person.isActive && data.person.approvalStatus === "approved";
  return (
    <Dialog open={!!personId} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl" data-testid="dialog-contractor-person">
        <DialogHeader><DialogTitle>{data ? nm(data.person.firstName, data.person.lastName) : "Person"}</DialogTitle><DialogDescription>Training and competence, as the host company sees it.</DialogDescription></DialogHeader>
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>}
        {data && (
          <>
            {!ok && <p className="rounded-md bg-muted p-3 text-sm" data-testid="text-not-approved">{data.person.approvalStatus === "visitor" ? "This person is a short-term visitor: their visitor forms are below. To record training or competence for them, add them under Add person with the same email, for the host company to approve." : "This person is waiting for the host company's approval, so nothing can be recorded for them yet."}</p>}
            {ok && <div className="flex gap-2"><Button size="sm" onClick={() => setRec("training")} data-testid="button-record-training"><Plus className="mr-1 h-4 w-4" />Record training</Button><Button size="sm" variant="outline" onClick={() => setRec("competence")} data-testid="button-record-competence"><Plus className="mr-1 h-4 w-4" />Record competence</Button></div>}
            <ScrollArea className="max-h-[55vh] pr-3"><div className="space-y-5">
              <div data-testid="person-visits"><div className="mb-2 font-medium">Site visits ({visits.length})</div>{visits.length === 0 ? <p className="text-sm text-muted-foreground">No visitor forms for this person.</p> : <VisitRows rows={visits} onOpen={(id) => { onClose(); onOpenVisit(id); }} />}</div>
              {data.person.approvalStatus !== "visitor" && <><ItemList title="Competence" items={data.competence} /><ItemList title="Training" items={data.training} /></>}
            </div></ScrollArea>
          </>
        )}
        <RecordDialog kind={rec} personId={personId ?? ""} companyId={companyId} onClose={() => setRec(null)} />
      </DialogContent>
    </Dialog>
  );
}

function PeopleTab({ companyId, canAdd, onOpenVisit }: { companyId: string; canAdd: boolean; onOpenVisit: (id: string) => void }) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Person | null>(null);
  const q = useCompanyParam(companyId);
  const { data = [], isLoading, error } = useQuery<Person[]>({ queryKey: [`/api/contractor/people${q}`], enabled: canAdd });
  const leave = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/contractor/people/${id}/leave`, { companyId: companyId || undefined })).json(),
    onSuccess: () => { toast({ title: "Marked as left" }); refreshContractorData(); setLeaving(null); },
    onError: async (e: any) => toast({ title: "Could not do that", description: await errMsg(e), variant: "destructive" }),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div><CardTitle className="text-base">People</CardTitle><CardDescription>Open someone to see and record their training and competence.</CardDescription></div>
        {canAdd && <Button size="sm" onClick={() => setAdding(true)} data-testid="button-add-person"><Plus className="mr-1 h-4 w-4" />Add person</Button>}
      </CardHeader>
      <CardContent>
        {!canAdd && <p className="py-6 text-center text-sm text-muted-foreground">Choose a contracting company above.</p>}
        {canAdd && isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="py-6 text-center text-sm text-destructive">{(error as Error).message}</p>}
        {canAdd && !isLoading && data.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No people yet.</p>}
        <div className="divide-y">
          {data.map(p => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`row-person-${p.id}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{nm(p.firstName, p.lastName)}</div>
                <div className="text-sm text-muted-foreground">{p.jobRoleName ?? "No job role"}{p.vantageNumber ? `, Vantage ${p.vantageNumber}` : ""}</div>
              </div>
              {p.status === "pending" && <Badge variant="secondary">Waiting for approval</Badge>}
              {p.status === "left" && <Badge variant="outline">Left</Badge>}
              {p.status === "visitor" && <Badge variant="outline">Short-term visitor</Badge>}
              {p.status === "rejected" && <Badge variant="destructive">Not approved</Badge>}
              {p.status === "active" && (p.competence || p.training) && (
                <>
                  <Badge variant={p.verified ? "default" : "destructive"}>{p.verified ? "Ready to work" : "Not ready"}</Badge>
                  <span className="text-xs text-muted-foreground">Competence {p.competence?.current ?? 0}/{p.competence?.totalRequired ?? 0}, Training {p.training?.current ?? 0}/{p.training?.totalRequired ?? 0}</span>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => setOpen(p.id)} data-testid={`button-open-${p.id}`}>Open</Button>
              {p.status !== "left" && p.status !== "rejected" && <Button size="sm" variant="ghost" onClick={() => setLeaving(p)} data-testid={`button-leave-${p.id}`}>Mark as left</Button>}
            </div>
          ))}
        </div>
      </CardContent>
      <AddPersonDialog open={adding} onClose={() => setAdding(false)} companyId={companyId} />
      <PersonDialog personId={open} companyId={companyId} onClose={() => setOpen(null)} onOpenVisit={onOpenVisit} />
      <Dialog open={!!leaving} onOpenChange={o => { if (!o) setLeaving(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Mark {leaving ? nm(leaving.firstName, leaving.lastName) : ""} as left?</DialogTitle><DialogDescription>They stop counting from today. Their history is kept.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setLeaving(null)}>Cancel</Button><Button variant="destructive" disabled={leave.isPending} onClick={() => leaving && leave.mutate(leaving.id)} data-testid="button-confirm-leave">Mark as left</Button></DialogFooter></DialogContent>
      </Dialog>
    </Card>
  );
}

function DeclarationsTab({ companyId, canView }: { companyId: string; canView: boolean }) {
  const { toast } = useToast();
  const [revoking, setRevoking] = useState<Declaration | null>(null);
  const [reason, setReason] = useState("");
  const q = companyId ? `?companyId=${companyId}&status=all` : "?status=all";
  const { data = [] } = useQuery<Declaration[]>({ queryKey: [`/api/contractor/declarations${q}`], enabled: canView });
  const revoke = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/contractor/declarations/${revoking!.id}/revoke`, { reason })).json(),
    onSuccess: () => { toast({ title: "Revoked", description: "It no longer counts." }); refreshContractorData(); setRevoking(null); setReason(""); },
    onError: async (e: any) => toast({ title: "Could not revoke it", description: await errMsg(e), variant: "destructive" }),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Declared by the contractor</CardTitle><CardDescription>Everything entered by a contractor company's administrator. Revoking one switches it off; the entry stays here as history.</CardDescription></CardHeader>
      <CardContent>
        {data.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing has been declared yet.</p>}
        <div className="divide-y">
          {data.map(d => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`row-declaration-${d.id}`}>
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{d.what}</div><div className="text-sm text-muted-foreground">{nm(d.firstName, d.lastName)}{d.companyName ? `, ${d.companyName}` : ""}, achieved {day(d.achievedAt)}, expires {day(d.expiryDate)}{d.certificateRef ? `, ref ${d.certificateRef}` : ""}</div>{d.revokedReason && <div className="text-xs text-destructive">Revoked: {d.revokedReason}</div>}</div>
              <Badge variant="outline">{d.kind === "training" ? "Training" : "Competence"}</Badge>
              {d.status === "revoked" ? <Badge variant="destructive">Revoked</Badge> : <Button size="sm" variant="outline" onClick={() => setRevoking(d)} data-testid={`button-revoke-${d.id}`}>Revoke</Button>}
            </div>
          ))}
        </div>
      </CardContent>
      <Dialog open={!!revoking} onOpenChange={o => { if (!o) setRevoking(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Revoke this entry?</DialogTitle><DialogDescription>It stops counting towards the person's training and competence. Say why.</DialogDescription></DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} data-testid="input-revoke-reason" />
          <DialogFooter><Button variant="outline" onClick={() => setRevoking(null)}>Cancel</Button><Button variant="destructive" disabled={reason.trim().length < 3 || revoke.isPending} onClick={() => revoke.mutate()} data-testid="button-confirm-revoke">Revoke</Button></DialogFooter></DialogContent>
      </Dialog>
    </Card>
  );
}

function PendingTab() {
  const { toast } = useToast();
  const { data = [] } = useQuery<Array<{ id: string; firstName: string | null; lastName: string | null; email: string | null; jobRoleName: string | null; companyName: string | null }>>({ queryKey: ["/api/contractor/pending"] });
  const decide = useMutation({
    mutationFn: async (v: { id: string; what: "approve" | "reject" }) => (await apiRequest("POST", `/api/contractor/people/${v.id}/${v.what}`)).json(),
    onSuccess: (_d, v) => { toast({ title: v.what === "approve" ? "Approved" : "Not approved" }); refreshContractorData(); },
    onError: async (e: any) => toast({ title: "Could not do that", description: await errMsg(e), variant: "destructive" }),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Waiting for approval</CardTitle><CardDescription>People a contractor has added. They count only once you approve them; approving gives them their job role's requirements.</CardDescription></CardHeader>
      <CardContent>
        {data.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nobody is waiting.</p>}
        <div className="divide-y">
          {data.map(p => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`row-pending-${p.id}`}>
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{nm(p.firstName, p.lastName)}</div><div className="text-sm text-muted-foreground">{p.companyName}, {p.jobRoleName ?? "no job role"}, {p.email}</div></div>
              <Button size="sm" onClick={() => decide.mutate({ id: p.id, what: "approve" })} data-testid={`button-approve-${p.id}`}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: p.id, what: "reject" })} data-testid={`button-reject-${p.id}`}>Do not approve</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ContractorManagement() {
  const { user } = useAuth();
  const roles = (user as any)?.effectiveRoles ?? [];
  const isHost = roles.some((r: string) => ["admin", "super_admin", "developer"].includes(r));
  const companiesQ = useQuery<Company[]>({ queryKey: ["/api/contractor/companies"] });
  const companies = companiesQ.data ?? [];
  const [picked, setPicked] = useState("");
  const companyId = isHost ? picked : (companies[0]?.id ?? "");
  const hasCompany = isHost ? !!picked : companies.length > 0;
  const q = isHost ? picked : "";
  // /contractor/visitors and /admin/contractors/visitors open straight on the visitor forms
  const [location] = useLocation();
  const [tab, setTab] = useState(location.endsWith("/visitors") ? "visitors" : "people");
  const [openVisit, setOpenVisit] = useState<string | null>(null);
  useEffect(() => { if (location.endsWith("/visitors")) { setTab("visitors"); setOpenVisit(null); } }, [location]);
  const showVisit = (id: string) => { setOpenVisit(id); setTab("visitors"); };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8" data-testid="page-contractor">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><HardHat className="h-6 w-6" /> {isHost ? "Contractor management" : "My contractor people"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{isHost ? "Review what contracting companies have declared, approve the people they add, and look after any company's people." : `${companies[0]?.name ?? "Your company"}: look after your people, add and remove them, and record their training and competence.`}</p>
      </div>
      {isHost && (
        <div className="max-w-sm"><Label>Contracting company</Label>
          <Select value={picked} onValueChange={setPicked}><SelectTrigger data-testid="select-company"><SelectValue placeholder="Choose a company" /></SelectTrigger>
            <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
      )}
      {isHost && companiesQ.isSuccess && companies.length === 0 && <p className="rounded-md bg-muted p-3 text-sm" data-testid="text-no-companies">There are no contracting companies yet. Add them under Administration, Organisation Structure, Contract companies.</p>}
      {!isHost && companiesQ.isSuccess && companies.length === 0 && <p className="rounded-md bg-muted p-3 text-sm">Your account is not linked to a contracting company yet. Ask the administrator.</p>}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="people" data-testid="tab-people">People</TabsTrigger><TabsTrigger value="visitors" data-testid="tab-visitors">Site visitors</TabsTrigger><TabsTrigger value="declared" data-testid="tab-declared">Declared records</TabsTrigger>{isHost && <TabsTrigger value="pending" data-testid="tab-pending">Waiting for approval</TabsTrigger>}{isHost && <TabsTrigger value="visitor-settings" data-testid="tab-visitor-settings">Visitor form settings</TabsTrigger>}</TabsList>
        <TabsContent value="people"><PeopleTab companyId={q} canAdd={hasCompany} onOpenVisit={showVisit} /></TabsContent>
        <TabsContent value="visitors"><VisitorsTab companyId={q} isHost={isHost} canCreate={hasCompany} openId={openVisit} onOpen={setOpenVisit} /></TabsContent>
        {isHost && <TabsContent value="visitor-settings"><VisitorSettingsTab /></TabsContent>}
        <TabsContent value="declared"><DeclarationsTab companyId={q} canView={isHost || hasCompany} /></TabsContent>
        {isHost && <TabsContent value="pending"><PendingTab /></TabsContent>}
      </Tabs>
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Everything entered here is recorded in the audit log.</p>
    </div>
  );
}
