import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Percent,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { INTERNAL_VERIFICATION_CHECKLIST, type Verification, type SamplingPlan } from "@shared/schema";

interface VerifierAssessorSummary {
  id: string;
  name: string;
  email: string;
  targetPercentage: number;
  totalAssessments: number;
  verifiedCount: number;
  verificationPercentage: number;
  recentActivityCount: number;
}

// The assessment shape needed to open the Internal Verification Record form.
interface PendingAssessment {
  id: string;
  candidateId: string;
  elementId: string;
  assessorId: string;
  outcome: string;
  assessmentDate: string;
  candidateName: string;
  elementName: string;
  assessorName: string;
}

interface QueueAssessment {
  id: string;
  elementId: string;
  elementName: string;
  assessmentDate: string;
  outcome: string;
}

interface QueueCandidate {
  candidateId: string;
  candidateName: string;
  priorVerificationCount: number;
  assessments: QueueAssessment[];
}

interface AssessorQueueEntry {
  assessorId: string;
  assessorName: string;
  assessorEmail: string;
  targetPercentage: number;
  quotaMet: boolean;
  remainingNeeded: number;
  verifiedThisQuarter: number;
  candidates: QueueCandidate[];
}

interface VerifierDashboardSummary {
  assessors: VerifierAssessorSummary[];
  assessorQueue: AssessorQueueEntry[];
  verifiedThisMonth: number;
}

type ChecklistAnswers = Record<string, 'yes' | 'no' | 'na'>;

function emptyChecklist(): ChecklistAnswers {
  return Object.fromEntries(INTERNAL_VERIFICATION_CHECKLIST.map(c => [String(c.item), 'na']));
}

export default function VerifierDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedAssessment, setSelectedAssessment] = useState<PendingAssessment | null>(null);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
  const [drillAssessorId, setDrillAssessorId] = useState<string | null>(null);
  const [drillCandidateId, setDrillCandidateId] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<VerifierDashboardSummary>({
    queryKey: [`/api/verifiers/${user?.id}/dashboard`],
    enabled: !!user?.id,
  });

  const { data: completedVerifications = [], isLoading: completedLoading } = useQuery<Verification[]>({
    queryKey: ['/api/verifications', { verifierId: user?.id }],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/verifications?verifierId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: samplingPlans = [] } = useQuery<SamplingPlan[]>({
    queryKey: ['/api/sampling-plans', { verifierId: user?.id }],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sampling-plans?verifierId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });
  const samplingPlanByAssessorId = new Map(samplingPlans.map(p => [p.assessorId, p]));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Internal Verification</h1>
          <p className="text-muted-foreground">Sample, verify and report on your allocated assessors' assessments</p>
        </div>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-10 w-10 text-primary" />
          <Button
            variant="outline"
            onClick={() => window.open(`/api/verifications/export?verifierId=${user?.id}`, '_blank')}
            data-testid="button-export-verifications"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {summaryError && (
        <div className="border border-destructive/50 bg-destructive/10 text-destructive rounded-lg p-4 text-sm" data-testid="error-dashboard-load">
          Couldn't load your verification dashboard: {(summaryError as any)?.message || 'unknown error'}. This is different from having no assessors allocated - please try refreshing, and contact an admin if it persists.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-count">
              {summary ? summary.assessorQueue.reduce((sum, a) => sum + a.remainingNeeded, 0) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Verified This Month</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-verified-this-month">{summary?.verifiedThisMonth ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Allocated Assessors</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-assessor-count">{summary?.assessors.length ?? '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="to-verify" className="space-y-4">
        <TabsList>
          <TabsTrigger value="to-verify" data-testid="tab-to-verify">To Verify</TabsTrigger>
          <TabsTrigger value="my-assessors" data-testid="tab-my-assessors">My Assessors</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="to-verify">
          {(() => {
            const queue = summary?.assessorQueue || [];
            const drillAssessor = drillAssessorId ? queue.find(a => a.assessorId === drillAssessorId) : undefined;
            const drillCandidate = drillAssessor && drillCandidateId ? drillAssessor.candidates.find(c => c.candidateId === drillCandidateId) : undefined;

            // Level 3: a candidate's own pending assessments for this assessor.
            if (drillAssessor && drillCandidate) {
              return (
                <Card>
                  <CardHeader>
                    <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-1" onClick={() => setDrillCandidateId(null)} data-testid="button-back-to-candidates">
                      <ChevronLeft className="h-4 w-4 mr-1" /> {drillAssessor.assessorName}'s candidates
                    </Button>
                    <CardTitle>{drillCandidate.candidateName}</CardTitle>
                    <CardDescription>
                      {drillCandidate.priorVerificationCount === 0 ? "You haven't verified this candidate before" : `Previously verified ${drillCandidate.priorVerificationCount} time${drillCandidate.priorVerificationCount === 1 ? '' : 's'}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {drillCandidate.assessments.map((a) => (
                      <div key={a.id} className="border rounded-lg p-4 hover-elevate" data-testid={`pending-${a.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <h3 className="font-semibold">{a.elementName}</h3>
                            <p className="text-xs text-muted-foreground">Assessed {format(new Date(a.assessmentDate), 'PPP')}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setSelectedAssessment({
                              id: a.id,
                              candidateId: drillCandidate.candidateId,
                              elementId: a.elementId,
                              assessorId: drillAssessor.assessorId,
                              outcome: a.outcome,
                              assessmentDate: a.assessmentDate,
                              candidateName: drillCandidate.candidateName,
                              elementName: a.elementName,
                              assessorName: drillAssessor.assessorName,
                            })}
                            data-testid={`button-verify-${a.id}`}
                          >
                            Verify
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            }

            // Level 2: an assessor's candidates who have pending work, least-reviewed first.
            if (drillAssessor) {
              return (
                <Card>
                  <CardHeader>
                    <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-1" onClick={() => setDrillAssessorId(null)} data-testid="button-back-to-assessors">
                      <ChevronLeft className="h-4 w-4 mr-1" /> All assessors
                    </Button>
                    <CardTitle>{drillAssessor.assessorName}</CardTitle>
                    <CardDescription>
                      {drillAssessor.candidates.length} candidate{drillAssessor.candidates.length === 1 ? '' : 's'} with assessments to sample this quarter
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {drillAssessor.candidates.map((c) => (
                      <div
                        key={c.candidateId}
                        className="border rounded-lg p-4 hover-elevate cursor-pointer"
                        onClick={() => setDrillCandidateId(c.candidateId)}
                        data-testid={`queue-candidate-${c.candidateId}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h3 className="font-semibold">{c.candidateName}</h3>
                            <p className="text-xs text-muted-foreground">
                              {c.assessments.length} assessment{c.assessments.length === 1 ? '' : 's'} pending
                              {c.priorVerificationCount === 0 && ' - never verified before'}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            }

            // Level 1: assessors, quota status against this quarter's sampling target.
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Assessors</CardTitle>
                  <CardDescription>Sample and verify assessments from your allocated assessors - prioritised toward candidates you haven't reviewed before</CardDescription>
                </CardHeader>
                <CardContent>
                  {summaryLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : queue.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No assessors allocated to you yet</p>
                      <p className="text-sm">An admin needs to allocate assessors to you before you can verify their work.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {queue.map((a) => (
                        <div
                          key={a.assessorId}
                          className={`border rounded-lg p-4 ${a.quotaMet ? '' : 'hover-elevate cursor-pointer'}`}
                          onClick={() => { if (!a.quotaMet) setDrillAssessorId(a.assessorId); }}
                          data-testid={`queue-assessor-${a.assessorId}`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <Users className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <h3 className="font-semibold">{a.assessorName}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {a.verifiedThisQuarter} verified this quarter - target {a.targetPercentage}%
                                </p>
                              </div>
                            </div>
                            {a.quotaMet ? (
                              <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                                <CheckCircle2 className="h-3 w-3" /> Quota met this quarter
                              </Badge>
                            ) : (
                              <Badge variant="secondary">{a.remainingNeeded} to sample</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        <TabsContent value="my-assessors">
          <Card>
            <CardHeader>
              <CardTitle>My Assessors</CardTitle>
              <CardDescription>Sampling rate progress against target, and recent assessment activity</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : !summary?.assessors.length ? (
                <div className="text-center py-8 text-muted-foreground">No assessors allocated to you yet</div>
              ) : (
                <div className="space-y-3">
                  {summary.assessors.map((a) => (
                    <div key={a.id} className="border rounded-lg p-4" data-testid={`assessor-summary-${a.id}`}>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <h3 className="font-semibold">{a.name}</h3>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Sampling: </span>
                            <span className={a.verificationPercentage < a.targetPercentage ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}>
                              {a.verificationPercentage}%
                            </span>
                          </div>
                          <SamplingRateControl
                            verifierId={user!.id}
                            assessorId={a.id}
                            currentPlan={samplingPlanByAssessorId.get(a.id)}
                            fallbackTarget={a.targetPercentage}
                          />
                          <Badge variant="outline">{a.verifiedCount} / {a.totalAssessments} verified</Badge>
                          {a.recentActivityCount > 0 && (
                            <Badge variant="secondary" className="gap-1" data-testid={`badge-recent-activity-${a.id}`}>
                              <AlertTriangle className="h-3 w-3" />
                              {a.recentActivityCount} new in last 14 days
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Completed Verifications</CardTitle>
              <CardDescription>Your verification history</CardDescription>
            </CardHeader>
            <CardContent>
              {completedLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : completedVerifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No verifications completed yet</div>
              ) : (
                <div className="space-y-3">
                  {completedVerifications.map((v) => (
                    <div
                      key={v.id}
                      className="border rounded-lg p-4 hover-elevate cursor-pointer"
                      onClick={() => setSelectedVerification(v)}
                      data-testid={`completed-${v.id}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={v.outcome === 'agreed' ? 'default' : v.outcome === 'disagreed' ? 'destructive' : 'secondary'}>
                              {v.outcome.replace(/_/g, ' ')}
                            </Badge>
                            {v.acknowledgedAt ? (
                              <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" />Acknowledged</Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Awaiting acknowledgement</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Verified {v.verificationDate ? format(new Date(v.verificationDate), 'PPP') : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedAssessment && (
        <VerificationRecordForm
          assessment={selectedAssessment}
          assessorTargetPercentage={summary?.assessors.find(a => a.id === selectedAssessment.assessorId)?.targetPercentage}
          onClose={() => {
            // Reset the drill-down back to the top level rather than leaving it pointed at a
            // candidate/assessor whose queue just changed underneath it (quota met, or that
            // specific assessment now gone) - the refreshed queue is the source of truth.
            setSelectedAssessment(null);
            setDrillCandidateId(null);
            setDrillAssessorId(null);
          }}
        />
      )}

      {selectedVerification && (
        <VerificationDetailDialog
          verification={selectedVerification}
          assessorName={undefined}
          onClose={() => setSelectedVerification(null)}
        />
      )}
    </div>
  );
}

// Lets the verifier set their own sampling rate per assessor, rather than needing an admin to do
// it for them - creates a sampling plan on first save, updates the existing one after that.
function SamplingRateControl({ verifierId, assessorId, currentPlan, fallbackTarget }: {
  verifierId: string;
  assessorId: string;
  currentPlan?: SamplingPlan;
  fallbackTarget: number;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(String(currentPlan?.targetPercentage ?? fallbackTarget));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const targetPercentage = parseInt(value, 10);
      return currentPlan
        ? apiRequest('PATCH', `/api/sampling-plans/${currentPlan.id}`, { targetPercentage })
        : apiRequest('POST', '/api/sampling-plans', { verifierId, assessorId, targetPercentage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sampling-plans'] });
      queryClient.invalidateQueries({ queryKey: [`/api/verifiers/${verifierId}/dashboard`] });
      toast({ title: "Sampling rate updated" });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update sampling rate", variant: "destructive" });
    },
  });

  if (!isEditing) {
    return (
      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
        onClick={() => { setValue(String(currentPlan?.targetPercentage ?? fallbackTarget)); setIsEditing(true); }}
        data-testid={`button-edit-sampling-rate-${assessorId}`}
      >
        of {currentPlan?.targetPercentage ?? fallbackTarget}% target
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 h-8"
        data-testid={`input-sampling-rate-${assessorId}`}
      />
      <span className="text-sm text-muted-foreground">%</span>
      <Button size="sm" variant="outline" className="h-8" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid={`button-save-sampling-rate-${assessorId}`}>
        Save
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={() => setIsEditing(false)}>Cancel</Button>
    </div>
  );
}

interface AssessmentReportDetail {
  outcome: string;
  assessmentMethods: string[] | null;
  knowledgeOutcomes: string | null;
  performanceOutcomes: string | null;
  overallComment: string | null;
  element: {
    knowledgeCriteria: Array<{ id: string; code: string; criteriaText: string }>;
    performanceCriteria: Array<{ id: string; code: string; criteriaText: string }>;
  };
}

interface EvidenceItem {
  id: string;
  fileName: string;
  mimeType: string | null;
  aiVerdict: string | null;
  aiConfidence: number | null;
  createdAt: string;
}

function VerificationRecordForm({ assessment, assessorTargetPercentage, onClose }: {
  assessment: PendingAssessment;
  assessorTargetPercentage?: number;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: report, isLoading: reportLoading } = useQuery<AssessmentReportDetail>({
    queryKey: ['/api/assessments', assessment.id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/assessments/${assessment.id}`);
      return res.json();
    },
  });

  const { data: evidence = [], isLoading: evidenceLoading } = useQuery<EvidenceItem[]>({
    queryKey: ['/api/assessment-evidence', { assessmentId: assessment.id }],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/assessment-evidence?assessmentId=${assessment.id}`);
      return res.json();
    },
  });

  const [verificationType, setVerificationType] = useState<'summative' | 'formative'>('summative');
  const [assessmentLocation, setAssessmentLocation] = useState('');
  const [technicalExpertName, setTechnicalExpertName] = useState('');
  const [checklist, setChecklist] = useState<ChecklistAnswers>(emptyChecklist());
  const [outcome, setOutcome] = useState<'agreed' | 'disagreed' | 'further_evidence_required'>('agreed');
  const [verifierComments, setVerifierComments] = useState('');
  const [developmentNeedsRequired, setDevelopmentNeedsRequired] = useState(false);
  const [developmentNeedsPlan, setDevelopmentNeedsPlan] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/verifications', {
      assessmentId: assessment.id,
      outcome,
      verifierComments: verifierComments || undefined,
      verificationType,
      assessmentLocation: assessmentLocation || undefined,
      samplingRateAtVerification: assessorTargetPercentage,
      technicalExpertName: technicalExpertName || undefined,
      checklistAnswers: checklist,
      developmentNeedsRequired,
      developmentNeedsPlan: developmentNeedsRequired ? (developmentNeedsPlan || undefined) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/verifiers/${user?.id}/dashboard`] });
      queryClient.invalidateQueries({ queryKey: ['/api/verifications'] });
      toast({ title: "Verification Filed", description: "The assessor has been notified." });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to file verification", variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0">
        <DialogHeader>
          <DialogTitle>Internal Verification Record</DialogTitle>
          <DialogDescription>{assessment.candidateName} — {assessment.elementName}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[calc(90vh-220px)] pr-4">
          <div className="space-y-6 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Assessor</Label>
                <p className="font-medium">{assessment.assessorName}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Assessment Date</Label>
                <p className="font-medium">{format(new Date(assessment.assessmentDate), 'PPP')}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold">Assessment Report</h3>
              {reportLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : !report ? (
                <p className="text-sm text-muted-foreground">Couldn't load the assessment report</p>
              ) : (
                <>
                  {report.assessmentMethods && report.assessmentMethods.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {report.assessmentMethods.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}
                    </div>
                  )}
                  {report.knowledgeOutcomes && (
                    <div><Label className="text-muted-foreground">Knowledge Outcomes</Label><p className="text-sm mt-1 whitespace-pre-wrap">{report.knowledgeOutcomes}</p></div>
                  )}
                  {report.performanceOutcomes && (
                    <div><Label className="text-muted-foreground">Performance Outcomes</Label><p className="text-sm mt-1 whitespace-pre-wrap">{report.performanceOutcomes}</p></div>
                  )}
                  {report.overallComment && (
                    <div><Label className="text-muted-foreground">Overall Comment</Label><p className="text-sm mt-1 whitespace-pre-wrap">{report.overallComment}</p></div>
                  )}
                  {report.element?.performanceCriteria?.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Performance Criteria Assessed</Label>
                      <ul className="text-sm mt-1 space-y-1">
                        {report.element.performanceCriteria.map((c) => (
                          <li key={c.id} className="flex gap-2"><Badge variant="outline" className="font-mono text-xs shrink-0">{c.code}</Badge><span>{c.criteriaText}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold">Evidence</h3>
              {evidenceLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">No evidence uploaded for this assessment</p>
              ) : (
                <div className="space-y-2">
                  {evidence.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 border rounded p-2 text-sm" data-testid={`evidence-${e.id}`}>
                      <span className="truncate">{e.fileName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {e.aiVerdict && (
                          <Badge variant={e.aiVerdict === 'valid' ? 'default' : e.aiVerdict === 'invalid' ? 'destructive' : 'secondary'} className="text-xs">
                            AI: {e.aiVerdict}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/assessment-evidence/${e.id}/download`, '_blank')}
                          data-testid={`button-view-evidence-${e.id}`}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Verification Type</Label>
                <RadioGroup value={verificationType} onValueChange={(v: any) => setVerificationType(v)} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="summative" id="vtype-summative" />
                    <Label htmlFor="vtype-summative" className="font-normal">Summative</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="formative" id="vtype-formative" />
                    <Label htmlFor="vtype-formative" className="font-normal">Formative</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assessment-location">Assessment Location</Label>
                <Input id="assessment-location" value={assessmentLocation} onChange={(e) => setAssessmentLocation(e.target.value)} data-testid="input-assessment-location" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="technical-expert">Technical Expert / SME (if required)</Label>
              <Input id="technical-expert" value={technicalExpertName} onChange={(e) => setTechnicalExpertName(e.target.value)} placeholder="Leave blank if not applicable" data-testid="input-technical-expert" />
            </div>

            {assessorTargetPercentage !== undefined && (
              <p className="text-sm text-muted-foreground">Current sampling rate target for this assessor: <strong>{assessorTargetPercentage}%</strong></p>
            )}

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold">Verification Outcomes / Evidence Requirements</h3>
              {INTERNAL_VERIFICATION_CHECKLIST.map((c) => (
                <div key={c.item} className="flex items-center justify-between gap-4 py-1" data-testid={`checklist-item-${c.item}`}>
                  <p className="text-sm flex-1"><span className="text-muted-foreground mr-1">{c.item}.</span>{c.question}</p>
                  <RadioGroup
                    value={checklist[String(c.item)]}
                    onValueChange={(v: any) => setChecklist(prev => ({ ...prev, [String(c.item)]: v }))}
                    className="flex gap-3 shrink-0"
                  >
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="yes" id={`c-${c.item}-yes`} data-testid={`radio-checklist-${c.item}-yes`} />
                      <Label htmlFor={`c-${c.item}-yes`} className="font-normal text-xs">Yes</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="no" id={`c-${c.item}-no`} data-testid={`radio-checklist-${c.item}-no`} />
                      <Label htmlFor={`c-${c.item}-no`} className="font-normal text-xs">No</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="na" id={`c-${c.item}-na`} data-testid={`radio-checklist-${c.item}-na`} />
                      <Label htmlFor={`c-${c.item}-na`} className="font-normal text-xs">N/A</Label>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Overall Outcome</Label>
              <Select value={outcome} onValueChange={(v: any) => setOutcome(v)}>
                <SelectTrigger data-testid="select-outcome"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agreed">Agreed</SelectItem>
                  <SelectItem value="disagreed">Disagreed</SelectItem>
                  <SelectItem value="further_evidence_required">Further Evidence Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verifier-comments">Internal Verifier Comments</Label>
              <Textarea id="verifier-comments" value={verifierComments} onChange={(e) => setVerifierComments(e.target.value)} rows={3} data-testid="textarea-verifier-comments" />
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold">Development Needs Analysis</h3>
              <p className="text-sm text-muted-foreground">Following your review, do you consider that any development needs are required for the assessor?</p>
              <RadioGroup value={developmentNeedsRequired ? 'yes' : 'no'} onValueChange={(v) => setDevelopmentNeedsRequired(v === 'yes')} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="dev-needs-yes" />
                  <Label htmlFor="dev-needs-yes" className="font-normal">Yes</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="dev-needs-no" />
                  <Label htmlFor="dev-needs-no" className="font-normal">No</Label>
                </div>
              </RadioGroup>
              {developmentNeedsRequired && (
                <div className="space-y-2">
                  <Label htmlFor="dev-needs-plan">What plan of action do you propose to develop the training needs of the assessor?</Label>
                  <Textarea id="dev-needs-plan" value={developmentNeedsPlan} onChange={(e) => setDevelopmentNeedsPlan(e.target.value)} rows={3} data-testid="textarea-development-needs-plan" />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} data-testid="button-submit-verification">
            {submitMutation.isPending ? 'Filing...' : 'File Verification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerificationDetailDialog({ verification, onClose }: { verification: Verification; assessorName?: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0">
        <DialogHeader>
          <DialogTitle>Verification Record</DialogTitle>
          <DialogDescription>
            Filed {verification.verificationDate ? format(new Date(verification.verificationDate), 'PPP') : ''}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[calc(85vh-160px)] pr-4">
          <div className="space-y-4 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={verification.outcome === 'agreed' ? 'default' : verification.outcome === 'disagreed' ? 'destructive' : 'secondary'}>
                {verification.outcome.replace(/_/g, ' ')}
              </Badge>
              {verification.verificationType && <Badge variant="outline">{verification.verificationType}</Badge>}
              {verification.acknowledgedAt ? (
                <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" />Acknowledged</Badge>
              ) : (
                <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Awaiting acknowledgement</Badge>
              )}
            </div>

            {verification.assessmentLocation && (
              <div><Label className="text-muted-foreground">Assessment Location</Label><p className="text-sm">{verification.assessmentLocation}</p></div>
            )}
            {verification.technicalExpertName && (
              <div><Label className="text-muted-foreground">Technical Expert / SME</Label><p className="text-sm">{verification.technicalExpertName}</p></div>
            )}
            {verification.samplingRateAtVerification !== null && verification.samplingRateAtVerification !== undefined && (
              <div><Label className="text-muted-foreground">Sampling Rate at Verification</Label><p className="text-sm">{verification.samplingRateAtVerification}%</p></div>
            )}

            {verification.checklistAnswers && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Verification Outcomes</Label>
                <div className="space-y-1">
                  {INTERNAL_VERIFICATION_CHECKLIST.map((c) => (
                    <div key={c.item} className="flex items-center justify-between text-sm gap-4">
                      <span className="flex-1">{c.item}. {c.question}</span>
                      <Badge variant="outline" className="uppercase shrink-0">{verification.checklistAnswers?.[String(c.item)] || 'na'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verification.verifierComments && (
              <div><Label className="text-muted-foreground">Internal Verifier Comments</Label><p className="text-sm whitespace-pre-wrap">{verification.verifierComments}</p></div>
            )}

            {verification.developmentNeedsRequired !== null && (
              <div>
                <Label className="text-muted-foreground">Development Needs Required</Label>
                <p className="text-sm">{verification.developmentNeedsRequired ? 'Yes' : 'No'}</p>
                {verification.developmentNeedsRequired && verification.developmentNeedsPlan && (
                  <p className="text-sm whitespace-pre-wrap mt-1">{verification.developmentNeedsPlan}</p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
