import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { errorText, fmtDate } from "@/components/performance/shared";
import { Award, CheckCircle2, Clock, XCircle } from "lucide-react";

// E-learning certificates: whether they are issued automatically or wait for approval, the queue of those waiting, every
// certificate issued, and a per-course override.

interface Cert {
  id: string; certificateNumber: string; userId: string; trainingId: string; status: "pending" | "issued" | "declined" | "revoked"; mode: string;
  learnerName: string; courseName: string; completedAt: string; expiryDate: string | null; issuedAt: string | null; decidedByName: string | null; decisionNote: string | null;
}
interface Settings { defaultMode: "auto" | "manual"; issuerName: string; signatoryName: string | null; signatoryTitle: string | null; title: string; accentColour: string; logoData: string | null }
interface Course { id: string; name: string; certificateMode: string | null; items: number; effective: "auto" | "manual" | "none" }

const DEFAULT = "__default";
const MODE_LABEL: Record<string, string> = { auto: "Automatic", manual: "Manual approval", none: "No certificate" };

function StatusBadge({ status }: { status: Cert["status"] }) {
  if (status === "issued") return <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-950 dark:text-green-200"><CheckCircle2 className="h-3.5 w-3.5" />Issued</Badge>;
  if (status === "pending") return <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200"><Clock className="h-3.5 w-3.5" />Waiting</Badge>;
  if (status === "declined") return <Badge className="gap-1 bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200"><XCircle className="h-3.5 w-3.5" />Declined</Badge>;
  return <Badge variant="secondary" className="gap-1"><XCircle className="h-3.5 w-3.5" />Revoked</Badge>;
}

export default function CertificatesAdmin() {
  const { toast } = useToast();
  const onError = (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" });
  const refresh = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/certificates") });

  const { data: all = [], isLoading } = useQuery<Cert[]>({ queryKey: ["/api/certificates"] });
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/certificates/settings"] });
  const { data: courseData } = useQuery<{ defaultMode: string; courses: Course[] }>({ queryKey: ["/api/certificates/courses"] });
  const waiting = all.filter(c => c.status === "pending");

  const [form, setForm] = useState<Settings | null>(null);
  const shown = form ?? settings ?? null;
  const { logoData: _logo, ...editable } = (form ?? {}) as Settings;
  const { logoData: _saved, ...savedEditable } = (settings ?? {}) as Settings;
  const dirty = !!form && !!settings && JSON.stringify(editable) !== JSON.stringify(savedEditable);
  const [reasoning, setReasoning] = useState<{ cert: Cert; kind: "decline" | "revoke"; reason: string } | null>(null);
  const [filter, setFilter] = useState("all");

  const saveSettings = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/certificates/settings", editable),
    onSuccess: () => { toast({ title: "Saved" }); setForm(null); refresh(); }, onError,
  });
  const approve = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/certificates/${id}/approve`),
    onSuccess: () => { toast({ title: "Certificate issued", description: "The learner has been told." }); refresh(); }, onError,
  });
  const decide = useMutation({
    mutationFn: (v: { id: string; kind: "decline" | "revoke"; reason: string }) => apiRequest("POST", `/api/certificates/${v.id}/${v.kind}`, { reason: v.reason }),
    onSuccess: () => { toast({ title: "Saved" }); setReasoning(null); refresh(); }, onError,
  });
  const setMode = useMutation({
    mutationFn: (v: { id: string; mode: string | null }) => apiRequest("PUT", `/api/certificates/courses/${v.id}`, { mode: v.mode }),
    onSuccess: () => { toast({ title: "Saved" }); refresh(); }, onError,
  });
  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("logo", file);
      const res = await fetch("/api/certificates/logo", { method: "POST", body, credentials: "include" });
      if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({ error: "Could not upload the logo" }))));
      return res.json();
    },
    onSuccess: () => { toast({ title: "Logo saved" }); refresh(); }, onError,
  });
  const removeLogo = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/certificates/logo"),
    onSuccess: () => { toast({ title: "Logo removed" }); refresh(); }, onError,
  });
  const backfill = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/certificates/backfill")).json() as Promise<{ created: number; skipped: number }>,
    onSuccess: (r) => { toast({ title: "Done", description: `${r.created} created, ${r.skipped} already had one or are set to no certificate.` }); refresh(); }, onError,
  });

  const visible = all.filter(c => filter === "all" || c.status === filter);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Award className="h-6 w-6" />E-learning certificates</h1>
        <p className="mt-1 text-muted-foreground">A certificate is created when someone finishes all the e-learning for a training. Choose whether it is issued automatically or waits for your approval.</p>
      </div>

      <Tabs defaultValue="waiting">
        <TabsList>
          <TabsTrigger value="waiting" data-testid="tab-waiting">Waiting for approval ({waiting.length})</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all-certificates">All certificates</TabsTrigger>
          <TabsTrigger value="courses" data-testid="tab-courses">By course</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-cert-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="waiting">
          <Card><CardContent className="p-0">
            {waiting.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground" data-testid="text-none-waiting">{settings?.defaultMode === "manual" ? "Nothing is waiting for approval." : "Nothing is waiting. Certificates are issued automatically unless a course is set to manual approval."}</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Learner</TableHead><TableHead>Course</TableHead><TableHead>Completed</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {waiting.map(c => (
                    <TableRow key={c.id} data-testid={`row-waiting-${c.id}`}>
                      <TableCell className="text-sm font-medium">{c.learnerName}</TableCell>
                      <TableCell className="text-sm">{c.courseName}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDate(c.completedAt)}</TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild><a href={`/api/certificates/${c.id}/view`} target="_blank" rel="noopener noreferrer">Preview</a></Button>
                        <Button size="sm" onClick={() => approve.mutate(c.id)} disabled={approve.isPending} data-testid={`button-approve-${c.id}`}>Approve</Button>
                        <Button variant="outline" size="sm" onClick={() => setReasoning({ cert: c, kind: "decline", reason: "" })} data-testid={`button-decline-${c.id}`}>Decline</Button>
                      </div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle className="text-base">Every certificate</CardTitle><CardDescription>{isLoading ? "Loading..." : `${visible.length} shown`}</CardDescription></div>
              <div className="flex flex-wrap gap-2">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-40" data-testid="select-cert-filter"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="issued">Issued</SelectItem><SelectItem value="pending">Waiting</SelectItem><SelectItem value="declined">Declined</SelectItem><SelectItem value="revoked">Revoked</SelectItem></SelectContent>
                </Select>
                <Button variant="outline" onClick={() => backfill.mutate()} disabled={backfill.isPending} data-testid="button-backfill">Create for earlier completions</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {visible.length === 0 ? <p className="p-8 text-center text-muted-foreground" data-testid="text-no-certificates">No certificates yet.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Learner</TableHead><TableHead>Course</TableHead><TableHead>Completed</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visible.map(c => (
                      <TableRow key={c.id} data-testid={`row-certificate-${c.id}`}>
                        <TableCell className="whitespace-nowrap text-xs">{c.certificateNumber}</TableCell>
                        <TableCell className="text-sm">{c.learnerName}</TableCell>
                        <TableCell className="text-sm">{c.courseName}{c.expiryDate && <span className="block text-xs text-muted-foreground">valid until {fmtDate(c.expiryDate)}</span>}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDate(c.completedAt)}</TableCell>
                        <TableCell><StatusBadge status={c.status} />{c.decisionNote && <span className="block text-xs text-muted-foreground">{c.decisionNote}</span>}</TableCell>
                        <TableCell className="text-right"><div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild><a href={`/api/certificates/${c.id}/view`} target="_blank" rel="noopener noreferrer">View</a></Button>
                          {c.status === "issued" && <Button variant="outline" size="sm" onClick={() => setReasoning({ cert: c, kind: "revoke", reason: "" })} data-testid={`button-revoke-${c.id}`}>Revoke</Button>}
                        </div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <Card>
            <CardHeader><CardTitle className="text-base">By course</CardTitle><CardDescription>Courses with e-learning content. A course can follow the organisation default, or be set on its own. The organisation default is currently <strong>{MODE_LABEL[courseData?.defaultMode ?? "auto"]}</strong>.</CardDescription></CardHeader>
            <CardContent className="p-0">
              {!courseData?.courses.length ? <p className="p-8 text-center text-muted-foreground" data-testid="text-no-courses">No courses have e-learning content yet.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Content items</TableHead><TableHead>Certificate</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {courseData.courses.map(c => (
                      <TableRow key={c.id} data-testid={`row-course-${c.id}`}>
                        <TableCell className="text-sm font-medium">{c.name}</TableCell>
                        <TableCell className="text-sm">{c.items}</TableCell>
                        <TableCell>
                          <Select value={c.certificateMode ?? DEFAULT} onValueChange={v => setMode.mutate({ id: c.id, mode: v === DEFAULT ? null : v })}>
                            <SelectTrigger className="w-56" data-testid={`select-course-mode-${c.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={DEFAULT}>Organisation default ({MODE_LABEL[courseData.defaultMode]})</SelectItem>
                              <SelectItem value="auto">Automatic</SelectItem><SelectItem value="manual">Manual approval</SelectItem><SelectItem value="none">No certificate</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="text-base">Settings</CardTitle><CardDescription>Applies to every course that does not have its own setting.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {shown && (
                <>
                  <div className="flex items-start justify-between gap-4 rounded-md border p-3">
                    <div><Label htmlFor="manual-mode">Approve each certificate before it is issued</Label><p className="text-xs text-muted-foreground">Off: a certificate is issued the moment someone finishes the e-learning. On: it waits in the approval queue.</p></div>
                    <Switch id="manual-mode" checked={shown.defaultMode === "manual"} onCheckedChange={v => setForm({ ...shown, defaultMode: v ? "manual" : "auto" })} data-testid="switch-manual-mode" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label htmlFor="issuer">Issued by</Label><Input id="issuer" value={shown.issuerName} onChange={e => setForm({ ...shown, issuerName: e.target.value })} data-testid="input-issuer-name" /></div>
                    <div className="space-y-1.5"><Label htmlFor="sig-name">Signatory name</Label><Input id="sig-name" value={shown.signatoryName ?? ""} onChange={e => setForm({ ...shown, signatoryName: e.target.value })} data-testid="input-signatory-name" /></div>
                    <div className="space-y-1.5"><Label htmlFor="sig-title">Signatory title</Label><Input id="sig-title" value={shown.signatoryTitle ?? ""} onChange={e => setForm({ ...shown, signatoryTitle: e.target.value })} data-testid="input-signatory-title" /></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="cert-title">Heading on the certificate</Label><Input id="cert-title" value={shown.title} onChange={e => setForm({ ...shown, title: e.target.value })} data-testid="input-cert-title" /></div>
                    <div className="space-y-1.5"><Label htmlFor="cert-colour">Colour</Label>
                      <div className="flex items-center gap-2"><input id="cert-colour" type="color" className="h-9 w-14 cursor-pointer rounded border bg-transparent p-1" value={shown.accentColour} onChange={e => setForm({ ...shown, accentColour: e.target.value })} data-testid="input-cert-colour" /><span className="text-sm text-muted-foreground">{shown.accentColour}</span></div></div>
                  </div>
                  <div className="space-y-2 rounded-md border p-3">
                    <Label>Your logo</Label>
                    <p className="text-xs text-muted-foreground">A PNG, JPEG or WebP image under 1 MB. It appears at the top of every certificate. A transparent or white background works best.</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {settings?.logoData ? <img src={settings.logoData} alt="Current logo" className="max-h-16 max-w-48 rounded border bg-white object-contain p-1" data-testid="img-cert-logo" /> : <span className="text-sm text-muted-foreground" data-testid="text-no-logo">No logo yet</span>}
                      <Input type="file" accept="image/png,image/jpeg,image/webp" className="max-w-xs" disabled={uploadLogo.isPending} onChange={e => { const file = e.target.files?.[0]; if (file) uploadLogo.mutate(file); e.target.value = ""; }} data-testid="input-cert-logo" />
                      {settings?.logoData && <Button variant="outline" size="sm" onClick={() => removeLogo.mutate()} disabled={removeLogo.isPending} data-testid="button-remove-logo">Remove logo</Button>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => saveSettings.mutate()} disabled={!dirty || saveSettings.isPending} data-testid="button-save-cert-settings">{saveSettings.isPending ? "Saving..." : "Save"}</Button>
                    <Button variant="outline" asChild data-testid="button-preview-certificate"><a href="/api/certificates/preview" target="_blank" rel="noopener noreferrer">Preview a sample certificate</a></Button>
                  </div>
                  {dirty && <p className="text-xs text-muted-foreground">Save before previewing to see your changes.</p>}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reasoning} onOpenChange={o => !o && setReasoning(null)}>
        <DialogContent data-testid="dialog-cert-reason">
          <DialogHeader>
            <DialogTitle>{reasoning?.kind === "decline" ? "Decline" : "Revoke"} this certificate?</DialogTitle>
            <DialogDescription>{reasoning?.cert.learnerName}: {reasoning?.cert.courseName}. {reasoning?.kind === "decline" ? "The learner is told why it was not issued." : "A revoked certificate is marked as revoked wherever it is shown."}</DialogDescription>
          </DialogHeader>
          <Textarea value={reasoning?.reason ?? ""} onChange={e => reasoning && setReasoning({ ...reasoning, reason: e.target.value })} placeholder="Reason" data-testid="input-cert-reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasoning(null)}>Cancel</Button>
            <Button variant="destructive" disabled={decide.isPending || (reasoning?.reason.trim().length ?? 0) < 5} onClick={() => reasoning && decide.mutate({ id: reasoning.cert.id, kind: reasoning.kind, reason: reasoning.reason })} data-testid="button-confirm-cert-reason">{reasoning?.kind === "decline" ? "Decline" : "Revoke"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
