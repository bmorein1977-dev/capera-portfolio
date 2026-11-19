import { Link, useLocation } from "wouter";
import { ChevronsUpDown, LogOut, Search, Settings, User2 } from "lucide-react";
import { CaperaLogo } from "@/components/icons/CaperaLogo";
import { CaperaCrest } from "@/components/icons/CaperaCrest";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, useLicence, useTrainingPermissions, roleLabels } from "@/hooks/useAuth";
import { HOME, findNavContext, hubUrl, visibleSections } from "@/lib/navigation";
import { openSearch } from "@/components/CommandPalette";
import type { UserRole } from "@shared/schema";

// A short sidebar: Home, then one entry per area. Each area opens a page of tiles (see pages/Hub.tsx) rather than expanding into a long
// list, and Search (Ctrl or Cmd + K) gets to any page directly. What is listed comes from lib/navigation.ts, filtered by the person's roles.

// the active entry gets a thin copper bar, matching the crest
const ACTIVE = "relative data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-2 data-[active=true]:before:bottom-2 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { setOpenMobile } = useSidebar();
  const roles = user ? (user.effectiveRoles ?? [user.role]) : [];
  const licence = useLicence();
  const sections = visibleSections(roles, licence, useTrainingPermissions());
  const current = findNavContext(location);
  const isHome = location === "/" || location === "/dashboard";
  const canSetup = roles.some(r => ["developer", "super_admin", "admin"].includes(r));
  const close = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 pb-2 pt-5">
        <Link href="/dashboard" onClick={close} aria-label="Capera home" className="block">
          <CaperaLogo className="h-8 w-auto text-sidebar-foreground group-data-[collapsible=icon]:hidden" data-testid="capera-logo" />
          <CaperaCrest className="hidden h-7 w-7 group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="pb-1">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Search" onClick={openSearch} className="h-10 border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" data-testid="button-open-search">
                  <Search />
                  <span className="flex-1 text-left">Search</span>
                  <kbd className="rounded border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">Ctrl K</kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={HOME.title} isActive={isHome} className={`h-10 ${ACTIVE}`}>
                  <Link href={HOME.url} onClick={close} data-testid="nav-home"><HOME.icon /><span>{HOME.title}</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {sections.map(s => (
                <SidebarMenuItem key={s.id}>
                  <SidebarMenuButton asChild tooltip={s.title} isActive={current.section?.id === s.id} className={`h-10 ${ACTIVE}`}>
                    <Link href={hubUrl(s.id)} onClick={close} data-testid={`nav-${s.id}`}><s.icon /><span>{s.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-2">
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Account"} className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`} />
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">{user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.firstName} {user?.lastName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">{user ? roleLabels[user.role as UserRole] ?? user.role : ""}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-56 rounded-lg" side="top" align="start" sideOffset={6}>
                <DropdownMenuItem asChild data-testid="menu-profile"><Link href="/profile" onClick={close}><User2 className="mr-2 h-4 w-4" />My profile</Link></DropdownMenuItem>
                {canSetup && <DropdownMenuItem asChild data-testid="menu-settings"><Link href="/setup" onClick={close}><Settings className="mr-2 h-4 w-4" />Account setup</Link></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} data-testid="menu-logout"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
