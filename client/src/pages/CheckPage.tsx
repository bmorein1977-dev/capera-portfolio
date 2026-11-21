import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";

// What a phone shows when a person's badge QR code is scanned. Built for a small screen: one big answer at the top (ready to work or not),
// then the detail item by item. A scanner who is not a checker sees only the name, photo and the answer. Opened by /check/<person id>.

interface Item { code?: string; name?: string; label?: string; required: boolean; status: string; daysUntilExpiry: number | null; achievedOn: string | null; expiryDate: string | null; declaredByContractor: boolean; safetyCritical?: boolean }
interface Stats { totalRequired: number; current: number; expired: number; missing: number; expiringSoon30: number }
interface Check {
  full: boolean; verified: boolean; generatedAt: string;
  identity: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null; jobRoleName: string | null; employer: string | null; working: boolean; notWorkingReason: string | null; vantageNumber?: string | null; location?: string | null };
  competence?: { statistics: Stats | null; items: Item[] }; training?: { statistics: Stats | null; items: Item[] };
}

const LABEL: Record<string, string> = { current: "Current", expiring_30: "Expires soon", expiring_60: "Expires soon", expiring_90: "Expires soon", expired: "Expired", missing: "Missing", exempt: "Exempt" };
const tone = (s: string) => (s === "current" || s === "exempt" ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100" : s === "expired" || s === "missing" ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100");
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

function Section({ title, stats, items }: { title: string; stats: Stats | null; items: Item[] }) {
  // problems first, so the eye lands on what matters
  const rank = (s: string) => (s === "expired" || s === "missing" ? 0 : s.startsWith("expiring") ? 1 : 2);
  const sorted = [...items].sort((a, b) => rank(a.status) - rank(b.status));
  return (
    <section className="space-y-2" data-testid={`section-${title.toLowerCase()}`}>
      <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold">{title}</h2>{stats && <span className="text-sm text-muted-foreground">{stats.current} of {stats.totalRequired} required current</span>}</div>
      {sorted.length === 0 && <p className="text-sm text-muted-foreground">Nothing is required.</p>}
      <ul className="space-y-2">
        {sorted.map((i, n) => (
          <li key={n} className="rounded-lg border p-3" data-testid={`item-${title.toLowerCase()}-${n}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="font-medium leading-snug">{i.code ? `${i.code} ` : ""}{i.name ?? i.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{i.achievedOn ? `Achieved ${day(i.achievedOn)}` : "Not recorded"}{i.expiryDate ? `, expires ${day(i.expiryDate)}` : ""}{!i.required ? ", optional" : ""}</div></div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone(i.status)}`}>{LABEL[i.status] ?? i.status}</span>
            </div>
            {i.declaredByContractor && <Badge variant="outline" className="mt-2">Declared by the contractor company</Badge>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CheckPage() {
  const [, params] = useRoute<{ id: string }>("/check/:id");
  const id = params?.id ?? "";
  const { data, isLoading, error } = useQuery<Check>({
    queryKey: [`/api/check/${id}`],
    queryFn: async () => {
      const r = await fetch(`/api/check/${encodeURIComponent(id)}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Request failed (${r.status})`);
      return r.json();
    },
    enabled: !!id, retry: false, refetchOnWindowFocus: true,
  });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !data) return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <ShieldAlert className="h-10 w-10 text-destructive" /><p className="font-medium">Could not load this check</p><p className="text-sm text-muted-foreground">{(error as Error)?.message || "This code is not recognised."}</p>
    </div>
  );

  const { identity: p } = data;
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Unnamed";
  const ready = data.verified;
  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pb-10 pt-4" data-testid="page-check">
      <div className={`rounded-2xl p-5 text-center ${ready ? "bg-green-600 text-white" : "bg-red-600 text-white"}`} data-testid="banner-result" role="status">
        {ready ? <CheckCircle2 className="mx-auto h-14 w-14" /> : <XCircle className="mx-auto h-14 w-14" />}
        <div className="mt-2 text-2xl font-bold">{ready ? "Ready to work" : p.working ? "Not ready to work" : "Not cleared"}</div>
        <div className="mt-1 text-sm opacity-90">{ready ? "Everything required is current." : p.notWorkingReason ?? "Something required is expired or missing."}</div>
      </div>

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16"><AvatarImage src={p.profileImageUrl ?? undefined} alt="" /><AvatarFallback>{name.split(" ").map(x => x[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
        <div className="min-w-0"><div className="text-xl font-semibold leading-tight" data-testid="text-name">{name}</div>
          <div className="text-sm text-muted-foreground">{[p.jobRoleName, p.employer].filter(Boolean).join(", ")}</div>
          {data.full && (p.vantageNumber || p.location) && <div className="text-sm text-muted-foreground">{[p.vantageNumber ? `Vantage ${p.vantageNumber}` : "", p.location].filter(Boolean).join(", ")}</div>}</div>
      </div>

      {!data.full && (
        <p className="rounded-lg bg-muted p-4 text-sm" data-testid="text-limited">This is the short answer. The full training and competence record is shown to administrators, managers, assessors and verifiers, and to a contractor's own administrator.</p>
      )}
      {data.full && data.competence && <Section title="Competence" stats={data.competence.statistics} items={data.competence.items} />}
      {data.full && data.training && <Section title="Training" stats={data.training.statistics} items={data.training.items} />}
      <p className="text-center text-xs text-muted-foreground">Checked {new Date(data.generatedAt).toLocaleString("en-GB")}{data.full ? ". This check has been recorded." : ""}</p>
    </div>
  );
}
