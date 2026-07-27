import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ShieldCheck, Clock, Users, MapPin, TrendingUp } from 'lucide-react';
import type { Element3KpiReport } from '@shared/schema';

// RAG status against a KPI's own target - "higher is better" is the default (currency, IV
// assurance, sampling compliance, succession); overdue ageing and closeout breaches are the
// opposite (lower is better), so callers pass invert:true for those.
function ragColor(value: number | null, greenAt: number, amberAt: number, invert = false) {
  if (value === null) return 'text-muted-foreground';
  const pass = invert ? value <= greenAt : value >= greenAt;
  const warn = invert ? value <= amberAt : value >= amberAt;
  if (pass) return 'text-green-600 dark:text-green-400';
  if (warn) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function ragBadge(label: string, color: string) {
  return <Badge variant="outline" className={color}>{label}</Badge>;
}

function StatTile({ label, value, target, color, sublabel }: { label: string; value: string; target?: string; color?: string; sublabel?: string }) {
  return (
    <div className="p-4 border rounded-lg" data-testid={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color || ''}`}>{value}</div>
      {sublabel && <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>}
      {target && <div className="text-xs text-muted-foreground mt-1">Target: {target}</div>}
    </div>
  );
}

export default function Element3KpiDashboard() {
  const { data: report, isLoading, error } = useQuery<Element3KpiReport>({
    queryKey: ['/api/reports/element3-kpi'],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load the Element 3 KPI report.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const outcomeTotal = report.outcomeDistribution.total || 1;
  const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0;

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6 max-w-6xl">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">EI PSM Element 3 KPIs</h1>
          <p className="text-muted-foreground">
            Employee selection, placement and competency - measures 3.2, 3.4, 3.5, 3.6 and 3.10, the ones owned by this department and reportable from Capera's data.
            Generated {new Date(report.generatedAt).toLocaleString()}.
          </p>
        </div>

        {/* PM 3.2 - Competence Currency & Closeout Timeliness */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> PM 3.2 - Competence Currency &amp; Closeout Timeliness</CardTitle>
            <CardDescription>KPI 3.2a: currency. KPI 3.2b/c: how long it takes to close out a reassessment once the prior cycle is due.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatTile
                label="Currency (3.2a)"
                value={`${report.currency.percentage}%`}
                sublabel={`${report.currency.validCount} of ${report.currency.totalInScope} required assessments valid`}
                target="100%"
                color={ragColor(report.currency.percentage, 100, 90)}
              />
              <StatTile
                label="Closeout before expiry (3.2b)"
                value={String(report.closeoutTimeliness.compliant.count)}
                sublabel={report.closeoutTimeliness.compliant.averageDaysFromAlert !== null
                  ? `avg ${report.closeoutTimeliness.compliant.averageDaysFromAlert} days from the 90-day alert`
                  : 'No renewals recorded yet'}
              />
              <StatTile
                label="Closeout after expiry - breach (3.2c)"
                value={String(report.closeoutTimeliness.breach.count)}
                sublabel={report.closeoutTimeliness.breach.averageDaysFromExpiry !== null
                  ? `avg ${report.closeoutTimeliness.breach.averageDaysFromExpiry} days from expiry, ${report.closeoutTimeliness.breach.over30Days} over the 30-day target`
                  : 'No renewals recorded yet'}
                target="≤30 days, 0 exceptions"
                color={report.closeoutTimeliness.breach.count > 0 ? ragColor(report.closeoutTimeliness.breach.over30Days, 0, 0, true) : undefined}
              />
            </div>
            {!report.closeoutTimeliness.trackingSince && (
              <p className="text-xs text-muted-foreground">
                3.2b/c only start counting from the point this tracking shipped - there's no way to reconstruct how long past reassessments took, since the prior cycle's expiry is overwritten in place when a new one is signed off. Figures above will build up from here.
              </p>
            )}
          </CardContent>
        </Card>

        {/* PM 3.5 - Overdue Assessment Ageing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> PM 3.5 - Overdue Assessment Ageing</CardTitle>
            <CardDescription>Target: 0% overdue by more than 1 month, at all times.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatTile
              label="Overdue < 1 month"
              value={String(report.overdueAgeing.under1Month.total)}
              sublabel={`${report.overdueAgeing.under1Month.safetyCritical} safety-critical, ${report.overdueAgeing.under1Month.nonSafetyCritical} not`}
            />
            <StatTile
              label="Overdue > 1 month"
              value={String(report.overdueAgeing.over1Month.total)}
              sublabel={`${report.overdueAgeing.over1Month.safetyCritical} safety-critical, ${report.overdueAgeing.over1Month.nonSafetyCritical} not`}
              target="0"
              color={ragColor(report.overdueAgeing.over1Month.total, 0, 0, true)}
            />
          </CardContent>
          {report.overdueAgeing.items.length > 0 && (
            <CardContent className="pt-0">
              <div className="text-sm font-medium mb-2">Longest outstanding</div>
              <div className="space-y-1">
                {report.overdueAgeing.items.slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0" data-testid={`row-overdue-${i}`}>
                    <span className="truncate">{item.candidateName} — {item.elementName}</span>
                    <span className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {item.safetyCritical && ragBadge('Safety Critical', 'text-red-600 dark:text-red-400')}
                      <span className="text-muted-foreground">{item.daysOverdue}d overdue</span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* PM 3.6 - Assessment Outcomes + Internal Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> PM 3.6 - Assessment Outcomes &amp; Internal Verification</CardTitle>
            <CardDescription>KPI 3.6a: outcomes this month. 3.6b: IV assurance. 3.6c: quarterly sampling compliance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-sm font-medium mb-2">Outcome distribution (3.6a) — this month, {report.outcomeDistribution.total} signed off</div>
              {outcomeTotal > 0 ? (
                <div className="flex h-6 rounded overflow-hidden border">
                  <div className="bg-green-500" style={{ width: `${pct(report.outcomeDistribution.competent, outcomeTotal)}%` }} title="Competent" />
                  <div className="bg-yellow-500" style={{ width: `${pct(report.outcomeDistribution.competentWithMinorNeeds, outcomeTotal)}%` }} title="Competent with minor training needs" />
                  <div className="bg-red-500" style={{ width: `${pct(report.outcomeDistribution.notYetCompetent, outcomeTotal)}%` }} title="Not Yet Competent" />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No assessments signed off this month yet.</div>
              )}
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Competent ({report.outcomeDistribution.competent})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Minor needs ({report.outcomeDistribution.competentWithMinorNeeds})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Not Yet Competent ({report.outcomeDistribution.notYetCompetent})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatTile
                label="IV assurance (3.6b)"
                value={report.ivAssurance.percentage !== null ? `${report.ivAssurance.percentage}%` : '—'}
                sublabel={`${report.ivAssurance.accepted} accepted, ${report.ivAssurance.discrepancy} discrepancy, ${report.ivAssurance.total} total`}
                target="~100%"
                color={ragColor(report.ivAssurance.percentage, 100, 90)}
              />
              <StatTile
                label="Sampling compliance (3.6c)"
                value={report.samplingCompliance.overallPercentage !== null ? `${report.samplingCompliance.overallPercentage}%` : '—'}
                sublabel={`${report.samplingCompliance.pairsCompliant} of ${report.samplingCompliance.pairsTotal} verifier/assessor pairs met quota this quarter`}
                target="100%"
                color={ragColor(report.samplingCompliance.overallPercentage, 100, 90)}
              />
            </div>
          </CardContent>
        </Card>

        {/* PM 3.4 - Succession */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> PM 3.4 - Succession Plan Currency &amp; Depth</CardTitle>
            <CardDescription>Not this department's ownership per the framework doc - included for reference since Capera already tracks it.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatTile
              label="Plan currency (3.4a)"
              value={report.succession.currencyPercentage !== null ? `${report.succession.currencyPercentage}%` : '—'}
              sublabel="Updated within the last 6 months"
              target="100%"
              color={ragColor(report.succession.currencyPercentage, 100, 90)}
            />
            <StatTile
              label="Succession depth (3.4b)"
              value={report.succession.depthPercentage !== null ? `${report.succession.depthPercentage}%` : '—'}
              sublabel="≥2 successors, each with a dated development plan"
              target="100%"
              color={ragColor(report.succession.depthPercentage, 100, 90)}
            />
          </CardContent>
        </Card>

        {/* PM 3.10 - Coverage Gaps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> PM 3.10 - Competence Coverage Gaps</CardTitle>
            <CardDescription>
              Gap detection only - no team/shift currently has a valid holder of a required safety-critical element.
              The SARA/ORA risk-assessment-completed half of this KPI isn't tracked anywhere yet (flagged as out of scope for this round).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatTile label="Open coverage gaps" value={String(report.coverageGaps.totalGaps)} />
            {report.coverageGaps.gaps.length > 0 && (
              <div className="space-y-1 mt-4">
                {report.coverageGaps.gaps.map((gap, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0" data-testid={`row-gap-${i}`}>
                    <span>{gap.location || 'Unknown location'} / {gap.teamShift || 'Unknown team'} — {gap.elementName}</span>
                    <span className="text-muted-foreground">{gap.membersChecked} on team</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
