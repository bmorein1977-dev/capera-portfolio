import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import type { UserRole } from "@shared/schema";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

// Like AdminGuard, but for routes that need a specific role set rather than the fixed
// admin/super_admin/developer trio - e.g. a read-only report several non-admin roles can reach.
export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const isAllowed = !!user && allowedRoles.includes(user.role as UserRole);

  useEffect(() => {
    if (!isLoading && !isAllowed) {
      setLocation("/");
    }
  }, [isLoading, isAllowed, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
