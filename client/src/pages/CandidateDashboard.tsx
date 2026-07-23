import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  element?: { name: string };
}

// "Complete" covers current + expiring-soon (it was done, just needs renewal soon); "expired"
// and "not complete" (never done) are the two other outcomes a required item can be in.
const COMPLETE_STATUSES: ElementStatus[] = ['current', 'expiring_30', 'expiring_60', 'expiring_90'];

const REQUIREMENT_LEVELS = ['M', 'R', 'D'] as const;
const REQUIREMENT_LABELS: Record<string, string> = { M: 'Mandatory', R: 'Role Specific', D: 'Discretionary' };

interface BreakdownRow {
  level: string;
  label: string;
  total: number;
  complete: number;
  notComplete: number;
  expired: number;
  safetyCriticalTotal: number;
  safetyCriticalOutstanding: number;
}

function buildBreakdown<T>(
  items: T[],
  getLevel: (item: T) => string,
  getStatus: (item: T) => ElementStatus,
  isSafetyCritical: (item: T) => boolean
): BreakdownRow[] {
  return REQUIREMENT_LEVELS.map(level => {
    const levelItems = items.filter(i => (getLevel(i) || 'M') === level);
    const complete = levelItems.filter(i => COMPLETE_STATUSES.includes(getStatus(i))).length;
    const expired = levelItems.filter(i => getStatus(i) === 'expired').length;
    const notComplete = levelItems.filter(i => getStatus(i) === 'missing').length;
    const safetyCriticalItems = levelItems.filter(isSafetyCritical);
    const safetyCriticalOutstanding = safetyCriticalItems.filter(i => !COMPLETE_STATUSES.includes(getStatus(i))).length;
    return {
      level,
      label: REQUIREMENT_LABELS[level] || level,
      total: levelItems.length,
      complete,
      notComplete,
      expired,
      safetyCriticalTotal: safetyCriticalItems.length,
      safetyCriticalOutstanding,
    };
  }).filter(row => row.total > 0);
}

function BreakdownTable({ rows }: { rows: BreakdownRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No requirements found for your role</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={row.level} className="p-3 border rounded-lg" data-testid={`breakdown-row-${row.level}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{row.label}</span>
            <span className="text-xs text-muted-foreground">{row.total} total</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-green-600 text-white hover:bg-green-600 dark:bg-green-600">{row.complete} complete</Badge>
            {row.notComplete > 0 && (
              <Badge className="bg-orange-500 text-white hover:bg-orange-500 dark:bg-orange-500">{row.notComplete} not complete</Badge>
            )}
            {row.expired > 0 && (
              <Badge className="bg-red-600 text-white hover:bg-red-600 dark:bg-red-600">{row.expired} expired</Badge>
            )}
            {row.safetyCriticalTotal > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                {row.safetyCriticalOutstanding} of {row.safetyCriticalTotal} safety critical outstanding
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

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

  // Training breakdown, by Mandatory / Role Specific / Discretionary
  const trainingItems = trainingCompliance?.items ?? [];
  const trainingBreakdown = buildBreakdown(
    trainingItems,
    item => item.requirementLevel,
    item => item.status,
    item => item.members.some(m => m.training.isSafetyCritical)
  );
  const trainingComplete = trainingBreakdown.reduce((sum, r) => sum + r.complete, 0);

  // Competence breakdown, by Mandatory / Role Specific / Discretionary
  const competenceElements = skillsGap?.elements ?? [];
  const competenceBreakdown = buildBreakdown(
    competenceElements,
    e => e.requirementLevel,
    e => e.status,
    e => e.safetyCritical
  );
  const competenceComplete = competenceBreakdown.reduce((sum, r) => sum + r.complete, 0);
  const competenceTotal = skillsGap?.statistics.totalRequired ?? 0;

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
          <CardDescription>Required training courses for your role, by requirement level</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">{trainingComplete} of {trainingItems.length} training requirements complete</p>
          <BreakdownTable rows={trainingBreakdown} />
        </CardContent>
      </Card>

      <Card data-testid="card-competence-status">
        <CardHeader>
          <CardTitle>Competence Assessment Status</CardTitle>
          <CardDescription>Required competency elements for your role, by requirement level</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">{competenceComplete} of {competenceTotal} competency elements complete</p>
          <BreakdownTable rows={competenceBreakdown} />
        </CardContent>
      </Card>
    </div>
  );
}
