import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Camera,
  MessageSquare,
  Calendar,
  Filter,
  Search,
  Eye,
  Download,
  Plus,
  RefreshCw
} from 'lucide-react';
import { useState } from 'react';
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
  completedDate?: string;
  dueDate: string;
  progress: number;
  result?: 'competent' | 'not_yet_competent' | 'training_needs';
  evidence: Evidence[];
  observations: Observation[];
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
  const [selectedCandidate, setSelectedCandidate] = useState<string>('');
  const [selectedAssessment, setSelectedAssessment] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSignOffDialog, setShowSignOffDialog] = useState(false);
  const [signOffResult, setSignOffResult] = useState<'competent' | 'not_yet_competent' | 'training_needs'>('competent');
  const [signOffFeedback, setSignOffFeedback] = useState('');
  const [knowledgeOutcomes, setKnowledgeOutcomes] = useState('');
  const [performanceOutcomes, setPerformanceOutcomes] = useState('');
  const [overallComment, setOverallComment] = useState('');
  const [assessmentMethods, setAssessmentMethods] = useState<string[]>([]);

  // Sign-off mutation
  const signOffMutation = useMutation({
    mutationFn: async (data: {
      outcome: string;
      knowledgeOutcomes?: string;
      performanceOutcomes?: string;
      overallComment?: string;
      assessmentMethods: string[];
    }) => {
      return await apiRequest('PATCH', `/api/assessments/${selectedAssessment}/sign-off`, data);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/assessors/${user?.id}/candidates`] });
      queryClient.invalidateQueries({ queryKey: [`/api/assessments/${selectedAssessment}`] });
      
      // Show success message
      toast({
        title: "Assessment Signed Off",
        description: "The assessment has been successfully signed off.",
      });
      
      // Close dialog and reset form
      setShowSignOffDialog(false);
      setSignOffFeedback('');
      setKnowledgeOutcomes('');
      setPerformanceOutcomes('');
      setOverallComment('');
      setAssessmentMethods([]);
    },
    onError: (error: any) => {
      toast({
        title: "Sign-off Failed",
        description: error.message || "Failed to sign off assessment. Please try again.",
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

  // Fetch detailed assessment data with K&P criteria when assessment is selected
  const { data: assessmentDetail } = useQuery<any>({
    queryKey: [`/api/assessments/${selectedAssessment}`],
    enabled: !!selectedAssessment,
  });

  const toggleAssessmentMethod = (method: string) => {
    setAssessmentMethods(prev => 
      prev.includes(method) 
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  const handleSignOff = () => {
    if (selectedCandidateData && selectedAssessmentData) {
      // Validate assessment methods
      if (assessmentMethods.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please select at least one assessment method.",
          variant: "destructive",
        });
        return;
      }
      
      // Call the sign-off mutation
      signOffMutation.mutate({
        outcome: signOffResult,
        knowledgeOutcomes,
        performanceOutcomes,
        overallComment,
        assessmentMethods,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'awaiting_review': return 'destructive';
      case 'scheduled': return 'outline';
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

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'satisfactory': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'needs_improvement': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'not_observed': return <XCircle className="h-4 w-4 text-gray-400" />;
      default: return null;
    }
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
          <Button data-testid="button-schedule-assessment">
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
              <Tabs defaultValue="assessments" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="assessments" data-testid="tab-assessments">Assessments</TabsTrigger>
                  <TabsTrigger value="evidence" data-testid="tab-evidence">Evidence</TabsTrigger>
                  <TabsTrigger value="observations" data-testid="tab-observations">Observations</TabsTrigger>
                </TabsList>

                <TabsContent value="assessments" className="space-y-4">
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
                                <Badge variant={getResultColor(assessment.result)}>
                                  {assessment.result.replace('_', ' ')}
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

                          <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              {assessment.scheduledDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>Scheduled: {assessment.scheduledDate}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>Due: {assessment.dueDate}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Assessment Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{assessmentDetail.element?.name}</h3>
                          <p className="text-sm text-muted-foreground">{assessmentDetail.element?.code}</p>
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
                            Mark Assessment
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
                </TabsContent>

                <TabsContent value="evidence" className="space-y-4">
                  {selectedAssessmentData ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Evidence for {selectedAssessmentData.standardName}</h4>
                        <Button variant="outline" size="sm" data-testid="button-view-all-evidence">
                          <Eye className="h-4 w-4 mr-2" />
                          View All
                        </Button>
                      </div>
                      
                      {selectedAssessmentData.evidence.map(evidence => (
                        <div key={evidence.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {evidence.type === 'document' && <FileText className="h-5 w-5" />}
                              {evidence.type === 'image' && <Camera className="h-5 w-5" />}
                              <div>
                                <h5 className="font-medium">{evidence.name}</h5>
                                <p className="text-sm text-muted-foreground">
                                  Uploaded: {evidence.uploadedDate}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {evidence.verified ? (
                                <Badge variant="default">Verified</Badge>
                              ) : (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                              <Button variant="outline" size="sm" data-testid={`button-view-evidence-${evidence.id}`}>
                                View
                              </Button>
                            </div>
                          </div>
                          {evidence.comments && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <strong>Comments:</strong> {evidence.comments}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select an assessment to view evidence</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="observations" className="space-y-4">
                  {selectedAssessmentData ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Observations for {selectedAssessmentData.standardName}</h4>
                        <Button data-testid="button-add-observation">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Observation
                        </Button>
                      </div>
                      
                      {selectedAssessmentData.observations.map(observation => (
                        <div key={observation.id} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {getOutcomeIcon(observation.outcome)}
                                <h5 className="font-medium">{observation.criteria}</h5>
                                <Badge variant="outline" className="text-xs">
                                  {observation.outcome.replace('_', ' ')}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {observation.notes}
                              </p>
                              <div className="text-xs text-muted-foreground">
                                <span>Assessed by {observation.assessor} on {observation.date}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select an assessment to view observations</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
              <CardTitle>Mark Assessment</CardTitle>
              <CardDescription>
                Complete the assessment for {selectedCandidateData?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Assessment Result */}
              <div className="space-y-2">
                <Label htmlFor="result">Assessment Result</Label>
                <Select value={signOffResult} onValueChange={(value: any) => setSignOffResult(value)}>
                  <SelectTrigger data-testid="select-sign-off-result">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="competent">Competent</SelectItem>
                    <SelectItem value="not_yet_competent">Not Yet Competent</SelectItem>
                    <SelectItem value="training_needs">Training Needs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Knowledge Outcomes */}
              <div className="space-y-2">
                <Label htmlFor="knowledge-outcomes">Knowledge Outcomes</Label>
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
                <Label htmlFor="performance-outcomes">Performance Outcomes</Label>
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
                <Label htmlFor="overall-comment">Overall Comment</Label>
                <Textarea
                  id="overall-comment"
                  placeholder="Provide overall assessment comments..."
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  rows={4}
                  data-testid="textarea-overall-comment"
                />
              </div>

              {/* Assessment Methods */}
              <div className="space-y-3">
                <Label>Assessment Methods</Label>
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
                  {signOffMutation.isPending ? 'Signing Off...' : 'Complete Sign-off'}
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
    </div>
  );
}