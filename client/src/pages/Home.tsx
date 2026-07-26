import { useAuth } from '@/hooks/useAuth';
import EnhancedDashboard from '@/components/EnhancedDashboard';
import AssessorDashboard from '@/pages/AssessorDashboard';
import CandidateDashboard from '@/pages/CandidateDashboard';
import VerifierDashboard from '@/pages/VerifierDashboard';

// Everyone used to land on EnhancedDashboard (an admin-oriented executive view built on
// hardcoded mock data) regardless of role. Route candidates, assessors and internal verifiers to
// their own real, per-user dashboards instead - the org-wide executive view is for
// admin/super_admin/developer only.
export default function Home() {
  const { user } = useAuth();

  if (user?.role === 'candidate' || user?.role === 'trainee') {
    return <CandidateDashboard />;
  }
  if (user?.role === 'assessor') {
    return <AssessorDashboard />;
  }
  if (user?.role === 'internal_verifier') {
    return <VerifierDashboard />;
  }
  return <EnhancedDashboard />;
}
