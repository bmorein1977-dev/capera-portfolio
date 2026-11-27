// Evidence Portal: add evidence to your own open assessments, and see everything that is on your record.
import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Download, Loader2, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { EvidenceDetails, type EvidenceLink } from "@/components/EvidenceDetails";
import { EVIDENCE_ACCEPT, EVIDENCE_DESCRIPTION_MAX, EVIDENCE_MAX_BYTES, EVIDENCE_TITLE_MAX, EVIDENCE_TYPES } from "@shared/evidence";

interface MyEvidence {
  openAssessments: Array<{ id: string; code: string | null; name: string; assessorName: string | null }>;
  evidence: Array<{
    id: string; title: string | null; evidenceType: string | null; description: string | null; fileName: string; fileSize: number | null; hasFile: boolean;
    createdAt: string; rejectedAt: string | null; rejectionReason: string | null; mine: boolean; uploadedByName: string | null; elementCode: string | null; elementName: string; signedOff: boolean; linked: EvidenceLink | null;
  }>;
}
const URL_MINE = "/api/my-evidence";
// stored times carry no zone and are UTC
const when = (v: string) => format(new Date(`${v.replace(" ", "T")}Z`), "PP");
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function reason(e: unknown): string {
  const raw = (e as Error)?.message ?? "";
  try { return JSON.parse(raw).error || raw; } catch { return raw || "Something went wrong"; }
}

function AddEvidence({ assessments }: { assessments: MyEvidence["openAssessments"] }) {
  const { toast } = useToast();
  const [assessmentId, setAssessmentId] = useState("");
  const [type, setType] = useState<string>(EVIDENCE_TYPES[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const chosen = assessmentId || (assessments.length === 1 ? assessments[0].id : "");

  const add = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const big = picked.filter(f => f.size > EVIDENCE_MAX_BYTES);
    if (big.length) toast({ title: "Too large", description: `${big.map(f => f.name).join(", ")}: each file can be up to ${size(EVIDENCE_MAX_BYTES)}.`, variant: "destructive" });
    setFiles(prev => [...prev, ...picked.filter(f => f.size <= EVIDENCE_MAX_BYTES)]);
  };

  const submit = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      body.append("assessmentId", chosen); body.append("evidenceType", type); body.append("evidenceTitle", title); body.append("description", description);
      files.forEach(f => body.append("files", f));
      const response = await fetch("/api/evidence", { method: "POST", body, credentials: "include" });
      if (!response.ok) throw new Error((await response.text()) || response.statusText);
    },
    onSuccess: () => {
      setTitle(""); setDescription(""); setFiles([]);
      queryClient.invalidateQueries({ queryKey: [URL_MINE] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-assessments"] });
      toast({ title: "Evidence saved", description: "It is on your record below, and your assessor can see it." });
    },
    // nothing is cleared, so what was typed is not lost
    onError: e => toast({ title: "Not saved", description: reason(e), variant: "destructive" }),
  });

  const ready = !!chosen && !!title.trim() && (files.length > 0 || !!description.trim());
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Add evidence</CardTitle><CardDescription>Attach files, describe what they show, or both.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ev-assessment">Which assessment is it for?</Label>
          <Select value={chosen} onValueChange={setAssessmentId}>
            <SelectTrigger id="ev-assessment" data-testid="select-assessment"><SelectValue placeholder="Choose an assessment" /></SelectTrigger>
            <SelectContent>{assessments.map(a => <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code}: ` : ""}{a.name}{a.assessorName ? ` (assessor ${a.assessorName})` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="ev-type">Kind of evidence</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="ev-type" data-testid="select-evidence-type"><SelectValue /></SelectTrigger>
              <SelectContent>{EVIDENCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ev-title">Title</Label><Input id="ev-title" value={title} maxLength={EVIDENCE_TITLE_MAX} onChange={e => setTitle(e.target.value)} data-testid="input-evidence-title" /></div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-description">What does it show?{files.length > 0 && <span className="font-normal text-muted-foreground"> (optional with a file)</span>}</Label>
          <Textarea id="ev-description" rows={4} value={description} maxLength={EVIDENCE_DESCRIPTION_MAX} onChange={e => setDescription(e.target.value)} data-testid="input-evidence-description" />
        </div>
        <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={e => { e.preventDefault(); setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
          className={`rounded-lg border-2 border-dashed p-6 text-center ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}>
          <p className="mb-2 text-sm text-muted-foreground">Drop files here, up to {size(EVIDENCE_MAX_BYTES)} each: documents, photos, video or audio.</p>
          <input ref={picker} type="file" multiple accept={EVIDENCE_ACCEPT} className="hidden" onChange={e => { add(e.target.files); e.target.value = ""; }} data-testid="input-evidence-files" />
          <Button type="button" variant="outline" size="sm" onClick={() => picker.current?.click()} data-testid="button-choose-files"><Upload className="mr-2 h-4 w-4" />Choose files</Button>
        </div>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded bg-muted p-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-muted-foreground">{size(f.size)}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!ready || submit.isPending} onClick={() => submit.mutate()} data-testid="button-submit-evidence">{submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submit.isPending ? "Saving..." : "Submit evidence"}</Button>
          <p className="text-xs text-muted-foreground">Evidence cannot be changed or removed here once submitted, so check it first.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EvidenceUpload() {
  const { data, isLoading, error } = useQuery<MyEvidence>({ queryKey: [URL_MINE], staleTime: 0 });
  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6" data-testid="page-evidence-portal">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Evidence Portal</h1>
        <p className="text-muted-foreground">Add evidence of your competence to your open assessments, and see what is on your record.</p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-destructive">Your evidence could not be loaded. Refresh the page to try again.</p>}
      {data && (data.openAssessments.length ? <AddEvidence assessments={data.openAssessments} /> : (
        <Card><CardContent className="py-6 text-sm text-muted-foreground" data-testid="text-no-open-assessment">You have no open assessment to add evidence to. Your assessor assigns assessments; see <Link href="/my-assessments" className="text-primary underline">My Assessments</Link>.</CardContent></Card>
      ))}
      {data && (
        <Card>
          <CardHeader><CardTitle className="text-base">Evidence on your record</CardTitle><CardDescription>{data.evidence.length} item{data.evidence.length === 1 ? "" : "s"}, added by you or your assessor.</CardDescription></CardHeader>
          <CardContent>
            {data.evidence.length === 0 && <p className="py-4 text-sm text-muted-foreground" data-testid="text-no-evidence">Nothing has been added yet.</p>}
            <div className="divide-y">
              {data.evidence.map(e => (
                <div key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-3" data-testid={`row-evidence-${e.id}`}>
                  <div className="min-w-0 space-y-1 sm:flex-1">
                    <EvidenceDetails item={e} struck={!!e.rejectedAt} />
                    <div className="text-xs text-muted-foreground">{e.elementCode ? `${e.elementCode}: ` : ""}{e.elementName} · added {when(e.createdAt)} by {e.mine ? "you" : e.uploadedByName ?? "someone else"}{e.hasFile && e.fileSize ? ` · ${size(e.fileSize)}` : ""}</div>
                    {e.rejectedAt && <p className="text-sm text-destructive">Not accepted{e.rejectionReason ? `: ${e.rejectionReason}` : ""}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={e.rejectedAt ? "destructive" : "secondary"}>{e.rejectedAt ? "Not accepted" : e.signedOff ? "On a signed-off assessment" : "Submitted"}</Badge>
                    {e.hasFile && <Button asChild variant="outline" size="sm"><a href={`/api/assessment-evidence/${e.id}/download`} target="_blank" rel="noopener noreferrer" data-testid={`link-download-${e.id}`}><Download className="mr-1 h-4 w-4" />Open</a></Button>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
