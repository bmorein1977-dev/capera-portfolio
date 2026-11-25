import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import type { VisitorSettings } from "@shared/visitorForm";
import { VisitorForm } from "./VisitorForm";
import { VISIT_STATUS, dayText, problem, refreshContractorData } from "./shared";

export interface VisitRow {
  id: string; reference: string; status: string; userId: string; firstName: string; lastName: string; arrivalDate: string | null; days: number | null;
  late: boolean; safetyCritical: string | null; companyName: string | null; files: number; submitBy: string | null;
}
const NEW = "__new";

function NewVisitDialog({ open, onClose, companyId, onCreated }: { open: boolean; onClose: () => void; companyId: string; onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const { data: people = [] } = useQuery<Array<{ id: string; firstName: string | null; lastName: string | null; status: string }>>({ queryKey: [`/api/contractor/people${companyId ? `?companyId=${companyId}` : ""}`], enabled: open });
  const [who, setWho] = useState(NEW);
  const [n, setN] = useState({ firstName: "", lastName: "", email: "" });
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/contractor/visits", { companyId: companyId || undefined, ...(who === NEW ? { newVisitor: n } : { personId: who }) })).json(),
    onSuccess: (r: { id: string }) => { refreshContractorData(); setWho(NEW); setN({ firstName: "", lastName: "", email: "" }); onClose(); onCreated(r.id); },
    onError: (e) => toast({ title: "Could not start the form", description: problem(e).message, variant: "destructive" }),
  });
  const choices = people.filter(p => p.status !== "left" && p.status !== "rejected");
  const ready = who !== NEW || (!!n.firstName.trim() && !!n.lastName.trim() && /.+@.+\..+/.test(n.email));
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent data-testid="dialog-new-visit">
        <DialogHeader><DialogTitle>Who is visiting?</DialogTitle><DialogDescription>One form for each person. It is filed on that person's record.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Visitor</Label>
            <Select value={who} onValueChange={setWho}><SelectTrigger data-testid="select-visitor"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW}>Someone not on our list yet</SelectItem>
                {choices.map(p => <SelectItem key={p.id} value={p.id}>{`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()}{p.status === "visitor" ? " (has visited before)" : ""}</SelectItem>)}
              </SelectContent></Select></div>
          {who === NEW && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="nv-first">Forename</Label><Input id="nv-first" value={n.firstName} onChange={e => setN({ ...n, firstName: e.target.value })} data-testid="input-visitor-first" /></div>
                <div><Label htmlFor="nv-last">Surname</Label><Input id="nv-last" value={n.lastName} onChange={e => setN({ ...n, lastName: e.target.value })} data-testid="input-visitor-last" /></div>
              </div>
              <div><Label htmlFor="nv-email">Business email</Label><Input id="nv-email" type="email" value={n.email} onChange={e => setN({ ...n, email: e.target.value })} data-testid="input-visitor-email" /></div>
              <p className="text-xs text-muted-foreground">A visitor is not added to your working people and does not count in training or competence figures.</p>
            </>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!ready || create.isPending} onClick={() => create.mutate()} data-testid="button-start-visit">Start the form</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VisitRows({ rows, onOpen, showCompany }: { rows: VisitRow[]; onOpen: (id: string) => void; showCompany?: boolean }) {
  return (
    <div className="divide-y">
      {rows.map(v => {
        const s = VISIT_STATUS[v.status] ?? VISIT_STATUS.draft;
        return (
          <div key={v.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`row-visit-${v.id}`}>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{v.firstName} {v.lastName}{showCompany && v.companyName ? <span className="font-normal text-muted-foreground">, {v.companyName}</span> : null}</div>
              <div className="text-sm text-muted-foreground">
                {v.arrivalDate ? `Arrives ${dayText(v.arrivalDate)}` : "No arrival date yet"}{v.days ? `, ${v.days} day${v.days === 1 ? "" : "s"}` : ""}, {v.files} certificate{v.files === 1 ? "" : "s"}, {v.reference}
                {(v.status === "draft" || v.status === "returned") && v.submitBy ? `. Submit by ${dayText(v.submitBy)}` : ""}
              </div>
            </div>
            {v.safetyCritical === "yes" && <Badge variant="secondary">Safety critical</Badge>}
            {v.late && <Badge variant="destructive">Late</Badge>}
            <Badge variant={s.tone}>{s.label}</Badge>
            <Button size="sm" variant="outline" onClick={() => onOpen(v.id)} data-testid={`button-open-visit-${v.id}`}>Open</Button>
          </div>
        );
      })}
    </div>
  );
}

export function VisitorsTab({ companyId, isHost, canCreate, openId, onOpen }: { companyId: string; isHost: boolean; canCreate: boolean; openId: string | null; onOpen: (id: string | null) => void }) {
  const [creating, setCreating] = useState(false);
  const { data: settings } = useQuery<VisitorSettings>({ queryKey: ["/api/contractor/visitor-settings"] });
  const listUrl = `/api/contractor/visits${companyId ? `?companyId=${companyId}` : ""}`;
  const { data = [], isLoading, error } = useQuery<VisitRow[]>({ queryKey: [listUrl], staleTime: 0 });
  if (openId && settings) return <VisitorForm visitId={openId} isHost={isHost} settings={settings} onBack={() => onOpen(null)} />;
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:justify-between">
        <div>
          <CardTitle className="text-base">Site visitors</CardTitle>
          <CardDescription>
            {isHost ? "Forms contracting companies have sent for people coming on a short visit. Open one to check it, then accept it or send it back."
              : `A form for each person coming to site for ${settings?.maxVisitDays ?? 5} days or less, with the competence checklist and certificates.`}
            {settings ? ` It must be submitted at least ${settings.noticeDays} day${settings.noticeDays === 1 ? "" : "s"} before they arrive.` : ""}
          </CardDescription>
        </div>
        {(!isHost || canCreate) && <Button size="sm" disabled={!canCreate} onClick={() => setCreating(true)} data-testid="button-new-visit"><Plus className="mr-1 h-4 w-4" />New visitor form</Button>}
      </CardHeader>
      <CardContent>
        {isHost && settings && settings.submissionEmails.length === 0 && <p className="mb-3 rounded-md bg-muted p-3 text-sm" data-testid="text-no-visitor-email">No email address is set for visitor forms yet, so submitted forms are only kept here. Set one under Visitor form settings.</p>}
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="py-6 text-center text-sm text-destructive">{problem(error).message}</p>}
        {!isLoading && !error && data.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No visitor forms yet.</p>}
        <VisitRows rows={data} onOpen={onOpen} showCompany={isHost && !companyId} />
      </CardContent>
      <NewVisitDialog open={creating} onClose={() => setCreating(false)} companyId={companyId} onCreated={onOpen} />
    </Card>
  );
}
