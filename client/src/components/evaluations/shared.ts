import { queryClient } from "@/lib/queryClient";

export const dayText = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No date");
export const monthText = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** The server's plain-words message out of a failed request, with anything else it sent. */
export function problem(e: unknown): { message: string; missing?: string[]; reload?: boolean } {
  const raw = (e as Error)?.message ?? "";
  const m = raw.match(/^\d{3}: ([\s\S]*)$/);
  try { const j = JSON.parse(m ? m[1] : raw); return { message: j.error || j.message || "Something went wrong", missing: j.missing, reload: j.reload }; }
  catch { return { message: raw || "Something went wrong" }; }
}

// every evaluation address has its own cache entry; the home screen's counts change with them
export const refreshEvaluations = () => queryClient.invalidateQueries({ predicate: q => { const k = String(q.queryKey[0] ?? ""); return k.startsWith("/api/training-evaluations") || k.startsWith("/api/home"); } });

export interface MyEvaluation {
  id: string; courseTitle: string; formType: string; formTypeLabel: string; stage: "course" | "followup"; status: string;
  completedOn: string; dueOn: string; providerName: string | null; venueName: string | null; instructor: string | null; started: boolean;
}
