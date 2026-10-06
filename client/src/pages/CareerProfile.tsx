import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Briefcase, GraduationCap, Pencil, Plus, Trash2, BadgeCheck } from "lucide-react";
import { errorText, fmtDate, useIsAdmin } from "@/components/performance/shared";

interface Experience { id: string; employer: string; title: string; jobFamilyId: string | null; jobRoleId: string | null; startDate: string; endDate: string | null; description: string | null; source: string; verified: boolean | null }
interface Qualification { id: string; name: string; level: number | null; awardingBody: string | null; awardedDate: string | null; expiryDate: string | null; source: string; verified: boolean | null }
interface JobRole { id: string; name: string; jobFamilyId: string | null }

const LEVELS: Array<[number, string]> = [
  [0, "Level 0: entry"], [1, "Level 1"], [2, "Level 2: GCSE / basic diploma"], [3, "Level 3: A-level / NVQ 3"], [4, "Level 4: HNC / certificate"],
  [5, "Level 5: HND / foundation degree"], [6, "Level 6: bachelor's degree"], [7, "Level 7: master's degree"], [8, "Level 8: doctorate"],
];
const NONE = "none";
const dateInput = (d?: string | null) => (d ? String(d).slice(0, 10) : "");

export default function CareerProfile({ userId }: { userId?: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const targetId = userId ?? user?.id;
  const editingOther = !!userId && userId !== user?.id;

  const expKey = `/api/users/${targetId}/experience`;
  const qualKey = `/api/users/${targetId}/qualifications`;
  const { data: experience = [], isLoading: loadingExp } = useQuery<Experience[]>({ queryKey: [expKey], enabled: !!targetId });
  const { data: quals = [], isLoading: loadingQual } = useQuery<Qualification[]>({ queryKey: [qualKey], enabled: !!targetId });
  const { data: roles = [] } = useQuery<JobRole[]>({ queryKey: ["/api/job-roles"] });
  const { data: target } = useQuery<{ firstName: string | null; lastName: string | null }>({ queryKey: [`/api/users/${targetId}`], enabled: !!targetId && editingOther });

  const [expDialog, setExpDialog] = useState<Partial<Experience> | null>(null);
  const [qualDialog, setQualDialog] = useState<Partial<Qualification> | null>(null);
  const roleName = (id: string | null) => roles.find(r => r.id === id)?.name;
  const onError = (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" });

  const saveExp = useMutation({
    mutationFn: async (e: Partial<Experience>) => (await apiRequest("POST", expKey, e)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [expKey] }); setExpDialog(null); toast({ title: "Career entry saved" }); }, onError,
  });
  const delExp = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `${expKey}/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [expKey] }); toast({ title: "Entry removed" }); }, onError,
  });
  const saveQual = useMutation({
    mutationFn: async (q: Partial<Qualification>) => (await apiRequest("POST", qualKey, q)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [qualKey] }); setQualDialog(null); toast({ title: "Qualification saved" }); }, onError,
  });
  const delQual = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `${qualKey}/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [qualKey] }); toast({ title: "Qualification removed" }); }, onError,
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <Link href={editingOther ? "/admin/users" : "/my-performance"}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">{editingOther ? `Career profile: ${target?.firstName ?? ""} ${target?.lastName ?? ""}` : "My career profile"}</h1>
        <p className="text-muted-foreground">Your experience and qualifications build your career profile and help your organisation see the skills it has. Matching each job to the most similar role in our organisation lets years of relevant experience be counted.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div><CardTitle className="flex items-center gap-2 text-lg"><Briefcase className="h-5 w-5" />Career history</CardTitle><CardDescription>Most recent first. Leave the end date empty for a current job.</CardDescription></div>
            <Button size="sm" onClick={() => setExpDialog({ source: "manual" })} data-testid="button-add-experience"><Plus className="h-4 w-4 mr-1" />Add job</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingExp && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loadingExp && experience.length === 0 && <p className="text-sm text-muted-foreground" data-testid="text-no-experience">No career history recorded yet.</p>}
          {experience.map(e => (
            <div key={e.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-4 py-3" data-testid={`row-experience-${e.id}`}>
              <div className="space-y-0.5">
                <div className="font-medium">{e.title} <span className="font-normal text-muted-foreground">at {e.employer}</span></div>
                <div className="text-xs text-muted-foreground">{fmtDate(e.startDate)} to {e.endDate ? fmtDate(e.endDate) : "present"}{roleName(e.jobRoleId) ? ` · like ${roleName(e.jobRoleId)}` : e.jobFamilyId ? " · matched to a role family" : ""}</div>
                {e.description && <div className="text-sm">{e.description}</div>}
                {!e.jobRoleId && !e.jobFamilyId && <div className="text-xs text-amber-600">Not yet matched to a role, so it is not counted as relevant experience.</div>}
              </div>
              <div className="flex items-center gap-1">
                {e.verified && <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3" />Verified</Badge>}
                {e.source === "cv_extracted" && <Badge variant="outline">From CV</Badge>}
                <Button size="icon" variant="ghost" aria-label="Edit job" onClick={() => setExpDialog(e)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Remove job" onClick={() => delExp.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div><CardTitle className="flex items-center gap-2 text-lg"><GraduationCap className="h-5 w-5" />Qualifications</CardTitle><CardDescription>Degrees, diplomas and certificates. Expired ones are not counted.</CardDescription></div>
            <Button size="sm" onClick={() => setQualDialog({ source: "manual" })} data-testid="button-add-qualification"><Plus className="h-4 w-4 mr-1" />Add qualification</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingQual && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loadingQual && quals.length === 0 && <p className="text-sm text-muted-foreground" data-testid="text-no-qualifications">No qualifications recorded yet.</p>}
          {quals.map(q => (
            <div key={q.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-4 py-3" data-testid={`row-qualification-${q.id}`}>
              <div className="space-y-0.5">
                <div className="font-medium">{q.name}</div>
                <div className="text-xs text-muted-foreground">{q.level != null ? `Level ${q.level}` : "Level not set"}{q.awardingBody ? ` · ${q.awardingBody}` : ""}{q.awardedDate ? ` · ${fmtDate(q.awardedDate)}` : ""}{q.expiryDate ? ` · expires ${fmtDate(q.expiryDate)}` : ""}</div>
              </div>
              <div className="flex items-center gap-1">
                {q.verified ? <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3" />Verified</Badge> : <Badge variant="outline">Not yet verified</Badge>}
                <Button size="icon" variant="ghost" aria-label="Edit qualification" onClick={() => setQualDialog(q)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Remove qualification" onClick={() => delQual.mutate(q.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {!isAdmin && <Alert><AlertDescription>HR can mark entries as verified once they have seen the evidence. Verified entries are shown with a badge.</AlertDescription></Alert>}

      <Dialog open={!!expDialog} onOpenChange={o => !o && setExpDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{expDialog?.id ? "Edit job" : "Add a job"}</DialogTitle><DialogDescription>Include jobs from before you joined as well as your current one.</DialogDescription></DialogHeader>
          {expDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label htmlFor="e-title">Job title</Label><Input id="e-title" value={expDialog.title ?? ""} onChange={e => setExpDialog({ ...expDialog, title: e.target.value })} data-testid="input-exp-title" /></div>
                <div className="space-y-1"><Label htmlFor="e-emp">Employer</Label><Input id="e-emp" value={expDialog.employer ?? ""} onChange={e => setExpDialog({ ...expDialog, employer: e.target.value })} data-testid="input-exp-employer" /></div>
              </div>
              <div className="space-y-1"><Label>Most similar role in our organisation</Label>
                <Select value={expDialog.jobRoleId ?? NONE} onValueChange={v => setExpDialog({ ...expDialog, jobRoleId: v === NONE ? null : v, jobFamilyId: v === NONE ? null : roles.find(r => r.id === v)?.jobFamilyId ?? null })}>
                  <SelectTrigger aria-label="Most similar role" data-testid="select-exp-role"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72"><SelectItem value={NONE}>Different kind of work</SelectItem>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label htmlFor="e-start">Start date</Label><Input id="e-start" type="date" value={dateInput(expDialog.startDate)} onChange={e => setExpDialog({ ...expDialog, startDate: e.target.value })} data-testid="input-exp-start" /></div>
                <div className="space-y-1"><Label htmlFor="e-end">End date (empty = current)</Label><Input id="e-end" type="date" value={dateInput(expDialog.endDate)} onChange={e => setExpDialog({ ...expDialog, endDate: e.target.value || null })} /></div>
              </div>
              <div className="space-y-1"><Label htmlFor="e-desc">What you did (optional)</Label><Textarea id="e-desc" rows={2} value={expDialog.description ?? ""} onChange={e => setExpDialog({ ...expDialog, description: e.target.value })} /></div>
              {isAdmin && <div className="flex items-center justify-between"><Label htmlFor="e-ver">Verified by HR</Label><Switch id="e-ver" checked={!!expDialog.verified} onCheckedChange={v => setExpDialog({ ...expDialog, verified: v })} /></div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setExpDialog(null)}>Cancel</Button>
            <Button disabled={saveExp.isPending || !expDialog?.title?.trim() || !expDialog?.employer?.trim() || !expDialog?.startDate} onClick={() => saveExp.mutate(expDialog!)} data-testid="button-save-experience">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qualDialog} onOpenChange={o => !o && setQualDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{qualDialog?.id ? "Edit qualification" : "Add a qualification"}</DialogTitle><DialogDescription>Choose the level that best matches. If unsure, leave it unset and HR can help.</DialogDescription></DialogHeader>
          {qualDialog && (
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="q-name">Qualification</Label><Input id="q-name" value={qualDialog.name ?? ""} onChange={e => setQualDialog({ ...qualDialog, name: e.target.value })} data-testid="input-qual-name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Level</Label>
                  <Select value={qualDialog.level != null ? String(qualDialog.level) : NONE} onValueChange={v => setQualDialog({ ...qualDialog, level: v === NONE ? null : Number(v) })}>
                    <SelectTrigger aria-label="Level" data-testid="select-qual-level"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>Not set</SelectItem>{LEVELS.map(([n, label]) => <SelectItem key={n} value={String(n)}>{label}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1"><Label htmlFor="q-body">Awarding body</Label><Input id="q-body" value={qualDialog.awardingBody ?? ""} onChange={e => setQualDialog({ ...qualDialog, awardingBody: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label htmlFor="q-date">Date awarded</Label><Input id="q-date" type="date" value={dateInput(qualDialog.awardedDate)} onChange={e => setQualDialog({ ...qualDialog, awardedDate: e.target.value || null })} /></div>
                <div className="space-y-1"><Label htmlFor="q-exp">Expires (if it does)</Label><Input id="q-exp" type="date" value={dateInput(qualDialog.expiryDate)} onChange={e => setQualDialog({ ...qualDialog, expiryDate: e.target.value || null })} /></div>
              </div>
              {isAdmin && <div className="flex items-center justify-between"><Label htmlFor="q-ver">Verified by HR</Label><Switch id="q-ver" checked={!!qualDialog.verified} onCheckedChange={v => setQualDialog({ ...qualDialog, verified: v })} /></div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setQualDialog(null)}>Cancel</Button>
            <Button disabled={saveQual.isPending || !qualDialog?.name?.trim()} onClick={() => saveQual.mutate(qualDialog!)} data-testid="button-save-qualification">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
