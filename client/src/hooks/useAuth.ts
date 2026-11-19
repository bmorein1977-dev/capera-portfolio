import { useQuery } from "@tanstack/react-query";
import type { Tier } from "@shared/licence";
import type { User, UserRole } from "@shared/schema";

// Role hierarchy for authorization checks
export const roleHierarchy: Record<UserRole, number> = {
  developer: 8,
  super_admin: 7,
  admin: 6,
  manager: 5,
  internal_verifier: 4,
  assessor: 3,
  candidate: 2,
  trainee: 1,
};

export const roleLabels: Record<UserRole, string> = {
  developer: 'Developer',
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  internal_verifier: 'Internal Verifier',
  assessor: 'Assessor',
  candidate: 'Candidate',
  trainee: 'Trainee',
};

// GET /api/auth/user attaches this on top of the plain User record - see server/routes.ts.
export type AuthUser = User & { effectiveRoles?: string[]; licenceTier?: Tier; trainingPermissions?: string[] };

/** What this person may do in training, from the Training Permissions table (for example "providers.view"). */
export function useTrainingPermissions(): string[] {
  const { data } = useQuery<AuthUser>({ queryKey: ["/api/auth/user"], retry: false, retryOnMount: false, refetchOnWindowFocus: false });
  return data?.trainingPermissions ?? [];
}

/** The level this deployment is licensed for (Gold when the server does not say, so nothing is hidden by accident). */
export function useLicence(): Tier {
  const { data } = useQuery<AuthUser>({ queryKey: ["/api/auth/user"], retry: false, retryOnMount: false, refetchOnWindowFocus: false });
  return data?.licenceTier ?? "gold";
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<AuthUser>({
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
    error,
    isAuthenticated: !!user,
    hasRole,
    canManageUser,
    login,
    logout,
  };
}