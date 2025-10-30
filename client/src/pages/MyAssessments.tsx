import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ClipboardCheck, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Calendar,
  Eye,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface CompetencyElement {
  id: string;
  name: string;
  code: string;
  description: string;
  knowledgeCriteria: string[];
  performanceCriteria: string[];
}

interface Assessment {
  id: string;
  candidateId: string;
  elementId: string;
  assessorId: string;
  assessmentDate: string;
  outcome: string;
  assessmentMethods: string[];
  assessorComments: string;
  expiryDate: string | null;
  verificationStatus: string;
  element: CompetencyElement;
}

interface EvidenceSubmission {
  assessmentId: string;
  evidenceType: string;
  evidenceTitle: string;
  description: string;
  files: FileList | null;
}

export default function MyAssessments() {
  const { toast } = useToast();
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState<EvidenceSubmission>({
    assessmentId: "",
    evidenceType: "Document",
    evidenceTitle: "",
    description: "",
    files: null
  });

  // Fetch candidate's assessments
  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ['/api/my-assessments'],
  });

  // Filter assessments by status
  const filteredAssessments = assessments.filter(assessment => {
    if (filterStatus === "all") return true;
    return assessment.outcome === filterStatus;
  });

  // Group assessments by outcome for summary
  const assessmentSummary = {
    competent: assessments.filter(a => a.outcome === "competent").length,
    in_progress: assessments.filter(a => a.outcome === "not_yet_competent").length,
    total: assessments.length
  };

  const getStatusBadge = (outcome: string) => {
    switch (outcome) {
      case "competent":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Competent</Badge>;
      case "not_yet_competent":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Not Yet Competent</Badge>;
      case "competent_with_minor_needs":
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Minor Needs</Badge>;
      default:
        return <Badge variant="outline">{outcome}</Badge>;
    }
  };

  const handleOpenEvidence = (assessment: Assessment) => {
    setEvidenceForm({
      assessmentId: assessment.id,
      evidenceType: "Document",
      evidenceTitle: "",
      description: "",
      files: null
    });
    setShowEvidenceDialog(true);
  };

  const submitEvidenceMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest('/api/evidence', {
        method: 'POST',
        body: data,
        headers: {} // Let browser set content-type for FormData
      });
    },
    onSuccess: () => {
      toast({
        title: "Evidence Submitted",
        description: "Your evidence has been submitted successfully. Your assessor has been notified.",
      });
      setShowEvidenceDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/my-assessments'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitEvidence = () => {
    if (!evidenceForm.evidenceTitle || !evidenceForm.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('assessmentId', evidenceForm.assessmentId);
    formData.append('evidenceType', evidenceForm.evidenceType);
    formData.append('evidenceTitle', evidenceForm.evidenceTitle);
    formData.append('description', evidenceForm.description);
    
    if (evidenceForm.files) {
      Array.from(evidenceForm.files).forEach(file => {
        formData.append('files', file);
      });
    }

    submitEvidenceMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Loading your assessments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8" />
            My Assessments
          </h2>
          <p className="text-muted-foreground">
            View your competency assessments, track progress, and submit evidence
          </p>
        </div>
        <Button variant="outline" data-testid="button-schedule-assessment">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Assessment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessmentSummary.total}</div>
            <p className="text-xs text-muted-foreground">Assigned competencies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Competent</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{assessmentSummary.competent}</div>
            <p className="text-xs text-muted-foreground">Completed successfully</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{assessmentSummary.in_progress}</div>
            <p className="text-xs text-muted-foreground">Awaiting evidence or review</p>
          </CardContent>
        </Card>
      </div>

      {/* Assessments List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Assessment List</CardTitle>
              <CardDescription>Your competency assessment records</CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40" data-testid="select-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="competent">Competent</SelectItem>
                <SelectItem value="not_yet_competent">In Progress</SelectItem>
                <SelectItem value="competent_with_minor_needs">Minor Needs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAssessments.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No assessments found</p>
              <p className="text-sm text-muted-foreground">Contact your assessor to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAssessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="p-4 border rounded-lg hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => setSelectedAssessment(assessment)}
                  data-testid={`assessment-card-${assessment.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{assessment.element?.code || 'N/A'}: {assessment.element?.name || 'Unknown Element'}</h3>
                        {getStatusBadge(assessment.outcome)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{assessment.element?.description || 'No description available'}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {assessment.outcome === 'competent' && assessment.assessmentDate && (
                          <span>Assessed: {format(new Date(assessment.assessmentDate), 'PP')}</span>
                        )}
                        {assessment.expiryDate && (
                          <span>Expires: {format(new Date(assessment.expiryDate), 'PP')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAssessment(assessment);
                        }}
                        data-testid={`button-view-${assessment.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {assessment.outcome !== "competent" && (
                        <Button 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEvidence(assessment);
                          }}
                          data-testid={`button-submit-evidence-${assessment.id}`}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Submit Evidence
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessment Details Dialog */}
      <Dialog open={!!selectedAssessment} onOpenChange={() => setSelectedAssessment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Assessment Details</DialogTitle>
            <DialogDescription>
              {selectedAssessment?.element?.code}: {selectedAssessment?.element?.name}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Status */}
              <div>
                <Label>Status</Label>
                <div className="mt-2">{selectedAssessment && getStatusBadge(selectedAssessment.outcome)}</div>
              </div>

              <Separator />

              {/* Knowledge Criteria */}
              <div>
                <h3 className="font-semibold mb-3">Knowledge Criteria</h3>
                {selectedAssessment?.element?.knowledgeCriteria && selectedAssessment.element.knowledgeCriteria.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedAssessment.element.knowledgeCriteria.map((criteria, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <span className="font-medium text-muted-foreground">{idx + 1}.</span>
                        <span>{criteria}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No knowledge criteria defined</p>
                )}
              </div>

              <Separator />

              {/* Performance Criteria */}
              <div>
                <h3 className="font-semibold mb-3">Performance Criteria</h3>
                {selectedAssessment?.element?.performanceCriteria && selectedAssessment.element.performanceCriteria.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedAssessment.element.performanceCriteria.map((criteria, idx) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <span className="font-medium text-muted-foreground">{idx + 1}.</span>
                        <span>{criteria}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No performance criteria defined</p>
                )}
              </div>

              {selectedAssessment?.assessorComments && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Assessor Feedback</h3>
                    <p className="text-sm">{selectedAssessment.assessorComments}</p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Evidence Submission Dialog */}
      <Dialog open={showEvidenceDialog} onOpenChange={setShowEvidenceDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Evidence</DialogTitle>
            <DialogDescription>
              Upload evidence to support your competency assessment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="evidence-type">Evidence Type</Label>
              <Select 
                value={evidenceForm.evidenceType} 
                onValueChange={(value) => setEvidenceForm({...evidenceForm, evidenceType: value})}
              >
                <SelectTrigger id="evidence-type" data-testid="select-evidence-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Document">Document</SelectItem>
                  <SelectItem value="Photo">Photo</SelectItem>
                  <SelectItem value="Video">Video</SelectItem>
                  <SelectItem value="Certificate">Certificate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidence-title">Evidence Title *</Label>
              <Input
                id="evidence-title"
                placeholder="Brief title describing the evidence"
                value={evidenceForm.evidenceTitle}
                onChange={(e) => setEvidenceForm({...evidenceForm, evidenceTitle: e.target.value})}
                data-testid="input-evidence-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidence-description">Description *</Label>
              <Textarea
                id="evidence-description"
                placeholder="Describe what this evidence demonstrates and how it relates to the competency"
                value={evidenceForm.description}
                onChange={(e) => setEvidenceForm({...evidenceForm, description: e.target.value})}
                rows={4}
                data-testid="textarea-evidence-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidence-files">Files</Label>
              <Input
                id="evidence-files"
                type="file"
                multiple
                onChange={(e) => setEvidenceForm({...evidenceForm, files: e.target.files})}
                data-testid="input-evidence-files"
              />
              <p className="text-xs text-muted-foreground">
                Supports PDF, Word, Excel, Images, Videos (Max 50MB each)
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSubmitEvidence}
                disabled={submitEvidenceMutation.isPending}
                data-testid="button-submit-evidence"
              >
                {submitEvidenceMutation.isPending ? "Submitting..." : "Submit Evidence"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowEvidenceDialog(false)}
                data-testid="button-cancel-evidence"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
