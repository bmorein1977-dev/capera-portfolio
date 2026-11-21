import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { collectPageUrls } from "@/lib/pageData";
import { findNavContext, HOME } from "@/lib/navigation";
import InfographicDialog, { type InfographicData } from "@/components/InfographicView";
import { FileSpreadsheet, Loader2, PieChart, Sparkles, Download } from "lucide-react";

// "Export" in the top bar, for managers and administrators, on every page. It takes what the page is showing and gives it back as an Excel workbook
// or as an infographic. The server reads the data again as the same person, so nobody can export more than they can see.

interface Source { id: string; name: string; kind: "data" | "reference" | "figures"; rows: number; columns: number; truncated: boolean; defaultOn: boolean }
interface Prepared { id: string; title: string; aiAvailable: boolean; filters: string[]; sources: Source[] }

const ALLOWED = ["manager", "admin", "super_admin", "developer"];

async function post(url: string, body: unknown): Promise<Response> {
  const res = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { let msg = `Request failed (${res.status})`; try { msg = (await res.json()).error || msg; } catch { /* keep the status */ } throw new Error(msg); }
  return res;
}
const fileName = (res: Response, fallback: string) => {
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  try { return m ? decodeURIComponent(m[1]) : fallback; } catch { return fallback; }
};

export default function ExportMenu() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"" | "prepare" | "xlsx" | "info" | "plain">("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [info, setInfo] = useState<InfographicData | null>(null);

  const roles: string[] = user ? (user.effectiveRoles ?? [user.role]) : [];
  if (!roles.some(r => ALLOWED.includes(r))) return null;

  const title = () => {
    const item = findNavContext(location).item;
    if (item) return item.title;
    if (location === "/" || location === "/dashboard") return HOME.title;
    const words = location.split("/").filter(Boolean).filter(w => !/^[0-9a-f-]{8,}$/i.test(w)).slice(-2).join(" ").replace(/[-_]/g, " ");
    return words ? words.replace(/^./, c => c.toUpperCase()) : "Capera page";
  };

  const start = async () => {
    setOpen(true); setPrepared(null); setBusy("prepare");
    try {
      const urls = collectPageUrls(queryClient);
      if (!urls.length) throw new Error("This page has no data to export.");
      const res = await post("/api/export/prepare", { path: location, title: title(), urls });
      const p: Prepared = await res.json();
      setPrepared(p); setChosen(new Set(p.sources.filter(s => s.defaultOn).map(s => s.id)));
    } catch (e: any) {
      setOpen(false); toast({ title: "Nothing to export", description: e?.message, variant: "destructive" });
    } finally { setBusy(""); }
  };

  const toggle = (id: string) => setChosen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const include = () => Array.from(chosen);

  const excel = async () => {
    if (!prepared) return;
    setBusy("xlsx");
    try {
      const res = await post("/api/export/xlsx", { id: prepared.id, include: include() });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fileName(res, `Capera - ${prepared.title}.xlsx`); a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast({ title: "Workbook downloaded", description: `${chosen.size} sheet${chosen.size === 1 ? "" : "s"}.` }); setOpen(false);
    } catch (e: any) { toast({ title: "Could not build the workbook", description: e?.message, variant: "destructive" }); }
    finally { setBusy(""); }
  };

  const infographic = async (ai: boolean) => {
    if (!prepared) return;
    setBusy(ai ? "info" : "plain");
    try {
      const res = await post("/api/export/infographic", { id: prepared.id, include: include(), ai });
      setInfo(await res.json()); setOpen(false);
    } catch (e: any) { toast({ title: "Could not build the infographic", description: e?.message, variant: "destructive" }); }
    finally { setBusy(""); }
  };

  const data = prepared?.sources.filter(s => s.kind !== "reference") ?? [];
  const ref = prepared?.sources.filter(s => s.kind === "reference") ?? [];
  const none = chosen.size === 0;

  const Row = ({ s }: { s: Source }) => (
    <label className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 hover:bg-muted/50" data-testid={`source-${s.id}`}>
      <Checkbox checked={chosen.has(s.id)} onCheckedChange={() => toggle(s.id)} disabled={s.rows === 0} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{s.kind === "figures" ? "key figures" : `${s.rows.toLocaleString("en-GB")} row${s.rows === 1 ? "" : "s"}, ${s.columns} columns`}{s.truncated ? ", first 50,000" : ""}</span>
    </label>
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={start} data-testid="button-export" title="Export what this page shows">
        <Download className="mr-2 h-4 w-4" /><span className="hidden sm:inline">Export</span>
      </Button>
      <Dialog open={open} onOpenChange={o => { if (!busy) setOpen(o); }}>
        <DialogContent className="max-w-xl" data-testid="dialog-export">
          <DialogHeader>
            <DialogTitle>Export: {prepared?.title ?? title()}</DialogTitle>
            <DialogDescription>Take what this page shows as an Excel workbook, or as an infographic. You can only export what you are allowed to see.</DialogDescription>
          </DialogHeader>
          {!prepared && <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Reading the page's data...</div>}
          {prepared && (
            <div className="space-y-4">
              {prepared.filters.length > 0 && <div className="rounded-md bg-muted p-2.5 text-xs" data-testid="text-filters"><span className="font-medium">Filters in force:</span> {prepared.filters.join("; ")}</div>}
              <div className="space-y-2"><div className="text-sm font-semibold">Data on this page</div>{data.map(s => <Row key={s.id} s={s} />)}{data.length === 0 && <p className="text-sm text-muted-foreground">No data found.</p>}</div>
              {ref.length > 0 && <div className="space-y-2"><div className="text-sm font-semibold text-muted-foreground">Lists the page uses (optional)</div>{ref.map(s => <Row key={s.id} s={s} />)}</div>}
              {prepared.aiAvailable && <p className="flex gap-2 text-xs text-muted-foreground"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />For the AI infographic only counts and category names (statuses, roles, sites) are sent to the AI service, never names, emails or other personal details. Use "without AI" to keep everything inside Capera.</p>}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button onClick={excel} disabled={!prepared || none || !!busy} data-testid="button-export-excel">{busy === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}Excel workbook</Button>
            <Button variant="outline" onClick={() => infographic(true)} disabled={!prepared || none || !!busy || !prepared?.aiAvailable} title={prepared && !prepared.aiAvailable ? "AI is not switched on for this Capera" : undefined} data-testid="button-export-infographic">{busy === "info" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Infographic (AI)</Button>
            <Button variant="outline" onClick={() => infographic(false)} disabled={!prepared || none || !!busy} data-testid="button-export-infographic-plain">{busy === "plain" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PieChart className="mr-2 h-4 w-4" />}Infographic without AI</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InfographicDialog data={info} onClose={() => setInfo(null)} />
    </>
  );
}
