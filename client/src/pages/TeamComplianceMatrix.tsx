import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, XCircle, Users, MapPin } from "lucide-react";
import type { TeamComplianceMatrix, JobRole } from "@shared/schema";

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function readinessColor(percentage: number) {
  if (percentage >= 100) return "text-green-600 dark:text-green-400";
  if (percentage >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export default function TeamComplianceMatrixPage() {
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");

  const { data: jobRoles, isLoading: loadingJobRoles } = useQuery<JobRole[]>({
    queryKey: ['/api/job-roles'],
  });

  const { data: locations, isLoading: loadingLocations } = useQuery<string[]>({
    queryKey: ['/api/locations'],
  });

  const { data: matrix, isLoading, error } = useQuery<TeamComplianceMatrix>({
    queryKey: ['/api/team-compliance', { roleId: selectedRoleId, location: selectedLocation }],
    enabled: !!selectedRoleId && !!selectedLocation,
  });

  const gridTemplateColumns = matrix ? `240px repeat(${matrix.members.length}, 110px)` : undefined;

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Team Compliance Matrix</h1>
          <p className="text-muted-foreground">
            Select a job role and location to see everyone in that role at that site, and which competency elements they've achieved.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Choose Role &amp; Location</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Job Role</label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId} disabled={loadingJobRoles}>
                <SelectTrigger data-testid="select-job-role">
                  <SelectValue placeholder="Select a job role" />
                </SelectTrigger>
                <SelectContent>
                  {(jobRoles || []).map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} ({role.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={loadingLocations}>
                <SelectTrigger data-testid="select-location">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {(locations || []).map(location => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {(!selectedRoleId || !selectedLocation) && (
          <Alert data-testid="alert-select-filters">
            <MapPin className="h-4 w-4" />
            <AlertDescription>
              Select both a job role and a location above to load the team compliance matrix.
            </AlertDescription>
          </Alert>
        )}

        {isLoading && selectedRoleId && selectedLocation && (
          <Skeleton className="h-96" />
        )}

        {error && selectedRoleId && selectedLocation && (
          <Alert variant="destructive" data-testid="alert-error">
            <XCircle className="h-4 w-4" />
            <AlertDescription>Failed to load the team compliance matrix.</AlertDescription>
          </Alert>
        )}

        {matrix && matrix.members.length === 0 && (
          <Alert data-testid="alert-no-members">
            <Users className="h-4 w-4" />
            <AlertDescription>
              No one currently holds {matrix.jobRole.name} at {matrix.location}.
            </AlertDescription>
          </Alert>
        )}

        {matrix && matrix.members.length > 0 && (
          <Card data-testid="card-compliance-matrix">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">
                  {matrix.jobRole.name} ({matrix.jobRole.code}) — {matrix.location}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div style={{ minWidth: `${240 + matrix.members.length * 110}px` }}>
                  {/* Header row: member avatars + readiness % */}
                  <div className="grid gap-2 mb-4" style={{ gridTemplateColumns }}>
                    <div className="font-semibold text-sm p-2 self-end">Competency Element</div>
                    {matrix.members.map(member => (
                      <div key={member.user.id} className="flex flex-col items-center gap-1 p-2" data-testid={`member-header-${member.user.id}`}>
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>{getInitials(member.user.firstName, member.user.lastName)}</AvatarFallback>
                        </Avatar>
                        <div className="text-xs font-medium text-center truncate w-full" title={`${member.user.firstName} ${member.user.lastName}`}>
                          {member.user.firstName} {member.user.lastName}
                        </div>
                        <div className={`text-sm font-bold ${readinessColor(member.coveragePercentage)}`} data-testid={`member-coverage-${member.user.id}`}>
                          {member.coveragePercentage}%
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Element rows */}
                  <div className="divide-y">
                    {matrix.requiredElements.map(element => (
                      <div key={element.id} className="grid gap-2 items-center py-2" style={{ gridTemplateColumns }} data-testid={`element-row-${element.id}`}>
                        <div className="p-2 min-w-0">
                          <div className="font-medium text-sm truncate">{element.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{element.code}</div>
                        </div>
                        {matrix.members.map(member => {
                          const result = member.elements.find(e => e.element.id === element.id);
                          const achieved = result?.status === 'current';
                          return (
                            <div key={member.user.id} className="flex justify-center" data-testid={`status-icon-${element.id}-${member.user.id}`}>
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                  achieved
                                    ? "border-green-500 text-green-600 dark:text-green-400"
                                    : "border-red-400 text-red-500 dark:text-red-400"
                                }`}
                                title={achieved ? "Achieved" : "Outstanding"}
                              >
                                {achieved ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
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
