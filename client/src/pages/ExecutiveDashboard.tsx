import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { useAuth, roleLabels } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle, Users, ShieldCheck, GraduationCap, Clock, TrendingUp, MapPin,
  ArrowRight, ClipboardCheck, CalendarClock, CheckCircle2, HelpCircle, SlidersHorizontal, Download,
} from 'lucide-react';
import type { ComplianceOverview } from '@shared/schema';
import type { UserRole } from '@shared/schema';

// Same RAG convention as Element3KpiDashboard.tsx - green/amber/red against a KPI's own target,
// "higher is better" by default (invert:true flips it for ageing/overdue-style measures).
function ragColor(value: number | null, greenAt: number, amberAt: number, invert = false) {
  if (value === null) return 'text-muted-foreground';
  const pass = invert ? value <= greenAt : value >= greenAt;
  const warn = invert ? value <= amberAt : value >= amberAt;
  if (pass) return 'text-green-600 dark:text-green-400';
  if (warn) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function StatTile({ label, value, sublabel, color, icon: Icon }: { label: string; value: string; sublabel?: string; color?: string; icon?: typeof Users }) {
  return (
    <div className="p-4 border rounded-lg" data-testid={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className={`text-3xl font-bold mt-1 ${color || ''}`}>{value}</div>
      {sublabel && <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>}
    </div>
  );
}

// Status colors are reserved for state (current/expiring/expired/missing) and never reused for
// the categorical Training-vs-Competence series below - matches the outcome-distribution bar
// already established in Element3KpiDashboard.tsx.
const STATUS_COLORS = {
  current: 'hsl(142 76% 34%)',
  expiring: 'hsl(38 92% 45%)',
  expired: 'hsl(0 84% 55%)',
  missing: 'hsl(220 8% 60%)',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      {label && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{typeof p.value === 'number' ? `${p.value}%` : p.value}</span>
        </div>
      ))}
    </div>
  );
}

const QUICK_LINKS: Array<{ title: string; description: string; url: string; icon: typeof ShieldCheck; roles: UserRole[] }> = [
  { title: 'Compliance Explorer', description: 'Filter by location, job role, team, shift, employment type', url: '/compliance-explorer', icon: SlidersHorizontal, roles: ['developer', 'super_admin', 'admin', 'manager'] },
  { title: 'Internal Verification', description: 'Quota-aware verification queue and sampling plans', url: '/verifier-dashboard', icon: ShieldCheck, roles: ['developer', 'super_admin', 'admin', 'manager'] },
  { title: 'Team Compliance Matrix', description: 'Live competence and training compliance by team', url: '/team-compliance', icon: MapPin, roles: ['developer', 'super_admin', 'admin', 'manager'] },
  { title: 'EI PSM Element 3 KPIs', description: 'Energy Institute process safety KPI reporting', url: '/reports/element3-kpi', icon: TrendingUp, roles: ['developer', 'super_admin', 'admin', 'manager'] },
  { title: 'User Management', description: 'Manage users, roles, and allocations', url: '/admin/users', icon: Users, roles: ['developer', 'super_admin', 'admin'] },
  { title: 'Training Manager', description: 'Providers, venues, courses, sessions and bookings', url: '/admin/training-manager', icon: GraduationCap, roles: ['developer', 'super_admin', 'admin'] },
];

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const role = user?.role as UserRole | undefined;

  const { data: overview, isLoading, error } = useQuery<ComplianceOverview>({
    queryKey: ['/api/reports/compliance-overview'],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="p-6">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load the executive dashboard.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const links = QUICK_LINKS.filter(l => role && l.roles.includes(role));

  const statusChartData = [
    {
      name: 'Competence',
      Current: overview.statusBreakdown.competence.current,
      Expiring: overview.statusBreakdown.competence.expiring,
      Expired: overview.statusBreakdown.competence.expired,
      Missing: overview.statusBreakdown.competence.missing,
    },
    {
      name: 'Training',
      Current: overview.statusBreakdown.training.current,
      Expiring: overview.statusBreakdown.training.expiring,
      Expired: overview.statusBreakdown.training.expired,
      Missing: overview.statusBreakdown.training.missing,
    },
  ];

  // Top 8 job roles by headcount - groupPerformance can be long in a full org, and a bar chart
  // with dozens of categories stops being readable. The Compliance Explorer's job-role filter
  // covers the rest; nothing here is hidden data, just a display cap.
  const topGroups = [...overview.groupPerformance].sort((a, b) => b.headcount - a.headcount).slice(0, 8);
  const groupChartData = topGroups.map(g => ({
    name: g.groupLabel.length > 22 ? `${g.groupLabel.slice(0, 21)}…` : g.groupLabel,
    fullName: g.groupLabel,
    'Training %': g.trainingPercentage,
    'Competence %': g.competencePercentage,
    headcount: g.headcount,
  }));
  const truncatedGroupCount = overview.groupPerformance.length - topGroups.length;

  const hasNoInScopePopulation = overview.headcount === 0;

  const handleExport = () => {
    const summaryRows = [
      { Metric: 'Generated At', Value: new Date(overview.generatedAt).toLocaleString() },
      { Metric: 'In-scope Headcount', Value: overview.headcount },
      { Metric: 'Training Compliance %', Value: overview.trainingCompliance.percentage },
      { Metric: 'Training Requirements Current / Total', Value: `${overview.trainingCompliance.current} / ${overview.trainingCompliance.total}` },
      { Metric: 'Competence Compliance %', Value: overview.competenceCompliance.percentage },
      { Metric: 'Competence Requirements Current / Total', Value: `${overview.competenceCompliance.current} / ${overview.competenceCompliance.total}` },
      { Metric: 'Safety-Critical Training %', Value: overview.safetyCriticalTraining.percentage },
      { Metric: 'Safety-Critical Training Current / Total', Value: `${overview.safetyCriticalTraining.current} / ${overview.safetyCriticalTraining.total}` },
      { Metric: 'Safety-Critical Competence %', Value: overview.safetyCriticalCompetence.percentage },
      { Metric: 'Safety-Critical Competence Current / Total', Value: `${overview.safetyCriticalCompetence.current} / ${overview.safetyCriticalCompetence.total}` },
      { Metric: 'Expiring ≤30 Days', Value: overview.expiringCertifications.in30Days },
      { Metric: 'Expiring ≤60 Days', Value: overview.expiringCertifications.in60Days },
      { Metric: 'Expiring ≤90 Days', Value: overview.expiringCertifications.in90Days },
      { Metric: 'Expired', Value: overview.expiringCertifications.expired },
      { Metric: 'Assessments Assigned', Value: overview.assessmentsOverview.assigned },
      { Metric: 'Assessments Scheduled', Value: overview.assessmentsOverview.scheduled },
      { Metric: 'Assessments Overdue', Value: overview.assessmentsOverview.overdue },
      { Metric: 'Assessments Complete', Value: overview.assessmentsOverview.complete },
    ];
    const roleRows = overview.groupPerformance.map(g => ({
      'Job Role': g.groupLabel,
      'Headcount': g.headcount,
      'Training %': g.trainingPercentage,
      'Competence %': g.competencePercentage,
    }));

    const workbook = XLSX.utils.book_new();
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    summaryWs['!cols'] = [{ wch: 42 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, summaryWs, 'Summary');

    const roleWs = XLSX.utils.json_to_sheet(roleRows);
    roleWs['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, roleWs, 'By Job Role');

    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    XLSX.writeFile(workbook, `Executive_Dashboard_Export_${timestamp}.xlsx`);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6 max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              Executive Dashboard
            </h1>
            <p className="text-muted-foreground">
              {role ? roleLabels[role] : ''} · Organisation-wide competence and training compliance. Generated {new Date(overview.generatedAt).toLocaleString()}.
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} className="flex-shrink-0" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>

        {hasNoInScopePopulation && (
          <Alert data-testid="alert-no-population">
            <HelpCircle className="h-4 w-4" />
            <AlertDescription>
              No active users with a job role assigned yet - the figures below will populate once the workforce is loaded in.
            </AlertDescription>
          </Alert>
        )}

        {/* Headline KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatTile label="In-scope headcount" value={String(overview.headcount)} icon={Users} />
          <StatTile
            label="Training compliance"
            value={`${overview.trainingCompliance.percentage}%`}
            sublabel={`${overview.trainingCompliance.current} of ${overview.trainingCompliance.total} requirements current`}
            color={ragColor(overview.trainingCompliance.total > 0 ? overview.trainingCompliance.percentage : null, 90, 75)}
            icon={GraduationCap}
          />
          <StatTile
            label="Competence compliance"
            value={`${overview.competenceCompliance.percentage}%`}
            sublabel={`${overview.competenceCompliance.current} of ${overview.competenceCompliance.total} requirements current`}
            color={ragColor(overview.competenceCompliance.total > 0 ? overview.competenceCompliance.percentage : null, 90, 75)}
            icon={ClipboardCheck}
          />
          <StatTile
            label="Safety-critical training"
            value={`${overview.safetyCriticalTraining.percentage}%`}
            sublabel={`${overview.safetyCriticalTraining.current} of ${overview.safetyCriticalTraining.total} current`}
            color={ragColor(overview.safetyCriticalTraining.total > 0 ? overview.safetyCriticalTraining.percentage : null, 95, 85)}
            icon={ShieldCheck}
          />
          <StatTile
            label="Safety-critical competence"
            value={`${overview.safetyCriticalCompetence.percentage}%`}
            sublabel={`${overview.safetyCriticalCompetence.current} of ${overview.safetyCriticalCompetence.total} current`}
            color={ragColor(overview.safetyCriticalCompetence.total > 0 ? overview.safetyCriticalCompetence.percentage : null, 95, 85)}
            icon={ShieldCheck}
          />
        </div>

        {/* Expiring certifications + assessments overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Expiring certifications</CardTitle>
              <CardDescription>Competence and training combined</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-3">
              <StatTile label="≤30 days" value={String(overview.expiringCertifications.in30Days)} color={overview.expiringCertifications.in30Days > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
              <StatTile label="≤60 days" value={String(overview.expiringCertifications.in60Days)} color={overview.expiringCertifications.in60Days > 0 ? 'text-yellow-600 dark:text-yellow-400' : undefined} />
              <StatTile label="≤90 days" value={String(overview.expiringCertifications.in90Days)} />
              <StatTile label="Expired" value={String(overview.expiringCertifications.expired)} color={overview.expiringCertifications.expired > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" /> Assessments overview</CardTitle>
              <CardDescription>All active assessment/assignment records</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-3">
              <StatTile label="Assigned" value={String(overview.assessmentsOverview.assigned)} />
              <StatTile label="Scheduled" value={String(overview.assessmentsOverview.scheduled)} />
              <StatTile label="Overdue" value={String(overview.assessmentsOverview.overdue)} color={overview.assessmentsOverview.overdue > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
              <StatTile label="Complete" value={String(overview.assessmentsOverview.complete)} icon={CheckCircle2} />
            </CardContent>
          </Card>
        </div>

        {/* Status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Compliance status breakdown</CardTitle>
            <CardDescription>Every required competence element and training item, by current status</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.competenceCompliance.total + overview.trainingCompliance.total > 0 ? (
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer>
                  <BarChart data={statusChartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }} barSize={28}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Current" stackId="status" fill={STATUS_COLORS.current} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Expiring" stackId="status" fill={STATUS_COLORS.expiring} />
                    <Bar dataKey="Expired" stackId="status" fill={STATUS_COLORS.expired} />
                    <Bar dataKey="Missing" stackId="status" fill={STATUS_COLORS.missing} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4">No in-scope requirements to report on yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Group performance by job role */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Compliance by job role</CardTitle>
            <CardDescription>
              {truncatedGroupCount > 0
                ? `Top 8 roles by headcount, of ${overview.groupPerformance.length} total - use the Compliance Explorer to see the rest`
                : 'Training and competence compliance for every job role represented'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groupChartData.length > 0 ? (
              <div style={{ width: '100%', height: Math.max(180, groupChartData.length * 44) }}>
                <ResponsiveContainer>
                  <BarChart data={groupChartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }} barGap={4}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={150} />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
                            <div className="font-medium mb-1">{d?.fullName}</div>
                            <div className="text-xs text-muted-foreground mb-1">{d?.headcount} people</div>
                            {payload.map((p: any, i: number) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: p.color || p.fill }} />
                                <span className="text-muted-foreground">{p.name}:</span>
                                <span className="font-medium">{p.value}%</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Training %" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Competence %" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4">No job roles with in-scope headcount yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Drill-down / quick links */}
        {links.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Drill down</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {links.map((link) => (
                <Link key={link.url} href={link.url}>
                  <Card className="cursor-pointer hover-elevate active-elevate-2" data-testid={`card-link-${link.url.replace(/\//g, '-')}`}>
                    <CardHeader>
                      <link.icon className="h-8 w-8 text-primary mb-2" />
                      <CardTitle className="flex items-center justify-between text-base">
                        {link.title}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </CardTitle>
                      <CardDescription>{link.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
