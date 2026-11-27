// Bronze, Silver and Gold: the one place that says which level of licence a page or a part of the server belongs to.
// Every level includes the one before. Anything not listed here is Bronze (the core). The menu, the hub tiles, search, the page guard,
// the home screen and the server's gate all read this file, so moving something between levels is a one-line change here and nothing else.
//
// The level a deployment is licensed for is set with CAPERA_TIER on the server (bronze, silver or gold). It is Gold when not set, so a
// deployment with no setting loses nothing. This follows the feature table on the landing page (client/src/pages/Landing.tsx); keep the
// two in step. Entries marked "to confirm" are my reading of where something belongs because the table does not mention it.

export const TIERS = ["bronze", "silver", "gold"] as const;
export type Tier = typeof TIERS[number];
export const TIER_LABEL: Record<Tier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

export const tierRank = (t: Tier) => TIERS.indexOf(t);
/** true when a deployment licensed for `licensed` includes something that needs `needed` */
export const tierIncludes = (licensed: Tier, needed: Tier) => tierRank(licensed) >= tierRank(needed);
export const parseTier = (v: unknown): Tier => (TIERS as readonly string[]).includes(String(v ?? "").toLowerCase()) ? (String(v).toLowerCase() as Tier) : "gold";

// ------------------------------------------------------------------------------------------------------------------------ pages

// Pages above Bronze, by address.
export const PAGE_TIER: Record<string, Tier> = {
  // Silver: assurance, learning delivery, HR feed
  "/verifier-dashboard": "silver", "/external-verification": "silver", "/contractor": "gold", "/admin/contractors": "gold", "/contractor/visitors": "gold", "/admin/contractors/visitors": "gold", "/check": "gold", "/admin/internal-verification": "silver", "/admin/standards-review": "silver", "/admin/kpi-targets": "silver",
  "/compliance-explorer": "silver", "/reports/element3-kpi": "silver", "/duty-to-operate": "silver", "/admin/opito": "silver", "/audit-evidence": "silver", "/standardisation": "silver", "/admin/audit-log": "silver", // duty to operate and audit log: to confirm
  "/admin/learning-content": "silver", "/admin/certificates": "silver", "/my-onboarding": "silver", "/admin/induction-programs": "silver", "/admin/workforce-lifecycle": "silver",
  // external training booking and its administration: to confirm (the landing table does not mention it)
  "/training-catalog": "silver", "/my-bookings": "silver", "/training-approvals": "silver", "/admin/training-providers": "silver", "/admin/training-venues": "silver",
  "/admin/external-training-courses": "silver", "/admin/training-sessions": "silver", "/admin/training-policy-matrix": "silver", "/admin/course-bookings": "silver", "/admin/training-cost-report": "silver",
  // feedback on courses and the suitability results: learning delivery, to confirm
  "/my-training-feedback": "silver", "/admin/training-evaluations": "silver",
  // Gold: workforce planning, performance reviews and Talent Score, AI authoring
  "/admin/workforce-planning": "gold", "/role-transition": "gold", "/my-performance": "gold", "/team-performance": "gold", "/admin/performance": "gold", "/admin/standard-wizard": "gold",
};
// Pages above Bronze that are reached by a link rather than the menu (an appraisal, a feedback form, a career profile)
export const PAGE_TIER_PREFIXES: Array<[string, Tier]> = [["/my-training-feedback/", "silver"], ["/performance/", "gold"], ["/career", "gold"], ["/check/", "gold"]];

export function tierForPath(path: string): Tier {
  const p = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (PAGE_TIER[p]) return PAGE_TIER[p];
  for (const [prefix, tier] of PAGE_TIER_PREFIXES) if (p === prefix.replace(/\/$/, "") || p.startsWith(prefix)) return tier;
  return "bronze";
}

// ------------------------------------------------------------------------------------------------------------------------ server

// The parts of the server that belong to one level, matched on the address. Only areas that stand on their own are listed, so Bronze
// is never broken by a gate: everything not listed (assessments, standards, training records, users, locations, reports, notifications,
// announcements, home, translation) stays available at every level.
export const API_TIER: Array<[RegExp, Tier]> = [
  [/^\/api\/(verifications|verifier-allocations|verifiers|sampling-plans|onboarding|hr|staffing|kpi-targets|training-content|certificates|opito|audit-log|standardisation|course-bookings|training-providers|training-venues|external-training-courses|course-training-sessions|training-policy-matrix|training-evaluations)(\/|$)/, "silver"],
  [/^\/api\/training\/(providers|venues|courses|sessions|policy-matrix)(\/|$)/, "silver"],
  [/^\/api\/reports\/(element3-kpi|compliance-explorer|training-cost-activity)(\/|$)/, "silver"],
  [/^\/api\/admin\/internal-verification(\/|$)/, "silver"],
  [/^\/api\/external-verification(\/|$)/, "silver"],
  [/^\/api\/(contractor|check)(\/|$)/, "gold"],
  [/^\/api\/(performance|talent-score|talent-search|swp|standard-draft-sessions|standard-draft-subject-matters|standard-draft-scenarios|standard-draft-questions)(\/|$)/, "gold"],
  [/^\/api\/users\/[^/]+\/(experience|qualifications|talent-score|role-transition)(\/|$)/, "gold"],
];

export function tierForApi(path: string): Tier {
  const p = path.split("?")[0];
  for (const [re, tier] of API_TIER) if (re.test(p)) return tier;
  return "bronze";
}
