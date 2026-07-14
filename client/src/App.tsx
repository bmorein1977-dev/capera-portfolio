import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SectorThemeProvider } from "@/contexts/SectorThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import LanguageSelector from "@/components/LanguageSelector";
import { UserSwitcher } from "@/components/UserSwitcher";
import { CaperaCursor } from "@/components/CaperaCursor";
import { CaperaCursorProvider } from "@/contexts/CaperaCursorContext";
import { useAuth } from "@/hooks/useAuth";
import DashboardOverview from "@/components/DashboardOverview";
import TeamMatrix from "@/components/TeamMatrix";
import TalentFinder from "@/components/TalentFinder";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import EvidenceUpload from "@/components/EvidenceUpload";
import UserProfile from "@/components/UserProfile";
import TrainingFrameworkBuilder from "@/components/TrainingFrameworkBuilder";
import DeveloperStandards from "@/components/DeveloperStandards";
import AssessorWorkspace from "@/components/AssessorWorkspace";
import SelfAssessment from "@/components/SelfAssessment";
import ResourcesManagement from "@/components/ResourcesManagement";
import EnhancedDashboard from "@/components/EnhancedDashboard";
import GranularReporting from "@/components/GranularReporting";
import CompetencyManager from "@/components/CompetencyManager";
import Landing from "@/pages/Landing";
import MyTraining from "@/pages/MyTraining";
import AssessorDashboard from "@/pages/AssessorDashboard";
import AdminUsers from "@/pages/AdminUsers";
import HistoricalImport from "@/pages/HistoricalImport";
import SkillsGapDashboard from "@/pages/SkillsGapDashboard";
import RoleTransitionPlanning from "@/pages/RoleTransitionPlanning";
import BulkAssignment from "@/pages/BulkAssignment";
import NotificationSettings from "@/pages/NotificationSettings";
import TrainingCatalog from "@/pages/TrainingCatalog";
import MyBookings from "@/pages/MyBookings";
import MyAssessments from "@/pages/MyAssessments";
import VerifierDashboard from "@/pages/VerifierDashboard";
import Setup from "@/pages/Setup";
import NotFound from "@/pages/not-found";
import TrainingManager from "@/pages/admin/TrainingManager";
import JobRoleManagement from "@/pages/admin/JobRoleManagement";
import { AdminGuard } from "@/components/AdminGuard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={EnhancedDashboard} />
      <Route path="/dashboard" component={EnhancedDashboard} />
      <Route path="/overview" component={DashboardOverview} />
      <Route path="/team-matrix" component={TeamMatrix} />
      <Route path="/talent-finder" component={TalentFinder} />
      <Route path="/analytics" component={AnalyticsDashboard} />
      <Route path="/evidence" component={EvidenceUpload} />
      <Route path="/profile" component={UserProfile} />
      <Route path="/training-framework" component={TrainingFrameworkBuilder} />
      <Route path="/developer-standards" component={DeveloperStandards} />
      <Route path="/admin/competency-manager">{() => <AdminGuard><CompetencyManager /></AdminGuard>}</Route>
      <Route path="/assessor-workspace" component={AssessorWorkspace} />
      <Route path="/assessor-dashboard" component={AssessorDashboard} />
      <Route path="/self-assessment" component={SelfAssessment} />
      <Route path="/my-assessments" component={MyAssessments} />
      <Route path="/verifier-dashboard" component={VerifierDashboard} />
      <Route path="/my-training" component={MyTraining} />
      <Route path="/resources" component={ResourcesManagement} />
      <Route path="/reports" component={GranularReporting} />
      <Route path="/skills-gap" component={SkillsGapDashboard} />
      <Route path="/role-transition" component={RoleTransitionPlanning} />
      <Route path="/admin/users">{() => <AdminGuard><AdminUsers /></AdminGuard>}</Route>
      <Route path="/admin/job-roles">{() => <AdminGuard><JobRoleManagement /></AdminGuard>}</Route>
      <Route path="/admin/historical-import">{() => <AdminGuard><HistoricalImport /></AdminGuard>}</Route>
      <Route path="/admin/bulk-assignment">{() => <AdminGuard><BulkAssignment /></AdminGuard>}</Route>
      <Route path="/admin/notifications">{() => <AdminGuard><NotificationSettings /></AdminGuard>}</Route>
      <Route path="/admin/training-manager">{() => <AdminGuard><TrainingManager /></AdminGuard>}</Route>
      <Route path="/training-catalog" component={TrainingCatalog} />
      <Route path="/my-bookings" component={MyBookings} />
      <Route path="/setup" component={Setup} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  // Custom sidebar width for skills management application
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <UserSwitcher />
              <LanguageSelector />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CaperaCursorProvider>
        <TooltipProvider>
          <ThemeProvider>
            <SectorThemeProvider>
              <AppContent />
              <Toaster />
              <CaperaCursor />
            </SectorThemeProvider>
          </ThemeProvider>
        </TooltipProvider>
      </CaperaCursorProvider>
    </QueryClientProvider>
  );
}

export default App;
