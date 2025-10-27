import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Users, 
  Search,
  Shield,
  RefreshCw,
  Database
} from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  department: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type UserRole = 'developer' | 'super_admin' | 'admin' | 'internal_verifier' | 'assessor' | 'candidate' | 'trainee';

const roleColors: Record<UserRole, string> = {
  developer: 'bg-purple-500',
  super_admin: 'bg-red-500',
  admin: 'bg-blue-500',
  internal_verifier: 'bg-green-500',
  assessor: 'bg-yellow-500',
  candidate: 'bg-gray-500',
  trainee: 'bg-orange-500',
};

const roleLabels: Record<UserRole, string> = {
  developer: 'Developer',
  super_admin: 'Super Admin',
  admin: 'Admin',
  internal_verifier: 'Internal Verifier',
  assessor: 'Assessor',
  candidate: 'Candidate',
  trainee: 'Trainee',
};

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest('PATCH', '/api/users/' + userId, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Role Updated',
        description: 'User role has been updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update user role',
        variant: 'destructive',
      });
    },
  });

  // Seed data mutation
  const seedDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/seed-data');
    },
    onSuccess: () => {
      toast({
        title: 'Test Data Created',
        description: 'Successfully created test candidates, allocations, and assessments',
      });
    },
    onError: (error) => {
      toast({
        title: 'Seed Failed',
        description: error.message || 'Failed to create test data',
        variant: 'destructive',
      });
    },
  });

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  // Statistics
  const roleStats = users.reduce((acc, user) => {
    acc[user.role as UserRole] = (acc[user.role as UserRole] || 0) + 1;
    return acc;
  }, {} as Record<UserRole, number>);

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || 'Unknown User';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6" data-testid="page-admin-users">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-admin-users">
            <Users className="h-8 w-8" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage user roles and permissions across the platform
          </p>
        </div>
        <Button 
          onClick={() => seedDataMutation.mutate()}
          disabled={seedDataMutation.isPending}
          data-testid="button-seed-data"
        >
          {seedDataMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Create Test Data
            </>
          )}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {Object.entries(roleLabels).map(([role, label]) => (
          <Card key={role} data-testid={`card-stat-${role}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`stat-count-${role}`}>
                {roleStats[role as UserRole] || 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger data-testid="select-role-filter">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <SelectItem key={role} value={role}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            View and manage user roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users found matching your filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border hover-elevate active-elevate-2"
                    data-testid={`user-row-${user.id}`}
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar>
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback>{getInitials(user)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium" data-testid={`text-user-name-${user.id}`}>
                            {getDisplayName(user)}
                          </p>
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`text-user-email-${user.id}`}>
                          {user.email || 'No email'}
                        </p>
                        {(user.department || user.location) && (
                          <p className="text-xs text-muted-foreground">
                            {[user.department, user.location].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Current Role Badge */}
                    <div className="flex items-center gap-3">
                      <Badge 
                        className={roleColors[user.role as UserRole]}
                        data-testid={`badge-current-role-${user.id}`}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {roleLabels[user.role as UserRole]}
                      </Badge>

                      {/* Role Selector */}
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger 
                          className="w-48"
                          data-testid={`select-change-role-${user.id}`}
                        >
                          <SelectValue placeholder="Change role" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([role, label]) => (
                            <SelectItem key={role} value={role}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">Quick Tips</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Use the <strong>Create Test Data</strong> button to generate sample candidates, allocations, and assessments</p>
          <p>• Change any user's role using the dropdown selector</p>
          <p>• Assessors can access the Assessor Dashboard to view their assigned candidates</p>
          <p>• Created: {format(new Date(), 'PPP')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
