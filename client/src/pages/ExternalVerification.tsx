import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Eye, Paperclip, ShieldCheck } from "lucide-react";

// Read-only review for an external verifier: the assessors an administrator has allocated, their completed assessments, what the assessor and the
// verifiers wrote, and the evidence. Nothing on this page changes anything.

interface AssessorRow { id: string; firstName: string | null; lastName: string | null; email: string | null; assessmentCount: number }
interface AssessmentRow {
  id: string; assessmentDate: string | null; outcome: string | null; verificationStatus: string | null; verificationCount: number;
  candidateFirstName: string | null; candidateLastName: string | null; assessorId: string; assessorFirstName: string | null; assessorLastName: string | null;
  elementCode: string | null; elementName: string | null;
}
interface Detail extends Omit<AssessmentRow, "assessorId" | "verificationCount"> {
  assessorComments: string | null; overallComment: string | null; knowledgeOutcomes: string | null; performanceOutcomes: string | null; assessmentMethods: string[] | string | null; signOffAt: string | null;
  verifications: Array<{ id: string; verificationDate: string | null; verificationType: string | null; outcome: string | null; verifierComments: string | null; acknowledgedAt: string | null; verifierFirstName: string | null; verifierLastName: string | null }>;
  feedback: Array<{ id: string; authorRole: string; comment: string; createdAt: string; firstName: string | null; lastName: string | null }>;
  evidence: Array<{ id: string; fileName: string; mimeType: string | null; fileSize: number | null; rejectedAt: string | null; createdAt: string }>;
}

const name = (f?: string | null, l?: string | null) => `${f ?? ""} ${l ?? ""}`.trim() || "Unnamed";
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No date");
const label = (s?: string | null) => (s ? s.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()) : "None");
const outcomeTone = (o?: string | null) => (o === "competent" ? "default" : o === "not_yet_competent" ? "destructive" : "secondary") as "default" | "destructive" | "secondary";

function AssessmentDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<Detail>({ queryKey: [`/api/external-verification/assessments/${id}`], enabled: !!id });
  return (
    <Dialog open={!!id} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl" data-testid="dialog-external-assessment">
        <DialogHeader>
          <DialogTitle>{data ? `${data.elementCode ?? ""} ${data.elementName ?? ""}`.trim() : "Assessment"}</DialogTitle>
          <DialogDescription>{data ? `${name(data.candidateFirstName, data.candidateLastName)}, assessed by ${name(data.assessorFirstName, data.assessorLastName)} on ${day(data.assessmentDate)}` : "Read only"}</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="py-6 text-center text-sm text-destructive">This assessment is not available to you.</p>}
        {data && (
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={outcomeTone(data.outcome)} data-testid="badge-outcome">{label(data.outcome)}</Badge>
                <Badge variant="outline">Verification: {label(data.verificationStatus)}</Badge>
                {data.signOffAt && <Badge variant="outline">Signed off {day(data.signOffAt)}</Badge>}
              </div>
              {[["Assessor comments", data.assessorComments], ["Overall comment", data.overallComment], ["Knowledge outcomes", data.knowledgeOutcomes], ["Performance outcomes", data.performanceOutcomes]].map(([t, v]) => v ? (
                <div key={t as string}><div className="mb-1 font-medium">{t}</div><p className="whitespace-pre-wrap text-muted-foreground">{v}</p></div>
              ) : null)}
              <Separator />
              <div>
                <div className="mb-2 font-medium">Verification records ({data.verifications.length})</div>
                {data.verifications.length === 0 && <p className="text-muted-foreground">Not verified yet.</p>}
                {data.verifications.map(v => (
                  <div key={v.id} className="mb-3 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{label(v.verificationType)}</Badge><Badge variant={outcomeTone(v.outcome)}>{label(v.outcome)}</Badge><span className="text-muted-foreground">{name(v.verifierFirstName, v.verifierLastName)}, {day(v.verificationDate)}</span></div>
                    {v.verifierComments && <p className="mt-2 whitespace-pre-wrap">{v.verifierComments}</p>}
                    {v.acknowledgedAt && <p className="mt-1 text-xs text-muted-foreground">Acknowledged by the assessor {day(v.acknowledgedAt)}</p>}
                  </div>
                ))}
              </div>
              <Separator />
              <div>
                <div className="mb-2 font-medium">Comments ({data.feedback.length})</div>
                {data.feedback.length === 0 && <p className="text-muted-foreground">No comments.</p>}
                {data.feedback.map(f => (
                  <div key={f.id} className="mb-2 rounded-md bg-muted/50 p-3">
                    <div className="mb-1 text-xs text-muted-foreground">{name(f.firstName, f.lastName)} ({label(f.authorRole)}), {day(f.createdAt)}</div>
                    <p className="whitespace-pre-wrap">{f.comment}</p>
                  </div>
                ))}
              </div>
              <Separator />
              <div>
                <div className="mb-2 font-medium">Evidence ({data.evidence.length})</div>
                {data.evidence.length === 0 && <p className="text-muted-foreground">No evidence attached.</p>}
                {data.evidence.map(e => (
                  <div key={e.id} className="mb-1 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <a className="text-primary underline" href={`/api/assessment-evidence/${e.id}/download`} target="_blank" rel="noopener noreferrer">{e.fileName}</a>
                    {e.rejectedAt && <Badge variant="destructive">Rejected</Badge>}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ExternalVerification() {
  const [assessorId, setAssessorId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const assessors = useQuery<AssessorRow[]>({ queryKey: ["/api/external-verification/assessors"] });
  const assessments = useQuery<AssessmentRow[]>({ queryKey: [assessorId ? `/api/external-verification/assessments?assessorId=${assessorId}` : "/api/external-verification/assessments"] });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8" data-testid="page-external-verification">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><ShieldCheck className="h-6 w-6" /> External verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">A read-only view of the assessors allocated to you: their completed assessments, what they and the internal verifiers wrote, and the evidence. You cannot change anything here.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your assessors</CardTitle><CardDescription>Choose one to narrow the list, or leave all selected.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {assessors.isLoading && <span className="text-sm text-muted-foreground">Loading...</span>}
          {assessors.data && assessors.data.length === 0 && <span className="text-sm text-muted-foreground">No assessors have been allocated to you yet. Ask the administrator.</span>}
          {assessors.data && assessors.data.length > 0 && <Button size="sm" variant={assessorId === null ? "default" : "outline"} onClick={() => setAssessorId(null)} data-testid="button-all-assessors">All</Button>}
          {assessors.data?.map(a => (
            <Button key={a.id} size="sm" variant={assessorId === a.id ? "default" : "outline"} onClick={() => setAssessorId(a.id)} data-testid={`button-assessor-${a.id}`}>
              {name(a.firstName, a.lastName)} <span className="ml-2 opacity-70">{a.assessmentCount}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Assessments</CardTitle><CardDescription>Newest first, up to 500.</CardDescription></CardHeader>
        <CardContent>
          {assessments.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>}
          {assessments.data && assessments.data.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No completed assessments to show.</p>}
          <div className="divide-y">
            {assessments.data?.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 py-3" data-testid={`row-assessment-${a.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{a.elementCode} {a.elementName}</div>
                  <div className="text-sm text-muted-foreground">{name(a.candidateFirstName, a.candidateLastName)}, assessed by {name(a.assessorFirstName, a.assessorLastName)}, {day(a.assessmentDate)}</div>
                </div>
                <Badge variant={outcomeTone(a.outcome)}>{label(a.outcome)}</Badge>
                <Badge variant="outline">{a.verificationCount} verification{a.verificationCount === 1 ? "" : "s"}</Badge>
                <Button size="sm" variant="outline" onClick={() => setOpenId(a.id)} data-testid={`button-open-${a.id}`}><Eye className="mr-1 h-4 w-4" /> Review</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <AssessmentDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
