import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  User,
  Briefcase,
  Target
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkillsGapAnalysis, ElementStatus } from "@shared/schema";

const statusConfig: Record<ElementStatus, { 
  label: string; 
  icon: typeof CheckCircle2; 
  colorClass: string;
  bgClass: string;
}> = {
  current: { 
    label: "Current", 
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
    label: "Expired", 
    icon: XCircle, 
    colorClass: "text-gray-600 dark:text-gray-400",
    bgClass: "bg-gray-50 dark:bg-gray-950/20"
  },
  missing: { 
    label: "Not Assessed", 
    icon: AlertTriangle, 
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/20"
  },
};

export default function SkillsGapDashboard() {
  const { user: authUser } = useAuth();
  const userId = authUser?.id;

  const { data: skillsGap, isLoading, error } = useQuery<SkillsGapAnalysis>({
    queryKey: ['/api/users', userId, 'skills-gap'],
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !skillsGap) {
    return (
      <div className="p-6">
        <Alert data-testid="alert-no-job-role">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error ? "Failed to load skills gap analysis." : "You don't have a job role assigned yet. Please contact your administrator."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { user, jobRole, elements, statistics } = skillsGap;
  const groupedElements = elements.reduce((acc, element) => {
    if (!acc[element.status]) {
      acc[element.status] = [];
    }
    acc[element.status].push(element);
    return acc;
  }, {} as Record<ElementStatus, typeof elements>);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Skills Gap Analysis</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2" data-testid="text-user-name">
              <User className="w-4 h-4" />
              <span>{user.firstName} {user.lastName}</span>
            </div>
            <div className="flex items-center gap-2" data-testid="text-job-role">
              <Briefcase className="w-4 h-4" />
              <span>{jobRole.name} ({jobRole.code})</span>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-coverage">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coverage</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-coverage-percentage">
                {statistics.coveragePercentage}%
              </div>
              <Progress value={statistics.coveragePercentage} className="mt-2" data-testid="progress-coverage" />
              <p className="text-xs text-muted-foreground mt-2">
                {statistics.current} of {statistics.totalRequired} required elements
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-missing">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Not Assessed</CardTitle>
              <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-missing-count">{statistics.missing}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Elements needing assessment
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-expiring">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-expiring-count">
                {statistics.expiringSoon30 + statistics.expiringSoon60 + statistics.expiringSoon90}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Within 90 days
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-expired">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired</CardTitle>
              <XCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-expired-count">{statistics.expired}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Require reassessment
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Elements by Status */}
        <div className="space-y-4">
          {(['missing', 'expiring_30', 'expiring_60', 'expiring_90', 'expired', 'current'] as ElementStatus[]).map(status => {
            const elementsList = groupedElements[status] || [];
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
                  {status !== 'missing' && status !== 'current' && (
                    <CardDescription>
                      These elements need attention soon
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
                          {item.required && (
                            <Badge variant="outline" data-testid={`badge-required-${item.element.id}`}>
                              Required
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

        {/* Optional Elements Summary */}
        {statistics.totalOptional > 0 && (
          <Card data-testid="card-optional-elements">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Optional Elements
              </CardTitle>
              <CardDescription>
                Additional competencies available for this role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground" data-testid="text-optional-count">
                {statistics.totalOptional} optional elements available for professional development
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
