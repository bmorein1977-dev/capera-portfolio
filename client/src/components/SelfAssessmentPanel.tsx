import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface KnowledgeQuestion {
  criteriaId: string;
  code: string;
  questionText: string;
  options: string[];
  correctAnswerIndex?: number;
  yourAnswer?: { selectedAnswerIndex: number; isCorrect: boolean };
}

interface KnowledgeSelfAssessmentResponse {
  elementName: string;
  completedAt: string | null;
  scorePercent: number | null;
  questions: KnowledgeQuestion[];
}

// The knowledge-question self-assessment quiz - shared between the Self Assessment page and the
// Assessment Details view on My Assessments, since both should show the same quiz for the same
// element (per the "appears in both places" spec). Candidates never see the correct-answer key up
// front - the server strips it for the candidate role and only echoes it back per-question once
// they've answered, alongside whether they got it right.
export function KnowledgeSelfAssessmentPanel({ assessmentId }: { assessmentId: string }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<KnowledgeSelfAssessmentResponse>({
    queryKey: ['/api/assessments', assessmentId, 'knowledge-self-assessment'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/assessments/${assessmentId}/knowledge-self-assessment`);
      return res.json();
    },
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (data?.questions) {
      const initial: Record<string, number> = {};
      data.questions.forEach(q => {
        if (q.yourAnswer) initial[q.criteriaId] = q.yourAnswer.selectedAnswerIndex;
      });
      setAnswers(initial);
    }
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        answers: Object.entries(answers).map(([criteriaId, selectedAnswerIndex]) => ({ criteriaId, selectedAnswerIndex })),
      };
      const res = await apiRequest('POST', `/api/assessments/${assessmentId}/knowledge-self-assessment`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assessments', assessmentId, 'knowledge-self-assessment'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-assessments'] });
      toast({ title: 'Self-Assessment Submitted', description: 'Your assessor has been notified.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to submit self-assessment', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }
  if (!data || data.questions.length === 0) {
    return <p className="text-sm text-muted-foreground">No self-assessment questions are available for this element yet.</p>;
  }

  const allAnswered = data.questions.every(q => answers[q.criteriaId] !== undefined);

  return (
    <div className="space-y-4" data-testid={`knowledge-self-assessment-${assessmentId}`}>
      {data.completedAt && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="default" data-testid={`badge-self-assessment-completed-${assessmentId}`}>Completed</Badge>
          <span>Score: {data.scorePercent}%</span>
        </div>
      )}
      {data.questions.map((q, i) => (
        <div key={q.criteriaId} className="border rounded p-3 space-y-2">
          <p className="text-sm font-medium">{i + 1}. {q.questionText}</p>
          <div className="space-y-1">
            {q.options.map((opt, oi) => {
              const isSelected = answers[q.criteriaId] === oi;
              return (
                <label key={oi} className={`flex items-center gap-2 text-sm p-1.5 rounded cursor-pointer ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                  <input
                    type="radio"
                    name={`q-${q.criteriaId}`}
                    checked={isSelected}
                    onChange={() => setAnswers(prev => ({ ...prev, [q.criteriaId]: oi }))}
                    data-testid={`radio-${q.criteriaId}-${oi}`}
                  />
                  <span className="flex-1">{opt}</span>
                  {isSelected && q.yourAnswer?.selectedAnswerIndex === oi && (
                    q.yourAnswer.isCorrect
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <Button
        onClick={() => submitMutation.mutate()}
        disabled={!allAnswered || submitMutation.isPending}
        data-testid={`button-submit-self-assessment-${assessmentId}`}
      >
        {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        {data.completedAt ? 'Resubmit Answers' : 'Submit Answers'}
      </Button>
    </div>
  );
}

// 1-4 self-rating, restricted server-side to Graduate Engineer/Engineer/Technical Authority levels
// (the caller should only render this for eligible candidates - see useAuth()'s standardLevel).
export function SelfScoreInput({ assessmentId, currentSelfScore }: { assessmentId: string; currentSelfScore: number | null }) {
  const { toast } = useToast();
  const [score, setScore] = useState<number | null>(currentSelfScore);

  const mutation = useMutation({
    mutationFn: async (selfScore: number) => apiRequest('POST', `/api/assessments/${assessmentId}/self-score`, { selfScore }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-assessments'] });
      toast({ title: 'Self-Score Saved' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to save self-score', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-2" data-testid={`self-score-${assessmentId}`}>
      <p className="text-sm font-medium">Rate your current understanding of this subject (1 = Novice, 4 = Expert)</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(n => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={score === n ? 'default' : 'outline'}
            onClick={() => setScore(n)}
            data-testid={`button-self-score-${assessmentId}-${n}`}
          >
            {n}
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        onClick={() => score && mutation.mutate(score)}
        disabled={!score || mutation.isPending || score === currentSelfScore}
        data-testid={`button-save-self-score-${assessmentId}`}
      >
        {mutation.isPending ? 'Saving...' : currentSelfScore ? 'Update Self-Score' : 'Save Self-Score'}
      </Button>
    </div>
  );
}
