import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCog, Users, LogOut, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isImpersonating?: boolean;
  realUserId?: string;
}

export function UserSwitcher() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);

  // Get current user info
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  // Get test users - use realUserRole when impersonating
  const effectiveRole = currentUser?.isImpersonating 
    ? (currentUser as any).realUserRole 
    : currentUser?.role;
  
  const { data: testUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/auth/test-users'],
    enabled: effectiveRole === 'developer' || effectiveRole === 'admin' || effectiveRole === 'super_admin',
  });

  // Impersonate mutation
  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest('POST', '/api/auth/impersonate', { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries();
      toast({
        title: 'User Switched',
        description: 'You are now viewing the app as this user',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to Switch User',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Stop impersonating mutation
  const stopImpersonatingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auth/stop-impersonating', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries();
      toast({
        title: 'Stopped Impersonating',
        description: 'You are now viewing as yourself',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to Stop Impersonating',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Setup test scenario mutation
  const setupTestScenarioMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/auth/setup-test-scenario', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/test-users'] });
      toast({
        title: 'Test Scenario Created',
        description: 'Test candidate and assessor accounts have been set up with sample data',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to Setup Test Scenario',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Show for admin users or when impersonating (regardless of impersonated role)
  if (!currentUser) {
    return null;
  }
  
  // If impersonating, always show (so user can stop impersonating)
  // If not impersonating, only show for admin/developer users
  if (!currentUser.isImpersonating && !['developer', 'admin', 'super_admin'].includes(currentUser.role)) {
    return null;
  }

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'assessor':
        return 'default';
      case 'candidate':
      case 'trainee':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={currentUser.isImpersonating ? 'default' : 'outline'}
          size="sm"
          data-testid="button-user-switcher"
        >
          {currentUser.isImpersonating ? (
            <>
              <UserCog className="h-4 w-4 mr-2" />
              Viewing as {getDisplayName(currentUser)}
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              Switch User
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Testing Tools</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {currentUser.isImpersonating && (
          <>
            <DropdownMenuItem
              onClick={() => stopImpersonatingMutation.mutate()}
              data-testid="menu-item-stop-impersonating"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Stop Viewing as User
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {testUsers.length === 0 ? (
          <>
            <DropdownMenuItem
              onClick={() => setupTestScenarioMutation.mutate()}
              disabled={setupTestScenarioMutation.isPending}
              data-testid="menu-item-setup-scenario"
            >
              <Play className="h-4 w-4 mr-2" />
              {setupTestScenarioMutation.isPending
                ? 'Creating...'
                : 'Create Test Scenario'}
            </DropdownMenuItem>
            <div className="px-2 py-2 text-xs text-muted-foreground">
              This will create test candidate and assessor accounts with sample
              assessments
            </div>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Switch to Test User
            </DropdownMenuLabel>
            {testUsers.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => impersonateMutation.mutate(user.id)}
                disabled={currentUser.id === user.id}
                data-testid={`menu-item-impersonate-${user.id}`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col">
                    <span className="font-medium">{getDisplayName(user)}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <Badge variant={getRoleBadgeVariant(user.role)} className="ml-2">
                    {user.role}
                  </Badge>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setupTestScenarioMutation.mutate()}
              disabled={setupTestScenarioMutation.isPending}
              className="text-xs"
              data-testid="menu-item-recreate-scenario"
            >
              <Play className="h-4 w-4 mr-2" />
              Recreate Test Scenario
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
