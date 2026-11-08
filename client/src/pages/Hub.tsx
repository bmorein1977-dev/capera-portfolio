import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth, useLicence } from "@/hooks/useAuth";
import { NAV_SECTIONS, visibleSections } from "@/lib/navigation";

// A section's home: everything in it, grouped under clear headings and shown as tiles. This is what replaces a long list in the
// sidebar. What appears depends on the person's roles, and the filter narrows the tiles as you type.

export default function Hub({ id }: { id: string }) {
  const { user } = useAuth();
  const licence = useLicence();
  const roles = user ? (user.effectiveRoles ?? [user.role]) : [];
  const section = useMemo(() => visibleSections(roles, licence).find(s => s.id === id), [roles.join(","), licence, id]);
  const meta = NAV_SECTIONS.find(s => s.id === id);
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();

  if (!section || !meta) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center" data-testid="hub-unavailable">
        <h1 className="text-2xl font-semibold tracking-tight">Nothing here for you</h1>
        <p className="mt-2 text-muted-foreground">This area is not available for your role. Use the menu to go somewhere else.</p>
      </div>
    );
  }

  const groups = section.groups.map(g => ({ ...g, items: g.items.filter(i => !q || `${i.title} ${i.description} ${g.title}`.toLowerCase().includes(q)) })).filter(g => g.items.length > 0);
  const Icon = section.icon;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10" data-testid={`hub-${id}`}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
          <h1 className="text-3xl font-semibold tracking-tight" data-testid="text-hub-title">{section.title}</h1>
          <p className="mt-2 text-muted-foreground">{section.description}</p>
        </div>
        {section.count > 8 && (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter this page" className="pl-9" data-testid="input-hub-filter" />
          </div>
        )}
      </header>

      {groups.length === 0 && <p className="rounded-xl border bg-card p-10 text-center text-muted-foreground" data-testid="text-hub-empty">Nothing matches that.</p>}

      <div className="space-y-10">
        {groups.map(g => (
          <section key={g.title} aria-labelledby={`hub-group-${g.title}`}>
            <h2 id={`hub-group-${g.title}`} className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map(item => {
                const ItemIcon = item.icon;
                return (
                  <Link key={item.url + item.title} href={item.url}
                    className="group relative flex gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`tile-${item.url.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><ItemIcon className="h-[18px] w-[18px]" /></div>
                    <div className="min-w-0">
                      <div className="font-medium leading-snug">{item.title}</div>
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">{item.description}</p>
                    </div>
                    <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
