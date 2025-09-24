import { useState } from "react";
import { useAuth, roleLabels } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserRole } from "@shared/schema";

const allRoles: UserRole[] = [
  'developer',
  'super_admin', 
  'admin',
  'internal_verifier',
  'assessor',
  'candidate',
  'trainee'
];

export function RoleSwitcher() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [isChanging, setIsChanging] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role as UserRole || 'candidate');

  // Only show for developers
  if (!user || !hasRole('developer')) {
    return null;
  }

  const handleRoleChange = async (newRole: UserRole) => {
    if (!user?.id) return;
    
    setIsChanging(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update role');
      }
      
      // Invalidate user query to refetch updated data
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      toast({
        title: "Role Updated",
        description: `Successfully changed role to ${roleLabels[newRole]}`,
      });
      
      // Refresh page to update sidebar and permissions
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (error) {
      console.error('Failed to update role:', error);
      toast({
        title: "Error",
        description: "Failed to update role. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChanging(false);
    }
  };

  const getCurrentRoleDescription = () => {
    switch (user?.role) {
      case 'developer':
        return 'Full system access, framework building, all administrative functions';
      case 'super_admin':
        return 'Organizational system owner, user management, system configuration';
      case 'admin':
        return 'Day-to-day operations, user management, assessment oversight';
      case 'internal_verifier':
        return 'Quality assurance, assessment verification, compliance checks';
      case 'assessor':
        return 'Conduct assessments, manage candidates, evidence review';
      case 'candidate':
        return 'View profiles, submit evidence, take assessments';
      case 'trainee':
        return 'Learning pathways, skill development, basic portfolio access';
      default:
        return 'Unknown role';
    }
  };

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-orange-600" />
          <CardTitle className="text-sm text-orange-800 dark:text-orange-200">
            Developer Role Testing Mode
          </CardTitle>
        </div>
        <CardDescription className="text-orange-700 dark:text-orange-300">
          Switch between user roles to test access levels and customize the system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Current Role:</span>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              {roleLabels[user.role as UserRole]}
            </Badge>
          </div>
        </div>
        
        <div className="text-xs text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/50 p-2 rounded">
          <strong>Access:</strong> {getCurrentRoleDescription()}
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as UserRole)}
            disabled={isChanging}
          >
            <SelectTrigger className="w-48" data-testid="select-role">
              <SelectValue placeholder="Select role to test" />
            </SelectTrigger>
            <SelectContent>
              {allRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleLabels[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            onClick={() => handleRoleChange(selectedRole)}
            disabled={isChanging || selectedRole === user.role}
            size="sm"
            className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600"
            data-testid="button-switch-role"
          >
            {isChanging ? (
              <>
                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                Switching...
              </>
            ) : (
              'Switch Role'
            )}
          </Button>
        </div>
        
        <div className="text-xs text-orange-600 dark:text-orange-400">
          💡 Page will automatically refresh after role change to update permissions
        </div>
      </CardContent>
    </Card>
  );
}