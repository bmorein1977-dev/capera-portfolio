import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  User as UserIcon,
  Briefcase,
  ArrowRight,
  Target
} from "lucide-react";
import type { RoleTransitionPlan, ElementStatus, User, JobRole } from "@shared/schema";

const statusConfig: Record<ElementStatus, {
  label: string;
  icon: typeof CheckCircle2;
  colorClass: string;
  bgClass: string;
}> = {
  current: {
    label: "Already Met",
    icon: CheckCircle2,
    colorClass: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-50 dark:bg-green-950/20"
  },
  expiring_30: {
    label: "Expiring (≤30 days)",
    icon: AlertTriangle,
    colorClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-50 dark:bg-red-950/20"
  },
  expiring_60: {
    label: "Expiring (31-60 days)",
    icon: Clock,
    colorClass: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-50 dark:bg-orange-950/20"
  },
  expiring_90: {
    label: "Expiring (61-90 days)",
    icon: Clock,
    colorClass: "text-yellow-600 dark:text-yellow-400",
    bgClass: "bg-yellow-50 dark:bg-yellow-950/20"
  },
  expired: {
    label: "Expired — Needs Reassessment",
    icon: XCircle,
    colorClass: "text-gray-600 dark:text-gray-400",
    bgClass: "bg-gray-50 dark:bg-gray-950/20"
  },
  missing: {
    label: "Not Yet Assessed",
    icon: AlertTriangle,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/20"
  },
};

export default function RoleTransitionPlanning() {
  const { user: authUser, hasRole } = useAuth();
  const canBrowseAllUsers = hasRole('admin');

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTargetRoleId, setSelectedTargetRoleId] = useState<string>("");

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: !!canBrowseAllUsers,
  });

  const { data: jobRoles, isLoading: loadingJobRoles } = useQuery<JobRole[]>({
    queryKey: ['/api/job-roles'],
  });

  const effectiveUserId = canBrowseAllUsers ? (selectedUserId || authUser?.id) : authUser?.id;

  const { data: plan, isLoading, error } = useQuery<RoleTransitionPlan>({
    queryKey: ['/api/users', effectiveUserId, 'role-transition', selectedTargetRoleId],
    enabled: !!effectiveUserId && !!selectedTargetRoleId,
  });

  const availableTargetRoles = (jobRoles || []).filter(r => r.id !== plan?.currentRole?.id);

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
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2" data-testid="text-user-name">
                <UserIcon className="w-4 h-4" />
                <span>{plan.user.firstName} {plan.user.lastName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground" data-testid="text-current-role">
                <Briefcase className="w-4 h-4" />
                <span>{plan.currentRole ? `${plan.currentRole.name} (${plan.currentRole.code})` : "No current role assigned"}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2 font-medium" data-testid="text-target-role">
                <Target className="w-4 h-4" />
                <span>{plan.targetRole.name} ({plan.targetRole.code})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-coverage">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Readiness</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-coverage-percentage">
                    {plan.statistics.coveragePercentage}%
                  </div>
                  <Progress value={plan.statistics.coveragePercentage} className="mt-2" data-testid="progress-coverage" />
                  <p className="text-xs text-muted-foreground mt-2">
                    {plan.statistics.alreadyMet} of {plan.statistics.totalRequiredByTarget} required elements met
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-gaps">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gaps to Close</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-gaps-count">{plan.statistics.gapsToClose}</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Elements not yet current
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-new-requirements">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Requirements</CardTitle>
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-new-requirements-count">
                    {plan.statistics.newRequirements}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Not required by current role
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-total-required">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Required</CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-required-count">
                    {plan.statistics.totalRequiredByTarget}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    For {plan.targetRole.name}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {(['missing', 'expiring_30', 'expiring_60', 'expiring_90', 'expired', 'current'] as ElementStatus[]).map(status => {
                const elementsList = plan.elements.filter(e => e.requiredByTarget && e.status === status);
                if (elementsList.length === 0) return null;

                const config = statusConfig[status];
                const StatusIcon = config.icon;

                return (
                  <Card key={status} className={config.bgClass} data-testid={`card-status-${status}`}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`h-5 w-5 ${config.colorClass}`} />
                        <CardTitle className="text-lg">{config.label}</CardTitle>
                        <Badge variant="secondary" data-testid={`badge-count-${status}`}>
                          {elementsList.length}
                        </Badge>
                      </div>
                      {status !== 'current' && (
                        <CardDescription>
                          Required for {plan.targetRole.name}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {elementsList.map(item => (
                          <div
                            key={item.element.id}
                            className="flex flex-wrap items-center justify-between gap-2 p-3 bg-card rounded-md border"
                            data-testid={`element-${item.element.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate" data-testid={`text-element-name-${item.element.id}`}>
                                {item.element.name}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {item.element.code}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!item.alreadyRequiredByCurrentRole && (
                                <Badge variant="outline" className="text-purple-600 dark:text-purple-400" data-testid={`badge-new-${item.element.id}`}>
                                  New for this role
                                </Badge>
                              )}
                              {item.daysUntilExpiry !== undefined && (
                                <Badge
                                  variant="secondary"
                                  className={config.colorClass}
                                  data-testid={`badge-days-${item.element.id}`}
                                >
                                  {item.daysUntilExpiry < 0
                                    ? `${Math.abs(item.daysUntilExpiry)} days ago`
                                    : `${item.daysUntilExpiry} days`
                                  }
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
