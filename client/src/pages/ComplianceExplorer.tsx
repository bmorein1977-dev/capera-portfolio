import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, SlidersHorizontal, Download, Snowflake } from 'lucide-react';
import { useComplianceFilters, ComplianceFilterBar } from '@/components/ComplianceFilterBar';
import type { ComplianceExplorerResult } from '@shared/schema';

function pctColor(value: number, total: number) {
  if (total === 0) return 'text-muted-foreground';
  if (value >= 90) return 'text-green-600 dark:text-green-400';
  if (value >= 75) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scPercentage(current: number, total: number): number {
  return total > 0 ? Math.round((current / total) * 1000) / 10 : 0;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      {label && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

export default function ComplianceExplorer() {
  const filterState = useComplianceFilters();

  const { data: result, isLoading, error } = useQuery<ComplianceExplorerResult>({
    queryKey: ['/api/reports/compliance-explorer', filterState.filters],
  });

  const groupChartData = useMemo(() => {
    if (!result) return [];
    return [...result.byTeamShift]
      .sort((a, b) => b.headcount - a.headcount)
      .slice(0, 12)
      .map(g => {
        const name = `${g.location || 'Unknown'} / ${g.teamShift || 'Unassigned'}`;
        return {
          name: name.length > 28 ? `${name.slice(0, 27)}…` : name,
          fullName: name,
          'Training %': g.trainingPercentage,
          'Competence %': g.competencePercentage,
          headcount: g.headcount,
        };
      });
  }, [result]);
  const truncatedGroups = (result?.byTeamShift.length || 0) - groupChartData.length;

  const handleExport = () => {
    if (!result) return;

    const peopleRows = result.people.map(p => ({
      'Name': p.name,
      'Email': p.email || '',
      'Job Role': p.jobRoleName || '',
      'Secondary Job Role': p.secondaryJobRoleName || '',
      'Location': p.location || '',
      'Team / Shift': p.teamShift || '',
      'Employment Type': p.employmentType || '',
      'Contract Company': p.contractCompanyName || '',
      'Overall Competence %': p.competence.total > 0 ? p.competence.percentage : '',
      'Competence Current': p.competence.current,
      'Competence Total': p.competence.total,
      'Safety-Critical Competence %': p.competence.safetyCriticalTotal > 0 ? scPercentage(p.competence.safetyCriticalCurrent, p.competence.safetyCriticalTotal) : '',
      'Safety-Critical Competence Current': p.competence.safetyCriticalCurrent,
      'Safety-Critical Competence Total': p.competence.safetyCriticalTotal,
      'Overall Training %': p.training.total > 0 ? p.training.percentage : '',
      'Training Current': p.training.current,
      'Training Total': p.training.total,
      'Safety-Critical Training %': p.training.safetyCriticalTotal > 0 ? scPercentage(p.training.safetyCriticalCurrent, p.training.safetyCriticalTotal) : '',
      'Safety-Critical Training Current': p.training.safetyCriticalCurrent,
      'Safety-Critical Training Total': p.training.safetyCriticalTotal,
    }));
    const groupRows = result.byTeamShift.map(g => ({
      'Location': g.location || '',
      'Team / Shift': g.teamShift || '',
      'Headcount': g.headcount,
      'Training %': g.trainingPercentage,
      'Competence %': g.competencePercentage,
    }));

    const workbook = XLSX.utils.book_new();
    const peopleWs = XLSX.utils.json_to_sheet(peopleRows);
    peopleWs['!cols'] = [
      { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
      { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(workbook, peopleWs, 'People');

    const groupWs = XLSX.utils.json_to_sheet(groupRows);
    groupWs['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, groupWs, 'By Team-Shift');

    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    XLSX.writeFile(workbook, `Compliance_Explorer_Export_${timestamp}.xlsx`);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6 max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <SlidersHorizontal className="h-7 w-7" /> Compliance Explorer
            </h1>
            <p className="text-muted-foreground">
              Filter the workforce by location, job role, team/shift, employment type and contract company, or search and select specific people, to see training and competence compliance for exactly the group you need.
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!result} className="flex-shrink-0" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>

        <ComplianceFilterBar state={filterState} />

        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-64" />
          </div>
        )}

        {error && !isLoading && (
          <Alert variant="destructive" data-testid="alert-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load compliance data for this filter combination.</AlertDescription>
          </Alert>
        )}

        {result && !isLoading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 border rounded-lg" data-testid="stat-matched">
                <div className="text-sm text-muted-foreground">People matched</div>
                <div className="text-3xl font-bold mt-1">{result.totalMatched}</div>
              </div>
              <div className="p-4 border rounded-lg" data-testid="stat-training">
                <div className="text-sm text-muted-foreground">Training compliance</div>
                <div className={`text-3xl font-bold mt-1 ${pctColor(result.summary.trainingPercentage, result.totalMatched)}`}>{result.summary.trainingPercentage}%</div>
              </div>
              <div className="p-4 border rounded-lg" data-testid="stat-competence">
                <div className="text-sm text-muted-foreground">Competence compliance</div>
                <div className={`text-3xl font-bold mt-1 ${pctColor(result.summary.competencePercentage, result.totalMatched)}`}>{result.summary.competencePercentage}%</div>
              </div>
              <div className="p-4 border rounded-lg" data-testid="stat-sc-training">
                <div className="text-sm text-muted-foreground">Safety-critical training</div>
                <div className={`text-3xl font-bold mt-1 ${pctColor(result.summary.safetyCriticalTrainingPercentage, result.totalMatched)}`}>{result.summary.safetyCriticalTrainingPercentage}%</div>
              </div>
              <div className="p-4 border rounded-lg" data-testid="stat-sc-competence">
                <div className="text-sm text-muted-foreground">Safety-critical competence</div>
                <div className={`text-3xl font-bold mt-1 ${pctColor(result.summary.safetyCriticalCompetencePercentage, result.totalMatched)}`}>{result.summary.safetyCriticalCompetencePercentage}%</div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compliance by team / shift</CardTitle>
                <CardDescription>
                  {truncatedGroups > 0
                    ? `Top 12 groups by headcount, of ${result.byTeamShift.length} total`
                    : 'Every location/team-shift group matching the current filters'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {groupChartData.length > 0 ? (
                  <div style={{ width: '100%', height: Math.max(180, groupChartData.length * 40) }}>
                    <ResponsiveContainer>
                      <BarChart data={groupChartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }} barGap={4}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={170} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Training %" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Competence %" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-4">No people match the current filters.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">People ({result.people.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[600px] overflow-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Job role</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Team / shift</TableHead>
                        <TableHead>Employment</TableHead>
                        <TableHead className="text-right">Overall Competence</TableHead>
                        <TableHead className="text-right">Safety-Critical Competence</TableHead>
                        <TableHead className="text-right">Overall Training</TableHead>
                        <TableHead className="text-right">Safety-Critical Training</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.people.map(p => {
                        const compScPct = scPercentage(p.competence.safetyCriticalCurrent, p.competence.safetyCriticalTotal);
                        const trainScPct = scPercentage(p.training.safetyCriticalCurrent, p.training.safetyCriticalTotal);
                        return (
                          <TableRow key={p.userId} data-testid={`row-person-${p.userId}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1.5">
                                {p.name}
                                {p.onLeave && (
                                  <Badge variant="outline" className="gap-1 text-blue-600 dark:text-blue-400 text-xs" data-testid={`badge-on-leave-${p.userId}`}>
                                    <Snowflake className="h-3 w-3" /> On Leave
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{p.jobRoleName || '—'}</TableCell>
                            <TableCell>{p.location || '—'}</TableCell>
                            <TableCell>{p.teamShift || '—'}</TableCell>
                            <TableCell className="capitalize">{p.employmentType || '—'}{p.contractCompanyName ? ` · ${p.contractCompanyName}` : ''}</TableCell>
                            <TableCell className={`text-right font-medium ${pctColor(p.competence.percentage, p.competence.total)}`}>
                              {p.competence.total > 0 ? `${p.competence.percentage}%` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${pctColor(compScPct, p.competence.safetyCriticalTotal)}`}>
                              {p.competence.safetyCriticalTotal > 0 ? `${compScPct}%` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${pctColor(p.training.percentage, p.training.total)}`}>
                              {p.training.total > 0 ? `${p.training.percentage}%` : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${pctColor(trainScPct, p.training.safetyCriticalTotal)}`}>
                              {p.training.safetyCriticalTotal > 0 ? `${trainScPct}%` : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {result.people.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">No people match the current filters.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
