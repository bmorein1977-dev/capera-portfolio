import BriefingPage from '@/pages/Briefing';

// Everyone lands on a briefing made for their role (see server/services/homeBriefing.ts). The fuller dashboards each role used to
// land on are still available as detail pages: /dashboard/executive, /my-dashboard, /assessor-dashboard and /verifier-dashboard.
export default function Home() {
  return <BriefingPage />;
}
