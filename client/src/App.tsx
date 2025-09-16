import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import DashboardOverview from "@/components/DashboardOverview";
import TeamMatrix from "@/components/TeamMatrix";
import TalentFinder from "@/components/TalentFinder";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import EvidenceUpload from "@/components/EvidenceUpload";
import UserProfile from "@/components/UserProfile";
import SkillsFrameworkBuilder from "@/components/SkillsFrameworkBuilder";
import DeveloperStandards from "@/components/DeveloperStandards";
import AssessorWorkspace from "@/components/AssessorWorkspace";
import SelfAssessment from "@/components/SelfAssessment";
import ResourcesManagement from "@/components/ResourcesManagement";
import EnhancedDashboard from "@/components/EnhancedDashboard";
import GranularReporting from "@/components/GranularReporting";
import NotFound from "@/pages/not-found";

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
      <Route path="/skills-framework" component={SkillsFrameworkBuilder} />
      <Route path="/developer-standards" component={DeveloperStandards} />
      <Route path="/assessor-workspace" component={AssessorWorkspace} />
      <Route path="/self-assessment" component={SelfAssessment} />
      <Route path="/resources" component={ResourcesManagement} />
      <Route path="/reports" component={GranularReporting} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Custom sidebar width for skills management application
  const style = {
    "--sidebar-width": "20rem",       // 320px for better navigation
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between p-2 border-b">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-hidden">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
