// "Request an assessment date" on My Assessments. A candidate does not pick the date: they say they are ready (or ask for a new date when the
// planned one has gone by) and their assessor sets it. This lists every assessment still open and where each one stands.
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export interface RequestableAssessment {
  id: string;
  assessor_id?: string | null;
  assessorId?: string | null;
  outcome: string;
  planned_assessment_date: string | null;
  planned_assessment_location: string | null;
  candidate_ready_at: string | null;
  element?: { code?: string; name?: string } | null;
}

export type RequestState = "not_ready" | "waiting" | "booked" | "passed" | "asked_again";

export function requestState(a: RequestableAssessment, now = new Date()): RequestState {
  if (a.planned_assessment_date) {
    const planned = new Date(a.planned_assessment_date);
    if (planned >= now) return "booked";
    return a.candidate_ready_at && new Date(a.candidate_ready_at) > planned ? "asked_again" : "passed";
  }
  return a.candidate_ready_at ? "waiting" : "not_ready";
}

const day = (v: string) => format(new Date(v), "PP");

function standing(a: RequestableAssessment, state: RequestState): { tag: string; tone: "default" | "secondary" | "destructive" | "outline"; text: string } {
  const where = a.planned_assessment_location ? ` at ${a.planned_assessment_location}` : "";
  if (state === "booked") return { tag: "Booked", tone: "default", text: `${format(new Date(a.planned_assessment_date!), "PP p")}${where}.` };
  if (state === "passed") return { tag: "Date has passed", tone: "destructive", text: `It was planned for ${day(a.planned_assessment_date!)}${where}.` };
  if (state === "asked_again") return { tag: "New date requested", tone: "secondary", text: `It was planned for ${day(a.planned_assessment_date!)}. You asked for a new date on ${day(a.candidate_ready_at!)}.` };
  if (state === "waiting") return { tag: "Waiting for a date", tone: "secondary", text: `You said you were ready on ${day(a.candidate_ready_at!)}. Your assessor sets the date.` };
  return { tag: "Not requested", tone: "outline", text: "Say when you are prepared, and your assessor will set a date." };
}

export function RequestAssessmentDialog({ open, onClose, assessments, onRequest, busy }: {
  open: boolean; onClose: () => void; assessments: RequestableAssessment[]; onRequest: (id: string) => void; busy: boolean;
}) {
  const stillOpen = assessments.filter(a => a.outcome !== "competent");
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" data-testid="dialog-request-assessment">
        <DialogHeader>
          <DialogTitle>Request an assessment date</DialogTitle>
          <DialogDescription>Tell your assessor when you are ready. They choose the date, and it then shows on this page.</DialogDescription>
        </DialogHeader>
        {stillOpen.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground" data-testid="text-nothing-to-request">You have no open assessments. Speak to your assessor or line manager if you expect one.</p>
        ) : (
          <div className="divide-y">
            {stillOpen.map(a => {
              const state = requestState(a);
              const s = standing(a, state);
              const hasAssessor = !!(a.assessor_id ?? a.assessorId);
              return (
                <div key={a.id} className="flex flex-wrap items-start gap-3 py-3" data-testid={`row-request-${a.id}`}>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-sm font-medium">{a.element?.code ? `${a.element.code}: ` : ""}{a.element?.name ?? "Assessment"}</div>
                    <Badge variant={s.tone}>{s.tag}</Badge>
                    <p className="text-sm text-muted-foreground">{s.text}{!hasAssessor ? " No assessor is set for this yet: tell your line manager." : ""}</p>
                  </div>
                  {(state === "not_ready" || state === "passed") && (
                    <Button size="sm" disabled={busy} onClick={() => onRequest(a.id)} data-testid={`button-request-${a.id}`}>
                      {state === "passed" ? "Ask for a new date" : "I'm ready"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
