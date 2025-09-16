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
} from 'lucide-react';

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
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Menu items based on user role - Enhanced for customer-friendly e-portfolio
const menuItems = [
  {
    title: 'Executive Dashboard',
    url: '/dashboard',
    icon: Home,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Developer Area',
    icon: Settings,
    roles: ['developer', 'super_admin'],
    items: [
      { title: 'Standards Management', url: '/developer-standards', icon: Target },
      { title: 'Framework Builder', url: '/skills-framework', icon: BookOpen },
      { title: 'System Overview', url: '/overview', icon: BarChart3 },
    ],
  },
  {
    title: 'Assessor Workspace',
    url: '/assessor-workspace',
    icon: ClipboardCheck,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor'],
  },
  {
    title: 'Self Assessment',
    url: '/self-assessment',
    icon: User2,
    roles: ['candidate', 'trainee', 'assessor'],
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
  const { user, hasRole } = useAuth();

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user.role)
  );

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>SkillForge Platform</SidebarGroupLabel>
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
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user.name}</span>
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
                <DropdownMenuItem data-testid="menu-logout">
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