import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { UserCombobox } from '@/components/UserCombobox';
import { Network, ChevronUp, Users, MapPin, AlertTriangle } from 'lucide-react';
import type { OrgChartNode, ComplianceExplorerResult } from '@shared/schema';

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase() || '?';
}

function PersonCard({
  person, onClick, size = 'md',
}: {
  person: OrgChartNode['focus'];
  onClick?: () => void;
  size?: 'sm' | 'md';
}) {
  const clickable = !!onClick;
  return (
    <Card
      className={`${clickable ? 'cursor-pointer hover-elevate active-elevate-2' : ''} ${size === 'md' ? 'w-56' : 'w-48'}`}
      onClick={onClick}
      data-testid={`card-person-${person.id}`}
    >
      <CardContent className={`flex flex-col items-center text-center gap-1 ${size === 'md' ? 'p-4' : 'p-3'}`}>
        <div className="relative">
          <Avatar className={size === 'md' ? 'h-16 w-16' : 'h-12 w-12'}>
            <AvatarImage src={person.profileImageUrl || undefined} alt={person.name} />
            <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
          </Avatar>
          {person.directReportCount > 0 && (
            <Badge
              variant="default"
              className="absolute -bottom-1 -right-1 h-5 min-w-5 px-1 rounded-full flex items-center justify-center text-xs"
              data-testid={`badge-report-count-${person.id}`}
            >
              {person.directReportCount}
            </Badge>
          )}
        </div>
        <div className={`font-medium truncate w-full ${size === 'md' ? 'text-sm' : 'text-xs'}`} title={person.name}>{person.name}</div>
        {person.jobRoleName && <div className="text-xs text-muted-foreground truncate w-full">{person.jobRoleName}</div>}
        {person.location && (
          <div className="text-xs text-muted-foreground truncate w-full flex items-center justify-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" /> {person.location}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrgChart() {
  const { user } = useAuth();
  const [focusUserId, setFocusUserId] = useState<string | undefined>(user?.id);

  // People list for the search combobox - reuses the Compliance Explorer's unfiltered result
  // (already role-gated the same way) rather than a dedicated endpoint.
  const { data: peopleSource } = useQuery<ComplianceExplorerResult>({
    queryKey: ['/api/reports/compliance-explorer', {}],
  });
  const peopleOptions = useMemo(() => {
    return [...(peopleSource?.people || [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => ({ id: p.userId, label: p.name, sublabel: p.jobRoleName }));
  }, [peopleSource]);

  const { data: node, isLoading, error } = useQuery<OrgChartNode>({
    queryKey: [`/api/org/chart/${focusUserId}`],
    enabled: !!focusUserId,
  });

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Network className="h-7 w-7" /> Org Chart
          </h1>
          <p className="text-muted-foreground">
            Browse the reporting structure - click a card to see that person's own team, or jump straight to someone by name.
          </p>
        </div>

        <div className="max-w-md">
          <UserCombobox
            testId="org-chart-jump"
            placeholder="Search for a person..."
            value={focusUserId || null}
            onChange={(id) => setFocusUserId(id || undefined)}
            options={peopleOptions}
          />
        </div>

        {!focusUserId && (
          <Alert data-testid="alert-no-selection">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Search for a person above to center the chart on them.</AlertDescription>
          </Alert>
        )}

        {isLoading && focusUserId && (
          <div className="flex flex-col items-center gap-6">
            <Skeleton className="h-40 w-56" />
            <div className="flex gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-48" />)}
            </div>
          </div>
        )}

        {error && !isLoading && (
          <Alert variant="destructive" data-testid="alert-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load this person's place in the org chart.</AlertDescription>
          </Alert>
        )}

        {node && !isLoading && (
          <div className="flex flex-col items-center gap-4">
            {node.manager ? (
              <button
                type="button"
                onClick={() => setFocusUserId(node.manager!.id)}
                className="flex items-center gap-1 text-sm text-primary hover-elevate rounded-md px-3 py-1.5"
                data-testid="button-go-to-manager"
              >
                <ChevronUp className="h-4 w-4" /> {node.manager.name}
              </button>
            ) : (
              <div className="text-xs text-muted-foreground">No manager set</div>
            )}

            <PersonCard person={node.focus} />

            <div className="w-full border-t pt-6">
              {node.directReports.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 justify-center">
                    <Users className="h-4 w-4" /> {node.directReports.length} direct {node.directReports.length === 1 ? 'report' : 'reports'}
                  </div>
                  <div className="flex flex-wrap justify-center gap-6">
                    {node.directReports.map(report => (
                      <div key={report.id} className="flex flex-col items-center gap-2">
                        <PersonCard person={report} size="sm" onClick={() => setFocusUserId(report.id)} />
                        {report.reports.length > 0 && (
                          <div className="flex flex-col gap-1 border-l pl-3 ml-2 w-full">
                            {report.reports.map(grandReport => (
                              <button
                                key={grandReport.id}
                                type="button"
                                onClick={() => setFocusUserId(grandReport.id)}
                                className="flex items-center gap-1.5 text-xs text-left hover-elevate rounded-md px-2 py-1"
                                data-testid={`button-grand-report-${grandReport.id}`}
                              >
                                <Avatar className="h-5 w-5 flex-shrink-0">
                                  <AvatarImage src={grandReport.profileImageUrl || undefined} alt={grandReport.name} />
                                  <AvatarFallback className="text-[9px]">{getInitials(grandReport.name)}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{grandReport.name}</span>
                                {grandReport.directReportCount > 0 && (
                                  <span className="text-muted-foreground flex-shrink-0">({grandReport.directReportCount})</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4" data-testid="text-no-reports">
                  No one reports to {node.focus.name} yet - assign a manager to someone in User Management to build this out.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
