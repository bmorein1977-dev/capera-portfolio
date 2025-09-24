import { useQuery } from "@tanstack/react-query";
import type { User, UserRole } from "@shared/schema";

// Role hierarchy for authorization checks
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

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Only retry on network errors, not auth errors
    retryOnMount: false,
    refetchOnWindowFocus: false,
  });

  const hasRole = (requiredRole: UserRole) => {
    if (!user?.role) return false;
    return roleHierarchy[user.role as UserRole] >= roleHierarchy[requiredRole];
  };

  const canManageUser = (targetUser: User) => {
    if (!user?.role) return false;
    return roleHierarchy[user.role as UserRole] > roleHierarchy[targetUser.role as UserRole];
  };

  const login = () => {
    window.location.href = "/api/login";
  };

  const logout = () => {
    window.location.href = "/api/logout";
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    hasRole,
    canManageUser,
    login,
    logout,
  };
}