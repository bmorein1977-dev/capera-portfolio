import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, ShieldAlert, MapPin, Users, GraduationCap, Target, Loader2 } from "lucide-react";

interface BadgeStats {
  jobRoleName?: string;
  totalRequired: number;
  totalOptional: number;
  current: number;
  expiringSoon30: number;
  expiringSoon60: number;
  expiringSoon90: number;
  expired: number;
  missing: number;
  coveragePercentage: number;
}

interface CompetenceBadgeData {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    location: string | null;
    teamShift: string | null;
  };
  competence: BadgeStats | null;
  training: BadgeStats | null;
  isVerified: boolean;
  generatedAt: string;
}

function StatRow({ label, stats }: { label: string; stats: BadgeStats | null }) {
  if (!stats) {
    return (
      <div className="text-sm text-muted-foreground">{label}: no data available (no job role assigned)</div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{stats.coveragePercentage}% coverage</span>
      </div>
      <Progress value={stats.coveragePercentage} className="h-2" />
      <div className="flex gap-2 flex-wrap text-xs">
        <Badge variant="outline" className="text-green-700 border-green-600">{stats.current} current</Badge>
        {stats.expiringSoon30 > 0 && <Badge variant="outline" className="text-amber-700 border-amber-600">{stats.expiringSoon30} expiring &lt;30d</Badge>}
        {stats.expired > 0 && <Badge variant="destructive">{stats.expired} expired</Badge>}
        {stats.missing > 0 && <Badge variant="destructive">{stats.missing} missing</Badge>}
      </div>
    </div>
  );
}

export default function CompetenceBadge() {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('userId') || '';

  const { data, isLoading, error } = useQuery<CompetenceBadgeData>({
    queryKey: ['/api/badge', userId],
    queryFn: async () => {
      const res = await fetch(`/api/badge/${userId}`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      return res.json();
    },
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <p className="text-muted-foreground">No badge specified - scan a valid Capera competence badge QR code.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-destructive" />
            <p className="font-medium">Couldn't load this competence badge</p>
            <p className="text-sm text-muted-foreground mt-1">{(error as any)?.message || 'You may not be authorised to view this person\'s badge.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, competence, training, isVerified } = data;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6" data-testid="page-competence-badge">
      <Card className={isVerified ? 'border-green-500' : 'border-amber-500'}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl">{(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold" data-testid="text-badge-name">{name}</h1>
              {competence?.jobRoleName && <p className="text-muted-foreground">{competence.jobRoleName}</p>}
              <div className="flex gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                {user.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{user.location}</span>}
                {user.teamShift && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{user.teamShift}</span>}
              </div>
            </div>
          </div>
          <div className="mt-4">
            {isVerified ? (
              <Badge className="bg-green-600 text-white hover:bg-green-600 gap-1.5 text-sm py-1.5 px-3" data-testid="badge-status-verified">
                <ShieldCheck className="h-4 w-4" />
                Competence Verified
              </Badge>
            ) : (
              <Badge className="bg-amber-600 text-white hover:bg-amber-600 gap-1.5 text-sm py-1.5 px-3" data-testid="badge-status-attention">
                <ShieldAlert className="h-4 w-4" />
                Attention Needed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4" /> Competence</CardTitle>
          <CardDescription>Live status against this person's assigned job role</CardDescription>
        </CardHeader>
        <CardContent>
          <StatRow label="Competence Elements" stats={competence} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4" /> Training</CardTitle>
          <CardDescription>Live status against this person's required training</CardDescription>
        </CardHeader>
        <CardContent>
          <StatRow label="Training Requirements" stats={training} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Generated {new Date(data.generatedAt).toLocaleString()} - always reflects live data, not a static snapshot.
      </p>
    </div>
  );
}
