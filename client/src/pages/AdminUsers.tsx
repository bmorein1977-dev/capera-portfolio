import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Users, 
  Search,
  Shield,
  RefreshCw,
  Database,
  UserPlus,
  Eye,
  Edit,
  Trash2,
  Award,
  Briefcase,
  AlertCircle,
  GraduationCap,
  Plus,
  X
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
  jobRoleId: string | null;
  dateOfBirth: string | null;
  companyNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface JobRole {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

interface Assessment {
  id: string;
  userId: string;
  elementId: string;
  status: string;
  expiryDate: string | null;
  completionDate: string | null;
  element?: {
    id: string;
    name: string;
    code: string;
  };
}

interface TrainingEnrollment {
  id: string;
  userId: string;
  trainingId: string;
  status: string;
  allocatedDate: string | null;
  dueDate: string | null;
  training?: {
    id: string;
    name: string;
  };
}

interface UserDetails extends User {
  jobRole?: JobRole;
  assessments?: Assessment[];
  trainingEnrollments?: TrainingEnrollment[];
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isAddElementDialogOpen, setIsAddElementDialogOpen] = useState(false);
  const [isEditAssessmentDialogOpen, setIsEditAssessmentDialogOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [selectedElementForAdd, setSelectedElementForAdd] = useState('');
  const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState('');
  const [selectedLevelForAdd, setSelectedLevelForAdd] = useState('');
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'candidate' as UserRole,
    location: '',
    teamShift: '',
    jobRoleId: '',
    assessorId: '',
    dateOfBirth: '',
    companyNumber: '',
  });
  const [editUser, setEditUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'candidate' as UserRole,
    location: '',
    jobRoleId: '',
    assessorId: '',
    dateOfBirth: '',
    companyNumber: '',
  });

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch job roles
  const { data: jobRoles = [] } = useQuery<JobRole[]>({
    queryKey: ['/api/job-roles'],
  });

  // Fetch assessors (users with assessor role)
  const { data: assessors = [] } = useQuery<User[]>({
    queryKey: ['/api/users', 'assessors'],
    queryFn: async () => {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch users');
      const allUsers = await response.json();
      return allUsers.filter((u: User) => u.role === 'assessor' || u.role === 'admin' || u.role === 'super_admin');
    },
  });

  // Fetch competency categories
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['/api/competency-categories'],
  });

  // Fetch competency elements
  const { data: allElements = [] } = useQuery<any[]>({
    queryKey: ['/api/competency-elements'],
  });

  // Fetch competency levels
  const { data: allLevels = [] } = useQuery<any[]>({
    queryKey: ['/api/competency-levels'],
  });

  // Fetch user details (job role, assessments, and training enrollments)
  const { data: userDetails, isLoading: loadingDetails } = useQuery<UserDetails>({
    queryKey: ['/api/users', selectedUserId],
    enabled: !!selectedUserId && isDetailsDialogOpen,
    queryFn: async () => {
      if (!selectedUserId) return null;
      
      const [userResponse, assessmentsResponse, enrollmentsResponse] = await Promise.all([
        fetch(`/api/users/${selectedUserId}`, { credentials: 'include' }),
        fetch(`/api/assessments?userId=${selectedUserId}`, { credentials: 'include' }),
        fetch(`/api/training-enrollments?userId=${selectedUserId}`, { credentials: 'include' })
      ]);
      
      if (!userResponse.ok) throw new Error('Failed to fetch user');
      
      const user = await userResponse.json();
      const assessments = assessmentsResponse.ok ? await assessmentsResponse.json() : [];
      const trainingEnrollments = enrollmentsResponse.ok ? await enrollmentsResponse.json() : [];
      
      let jobRole = null;
      if (user.jobRoleId) {
        const jobRoleResponse = await fetch(`/api/job-roles/${user.jobRoleId}`, { credentials: 'include' });
        if (jobRoleResponse.ok) {
          jobRole = await jobRoleResponse.json();
        }
      }
      
      return {
        ...user,
        jobRole,
        assessments,
        trainingEnrollments
      };
    },
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
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
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

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { 
      firstName: string; 
      lastName: string; 
      email: string; 
      role: string;
      location?: string;
      teamShift?: string;
      jobRoleId?: string;
      assessorId?: string;
      dateOfBirth?: string;
      companyNumber?: string;
    }) => {
      const { assessorId, ...userDataWithoutAssessor } = userData;
      const newUser = await apiRequest('POST', '/api/admin/users', userDataWithoutAssessor);
      
      // If assessor is assigned and user is candidate/trainee, create candidate allocation
      if (assessorId && (userData.role === 'candidate' || userData.role === 'trainee')) {
        await apiRequest('POST', '/api/candidate-allocations', {
          assessorId,
          candidateId: newUser.id,
        });
      }
      
      return newUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsCreateDialogOpen(false);
      setNewUser({ 
        firstName: '', 
        lastName: '', 
        email: '', 
        role: 'candidate',
        location: '',
        teamShift: '',
        jobRoleId: '',
        assessorId: '',
        dateOfBirth: '',
        companyNumber: '',
      });
      toast({
        title: 'User Created',
        description: 'User has been created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: { 
      userId: string;
      firstName?: string; 
      lastName?: string; 
      email?: string; 
      role?: string;
      location?: string;
      jobRoleId?: string;
      assessorId?: string;
      dateOfBirth?: string;
      companyNumber?: string;
    }) => {
      const { userId, assessorId, ...data } = userData;
      
      // Fetch current user to check previous role and email
      const currentUserResponse = await fetch(`/api/users/${userId}`, { credentials: 'include' });
      const currentUser = currentUserResponse.ok ? await currentUserResponse.json() : null;
      const previousRole = currentUser?.role;
      
      // Remove email from update if it hasn't changed to avoid unique constraint violation
      if (currentUser && data.email === currentUser.email) {
        delete data.email;
      }
      
      // Update the user
      const updatedUser = await apiRequest('PATCH', `/api/users/${userId}`, data);
      
      // Get existing candidate allocation
      const allocationsResponse = await fetch(`/api/candidate-allocations?candidateId=${userId}`, { credentials: 'include' });
      const existingAllocations = allocationsResponse.ok ? await allocationsResponse.json() : [];
      
      // Handle assessor assignment changes
      const isNowCandidateOrTrainee = userData.role === 'candidate' || userData.role === 'trainee';
      const wasCandidateOrTrainee = previousRole === 'candidate' || previousRole === 'trainee';
      
      if (isNowCandidateOrTrainee) {
        // User is candidate/trainee - manage their assessor assignment
        if (assessorId) {
          // Assign or update assessor
          if (existingAllocations.length > 0) {
            await apiRequest('PATCH', `/api/candidate-allocations/${existingAllocations[0].id}`, {
              assessorId,
            });
          } else {
            await apiRequest('POST', '/api/candidate-allocations', {
              assessorId,
              candidateId: userId,
            });
          }
        } else {
          // Remove assessor assignment
          if (existingAllocations.length > 0) {
            await apiRequest('DELETE', `/api/candidate-allocations/${existingAllocations[0].id}`);
          }
        }
      } else if (wasCandidateOrTrainee && !isNowCandidateOrTrainee) {
        // Role changed from candidate/trainee to another role - clean up allocation
        if (existingAllocations.length > 0) {
          await apiRequest('DELETE', `/api/candidate-allocations/${existingAllocations[0].id}`);
        }
      }
      
      return updatedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/candidate-allocations'] });
      setIsEditDialogOpen(false);
      setSelectedUserId(null);
      toast({
        title: 'User Updated',
        description: 'User has been updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest('DELETE', `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDeleteDialogOpen(false);
      setIsDetailsDialogOpen(false);
      setSelectedUserId(null);
      toast({
        title: 'User Deleted',
        description: 'User has been deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    },
  });

  // Bulk delete users mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return await apiRequest('POST', '/api/users/bulk-delete', { userIds });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsBulkDeleteDialogOpen(false);
      setSelectedUserIds([]);
      toast({
        title: 'Users Deleted',
        description: `Successfully deleted ${data.deleted} user(s)${data.failed > 0 ? `. ${data.failed} failed.` : ''}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Bulk Deletion Failed',
        description: error.message || 'Failed to delete users',
        variant: 'destructive',
      });
    },
  });

  // Add element to user mutation
  const addElementMutation = useMutation({
    mutationFn: async (data: { userId: string; elementId: string; levelId?: string }) => {
      if (!currentUser?.id) throw new Error('No current user');
      return await apiRequest('POST', '/api/admin/bulk-assign-element', {
        userIds: [data.userId],
        elementId: data.elementId,
        levelId: data.levelId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['/api/assessments'] });
      setIsAddElementDialogOpen(false);
      setSelectedElementForAdd('');
      setSelectedCategoryForAdd('');
      setSelectedLevelForAdd('');
      toast({
        title: 'Element Added',
        description: 'Competence element has been assigned successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Assignment Failed',
        description: error.message || 'Failed to assign competence element',
        variant: 'destructive',
      });
    },
  });

  // Remove assessment mutation
  const removeAssessmentMutation = useMutation({
    mutationFn: async (assessmentId: string) => {
      return await apiRequest('DELETE', `/api/assessments/${assessmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['/api/assessments'] });
      toast({
        title: 'Assessment Removed',
        description: 'Assessment has been removed successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Removal Failed',
        description: error.message || 'Failed to remove assessment',
        variant: 'destructive',
      });
    },
  });

  // Edit assessment mutation
  const editAssessmentMutation = useMutation({
    mutationFn: async (data: { assessmentId: string; outcome?: string; expiryDate?: string; completionDate?: string }) => {
      return await apiRequest('PATCH', `/api/assessments/${data.assessmentId}`, {
        outcome: data.outcome,
        expiryDate: data.expiryDate,
        completionDate: data.completionDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['/api/assessments'] });
      setIsEditAssessmentDialogOpen(false);
      setSelectedAssessment(null);
      toast({
        title: 'Assessment Updated',
        description: 'Assessment details have been updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update assessment',
        variant: 'destructive',
      });
    },
  });

  // Filter elements by category for add element dialog
  const filteredElements = selectedCategoryForAdd 
    ? allElements.filter((el: any) => el.categoryId === selectedCategoryForAdd) 
    : [];
  
  // Get levels for selected element
  const elementLevels = selectedElementForAdd
    ? allLevels.filter((l: any) => l.elementId === selectedElementForAdd).sort((a: any, b: any) => a.order - b.order)
    : [];

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

  const handleViewDetails = (userId: string) => {
    setSelectedUserId(userId);
    setIsDetailsDialogOpen(true);
  };

  const handleEditUser = async (user: User) => {
    // Fetch current assessor assignment if user is candidate
    let currentAssessorId = '';
    if (user.role === 'candidate' || user.role === 'trainee') {
      try {
        const response = await fetch(`/api/candidate-allocations?candidateId=${user.id}`, { credentials: 'include' });
        if (response.ok) {
          const allocations = await response.json();
          if (allocations.length > 0) {
            currentAssessorId = allocations[0].assessorId;
          }
        }
      } catch (error) {
        console.error('Failed to fetch assessor allocation:', error);
      }
    }
    
    // Format dateOfBirth for date input (expects YYYY-MM-DD)
    let formattedDateOfBirth = '';
    if (user.dateOfBirth) {
      const date = new Date(user.dateOfBirth);
      if (!isNaN(date.getTime())) {
        formattedDateOfBirth = date.toISOString().split('T')[0];
      }
    }
    
    setEditUser({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role as UserRole,
      location: user.location || '',
      jobRoleId: user.jobRoleId || '',
      assessorId: currentAssessorId,
      dateOfBirth: formattedDateOfBirth,
      companyNumber: user.companyNumber || '',
    });
    setSelectedUserId(user.id);
    setIsDetailsDialogOpen(false);
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    setSelectedUserId(userId);
    setIsDetailsDialogOpen(false);
    setIsDeleteDialogOpen(true);
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'competent':
        return 'default';
      case 'not_yet_competent':
        return 'secondary';
      case 'expired':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatStatus = (status: string) => {
    if (!status) return '';
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds([...selectedUserIds, userId]);
    } else {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    } else {
      setSelectedUserIds([]);
    }
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
        <div className="flex gap-2">
          {selectedUserIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              data-testid="button-delete-selected"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedUserIds.length})
            </Button>
          )}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" data-testid="button-create-user">
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-user">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the platform with a specific role
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    placeholder="Enter first name"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    placeholder="Enter last name"
                    data-testid="input-last-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Enter email address"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) => setNewUser({ ...newUser, role: value as UserRole })}
                  >
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Select role" />
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
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newUser.location}
                    onChange={(e) => setNewUser({ ...newUser, location: e.target.value })}
                    placeholder="Enter location (optional)"
                    data-testid="input-location"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teamShift">Team/Shift</Label>
                  <Input
                    id="teamShift"
                    value={newUser.teamShift}
                    onChange={(e) => setNewUser({ ...newUser, teamShift: e.target.value })}
                    placeholder="Enter team/shift (optional)"
                    data-testid="input-team-shift"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobRole">Job Role (Optional)</Label>
                  <Select
                    value={newUser.jobRoleId || "none"}
                    onValueChange={(value) => setNewUser({ ...newUser, jobRoleId: value === "none" ? "" : value })}
                  >
                    <SelectTrigger data-testid="select-job-role">
                      <SelectValue placeholder="Select job role (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {jobRoles.map((jobRole) => (
                        <SelectItem key={jobRole.id} value={jobRole.id}>
                          {jobRole.name} ({jobRole.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(newUser.role === 'candidate' || newUser.role === 'trainee') && (
                  <div className="space-y-2">
                    <Label htmlFor="assessor">Assessor (Optional)</Label>
                    <Select
                      value={newUser.assessorId || "none"}
                      onValueChange={(value) => setNewUser({ ...newUser, assessorId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger data-testid="select-assessor">
                        <SelectValue placeholder="Select assessor (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {assessors.map((assessor) => (
                          <SelectItem key={assessor.id} value={assessor.id}>
                            {getDisplayName(assessor)} ({roleLabels[assessor.role as UserRole]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={newUser.dateOfBirth}
                    onChange={(e) => setNewUser({ ...newUser, dateOfBirth: e.target.value })}
                    data-testid="input-date-of-birth"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyNumber">Company Number</Label>
                  <Input
                    id="companyNumber"
                    value={newUser.companyNumber}
                    onChange={(e) => setNewUser({ ...newUser, companyNumber: e.target.value })}
                    placeholder="Enter company number (optional)"
                    data-testid="input-company-number"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const userData: any = {
                      firstName: newUser.firstName,
                      lastName: newUser.lastName,
                      email: newUser.email,
                      role: newUser.role,
                    };
                    if (newUser.location) userData.location = newUser.location;
                    if (newUser.teamShift) userData.teamShift = newUser.teamShift;
                    if (newUser.jobRoleId) userData.jobRoleId = newUser.jobRoleId;
                    if (newUser.assessorId) userData.assessorId = newUser.assessorId;
                    if (newUser.dateOfBirth) userData.dateOfBirth = newUser.dateOfBirth;
                    if (newUser.companyNumber) userData.companyNumber = newUser.companyNumber;
                    createUserMutation.mutate(userData);
                  }}
                  disabled={createUserMutation.isPending || !newUser.email || !newUser.firstName || !newUser.lastName}
                  data-testid="button-submit-user"
                >
                  {createUserMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create User'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button 
            onClick={() => seedDataMutation.mutate()}
            disabled={seedDataMutation.isPending}
            variant="outline"
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                onCheckedChange={handleSelectAll}
                data-testid="checkbox-select-all"
              />
              <div>
                <CardTitle>Users ({filteredUsers.length})</CardTitle>
                <CardDescription>
                  View and manage user roles and permissions
                </CardDescription>
              </div>
            </div>
          </div>
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
                    {/* Checkbox */}
                    <Checkbox
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={(checked) => handleSelectUser(user.id, checked as boolean)}
                      data-testid={`checkbox-user-${user.id}`}
                    />
                    
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

                    {/* Actions and Role */}
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={roleColors[user.role as UserRole]}
                        data-testid={`badge-current-role-${user.id}`}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {roleLabels[user.role as UserRole]}
                      </Badge>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(user.id)}
                        data-testid={`button-view-details-${user.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        data-testid={`button-edit-${user.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        data-testid={`button-delete-${user.id}`}
                        disabled={user.id === currentUser?.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
          <p>• Click <strong>View</strong> to see full user details including job role and competence elements</p>
          <p>• Use the <strong>Edit</strong> button to update user information</p>
          <p>• Use the <strong>Create Test Data</strong> button to generate sample candidates, allocations, and assessments</p>
          <p>• Created: {format(new Date(), 'PPP')}</p>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={(open) => {
        setIsDetailsDialogOpen(open);
        if (!open) setSelectedUserId(null);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-user-details">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View comprehensive user information, job role, and competence elements
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : userDetails ? (
            <div className="space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{getDisplayName(userDetails)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{userDetails.email || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Role</Label>
                    <Badge className={roleColors[userDetails.role as UserRole]}>
                      {roleLabels[userDetails.role as UserRole]}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">{userDetails.location || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Team/Shift</Label>
                    <p className="font-medium">{userDetails.teamShift || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">{userDetails.dateOfBirth ? format(new Date(userDetails.dateOfBirth), 'PPP') : 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Company Number</Label>
                    <p className="font-medium">{userDetails.companyNumber || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Job Role */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Job Role
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userDetails.jobRole ? (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-muted-foreground">Name</Label>
                        <p className="font-medium">{userDetails.jobRole.name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Code</Label>
                        <p className="font-medium">{userDetails.jobRole.code}</p>
                      </div>
                      {userDetails.jobRole.description && (
                        <div>
                          <Label className="text-muted-foreground">Description</Label>
                          <p className="text-sm">{userDetails.jobRole.description}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No job role assigned</p>
                  )}
                </CardContent>
              </Card>

              {/* Competence Elements & Assessments */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Competence Elements ({userDetails.assessments?.length || 0})
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddElementDialogOpen(true)}
                      data-testid="button-add-element"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Element
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {userDetails.assessments && userDetails.assessments.length > 0 ? (
                    <div className="space-y-2">
                      {userDetails.assessments.map((assessment) => (
                        <div
                          key={assessment.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover-elevate group"
                          data-testid={`assessment-item-${assessment.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {assessment.element?.name || `Element ${assessment.elementId}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {assessment.element?.code || 'N/A'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusBadgeVariant(assessment.status)}>
                              {formatStatus(assessment.status)}
                            </Badge>
                            {assessment.expiryDate && (
                              <p className="text-sm text-muted-foreground">
                                Expires: {format(new Date(assessment.expiryDate), 'PP')}
                              </p>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAssessment(assessment);
                                setIsEditAssessmentDialogOpen(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-edit-assessment-${assessment.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Are you sure you want to remove this assessment?')) {
                                  removeAssessmentMutation.mutate(assessment.id);
                                }
                              }}
                              disabled={removeAssessmentMutation.isPending}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-remove-assessment-${assessment.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No competence elements assigned</p>
                  )}
                </CardContent>
              </Card>

              {/* Training Enrollments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Training Courses ({userDetails.trainingEnrollments?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userDetails.trainingEnrollments && userDetails.trainingEnrollments.length > 0 ? (
                    <div className="space-y-2">
                      {userDetails.trainingEnrollments.map((enrollment) => (
                        <div
                          key={enrollment.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {enrollment.training?.name || `Training ${enrollment.trainingId}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {enrollment.allocatedDate 
                                ? `Assigned: ${format(new Date(enrollment.allocatedDate), 'PP')}`
                                : 'Not assigned'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                enrollment.status === 'completed' ? 'default' :
                                enrollment.status === 'in_progress' ? 'secondary' :
                                'outline'
                              }
                              data-testid={`badge-training-status-${enrollment.id}`}
                            >
                              {formatStatus(enrollment.status)}
                            </Badge>
                            {enrollment.dueDate && (
                              <p className="text-sm text-muted-foreground">
                                Due: {format(new Date(enrollment.dueDate), 'PP')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No training courses assigned</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Failed to load user details</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailsDialogOpen(false)}
              data-testid="button-close-details"
            >
              Close
            </Button>
            {userDetails && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleEditUser(userDetails)}
                  data-testid="button-edit-from-details"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteUser(userDetails.id)}
                  disabled={userDetails.id === currentUser?.id}
                  data-testid="button-delete-from-details"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setSelectedUserId(null);
      }}>
        <DialogContent data-testid="dialog-edit-user">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">First Name</Label>
              <Input
                id="edit-firstName"
                value={editUser.firstName}
                onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })}
                data-testid="input-edit-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">Last Name</Label>
              <Input
                id="edit-lastName"
                value={editUser.lastName}
                onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })}
                data-testid="input-edit-last-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editUser.role}
                onValueChange={(value) => setEditUser({ ...editUser, role: value as UserRole })}
              >
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
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
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={editUser.location}
                onChange={(e) => setEditUser({ ...editUser, location: e.target.value })}
                data-testid="input-edit-location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-jobRole">Job Role</Label>
              <Select
                value={editUser.jobRoleId || "none"}
                onValueChange={(value) => setEditUser({ ...editUser, jobRoleId: value === "none" ? "" : value })}
              >
                <SelectTrigger data-testid="select-edit-job-role">
                  <SelectValue placeholder="Select job role (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {jobRoles.map((jobRole) => (
                    <SelectItem key={jobRole.id} value={jobRole.id}>
                      {jobRole.name} ({jobRole.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(editUser.role === 'candidate' || editUser.role === 'trainee') && (
              <div className="space-y-2">
                <Label htmlFor="edit-assessor">Assessor (Optional)</Label>
                <Select
                  value={editUser.assessorId || "none"}
                  onValueChange={(value) => setEditUser({ ...editUser, assessorId: value === "none" ? "" : value })}
                >
                  <SelectTrigger data-testid="select-edit-assessor">
                    <SelectValue placeholder="Select assessor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {assessors.map((assessor) => (
                      <SelectItem key={assessor.id} value={assessor.id}>
                        {getDisplayName(assessor)} ({roleLabels[assessor.role as UserRole]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-dateOfBirth">Date of Birth</Label>
              <Input
                id="edit-dateOfBirth"
                type="date"
                value={editUser.dateOfBirth}
                onChange={(e) => setEditUser({ ...editUser, dateOfBirth: e.target.value })}
                data-testid="input-edit-date-of-birth"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-companyNumber">Company Number</Label>
              <Input
                id="edit-companyNumber"
                value={editUser.companyNumber}
                onChange={(e) => setEditUser({ ...editUser, companyNumber: e.target.value })}
                data-testid="input-edit-company-number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedUserId) return;
                const userData: any = { 
                  userId: selectedUserId,
                  role: editUser.role // Always include role for assessor assignment logic
                };
                if (editUser.firstName) userData.firstName = editUser.firstName;
                if (editUser.lastName) userData.lastName = editUser.lastName;
                if (editUser.email) userData.email = editUser.email;
                if (editUser.location) userData.location = editUser.location;
                if (editUser.jobRoleId) userData.jobRoleId = editUser.jobRoleId;
                if (editUser.dateOfBirth) userData.dateOfBirth = editUser.dateOfBirth;
                if (editUser.companyNumber) userData.companyNumber = editUser.companyNumber;
                // Include assessorId for candidates/trainees (empty string means remove assessor)
                if (editUser.role === 'candidate' || editUser.role === 'trainee') {
                  userData.assessorId = editUser.assessorId || '';
                }
                updateUserMutation.mutate(userData);
              }}
              disabled={updateUserMutation.isPending || !editUser.email || !editUser.firstName || !editUser.lastName}
              data-testid="button-submit-edit"
            >
              {updateUserMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        setIsDeleteDialogOpen(open);
        if (!open) setSelectedUserId(null);
      }}>
        <DialogContent data-testid="dialog-delete-user">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="text-sm">
              All user data, including assessments and evidence, will be permanently deleted.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedUserId) {
                  deleteUserMutation.mutate(selectedUserId);
                }
              }}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent data-testid="dialog-bulk-delete">
          <DialogHeader>
            <DialogTitle>Delete Multiple Users</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUserIds.length} user(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="text-sm">
              All user data for the selected {selectedUserIds.length} user(s), including assessments and evidence, will be permanently deleted.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              data-testid="button-cancel-bulk-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(selectedUserIds)}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedUserIds.length} User(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Element Dialog */}
      <Dialog open={isAddElementDialogOpen} onOpenChange={setIsAddElementDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-add-element">
          <DialogHeader>
            <DialogTitle>Add Competence Element</DialogTitle>
            <DialogDescription>
              Assign a new competence element to {userDetails?.firstName} {userDetails?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Competence Category</Label>
              <Select value={selectedCategoryForAdd} onValueChange={setSelectedCategoryForAdd}>
                <SelectTrigger data-testid="select-add-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Competence Element</Label>
              <Select
                value={selectedElementForAdd}
                onValueChange={(val) => {
                  setSelectedElementForAdd(val);
                  setSelectedLevelForAdd(''); // Reset level when element changes
                }}
                disabled={!selectedCategoryForAdd}
              >
                <SelectTrigger data-testid="select-add-element">
                  <SelectValue placeholder={selectedCategoryForAdd ? "Select an element" : "Select a category first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredElements.map((element: any) => (
                    <SelectItem key={element.id} value={element.id}>
                      {element.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {elementLevels.length > 0 && (
              <div className="space-y-2">
                <Label>Proficiency Level (Optional)</Label>
                <Select
                  value={selectedLevelForAdd}
                  onValueChange={setSelectedLevelForAdd}
                  disabled={!selectedElementForAdd}
                >
                  <SelectTrigger data-testid="select-add-level">
                    <SelectValue placeholder="No specific level (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No specific level (default)</SelectItem>
                    {elementLevels.map((level: any) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  If no level is selected, a general assessment without a specific proficiency level will be created.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddElementDialogOpen(false);
                setSelectedElementForAdd('');
                setSelectedCategoryForAdd('');
                setSelectedLevelForAdd('');
              }}
              data-testid="button-cancel-add-element"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedUserId && selectedElementForAdd) {
                  addElementMutation.mutate({
                    userId: selectedUserId,
                    elementId: selectedElementForAdd,
                    levelId: selectedLevelForAdd || undefined,
                  });
                }
              }}
              disabled={!selectedElementForAdd || addElementMutation.isPending}
              data-testid="button-confirm-add-element"
            >
              {addElementMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Element
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Assessment Dialog */}
      <Dialog open={isEditAssessmentDialogOpen} onOpenChange={setIsEditAssessmentDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-assessment">
          <DialogHeader>
            <DialogTitle>Edit Assessment</DialogTitle>
            <DialogDescription>
              Update assessment details for {selectedAssessment?.element?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedAssessment && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Outcome</Label>
                <Select
                  defaultValue={selectedAssessment.status}
                  onValueChange={(value) => {
                    setSelectedAssessment({ ...selectedAssessment, status: value });
                  }}
                >
                  <SelectTrigger data-testid="select-edit-outcome">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_yet_competent">Not Yet Competent</SelectItem>
                    <SelectItem value="competent">Competent</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Completion Date</Label>
                <Input
                  type="date"
                  defaultValue={selectedAssessment.completionDate ? new Date(selectedAssessment.completionDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    setSelectedAssessment({ ...selectedAssessment, completionDate: e.target.value || null });
                  }}
                  data-testid="input-edit-completion-date"
                />
              </div>

              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  defaultValue={selectedAssessment.expiryDate ? new Date(selectedAssessment.expiryDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    setSelectedAssessment({ ...selectedAssessment, expiryDate: e.target.value || null });
                  }}
                  data-testid="input-edit-expiry-date"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditAssessmentDialogOpen(false);
                setSelectedAssessment(null);
              }}
              data-testid="button-cancel-edit-assessment"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedAssessment) {
                  editAssessmentMutation.mutate({
                    assessmentId: selectedAssessment.id,
                    outcome: selectedAssessment.status,
                    completionDate: selectedAssessment.completionDate || undefined,
                    expiryDate: selectedAssessment.expiryDate || undefined,
                  });
                }
              }}
              disabled={!selectedAssessment || editAssessmentMutation.isPending}
              data-testid="button-confirm-edit-assessment"
            >
              {editAssessmentMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
