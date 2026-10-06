import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Shapes returned by /api/performance/* (see server/services/performance.ts)

export type AppraisalStatus = "objectives" | "self_review" | "manager_review" | "calibration" | "meeting" | "signed_off";
export type Outcome = "not_met" | "partially_met" | "met" | "exceeded";

export interface Cycle {
  id: string; name: string; year: number; status: "draft" | "open" | "closed"; ratingScale: number;
  includes360: boolean; requiresCalibration: boolean;
  startDate?: string | null; endDate?: string | null; objectiveDeadline?: string | null; selfReviewDeadline?: string | null; managerReviewDeadline?: string | null;
}
export interface ObjectiveUpdate { id: string; note: string; progressPercent: number | null; authorId: string; createdAt: string }
export interface Objective {
  id: string; title: string; description: string | null; successMeasure: string | null; weighting: number; category: string;
  targetDate: string | null; status: string; progressPercent: number; selfOutcome: Outcome | null; selfComment: string | null;
  managerOutcome: Outcome | null; managerComment: string | null; updates: ObjectiveUpdate[];
}
export interface BehaviourRow {
  behaviour: { id: string; name: string; description: string | null; indicators: string[] | null };
  selfRating: number | null; selfComment: string | null; managerRating: number | null; managerComment: string | null;
}
export interface FeedbackRequestRow { id: string; raterType: string; status: string; raterName: string | null; proposedByMe: boolean }
export interface FeedbackSummary {
  minRaters: number; completedCount: number; visible: boolean; ratingScale?: number;
  overall?: Record<string, number>; groups?: Array<{ raterType: string; count: number; averages: Record<string, number> }>;
  strengths?: string[]; development?: string[];
}
export interface AppraisalDetail {
  appraisal: {
    id: string; status: AppraisalStatus; selfSummary: string | null; selfPerformanceRating: number | null; managerSummary?: string | null;
    performanceRating?: number | null; potentialRating?: number | null; developmentPlan?: string | null; careerAspirations: string | null; mobility: string | null;
    employeeComments: string | null; calibrationNote?: string | null; meetingDate: string | null; sharedAt: string | null;
    objectivesDueDate: string | null; selfReviewDueDate: string | null; managerReviewDueDate: string | null;
    employeeSignedOffAt: string | null; managerSignedOffAt: string | null;
    scores?: { objectives: number | null; performance: number | null; behaviours: number | null; feedback360: number | null } | null;
  };
  cycle: Cycle;
  employee: { id: string; name: string; jobRole: string | null } | null;
  manager: { id: string; name: string } | null;
  objectives: Objective[];
  behaviours: BehaviourRow[];
  feedback: { requests: FeedbackRequestRow[]; summary: FeedbackSummary } | null;
  permissions: {
    isEmployee: boolean; isManager: boolean; isAdmin: boolean; canEditObjectives: boolean; canSubmitSelf: boolean; canSubmitManager: boolean;
    canCalibrate: boolean; canSignOff: boolean; canShare: boolean; canEditDates: boolean; waitingForShare: boolean;
  };
}

export interface TodoItem { appraisalId?: string; requestId?: string; kind: string; title: string; detail: string; path: string; dueDate: string | null; daysLeft: number | null }

// "in 5 days", "today", "3 days overdue"
export function dueText(daysLeft: number | null): string {
  if (daysLeft == null) return "";
  if (daysLeft < 0) return `${-daysLeft} day${daysLeft === -1 ? "" : "s"} overdue`;
  if (daysLeft === 0) return "due today";
  return `due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
}

// yyyy-mm-dd for <input type="date">, from an ISO string
export const toDateInput = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export const STATUS_LABEL: Record<AppraisalStatus, string> = {
  objectives: "Setting objectives", self_review: "Self review", manager_review: "Manager review",
  calibration: "Calibration", meeting: "Discussion", signed_off: "Signed off",
};
export const STATUS_ORDER: AppraisalStatus[] = ["objectives", "self_review", "manager_review", "calibration", "meeting", "signed_off"];

export const OUTCOME_LABEL: Record<Outcome, string> = { not_met: "Not met", partially_met: "Partially met", met: "Met", exceeded: "Exceeded" };
export const OUTCOME_TONE: Record<Outcome, string> = {
  not_met: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  partially_met: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  met: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  exceeded: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
};
export const POTENTIAL_LABEL: Record<number, string> = { 1: "Lower", 2: "Medium", 3: "High" };
export const RATER_LABEL: Record<string, string> = { peer: "Peer", direct_report: "Direct report", stakeholder: "Stakeholder" };

export function StatusBadge({ status }: { status: AppraisalStatus }) {
  const tone = status === "signed_off" ? "default" : "secondary";
  return <Badge variant={tone as any} data-testid={`status-${status}`}>{STATUS_LABEL[status]}</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return <span className="text-sm text-muted-foreground">Not set</span>;
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", OUTCOME_TONE[outcome])}>{OUTCOME_LABEL[outcome]}</span>;
}

// Row of numbered buttons, 1..scale. Read-only when onChange is not given.
export function RatingInput({ value, scale, onChange, label }: { value: number | null | undefined; scale: number; onChange?: (n: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {Array.from({ length: scale }, (_, i) => i + 1).map(n => {
        const selected = value === n;
        return (
          <Button key={n} type="button" size="sm" variant={selected ? "default" : "outline"} className="h-8 w-8 p-0" role="radio" aria-checked={selected}
            disabled={!onChange} onClick={() => onChange?.(n)} data-testid={`rating-${label.replace(/\s+/g, "-").toLowerCase()}-${n}`}>
            {n}
          </Button>
        );
      })}
    </div>
  );
}

// A 0-100 bar with the number beside it
export function ScoreBar({ value, label }: { value: number | null | undefined; label?: string }) {
  if (value == null) return <span className="text-sm text-muted-foreground">{label ?? "n/a"}</span>;
  const tone = value >= 75 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : value >= 35 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2" aria-label={`${Math.round(value)} out of 100`}>
      <div className="h-2 w-24 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>
      <span className="text-sm tabular-nums w-10">{Math.round(value)}</span>
    </div>
  );
}

// Where the appraisal is in its workflow
export function StatusStepper({ status, requiresCalibration }: { status: AppraisalStatus; requiresCalibration: boolean }) {
  const steps = STATUS_ORDER.filter(s => requiresCalibration || s !== "calibration");
  const current = steps.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Appraisal progress">
      {steps.map((s, i) => {
        const done = i < current || status === "signed_off";
        const active = i === current && status !== "signed_off";
        return (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium border",
              done ? "bg-primary text-primary-foreground border-primary" : active ? "border-primary text-primary" : "text-muted-foreground")}>
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("text-sm", active ? "font-medium" : "text-muted-foreground")}>{STATUS_LABEL[s]}</span>
            {i < steps.length - 1 && <span className="hidden sm:block h-px w-5 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

// Throws the server's plain-English message so toasts show something useful
export async function parse<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}
export function errorText(e: any): string {
  const m = String(e?.message ?? "Something went wrong");
  const json = m.replace(/^\d+:\s*/, "");
  try { const o = JSON.parse(json); if (o?.error) return o.error; } catch { /* not JSON */ }
  return json;
}

// True for people who run the review process (HR / admins), including anyone granted an admin role.
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const roles = [user?.role, ...(user?.effectiveRoles ?? [])].filter(Boolean).map(r => String(r).toLowerCase().replace(/[\s-]+/g, "_"));
  return roles.some(r => r === "admin" || r === "super_admin" || r === "developer");
}
