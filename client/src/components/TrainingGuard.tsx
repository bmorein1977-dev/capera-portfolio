import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, useTrainingPermissions } from "@/hooks/useAuth";

// Opens a training management screen only for someone the Training Permissions table lets in (for example "providers.view").
// The server enforces the same table; this just keeps people off screens they would only see errors on.
export function TrainingGuard({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const permissions = useTrainingPermissions();
  const allowed = permissions.includes(permission);
  useEffect(() => { if (!isLoading && !allowed) setLocation("/"); }, [isLoading, allowed, setLocation]);
  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" /></div>;
  if (!allowed) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Access denied. You don't have permission to view this page.</p></div>;
  return <>{children}</>;
}
