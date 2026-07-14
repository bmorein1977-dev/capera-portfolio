import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  XCircle,
  Briefcase,
  ArrowRight,
  Target
} from "lucide-react";
import type { RoleTransitionPlan, ElementStatus, User, JobRole } from "@shared/schema";

const achievedStatuses: ElementStatus[] = ['current'];

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function readinessRingColor(percentage: number) {
  if (percentage >= 100) return "text-green-600 dark:text-green-400";
  if (percentage >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export default function RoleTransitionPlanning() {
  const { user: authUser, hasRole } = useAuth();
  const canBrowseAllUsers = hasRole('admin');

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedTargetRoleId, setSelectedTargetRoleId] = useState<string>("");

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: !!canBrowseAllUsers,
  });

  const { data: jobRoles, isLoading: loadingJobRoles } = useQuery<JobRole[]>({
    queryKey: ['/api/job-roles'],
  });

  const { data: locations, isLoading: loadingLocations } = useQuery<string[]>({
    queryKey: ['/api/locations'],
  });

  const effectiveUserId = canBrowseAllUsers ? (selectedUserId || authUser?.id) : authUser?.id;

  const { data: plan, isLoading, error } = useQuery<RoleTransitionPlan>({
    queryKey: ['/api/users', effectiveUserId, 'role-transition', selectedTargetRoleId],
    enabled: !!effectiveUserId && !!selectedTargetRoleId,
  });

  // Roles tagged with a different location are hidden once a location is picked;
  // roles with no location set are treated as available everywhere.
  const availableTargetRoles = (jobRoles || [])
    .filter(r => r.id !== plan?.currentRole?.id)
    .filter(r => !selectedLocation || !r.location || r.location === selectedLocation);

  const handleLocationChange = (value: string) => {
    setSelectedLocation(value);
    setSelectedTargetRoleId("");
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Role Transition Planning</h1>
          <p className="text-muted-foreground">
            Compare an employee's current competencies against a target role to see what's already met and what training gap needs closing.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Choose Transition</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {canBrowseAllUsers && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger data-testid="select-employee">
                    <SelectValue placeholder={`Myself (${authUser?.firstName} ${authUser?.lastName})`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(allUsers || []).map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Select value={selectedLocation} onValueChange={handleLocationChange} disabled={loadingLocations}>
                <SelectTrigger data-testid="select-location">
                  <SelectValue placeholder="Any location" />
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Job Role</label>
              <Select value={selectedTargetRoleId} onValueChange={setSelectedTargetRoleId} disabled={loadingJobRoles}>
                <SelectTrigger data-testid="select-target-role">
                  <SelectValue placeholder="Select a target role" />
                </SelectTrigger>
                <SelectContent>
                  {availableTargetRoles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} ({role.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!selectedTargetRoleId && (
          <Alert data-testid="alert-select-target">
            <Target className="h-4 w-4" />
            <AlertDescription>
              Select a target job role above to generate a transition plan.
            </AlertDescription>
          </Alert>
        )}

        {isLoading && selectedTargetRoleId && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
            <Skeleton className="h-96" />
          </div>
        )}

        {error && selectedTargetRoleId && (
          <Alert variant="destructive" data-testid="alert-error">
            <XCircle className="h-4 w-4" />
            <AlertDescription>Failed to load role transition plan.</AlertDescription>
          </Alert>
        )}

        {plan && (
          <Card data-testid="card-transition-matrix">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="text-base">
                      {getInitials(plan.user.firstName, plan.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-lg" data-testid="text-user-name">
                      {plan.user.firstName} {plan.user.lastName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                      <Briefcase className="w-3.5 h-3.5" />
                      <span data-testid="text-current-role">
                        {plan.currentRole ? `${plan.currentRole.name} (${plan.currentRole.code})` : "No current role assigned"}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span className="font-medium text-foreground" data-testid="text-target-role">
                        {plan.targetRole.name} ({plan.targetRole.code})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-center" data-testid="text-coverage-percentage">
                  <div className={`text-4xl font-bold ${readinessRingColor(plan.statistics.coveragePercentage)}`}>
                    {plan.statistics.coveragePercentage}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {plan.statistics.alreadyMet} of {plan.statistics.totalRequiredByTarget} met
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {plan.elements.filter(e => e.requiredByTarget).map(item => {
                  const achieved = achievedStatuses.includes(item.status);
                  return (
                    <div
                      key={item.element.id}
                      className="flex items-center justify-between gap-4 px-6 py-4"
                      data-testid={`element-${item.element.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" data-testid={`text-element-name-${item.element.id}`}>
                          {item.element.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">{item.element.code}</span>
                          {!item.alreadyRequiredByCurrentRole && (
                            <Badge variant="outline" className="text-purple-600 dark:text-purple-400" data-testid={`badge-new-${item.element.id}`}>
                              New for this role
                            </Badge>
                          )}
                          {achieved && item.daysUntilExpiry !== undefined && (
                            <span className="text-xs text-muted-foreground" data-testid={`text-expiry-${item.element.id}`}>
                              expires in {item.daysUntilExpiry} days
                            </span>
                          )}
                          {!achieved && item.status === 'expired' && (
                            <span className="text-xs text-red-600 dark:text-red-400" data-testid={`text-expiry-${item.element.id}`}>
                              expired
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                          achieved
                            ? "border-green-500 text-green-600 dark:text-green-400"
                            : "border-red-400 text-red-500 dark:text-red-400"
                        }`}
                        title={achieved ? "Achieved" : "Outstanding"}
                        data-testid={`status-icon-${item.element.id}`}
                      >
                        {achieved ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
