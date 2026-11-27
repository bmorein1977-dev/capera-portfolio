// Read-only access for an external verifier: someone outside the company (an awarding or auditing body) who checks how assessments and
// internal verification are done. They see only the assessors an administrator has allocated to them (the same allocation internal verifiers
// use), and can change nothing. Everything here is GET.
import type { Express } from "express";
import { linkInfoFor } from "./evidenceRoutes";
import { db } from "./db";
import { sql } from "drizzle-orm";
import type { IStorage } from "./storage";

interface Deps {
  storage: IStorage;
  isAuthenticated: any;
  requireRole: (...roles: string[]) => any;
}

const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as any[];

export function registerExternalVerifierRoutes(app: Express, { storage, isAuthenticated, requireRole }: Deps) {
  // The person the request acts as, and whether they are an administrator (who may look at what an external verifier would see, by naming them).
  async function actor(req: any) {
    const id = req.session?.impersonatedUserId || req.user?.claims?.sub;
    const roles = id ? (await storage.getEffectiveRoles(id)).map(norm) : [];
    return { id: id as string, roles, isAdmin: roles.some(r => ["admin", "super_admin", "developer"].includes(r)) };
  }
  // whose allocations apply: the external verifier themself, or (administrators only) the one they name
  async function subject(req: any): Promise<string | null> {
    const a = await actor(req);
    const asked = typeof req.query.verifierId === "string" ? req.query.verifierId : null;
    if (asked && asked !== a.id) return a.isAdmin ? asked : null;
    return a.id;
  }
  const guard = [isAuthenticated, requireRole("external_verifier", "admin", "super_admin", "developer")];

  // the assessors allocated to this external verifier
  app.get("/api/external-verification/assessors", ...guard, async (req: any, res) => {
    const who = await subject(req);
    if (!who) return res.status(403).json({ error: "You can only view your own allocations" });
    res.json(await rows(sql`
      select u.id, u.first_name as "firstName", u.last_name as "lastName", u.email,
        (select count(*)::int from assessments a where a.assessor_id = u.id and coalesce(a.is_active, true) and not coalesce(a.is_assignment, false)) as "assessmentCount"
      from verifier_allocations va join users u on u.id = va.assessor_id
      where va.verifier_id = ${who} and va.is_active and (va.ends_on is null or va.ends_on > now()) order by u.last_name, u.first_name`));
  });

  // the completed assessments of those assessors
  app.get("/api/external-verification/assessments", ...guard, async (req: any, res) => {
    const who = await subject(req);
    if (!who) return res.status(403).json({ error: "You can only view your own allocations" });
    const assessorId = typeof req.query.assessorId === "string" ? req.query.assessorId : null;
    res.json(await rows(sql`
      select a.id, a.assessment_date as "assessmentDate", a.outcome, a.verification_status as "verificationStatus",
        c.id as "candidateId", c.first_name as "candidateFirstName", c.last_name as "candidateLastName",
        s.id as "assessorId", s.first_name as "assessorFirstName", s.last_name as "assessorLastName",
        e.code as "elementCode", e.name as "elementName",
        (select count(*)::int from verifications v where v.assessment_id = a.id and coalesce(v.is_active, true)) as "verificationCount"
      from assessments a
      join verifier_allocations va on va.assessor_id = a.assessor_id and va.verifier_id = ${who} and va.is_active and (va.ends_on is null or va.ends_on > now())
      join users c on c.id = a.candidate_id join users s on s.id = a.assessor_id join competency_elements e on e.id = a.element_id
      where coalesce(a.is_active, true) and not coalesce(a.is_assignment, false) and a.outcome is not null
        and (${assessorId}::text is null or a.assessor_id = ${assessorId})
      order by a.assessment_date desc nulls last limit 500`));
  });

  // one assessment: what the assessor recorded, the verification records, the comment thread and the evidence list
  app.get("/api/external-verification/assessments/:id", ...guard, async (req: any, res) => {
    const who = await subject(req);
    if (!who) return res.status(403).json({ error: "You can only view your own allocations" });
    const head = (await rows(sql`
      select a.id, a.assessment_date as "assessmentDate", a.outcome, a.assessor_comments as "assessorComments", a.overall_comment as "overallComment",
        a.knowledge_outcomes as "knowledgeOutcomes", a.performance_outcomes as "performanceOutcomes", a.assessment_methods as "assessmentMethods",
        a.verification_status as "verificationStatus", a.sign_off_at as "signOffAt",
        c.first_name as "candidateFirstName", c.last_name as "candidateLastName", s.first_name as "assessorFirstName", s.last_name as "assessorLastName",
        e.code as "elementCode", e.name as "elementName"
      from assessments a
      join verifier_allocations va on va.assessor_id = a.assessor_id and va.verifier_id = ${who} and va.is_active and (va.ends_on is null or va.ends_on > now())
      join users c on c.id = a.candidate_id join users s on s.id = a.assessor_id join competency_elements e on e.id = a.element_id
      where a.id = ${req.params.id} limit 1`))[0];
    // an assessment outside the allocation is reported as not found, not as forbidden, so its existence is not revealed
    if (!head) return res.status(404).json({ error: "Assessment not found" });
    const [verifications, feedback, evidence] = await Promise.all([
      rows(sql`select v.id, v.verification_date as "verificationDate", v.verification_type as "verificationType", v.outcome, v.verifier_comments as "verifierComments",
                 v.acknowledged_at as "acknowledgedAt", u.first_name as "verifierFirstName", u.last_name as "verifierLastName"
               from verifications v left join users u on u.id = v.verifier_id where v.assessment_id = ${req.params.id} and coalesce(v.is_active, true) order by v.verification_date`),
      rows(sql`select f.id, f.author_role as "authorRole", f.comment, f.created_at as "createdAt", u.first_name as "firstName", u.last_name as "lastName"
               from assessment_feedback f left join users u on u.id = f.author_id where f.assessment_id = ${req.params.id} order by f.created_at`),
      rows(sql`select id, file_name as "fileName", mime_type as "mimeType", file_size as "fileSize", rejected_at as "rejectedAt", created_at as "createdAt",
                 title, evidence_type as "evidenceType", description, (coalesce(file_url, '') <> '') as "hasFile"
               from assessment_evidence where assessment_id = ${req.params.id} and coalesce(is_active, true) order by created_at`),
    ]);
    const links = await linkInfoFor((evidence as any[]).map(e => e.id));
    res.json({ ...head, verifications, feedback, evidence: (evidence as any[]).map(e => ({ ...e, linked: links.get(e.id) ?? null })) });
  });
}
