// My Profile: who the records say you are, and your competence, training, certificates and assessments as Capera holds them. Competence and training
// come from the same services as Skills Gap Analysis and My Training, so the figures always agree. Details are kept by administrators: names and email
// addresses appear on certificates and in the audit record, and the email address is how a sign-in is matched to a person, so they are not edited here.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useAuth, useLicence } from "@/hooks/useAuth";
import { useSectorTheme } from "@/contexts/SectorThemeContext";
import { tierForPath, tierIncludes } from "@shared/licence";
import type { ElementStatus, ElearningCertificate, SectorTheme, SkillsGapAnalysis, TrainingComplianceAnalysis, TrainingEnrollment, Training } from "@shared/schema";
import SectorSelector from "./SectorSelector";
import { CompetenceBadgeQr } from "./CompetenceBadgeQr";

interface Profile {
  person: null | {
    firstName: string | null; lastName: string | null; email: string | null; department: string | null; team: string | null; location: string | null; businessUnit: string | null;
    jobRole: string | null; secondaryJobRole: string | null; manager: string | null; supervisor: string | null; employmentType: string | null; contractCompany: string | null;
    companyNumber: string | null; vantageNumber: string | null; startDate: string | null; cvFileName: string | null; hasPhoto: boolean;
  };
  history: Array<{ id: string; code: string | null; name: string; outcome: string; assessedOn: string | null; signedOffOn: string | null; expiresOn: string | null; assessorName: string | null }>;
}
type Enrolment = TrainingEnrollment & { training: Training };

const date = (v: string | Date | null | undefined) => (v ? format(new Date(typeof v === "string" ? v.replace(" ", "T") : v), "PP") : null);
const OUTCOME: Record<string, string> = { competent: "Competent", competent_with_minor_needs: "Competent, with minor development needs", not_yet_competent: "Not yet competent" };

const STATUS: Record<ElementStatus, { label: string; tone: "default" | "secondary" | "destructive" | "outline"; order: number }> = {
  expired: { label: "Expired", tone: "destructive", order: 0 }, expiring_30: { label: "Expires within 30 days", tone: "destructive", order: 1 },
  expiring_60: { label: "Expires within 60 days", tone: "secondary", order: 2 }, expiring_90: { label: "Expires within 90 days", tone: "secondary", order: 3 },
  missing: { label: "Not yet achieved", tone: "outline", order: 4 }, current: { label: "Current", tone: "default", order: 5 }, exempt: { label: "Exempt", tone: "outline", order: 6 },
};
const StatusBadge = ({ status }: { status: ElementStatus }) => <Badge variant={STATUS[status]?.tone ?? "outline"} className="whitespace-nowrap">{STATUS[status]?.label ?? status}</Badge>;
const needsAction = (s: ElementStatus) => s !== "current" && s !== "exempt";

interface Line { key: string; name: string; status: ElementStatus; detail: string }
function Lines({ lines, empty }: { lines: Line[]; empty: string }) {
  if (!lines.length) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="divide-y">
      {[...lines].sort((a, b) => STATUS[a.status].order - STATUS[b.status].order || a.name.localeCompare(b.name)).map(l => (
        <div key={l.key} className="flex flex-wrap items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1"><div className="text-sm font-medium">{l.name}</div>{l.detail && <div className="text-xs text-muted-foreground">{l.detail}</div>}</div>
          <StatusBadge status={l.status} />
        </div>
      ))}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm">{value}</dd></div>;
}

export default function UserProfile() {
  const { user, isLoading: authLoading } = useAuth();
  const licence = useLicence();
  const { setCurrentTheme } = useSectorTheme();
  const [choosingColours, setChoosingColours] = useState(false);
  const id = user?.id;
  const { data: profile, isLoading, error } = useQuery<Profile>({ queryKey: ["/api/my-profile"], staleTime: 0, enabled: !!id });
  const gap = useQuery<SkillsGapAnalysis>({ queryKey: [`/api/users/${id}/skills-gap`], enabled: !!id, staleTime: 0 });
  const training = useQuery<TrainingComplianceAnalysis>({ queryKey: [`/api/users/${id}/training-compliance`], enabled: !!id, staleTime: 0 });
  const enrolments = useQuery<Enrolment[]>({ queryKey: [`/api/training-enrollments?userId=${id}`], enabled: !!id });
  const certificatesIncluded = tierIncludes(licence, "silver");
  const certificates = useQuery<ElearningCertificate[]>({ queryKey: ["/api/certificates/mine"], enabled: !!id && certificatesIncluded });

  if (authLoading || (id && isLoading)) return <p className="p-6 text-muted-foreground">Loading your profile...</p>;
  if (!user || error || !profile?.person) return <p className="p-6 text-destructive">Your profile could not be loaded. Refresh the page to try again.</p>;
  const p = profile.person;
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "";

  const competence: Line[] = (gap.data?.elements ?? []).filter(e => e.required).map(e => {
    const expires = date(e.assessment?.expiryDate as any);
    return { key: e.element.id, name: `${e.element.code ? `${e.element.code}: ` : ""}${e.element.name}`, status: e.status, detail: [e.safetyCritical ? "Safety critical" : null, expires ? `${e.status === "expired" ? "Expired" : "Expires"} ${expires}` : null].filter(Boolean).join(" · ") };
  });
  const required: Line[] = (training.data?.items ?? []).filter(i => i.required).map((i, n) => {
    const best = i.members.find(m => m.status === i.status) ?? i.members[0];
    const expires = date(best?.enrollment?.expiryDate as any);
    return { key: i.groupId ?? best?.training.id ?? String(n), name: i.label, status: i.status, detail: expires ? `${i.status === "expired" ? "Expired" : "Expires"} ${expires}` : i.members.length > 1 ? `Any one of ${i.members.length} courses` : "" };
  });
  const todo: Line[] = [
    ...competence.filter(l => needsAction(l.status)).map(l => ({ ...l, key: `c-${l.key}`, detail: ["Competence", l.detail].filter(Boolean).join(" · ") })),
    ...required.filter(l => needsAction(l.status)).map(l => ({ ...l, key: `t-${l.key}`, detail: ["Training", l.detail].filter(Boolean).join(" · ") })),
  ];
  const stats = (s: { current: number; totalRequired: number } | undefined) => (s ? `${s.current} of ${s.totalRequired} required are current` : "");
  const files = (enrolments.data ?? []).filter(e => e.certificateFileName);
  const issued = (certificates.data ?? []).filter(c => c.status === "issued" || c.status === "pending");
  // the two analyses need a job role; without one there is nothing to measure against, which is not an error
  const noRole = !p.jobRole;
  const loadingFigures = gap.isLoading || training.isLoading;
  const figureError = !noRole && (gap.isError || training.isError);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 sm:p-6" data-testid="page-my-profile">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Avatar className="h-20 w-20">
              <AvatarImage src={p.hasPhoto ? `/api/users/${user.id}/avatar` : user.profileImageUrl || undefined} alt="" />
              <AvatarFallback className="text-2xl">{p.firstName?.charAt(0)}{p.lastName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-profile-name">{fullName}</h1>
                  <p className="text-muted-foreground" data-testid="text-profile-role">{p.jobRole ?? "No job role is assigned yet"}{p.secondaryJobRole ? `, and ${p.secondaryJobRole}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.cvFileName && <Button asChild variant="outline" size="sm"><a href={`/api/users/${user.id}/cv`} target="_blank" rel="noopener noreferrer"><FileText className="mr-2 h-4 w-4" />My CV</a></Button>}
                  {tierIncludes(licence, tierForPath("/career")) && <Button asChild variant="outline" size="sm"><Link href="/career">Career profile</Link></Button>}
                  <Button variant="outline" size="sm" onClick={() => setChoosingColours(true)} data-testid="button-customize-sector"><Sparkles className="mr-2 h-4 w-4" />Sector colours</Button>
                </div>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Email" value={p.email} /><Detail label="Location" value={p.location} /><Detail label="Team or shift" value={p.team} />
                <Detail label="Business unit" value={p.businessUnit ?? p.department} /><Detail label="Line manager" value={p.manager} /><Detail label="Supervisor" value={p.supervisor} />
                <Detail label="Employment" value={p.employmentType === "contractor" ? `Contractor${p.contractCompany ? `, ${p.contractCompany}` : ""}` : p.employmentType === "employee" ? "Employee" : p.employmentType} />
                <Detail label="Company number" value={p.companyNumber} /><Detail label="Vantage number" value={p.vantageNumber} /><Detail label="Started" value={date(p.startDate)} />
              </dl>
              <p className="text-xs text-muted-foreground">If any of these are wrong, ask your administrator to correct them.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <CompetenceBadgeQr userId={user.id} userName={fullName} />

      <Tabs defaultValue="next" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="next" data-testid="tab-next">What needs doing</TabsTrigger>
          <TabsTrigger value="skills" data-testid="tab-skills">Competence</TabsTrigger>
          <TabsTrigger value="certifications" data-testid="tab-certifications">Training and certificates</TabsTrigger>
          <TabsTrigger value="assessments" data-testid="tab-assessments">Assessment history</TabsTrigger>
        </TabsList>

        <TabsContent value="next">
          <Card>
            <CardHeader><CardTitle className="text-base">What needs doing</CardTitle><CardDescription>Required competence and training that is missing, expired or expiring soon.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {noRole ? <p className="text-sm text-muted-foreground">Nothing can be worked out until you have a job role. Ask your administrator.</p>
                : loadingFigures ? <p className="text-sm text-muted-foreground">Loading...</p>
                : figureError ? <p className="text-sm text-destructive">These figures could not be loaded.</p>
                : <Lines lines={todo} empty="Everything required for your job role is current." />}
              <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href="/my-assessments">My Assessments</Link></Button><Button asChild variant="outline" size="sm"><Link href="/my-training">My Training</Link></Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills">
          <Card>
            <CardHeader><CardTitle className="text-base">Required competence</CardTitle><CardDescription>{stats(gap.data?.statistics) || "Against your job role"}</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {noRole ? <p className="text-sm text-muted-foreground">You have no job role yet, so no competence is required of you.</p> : gap.isLoading ? <p className="text-sm text-muted-foreground">Loading...</p>
                : gap.isError ? <p className="text-sm text-destructive">Your competence could not be loaded.</p> : <Lines lines={competence} empty="Your job role has no required competence." />}
              <Button asChild variant="outline" size="sm"><Link href="/skills-gap">Skills Gap Analysis</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Required training</CardTitle><CardDescription>{stats(training.data?.statistics) || "Against your job role"}</CardDescription></CardHeader>
            <CardContent>
              {noRole ? <p className="text-sm text-muted-foreground">You have no job role yet, so no training is required of you.</p> : training.isLoading ? <p className="text-sm text-muted-foreground">Loading...</p>
                : training.isError ? <p className="text-sm text-destructive">Your training could not be loaded.</p> : <Lines lines={required} empty="Your job role has no required training." />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Certificates</CardTitle><CardDescription>Certificates held in Capera for you.</CardDescription></CardHeader>
            <CardContent>
              {files.length === 0 && issued.length === 0 && <p className="text-sm text-muted-foreground" data-testid="text-no-certificates">No certificate files are held. Training records without a file are on My Training.</p>}
              <div className="divide-y">
                {issued.map(c => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium">{c.courseName}</div><div className="text-xs text-muted-foreground">E-learning certificate {c.certificateNumber} · completed {date(c.completedAt as any)}{c.expiryDate ? ` · expires ${date(c.expiryDate as any)}` : ""}</div></div>
                    {c.status === "issued" ? <Button asChild variant="outline" size="sm"><a href={`/api/certificates/${c.id}/view`} target="_blank" rel="noopener noreferrer">View</a></Button> : <Badge variant="secondary">Awaiting approval</Badge>}
                  </div>
                ))}
                {files.map(e => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium">{e.training?.name ?? "Training"}</div><div className="text-xs text-muted-foreground">{e.certificateFileName}{e.achievementDate ? ` · achieved ${date(e.achievementDate as any)}` : ""}{e.expiryDate ? ` · expires ${date(e.expiryDate as any)}` : ""}</div></div>
                    <Button asChild variant="outline" size="sm"><a href={`/api/training-enrollments/${e.id}/certificate/download`} target="_blank" rel="noopener noreferrer"><Download className="mr-1 h-4 w-4" />Download</a></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments">
          <Card>
            <CardHeader><CardTitle className="text-base">Assessment history</CardTitle><CardDescription>{profile.history.length} result{profile.history.length === 1 ? "" : "s"} on your record, newest first.</CardDescription></CardHeader>
            <CardContent>
              {profile.history.length === 0 && <p className="py-4 text-sm text-muted-foreground">No assessment results yet.</p>}
              <div className="divide-y">
                {profile.history.map(a => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 py-2.5" data-testid={`row-history-${a.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{a.code ? `${a.code}: ` : ""}{a.name}</div>
                      <div className="text-xs text-muted-foreground">{[a.signedOffOn ? `Signed off ${date(a.signedOffOn)}` : a.assessedOn ? `Assessed ${date(a.assessedOn)}, no sign-off recorded` : null, a.assessorName ? `assessor ${a.assessorName}` : null, a.expiresOn ? `expires ${date(a.expiresOn)}` : null].filter(Boolean).join(" · ")}</div>
                    </div>
                    <Badge variant={a.outcome === "not_yet_competent" ? "destructive" : a.outcome === "competent" ? "default" : "secondary"}>{OUTCOME[a.outcome] ?? a.outcome}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SectorSelector isVisible={choosingColours} onClose={() => setChoosingColours(false)} onThemeGenerated={(theme: SectorTheme) => setCurrentTheme(theme)} />
    </div>
  );
}
