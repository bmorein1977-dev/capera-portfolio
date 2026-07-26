import { Link } from 'wouter';
import { useAuth, roleLabels } from '@/hooks/useAuth';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, MapPin, Target, Users, Network, GraduationCap, ArrowRight } from 'lucide-react';
import type { UserRole } from '@shared/schema';

// Replaces the old EnhancedDashboard executive view, which rendered hardcoded mock metrics.
// This is a deliberately minimal placeholder - real quick-links only, no invented numbers -
// until the real executive/analytics dashboard (spec pending) replaces it.
const LINKS: Array<{ title: string; description: string; url: string; icon: typeof ShieldCheck; roles: UserRole[] }> = [
  { title: 'Internal Verification', description: 'Quota-aware verification queue and sampling plans', url: '/verifier-dashboard', icon: ShieldCheck, roles: ['developer', 'super_admin', 'admin', 'manager'] },
  { title: 'Team Compliance Matrix', description: 'Live competence and training compliance by team', url: '/team-compliance', icon: MapPin, roles: ['developer', 'super_admin', 'admin', 'manager'] },
  { title: 'Skills Gap Analysis', description: 'Individual and role-based capability gaps', url: '/skills-gap', icon: Target, roles: ['developer', 'super_admin', 'admin', 'manager'] },
  { title: 'User Management', description: 'Manage users, roles, and allocations', url: '/admin/users', icon: Users, roles: ['developer', 'super_admin', 'admin'] },
  { title: 'Organisation Structure', description: 'Locations, teams, business units, job roles', url: '/admin/organisation-structure', icon: Network, roles: ['developer', 'super_admin', 'admin'] },
  { title: 'Training Manager', description: 'Providers, venues, courses, sessions and bookings', url: '/admin/training-manager', icon: GraduationCap, roles: ['developer', 'super_admin', 'admin'] },
];

export function WelcomeOverview() {
  const { user } = useAuth();
  const role = user?.role as UserRole | undefined;
  const links = LINKS.filter((l) => role && l.roles.includes(role));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-welcome">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="text-muted-foreground mt-2">
          {role ? roleLabels[role] : ''} · A dedicated executive dashboard is on the way. In the meantime, here's where the live data already is.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => (
          <Link key={link.url} href={link.url}>
            <Card className="cursor-pointer hover-elevate active-elevate-2" data-testid={`card-link-${link.url.replace(/\//g, '-')}`}>
              <CardHeader>
                <link.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="flex items-center justify-between text-base">
                  {link.title}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
