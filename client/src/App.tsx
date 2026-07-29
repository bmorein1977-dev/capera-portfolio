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
import EvidenceUpload from "@/components/EvidenceUpload";
import UserProfile from "@/components/UserProfile";
import AssessorWorkspace from "@/components/AssessorWorkspace";
import SelfAssessment from "@/components/SelfAssessment";
import Home from "@/pages/Home";
import CompetencyManager from "@/components/CompetencyManager";
import Landing from "@/pages/Landing";
import MyTraining from "@/pages/MyTraining";
import AssessorDashboard from "@/pages/AssessorDashboard";
import AdminUsers from "@/pages/AdminUsers";
import HistoricalImport from "@/pages/HistoricalImport";
import SkillsGapDashboard from "@/pages/SkillsGapDashboard";
import RoleTransitionPlanning from "@/pages/RoleTransitionPlanning";
import TeamComplianceMatrix from "@/pages/TeamComplianceMatrix";
import BulkAssignment from "@/pages/BulkAssignment";
import NotificationSettings from "@/pages/NotificationSettings";
import TrainingCatalog from "@/pages/TrainingCatalog";
import MyBookings from "@/pages/MyBookings";
import MyAssessments from "@/pages/MyAssessments";
import VerifierDashboard from "@/pages/VerifierDashboard";
import TrainingApprovals from "@/pages/TrainingApprovals";
import Setup from "@/pages/Setup";
import NotFound from "@/pages/not-found";
import TrainingManager from "@/pages/admin/TrainingManager";
import JobRoleManagement from "@/pages/admin/JobRoleManagement";
import TrainingMatrixImport from "@/pages/admin/TrainingMatrixImport";
import TrainingCourseLibrary from "@/pages/admin/TrainingCourseLibrary";
import OrganisationStructureAdmin from "@/pages/admin/OrganisationStructureAdmin";
import StrategicWorkforcePlanning from "@/pages/admin/StrategicWorkforcePlanning";
import InductionProgramsAdmin from "@/pages/admin/InductionProgramsAdmin";
import WorkforceLifecycleAdmin from "@/pages/admin/WorkforceLifecycleAdmin";
import KpiTargetsAdmin from "@/pages/admin/KpiTargetsAdmin";
import TrainingContentAdmin from "@/pages/admin/TrainingContentAdmin";
import TrainingCompletionsReport from "@/pages/admin/TrainingCompletionsReport";
import MyOnboarding from "@/pages/MyOnboarding";
import CompetenceDocumentImport from "@/pages/admin/CompetenceDocumentImport";
import StandardAuthoringWizard from "@/pages/admin/StandardAuthoringWizard";
import InternalVerificationManagement from "@/pages/admin/InternalVerificationManagement";
import CompetenceBadge from "@/pages/CompetenceBadge";
import Element3KpiDashboard from "@/pages/Element3KpiDashboard";
import ComplianceExplorer from "@/pages/ComplianceExplorer";
import CompetenceDetailReport from "@/pages/CompetenceDetailReport";
import OrgChart from "@/pages/OrgChart";
import TrainingProvidersAdmin from "@/pages/admin/TrainingProvidersAdmin";
import TrainingVenuesAdmin from "@/pages/admin/TrainingVenuesAdmin";
import TrainingCoursesAdmin from "@/pages/admin/TrainingCoursesAdmin";
import TrainingSessionsAdmin from "@/pages/admin/TrainingSessionsAdmin";
import TrainingPolicyMatrixAdmin from "@/pages/admin/TrainingPolicyMatrixAdmin";
import BookingManagementAdmin from "@/pages/admin/BookingManagementAdmin";
import { AdminGuard } from "@/components/AdminGuard";
import { RoleGuard } from "@/components/RoleGuard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Home} />
      <Route path="/evidence" component={EvidenceUpload} />
      <Route path="/profile" component={UserProfile} />
      <Route path="/admin/competency-manager">{() => <AdminGuard><CompetencyManager /></AdminGuard>}</Route>
      <Route path="/admin/standard-wizard">{() => <AdminGuard><StandardAuthoringWizard /></AdminGuard>}</Route>
      <Route path="/assessor-workspace" component={AssessorWorkspace} />
      <Route path="/assessor-dashboard" component={AssessorDashboard} />
      <Route path="/self-assessment" component={SelfAssessment} />
      <Route path="/my-assessments" component={MyAssessments} />
      <Route path="/verifier-dashboard" component={VerifierDashboard} />
      <Route path="/training-approvals" component={TrainingApprovals} />
      <Route path="/my-training" component={MyTraining} />
      <Route path="/skills-gap" component={SkillsGapDashboard} />
      <Route path="/role-transition" component={RoleTransitionPlanning} />
      <Route path="/team-compliance" component={TeamComplianceMatrix} />
      <Route path="/admin/users">{() => <AdminGuard><AdminUsers /></AdminGuard>}</Route>
      <Route path="/admin/job-roles">{() => <AdminGuard><JobRoleManagement /></AdminGuard>}</Route>
      <Route path="/admin/historical-import">{() => <AdminGuard><HistoricalImport /></AdminGuard>}</Route>
      <Route path="/admin/bulk-assignment">{() => <AdminGuard><BulkAssignment /></AdminGuard>}</Route>
      <Route path="/admin/notifications">{() => <AdminGuard><NotificationSettings /></AdminGuard>}</Route>
      <Route path="/admin/training-manager">{() => <AdminGuard><TrainingManager /></AdminGuard>}</Route>
      <Route path="/admin/training-matrix-import">{() => <AdminGuard><TrainingMatrixImport /></AdminGuard>}</Route>
      <Route path="/admin/training-course-library">{() => <AdminGuard><TrainingCourseLibrary /></AdminGuard>}</Route>
      <Route path="/admin/training-providers">{() => <AdminGuard extraRoles={['training_administrator']}><TrainingProvidersAdmin /></AdminGuard>}</Route>
      <Route path="/admin/training-venues">{() => <AdminGuard extraRoles={['training_administrator']}><TrainingVenuesAdmin /></AdminGuard>}</Route>
      <Route path="/admin/external-training-courses">{() => <AdminGuard extraRoles={['training_administrator']}><TrainingCoursesAdmin /></AdminGuard>}</Route>
      <Route path="/admin/training-sessions">{() => <AdminGuard extraRoles={['training_administrator']}><TrainingSessionsAdmin /></AdminGuard>}</Route>
      <Route path="/admin/training-policy-matrix">{() => <AdminGuard extraRoles={['training_administrator']}><TrainingPolicyMatrixAdmin /></AdminGuard>}</Route>
      <Route path="/admin/course-bookings">{() => <AdminGuard extraRoles={['training_administrator']}><BookingManagementAdmin /></AdminGuard>}</Route>
      <Route path="/admin/organisation-structure">{() => <AdminGuard><OrganisationStructureAdmin /></AdminGuard>}</Route>
      <Route path="/admin/internal-verification">{() => <AdminGuard><InternalVerificationManagement /></AdminGuard>}</Route>
      <Route path="/admin/workforce-planning">{() => <AdminGuard><StrategicWorkforcePlanning /></AdminGuard>}</Route>
      <Route path="/admin/induction-programs">{() => <AdminGuard><InductionProgramsAdmin /></AdminGuard>}</Route>
      <Route path="/admin/workforce-lifecycle">{() => <AdminGuard><WorkforceLifecycleAdmin /></AdminGuard>}</Route>
      <Route path="/admin/kpi-targets">{() => <AdminGuard><KpiTargetsAdmin /></AdminGuard>}</Route>
      <Route path="/admin/learning-content">{() => <AdminGuard><TrainingContentAdmin /></AdminGuard>}</Route>
      <Route path="/admin/training-completions">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager', 'assessor', 'internal_verifier']}><TrainingCompletionsReport /></RoleGuard>}</Route>
      <Route path="/my-onboarding" component={MyOnboarding} />
      <Route path="/admin/competence-document-import">{() => <AdminGuard><CompetenceDocumentImport /></AdminGuard>}</Route>
      <Route path="/training-catalog" component={TrainingCatalog} />
      <Route path="/my-bookings" component={MyBookings} />
      <Route path="/setup">{() => <AdminGuard><Setup /></AdminGuard>}</Route>
      <Route path="/badge" component={CompetenceBadge} />
      <Route path="/reports/element3-kpi">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager', 'internal_verifier']}><Element3KpiDashboard /></RoleGuard>}</Route>
      <Route path="/compliance-explorer">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager', 'assessor', 'internal_verifier']}><ComplianceExplorer /></RoleGuard>}</Route>
      <Route path="/competence-detail">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager', 'assessor', 'internal_verifier']}><CompetenceDetailReport /></RoleGuard>}</Route>
      <Route path="/org-chart">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager', 'assessor', 'internal_verifier']}><OrgChart /></RoleGuard>}</Route>
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
        {/* min-w-0 overrides the flex item's default min-width:auto - without it, any wide child
            further down (a table, a fixed-width chart) forces this whole column past the viewport
            instead of scrolling internally, dragging the sidebar out of view with it. */}
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between p-2 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <UserSwitcher />
              <LanguageSelector />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
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
