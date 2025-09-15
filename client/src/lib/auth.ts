// Mock authentication system for the prototype
// TODO: Replace with real authentication implementation

export type UserRole = 'developer' | 'super_admin' | 'admin' | 'internal_verifier' | 'assessor' | 'candidate' | 'trainee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  location?: string;
  avatar?: string;
}

export const mockUsers: User[] = [
  { id: '1', name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'super_admin', department: 'IT', location: 'HQ' },
  { id: '2', name: 'Mike Johnson', email: 'mike.johnson@company.com', role: 'admin', department: 'Operations', location: 'Site A' },
  { id: '3', name: 'Lisa Rodriguez', email: 'lisa.rodriguez@company.com', role: 'internal_verifier', department: 'Quality', location: 'Site B' },
  { id: '4', name: 'David Kim', email: 'david.kim@company.com', role: 'assessor', department: 'Training', location: 'Site A' },
  { id: '5', name: 'Emma Wilson', email: 'emma.wilson@company.com', role: 'candidate', department: 'Manufacturing', location: 'Site B' },
  { id: '6', name: 'Alex Thompson', email: 'alex.thompson@company.com', role: 'trainee', department: 'Maintenance', location: 'Site C' },
];

export const roleHierarchy: Record<UserRole, number> = {
  developer: 7,
  super_admin: 6,
  admin: 5,
  internal_verifier: 4,
  assessor: 3,
  candidate: 2,
  trainee: 1,
};

export const roleLabels: Record<UserRole, string> = {
  developer: 'Developer',
  super_admin: 'Super Admin',
  admin: 'Admin',
  internal_verifier: 'Internal Verifier',
  assessor: 'Assessor',
  candidate: 'Candidate',
  trainee: 'Trainee',
};

export const useAuth = () => {
  // Mock current user - in real app this would come from auth context
  const currentUser = mockUsers[0]; // Sarah Chen as Super Admin
  
  const hasRole = (requiredRole: UserRole) => {
    return roleHierarchy[currentUser.role] >= roleHierarchy[requiredRole];
  };

  const canManageUser = (targetUser: User) => {
    return roleHierarchy[currentUser.role] > roleHierarchy[targetUser.role];
  };

  return {
    user: currentUser,
    isAuthenticated: true,
    hasRole,
    canManageUser,
    login: (email: string, password: string) => console.log('Login:', email),
    logout: () => console.log('Logout'),
  };
};