import {
  Calendar,
  ChevronUp,
  Home,
  Inbox,
  Search,
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
  Building2,
  MapPin,
  CalendarDays,
  ClipboardList,
  Network,
} from 'lucide-react';
import caperaLogo from '@assets/Capera Logo_1758716983827.jpg';

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
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Executive Dashboard',
    url: '/dashboard',
    icon: Home,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Admin Area',
    icon: Shield,
    roles: ['developer', 'super_admin', 'admin'],
    items: [
      { title: 'User Management', url: '/admin/users', icon: Users },
      { title: 'Historical Import', url: '/admin/historical-import', icon: FileUp },
      { title: 'Bulk Assignment', url: '/admin/bulk-assignment', icon: Users },
      { title: 'Email Notifications', url: '/admin/notifications', icon: Bell },
      { title: 'Training Providers', url: '/admin/training-providers', icon: Building2 },
      { title: 'Training Venues', url: '/admin/training-venues', icon: MapPin },
      { title: 'Training Courses', url: '/admin/training-courses', icon: BookOpen },
      { title: 'Training Sessions', url: '/admin/training-sessions', icon: CalendarDays },
      { title: 'Booking Management', url: '/admin/booking-management', icon: ClipboardList },
      { title: 'Training Policy Matrix', url: '/admin/training-policy-matrix', icon: Network },
    ],
  },
  {
    title: 'Developer Area',
    icon: Settings,
    roles: ['developer', 'super_admin'],
    items: [
      { title: 'Standards Management', url: '/developer-standards', icon: Target },
      { title: 'Competency Manager', url: '/competency-manager', icon: Target },
      { title: 'Framework Builder', url: '/training-framework', icon: BookOpen },
      { title: 'System Overview', url: '/overview', icon: BarChart3 },
    ],
  },
  {
    title: 'Assessor Tools',
    icon: ClipboardCheck,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor'],
    items: [
      { title: 'Assessment Dashboard', url: '/assessor-dashboard', icon: BarChart3 },
      { title: 'Workspace', url: '/assessor-workspace', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Self Assessment',
    url: '/self-assessment',
    icon: User2,
    roles: ['candidate', 'trainee', 'assessor'],
  },
  {
    title: 'My Training',
    url: '/my-training',
    icon: GraduationCap,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Skills Gap Analysis',
    url: '/skills-gap',
    icon: Target,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'External Training',
    icon: ShoppingCart,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
    items: [
      { title: 'Training Catalog', url: '/training-catalog', icon: BookOpen },
      { title: 'My Bookings', url: '/my-bookings', icon: Calendar },
    ],
  },
  {
    title: 'Learning Resources',
    url: '/resources',
    icon: BookOpen,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Team Management',
    icon: Users,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier'],
    items: [
      { title: 'Team Matrix', url: '/team-matrix', icon: Users },
      { title: 'Talent Finder', url: '/talent-finder', icon: Search },
    ],
  },
  {
    title: 'Evidence Portal',
    url: '/evidence',
    icon: Upload,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Analytics & Reports',
    icon: BarChart3,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier'],
    items: [
      { title: 'Analytics Dashboard', url: '/analytics', icon: BarChart3 },
      { title: 'Granular Reports', url: '/reports', icon: Inbox },
    ],
  },
  {
    title: 'My Profile',
    url: '/profile',
    icon: User2,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
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
            <img 
              src={caperaLogo} 
              alt="Capera Logo" 
              className="h-8 w-auto"
              data-testid="capera-logo"
            />
            <SidebarGroupLabel className="flex-1">Capera Platform</SidebarGroupLabel>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.items ? (
                    <SidebarMenuButton asChild>
                      <div>
                        <item.icon />
                        <span>{item.title}</span>
                      </div>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild>
                      <a href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  )}
                  {item.items && (
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