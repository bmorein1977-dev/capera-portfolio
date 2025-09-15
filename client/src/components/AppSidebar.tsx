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

// Menu items based on user role
const menuItems = [
  {
    title: 'Dashboard',
    url: '#',
    icon: Home,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor', 'candidate', 'trainee'],
  },
  {
    title: 'Skills Management',
    icon: Target,
    roles: ['developer', 'super_admin', 'admin'],
    items: [
      { title: 'Skills Framework', url: '#', icon: BookOpen },
      { title: 'Assessment Matrix', url: '#', icon: ClipboardCheck },
      { title: 'Competency Standards', url: '#', icon: Target },
    ],
  },
  {
    title: 'Team Matrix',
    url: '#',
    icon: Users,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier'],
  },
  {
    title: 'Assessments',
    icon: ClipboardCheck,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier', 'assessor'],
    items: [
      { title: 'Create Assessment', url: '#', icon: ClipboardCheck },
      { title: 'Review Assessments', url: '#', icon: Search },
      { title: 'Evidence Upload', url: '#', icon: Upload },
    ],
  },
  {
    title: 'Talent Finder',
    url: '#',
    icon: Search,
    roles: ['developer', 'super_admin', 'admin'],
  },
  {
    title: 'Analytics',
    url: '#',
    icon: BarChart3,
    roles: ['developer', 'super_admin', 'admin', 'internal_verifier'],
  },
  {
    title: 'Learning',
    icon: BookOpen,
    roles: ['candidate', 'trainee', 'assessor'],
    items: [
      { title: 'My Learning Path', url: '#', icon: BookOpen },
      { title: 'Training Materials', url: '#', icon: Inbox },
      { title: 'Certificates', url: '#', icon: Calendar },
    ],
  },
  {
    title: 'My Profile',
    url: '#',
    icon: User2,
    roles: ['candidate', 'trainee'],
  },
  {
    title: 'Settings',
    url: '#',
    icon: Settings,
    roles: ['developer', 'super_admin', 'admin'],
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