import {
  Archive, Award, BarChart3, HardHat, Bell, BookOpen, Briefcase, Building2, Calendar, CheckCircle2, ClipboardCheck, ClipboardList, FileCheck, FileUp, Gauge, GitBranch, GraduationCap,
  HeartPulse, Home, LayoutGrid, Megaphone, MapPin, MessageSquareText, Network, PlayCircle, ScrollText, Shield, ShieldAlert, ShieldCheck,
  SlidersHorizontal, Sparkles, Target, TrendingUp, Upload, User2, Users, Workflow, Wrench, type LucideIcon,
} from "lucide-react";
import { tierForPath, tierIncludes, type Tier } from "@shared/licence";

// The one description of everything a person can open: the sidebar, the hub pages of tiles, the search and the breadcrumb all read it,
// so they can never disagree about what exists or who may see it. Each item says which roles can see it. That mirrors what the
// routes in App.tsx enforce and is only about showing a link: the server decides who may actually do anything.

export interface NavItem { title: string; url: string; icon: LucideIcon; description: string; roles: string[]; /** a training permission (see shared/trainingPermissions.ts) that also shows this page */ permission?: string }
export interface NavGroup { title: string; items: NavItem[] }
export interface NavSection { id: string; title: string; description: string; icon: LucideIcon; groups: NavGroup[] }

const EVERYONE = ["developer", "super_admin", "admin", "manager", "internal_verifier", "assessor", "candidate", "trainee"];
const PERSONAL = ["manager", "internal_verifier", "assessor", "candidate", "trainee"]; // people who have a training record and job role of their own
const OVERSIGHT = ["developer", "super_admin", "admin", "manager", "internal_verifier", "assessor"];
const ADMINS = ["super_admin", "admin"];

export const HOME: NavItem = { title: "Home", url: "/dashboard", icon: Home, description: "Your dashboard", roles: EVERYONE };

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "my-work", title: "My Work", icon: User2, description: "Your learning, assessments, performance and career, in one place.",
    groups: [
      {
        title: "Learning", items: [
          { title: "My Detailed Dashboard", url: "/my-dashboard", icon: Gauge, description: "Your competence and training status, item by item.", roles: ["candidate", "trainee"] },
          { title: "My Training", url: "/my-training", icon: GraduationCap, description: "Your training record, e-learning and certificates.", roles: PERSONAL },
          { title: "Training Catalog", url: "/training-catalog", icon: BookOpen, description: "Browse and request external training courses.", roles: EVERYONE },
          { title: "My Bookings", url: "/my-bookings", icon: Calendar, description: "The course sessions you are booked on.", roles: EVERYONE },
          { title: "Self Assessment", url: "/self-assessment", icon: User2, description: "Rate your own competence ahead of an assessment.", roles: ["candidate", "trainee", "assessor"] },
          { title: "Skills Gap Analysis", url: "/skills-gap", icon: Target, description: "See where you stand against your job role.", roles: PERSONAL },
          { title: "My Onboarding", url: "/my-onboarding", icon: ClipboardList, description: "Track your induction and onboarding tasks.", roles: PERSONAL },
        ],
      },
      {
        title: "Assessment and evidence", items: [
          { title: "My Assessments", url: "/my-assessments", icon: FileCheck, description: "Your assessments, outcomes and feedback.", roles: ["candidate", "trainee"] },
          { title: "Evidence Portal", url: "/evidence", icon: Upload, description: "Upload and manage evidence of your competence.", roles: EVERYONE },
        ],
      },
      {
        title: "Performance and career", items: [
          { title: "My Performance", url: "/my-performance", icon: Gauge, description: "Your objectives, annual review and development plan.", roles: EVERYONE },
          { title: "Feedback Requests", url: "/performance/feedback", icon: MessageSquareText, description: "360 feedback colleagues have asked you to give.", roles: EVERYONE },
          { title: "Role Transition Planning", url: "/role-transition", icon: GitBranch, description: "Plan a move to another role and see what it would take.", roles: EVERYONE },
        ],
      },
      {
        title: "You", items: [
          { title: "Announcements", url: "/announcements", icon: Megaphone, description: "Notices from your administrators.", roles: EVERYONE },
          { title: "My Profile", url: "/profile", icon: User2, description: "Your details, CV and settings.", roles: EVERYONE },
        ],
      },
    ],
  },
  {
    id: "team", title: "Team and Compliance", icon: ShieldCheck, description: "Oversight of competence, compliance and the people you are responsible for.",
    groups: [
      {
        title: "Compliance", items: [
          { title: "Executive Dashboard", url: "/dashboard/executive", icon: BarChart3, description: "Organisation-wide competence and training compliance in detail.", roles: ["developer", "super_admin", "admin", "manager"] },
          { title: "Team Compliance Matrix", url: "/team-compliance", icon: MapPin, description: "Who holds which competence, across a team or site.", roles: OVERSIGHT },
          { title: "Compliance Explorer", url: "/compliance-explorer", icon: SlidersHorizontal, description: "Slice compliance by site, role, team or element.", roles: OVERSIGHT },
          { title: "Competence Detail Report", url: "/competence-detail", icon: LayoutGrid, description: "Element-by-element competence detail and evidence.", roles: OVERSIGHT },
          { title: "Duty to Operate", url: "/duty-to-operate", icon: ShieldAlert, description: "Minimum staffing against each installation's safety case.", roles: ["developer", "super_admin", "admin", "manager"] },
          { title: "Training Completions", url: "/admin/training-completions", icon: ShieldCheck, description: "A permanent record of who completed what training.", roles: [], permission: "reports_completions.view" },
          { title: "EI PSM Element 3 KPIs", url: "/reports/element3-kpi", icon: TrendingUp, description: "Competence indicators for the EI PSM framework.", roles: ["developer", "super_admin", "admin", "manager", "internal_verifier"] },
        ],
      },
      {
        title: "People", items: [
          { title: "Org Chart", url: "/org-chart", icon: Workflow, description: "Reporting lines, teams and who sits where.", roles: OVERSIGHT },
          { title: "Team Performance", url: "/team-performance", icon: Users, description: "Reviews for the people you manage or supervise: start them, follow them and discuss them.", roles: ["developer", "super_admin", "admin", "manager", "appraiser"] },
        ],
      },
      {
        title: "Assessment and approvals", items: [
          { title: "Assessment Dashboard", url: "/assessor-dashboard", icon: BarChart3, description: "Your candidates, assessments and what needs doing.", roles: ["assessor"] },
          { title: "Assessor Workspace", url: "/assessor-workspace", icon: ClipboardCheck, description: "Assess, review evidence and sign off.", roles: ["assessor"] },
          { title: "My Contractor People", url: "/contractor", icon: HardHat, description: "Your people, their training and competence, and who is ready to work.", roles: ["contractor_admin"] },
          { title: "External Verification", url: "/external-verification", icon: ShieldCheck, description: "Read-only: the assessors allocated to you, their assessments, comments and evidence.", roles: ["external_verifier"] },
          { title: "Internal Verification", url: "/verifier-dashboard", icon: ShieldCheck, description: "The assessors allocated to you and what to verify.", roles: ["internal_verifier"] },
          { title: "Training Approvals", url: "/training-approvals", icon: FileCheck, description: "Training requests waiting for your approval.", roles: ["manager"], permission: "requests.approve" },
        ],
      },
    ],
  },
  {
    id: "administration", title: "Administration", icon: Shield, description: "Set up and run the platform: people, learning, competence, communication and governance.",
    groups: [
      {
        title: "People and organisation", items: [
          { title: "Contractor Management", url: "/contractor", icon: HardHat, description: "Contracting companies' people: approve additions, review what they declared, revoke entries.", roles: ADMINS },
          { title: "User Management", url: "/admin/users", icon: Users, description: "Create, edit, archive and assign people.", roles: ADMINS },
          { title: "Job Role Management", url: "/admin/job-roles", icon: Briefcase, description: "Define roles and what each one requires.", roles: ADMINS },
          { title: "Organisation Structure", url: "/admin/organisation-structure", icon: Network, description: "Locations, teams, business units and contract companies.", roles: ADMINS },
          { title: "Archived People", url: "/admin/archived-people", icon: Archive, description: "Leavers, how long details are kept, and restoring records.", roles: ADMINS },
          { title: "Bulk Assignment", url: "/admin/bulk-assignment", icon: Users, description: "Assign roles and training to many people at once.", roles: ADMINS },
          { title: "Workforce Lifecycle", url: "/admin/workforce-lifecycle", icon: HeartPulse, description: "Joiners, movers and leavers, including HR imports.", roles: ADMINS },
          { title: "Onboarding and Induction", url: "/admin/induction-programs", icon: ClipboardList, description: "Induction programmes and onboarding tasks.", roles: ADMINS },
          { title: "Historical Import", url: "/admin/historical-import", icon: FileUp, description: "Bring in past competence and training records.", roles: ADMINS },
        ],
      },
      {
        title: "Learning and training", items: [
          { title: "Training Manager", url: "/admin/training-manager", icon: GraduationCap, description: "Requests, approvals and the training the business needs.", roles: [], permission: "catalogue.view" },
          { title: "Training Course Library", url: "/admin/training-course-library", icon: BookOpen, description: "The catalogue of courses and their rules.", roles: ADMINS },
          { title: "Training Matrix Import", url: "/admin/training-matrix-import", icon: FileUp, description: "Load a training matrix from a spreadsheet.", roles: [], permission: "imports.view" },
          { title: "Learning Content", url: "/admin/learning-content", icon: PlayCircle, description: "E-learning, video and SCORM content.", roles: [], permission: "content.view" },
          { title: "Training Permissions", url: "/admin/training-permissions", icon: SlidersHorizontal, description: "Who may do what in training, for each type of user.", roles: ["developer", "super_admin", "admin"] },
          { title: "E-learning Certificates", url: "/admin/certificates", icon: Award, description: "Certificate approval, your branding and settings.", roles: ADMINS },
        ],
      },
      {
        title: "External training", items: [
          { title: "Training Providers", url: "/admin/training-providers", icon: Building2, description: "The organisations that deliver your courses.", roles: [], permission: "providers.view" },
          { title: "Training Venues", url: "/admin/training-venues", icon: MapPin, description: "Where courses are held.", roles: [], permission: "venues.view" },
          { title: "External Course Catalog", url: "/admin/external-training-courses", icon: BookOpen, description: "External courses, prices and providers.", roles: [], permission: "courses.view" },
          { title: "Training Sessions", url: "/admin/training-sessions", icon: Calendar, description: "Scheduled dates, capacity and attendees.", roles: [], permission: "sessions.view" },
          { title: "Training Policy Matrix", url: "/admin/training-policy-matrix", icon: Shield, description: "Which training needs approval, and from whom.", roles: [], permission: "policy.view" },
          { title: "Course Bookings", url: "/admin/course-bookings", icon: CheckCircle2, description: "Bookings, confirmations and cancellations.", roles: [], permission: "bookings.view" },
          { title: "Cost and Activity Report", url: "/admin/training-cost-report", icon: TrendingUp, description: "What training is costing and who is using it.", roles: [], permission: "reports_cost.view" },
        ],
      },
      {
        title: "Competence and assurance", items: [
          { title: "Competence Standards Review", url: "/admin/standards-review", icon: ClipboardCheck, description: "Make sure each standard is reviewed on time.", roles: ADMINS },
          { title: "Internal Verification Management", url: "/admin/internal-verification", icon: ShieldCheck, description: "Verifiers, sampling plans and verification records.", roles: ADMINS },
          { title: "Competence Document Import", url: "/admin/competence-document-import", icon: FileUp, description: "Load competence standards from documents.", roles: ADMINS },
          { title: "OPITO", url: "/admin/opito", icon: Award, description: "Certification and audit evidence store.", roles: ADMINS },
          { title: "KPI Targets", url: "/admin/kpi-targets", icon: Target, description: "The targets your dashboards measure against.", roles: ADMINS },
          { title: "Competency Manager", url: "/admin/competency-manager", icon: Target, description: "Edit the competence taxonomy and standards.", roles: ["developer", "super_admin"] },
          { title: "SME New Standard Wizard", url: "/admin/standard-wizard", icon: Sparkles, description: "Guided authoring of a new competence standard.", roles: ["developer", "super_admin"] },
        ],
      },
      {
        title: "Performance and planning", items: [
          { title: "Performance and Talent Score", url: "/admin/performance", icon: Gauge, description: "Review cycles, scoring rules and the talent catalogue.", roles: ADMINS },
          { title: "Strategic Workforce Planning", url: "/admin/workforce-planning", icon: TrendingUp, description: "Succession, initiatives and future demand.", roles: ADMINS },
        ],
      },
      {
        title: "Communication", items: [
          { title: "Announcements", url: "/admin/announcements", icon: Megaphone, description: "Write notices and see who has read them.", roles: ADMINS },
          { title: "Email Notifications", url: "/admin/notifications", icon: Bell, description: "Every email the system sends, and the log of them.", roles: ADMINS },
        ],
      },
      {
        title: "Governance and system", items: [
          { title: "Audit Log", url: "/admin/audit-log", icon: ScrollText, description: "Who changed what, and when.", roles: ADMINS },
          { title: "Account Setup", url: "/setup", icon: Wrench, description: "Your role and system setup.", roles: ["developer", "super_admin", "admin"] },
        ],
      },
    ],
  },
];

const can = (item: NavItem, roles: string[], permissions: string[]) => item.roles.some(r => roles.includes(r)) || (!!item.permission && permissions.includes(item.permission));

export interface VisibleSection extends NavSection { count: number }

/** The same area is named for what it is to this person: a manager's is "My Team", an assessor's is "Assessing", and so on. */
function labelFor(id: string, roles: string[], fallback: { title: string; description: string }): { title: string; description: string } {
  const has = (r: string) => roles.includes(r);
  if (id === "team") {
    if (has("manager")) return { title: "My Team", description: "Your people, their competence and compliance, and the approvals waiting for you." };
    if (has("appraiser") && !has("assessor") && !has("internal_verifier") && !has("admin") && !has("super_admin") && !has("developer")) return { title: "My Team", description: "The reviews of the people you supervise or manage." };
    if (has("contractor_admin") && !has("admin") && !has("super_admin") && !has("developer")) return { title: "My Contractor People", description: "Your people, their training and competence." };
    if (has("external_verifier") && !has("admin") && !has("super_admin") && !has("developer") && !has("internal_verifier")) return { title: "Verification review", description: "The assessors allocated to you, read only." };
    if (has("internal_verifier") && !has("admin") && !has("super_admin") && !has("developer")) return { title: "Verification", description: "The assessors you verify, and the compliance picture behind them." };
    if (has("assessor") && !has("admin") && !has("super_admin") && !has("developer")) return { title: "Assessing", description: "Your candidates, your assessments, and the compliance picture behind them." };
  }
  if (id === "administration") {
    if (has("admin") || has("super_admin")) return fallback;
    if (has("developer")) return { title: "Platform", description: "Standards and training tools, and the system's own settings." };
    if (has("training_administrator")) return { title: "Training Administration", description: "Providers, venues, sessions, bookings and what training is costing." };
  }
  return fallback;
}

/** The sections a person can see, each with only the groups and items their roles allow. Empty groups and sections are dropped. */
export function visibleSections(roles: string[], licensed: Tier = "gold", permissions: string[] = []): VisibleSection[] {
  return NAV_SECTIONS.map(section => {
    // a page shows only if the person's role allows it and the deployment's licence (Bronze, Silver or Gold) includes it; see shared/licence.ts
    const groups = section.groups.map(g => ({ ...g, items: g.items.filter(i => can(i, roles, permissions) && tierIncludes(licensed, tierForPath(i.url))) })).filter(g => g.items.length > 0);
    return { ...section, ...labelFor(section.id, roles, section), groups, count: groups.reduce((n, g) => n + g.items.length, 0) };
  }).filter(s => s.count > 0);
}

export function hubUrl(sectionId: string): string { return `/hub/${sectionId}`; }

export interface NavContext { section?: NavSection; group?: NavGroup; item?: NavItem }

/** Where a URL sits in the navigation, for the breadcrumb and for highlighting the current section. Longest matching page wins. */
export function findNavContext(pathname: string): NavContext {
  const path = pathname.replace(/\/+$/, "") || "/";
  const hub = path.match(/^\/hub\/([^/]+)$/);
  if (hub) return { section: NAV_SECTIONS.find(s => s.id === hub[1]) };
  let best: { ctx: NavContext; len: number } | null = null;
  for (const section of NAV_SECTIONS) for (const group of section.groups) for (const item of group.items) {
    if ((path === item.url || path.startsWith(item.url + "/")) && (!best || item.url.length > best.len)) best = { ctx: { section, group, item }, len: item.url.length };
  }
  return best?.ctx ?? {};
}

