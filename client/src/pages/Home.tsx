import { useAuth } from '@/hooks/useAuth';
import EnhancedDashboard from '@/components/EnhancedDashboard';
import AssessorDashboard from '@/pages/AssessorDashboard';
import CandidateDashboard from '@/pages/CandidateDashboard';

// Everyone used to land on EnhancedDashboard (an admin-oriented executive view built on
// hardcoded mock data) regardless of role. Route candidates and assessors to their own
// real, per-user dashboards instead.
export default function Home() {
  const { user } = useAuth();

  if (user?.role === 'candidate' || user?.role === 'trainee') {
    return <CandidateDashboard />;
  }
  if (user?.role === 'assessor') {
    return <AssessorDashboard />;
  }
  return <EnhancedDashboard />;
}
