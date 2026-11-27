// The figures an organisation can set a target for. A figure meets its target in green, within 15 points below in amber, otherwise red.

export interface KpiTargetField { key: string; label: string; description: string; group: "Compliance" | "Process safety (Element 3)" }

export const KPI_TARGET_FIELDS: KpiTargetField[] = [
  { key: "competence_overall", group: "Compliance", label: "Overall competence", description: "Share of required competence in date." },
  { key: "competence_safety_critical", group: "Compliance", label: "Safety-critical competence", description: "Share of required safety-critical competence in date." },
  { key: "training_overall", group: "Compliance", label: "Overall training", description: "Share of required training in date." },
  { key: "training_safety_critical", group: "Compliance", label: "Safety-critical training", description: "Share of required safety-critical training in date." },
  { key: "element3_currency", group: "Process safety (Element 3)", label: "3.2a Competence currency", description: "Share of required competence currently held." },
  { key: "element3_iv_assurance", group: "Process safety (Element 3)", label: "3.6b Verification assurance", description: "Share of verifications that agreed with the assessor." },
  { key: "element3_sampling", group: "Process safety (Element 3)", label: "3.6c Sampling achieved", description: "Share of the quarter's verification sample completed." },
  { key: "element3_succession_currency", group: "Process safety (Element 3)", label: "3.4a Succession plans kept current", description: "Share of plans reviewed in the last six months." },
  { key: "element3_succession_depth", group: "Process safety (Element 3)", label: "3.4b Succession depth", description: "Share of plans with at least two successors with development plans." },
];

export type Rag = "green" | "amber" | "red";
export function againstTarget(value: number | null, target: number | null | undefined): Rag | null {
  if (value === null || target === null || target === undefined) return null;
  return value >= target ? "green" : target - value < 15 ? "amber" : "red";
}
