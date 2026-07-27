import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, SlidersHorizontal, X, Search } from 'lucide-react';
import type { ComplianceExplorerResult, JobRole, ContractCompany } from '@shared/schema';

const ANY = '__any__';

function pctColor(value: number, total: number) {
  if (total === 0) return 'text-muted-foreground';
  if (value >= 90) return 'text-green-600 dark:text-green-400';
  if (value >= 75) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
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
  const [location, setLocation] = useState(ANY);
  const [jobRoleId, setJobRoleId] = useState(ANY);
  const [secondaryJobRoleId, setSecondaryJobRoleId] = useState(ANY);
  const [teamShift, setTeamShift] = useState(ANY);
  const [employmentType, setEmploymentType] = useState(ANY);
  const [contractCompanyId, setContractCompanyId] = useState(ANY);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Unfiltered pull, used only to source the Location/Team-Shift dropdown options from what's
  // actually on user records - both are free text with inconsistent conventions between records
  // (not the structured locations/teams tables, which are unreliable - see Role Transition
  // Planning's location-matching fix from earlier this session), so the option list has to come
  // from real data rather than a reference table.
  const { data: optionsSource } = useQuery<ComplianceExplorerResult>({
    queryKey: ['/api/reports/compliance-explorer', {}],
  });
  const { data: jobRoles } = useQuery<JobRole[]>({ queryKey: ['/api/job-roles'] });
  const { data: contractCompanies } = useQuery<ContractCompany[]>({ queryKey: ['/api/org/contract-companies'] });

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    optionsSource?.people.forEach(p => { if (p.location) set.add(p.location); });
    return Array.from(set).sort();
  }, [optionsSource]);
  const teamShiftOptions = useMemo(() => {
    const set = new Set<string>();
    optionsSource?.people.forEach(p => { if (p.teamShift) set.add(p.teamShift); });
    return Array.from(set).sort();
  }, [optionsSource]);

  const filters = useMemo(() => ({
    location: location !== ANY ? location : undefined,
    jobRoleId: jobRoleId !== ANY ? jobRoleId : undefined,
    secondaryJobRoleId: secondaryJobRoleId !== ANY ? secondaryJobRoleId : undefined,
    teamShift: teamShift !== ANY ? teamShift : undefined,
    employmentType: employmentType !== ANY ? employmentType : undefined,
    contractCompanyId: contractCompanyId !== ANY ? contractCompanyId : undefined,
    search: search || undefined,
  }), [location, jobRoleId, secondaryJobRoleId, teamShift, employmentType, contractCompanyId, search]);

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined);

  const { data: result, isLoading, error } = useQuery<ComplianceExplorerResult>({
    queryKey: ['/api/reports/compliance-explorer', filters],
  });

  const clearFilters = () => {
    setLocation(ANY); setJobRoleId(ANY); setSecondaryJobRoleId(ANY);
    setTeamShift(ANY); setEmploymentType(ANY); setContractCompanyId(ANY);
    setSearchInput(''); setSearch('');
  };

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

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6 max-w-7xl">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <SlidersHorizontal className="h-7 w-7" /> Compliance Explorer
          </h1>
          <p className="text-muted-foreground">
            Filter the workforce by location, job role, team/shift, employment type and contract company to see training and competence compliance for exactly the group you need.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  className="pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  data-testid="input-search"
                />
              </div>

              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger data-testid="select-location"><SelectValue placeholder="Location" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any location</SelectItem>
                  {locationOptions.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={jobRoleId} onValueChange={setJobRoleId}>
                <SelectTrigger data-testid="select-job-role"><SelectValue placeholder="Job role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any job role</SelectItem>
                  {(jobRoles || []).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={secondaryJobRoleId} onValueChange={setSecondaryJobRoleId}>
                <SelectTrigger data-testid="select-secondary-job-role"><SelectValue placeholder="Secondary job role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any secondary role</SelectItem>
                  {(jobRoles || []).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={teamShift} onValueChange={setTeamShift}>
                <SelectTrigger data-testid="select-team-shift"><SelectValue placeholder="Team / shift" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any team / shift</SelectItem>
                  {teamShiftOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={employmentType} onValueChange={setEmploymentType}>
                <SelectTrigger data-testid="select-employment-type"><SelectValue placeholder="Employment type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Employee or contractor</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                </SelectContent>
              </Select>

              <Select value={contractCompanyId} onValueChange={setContractCompanyId}>
                <SelectTrigger data-testid="select-contract-company"><SelectValue placeholder="Contract company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any contract company</SelectItem>
                  {(contractCompanies || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="justify-self-start" data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" /> Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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
                        <TableHead className="text-right">Competence</TableHead>
                        <TableHead className="text-right">Training</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.people.map(p => (
                        <TableRow key={p.userId} data-testid={`row-person-${p.userId}`}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.jobRoleName || '—'}</TableCell>
                          <TableCell>{p.location || '—'}</TableCell>
                          <TableCell>{p.teamShift || '—'}</TableCell>
                          <TableCell className="capitalize">{p.employmentType || '—'}{p.contractCompanyName ? ` · ${p.contractCompanyName}` : ''}</TableCell>
                          <TableCell className={`text-right font-medium ${pctColor(p.competence.percentage, p.competence.total)}`}>
                            {p.competence.total > 0 ? `${p.competence.percentage}%` : '—'}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${pctColor(p.training.percentage, p.training.total)}`}>
                            {p.training.total > 0 ? `${p.training.percentage}%` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {result.people.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No people match the current filters.</TableCell>
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
