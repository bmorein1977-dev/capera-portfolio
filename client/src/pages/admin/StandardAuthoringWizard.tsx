import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, Plus, CheckCircle2, XCircle, Pencil, Upload, FileUp, Rocket, Loader2 } from 'lucide-react';
import type {
  StandardLevel,
  StandardDraftSession,
  StandardDraftSubjectMatter,
  StandardDraftQuestion,
  StandardDraftScenario,
  CompetencyCategory,
} from '@shared/schema';

export default function StandardAuthoringWizard() {
  const { toast } = useToast();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showCreateSessionDialog, setShowCreateSessionDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const { data: sessions = [] } = useQuery<StandardDraftSession[]>({
    queryKey: ['/api/standard-draft-sessions'],
  });

  const { data: levels = [] } = useQuery<StandardLevel[]>({
    queryKey: ['/api/standard-levels'],
  });

  const selectedSession = sessions.find(s => s.id === selectedSessionId) || null;
  const levelNameById = new Map(levels.map(l => [l.id, l.name]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            SME New Standard Wizard
          </h1>
          <p className="text-muted-foreground">
            Author a new competency standard with AI-drafted knowledge questions and performance scenarios,
            for you to review, edit, and approve before publishing.
          </p>
        </div>
        <Button onClick={() => setShowCreateSessionDialog(true)} data-testid="button-new-draft">
          <Plus className="h-4 w-4 mr-2" />
          New Draft
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Session list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Drafts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">No drafts yet. Start a new one.</p>
            )}
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                className={`w-full text-left p-2 rounded border text-sm ${selectedSessionId === session.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}
                data-testid={`draft-session-${session.id}`}
              >
                <div className="font-medium truncate">{session.title}</div>
                <Badge variant={session.status === 'published' ? 'default' : 'secondary'} className="mt-1 capitalize">
                  {session.status}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Selected draft workspace */}
        <div className="lg:col-span-3 space-y-6">
          {!selectedSession ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a draft from the list, or start a new one.
              </CardContent>
            </Card>
          ) : (
            <SessionWorkspace
              session={selectedSession}
              levelNameById={levelNameById}
              onOpenPublish={() => setShowPublishDialog(true)}
            />
          )}
        </div>
      </div>

      <CreateSessionDialog
        open={showCreateSessionDialog}
        onOpenChange={setShowCreateSessionDialog}
        levels={levels}
        onCreated={(id) => setSelectedSessionId(id)}
      />

      {selectedSession && (
        <PublishDraftDialog
          open={showPublishDialog}
          onOpenChange={setShowPublishDialog}
          session={selectedSession}
          onPublished={() => toast({ title: 'Standard Published', description: `"${selectedSession.title}" is now live in Competency Manager.` })}
        />
      )}
    </div>
  );
}

function CreateSessionDialog({ open, onOpenChange, levels, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levels: StandardLevel[];
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/standard-draft-sessions', { title, jobLevelIds: selectedLevelIds });
      return res.json();
    },
    onSuccess: (data: StandardDraftSession) => {
      queryClient.invalidateQueries({ queryKey: ['/api/standard-draft-sessions'] });
      onCreated(data.id);
      onOpenChange(false);
      setTitle('');
      setSelectedLevelIds([]);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create draft', variant: 'destructive' });
    },
  });

  const toggleLevel = (id: string) => {
    setSelectedLevelIds(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-create-draft-session">
        <DialogHeader>
          <DialogTitle>New Competency Standard</DialogTitle>
          <DialogDescription>Give the standard a title and choose which job levels it should be pitched at.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="standard-title">Standard Title *</Label>
            <Input id="standard-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Generator Alternator Maintenance" data-testid="input-standard-title" />
          </div>
          <div className="space-y-2">
            <Label>Job Level(s)</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-2">
              {levels.map(level => (
                <label key={level.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedLevelIds.includes(level.id)} onCheckedChange={() => toggleLevel(level.id)} data-testid={`checkbox-level-${level.id}`} />
                  {level.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending} data-testid="button-create-draft">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Create Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionWorkspace({ session, levelNameById, onOpenPublish }: {
  session: StandardDraftSession;
  levelNameById: Map<string, string>;
  onOpenPublish: () => void;
}) {
  const { toast } = useToast();
  const [showAddSubjectMatterDialog, setShowAddSubjectMatterDialog] = useState(false);

  const { data: subjectMatters = [] } = useQuery<StandardDraftSubjectMatter[]>({
    queryKey: ['/api/standard-draft-subject-matters', { draftSessionId: session.id }],
    enabled: !!session.id,
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: 'job_description' | 'company_procedure' }) => {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('kind', kind);
      const res = await fetch(`/api/standard-draft-sessions/${session.id}/documents`, { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/standard-draft-sessions'] });
      toast({ title: 'Document Uploaded', description: 'It will be used to ground AI generation for this draft.' });
    },
    onError: (error: any) => {
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    },
  });

  const selectedLevelNames = (session.jobLevelIds || []).map(id => levelNameById.get(id)).filter(Boolean);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{session.title}</CardTitle>
              <CardDescription className="mt-2 flex flex-wrap gap-1">
                {selectedLevelNames.length === 0 ? (
                  <span>No job levels selected</span>
                ) : selectedLevelNames.map(name => <Badge key={name} variant="outline">{name}</Badge>)}
              </CardDescription>
            </div>
            {session.status !== 'published' ? (
              <Button onClick={onOpenPublish} data-testid="button-open-publish">
                <Rocket className="h-4 w-4 mr-2" />
                Publish
              </Button>
            ) : (
              <Badge data-testid="badge-published">Published</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Optional Grounding Documents</Label>
          <div className="flex flex-wrap gap-3">
            <div>
              <input
                type="file"
                id="job-description-upload"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocMutation.mutate({ file: f, kind: 'job_description' }); }}
              />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('job-description-upload')?.click()} data-testid="button-upload-job-description">
                <Upload className="h-4 w-4 mr-2" />
                {session.jobDescriptionFileUrl ? 'Replace Job Description' : 'Upload Job Description'}
              </Button>
            </div>
            <div>
              <input
                type="file"
                id="company-procedure-upload"
                className="hidden"
                multiple
                onChange={(e) => { const files = Array.from(e.target.files || []); files.forEach(f => uploadDocMutation.mutate({ file: f, kind: 'company_procedure' })); }}
              />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('company-procedure-upload')?.click()} data-testid="button-upload-company-procedure">
                <FileUp className="h-4 w-4 mr-2" />
                Upload Company Procedure(s)
              </Button>
            </div>
          </div>
          {(session.companyProcedureFileUrls?.length || session.jobDescriptionFileUrl) && (
            <p className="text-xs text-muted-foreground">
              {session.jobDescriptionFileUrl ? '1 job description' : ''}
              {session.jobDescriptionFileUrl && session.companyProcedureFileUrls?.length ? ' + ' : ''}
              {session.companyProcedureFileUrls?.length ? `${session.companyProcedureFileUrls.length} company procedure document(s)` : ''} attached
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Subject Matters</CardTitle>
          <Button size="sm" onClick={() => setShowAddSubjectMatterDialog(true)} data-testid="button-add-subject-matter">
            <Plus className="h-4 w-4 mr-2" />
            Add Subject Matter
          </Button>
        </CardHeader>
        <CardContent>
          {subjectMatters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subject matters yet - add one (e.g. "Generator Alternator") to start generating questions.</p>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {subjectMatters.map(sm => (
                <AccordionItem key={sm.id} value={sm.id} className="border rounded px-3">
                  <AccordionTrigger data-testid={`accordion-subject-matter-${sm.id}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sm.name}</span>
                      <Badge variant="outline">{sm.requestedQuestionCount} questions</Badge>
                      {sm.performanceAssessmentType && (
                        <Badge variant="secondary" className="capitalize">{sm.performanceAssessmentType.replace('_', ' ')}</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <SubjectMatterPanel subjectMatter={sm} draftSessionId={session.id} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <AddSubjectMatterDialog
        open={showAddSubjectMatterDialog}
        onOpenChange={setShowAddSubjectMatterDialog}
        draftSessionId={session.id}
      />
    </div>
  );
}

function AddSubjectMatterDialog({ open, onOpenChange, draftSessionId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftSessionId: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [questionCount, setQuestionCount] = useState('5');

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/standard-draft-subject-matters', {
        draftSessionId,
        name,
        requestedQuestionCount: parseInt(questionCount, 10) || 5,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/standard-draft-subject-matters', { draftSessionId }] });
      onOpenChange(false);
      setName('');
      setQuestionCount('5');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to add subject matter', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-add-subject-matter">
        <DialogHeader>
          <DialogTitle>Add Subject Matter</DialogTitle>
          <DialogDescription>e.g. "Generator Alternator", "Power Factor Correction", "Ultrasonic Flow Meter"</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject-matter-name">Subject Matter *</Label>
            <Input id="subject-matter-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-subject-matter-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-count">Number of Questions Requested</Label>
            <Input id="question-count" type="number" min="1" max="30" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} data-testid="input-question-count" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} data-testid="button-save-subject-matter">
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubjectMatterPanel({ subjectMatter, draftSessionId }: { subjectMatter: StandardDraftSubjectMatter; draftSessionId: string }) {
  const { toast } = useToast();

  const { data: questions = [] } = useQuery<StandardDraftQuestion[]>({
    queryKey: ['/api/standard-draft-questions', { subjectMatterId: subjectMatter.id }],
  });
  const { data: scenarios = [] } = useQuery<StandardDraftScenario[]>({
    queryKey: ['/api/standard-draft-scenarios', { subjectMatterId: subjectMatter.id }],
  });

  const setAssessmentTypeMutation = useMutation({
    mutationFn: async (performanceAssessmentType: string) =>
      apiRequest('PATCH', `/api/standard-draft-subject-matters/${subjectMatter.id}`, { performanceAssessmentType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/standard-draft-subject-matters', { draftSessionId }] });
    },
  });

  const generateQuestionsMutation = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/standard-draft-subject-matters/${subjectMatter.id}/generate-questions`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/standard-draft-questions', { subjectMatterId: subjectMatter.id }] });
      toast({ title: 'Questions Generated', description: 'Review and approve each question below.' });
    },
    onError: (error: any) => toast({ title: 'Generation Failed', description: error.message, variant: 'destructive' }),
  });

  const generateScenariosMutation = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/standard-draft-subject-matters/${subjectMatter.id}/generate-scenarios`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/standard-draft-scenarios', { subjectMatterId: subjectMatter.id }] });
      toast({ title: 'Scenarios Generated', description: 'Review and approve each scenario below.' });
    },
    onError: (error: any) => toast({ title: 'Generation Failed', description: error.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4 pb-3">
      <div className="flex items-center gap-4">
        <Button size="sm" onClick={() => generateQuestionsMutation.mutate()} disabled={generateQuestionsMutation.isPending} data-testid={`button-generate-questions-${subjectMatter.id}`}>
          {generateQuestionsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Generate Knowledge Questions
        </Button>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Performance Assessment:</Label>
          <Select value={subjectMatter.performanceAssessmentType || undefined} onValueChange={(v) => setAssessmentTypeMutation.mutate(v)}>
            <SelectTrigger className="w-48" data-testid={`select-assessment-type-${subjectMatter.id}`}>
              <SelectValue placeholder="Choose type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scenario">Scenario-based</SelectItem>
              <SelectItem value="work_evidence">Work-evidence-based</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {subjectMatter.performanceAssessmentType === 'scenario' && (
          <Button size="sm" variant="outline" onClick={() => generateScenariosMutation.mutate()} disabled={generateScenariosMutation.isPending} data-testid={`button-generate-scenarios-${subjectMatter.id}`}>
            {generateScenariosMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Scenarios
          </Button>
        )}
      </div>

      {questions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">Knowledge Questions</Label>
          {questions.map(q => <QuestionCard key={q.id} question={q} subjectMatterId={subjectMatter.id} />)}
        </div>
      )}

      {scenarios.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">Performance Scenarios</Label>
          {scenarios.map(s => <ScenarioCard key={s.id} scenario={s} subjectMatterId={subjectMatter.id} />)}
        </div>
      )}
    </div>
  );
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'approved' || status === 'edited') return 'default';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
}

function QuestionCard({ question, subjectMatterId }: { question: StandardDraftQuestion; subjectMatterId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(question.questionText);
  const [options, setOptions] = useState<string[]>(question.options);
  const [correctIndex, setCorrectIndex] = useState(question.correctAnswerIndex);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<StandardDraftQuestion>) => apiRequest('PATCH', `/api/standard-draft-questions/${question.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/standard-draft-questions', { subjectMatterId }] });
      setIsEditing(false);
    },
  });

  return (
    <div className="border rounded p-3 space-y-2" data-testid={`question-card-${question.id}`}>
      <div className="flex items-start justify-between gap-2">
        <Badge variant={statusBadgeVariant(question.status)} className="capitalize shrink-0">{question.status.replace('_', ' ')}</Badge>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(!isEditing)} data-testid={`button-edit-question-${question.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ status: 'approved' })} data-testid={`button-approve-question-${question.id}`}><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /></Button>
          <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ status: 'rejected' })} data-testid={`button-reject-question-${question.id}`}><XCircle className="h-3.5 w-3.5 text-red-600" /></Button>
        </div>
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} />
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
              <Input value={opt} onChange={(e) => setOptions(prev => prev.map((o, oi) => oi === i ? e.target.value : o))} />
            </div>
          ))}
          <Button size="sm" onClick={() => updateMutation.mutate({ questionText: text, options, correctAnswerIndex: correctIndex, status: 'edited' })} data-testid={`button-save-question-${question.id}`}>
            Save
          </Button>
        </div>
      ) : (
        <div className="text-sm space-y-1">
          <p className="font-medium">{question.questionText}</p>
          <ul className="list-none space-y-0.5">
            {question.options.map((opt, i) => (
              <li key={i} className={i === question.correctAnswerIndex ? 'text-green-700 font-medium' : 'text-muted-foreground'}>
                {i === question.correctAnswerIndex ? '✓ ' : '• '}{opt}
              </li>
            ))}
          </ul>
          {question.explanation && <p className="text-xs text-muted-foreground italic">{question.explanation}</p>}
        </div>
      )}
    </div>
  );
}

function ScenarioCard({ scenario, subjectMatterId }: { scenario: StandardDraftScenario; subjectMatterId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(scenario.title);
  const [text, setText] = useState(scenario.scenarioText);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<StandardDraftScenario>) => apiRequest('PATCH', `/api/standard-draft-scenarios/${scenario.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/standard-draft-scenarios', { subjectMatterId }] });
      setIsEditing(false);
    },
  });

  return (
    <div className="border rounded p-3 space-y-2" data-testid={`scenario-card-${scenario.id}`}>
      <div className="flex items-start justify-between gap-2">
        <Badge variant={statusBadgeVariant(scenario.status)} className="capitalize shrink-0">{scenario.status.replace('_', ' ')}</Badge>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(!isEditing)} data-testid={`button-edit-scenario-${scenario.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ status: 'approved' })} data-testid={`button-approve-scenario-${scenario.id}`}><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /></Button>
          <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ status: 'rejected' })} data-testid={`button-reject-scenario-${scenario.id}`}><XCircle className="h-3.5 w-3.5 text-red-600" /></Button>
        </div>
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scenario title" />
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
          <Button size="sm" onClick={() => updateMutation.mutate({ title, scenarioText: text, status: 'edited' })} data-testid={`button-save-scenario-${scenario.id}`}>
            Save
          </Button>
        </div>
      ) : (
        <div className="text-sm space-y-1">
          <p className="font-medium">{scenario.title}</p>
          <p className="text-muted-foreground">{scenario.scenarioText}</p>
          {scenario.assessmentCriteria && scenario.assessmentCriteria.length > 0 && (
            <ul className="list-disc list-inside text-xs text-muted-foreground">
              {scenario.assessmentCriteria.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PublishDraftDialog({ open, onOpenChange, session, onPublished }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: StandardDraftSession;
  onPublished: () => void;
}) {
  const { toast } = useToast();
  const [categoryId, setCategoryId] = useState('');

  const { data: categories = [] } = useQuery<CompetencyCategory[]>({
    queryKey: ['/api/competency-categories'],
    enabled: open,
  });

  const publishMutation = useMutation({
    mutationFn: async () => apiRequest('POST', `/api/standard-draft-sessions/${session.id}/publish`, { categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/standard-draft-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-tree'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competency-elements'] });
      onOpenChange(false);
      onPublished();
    },
    onError: (error: any) => {
      toast({ title: 'Publish Failed', description: error.message || 'Failed to publish standard', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-publish-draft">
        <DialogHeader>
          <DialogTitle>Publish "{session.title}"</DialogTitle>
          <DialogDescription>
            This creates a new competency element with a subcategory and criteria for each approved question and scenario.
            Only questions/scenarios marked "approved" or "edited" are published - anything still "AI generated" (unreviewed) or "rejected" is left out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="publish-category">Matrix Category *</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="publish-category" data-testid="select-publish-category">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => publishMutation.mutate()} disabled={!categoryId || publishMutation.isPending} data-testid="button-confirm-publish">
            {publishMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
