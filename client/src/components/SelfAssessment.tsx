import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { ClipboardCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { KnowledgeSelfAssessmentPanel, SelfScoreInput } from '@/components/SelfAssessmentPanel';
import type { User } from '@shared/schema';

// See server/routes.ts POST /api/assessments/:id/self-score.
const SELF_SCORE_ELIGIBLE_LEVEL_NAMES = ['Graduate Engineer', 'Engineer', 'Technical Authority'];

interface MyAssessmentRow {
  id: string;
  element_id: string;
  self_score: number | null;
  self_assessment_completed_at: string | null;
  self_assessment_score_percent: number | null;
  element: {
    name: string;
    selfAssessmentEnabled: boolean | null;
  };
}

// Populated with real data from the candidate's own assigned elements - an element shows up here
// if it has the knowledge quiz enabled (selfAssessmentEnabled) and/or the candidate is eligible
// for self-scoring (Graduate Engineer/Engineer/Technical Authority), matching what's shown on the
// same competence element's entry in My Assessments. Self-scoring isn't tied to the quiz toggle -
// candidates rate their own understanding regardless of whether a knowledge quiz exists.
export default function SelfAssessment() {
  const { user } = useAuth();
  const standardLevel = (user as (User & { standardLevel?: { id: string; name: string } | null }) | undefined)?.standardLevel;
  const selfScoreEligible = !!standardLevel && SELF_SCORE_ELIGIBLE_LEVEL_NAMES.includes(standardLevel.name);

  const { data: assessments = [], isLoading } = useQuery<MyAssessmentRow[]>({
    queryKey: ['/api/my-assessments'],
  });

  const selfAssessableElements = assessments.filter(a => a.element?.selfAssessmentEnabled || selfScoreEligible);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6" />
          Self Assessment
        </h1>
        <p className="text-muted-foreground">
          Take the knowledge self-assessment for any competence element that offers one, ahead of your real assessment.
          {selfScoreEligible && ' Rate your own understanding of each subject - your assessor will score you after the assessment, and this is compared against the target for your level.'}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : selfAssessableElements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No self-assessments are available yet.</p>
            <p className="text-sm">Self-assessment appears here once you have an assigned competence element with a knowledge quiz enabled, or once your proficiency level is eligible for self-scoring.</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {selfAssessableElements.map(a => (
            <AccordionItem key={a.id} value={a.id} className="border rounded px-4" data-testid={`self-assessment-element-${a.id}`}>
              <AccordionTrigger>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{a.element.name}</span>
                  {a.self_assessment_completed_at && (
                    <Badge variant="default">
                      Knowledge Quiz: {a.self_assessment_score_percent !== null ? `${a.self_assessment_score_percent}%` : 'Submitted'}
                    </Badge>
                  )}
                  {a.self_score && <Badge variant="secondary">Self-Score: {a.self_score}/4</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {selfScoreEligible && (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Self-Score</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SelfScoreInput assessmentId={a.id} currentSelfScore={a.self_score} />
                      </CardContent>
                    </Card>
                    {a.element?.selfAssessmentEnabled && <Separator className="my-4" />}
                  </>
                )}

                {a.element?.selfAssessmentEnabled && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Knowledge Self-Assessment</CardTitle>
                      <CardDescription>Answer these questions yourself - your answers and score are visible to your assessor.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <KnowledgeSelfAssessmentPanel assessmentId={a.id} />
                    </CardContent>
                  </Card>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
