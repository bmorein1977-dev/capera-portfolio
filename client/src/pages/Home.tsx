import { useAuth } from '@/hooks/useAuth';
import { WelcomeOverview } from '@/components/WelcomeOverview';
import AssessorDashboard from '@/pages/AssessorDashboard';
import CandidateDashboard from '@/pages/CandidateDashboard';
import VerifierDashboard from '@/pages/VerifierDashboard';

// Route candidates, assessors and internal verifiers to their own real, per-user dashboards.
// admin/super_admin/developer/manager land on WelcomeOverview (real quick-links only) until the
// dedicated executive dashboard is built.
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
  return <WelcomeOverview />;
}
