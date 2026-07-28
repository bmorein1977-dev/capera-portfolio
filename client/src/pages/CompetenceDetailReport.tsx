import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Clock, MinusCircle, AlertTriangle, LayoutGrid, Download, Snowflake, Ban } from 'lucide-react';
import { useComplianceFilters, ComplianceFilterBar } from '@/components/ComplianceFilterBar';
import type { CompetenceDetailResult, ElementStatus } from '@shared/schema';

function readinessColor(percentage: number) {
  if (percentage >= 100) return 'text-green-600 dark:text-green-400';
  if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

const STATUS_META: Record<ElementStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  current: { icon: CheckCircle2, color: 'border-green-500 text-green-600 dark:text-green-400', label: 'Current' },
  expiring_30: { icon: Clock, color: 'border-yellow-500 text-yellow-600 dark:text-yellow-400', label: 'Expiring ≤30 days' },
  expiring_60: { icon: Clock, color: 'border-yellow-500 text-yellow-600 dark:text-yellow-400', label: 'Expiring ≤60 days' },
  expiring_90: { icon: Clock, color: 'border-yellow-500 text-yellow-600 dark:text-yellow-400', label: 'Expiring ≤90 days' },
  expired: { icon: XCircle, color: 'border-red-500 text-red-600 dark:text-red-400', label: 'Expired' },
  missing: { icon: MinusCircle, color: 'border-muted-foreground/40 text-muted-foreground', label: 'No record' },
  exempt: { icon: Ban, color: 'border-blue-500 text-blue-600 dark:text-blue-400', label: 'Exempt' },
};

// One legend row per distinct icon/color combination, not one per ElementStatus - expiring_30/60/90
// all render identically (amber clock), so the legend collapses them into a single "Expiring soon".
const LEGEND_ENTRIES: Array<[string, typeof CheckCircle2, string]> = [
  ['Current', CheckCircle2, 'text-green-600 dark:text-green-400'],
  ['Expiring soon', Clock, 'text-yellow-600 dark:text-yellow-400'],
  ['Expired', XCircle, 'text-red-600 dark:text-red-400'],
  ['No record', MinusCircle, 'text-muted-foreground'],
  ['Exempt (not required / in training)', Ban, 'text-blue-600 dark:text-blue-400'],
];

export default function CompetenceDetailReport() {
  const filterState = useComplianceFilters();

  const { data: result, isLoading, error } = useQuery<CompetenceDetailResult>({
    queryKey: ['/api/reports/competence-detail', filterState.filters],
  });

  const gridTemplateColumns = result ? `280px repeat(${result.people.length}, 150px)` : undefined;

  const handleExport = () => {
    if (!result) return;
    const rows: Record<string, any>[] = [];
    for (const person of result.people) {
      for (const element of result.elements) {
        const cell = person.cells[element.elementId];
        if (!cell.required) continue;
        rows.push({
          'Name': person.name,
          'Job Role': person.jobRoleName || '',
          'Location': person.location || '',
          'Team / Shift': person.teamShift || '',
          'Element': element.elementName,
          'Element Code': element.elementCode || '',
          'Safety Critical': cell.safetyCritical ? 'Yes' : 'No',
          'Status': cell.status === 'exempt' ? (cell.outcome === 'not_required' ? 'Not Required' : 'Under Training') : STATUS_META[cell.status].label,
          'Expiry Date': cell.expiryDate ? format(new Date(cell.expiryDate), 'yyyy-MM-dd') : '',
          'Days Until Expiry': cell.daysUntilExpiry ?? '',
          'Exemption Reason': cell.exemptionReason || '',
          'Exempt Until': cell.exemptionUntil ? format(new Date(cell.exemptionUntil), 'yyyy-MM-dd') : '',
        });
      }
    }
    const workbook = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, ws, 'Competence Detail');
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    XLSX.writeFile(workbook, `Competence_Detail_Export_${timestamp}.xlsx`);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <LayoutGrid className="h-7 w-7" /> Competence Detail Report
            </h1>
            <p className="text-muted-foreground">
              Every required competence element for the filtered people, with its current status and expiry date - filter by location, job role, team/shift, employment type, contract company, or specific people.
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!result} className="flex-shrink-0" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>

        <ComplianceFilterBar state={filterState} />

        {isLoading && <Skeleton className="h-96" />}

        {error && !isLoading && (
          <Alert variant="destructive" data-testid="alert-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load the competence detail report for this filter combination.</AlertDescription>
          </Alert>
        )}

        {result && !isLoading && result.people.length === 0 && (
          <Alert data-testid="alert-no-people">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>No people match the current filters.</AlertDescription>
          </Alert>
        )}

        {result && !isLoading && result.people.length > 0 && result.elements.length === 0 && (
          <Alert data-testid="alert-no-elements">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>None of the matched people have a job role with required competence elements.</AlertDescription>
          </Alert>
        )}

        {result && !isLoading && result.people.length > 0 && result.elements.length > 0 && (
          <Card data-testid="card-competence-grid">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-lg">{result.people.length} people &middot; {result.elements.length} elements</CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {LEGEND_ENTRIES.map(([label, Icon, color]) => (
                    <span key={label} className="flex items-center gap-1">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      {label}
                    </span>
                  ))}
                  <span className="text-muted-foreground">N/A = not required for their role</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto overflow-y-visible">
                <div style={{ minWidth: `${280 + result.people.length * 150}px` }}>
                  {/* Header row: person avatars + coverage % - sticky so it stays visible while the
                      element rows below scroll past (overflow-y-visible above keeps this div from
                      becoming its own vertical scroll container, which would otherwise break the
                      sticky positioning relative to the page's actual scrollport). */}
                  <div className="grid gap-2 mb-4 sticky top-0 z-10 bg-card pb-2 border-b" style={{ gridTemplateColumns }}>
                    <div className="font-semibold text-sm p-2 self-end">Competency Element</div>
                    {result.people.map(person => (
                      <div key={person.userId} className="flex flex-col items-center gap-1 p-2" data-testid={`person-header-${person.userId}`}>
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                        </Avatar>
                        <div className="text-xs font-medium text-center truncate w-full" title={person.name}>{person.name}</div>
                        {person.jobRoleName && <div className="text-[10px] text-muted-foreground text-center truncate w-full">{person.jobRoleName}</div>}
                        {person.onLeave && (
                          <span className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400" data-testid={`badge-on-leave-${person.userId}`}>
                            <Snowflake className="h-2.5 w-2.5" /> On Leave
                          </span>
                        )}
                        <div className={`text-sm font-bold ${readinessColor(person.coveragePercentage)}`} data-testid={`person-coverage-${person.userId}`}>
                          {person.coveragePercentage}%
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Element rows */}
                  <div className="divide-y">
                    {result.elements.map(element => (
                      <div key={element.elementId} className="grid gap-2 items-center py-2" style={{ gridTemplateColumns }} data-testid={`element-row-${element.elementId}`}>
                        <div className="p-2 min-w-0">
                          <div className="font-medium text-sm truncate flex items-center gap-1">
                            {element.elementName}
                            {element.safetyCritical && <span className="text-red-600 dark:text-red-400 text-xs flex-shrink-0" title="Safety critical">&#9888;</span>}
                          </div>
                          {element.elementCode && <div className="text-xs text-muted-foreground truncate">{element.elementCode}</div>}
                        </div>
                        {result.people.map(person => {
                          const cell = person.cells[element.elementId];
                          if (!cell || !cell.required) {
                            return (
                              <div key={person.userId} className="flex justify-center" data-testid={`cell-${element.elementId}-${person.userId}`}>
                                <div className="text-xs text-muted-foreground">N/A</div>
                              </div>
                            );
                          }
                          const meta = STATUS_META[cell.status];
                          const Icon = meta.icon;
                          const isExempt = cell.status === 'exempt';
                          const exemptLabel = cell.outcome === 'not_required' ? 'Not Required' : cell.outcome === 'in_training' ? 'Under Training' : 'Exempt';
                          const tooltip = isExempt
                            ? [exemptLabel, cell.exemptionReason, cell.exemptionUntil ? `Until ${format(new Date(cell.exemptionUntil), 'dd MMM yyyy')}` : null].filter(Boolean).join(' - ')
                            : meta.label;
                          return (
                            <div key={person.userId} className="flex flex-col items-center gap-0.5" data-testid={`cell-${element.elementId}-${person.userId}`}>
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${meta.color}`} title={tooltip}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="text-[10px] text-muted-foreground text-center leading-tight">
                                {isExempt
                                  ? exemptLabel
                                  : cell.expiryDate ? format(new Date(cell.expiryDate), 'dd MMM yy') : (cell.status === 'missing' ? 'No record' : 'No expiry')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
