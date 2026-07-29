import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface AdminGuardProps {
  children: React.ReactNode;
  // Lets a specific admin page also admit someone who only holds a granted secondary role (e.g.
  // training_administrator), without loosening the default admin-tier-only check everywhere else
  // AdminGuard is used.
  extraRoles?: string[];
  // Full override of the default admin/super_admin/developer check, for a page that must be
  // strictly narrower (e.g. OPTIO - admin/super_admin only, explicitly not developer). Checked
  // against the primary role only, not effectiveRoles - unlike extraRoles, this isn't about
  // admitting a granted secondary role.
  roles?: string[];
}

export function AdminGuard({ children, extraRoles, roles }: AdminGuardProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const isAdmin = roles
    ? !!user?.role && roles.includes(user.role)
    : user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'developer'
      || (extraRoles?.some(role => user?.effectiveRoles?.includes(role)) ?? false);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      setLocation("/");
    }
  }, [isLoading, isAdmin, setLocation]);

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

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
