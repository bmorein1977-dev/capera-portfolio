import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, ShieldCheck, Award, Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import type { SkillsGapAnalysis, TrainingComplianceAnalysis, ElementStatus } from '@shared/schema';

interface MyAssessmentRow {
  id: string;
  outcome: string;
  planned_assessment_date: string | null;
  planned_assessment_location: string | null;
  planned_assessment_notes: string | null;
  candidate_ready_at: string | null;
  element?: { name: string; safetyCriticality?: string | null };
}

// "Complete" covers current + expiring-soon (it was done, just needs renewal soon); "expired"
// and "not complete" (never done) are the two other outcomes a required item can be in.
const COMPLETE_STATUSES: ElementStatus[] = ['current', 'expiring_30', 'expiring_60', 'expiring_90'];

export default function CandidateDashboard() {
  const { user } = useAuth();

  const { data: skillsGap, isLoading: skillsGapLoading } = useQuery<SkillsGapAnalysis>({
    queryKey: [`/api/users/${user?.id}/skills-gap`],
    enabled: !!user?.id,
  });

  const { data: trainingCompliance, isLoading: trainingLoading } = useQuery<TrainingComplianceAnalysis>({
    queryKey: [`/api/users/${user?.id}/training-compliance`],
    enabled: !!user?.id,
  });

  const { data: myAssessments = [], isLoading: assessmentsLoading } = useQuery<MyAssessmentRow[]>({
    queryKey: ['/api/my-assessments'],
    enabled: !!user?.id,
  });

  const isLoading = skillsGapLoading || trainingLoading || assessmentsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  // Training breakdown
  const trainingComplete = trainingCompliance
    ? trainingCompliance.statistics.current + trainingCompliance.statistics.expiringSoon30 + trainingCompliance.statistics.expiringSoon60 + trainingCompliance.statistics.expiringSoon90
    : 0;
  const trainingExpired = trainingCompliance?.statistics.expired ?? 0;
  const trainingNotComplete = trainingCompliance?.statistics.missing ?? 0;

  const safetyCriticalTrainingItems = (trainingCompliance?.items ?? []).filter(item =>
    item.members.some(m => m.training.isSafetyCritical)
  );
  const safetyTrainingComplete = safetyCriticalTrainingItems.filter(item => COMPLETE_STATUSES.includes(item.status)).length;
  const safetyTrainingOutstanding = safetyCriticalTrainingItems.length - safetyTrainingComplete;

  // Competence breakdown
  const competenceComplete = skillsGap
    ? skillsGap.statistics.current + skillsGap.statistics.expiringSoon30 + skillsGap.statistics.expiringSoon60 + skillsGap.statistics.expiringSoon90
    : 0;
  const competenceTotal = skillsGap?.statistics.totalRequired ?? 0;

  const safetyCriticalElements = (skillsGap?.elements ?? []).filter(e => e.element.safetyCriticality === 'High');
  const nonSafetyCriticalElements = (skillsGap?.elements ?? []).filter(e => e.element.safetyCriticality !== 'High');
  const safetyCompetenceComplete = safetyCriticalElements.filter(e => COMPLETE_STATUSES.includes(e.status)).length;
  const nonSafetyCompetenceComplete = nonSafetyCriticalElements.filter(e => COMPLETE_STATUSES.includes(e.status)).length;

  // Assessments planned/complete
  const assessmentsComplete = myAssessments.filter(a => a.outcome === 'competent').length;
  const assessmentsPlanned = myAssessments.filter(a => a.outcome !== 'competent' && a.planned_assessment_date);
  const upcomingAssessments = [...assessmentsPlanned].sort(
    (a, b) => new Date(a.planned_assessment_date!).getTime() - new Date(b.planned_assessment_date!).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-8 w-8" />
          My Dashboard
        </h2>
        <p className="text-muted-foreground">Your training, competence and assessment status</p>
      </div>

      {upcomingAssessments.length > 0 && (
        <Card className="border-blue-300 dark:border-blue-800" data-testid="card-upcoming-assessments">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Scheduled Assessment{upcomingAssessments.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAssessments.map(a => (
              <div key={a.id} className="p-3 border rounded-lg" data-testid={`upcoming-assessment-${a.id}`}>
                <div className="font-medium">{a.element?.name || 'Assessment'}</div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(a.planned_assessment_date!), 'PPP p')}
                  </span>
                  {a.planned_assessment_location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {a.planned_assessment_location}
                    </span>
                  )}
                </div>
                {a.planned_assessment_notes && (
                  <p className="text-sm italic mt-1">Assessor's notes: "{a.planned_assessment_notes}"</p>
                )}
              </div>
            ))}
            <Link href="/my-assessments">
              <Button variant="outline" size="sm" data-testid="button-view-my-assessments">
                View My Assessments
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-assessments-complete">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Assessments Complete</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{assessmentsComplete}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-assessments-planned">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Calendar className="h-4 w-4" />Assessments Planned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{assessmentsPlanned.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-competence-coverage">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Award className="h-4 w-4" />Competence Coverage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{skillsGap?.statistics.coveragePercentage ?? 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">{competenceComplete} of {competenceTotal} elements</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-training-status">
        <CardHeader>
          <CardTitle>Overall Training Status</CardTitle>
          <CardDescription>Required training courses for your role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{trainingComplete}</div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{trainingNotComplete}</div>
              <div className="text-xs text-muted-foreground">Not Complete</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{trainingExpired}</div>
              <div className="text-xs text-muted-foreground">Expired</div>
            </div>
          </div>
          <Progress value={trainingCompliance?.statistics.coveragePercentage ?? 0} className="h-2" />

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Safety Critical Training
            </span>
            <span>
              <Badge className="bg-green-600 text-white hover:bg-green-600 dark:bg-green-600 mr-2">{safetyTrainingComplete} complete</Badge>
              {safetyTrainingOutstanding > 0 && (
                <Badge className="bg-red-600 text-white hover:bg-red-600 dark:bg-red-600">{safetyTrainingOutstanding} outstanding</Badge>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-competence-status">
        <CardHeader>
          <CardTitle>Competence Assessment Status</CardTitle>
          <CardDescription>Required competency elements for your role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-red-600" />
              Safety Critical
            </span>
            <span className="text-sm text-muted-foreground">{safetyCompetenceComplete} of {safetyCriticalElements.length} complete</span>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <span className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Non-Safety Critical
            </span>
            <span className="text-sm text-muted-foreground">{nonSafetyCompetenceComplete} of {nonSafetyCriticalElements.length} complete</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
