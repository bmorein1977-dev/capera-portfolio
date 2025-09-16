import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  Star,
  ArrowRight,
  ArrowLeft,
  Save,
  Send,
  RotateCcw,
  Eye
} from 'lucide-react';
import { useState } from 'react';

interface SelfAssessmentQuestion {
  id: string;
  type: 'multiple_choice' | 'rating_scale' | 'text_response' | 'checklist' | 'confidence_rating';
  question: string;
  description?: string;
  required: boolean;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: string[];
  checklistItems?: string[];
}

interface SelfAssessmentModule {
  id: string;
  title: string;
  description: string;
  skillArea: string;
  estimatedTime: number; // minutes
  questions: SelfAssessmentQuestion[];
  isOptional: boolean;
  completionCriteria?: string;
  benefits: string[];
}

interface AssessmentResponse {
  questionId: string;
  answer: string | string[] | number;
  confidence?: number;
  notes?: string;
}

interface AssessmentProgress {
  moduleId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  currentQuestion: number;
  responses: AssessmentResponse[];
  startedDate?: string;
  completedDate?: string;
  score?: number;
}

const mockSelfAssessmentModules: SelfAssessmentModule[] = [
  {
    id: '1',
    title: 'Equipment Operation Readiness',
    description: 'Self-assess your confidence and knowledge in equipment operation before formal assessment',
    skillArea: 'Technical Skills',
    estimatedTime: 15,
    isOptional: true,
    benefits: [
      'Identify knowledge gaps before formal assessment',
      'Build confidence in your abilities',
      'Create a personalized learning plan',
      'Track your progress over time'
    ],
    questions: [
      {
        id: '1',
        type: 'confidence_rating',
        question: 'How confident are you in starting up the equipment safely?',
        description: 'Rate your confidence level in performing equipment startup procedures',
        required: true,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: ['Not confident', 'Slightly confident', 'Moderately confident', 'Very confident', 'Extremely confident'],
      },
      {
        id: '2',
        type: 'multiple_choice',
        question: 'What is the first step in the equipment startup procedure?',
        required: true,
        options: [
          'Turn on the main power switch',
          'Complete the pre-startup safety checklist',
          'Check the equipment manual',
          'Contact the supervisor'
        ],
      },
      {
        id: '3',
        type: 'checklist',
        question: 'Which safety procedures do you feel comfortable performing?',
        description: 'Select all procedures you can confidently execute',
        required: false,
        checklistItems: [
          'Lockout/Tagout procedures',
          'Emergency stop activation',
          'Personal protective equipment selection',
          'Hazard identification',
          'Safety checklist completion',
          'Incident reporting'
        ],
      },
      {
        id: '4',
        type: 'text_response',
        question: 'Describe a challenging situation you\'ve encountered with equipment operation',
        description: 'Share your experience and how you resolved it (optional)',
        required: false,
      },
      {
        id: '5',
        type: 'rating_scale',
        question: 'Rate your overall readiness for the formal assessment',
        required: true,
        scaleMin: 1,
        scaleMax: 10,
        scaleLabels: ['Not ready', 'Completely ready'],
      },
    ],
  },
  {
    id: '2',
    title: 'Safety Knowledge Check',
    description: 'Evaluate your understanding of safety procedures and protocols',
    skillArea: 'Safety',
    estimatedTime: 20,
    isOptional: true,
    benefits: [
      'Reinforce safety knowledge',
      'Identify areas for additional training',
      'Prepare for safety assessments',
      'Demonstrate safety commitment'
    ],
    questions: [
      {
        id: '6',
        type: 'multiple_choice',
        question: 'In an emergency situation, what is your first priority?',
        required: true,
        options: [
          'Protect equipment from damage',
          'Ensure personal safety',
          'Contact management',
          'Document the incident'
        ],
      },
      {
        id: '7',
        type: 'confidence_rating',
        question: 'How confident are you in identifying workplace hazards?',
        required: true,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabels: ['Not confident', 'Slightly confident', 'Moderately confident', 'Very confident', 'Extremely confident'],
      },
    ],
  },
];

export default function SelfAssessment() {
  const [assessmentProgress, setAssessmentProgress] = useState<AssessmentProgress[]>([
    {
      moduleId: '1',
      status: 'in_progress',
      currentQuestion: 2,
      responses: [
        { questionId: '1', answer: 4, confidence: 4 },
        { questionId: '2', answer: 'Complete the pre-startup safety checklist' },
      ],
      startedDate: '2024-02-15',
    },
    {
      moduleId: '2',
      status: 'not_started',
      currentQuestion: 0,
      responses: [],
    },
  ]);

  const [selectedModule, setSelectedModule] = useState<string>('');
  const [currentModule, setCurrentModule] = useState<SelfAssessmentModule | null>(null);
  const [currentProgress, setCurrentProgress] = useState<AssessmentProgress | null>(null);
  const [currentResponse, setCurrentResponse] = useState<Partial<AssessmentResponse>>({});

  const handleStartModule = (moduleId: string) => {
    const module = mockSelfAssessmentModules.find(m => m.id === moduleId);
    if (!module) return;

    let progress = assessmentProgress.find(p => p.moduleId === moduleId);
    if (!progress) {
      progress = {
        moduleId,
        status: 'in_progress',
        currentQuestion: 0,
        responses: [],
        startedDate: new Date().toISOString().split('T')[0],
      };
      setAssessmentProgress([...assessmentProgress, progress]);
    }

    setCurrentModule(module);
    setCurrentProgress(progress);
    setSelectedModule(moduleId);
  };

  const handleSaveResponse = () => {
    if (!currentModule || !currentProgress || !currentResponse.answer) return;

    const currentQuestion = currentModule.questions[currentProgress.currentQuestion];
    const response: AssessmentResponse = {
      questionId: currentQuestion.id,
      answer: currentResponse.answer,
      confidence: currentResponse.confidence,
      notes: currentResponse.notes,
    };

    const updatedResponses = [...currentProgress.responses];
    const existingIndex = updatedResponses.findIndex(r => r.questionId === currentQuestion.id);
    
    if (existingIndex >= 0) {
      updatedResponses[existingIndex] = response;
    } else {
      updatedResponses.push(response);
    }

    const updatedProgress = {
      ...currentProgress,
      responses: updatedResponses,
    };

    setCurrentProgress(updatedProgress);
    setAssessmentProgress(prev => 
      prev.map(p => p.moduleId === currentModule.id ? updatedProgress : p)
    );

    console.log('Saved response:', response);
  };

  const handleNextQuestion = () => {
    if (!currentModule || !currentProgress) return;

    handleSaveResponse();

    const nextQuestionIndex = currentProgress.currentQuestion + 1;
    if (nextQuestionIndex < currentModule.questions.length) {
      const updatedProgress = {
        ...currentProgress,
        currentQuestion: nextQuestionIndex,
      };
      setCurrentProgress(updatedProgress);
      setCurrentResponse({});
    } else {
      // Complete the module
      const updatedProgress = {
        ...currentProgress,
        status: 'completed' as const,
        completedDate: new Date().toISOString().split('T')[0],
        score: Math.round((currentProgress.responses.length / currentModule.questions.filter(q => q.required).length) * 100),
      };
      setCurrentProgress(updatedProgress);
      setAssessmentProgress(prev => 
        prev.map(p => p.moduleId === currentModule.id ? updatedProgress : p)
      );
    }
  };

  const handlePreviousQuestion = () => {
    if (!currentProgress || currentProgress.currentQuestion === 0) return;

    const updatedProgress = {
      ...currentProgress,
      currentQuestion: currentProgress.currentQuestion - 1,
    };
    setCurrentProgress(updatedProgress);

    // Load previous response
    const prevQuestion = currentModule?.questions[updatedProgress.currentQuestion];
    if (prevQuestion) {
      const prevResponse = currentProgress.responses.find(r => r.questionId === prevQuestion.id);
      if (prevResponse) {
        setCurrentResponse({
          answer: prevResponse.answer,
          confidence: prevResponse.confidence,
          notes: prevResponse.notes,
        });
      }
    }
  };

  const renderQuestion = (question: SelfAssessmentQuestion) => {
    switch (question.type) {
      case 'multiple_choice':
        return (
          <RadioGroup
            value={currentResponse.answer as string}
            onValueChange={(value) => setCurrentResponse({...currentResponse, answer: value})}
            className="space-y-2"
          >
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={option} />
                <Label htmlFor={option} className="flex-1">{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'confidence_rating':
      case 'rating_scale':
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{question.scaleLabels?.[0] || question.scaleMin}</span>
              <span>{question.scaleLabels?.[question.scaleLabels.length - 1] || question.scaleMax}</span>
            </div>
            <RadioGroup
              value={currentResponse.answer?.toString()}
              onValueChange={(value) => setCurrentResponse({...currentResponse, answer: parseInt(value)})}
              className="flex justify-between"
            >
              {Array.from({length: (question.scaleMax || 5) - (question.scaleMin || 1) + 1}, (_, i) => {
                const value = (question.scaleMin || 1) + i;
                return (
                  <div key={value} className="flex flex-col items-center space-y-2">
                    <RadioGroupItem value={value.toString()} id={value.toString()} />
                    <Label htmlFor={value.toString()} className="text-xs">{value}</Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        );

      case 'checklist':
        return (
          <div className="space-y-2">
            {question.checklistItems?.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={item}
                  checked={(currentResponse.answer as string[] || []).includes(item)}
                  onCheckedChange={(checked) => {
                    const currentAnswers = (currentResponse.answer as string[]) || [];
                    if (checked) {
                      setCurrentResponse({
                        ...currentResponse,
                        answer: [...currentAnswers, item]
                      });
                    } else {
                      setCurrentResponse({
                        ...currentResponse,
                        answer: currentAnswers.filter(a => a !== item)
                      });
                    }
                  }}
                />
                <Label htmlFor={item} className="flex-1">{item}</Label>
              </div>
            ))}
          </div>
        );

      case 'text_response':
        return (
          <Textarea
            placeholder="Enter your response..."
            value={currentResponse.answer as string || ''}
            onChange={(e) => setCurrentResponse({...currentResponse, answer: e.target.value})}
            rows={4}
            className="w-full"
          />
        );

      default:
        return null;
    }
  };

  const getModuleProgress = (moduleId: string) => {
    const progress = assessmentProgress.find(p => p.moduleId === moduleId);
    const module = mockSelfAssessmentModules.find(m => m.id === moduleId);
    
    if (!progress || !module) return 0;
    if (progress.status === 'completed') return 100;
    
    return Math.round((progress.responses.length / module.questions.length) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'not_started': return 'outline';
      default: return 'outline';
    }
  };

  if (currentModule && currentProgress) {
    const currentQuestion = currentModule.questions[currentProgress.currentQuestion];
    const progressPercentage = Math.round(((currentProgress.currentQuestion + 1) / currentModule.questions.length) * 100);

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{currentModule.title}</h2>
            <p className="text-muted-foreground">{currentModule.description}</p>
          </div>
          <Button variant="outline" onClick={() => setCurrentModule(null)} data-testid="button-exit-assessment">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Modules
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Question {currentProgress.currentQuestion + 1} of {currentModule.questions.length}
              </CardTitle>
              <Badge variant="secondary">{progressPercentage}% Complete</Badge>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">{currentQuestion.question}</h3>
              {currentQuestion.description && (
                <p className="text-sm text-muted-foreground mb-4">{currentQuestion.description}</p>
              )}
              {currentQuestion.required && (
                <Badge variant="destructive" className="mb-4 text-xs">Required</Badge>
              )}
            </div>

            {renderQuestion(currentQuestion)}

            {currentQuestion.type === 'confidence_rating' && (
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional thoughts or context..."
                  value={currentResponse.notes || ''}
                  onChange={(e) => setCurrentResponse({...currentResponse, notes: e.target.value})}
                  rows={2}
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-6">
              <Button
                variant="outline"
                onClick={handlePreviousQuestion}
                disabled={currentProgress.currentQuestion === 0}
                data-testid="button-previous-question"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveResponse} data-testid="button-save-response">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                {currentProgress.currentQuestion < currentModule.questions.length - 1 ? (
                  <Button onClick={handleNextQuestion} data-testid="button-next-question">
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion} data-testid="button-complete-assessment">
                    <Send className="h-4 w-4 mr-2" />
                    Complete Assessment
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-8 w-8" />
            Self-Assessment Center
          </h2>
          <p className="text-muted-foreground">
            Optional self-assessments to help you prepare and build confidence
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-view-results">
            <Eye className="h-4 w-4 mr-2" />
            View Results
          </Button>
          <Button variant="outline" data-testid="button-reset-progress">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Progress
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {mockSelfAssessmentModules.map(module => {
          const progress = assessmentProgress.find(p => p.moduleId === module.id);
          const progressPercentage = getModuleProgress(module.id);
          
          return (
            <Card key={module.id} className="hover-elevate">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{module.title}</CardTitle>
                      <Badge variant="outline">{module.skillArea}</Badge>
                      {module.isOptional && (
                        <Badge variant="secondary">Optional</Badge>
                      )}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm text-muted-foreground">{module.estimatedTime} min</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  {progress && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={getStatusColor(progress.status)} className="text-xs">
                        {progress.status.replace('_', ' ')}
                      </Badge>
                      {progress.startedDate && (
                        <span>Started: {progress.startedDate}</span>
                      )}
                      {progress.completedDate && (
                        <span>Completed: {progress.completedDate}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Benefits:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {module.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <div className="text-sm text-muted-foreground">
                    {module.questions.length} questions • {module.questions.filter(q => q.required).length} required
                  </div>
                  <Button onClick={() => handleStartModule(module.id)} data-testid={`button-start-module-${module.id}`}>
                    {progress?.status === 'completed' ? 'Retake' : 
                     progress?.status === 'in_progress' ? 'Continue' : 'Start'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}