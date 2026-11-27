// How the work to be verified is chosen. The verifier still picks which of the offered assessments to check.

export const SAMPLING_METHODS = {
  coverage: { label: "Coverage", help: "The people you have checked least come first, then the work that has waited longest." },
  risk: { label: "Risk based", help: "Safety-critical work, assessors new to you or recently disagreed with, and outcomes with minor needs come first. Safety-critical work by a new or recently disagreed assessor is always offered." },
  random: { label: "Random", help: "People are put in an order drawn for the quarter. The order cannot be influenced and stays the same until the next quarter." },
} as const;
export type SamplingMethod = keyof typeof SAMPLING_METHODS;
export const samplingMethod = (v: unknown): SamplingMethod => (v === "risk" || v === "random" ? v : "coverage");

export interface SampleAssessment { id: string; safetyCritical: boolean; outcome: string | null; resubmitted: boolean; assessmentDate: Date | string | null }
export interface SampleCandidate<A extends SampleAssessment = SampleAssessment> { candidateId: string; priorVerificationCount: number; assessments: A[] }
export interface AssessorHistory { verifications: number; disagreementsLastYear: number }

/** an assessor with fewer checks than this is treated as new to the verifier */
export const NEW_ASSESSOR_BELOW = 5;

export function riskScore(a: SampleAssessment, h: AssessorHistory): number {
  let s = 0;
  if (a.safetyCritical) s += 4;
  if (h.disagreementsLastYear > 0) s += 3;
  if (h.verifications < NEW_ASSESSOR_BELOW) s += 2;
  if (a.outcome === "competent_with_minor_needs") s += 1;
  return s;
}

/** work that is offered whatever the target says: anything sent back after action and, for risk-based sampling, high-risk work */
export function isAlwaysOffered(a: SampleAssessment, method: SamplingMethod, h: AssessorHistory): boolean {
  if (a.resubmitted) return true;
  return method === "risk" && a.safetyCritical && (h.disagreementsLastYear > 0 || h.verifications < NEW_ASSESSOR_BELOW);
}

// a small, stable hash: the same seed and person always give the same position
export function drawOrder(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return h >>> 0;
}

const oldest = (c: SampleCandidate) => Math.min(...c.assessments.map((a) => new Date(a.assessmentDate ?? 0).getTime()));

/**
 * Chooses which people's work to offer. A person who is chosen is shown in full. `needed` is how many more checks the target asks for.
 */
export function chooseSample<C extends SampleCandidate>(candidates: C[], needed: number, method: SamplingMethod, history: AssessorHistory, seed: string): C[] {
  const ordered = [...candidates].sort((a, b) => {
    if (method === "random") return drawOrder(`${seed}:${a.candidateId}`) - drawOrder(`${seed}:${b.candidateId}`);
    if (method === "risk") {
      const top = (c: C) => Math.max(...c.assessments.map((x) => riskScore(x, history)));
      if (top(b) !== top(a)) return top(b) - top(a);
    }
    return a.priorVerificationCount - b.priorVerificationCount || oldest(a) - oldest(b);
  });
  const chosen = new Set<string>();
  let remaining = needed;
  for (const c of ordered) if (c.assessments.some((a) => isAlwaysOffered(a, method, history))) { chosen.add(c.candidateId); remaining -= c.assessments.length; }
  for (const c of ordered) { if (remaining <= 0) break; if (!chosen.has(c.candidateId)) { chosen.add(c.candidateId); remaining -= c.assessments.length; } }
  return ordered.filter((c) => chosen.has(c.candidateId));
}
