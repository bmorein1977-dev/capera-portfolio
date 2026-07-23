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
  AlertCircle,
  MessageSquare,
  Send
} from "lucide-react";
import { format } from "date-fns";

interface CompetenceCriteria {
  id: string;
  code: string;
  criteriaText: string;
  subcategoryId?: string;
  subcategoryName?: string;
  type: 'knowledge' | 'performance' | 'safety';
  required?: boolean;
}

interface CompetencyElement {
  id: string;
  name: string;
  code: string;
  description: string;
  knowledgeCriteria: CompetenceCriteria[];
  performanceCriteria: CompetenceCriteria[];
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
  planned_assessment_date: string | null;
  planned_assessment_location: string | null;
  planned_assessment_notes: string | null;
  candidate_ready_at: string | null;
  requirement_level: string;
  safety_critical: boolean;
  element: CompetencyElement;
}

const REQUIREMENT_LEVEL_LABELS: { [key: string]: string } = { M: 'Mandatory', R: 'Role Specific', D: 'Discretionary' };

function getRequirementSummary(assessment: Assessment): string {
  const safety = assessment.safety_critical ? 'Safety Critical' : 'Non-Safety Critical';
  const level = REQUIREMENT_LEVEL_LABELS[assessment.requirement_level] || assessment.requirement_level || 'Mandatory';
  return `${safety} - ${level}`;
}

interface EvidenceSubmission {
  assessmentId: string;
  evidenceType: string;
  evidenceTitle: string;
  description: string;
  files: FileList | null;
}

// Helper function to group criteria by subcategory
function groupCriteriaBySubcategory(criteria: CompetenceCriteria[]) {
  const grouped: { [key: string]: CompetenceCriteria[] } = {};
  
  criteria.forEach(criterion => {
    const key = criterion.subcategoryName || "Element Level";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(criterion);
  });
  
  return grouped;
}

export default function MyAssessments() {
  const { toast } = useToast();
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [evidenceForm, setEvidenceForm] = useState<EvidenceSubmission>({
    assessmentId: "",
    evidenceType: "Document",
    evidenceTitle: "",
    description: "",
    files: null
  });
  const [isDragging, setIsDragging] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");

  // Fetch candidate's assessments
  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ['/api/my-assessments'],
  });

  // Fetch feedback for selected assessment
  const { data: feedback = [] } = useQuery<any[]>({
    queryKey: [`/api/assessments/${selectedAssessment?.id}/feedback`],
    enabled: !!selectedAssessment?.id,
  });

  // Submit feedback mutation
  const submitFeedbackMutation = useMutation({
    mutationFn: async (comment: string) => {
      return await apiRequest('POST', `/api/assessments/${selectedAssessment?.id}/feedback`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assessments/${selectedAssessment?.id}/feedback`] });
      setFeedbackComment('');
      toast({
        title: "Feedback Submitted",
        description: "Your feedback has been sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback.",
        variant: "destructive",
      });
    },
  });

  // Candidate flags themselves ready for assessment - notifies the assessor, who then picks
  // the actual date.
  const markReadyMutation = useMutation({
    mutationFn: async (assessmentId: string) => {
      return await apiRequest('POST', `/api/assessments/${assessmentId}/mark-ready`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-assessments'] });
      toast({
        title: "Marked as Ready",
        description: "Your assessor has been notified and will schedule your assessment.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark assessment as ready.",
        variant: "destructive",
      });
    },
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


  const submitEvidenceMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/evidence', {
        method: 'POST',
        body: data,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Evidence Submitted",
        description: "Your evidence has been submitted successfully. Your assessor has been notified.",
      });
      // Reset evidence form after successful submission
      setEvidenceForm({
        assessmentId: selectedAssessment?.id || "",
        evidenceType: "Document",
        evidenceTitle: "",
        description: "",
        files: null
      });
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
    // Defensive guard: Ensure we have a valid assessment ID
    const assessmentId = evidenceForm.assessmentId || selectedAssessment?.id;
    if (!assessmentId) {
      toast({
        title: "Error",
        description: "Unable to identify the assessment. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!evidenceForm.evidenceTitle || !evidenceForm.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('assessmentId', assessmentId);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && selectedAssessment) {
      setEvidenceForm({
        ...evidenceForm,
        assessmentId: selectedAssessment.id,
        files: files
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setEvidenceForm({
        ...evidenceForm,
        files: e.target.files
      });
    }
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
                  onClick={() => {
                    setSelectedAssessment(assessment);
                    setEvidenceForm({
                      assessmentId: assessment.id,
                      evidenceType: "Document",
                      evidenceTitle: "",
                      description: "",
                      files: null
                    });
                  }}
                  data-testid={`assessment-card-${assessment.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{assessment.element?.code || 'N/A'}: {assessment.element?.name || 'Unknown Element'}</h3>
                        {getStatusBadge(assessment.outcome)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{assessment.element?.description || getRequirementSummary(assessment)}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {assessment.outcome === 'competent' && assessment.assessmentDate && (
                          <span>Assessed: {format(new Date(assessment.assessmentDate), 'PP')}</span>
                        )}
                        {assessment.expiryDate && (
                          <span>Expires: {format(new Date(assessment.expiryDate), 'PP')}</span>
                        )}
                        {assessment.outcome !== 'competent' && assessment.planned_assessment_date && (
                          <span>Scheduled: {format(new Date(assessment.planned_assessment_date), 'PP p')}{assessment.planned_assessment_location ? ` at ${assessment.planned_assessment_location}` : ''}</span>
                        )}
                        {assessment.outcome !== 'competent' && !assessment.planned_assessment_date && assessment.candidate_ready_at && (
                          <span>Assessor notified - awaiting a scheduled date</span>
                        )}
                      </div>
                      {assessment.outcome !== 'competent' && assessment.planned_assessment_date && assessment.planned_assessment_notes && (
                        <p className="text-xs text-muted-foreground italic mt-1">Assessor's notes: "{assessment.planned_assessment_notes}"</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAssessment(assessment);
                          setEvidenceForm({
                            assessmentId: assessment.id,
                            evidenceType: "Document",
                            evidenceTitle: "",
                            description: "",
                            files: null
                          });
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
                            setSelectedAssessment(assessment);
                            setEvidenceForm({
                              assessmentId: assessment.id,
                              evidenceType: "Document",
                              evidenceTitle: "",
                              description: "",
                              files: null
                            });
                          }}
                          data-testid={`button-submit-evidence-${assessment.id}`}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Submit Evidence
                        </Button>
                      )}
                      {assessment.outcome !== "competent" && !assessment.candidate_ready_at && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadyMutation.mutate(assessment.id);
                          }}
                          disabled={markReadyMutation.isPending}
                          data-testid={`button-mark-ready-${assessment.id}`}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          I'm Ready
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
      <Dialog 
        open={!!selectedAssessment} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAssessment(null);
            // Reset evidence form when closing
            setEvidenceForm({
              assessmentId: "",
              evidenceType: "Document",
              evidenceTitle: "",
              description: "",
              files: null
            });
            setIsDragging(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0">
          <DialogHeader>
            <DialogTitle>Assessment Details</DialogTitle>
            <DialogDescription>
              {selectedAssessment?.element?.code}: {selectedAssessment?.element?.name}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6 pb-4">
              {/* Status */}
              <div>
                <Label>Status</Label>
                <div className="mt-2">{selectedAssessment && getStatusBadge(selectedAssessment.outcome)}</div>
              </div>

              {/* Requirement */}
              <div>
                <Label>Requirement</Label>
                <div className="mt-2 flex items-center gap-2">
                  {selectedAssessment?.safety_critical && (
                    <Badge variant="destructive">Safety Critical</Badge>
                  )}
                  <Badge variant="outline">
                    {selectedAssessment && (REQUIREMENT_LEVEL_LABELS[selectedAssessment.requirement_level] || selectedAssessment.requirement_level)}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Knowledge Criteria */}
              <div>
                <h3 className="font-semibold mb-3">Knowledge Criteria</h3>
                {selectedAssessment?.element?.knowledgeCriteria && selectedAssessment.element.knowledgeCriteria.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(groupCriteriaBySubcategory(selectedAssessment.element.knowledgeCriteria)).map(([subcategoryName, criteria]) => (
                      <div key={subcategoryName} className="space-y-2">
                        {subcategoryName !== "Element Level" && (
                          <h4 className="text-sm font-semibold text-primary">{subcategoryName}</h4>
                        )}
                        <ul className="space-y-2">
                          {criteria.map((criterion) => (
                            <li key={criterion.id} className="flex gap-2 text-sm" data-testid={`knowledge-criterion-${criterion.id}`}>
                              <Badge variant="outline" className="font-mono text-xs shrink-0">{criterion.code}</Badge>
                              <span>{criterion.criteriaText}</span>
                              {criterion.required !== undefined && (
                                <Badge variant={criterion.required ? "default" : "outline"} className="text-xs ml-auto shrink-0">
                                  {criterion.required ? 'M' : 'O'}
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No knowledge criteria defined</p>
                )}
              </div>

              <Separator />

              {/* Performance Criteria */}
              <div>
                <h3 className="font-semibold mb-3">Performance Criteria</h3>
                {selectedAssessment?.element?.performanceCriteria && selectedAssessment.element.performanceCriteria.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(groupCriteriaBySubcategory(selectedAssessment.element.performanceCriteria)).map(([subcategoryName, criteria]) => (
                      <div key={subcategoryName} className="space-y-2">
                        {subcategoryName !== "Element Level" && (
                          <h4 className="text-sm font-semibold text-primary">{subcategoryName}</h4>
                        )}
                        <ul className="space-y-2">
                          {criteria.map((criterion) => (
                            <li key={criterion.id} className="flex gap-2 text-sm" data-testid={`performance-criterion-${criterion.id}`}>
                              <Badge variant="outline" className="font-mono text-xs shrink-0">{criterion.code}</Badge>
                              <span>{criterion.criteriaText}</span>
                              {criterion.required !== undefined && (
                                <Badge variant={criterion.required ? "default" : "outline"} className="text-xs ml-auto shrink-0">
                                  {criterion.required ? 'M' : 'O'}
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
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

              {/* Evidence Upload Section - Only for non-competent assessments */}
              {selectedAssessment && selectedAssessment.outcome !== "competent" && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Submit Evidence</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload evidence to demonstrate your competency for this element
                    </p>
                    
                    {/* Drag and Drop Area */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                      }`}
                      data-testid="evidence-drop-zone"
                    >
                      <Upload className={`h-10 w-10 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-sm font-medium mb-1">
                        {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        or click to browse
                      </p>
                      <Input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        id="evidence-file-input"
                        data-testid="input-evidence-files-inline"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('evidence-file-input')?.click()}
                        data-testid="button-browse-files"
                      >
                        Browse Files
                      </Button>
                    </div>

                    {/* Selected Files Display */}
                    {evidenceForm.files && evidenceForm.files.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <Label className="text-sm font-medium">Selected Files ({evidenceForm.files.length})</Label>
                        <div className="space-y-1">
                          {Array.from(evidenceForm.files).map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="flex-1 truncate">{file.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evidence Details Form */}
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="inline-evidence-type">Evidence Type</Label>
                        <Select 
                          value={evidenceForm.evidenceType} 
                          onValueChange={(value) => setEvidenceForm({...evidenceForm, evidenceType: value})}
                        >
                          <SelectTrigger id="inline-evidence-type" data-testid="select-evidence-type-inline">
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
                        <Label htmlFor="inline-evidence-title">Evidence Title *</Label>
                        <Input
                          id="inline-evidence-title"
                          placeholder="Brief title describing the evidence"
                          value={evidenceForm.evidenceTitle}
                          onChange={(e) => setEvidenceForm({...evidenceForm, evidenceTitle: e.target.value})}
                          data-testid="input-evidence-title-inline"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="inline-evidence-description">Description *</Label>
                        <Textarea
                          id="inline-evidence-description"
                          placeholder="Describe what this evidence demonstrates and how it relates to the competency"
                          value={evidenceForm.description}
                          onChange={(e) => setEvidenceForm({...evidenceForm, description: e.target.value})}
                          rows={3}
                          data-testid="textarea-evidence-description-inline"
                        />
                      </div>

                      <Button 
                        onClick={handleSubmitEvidence}
                        disabled={submitEvidenceMutation.isPending || !evidenceForm.evidenceTitle || !evidenceForm.description}
                        className="w-full"
                        data-testid="button-submit-evidence-inline"
                      >
                        {submitEvidenceMutation.isPending ? "Submitting..." : "Submit Evidence"}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Feedback Section */}
              <Separator />
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Feedback & Discussion
                </h3>
                
                {/* Feedback Thread */}
                <div className="space-y-3 mb-4">
                  {feedback.length > 0 ? (
                    feedback.map((item: any) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2" data-testid={`feedback-${item.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={item.authorRole === 'candidate' ? 'default' : 'secondary'}>
                              {item.authorRole === 'candidate' ? 'You' : 
                               item.authorRole === 'assessor' ? 'Assessor' : 'Verifier'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(item.createdAt), 'PPp')}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{item.comment}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No feedback yet. Start a conversation with your assessor.
                    </p>
                  )}
                </div>

                {/* Submit Feedback Form */}
                <div className="space-y-3">
                  <Label htmlFor="feedback-comment">Add Comment</Label>
                  <Textarea
                    id="feedback-comment"
                    placeholder="Ask questions or provide additional context..."
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    rows={3}
                    data-testid="textarea-feedback-comment"
                  />
                  <Button
                    onClick={() => submitFeedbackMutation.mutate(feedbackComment)}
                    disabled={submitFeedbackMutation.isPending || !feedbackComment.trim()}
                    className="w-full"
                    data-testid="button-submit-feedback"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {submitFeedbackMutation.isPending ? "Sending..." : "Send Feedback"}
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
