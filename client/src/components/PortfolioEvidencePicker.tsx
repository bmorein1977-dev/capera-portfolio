// For an assessor: choose items from this candidate's portfolio to attach to the assessment in front of them. Only this candidate's evidence can ever
// appear here; the server decides that, not this screen.
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EvidenceDetails } from "@/components/EvidenceDetails";

interface Item {
  id: string; title: string | null; evidenceType: string | null; description: string | null; fileName: string; hasFile: boolean;
  uploadedByName: string | null; usedOn: string[]; notAccepted: Array<{ on: string; reason: string | null }>; canOpen: boolean;
}

export function PortfolioEvidencePicker({ assessmentId, candidateName, assessmentName, onClose, onAttached }: {
  assessmentId: string; candidateName: string; assessmentName: string; onClose: () => void; onAttached: () => void;
}) {
  const { toast } = useToast();
  const url = `/api/assessments/${assessmentId}/portfolio-evidence`;
  const { data, isLoading, error } = useQuery<{ signedOff: boolean; items: Item[] }>({ queryKey: [url], staleTime: 0, gcTime: 0 });
  const [chosen, setChosen] = useState<string[]>([]);
  const [find, setFind] = useState("");
  const attach = useMutation({
    mutationFn: async () => (await apiRequest("POST", url, { evidenceIds: chosen })).json() as Promise<{ attached: number }>,
    onSuccess: r => { toast({ title: "Attached", description: `${r.attached} item${r.attached === 1 ? "" : "s"} from ${candidateName}'s portfolio.` }); queryClient.removeQueries({ queryKey: [url] }); onAttached(); onClose(); },
    onError: (e: any) => toast({ title: "Not attached", description: String(e?.message ?? "").replace(/^\d+:\s*/, "").replace(/^\{"error":"(.*)"\}$/, "$1"), variant: "destructive" }),
  });
  const words = find.trim().toLowerCase();
  const items = (data?.items ?? []).filter(i => !words || [i.title, i.fileName, i.description, ...i.usedOn].some(v => (v ?? "").toLowerCase().includes(words)));
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl" data-testid="dialog-portfolio-evidence">
        <DialogHeader>
          <DialogTitle>Attach from {candidateName}'s portfolio</DialogTitle>
          <DialogDescription>Choose evidence that also applies to {assessmentName}. Only {candidateName}'s own evidence is listed.</DialogDescription>
        </DialogHeader>
        {data?.signedOff && <p className="rounded-md bg-muted p-3 text-sm" data-testid="text-after-signoff">This assessment has been signed off. Anything you attach now is marked as attached after sign-off.</p>}
        {(data?.items.length ?? 0) > 5 && <Input placeholder="Search the portfolio" aria-label="Search the portfolio" value={find} onChange={e => setFind(e.target.value)} />}
        <div className="min-h-0 flex-1 divide-y overflow-y-auto">
          {isLoading && <p className="py-4 text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="py-4 text-sm text-destructive">The portfolio could not be loaded.</p>}
          {data && items.length === 0 && <p className="py-4 text-sm text-muted-foreground" data-testid="text-portfolio-empty">{data.items.length ? "Nothing matches." : "There is nothing else in this portfolio to attach."}</p>}
          {items.map(i => (
            <div key={i.id} className="flex items-start gap-3 py-3" data-testid={`row-portfolio-${i.id}`}>
              <Checkbox id={`pf-${i.id}`} className="mt-1" checked={chosen.includes(i.id)} onCheckedChange={v => setChosen(c => (v === true ? [...c, i.id] : c.filter(x => x !== i.id)))} aria-label={`Attach ${i.title || i.fileName}`} />
              <div className="min-w-0 flex-1 space-y-1">
                <label htmlFor={`pf-${i.id}`} className="block cursor-pointer"><EvidenceDetails item={i} /></label>
                <div className="text-xs text-muted-foreground">On {i.usedOn.join("; ")}{i.uploadedByName ? ` · added by ${i.uploadedByName}` : ""}</div>
                {i.notAccepted.map(n => <div key={n.on} className="text-xs text-destructive">Not accepted on {n.on}{n.reason ? `: ${n.reason}` : ""}</div>)}
              </div>
              {i.hasFile && i.canOpen && <Button asChild variant="ghost" size="sm"><a href={`/api/assessment-evidence/${i.id}/download`} target="_blank" rel="noopener noreferrer">Open</a></Button>}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!chosen.length || attach.isPending} onClick={() => attach.mutate()} data-testid="button-attach-selected">{attach.isPending ? "Attaching..." : `Attach ${chosen.length || ""} selected`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
