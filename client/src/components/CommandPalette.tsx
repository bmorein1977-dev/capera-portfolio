import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth, useLicence, useTrainingPermissions } from "@/hooks/useAuth";
import { hubUrl, visibleSections, HOME } from "@/lib/navigation";

// Search: type a few letters and jump to any page the person is allowed to open. Opens with Ctrl or Cmd + K, or from the sidebar.
const EVENT = "capera:open-search";
export const openSearch = () => window.dispatchEvent(new Event(EVENT));

// Every word typed must appear somewhere in an item. Each item's value is "title | everything else", so a hit in the title
// ranks above a hit only in the description or the area it belongs to. (The built-in matching is fuzzy, so a short word like
// "cert" would match almost everything.)
const SEPARATOR = " | ";
function match(value: string, search: string): number {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const [title, ...rest] = value.toLowerCase().split(SEPARATOR);
  const all = [title, ...rest].join(" ");
  if (!words.every(w => all.includes(w))) return 0;
  return words.every(w => title.includes(w)) ? 1 : 0.5;
}

export default function CommandPalette() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const roles = user ? (user.effectiveRoles ?? [user.role]) : [];
  const licence = useLicence();
  const sections = visibleSections(roles, licence, useTrainingPermissions());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(o => !o); } };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENT, onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(EVENT, onOpen); };
  }, []);

  const go = (url: string) => { setOpen(false); navigate(url); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl sm:max-w-xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Type to find a page, then press Enter to open it.</DialogDescription>
        <Command filter={match} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5">
      <CommandInput placeholder="Search pages and tools" data-testid="input-search" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nothing matches that.</CommandEmpty>
        <CommandGroup heading="Go to">
          <CommandItem value={`Home${SEPARATOR}dashboard`} onSelect={() => go(HOME.url)} data-testid="search-home"><HOME.icon className="mr-2 h-4 w-4 text-muted-foreground" />Home</CommandItem>
          {sections.map(s => <CommandItem key={s.id} value={`${s.title}${SEPARATOR}${s.description}`} onSelect={() => go(hubUrl(s.id))} data-testid={`search-hub-${s.id}`}><s.icon className="mr-2 h-4 w-4 text-muted-foreground" />{s.title}</CommandItem>)}
        </CommandGroup>
        {sections.map(s => s.groups.map(g => (
          <CommandGroup key={`${s.id}-${g.title}`} heading={`${s.title} · ${g.title}`}>
            {g.items.map(i => (
              <CommandItem key={i.url + i.title} value={`${i.title}${SEPARATOR}${i.description}${SEPARATOR}${g.title}${SEPARATOR}${s.title}`} onSelect={() => go(i.url)} data-testid={`search-item-${i.url.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`}>
                <i.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0"><div className="truncate">{i.title}</div><div className="truncate text-xs text-muted-foreground">{i.description}</div></div>
              </CommandItem>
            ))}
          </CommandGroup>
        )))}
      </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
