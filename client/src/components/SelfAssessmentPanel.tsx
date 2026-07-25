import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface KnowledgeQuestion {
  criteriaId: string;
  code: string;
  questionText: string;
  /** Present for MCQ questions (a structured answer key exists); absent for open-ended ones. */
  options?: string[];
  correctAnswerIndex?: number;
  yourAnswer?: { selectedAnswerIndex?: number; answerText?: string; isCorrect: boolean | null };
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
// they've answered, alongside whether they got it right. Questions without a structured answer
// key (open-ended) get a free-text box instead of options - those aren't auto-graded, the
// assessor reads the answer text directly.
export function KnowledgeSelfAssessmentPanel({ assessmentId }: { assessmentId: string }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<KnowledgeSelfAssessmentResponse>({
    queryKey: ['/api/assessments', assessmentId, 'knowledge-self-assessment'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/assessments/${assessmentId}/knowledge-self-assessment`);
      return res.json();
    },
  });

  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data?.questions) {
      const initialMcq: Record<string, number> = {};
      const initialText: Record<string, string> = {};
      data.questions.forEach(q => {
        if (q.yourAnswer?.selectedAnswerIndex !== undefined) initialMcq[q.criteriaId] = q.yourAnswer.selectedAnswerIndex;
        if (q.yourAnswer?.answerText) initialText[q.criteriaId] = q.yourAnswer.answerText;
      });
      setMcqAnswers(initialMcq);
      setTextAnswers(initialText);
    }
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const answers = (data?.questions || []).map(q => {
        if (q.options) return { criteriaId: q.criteriaId, selectedAnswerIndex: mcqAnswers[q.criteriaId] };
        return { criteriaId: q.criteriaId, answerText: textAnswers[q.criteriaId] };
      }).filter(a => a.selectedAnswerIndex !== undefined || (a.answerText && a.answerText.trim()));
      const res = await apiRequest('POST', `/api/assessments/${assessmentId}/knowledge-self-assessment`, { answers });
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

  const allAnswered = data.questions.every(q =>
    q.options ? mcqAnswers[q.criteriaId] !== undefined : !!textAnswers[q.criteriaId]?.trim()
  );

  return (
    <div className="space-y-4" data-testid={`knowledge-self-assessment-${assessmentId}`}>
      {data.completedAt && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="default" data-testid={`badge-self-assessment-completed-${assessmentId}`}>Completed</Badge>
          <span>{data.scorePercent !== null ? `Score: ${data.scorePercent}%` : 'Awaiting assessor review of open-ended answers'}</span>
        </div>
      )}
      {data.questions.map((q, i) => (
        <div key={q.criteriaId} className="border rounded p-3 space-y-2">
          <p className="text-sm font-medium">{i + 1}. {q.questionText}</p>
          {q.options ? (
            <div className="space-y-1">
              {q.options.map((opt, oi) => {
                const isSelected = mcqAnswers[q.criteriaId] === oi;
                return (
                  <label key={oi} className={`flex items-center gap-2 text-sm p-1.5 rounded cursor-pointer ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                    <input
                      type="radio"
                      name={`q-${q.criteriaId}`}
                      checked={isSelected}
                      onChange={() => setMcqAnswers(prev => ({ ...prev, [q.criteriaId]: oi }))}
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
          ) : (
            <div className="space-y-1">
              <Label htmlFor={`answer-${q.criteriaId}`} className="text-xs text-muted-foreground">Answer:</Label>
              <Textarea
                id={`answer-${q.criteriaId}`}
                value={textAnswers[q.criteriaId] || ''}
                onChange={(e) => setTextAnswers(prev => ({ ...prev, [q.criteriaId]: e.target.value }))}
                placeholder="Type your answer..."
                rows={3}
                data-testid={`textarea-answer-${q.criteriaId}`}
              />
              {q.yourAnswer?.answerText && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Submitted - pending assessor review
                </p>
              )}
            </div>
          )}
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
