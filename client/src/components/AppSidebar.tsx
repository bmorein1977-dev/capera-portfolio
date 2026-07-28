import {
  Calendar,
  ChevronUp,
  Home,
  Settings,
  Users,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Target,
  Upload,
  User2,
  GraduationCap,
  Shield,
  Wrench,
  FileUp,
  Bell,
  ShoppingCart,
  FileCheck,
  Briefcase,
  Layers,
  GitBranch,
  MapPin,
  Network,
  TrendingUp,
  ClipboardList,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  LayoutGrid,
  Workflow,
  HeartPulse,
} from 'lucide-react';
import { CaperaLogo } from '@/components/icons/CaperaLogo';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Menu items based on user role - Enhanced for customer-friendly e-portfolio
const menuItems = [
  {
    title: 'Account Setup',
    url: '/setup',
    icon: Wrench,
    // Includes a self-service role switcher - restricted to roles that already have elevated
    // privileges (switching their own role isn't a security concern for them, since they already
    // have equal-or-greater access). The API itself also rejects role changes from anyone else
    // regardless of what the sidebar shows.
    roles: ['developer', 'super_admin', 'admin'],
  },
  {
    title: 'Home',
    url: '/dashboard',
    icon: Home,
    // Org-wide Executive Dashboard - not the assessor/candidate/internal_verifier's own dashboard,
    // which each role reaches through its own nav entry below instead (Assessor Dashboard,
    // Internal Verification, or My Dashboard for candidates/trainees). Managers get it too.
    roles: ['developer', 'super_admin', 'admin', 'manager'],
  },
  {
    // Same route as Executive Dashboard (Home.tsx branches on role), but candidates/trainees have
    // no other nav entry pointing back to their own dashboard the way assessors and internal
    // verifiers do (Assessor Dashboard, Internal Verification) - without this they'd have no way
    // back to it once they navigate anywhere else.
    title: 'My Dashboard',
    url: '/dashboard',
    icon: Home,
    roles: ['candidate', 'trainee'],
  },
  {
    title: 'Admin Area',
    icon: Shield,
    roles: ['super_admin', 'admin'],
    items: [
      { title: 'User Management', url: '/admin/users', icon: Users },
      { title: 'Job Role Management', url: '/admin/job-roles', icon: Briefcase },
      { title: 'Organisation Structure', url: '/admin/organisation-structure', icon: Network },
      { title: 'Internal Verification Management', url: '/admin/internal-verification', icon: ShieldCheck },
      { title: 'Strategic Workforce Planning', url: '/admin/workforce-planning', icon: TrendingUp },
      { title: 'Onboarding & Induction', url: '/admin/induction-programs', icon: ClipboardList },
      { title: 'Workforce Lifecycle', url: '/admin/workforce-lifecycle', icon: HeartPulse },
      { title: 'KPI Targets', url: '/admin/kpi-targets', icon: Target },
      { title: 'Learning Content', url: '/admin/learning-content', icon: PlayCircle },
      { title: 'Historical Import', url: '/admin/historical-import', icon: FileUp },
      { title: 'Bulk Assignment', url: '/admin/bulk-assignment', icon: Users },
      { title: 'Email Notifications', url: '/admin/notifications', icon: Bell },
      { title: 'Training Manager', url: '/admin/training-manager', icon: GraduationCap },
      { title: 'Training Matrix Import', url: '/admin/training-matrix-import', icon: FileUp },
      { title: 'Training Course Library', url: '/admin/training-course-library', icon: GraduationCap },
      { title: 'Competence Document Import', url: '/admin/competence-document-import', icon: FileUp },
    ],
  },
  {
    title: 'Developer Area',
    icon: Settings,
    roles: ['developer', 'super_admin'],
    items: [
      { title: 'Competency Manager', url: '/admin/competency-manager', icon: Target },
      { title: 'SME New Standard Wizard', url: '/admin/standard-wizard', icon: Sparkles },
    ],
  },
  {
    title: 'Assessor Tools',
    icon: ClipboardCheck,
    // The assessor's own personal dashboard/workspace - not for internal_verifier, who has their
    // own equivalent under "Internal Verification" instead, and not for admin-type roles, who
    // aren't personally an assessor just because they can administer the system (an admin
    // impersonating/testing an assessor account sees it via that account's own role, not theirs).
    roles: ['assessor'],
    items: [
      { title: 'Assessment Dashboard', url: '/assessor-dashboard', icon: BarChart3 },
      { title: 'Workspace', url: '/assessor-workspace', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Internal Verification',
    url: '/verifier-dashboard',
    icon: ShieldCheck,
    // This is the personal "assessors allocated to me" workspace for someone who IS an internal
    // verifier - admins get the org-wide equivalent under Admin Area > Internal Verification
    // Management instead, not this account-scoped view.
    roles: ['internal_verifier'],
  },
  {
    title: 'My Onboarding',
    url: '/my-onboarding',
    icon: ClipboardList,
    // Personal induction tracking - not for admin-type roles, who administer onboarding programs
    // via Admin Area > Onboarding & Induction rather than having one of their own to track.
    roles: ['manager', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Self Assessment',
    url: '/self-assessment',
    icon: User2,
    roles: ['candidate', 'trainee', 'assessor'],
  },
  {
    title: 'My Assessments',
    url: '/my-assessments',
    icon: FileCheck,
    roles: ['candidate', 'trainee'],
  },
  {
    title: 'My Training',
    url: '/my-training',
    icon: GraduationCap,
    // Personal training record - not for admin-type roles, who manage the training catalog/matrix
    // via Admin Area rather than having their own training record to track.
    roles: ['manager', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Skills Gap Analysis',
    url: '/skills-gap',
    icon: Target,
    // Personal gap analysis against the user's own job role - not for admin-type roles, who don't
    // have a job role assignment driving competence/training requirements the way an operational
    // role does.
    roles: ['manager', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Role Transition Planning',
    url: '/role-transition',
    icon: GitBranch,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Team Compliance Matrix',
    url: '/team-compliance',
    icon: MapPin,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier', 'assessor'],
  },
  {
    title: 'Compliance Explorer',
    url: '/compliance-explorer',
    icon: SlidersHorizontal,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier', 'assessor'],
  },
  {
    title: 'Competence Detail Report',
    url: '/competence-detail',
    icon: LayoutGrid,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier', 'assessor'],
  },
  {
    title: 'Org Chart',
    url: '/org-chart',
    icon: Workflow,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier', 'assessor'],
  },
  {
    title: 'External Training',
    icon: ShoppingCart,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
    items: [
      { title: 'Training Catalog', url: '/training-catalog', icon: BookOpen },
      { title: 'My Bookings', url: '/my-bookings', icon: Calendar },
    ],
  },
  {
    title: 'Evidence Portal',
    url: '/evidence',
    icon: Upload,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Training Completions',
    url: '/admin/training-completions',
    icon: ShieldCheck,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier'],
  },
  {
    title: 'EI PSM Element 3 KPIs',
    url: '/reports/element3-kpi',
    icon: TrendingUp,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier'],
  },
  {
    title: 'My Profile',
    url: '/profile',
    icon: User2,
    roles: ['developer', 'super_admin', 'admin', 'manager', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
];

export function AppSidebar() {
  const { user, hasRole, logout } = useAuth();

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user.role)
  );

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <CaperaLogo
              className="h-8 w-auto text-sidebar-foreground"
              data-testid="capera-logo"
            />
            <SidebarGroupLabel className="flex-1">Skills Management Platform</SidebarGroupLabel>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.items ? (
                    <>
                      <SidebarMenuButton data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <a href={subItem.url} data-testid={`nav-${subItem.title.toLowerCase().replace(/\s+/g, '-')}`}>
                                <subItem.icon />
                                <span>{subItem.title}</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </>
                  ) : (
                    <SidebarMenuButton asChild>
                      <a href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={`${user.firstName} ${user.lastName}`} />
                    <AvatarFallback className="rounded-lg">
                      {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user.firstName} {user.lastName}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="right"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem data-testid="menu-profile">
                  <User2 />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-settings">
                  <Settings />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} data-testid="menu-logout">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}