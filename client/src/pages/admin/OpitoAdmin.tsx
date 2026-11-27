import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { Upload, FileText, Download, Check, History, ShieldCheck } from "lucide-react";

type Heading = { key: string; section: string; title: string; core: boolean; builtIn: boolean; isActive: boolean };
type Doc = {
  id: string; categoryKey: string; title: string; description: string | null; fileName: string; version: number | null; seriesId: string | null;
  status: "awaiting_approval" | "current" | "superseded" | "withdrawn"; reviewDueOn: string | null; validUntil: string | null; visibleToAuditors: boolean | null;
  due: "in_date" | "due_soon" | "review_overdue" | "out_of_date"; uploadedByName: string | null; approvedByName: string | null; createdAt: string; approvedAt: string | null;
  withdrawnReason: string | null; withdrawnByName: string | null; mayApprove: boolean; fingerprinted: boolean;
};

const STATUS_LABEL: Record<Doc["status"], string> = { awaiting_approval: "Waiting for approval", current: "Current", superseded: "Replaced", withdrawn: "Withdrawn" };
const DUE_LABEL = { in_date: "", due_soon: "Due within 60 days", review_overdue: "Review overdue", out_of_date: "Out of date" } as const;
const when = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function OpitoAdmin() {
  const { toast } = useToast();
  const { user } = useAuth();
  const roles: string[] = (user as any)?.effectiveRoles ?? [((user as any)?.role ?? "")];
  const manager = roles.some((r) => ["admin", "super_admin", "developer"].includes(r));
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [onlyDue, setOnlyDue] = useState(false);
  const [upload, setUpload] = useState<{ heading: Heading; replaces?: Doc } | null>(null);
  const [form, setForm] = useState({ title: "", description: "", reviewDueOn: "", validUntil: "", visibleToAuditors: false });
  const [file, setFile] = useState<File | null>(null);
  const [withdrawing, setWithdrawing] = useState<Doc | null>(null);
  const [reason, setReason] = useState("");
  const [newHeading, setNewHeading] = useState<{ key: string; section: string; title: string } | null>(null);

  const headings = useQuery<Heading[]>({ queryKey: ["/api/opito/headings"], queryFn: () => api("GET", "/api/opito/headings") });
  const docs = useQuery<Doc[]>({ queryKey: ["/api/opito/documents", showHistory], queryFn: () => api("GET", `/api/opito/documents${showHistory ? "?history=1" : ""}`) });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["/api/opito/documents"] }); queryClient.invalidateQueries({ queryKey: ["/api/opito/headings"] }); };
  const fail = (e: Error) => toast({ title: "Not done", description: e.message, variant: "destructive" });

  const send = useMutation({
    mutationFn: () => {
      if (!upload || !file) throw new Error("Choose a file first");
      const data = new FormData();
      data.append("file", file);
      data.append("categoryKey", upload.heading.key);
      data.append("title", form.title.trim() || upload.replaces?.title || file.name);
      data.append("description", form.description);
      data.append("reviewDueOn", form.reviewDueOn);
      data.append("validUntil", form.validUntil);
      data.append("visibleToAuditors", String(form.visibleToAuditors));
      if (upload.replaces) data.append("replacesId", upload.replaces.id);
      return api("POST", "/api/opito/documents", data);
    },
    onSuccess: () => { toast({ title: "Uploaded", description: "It needs approval by someone else before it is current." }); setUpload(null); refresh(); },
    onError: fail,
  });
  const approve = useMutation({ mutationFn: (id: string) => api("POST", `/api/opito/documents/${id}/approve`), onSuccess: () => { toast({ title: "Approved" }); refresh(); }, onError: fail });
  const share = useMutation({ mutationFn: (d: Doc) => api("PATCH", `/api/opito/documents/${d.id}`, { visibleToAuditors: !d.visibleToAuditors }), onSuccess: refresh, onError: fail });
  const withdraw = useMutation({ mutationFn: () => api("POST", `/api/opito/documents/${withdrawing!.id}/withdraw`, { reason }), onSuccess: () => { toast({ title: "Withdrawn" }); setWithdrawing(null); setReason(""); refresh(); }, onError: fail });
  const saveHeading = useMutation({ mutationFn: () => api("PUT", `/api/opito/headings/${encodeURIComponent(newHeading!.key)}`, { section: newHeading!.section, title: newHeading!.title }), onSuccess: () => { setNewHeading(null); refresh(); }, onError: fail });

  const shown = useMemo(() => (docs.data ?? []).filter((d) => {
    if (onlyDue && d.due === "in_date") return false;
    return !search || `${d.title} ${d.description ?? ""} ${d.fileName} ${d.categoryKey}`.toLowerCase().includes(search.toLowerCase());
  }), [docs.data, search, onlyDue]);
  const byHeading = useMemo(() => { const m = new Map<string, Doc[]>(); for (const d of shown) m.set(d.categoryKey, [...(m.get(d.categoryKey) ?? []), d]); return m; }, [shown]);
  const active = (headings.data ?? []).filter((h) => h.isActive || byHeading.has(h.key));
  const visibleHeadings = active.filter((h) => (search || onlyDue || !manager ? byHeading.has(h.key) : true));
  const sections = Array.from(new Set(visibleHeadings.map((h) => h.section)));
  const waiting = (docs.data ?? []).filter((d) => d.status === "awaiting_approval").length;
  const due = (docs.data ?? []).filter((d) => d.status === "current" && d.due !== "in_date").length;

  const open = (heading: Heading, replaces?: Doc) => {
    setUpload({ heading, replaces }); setFile(null);
    setForm({ title: replaces?.title ?? "", description: replaces?.description ?? "", reviewDueOn: "", validUntil: "", visibleToAuditors: !!replaces?.visibleToAuditors });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="page-opito-admin">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title"><ShieldCheck className="h-7 w-7" />Audit Evidence Repository</h1>
        <p className="text-muted-foreground">{manager ? "Certification and audit evidence with version control, second-person approval, review dates and a record of who opened what." : "The current documents that have been shared with you. Each time you open one it is recorded."}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Search documents" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-repository-search" />
        {manager && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} data-testid="check-show-history" />Show replaced and withdrawn</label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} />Only those needing attention</label>
        {manager && waiting > 0 && <Badge>{waiting} waiting for approval</Badge>}
        {due > 0 && <Badge variant="destructive">{due} need review or renewal</Badge>}
        {manager && <Button variant="outline" size="sm" onClick={() => setNewHeading({ key: "", section: "", title: "" })} data-testid="button-add-heading">Add a heading</Button>}
      </div>

      {docs.isLoading || headings.isLoading ? <div className="py-8 text-center text-muted-foreground">Loading...</div> : docs.error ? <p className="text-destructive">{(docs.error as Error).message}</p> : !sections.length ? <p className="text-muted-foreground">No documents to show.</p> : sections.map((section) => (
        <div key={section} className="space-y-3">
          <h2 className="text-lg font-semibold">{section}</h2>
          {visibleHeadings.filter((h) => h.section === section).map((h) => {
            const list = byHeading.get(h.key) ?? [];
            return (
              <Card key={h.key} data-testid={`card-category-${h.key}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                  <div><CardTitle className="text-base">{h.key} {h.title} {h.core && <Badge variant="outline">Core</Badge>}</CardTitle><CardDescription>{list.length} document(s)</CardDescription></div>
                  {manager && h.isActive && <Button size="sm" variant="outline" onClick={() => open(h)} data-testid={`button-upload-${h.key}`}><Upload className="h-4 w-4 mr-2" />Upload</Button>}
                </CardHeader>
                {list.length > 0 && (
                  <CardContent className="space-y-2">
                    {list.map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2" data-testid={`row-document-${d.id}`}>
                        <div className="flex min-w-0 items-start gap-2">
                          <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="font-medium">{d.title} <span className="text-xs text-muted-foreground">version {d.version ?? 1}</span></div>
                            {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                            <div className="text-xs text-muted-foreground">
                              Uploaded {when(d.createdAt)}{d.uploadedByName ? ` by ${d.uploadedByName}` : ""}.
                              {d.approvedByName ? ` Approved ${when(d.approvedAt)} by ${d.approvedByName}.` : ""}
                              {d.reviewDueOn ? ` Review due ${when(d.reviewDueOn)}.` : ""}{d.validUntil ? ` Valid until ${when(d.validUntil)}.` : ""}
                              {d.status === "withdrawn" ? ` Withdrawn${d.withdrawnByName ? ` by ${d.withdrawnByName}` : ""}: ${d.withdrawnReason}` : ""}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge variant={d.status === "current" ? "default" : "outline"}>{STATUS_LABEL[d.status]}</Badge>
                              {DUE_LABEL[d.due] && d.status === "current" && <Badge variant="destructive">{DUE_LABEL[d.due]}</Badge>}
                              {manager && d.visibleToAuditors && <Badge variant="secondary">Shared with auditors</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          <Button variant="ghost" size="sm" asChild data-testid={`button-download-${d.id}`}><a href={`/api/opito/documents/${d.id}/download`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.title}`}><Download className="h-4 w-4" /></a></Button>
                          {manager && d.mayApprove && <Button size="sm" onClick={() => approve.mutate(d.id)} data-testid={`button-approve-${d.id}`}><Check className="h-4 w-4 mr-1" />Approve</Button>}
                          {manager && d.status === "current" && <Button variant="outline" size="sm" onClick={() => open(h, d)} data-testid={`button-new-version-${d.id}`}><History className="h-4 w-4 mr-1" />New version</Button>}
                          {manager && d.status === "current" && <Button variant="ghost" size="sm" onClick={() => share.mutate(d)}>{d.visibleToAuditors ? "Stop sharing" : "Share with auditors"}</Button>}
                          {manager && d.status !== "withdrawn" && <Button variant="ghost" size="sm" onClick={() => { setWithdrawing(d); setReason(""); }} data-testid={`button-delete-${d.id}`}>Withdraw</Button>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ))}

      <Dialog open={!!upload} onOpenChange={(o) => !o && setUpload(null)}>
        <DialogContent data-testid="dialog-upload-opito-document">
          <DialogHeader>
            <DialogTitle>{upload?.replaces ? `New version of ${upload.replaces.title}` : `Upload to ${upload?.heading.key} ${upload?.heading.title}`}</DialogTitle>
            <DialogDescription>It becomes current once someone else approves it. Up to 10 MB.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="opito-title">Title</Label><Input id="opito-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Defaults to the file name" data-testid="input-opito-title" /></div>
            <div><Label htmlFor="opito-description">Description</Label><Textarea id="opito-description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-opito-description" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="opito-review">Review due</Label><Input id="opito-review" type="date" value={form.reviewDueOn} onChange={(e) => setForm({ ...form, reviewDueOn: e.target.value })} /></div>
              <div><Label htmlFor="opito-valid">Valid until</Label><Input id="opito-valid" type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.visibleToAuditors} onChange={(e) => setForm({ ...form, visibleToAuditors: e.target.checked })} data-testid="check-share-auditors" />Share with external verifiers and auditors once approved</label>
            <div><Label htmlFor="opito-file">File *</Label><Input id="opito-file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="input-opito-file" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpload(null)}>Cancel</Button>
            <Button onClick={() => send.mutate()} disabled={!file || send.isPending} data-testid="button-submit-opito-upload">{send.isPending ? "Uploading..." : "Upload"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!withdrawing} onOpenChange={(o) => !o && setWithdrawing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Withdraw {withdrawing?.title}</DialogTitle><DialogDescription>The file and its history are kept. Say why it is being withdrawn.</DialogDescription></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-withdraw-reason" />
          <DialogFooter><Button variant="outline" onClick={() => setWithdrawing(null)}>Cancel</Button><Button onClick={() => withdraw.mutate()} disabled={reason.trim().length < 5 || withdraw.isPending} data-testid="button-confirm-withdraw">Withdraw</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newHeading} onOpenChange={(o) => !o && setNewHeading(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a heading</DialogTitle><DialogDescription>For evidence your organisation or another scheme asks for.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Short reference</Label><Input value={newHeading?.key ?? ""} onChange={(e) => setNewHeading((h) => h && { ...h, key: e.target.value.replace(/[^A-Za-z0-9._-]/g, "") })} placeholder="5.1" data-testid="input-heading-key" /></div>
            <div><Label>Section</Label><Input value={newHeading?.section ?? ""} onChange={(e) => setNewHeading((h) => h && { ...h, section: e.target.value })} placeholder="Section 5: Site requirements" /></div>
            <div><Label>Heading</Label><Input value={newHeading?.title ?? ""} onChange={(e) => setNewHeading((h) => h && { ...h, title: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setNewHeading(null)}>Cancel</Button><Button onClick={() => saveHeading.mutate()} disabled={!newHeading?.key || !newHeading?.section || !newHeading?.title} data-testid="button-save-heading">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
