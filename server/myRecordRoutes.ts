// A person's own records, for the Evidence Portal and My Profile. Both answer only about whoever is asking (or whoever an administrator is viewing
// as): there is no address or setting that names someone else. Storage keys and review notes that are not the person's business are never sent.
import type { Express } from "express";
import { db } from "./db";
import { inArray, sql } from "drizzle-orm";
import { assessments, competencyElements } from "@shared/schema";
import { requirementsFor, pairKey } from "./services/competenceRecords";
import { effectiveExpiry } from "@shared/competence";
import { linkInfoFor } from "./evidenceRoutes";

export function registerMyRecordRoutes(app: Express, { isAuthenticated }: { isAuthenticated: any }) {
  const me = (req: any): string => req.session?.impersonatedUserId || req.user?.claims?.sub;
  const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as any[];
  const handle = (fn: (req: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { res.json(await fn(req)); }
    catch (e: any) { console.error(`Error in ${req.method} ${req.path}:`, e?.message ?? e); res.status(500).json({ error: "Something went wrong on our side. Please try again." }); }
  };
  const name = (alias: string) => sql.raw(`nullif(trim(concat_ws(' ', ${alias}.first_name, ${alias}.last_name)), '')`);

  // Evidence on the person's own assessments, whoever added it, and the assessments they can still add to.
  app.get("/api/my-evidence", isAuthenticated, handle(async (req) => {
    const id = me(req);
    const open = await rows(sql`select a.id, e.code, e.name, ${name("s")} as "assessorName"
      from assessments a join competency_elements e on e.id = a.element_id left join users s on s.id = a.assessor_id
      where a.candidate_id = ${id} and a.is_active and a.is_assignment and a.sign_off_at is null and a.outcome <> 'competent' order by e.code`);
    const evidence = await rows(sql`select v.id, v.title, v.evidence_type as "evidenceType", v.description, v.file_name as "fileName", v.file_size as "fileSize",
        (coalesce(v.file_url, '') <> '') as "hasFile", v.created_at::text as "createdAt", v.rejected_at::text as "rejectedAt", v.rejection_reason as "rejectionReason",
        (v.uploaded_by = ${id}) as "mine", ${name("u")} as "uploadedByName", e.code as "elementCode", e.name as "elementName", (a.sign_off_at is not null) as "signedOff"
      from assessment_evidence v join assessments a on a.id = v.assessment_id join competency_elements e on e.id = a.element_id left join users u on u.id = v.uploaded_by
      where a.candidate_id = ${id} and a.is_active and coalesce(v.is_active, true) order by v.created_at desc limit 500`);
    const links = await linkInfoFor(evidence.map(e => e.id));
    return { openAssessments: open, evidence: evidence.map(e => ({ ...e, linked: links.get(e.id) ?? null })) };
  }));

  // Who the records say the person is, and their assessment history. Competence and training figures come from the same services as the rest of Capera.
  app.get("/api/my-profile", isAuthenticated, handle(async (req) => {
    const id = me(req);
    const [person] = await rows(sql`select u.first_name as "firstName", u.last_name as "lastName", u.email, u.department, u.team_shift as "team",
        coalesce(l.name, u.location) as "location", b.name as "businessUnit", j.name as "jobRole", j2.name as "secondaryJobRole",
        ${name("m")} as "manager", ${name("sv")} as "supervisor", u.employment_type as "employmentType", c.name as "contractCompany",
        u.company_number as "companyNumber", u.vantage_number as "vantageNumber", u.start_date::text as "startDate", u.cv_file_name as "cvFileName",
        (u.avatar_object_key is not null) as "hasPhoto"
      from users u left join job_roles j on j.id = u.job_role_id left join job_roles j2 on j2.id = u.secondary_job_role_id
        left join locations l on l.id = u.location_id left join business_units b on b.id = u.business_unit_id
        left join contract_companies c on c.id = u.contract_company_id left join users m on m.id = u.manager_id left join users sv on sv.id = u.supervisor_id
      where u.id = ${id}`);
    // signed-off results, and any competent result that already counts towards compliance. An assessor's unfinished "not yet competent" is not shown.
    const history = await rows(sql`select a.id, e.code, e.name, a.element_id as "elementId", a.outcome, a.assessment_date::text as "assessedOn", a.sign_off_at::text as "signedOffOn", a.expiry_date::text as "expiresOn", ${name("s")} as "assessorName"
      from assessments a join competency_elements e on e.id = a.element_id left join users s on s.id = a.assessor_id
      where a.candidate_id = ${id} and a.is_active and not coalesce(a.is_assignment, false) and (a.sign_off_at is not null or a.outcome in ('competent', 'competent_with_minor_needs'))
      order by coalesce(a.sign_off_at, a.assessment_date) desc nulls last limit 500`);
    // where no date was saved, work it out the same way every other screen does
    const needsDate = history.filter(h => !h.expiresOn);
    if (needsDate.length) {
      const full = new Map((await db.select().from(assessments).where(inArray(assessments.id, needsDate.map(h => h.id as string)))).map(a => [a.id, a]));
      const required = await requirementsFor([id]);
      const elements = new Map((await db.select().from(competencyElements).where(inArray(competencyElements.id, needsDate.map(h => h.elementId as string)))).map(e => [e.id, e]));
      for (const h of needsDate) {
        const expiry = effectiveExpiry(full.get(h.id as string), elements.get(h.elementId as string), required.get(pairKey(id, h.elementId as string)));
        if (expiry) h.expiresOn = expiry.toISOString().replace("T", " ").slice(0, 19);
      }
    }
    return { person: person ?? null, history };
  }));
}
