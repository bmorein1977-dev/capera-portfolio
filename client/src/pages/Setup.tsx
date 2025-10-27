import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Shield, ShieldCheck, ShieldAlert, UserCheck, GraduationCap, Briefcase } from "lucide-react";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  department: string | null;
  location: string | null;
};

const roleIcons = {
  developer: Shield,
  super_admin: ShieldAlert,
  admin: ShieldCheck,
  internal_verifier: UserCheck,
  assessor: Briefcase,
  candidate: User,
  trainee: GraduationCap,
};

const roleColors = {
  developer: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  super_admin: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  admin: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  internal_verifier: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  assessor: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
  candidate: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
  trainee: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20",
};

const roleDescriptions = {
  developer: "System architect and maintainer with full access to all features",
  super_admin: "Organizational system owner with comprehensive administrative rights",
  admin: "Day-to-day system operator managing users, assessments, and reporting",
  internal_verifier: "Quality assurer for assessments and verification workflows",
  assessor: "Conducts and manages assessments for candidates",
  candidate: "Individual being assessed for competency certification",
  trainee: "Learning pathway participant working toward certification",
};

export default function Setup() {
  const { toast } = useToast();

  const { data: currentUser, isLoading: loadingUser } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      if (!currentUser?.id) throw new Error("User ID not found");
      return apiRequest('PATCH', `/api/users/${currentUser.id}`, { role: newRole });
    },
    onSuccess: (data, newRole) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Role Updated!",
        description: `Your role has been changed to ${newRole.replace('_', ' ')}. Refreshing...`,
      });
      // Refresh the page to update sidebar and permissions
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update role",
        variant: "destructive",
      });
    },
  });

  const handleRoleChange = (role: string) => {
    updateRoleMutation.mutate(role);
  };

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const roles = [
    'developer',
    'super_admin',
    'admin',
    'internal_verifier',
    'assessor',
    'candidate',
    'trainee',
  ];

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-setup-title">
          Account Setup
        </h1>
        <p className="text-muted-foreground" data-testid="text-setup-description">
          Configure your account role to access different features and workflows
        </p>
      </div>

      {/* Current User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Current Profile</CardTitle>
          <CardDescription>Your current account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium" data-testid="text-current-user-name">
                {currentUser?.name || 'Not set'}
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-current-user-email">
                {currentUser?.email}
              </p>
            </div>
            <Badge 
              variant="outline" 
              className={roleColors[currentUser?.role as keyof typeof roleColors] || ''}
              data-testid="badge-current-role"
            >
              {currentUser?.role.replace('_', ' ')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Role Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Change Your Role</CardTitle>
          <CardDescription>
            Click any role below to switch. The page will refresh automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {roles.map((role) => {
              const Icon = roleIcons[role as keyof typeof roleIcons];
              const isCurrentRole = currentUser?.role === role;
              
              return (
                <Button
                  key={role}
                  variant={isCurrentRole ? "default" : "outline"}
                  className="h-auto p-4 justify-start gap-3"
                  onClick={() => handleRoleChange(role)}
                  disabled={updateRoleMutation.isPending || isCurrentRole}
                  data-testid={`button-role-${role}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium capitalize">
                      {role.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-muted-foreground font-normal mt-1">
                      {roleDescriptions[role as keyof typeof roleDescriptions]}
                    </div>
                  </div>
                  {isCurrentRole && (
                    <Badge variant="secondary" className="ml-auto">
                      Current
                    </Badge>
                  )}
                  {updateRoleMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                  )}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-blue-700 dark:text-blue-300">Quick Start Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>New to Capera?</strong> Start by selecting the <strong>Admin</strong> role to access user management and test data creation.
          </p>
          <p>
            Once you've created test data, switch to <strong>Assessor</strong> to view the assessment dashboard with expiry tracking and Excel export.
          </p>
          <p>
            Each role provides different features - try them all to explore the full platform!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
