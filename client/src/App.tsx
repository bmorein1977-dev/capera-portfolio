import { Switch, Route, useLocation } from "wouter";
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
import { useAuth, useLicence } from "@/hooks/useAuth";
import { tierForPath, tierIncludes } from "@shared/licence";
import NotLicensed from "@/pages/NotLicensed";
import { TrainingGuard } from "@/components/TrainingGuard";
import TrainingPermissionsAdmin from "@/pages/admin/TrainingPermissionsAdmin";
import EvidenceUpload from "@/components/EvidenceUpload";
import UserProfile from "@/components/UserProfile";
import AssessorWorkspace from "@/components/AssessorWorkspace";
import SelfAssessment from "@/components/SelfAssessment";
import Home from "@/pages/Home";
import CompetencyManager from "@/components/CompetencyManager";
import CompetenceStandardsReviewAdmin from "@/pages/admin/CompetenceStandardsReviewAdmin";
import Landing from "@/pages/Landing";
import MyTraining from "@/pages/MyTraining";
import MyPerformance from "@/pages/MyPerformance";
import TeamPerformance from "@/pages/TeamPerformance";
import AppraisalPage from "@/pages/AppraisalPage";
import FeedbackInbox from "@/pages/FeedbackInbox";
import CareerProfile from "@/pages/CareerProfile";
import PerformanceAdmin from "@/pages/admin/PerformanceAdmin";
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
import ExternalVerification from "@/pages/ExternalVerification";
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
import TrainingEvaluations from "@/pages/admin/TrainingEvaluations";
import MyTrainingFeedback from "@/pages/MyTrainingFeedback";
import MyOnboarding from "@/pages/MyOnboarding";
import CompetenceDocumentImport from "@/pages/admin/CompetenceDocumentImport";
import StandardAuthoringWizard from "@/pages/admin/StandardAuthoringWizard";
import InternalVerificationManagement from "@/pages/admin/InternalVerificationManagement";
import CheckPage from "@/pages/CheckPage";
import ExportMenu from "@/components/ExportMenu";
import ContractorManagement from "@/pages/ContractorManagement";
import ScheduledReports from "@/pages/ScheduledReports";
import Element3KpiDashboard from "@/pages/Element3KpiDashboard";
import ComplianceExplorer from "@/pages/ComplianceExplorer";
import DutyToOperate from "@/pages/DutyToOperate";
import AuditLog from "@/pages/admin/AuditLog";
import ArchivedPeople from "@/pages/admin/ArchivedPeople";
import CertificatesAdmin from "@/pages/admin/CertificatesAdmin";
import AnnouncementsAdmin from "@/pages/admin/AnnouncementsAdmin";
import Announcements from "@/pages/Announcements";
import AnnouncementsBanner from "@/components/AnnouncementsBanner";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import CommandPalette, { openSearch } from "@/components/CommandPalette";
import Hub from "@/pages/Hub";
import ExecutiveDashboard from "@/pages/ExecutiveDashboard";
import CandidateDashboard from "@/pages/CandidateDashboard";
import CompetenceDetailReport from "@/pages/CompetenceDetailReport";
import OrgChart from "@/pages/OrgChart";
import TrainingProvidersAdmin from "@/pages/admin/TrainingProvidersAdmin";
import TrainingVenuesAdmin from "@/pages/admin/TrainingVenuesAdmin";
import TrainingCoursesAdmin from "@/pages/admin/TrainingCoursesAdmin";
import TrainingSessionsAdmin from "@/pages/admin/TrainingSessionsAdmin";
import TrainingPolicyMatrixAdmin from "@/pages/admin/TrainingPolicyMatrixAdmin";
import BookingManagementAdmin from "@/pages/admin/BookingManagementAdmin";
import TrainingCostReportPage from "@/pages/admin/TrainingCostReport";
import OpitoAdmin from "@/pages/admin/OpitoAdmin";
import { AdminGuard } from "@/components/AdminGuard";
import { RoleGuard } from "@/components/RoleGuard";

function Router() {
  const [location] = useLocation();
  const licence = useLicence();
  // a page that belongs to a higher level than this deployment is licensed for is not shown, even if its address is typed in
  const needed = tierForPath(location);
  if (!tierIncludes(licence, needed)) return <NotLicensed needed={needed} licensed={licence} />;
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Home} />
      <Route path="/evidence" component={EvidenceUpload} />
      <Route path="/profile" component={UserProfile} />
      <Route path="/admin/competency-manager">{() => <AdminGuard><CompetencyManager /></AdminGuard>}</Route>
      <Route path="/admin/standards-review">{() => <AdminGuard><CompetenceStandardsReviewAdmin /></AdminGuard>}</Route>
      <Route path="/admin/standard-wizard">{() => <AdminGuard><StandardAuthoringWizard /></AdminGuard>}</Route>
      <Route path="/assessor-workspace" component={AssessorWorkspace} />
      <Route path="/assessor-dashboard" component={AssessorDashboard} />
      <Route path="/self-assessment" component={SelfAssessment} />
      <Route path="/my-assessments" component={MyAssessments} />
      <Route path="/verifier-dashboard" component={VerifierDashboard} />
      <Route path="/external-verification">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'external_verifier']}><ExternalVerification /></RoleGuard>}</Route>
      <Route path="/training-approvals" component={TrainingApprovals} />
      <Route path="/my-training" component={MyTraining} />
      <Route path="/my-training-feedback/:id">{(params) => <MyTrainingFeedback id={params.id} />}</Route>
      <Route path="/my-training-feedback">{() => <MyTrainingFeedback />}</Route>
      <Route path="/admin/training-evaluations">{() => <TrainingGuard permission="evaluations.view"><TrainingEvaluations /></TrainingGuard>}</Route>
      <Route path="/my-performance" component={MyPerformance} />
      <Route path="/performance/appraisals/:id">{(params) => <AppraisalPage id={params.id} />}</Route>
      <Route path="/performance/feedback/:id">{(params) => <FeedbackInbox id={params.id} />}</Route>
      <Route path="/performance/feedback">{() => <FeedbackInbox />}</Route>
      <Route path="/career">{() => <CareerProfile />}</Route>
      <Route path="/career/:userId">{(params) => <AdminGuard><CareerProfile userId={params.userId} /></AdminGuard>}</Route>
      <Route path="/team-performance">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager']} allowAppraisers><TeamPerformance /></RoleGuard>}</Route>
      <Route path="/admin/performance">{() => <AdminGuard><PerformanceAdmin /></AdminGuard>}</Route>
      <Route path="/skills-gap" component={SkillsGapDashboard} />
      <Route path="/role-transition" component={RoleTransitionPlanning} />
      <Route path="/team-compliance" component={TeamComplianceMatrix} />
      <Route path="/dashboard/executive">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager']}><ExecutiveDashboard /></RoleGuard>}</Route>
      <Route path="/my-dashboard" component={CandidateDashboard} />
      <Route path="/hub/:id">{(params) => <Hub id={params.id} />}</Route>
      <Route path="/announcements" component={Announcements} />
      <Route path="/admin/announcements">{() => <AdminGuard><AnnouncementsAdmin /></AdminGuard>}</Route>
      <Route path="/admin/certificates">{() => <AdminGuard><CertificatesAdmin /></AdminGuard>}</Route>
      <Route path="/admin/archived-people">{() => <AdminGuard roles={['admin', 'super_admin']}><ArchivedPeople /></AdminGuard>}</Route>
      <Route path="/admin/audit-log">{() => <AdminGuard><AuditLog /></AdminGuard>}</Route>
      <Route path="/admin/users">{() => <AdminGuard><AdminUsers /></AdminGuard>}</Route>
      <Route path="/admin/job-roles">{() => <AdminGuard><JobRoleManagement /></AdminGuard>}</Route>
      <Route path="/admin/historical-import">{() => <AdminGuard><HistoricalImport /></AdminGuard>}</Route>
      <Route path="/admin/bulk-assignment">{() => <AdminGuard><BulkAssignment /></AdminGuard>}</Route>
      <Route path="/admin/notifications">{() => <AdminGuard><NotificationSettings /></AdminGuard>}</Route>
      <Route path="/admin/training-manager">{() => <TrainingGuard permission="catalogue.view"><TrainingManager /></TrainingGuard>}</Route>
      <Route path="/admin/training-matrix-import">{() => <TrainingGuard permission="imports.view"><TrainingMatrixImport /></TrainingGuard>}</Route>
      <Route path="/admin/training-course-library">{() => <AdminGuard><TrainingCourseLibrary /></AdminGuard>}</Route>
      <Route path="/admin/training-providers">{() => <TrainingGuard permission="providers.view"><TrainingProvidersAdmin /></TrainingGuard>}</Route>
      <Route path="/admin/training-venues">{() => <TrainingGuard permission="venues.view"><TrainingVenuesAdmin /></TrainingGuard>}</Route>
      <Route path="/admin/external-training-courses">{() => <TrainingGuard permission="courses.view"><TrainingCoursesAdmin /></TrainingGuard>}</Route>
      <Route path="/admin/training-sessions">{() => <TrainingGuard permission="sessions.view"><TrainingSessionsAdmin /></TrainingGuard>}</Route>
      <Route path="/admin/training-policy-matrix">{() => <TrainingGuard permission="policy.view"><TrainingPolicyMatrixAdmin /></TrainingGuard>}</Route>
      <Route path="/admin/course-bookings">{() => <TrainingGuard permission="bookings.view"><BookingManagementAdmin /></TrainingGuard>}</Route>
      <Route path="/admin/training-cost-report">{() => <TrainingGuard permission="reports_cost.view"><TrainingCostReportPage /></TrainingGuard>}</Route>
      <Route path="/admin/opito">{() => <AdminGuard roles={['admin', 'super_admin']}><OpitoAdmin /></AdminGuard>}</Route>
      <Route path="/admin/organisation-structure">{() => <AdminGuard><OrganisationStructureAdmin /></AdminGuard>}</Route>
      <Route path="/admin/internal-verification">{() => <AdminGuard><InternalVerificationManagement /></AdminGuard>}</Route>
      <Route path="/admin/workforce-planning">{() => <AdminGuard><StrategicWorkforcePlanning /></AdminGuard>}</Route>
      <Route path="/admin/induction-programs">{() => <AdminGuard><InductionProgramsAdmin /></AdminGuard>}</Route>
      <Route path="/admin/workforce-lifecycle">{() => <AdminGuard><WorkforceLifecycleAdmin /></AdminGuard>}</Route>
      <Route path="/admin/kpi-targets">{() => <AdminGuard><KpiTargetsAdmin /></AdminGuard>}</Route>
      <Route path="/admin/training-permissions">{() => <AdminGuard><TrainingPermissionsAdmin /></AdminGuard>}</Route>
      <Route path="/admin/learning-content">{() => <TrainingGuard permission="content.view"><TrainingContentAdmin /></TrainingGuard>}</Route>
      <Route path="/admin/training-completions">{() => <TrainingGuard permission="reports_completions.view"><TrainingCompletionsReport /></TrainingGuard>}</Route>
      <Route path="/my-onboarding" component={MyOnboarding} />
      <Route path="/admin/competence-document-import">{() => <AdminGuard><CompetenceDocumentImport /></AdminGuard>}</Route>
      <Route path="/training-catalog" component={TrainingCatalog} />
      <Route path="/my-bookings" component={MyBookings} />
      <Route path="/setup">{() => <AdminGuard><Setup /></AdminGuard>}</Route>
      {/* the check a scan opens; older printed codes pointed at /badge?userId=, which now goes to the same place */}
      <Route path="/check/:id" component={CheckPage} />
      <Route path="/badge">{() => { const id = new URLSearchParams(window.location.search).get("userId"); window.location.replace(id ? `/check/${encodeURIComponent(id)}` : "/"); return null; }}</Route>
      <Route path="/admin/contractors/visitors">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin']}><ContractorManagement /></RoleGuard>}</Route>
      <Route path="/contractor/visitors">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'contractor_admin']}><ContractorManagement /></RoleGuard>}</Route>
      <Route path="/admin/contractors">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin']}><ContractorManagement /></RoleGuard>}</Route>
      <Route path="/scheduled-reports">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager']}><ScheduledReports /></RoleGuard>}</Route>
      <Route path="/contractor">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'contractor_admin']}><ContractorManagement /></RoleGuard>}</Route>
      <Route path="/reports/element3-kpi">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager', 'internal_verifier']}><Element3KpiDashboard /></RoleGuard>}</Route>
      <Route path="/duty-to-operate">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager']}><DutyToOperate /></RoleGuard>}</Route>
      <Route path="/compliance-explorer">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager', 'assessor', 'internal_verifier']}><ComplianceExplorer /></RoleGuard>}</Route>
      <Route path="/competence-detail">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager', 'assessor', 'internal_verifier']}><CompetenceDetailReport /></RoleGuard>}</Route>
      <Route path="/org-chart">{() => <RoleGuard allowedRoles={['developer', 'admin', 'super_admin', 'manager', 'assessor', 'internal_verifier']}><OrgChart /></RoleGuard>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, error } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // A leaver whose login still works with the identity provider is refused by the server (see isAuthenticated in replitAuth.ts)
  if (!isAuthenticated && String((error as Error | null)?.message ?? "").includes("ACCOUNT_CLOSED")) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" data-testid="screen-account-closed">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-2xl font-semibold">This account has been closed</h1>
          <p className="text-muted-foreground">Capera accounts are closed when someone leaves. If you think this is a mistake, please ask your administrator.</p>
          <a className="text-sm underline" href="/api/logout">Sign out</a>
        </div>
      </div>
    );
  }

  // An outside body's account (an external verifier) can carry an end date; after it the server refuses them on every route
  if (!isAuthenticated && String((error as Error | null)?.message ?? "").includes("ACCESS_ENDED")) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" data-testid="screen-access-ended">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-2xl font-semibold">Your access has ended</h1>
          <p className="text-muted-foreground">Your access to Capera was given for a set period and that period is over. If you still need access, please ask the person who set it up for you.</p>
          <a className="text-sm underline" href="/api/logout">Sign out</a>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // someone who scanned a badge is taken to sign in and then straight back to that check (only an address inside Capera is ever returned to)
    if (window.location.pathname.startsWith("/check/")) {
      window.location.replace(`/api/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return <div className="flex items-center justify-center min-h-screen">Taking you to sign in...</div>;
    }
    return <Landing />;
  }

  // Custom sidebar width for skills management application
  const style = {
    "--sidebar-width": "16.5rem",
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
          <header className="flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <AppBreadcrumb />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={openSearch} className="hidden h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex" data-testid="button-header-search">
                Search<kbd className="rounded border px-1.5 py-0.5 text-[10px] font-medium">Ctrl K</kbd>
              </button>
              <ExportMenu />
              <UserSwitcher />
              <div className="hidden sm:block"><LanguageSelector /></div>
              <ThemeToggle />
            </div>
          </header>
          <CommandPalette />
          <AnnouncementsBanner />
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
