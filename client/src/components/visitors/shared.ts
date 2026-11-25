import { queryClient } from "@/lib/queryClient";

export const VISIT_STATUS: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Not submitted", tone: "outline" },
  submitted: { label: "Waiting for review", tone: "secondary" },
  accepted: { label: "Accepted", tone: "default" },
  returned: { label: "Sent back", tone: "destructive" },
  cancelled: { label: "Cancelled", tone: "outline" },
};

export const dayText = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No date");

/** The server's plain-words message out of a failed request, with anything else it sent (such as what is still missing). */
export function problem(e: unknown): { message: string; needed?: string[]; needsLateReason?: boolean } {
  const raw = (e as Error)?.message ?? "";
  const m = raw.match(/^\d{3}: ([\s\S]*)$/);
  try { const j = JSON.parse(m ? m[1] : raw); return { message: j.error || j.message || "Something went wrong", needed: j.needed, needsLateReason: j.needsLateReason }; }
  catch { return { message: raw || "Something went wrong" }; }
}

// every contractor page's data lives under /api/contractor, each address with its own cache entry
export const refreshContractorData = () => queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0] ?? "").startsWith("/api/contractor") });
