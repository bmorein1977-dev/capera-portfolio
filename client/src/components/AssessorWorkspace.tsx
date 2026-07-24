import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  ClipboardCheck, 
  User, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileText,
  Calendar,
  Filter,
  Search,
  Download,
  Plus,
  RefreshCw,
  Upload,
  X,
  MapPin,
  Sparkles
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Helper function to group criteria by subcategory
function groupCriteriaBySubcategory(criteria: any[]) {
  const grouped: { [key: string]: any[] } = {};
  
  criteria.forEach(criterion => {
    const key = criterion.subcategoryName || "Element Level";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(criterion);
  });
  
  return grouped;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  department: string;
  assessments: Assessment[];
  overallProgress: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
}

interface Assessment {
  id: string;
  standardName: string;
  type: 'practical' | 'written' | 'observation' | 'portfolio';
  status: 'scheduled' | 'in_progress' | 'awaiting_review' | 'completed';
  scheduledDate?: string;
  scheduledLocation?: string;
  scheduledNotes?: string;
  candidateReadyAt?: string;
  completedDate?: string;
  dueDate: string;
  progress: number;
  result?: 'competent' | 'not_yet_competent' | 'training_needs';
  evidence?: Evidence[];
  observations?: Observation[];
  feedback?: string;
  nextReviewDate?: string;
}

interface Evidence {
  id: string;
  type: 'document' | 'image' | 'video' | 'audio';
  name: string;
  url: string;
  uploadedDate: string;
  verified: boolean;
  comments?: string;
}

interface Observation {
  id: string;
  date: string;
  criteria: string;
  outcome: 'satisfactory' | 'needs_improvement' | 'not_observed';
  notes: string;
  assessor: string;
}

export default function AssessorWorkspace() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Fetch real candidates from API
  const { data: candidatesData, isLoading } = useQuery<any[]>({
    queryKey: [`/api/assessors/${user?.id}/candidates`],
    enabled: !!user?.id,
  });
  
  const candidates = candidatesData ?? [];

  // Locations for the Schedule Assessment dialog - same list used by Team Compliance Matrix
  const { data: locationsData } = useQuery<string[]>({
    queryKey: ['/api/locations'],
  });
  const locations = locationsData ?? [];

  // Support deep-linking here from the Assessor Dashboard - e.g. clicking a specific
  // assessment or planned assessment there should land right on it, not just the workspace root.
  const deepLinkParams = new URLSearchParams(window.location.search);
  const [selectedCandidate, setSelectedCandidate] = useState<string>(() => deepLinkParams.get('candidateId') || '');
  const [selectedAssessment, setSelectedAssessment] = useState<string>(() => deepLinkParams.get('assessmentId') || '');
  const deepLinkAction = useRef(deepLinkParams.get('action'));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSignOffDialog, setShowSignOffDialog] = useState(false);
  const [signOffResult, setSignOffResult] = useState<'competent' | 'not_yet_competent' | 'competent_with_minor_needs'>('competent');
  const [signOffFeedback, setSignOffFeedback] = useState('');
  const [knowledgeOutcomes, setKnowledgeOutcomes] = useState('');
  const [performanceOutcomes, setPerformanceOutcomes] = useState('');
  const [overallComment, setOverallComment] = useState('');
  const [assessmentMethods, setAssessmentMethods] = useState<string[]>([]);
  const [minorNeedsComment, setMinorNeedsComment] = useState('');
  const [minorNeedsDueDate, setMinorNeedsDueDate] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');

  // Reset selected assessment when selected candidate changes - but not on the very first
  // render, otherwise a deep-linked ?candidateId=&assessmentId= pair would immediately clear
  // the assessment selection it just set.
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setSelectedAssessment('');
  }, [selectedCandidate]);

  // Upload evidence files when they're added
  const uploadEvidenceFiles = async (files: File[]) => {
    if (!selectedAssessment || files.length === 0) return;

    setUploadingEvidence(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('assessmentId', selectedAssessment);
      formData.append('evidenceType', 'assessor_upload');
      formData.append('evidenceTitle', 'Assessment Evidence');
      formData.append('description', 'Evidence uploaded by assessor during sign-off');

      const response = await fetch('/api/evidence', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload evidence');
      }

      toast({
        title: "Evidence Uploaded",
        description: `Successfully uploaded ${files.length} file(s)`,
      });

      // Invalidate queries to refresh evidence display
      queryClient.invalidateQueries({ queryKey: [`/api/assessors/${user?.id}/candidates`] });
      queryClient.invalidateQueries({ queryKey: [`/api/assessments/${selectedAssessment}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/assessment-evidence', { assessmentId: selectedAssessment }] });

      // Clear the files after successful upload
      setEvidenceFiles([]);
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload evidence files",
        variant: "destructive",
      });
    } finally {
      setUploadingEvidence(false);
    }
  };

  // Sign-off mutation
  const signOffMutation = useMutation({
    mutationFn: async (data: {
      outcome: string;
      knowledgeOutcomes: string;
      performanceOutcomes: string;
      overallComment: string;
      assessmentMethods: string[];
      minorNeedsComment?: string;
      minorNeedsDueDate?: string;
    }) => {
      return await apiRequest('POST', `/api/assessments/${selectedAssessment}/result`, data);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/assessors/${user?.id}/candidates`] });
      queryClient.invalidateQueries({ queryKey: [`/api/assessments/${selectedAssessment}`] });
      
      // Show success message
      toast({
        title: "Assessment Completed",
        description: "The assessment has been successfully completed. The candidate has been notified by email.",
      });
      
      // Close dialog and reset form
      setShowSignOffDialog(false);
      setSignOffFeedback('');
      setKnowledgeOutcomes('');
      setPerformanceOutcomes('');
      setOverallComment('');
      setAssessmentMethods([]);
      setMinorNeedsComment('');
      setMinorNeedsDueDate('');
      setSignOffResult('competent');
      setEvidenceFiles([]);
    },
    onError: (error: any) => {
      toast({
        title: "Sign-off Failed",
        description: error.message || "Failed to sign off assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Schedule (or reschedule) the actual date/time, location and instructions for the selected assessment
  const scheduleAssessmentMutation = useMutation({
    mutationFn: async (data: { plannedAssessmentDate: string; plannedAssessmentLocation: string; plannedAssessmentNotes: string }) => {
      return await apiRequest('PATCH', `/api/assessments/${selectedAssessment}/schedule`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assessors/${user?.id}/candidates`] });
      toast({
        title: "Assessment Scheduled",
        description: "The candidate has been notified by email.",
      });
      setShowScheduleDialog(false);
      setScheduleDateTime('');
      setScheduleLocation('');
      setScheduleNotes('');
    },
    onError: (error: any) => {
      toast({
        title: "Scheduling Failed",
        description: error.message || "Failed to schedule assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedCandidateData = candidates.find(c => c.id === selectedCandidate);
  const selectedAssessmentData = selectedCandidateData?.assessments.find(a => a.id === selectedAssessment);

  // Deep-linked from the Assessor Dashboard's "Assessments Planned" list (?action=schedule) -
  // once the assessment data has actually loaded, open the same schedule dialog the "Schedule
  // Assessment" button does, pre-filled with whatever's already set. One-shot via the ref.
  useEffect(() => {
    if (deepLinkAction.current === 'schedule' && selectedAssessmentData) {
      setScheduleDateTime(selectedAssessmentData.scheduledDate ? selectedAssessmentData.scheduledDate.slice(0, 16) : '');
      setScheduleLocation(selectedAssessmentData.scheduledLocation || '');
      setScheduleNotes(selectedAssessmentData.scheduledNotes || '');
      setShowScheduleDialog(true);
      deepLinkAction.current = null;
    }
  }, [selectedAssessmentData]);

  // Fetch detailed assessment data with K&P criteria when assessment is selected
  const { data: assessmentDetail } = useQuery<any>({
    queryKey: [`/api/assessments/${selectedAssessment}`],
    enabled: !!selectedAssessment,
  });

  // If this assessment was already signed off, pre-fill the Mark Assessment form with what was
  // actually recorded instead of leaving it blank - otherwise opening it to review a completed
  // assessment looks (and behaves) like starting a fresh, unmarked one.
  useEffect(() => {
    if (assessmentDetail?.outcome) {
      setSignOffResult(assessmentDetail.outcome);
      setKnowledgeOutcomes(assessmentDetail.knowledgeOutcomes || '');
      setPerformanceOutcomes(assessmentDetail.performanceOutcomes || '');
      setOverallComment(assessmentDetail.overallComment || '');
      setAssessmentMethods(assessmentDetail.assessmentMethods || []);
      setMinorNeedsComment(assessmentDetail.minorNeedsComment || '');
      setMinorNeedsDueDate(assessmentDetail.minorNeedsDueDate ? assessmentDetail.minorNeedsDueDate.slice(0, 10) : '');
    } else {
      setSignOffResult('competent');
      setKnowledgeOutcomes('');
      setPerformanceOutcomes('');
      setOverallComment('');
      setAssessmentMethods([]);
      setMinorNeedsComment('');
      setMinorNeedsDueDate('');
    }
  }, [assessmentDetail?.id, assessmentDetail?.outcome]);

  // Previously uploaded evidence for the assessment being reviewed, so the assessor/verifier can
  // actually see what the candidate submitted, not just upload more.
  const { data: existingEvidence = [] } = useQuery<Array<{
    id: string;
    fileName: string;
    mimeType: string | null;
    fileSize: number | null;
    createdAt: string;
    aiVerdict: 'valid' | 'inconclusive' | 'invalid' | null;
    aiConfidence: number | null;
    aiReasoning: string | null;
    aiReviewedAt: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
  }>>({
    queryKey: ['/api/assessment-evidence', { assessmentId: selectedAssessment }],
    enabled: !!selectedAssessment,
  });

  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [rejectingEvidenceId, setRejectingEvidenceId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  const rejectEvidenceMutation = useMutation({
    mutationFn: async ({ evidenceId, reason }: { evidenceId: string; reason: string }) => {
      const res = await apiRequest('POST', `/api/assessment-evidence/${evidenceId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assessment-evidence', { assessmentId: selectedAssessment }] });
      toast({ title: 'Evidence Rejected', description: 'The candidate has been emailed the reason.' });
      setRejectingEvidenceId(null);
      setRejectionReasonInput('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to reject evidence', variant: 'destructive' });
    },
  });

  const aiReviewMutation = useMutation({
    mutationFn: async (evidenceId: string) => {
      const res = await apiRequest('POST', `/api/assessment-evidence/${evidenceId}/ai-review`);
      return res.json();
    },
    onSuccess: (_data, evidenceId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/assessment-evidence', { assessmentId: selectedAssessment }] });
      setExpandedReviewId(evidenceId);
    },
    onError: (error: any) => {
      toast({
        title: "AI Review Failed",
        description: error.message || "Failed to run AI evidence review",
        variant: "destructive",
      });
    },
  });

  const verdictBadgeVariant = (verdict: string | null): 'default' | 'secondary' | 'destructive' => {
    if (verdict === 'valid') return 'default';
    if (verdict === 'invalid') return 'destructive';
    return 'secondary';
  };

  const toggleAssessmentMethod = (method: string) => {
    setAssessmentMethods(prev => 
      prev.includes(method) 
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
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
    const files = Array.from(e.dataTransfer.files);
    setEvidenceFiles(prev => [...prev, ...files]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setEvidenceFiles(prev => [...prev, ...files]);
    }
  };

  const handleUploadClick = () => {
    if (evidenceFiles.length > 0) {
      uploadEvidenceFiles(evidenceFiles);
    }
  };

  const removeFile = (index: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSignOff = () => {
    if (selectedCandidateData && selectedAssessmentData) {
      // Validate required fields
      if (!knowledgeOutcomes.trim()) {
        toast({
          title: "Validation Error",
          description: "Knowledge Outcomes is required.",
          variant: "destructive",
        });
        return;
      }
      
      if (!performanceOutcomes.trim()) {
        toast({
          title: "Validation Error",
          description: "Performance Outcomes is required.",
          variant: "destructive",
        });
        return;
      }
      
      if (!overallComment.trim()) {
        toast({
          title: "Validation Error",
          description: "Overall Comment is required.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate assessment methods
      if (assessmentMethods.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please select at least one assessment method.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate minor needs fields if outcome is competent_with_minor_needs
      if (signOffResult === 'competent_with_minor_needs') {
        if (!minorNeedsComment.trim()) {
          toast({
            title: "Validation Error",
            description: "Minor Needs Comment is required for this outcome.",
            variant: "destructive",
          });
          return;
        }
        
        if (!minorNeedsDueDate) {
          toast({
            title: "Validation Error",
            description: "Minor Needs Due Date is required for this outcome.",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Prepare data
      const data: any = {
        outcome: signOffResult,
        knowledgeOutcomes,
        performanceOutcomes,
        overallComment,
        assessmentMethods,
      };
      
      // Include minor needs fields only if outcome is competent_with_minor_needs
      if (signOffResult === 'competent_with_minor_needs') {
        data.minorNeedsComment = minorNeedsComment;
        data.minorNeedsDueDate = new Date(minorNeedsDueDate).toISOString();
      }
      
      // Call the sign-off mutation
      signOffMutation.mutate(data);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'awaiting_review': return 'destructive';
      case 'scheduled': return 'outline';
      case 'not_started': return 'outline';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'competent': return 'default';
      case 'not_yet_competent': return 'secondary';
      case 'training_needs': return 'destructive';
      default: return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Red by default; escalates to orange once the due date is within 90 days, matching the
  // red/orange/green convention used for training compliance status elsewhere in the app.
  const getResultClassName = (result: string, dueDate: string) => {
    if (result === 'competent') {
      return 'bg-green-600 text-white hover:bg-green-600 dark:bg-green-600';
    }
    if (result === 'not_yet_competent') {
      const daysUntilDue = Math.floor((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilDue >= 0 && daysUntilDue <= 90
        ? 'bg-orange-500 text-white hover:bg-orange-500 dark:bg-orange-500'
        : 'bg-red-600 text-white hover:bg-red-600 dark:bg-red-600';
    }
    return undefined;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8" />
            Assessor Workspace
          </h2>
          <p className="text-muted-foreground">
            Manage candidate assessments, track progress, and provide competency sign-offs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export-assessments">
            <Download className="h-4 w-4 mr-2" />
            Export Reports
          </Button>
          <Button
            data-testid="button-schedule-assessment"
            disabled={!selectedAssessment}
            onClick={() => {
              if (!selectedAssessment) {
                toast({
                  title: "Select an Assessment",
                  description: "Choose a candidate and assessment from the list first.",
                  variant: "destructive",
                });
                return;
              }
              setScheduleDateTime(selectedAssessmentData?.scheduledDate ? selectedAssessmentData.scheduledDate.slice(0, 16) : '');
              setScheduleLocation(selectedAssessmentData?.scheduledLocation || '');
              setScheduleNotes(selectedAssessmentData?.scheduledNotes || '');
              setShowScheduleDialog(true);
            }}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Assessment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidates List */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Candidates</CardTitle>
            <CardDescription>Your assessment workload</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search candidates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-candidates"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="select-status-filter">
                  <Filter className="h-4 w-4" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {filteredCandidates.map(candidate => (
                <div 
                  key={candidate.id}
                  className={`p-3 border rounded-lg cursor-pointer hover-elevate transition-colors ${
                    selectedCandidate === candidate.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedCandidate(candidate.id)}
                  data-testid={`candidate-${candidate.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={candidate.avatar} />
                      <AvatarFallback>
                        {candidate.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{candidate.name}</h4>
                        <Badge variant={getStatusColor(candidate.status)} className="text-xs">
                          {candidate.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{candidate.role}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={candidate.overallProgress} className="flex-1 h-2" />
                        <span className="text-xs text-muted-foreground">
                          {candidate.overallProgress}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Assessment Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Assessment Management</CardTitle>
            <CardDescription>
              {selectedCandidateData 
                ? `Managing assessments for ${selectedCandidateData.name}`
                : 'Select a candidate to view their assessments'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedCandidateData ? (
              <div className="space-y-4">
                  {!selectedAssessment || !assessmentDetail ? (
                    <div className="space-y-3">
                      {selectedCandidateData.assessments.map(assessment => (
                        <div 
                          key={assessment.id}
                          className={`p-4 border rounded-lg cursor-pointer hover-elevate ${
                            selectedAssessment === assessment.id ? 'border-primary bg-primary/5' : ''
                          }`}
                          onClick={() => setSelectedAssessment(assessment.id)}
                          data-testid={`assessment-${assessment.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-medium">{assessment.standardName}</h4>
                              <p className="text-sm text-muted-foreground">
                                {assessment.type} assessment
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={getStatusColor(assessment.status)}>
                                {assessment.status.replace('_', ' ')}
                              </Badge>
                              {assessment.result && (
                                <Badge
                                  variant={getResultColor(assessment.result)}
                                  className={getResultClassName(assessment.result, assessment.dueDate)}
                                >
                                  {assessment.result.replace('_', ' ')}
                                </Badge>
                              )}
                              {assessment.candidateReadyAt && !assessment.scheduledDate && (
                                <Badge
                                  className="bg-blue-600 text-white hover:bg-blue-600 dark:bg-blue-600"
                                  data-testid={`badge-ready-${assessment.id}`}
                                >
                                  Ready for Assessment
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progress</span>
                              <span>{assessment.progress}%</span>
                            </div>
                            <Progress value={assessment.progress} className="h-2" />
                          </div>

                          <div className="mt-3 text-sm text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                {assessment.scheduledDate ? (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>Scheduled: {formatDate(assessment.scheduledDate)}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>Not yet scheduled</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>Due: {formatDate(assessment.dueDate)}</span>
                                </div>
                              </div>
                            </div>
                            {assessment.scheduledDate && assessment.scheduledLocation && (
                              <div className="flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                <span>{assessment.scheduledLocation}</span>
                              </div>
                            )}
                            {assessment.scheduledDate && assessment.scheduledNotes && (
                              <p className="mt-1 italic">"{assessment.scheduledNotes}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Assessment Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{(assessmentDetail as any).element?.name}</h3>
                          <p className="text-sm text-muted-foreground">{(assessmentDetail as any).element?.code}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedAssessment('')}
                            data-testid="button-back-to-list"
                          >
                            Back to List
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setShowSignOffDialog(true)}
                            data-testid="button-mark-assessment"
                          >
                            {assessmentDetail?.outcome ? 'Review / Update Assessment' : 'Mark Assessment'}
                          </Button>
                        </div>
                      </div>

                      {/* Knowledge Criteria */}
                      <div className="space-y-3">
                        <h3 className="font-semibold">Knowledge Criteria</h3>
                        {assessmentDetail.element?.knowledgeCriteria && assessmentDetail.element.knowledgeCriteria.length > 0 ? (
                          <div className="space-y-4">
                            {Object.entries(groupCriteriaBySubcategory(assessmentDetail.element.knowledgeCriteria)).map(([subcategoryName, criteria]) => (
                              <div key={subcategoryName} className="border rounded-lg p-4">
                                <h4 className="font-medium mb-3">{subcategoryName}</h4>
                                <ol className="list-decimal pl-6 space-y-2">
                                  {criteria.map((criterion: any) => (
                                    <li key={criterion.id} className="text-sm">
                                      <div className="font-medium">{criterion.code}: {criterion.criteriaText}</div>
                                      {criterion.assessorGuidance && (
                                        <div className="mt-1 text-muted-foreground italic">
                                          Assessor Guidance: {criterion.assessorGuidance}
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No knowledge criteria defined</p>
                        )}
                      </div>

                      {/* Performance Criteria */}
                      <div className="space-y-3">
                        <h3 className="font-semibold">Performance Criteria</h3>
                        {assessmentDetail.element?.performanceCriteria && assessmentDetail.element.performanceCriteria.length > 0 ? (
                          <div className="space-y-4">
                            {Object.entries(groupCriteriaBySubcategory(assessmentDetail.element.performanceCriteria)).map(([subcategoryName, criteria]) => (
                              <div key={subcategoryName} className="border rounded-lg p-4">
                                <h4 className="font-medium mb-3">{subcategoryName}</h4>
                                <ol className="list-decimal pl-6 space-y-2">
                                  {criteria.map((criterion: any) => (
                                    <li key={criterion.id} className="text-sm">
                                      <div className="font-medium">{criterion.code}: {criterion.criteriaText}</div>
                                      {criterion.assessorGuidance && (
                                        <div className="mt-1 text-muted-foreground italic">
                                          Assessor Guidance: {criterion.assessorGuidance}
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No performance criteria defined</p>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a candidate to view their assessments</p>
                <p className="text-sm">Track progress and provide competency sign-offs</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sign-off Dialog */}
      {showSignOffDialog && selectedAssessmentData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <Card className="w-full max-w-2xl my-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {assessmentDetail?.outcome ? 'Review Assessment' : 'Mark Assessment'}
                {assessmentDetail?.outcome && (
                  <Badge variant="secondary" data-testid="badge-already-completed">Already completed - editing will update the record</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {assessmentDetail?.outcome
                  ? `Previously recorded outcome for ${selectedCandidateData?.name}. Review the details and evidence below, or change and resubmit.`
                  : `Complete the assessment for ${selectedCandidateData?.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Assessment Result */}
              <div className="space-y-2">
                <Label htmlFor="result">Assessment Result *</Label>
                <Select value={signOffResult} onValueChange={(value: any) => setSignOffResult(value)}>
                  <SelectTrigger data-testid="select-sign-off-result">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="competent">Competent</SelectItem>
                    <SelectItem value="not_yet_competent">Not Yet Competent</SelectItem>
                    <SelectItem value="competent_with_minor_needs">Competent with Minor Needs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Knowledge Outcomes */}
              <div className="space-y-2">
                <Label htmlFor="knowledge-outcomes">Knowledge Outcomes *</Label>
                <Textarea
                  id="knowledge-outcomes"
                  placeholder="Describe the knowledge outcomes demonstrated..."
                  value={knowledgeOutcomes}
                  onChange={(e) => setKnowledgeOutcomes(e.target.value)}
                  rows={4}
                  data-testid="textarea-knowledge-outcomes"
                />
              </div>

              {/* Performance Outcomes */}
              <div className="space-y-2">
                <Label htmlFor="performance-outcomes">Performance Outcomes *</Label>
                <Textarea
                  id="performance-outcomes"
                  placeholder="Describe the performance outcomes demonstrated..."
                  value={performanceOutcomes}
                  onChange={(e) => setPerformanceOutcomes(e.target.value)}
                  rows={4}
                  data-testid="textarea-performance-outcomes"
                />
              </div>

              {/* Overall Comment */}
              <div className="space-y-2">
                <Label htmlFor="overall-comment">Overall Comment *</Label>
                <Textarea
                  id="overall-comment"
                  placeholder="Provide overall assessment comments..."
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  rows={4}
                  data-testid="textarea-overall-comment"
                />
              </div>

              {/* Conditional Minor Needs Fields */}
              {signOffResult === 'competent_with_minor_needs' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="minor-needs-comment">Minor Needs Comment *</Label>
                    <Textarea
                      id="minor-needs-comment"
                      placeholder="Describe the minor improvements needed..."
                      value={minorNeedsComment}
                      onChange={(e) => setMinorNeedsComment(e.target.value)}
                      rows={3}
                      data-testid="textarea-minor-needs-comment"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minor-needs-due-date">Minor Needs Due Date *</Label>
                    <Input
                      id="minor-needs-due-date"
                      type="date"
                      value={minorNeedsDueDate}
                      onChange={(e) => setMinorNeedsDueDate(e.target.value)}
                      data-testid="input-minor-needs-due-date"
                    />
                  </div>
                </>
              )}

              {/* Previously Submitted Evidence */}
              {existingEvidence.length > 0 && (
                <div className="space-y-3">
                  <Label>Submitted Evidence ({existingEvidence.length})</Label>
                  <div className="space-y-2">
                    {existingEvidence.map((item) => (
                      <div
                        key={item.id}
                        className="border rounded p-2 space-y-2"
                        data-testid={`existing-evidence-${item.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className={`text-sm truncate ${item.rejectedAt ? 'line-through text-muted-foreground' : ''}`}>{item.fileName}</span>
                            {item.aiVerdict && !item.rejectedAt && (
                              <Badge
                                variant={verdictBadgeVariant(item.aiVerdict)}
                                className="capitalize shrink-0 cursor-pointer"
                                onClick={() => setExpandedReviewId(expandedReviewId === item.id ? null : item.id)}
                                data-testid={`badge-ai-verdict-${item.id}`}
                              >
                                {item.aiVerdict === 'valid' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {item.aiVerdict === 'invalid' && <XCircle className="h-3 w-3 mr-1" />}
                                {item.aiVerdict === 'inconclusive' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                {item.aiVerdict}
                              </Badge>
                            )}
                            {item.rejectedAt && (
                              <Badge variant="destructive" className="shrink-0" data-testid={`badge-rejected-${item.id}`}>
                                Rejected
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!item.rejectedAt && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => aiReviewMutation.mutate(item.id)}
                                  disabled={aiReviewMutation.isPending && aiReviewMutation.variables === item.id}
                                  data-testid={`button-ai-review-evidence-${item.id}`}
                                  title={item.aiVerdict ? "Re-run AI review" : "Run AI review"}
                                >
                                  {aiReviewMutation.isPending && aiReviewMutation.variables === item.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setRejectingEvidenceId(item.id); setRejectionReasonInput(''); }}
                                  title="Reject this evidence as not applicable"
                                  data-testid={`button-reject-evidence-${item.id}`}
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              data-testid={`button-download-evidence-${item.id}`}
                            >
                              <a href={`/api/assessment-evidence/${item.id}/download`} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                        {item.aiVerdict && !item.rejectedAt && expandedReviewId === item.id && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2" data-testid={`text-ai-reasoning-${item.id}`}>
                            <span className="font-medium">AI review ({item.aiConfidence}% confidence):</span> {item.aiReasoning}
                          </div>
                        )}
                        {item.rejectedAt && item.rejectionReason && (
                          <div className="text-xs text-destructive bg-destructive/10 rounded p-2" data-testid={`text-rejection-reason-${item.id}`}>
                            <span className="font-medium">Rejected - reason sent to candidate:</span> {item.rejectionReason}
                          </div>
                        )}
                        {rejectingEvidenceId === item.id && (
                          <div className="space-y-2 border-t pt-2" data-testid={`reject-form-${item.id}`}>
                            <Label htmlFor={`reject-reason-${item.id}`} className="text-xs">Reason (sent to the candidate by email)</Label>
                            <Textarea
                              id={`reject-reason-${item.id}`}
                              value={rejectionReasonInput}
                              onChange={(e) => setRejectionReasonInput(e.target.value)}
                              placeholder="e.g. This document doesn't show your name or involvement - please submit evidence that clearly identifies you."
                              rows={2}
                              data-testid={`textarea-reject-reason-${item.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectEvidenceMutation.mutate({ evidenceId: item.id, reason: rejectionReasonInput })}
                                disabled={!rejectionReasonInput.trim() || rejectEvidenceMutation.isPending}
                                data-testid={`button-confirm-reject-${item.id}`}
                              >
                                {rejectEvidenceMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setRejectingEvidenceId(null)} data-testid={`button-cancel-reject-${item.id}`}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence Upload */}
              <div className="space-y-3">
                <Label>Upload Evidence</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="dropzone-evidence"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop files here, or click to browse
                  </p>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="evidence-upload"
                    data-testid="input-evidence-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('evidence-upload')?.click()}
                    type="button"
                    data-testid="button-browse-files"
                  >
                    Browse Files
                  </Button>
                </div>

                {/* Display selected files */}
                {evidenceFiles.length > 0 && (
                  <div className="space-y-2">
                    {evidenceFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border rounded"
                        data-testid={`evidence-file-${index}`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={uploadingEvidence}
                          data-testid={`button-remove-file-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUploadClick}
                      disabled={uploadingEvidence}
                      className="w-full"
                      data-testid="button-upload-evidence"
                    >
                      {uploadingEvidence ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload {evidenceFiles.length} File{evidenceFiles.length > 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Assessment Methods */}
              <div className="space-y-3">
                <Label>Assessment Methods *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'Observation',
                    'Simulation',
                    'Demonstration',
                    'Questioning',
                    'Products of Work',
                    'Professional Discussion',
                    'Witness Testimony',
                    'Other'
                  ].map((method) => (
                    <div key={method} className="flex items-center space-x-2">
                      <Checkbox
                        id={`method-${method.toLowerCase().replace(/\s+/g, '-')}`}
                        checked={assessmentMethods.includes(method)}
                        onCheckedChange={() => toggleAssessmentMethod(method)}
                        data-testid={`checkbox-method-${method.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                      <Label
                        htmlFor={`method-${method.toLowerCase().replace(/\s+/g, '-')}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {method}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSignOff}
                  disabled={signOffMutation.isPending}
                  data-testid="button-confirm-sign-off"
                >
                  {signOffMutation.isPending ? 'Saving...' : assessmentDetail?.outcome ? 'Update Sign-off' : 'Complete Sign-off'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowSignOffDialog(false)} 
                  disabled={signOffMutation.isPending}
                  data-testid="button-cancel-sign-off"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Assessment</DialogTitle>
            <DialogDescription>
              {selectedAssessmentData?.standardName} for {selectedCandidateData?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-datetime">Date &amp; Time</Label>
              <Input
                id="schedule-datetime"
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                data-testid="input-schedule-datetime"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-location">Location</Label>
              <Select value={scheduleLocation} onValueChange={setScheduleLocation}>
                <SelectTrigger id="schedule-location" data-testid="select-schedule-location">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(location => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-notes">Notes for Candidate</Label>
              <Textarea
                id="schedule-notes"
                placeholder="Any specific evidence or preparation the candidate should bring..."
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                data-testid="textarea-schedule-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowScheduleDialog(false)}
              disabled={scheduleAssessmentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => scheduleAssessmentMutation.mutate({
                plannedAssessmentDate: scheduleDateTime,
                plannedAssessmentLocation: scheduleLocation,
                plannedAssessmentNotes: scheduleNotes,
              })}
              disabled={!scheduleDateTime || scheduleAssessmentMutation.isPending}
              data-testid="button-confirm-schedule"
            >
              {scheduleAssessmentMutation.isPending ? 'Scheduling...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}