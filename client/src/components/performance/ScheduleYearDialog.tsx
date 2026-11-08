import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { errorText, fmtDate } from "@/components/performance/shared";

type Pattern = "annual" | "half_year" | "quarterly";
interface Draft {
  name: string; periodType: string; startDate: string; endDate: string; opensOn: string; selfReviewOpensOn: string | null;
  objectiveDeadline: string | null; selfReviewDeadline: string; managerReviewDeadline: string; carryForward: boolean; includes360: boolean;
}

const PATTERNS: Array<[Pattern, string, string]> = [
  ["annual", "Once a year", "One review for the year, with objectives set at the start."],
  ["half_year", "Mid-year and year-end", "Objectives at the start of the year, a check-in in June and a full review in December."],
  ["quarterly", "Every quarter", "Objectives at the start of the year, then a short review at the end of each quarter."],
];

// Sets out the year's review periods from a pattern, with the dates filled in, and creates them as drafts that open on their own date.
// The dates are a starting point: each period can be edited afterwards.
export function ScheduleYearDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0));
  const [pattern, setPattern] = useState<Pattern>("quarterly");
  const [autoLaunch, setAutoLaunch] = useState(true);
  const valid = Number.isInteger(year) && year >= 2000 && year <= 2100;
  const { data: preview = [], isLoading } = useQuery<Draft[]>({ queryKey: [`/api/performance/schedule/preview?year=${year}&pattern=${pattern}`], enabled: open && valid });
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/performance/schedule", { year, pattern, autoLaunch })).json(),
    onSuccess: (r: { created: unknown[]; skipped: string[] }) => {
      queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/performance") });
      toast({
        title: r.created.length ? `${r.created.length} review period${r.created.length === 1 ? "" : "s"} set up` : "Nothing new to set up",
        description: r.skipped.length ? `${r.skipped.join(", ")} already existed and ${r.skipped.length === 1 ? "was" : "were"} left alone.` : autoLaunch ? "Each will open by itself on its date." : "They are drafts. Launch each when you are ready.",
      });
      onClose();
    },
    onError: (e: any) => toast({ title: "That did not work", description: errorText(e), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl" data-testid="dialog-schedule-year">
        <DialogHeader>
          <DialogTitle>Schedule the year</DialogTitle>
          <DialogDescription>Choose how often people are reviewed. The review periods are created with the dates below, and people are emailed as each opens and as each deadline gets close. You can change any date afterwards.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label htmlFor="sched-year">Year</Label><Input id="sched-year" type="number" className="max-w-28" value={year} onChange={e => setYear(Number(e.target.value))} data-testid="input-schedule-year" /></div>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="How often">
            {PATTERNS.map(([k, label, help]) => (
              <button key={k} type="button" role="radio" aria-checked={pattern === k} onClick={() => setPattern(k)} data-testid={`pattern-${k}`}
                className={`rounded-lg border p-3 text-left transition-colors ${pattern === k ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                <div className="text-sm font-medium">{label}</div><div className="mt-1 text-xs text-muted-foreground">{help}</div>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Review</TableHead><TableHead>Covers</TableHead><TableHead>Opens</TableHead><TableHead>Self assessment due</TableHead><TableHead>Manager review due</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Loading...</TableCell></TableRow>}
                {preview.map(d => (
                  <TableRow key={d.periodType} data-testid={`preview-${d.periodType}`}>
                    <TableCell className="font-medium">{d.name}<div className="mt-0.5 flex flex-wrap gap-1">{d.carryForward && <Badge variant="outline" className="text-[10px]">Carries objectives forward</Badge>}{d.includes360 && <Badge variant="outline" className="text-[10px]">360 feedback</Badge>}</div></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(d.startDate)} to {fmtDate(d.endDate)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(d.opensOn)}{d.selfReviewOpensOn && <div className="text-xs text-muted-foreground">Self assessment opens {fmtDate(d.selfReviewOpensOn)}</div>}</TableCell>
                    <TableCell className="text-sm">{fmtDate(d.selfReviewDeadline)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(d.managerReviewDeadline)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div><Label htmlFor="sched-auto" className="font-medium">Open each period by itself on its date</Label><p className="text-xs text-muted-foreground">A review is created for everyone who has a manager, and they and their managers are emailed. People with no manager are left out, and you are told who.</p></div>
            <Switch id="sched-auto" checked={autoLaunch} onCheckedChange={setAutoLaunch} data-testid="switch-schedule-auto" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || create.isPending || preview.length === 0} onClick={() => create.mutate()} data-testid="button-create-schedule">{create.isPending ? "Setting up..." : `Set up ${preview.length} review period${preview.length === 1 ? "" : "s"}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
