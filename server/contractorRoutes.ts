// Contractor management: a contracting company's own administrator can see and look after that company's people, add and remove them, and
// record their training and competence. Entries count straight away but are marked "declared by the contractor" and can be revoked; a person
// the contractor adds is held as pending (and inactive) until one of the host company's administrators approves them.
// Everything here is scoped to ONE contracting company: the administrator's own, or (for the host's administrators) the one they name.
import type { Express } from "express";
import { z } from "zod";
import { db } from "./db";
import { and, desc, eq, sql } from "drizzle-orm";
import { users, trainingEnrollments, assessments, contractorDeclarations, trainings, competencyElements, contractCompanies } from "@shared/schema";
import type { IStorage } from "./storage";
import { recordSystemEvent } from "./services/auditLog";
import { validityMonthsFor } from "@shared/competence";

interface Deps {
  storage: IStorage;
  isAuthenticated: any;
  requireRole: (...roles: string[]) => any;
}

const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");
const HOST_ADMIN = ["admin", "super_admin", "developer"];
const dateStr = z.string().refine(v => !Number.isNaN(Date.parse(v)), "not a date");
const today = () => new Date();
const addMonths = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

export function registerContractorRoutes(app: Express, { storage, isAuthenticated, requireRole }: Deps) {
  async function actor(req: any) {
    const id = req.session?.impersonatedUserId || req.user?.claims?.sub;
    const user = id ? await storage.getUser(id) : undefined;
    if (!user) throw new HttpError(401, "User not found");
    const roles = (await storage.getEffectiveRoles(id)).map(norm);
    return { id: id as string, user, roles, isHostAdmin: roles.some(r => HOST_ADMIN.includes(r)), isContractorAdmin: roles.includes("contractor_admin") };
  }

  // the contracting company a request is about
  async function companyOf(req: any): Promise<{ a: Awaited<ReturnType<typeof actor>>; companyId: string }> {
    const a = await actor(req);
    if (a.isContractorAdmin && !a.isHostAdmin) {
      if (!a.user.contractCompanyId) throw new HttpError(403, "Your account is not linked to a contracting company yet. Ask the administrator.");
      return { a, companyId: a.user.contractCompanyId };
    }
    if (a.isHostAdmin) {
      const asked = typeof req.query.companyId === "string" ? req.query.companyId : typeof req.body?.companyId === "string" ? req.body.companyId : "";
      if (!asked) throw new HttpError(400, "Choose a contracting company");
      return { a, companyId: asked };
    }
    throw new HttpError(403, "Not allowed");
  }

  async function personIn(companyId: string, personId: string) {
    const rows = await db.select().from(users).where(and(eq(users.id, personId), eq(users.contractCompanyId, companyId), eq(users.employmentType, "contractor")));
    if (!rows[0]) throw new HttpError(404, "Person not found in this contracting company");
    return rows[0];
  }

  const handle = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    try { const out = await fn(req, res); if (!res.headersSent) res.json(out); }
    catch (e: any) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Some of the details are not valid", fields: e.issues.map(i => i.path.join(".")) });
      if (e?.code === "23505") return res.status(409).json({ error: "That email address is already used by someone in Capera" });
      console.error("Contractor route failed:", e);
      res.status(500).json({ error: "Something went wrong on our side. Please try again." });
    }
  };

  const guard = [isAuthenticated, requireRole("contractor_admin", "admin", "super_admin", "developer")];
  const hostOnly = [isAuthenticated, requireRole("admin", "super_admin", "developer")];

  // ------------------------------------------------------------------ companies
  app.get("/api/contractor/companies", ...guard, handle(async (req) => {
    const a = await actor(req);
    if (a.isContractorAdmin && !a.isHostAdmin) {
      if (!a.user.contractCompanyId) return [];
      return db.select().from(contractCompanies).where(eq(contractCompanies.id, a.user.contractCompanyId));
    }
    return db.select().from(contractCompanies).where(eq(contractCompanies.isActive, true)).orderBy(contractCompanies.name);
  }));

  // ------------------------------------------------------------------ people
  app.get("/api/contractor/people", ...guard, handle(async (req) => {
    const { companyId } = await companyOf(req);
    const includeLeft = req.query.includeLeft === "true";
    const rows = (await db.execute(sql`
      select u.id, u.first_name as "firstName", u.last_name as "lastName", u.email, u.vantage_number as "vantageNumber", u.job_role_id as "jobRoleId",
        u.is_active as "isActive", u.is_archived as "isArchived", u.approval_status as "approvalStatus", u.left_at as "leftAt", jr.name as "jobRoleName", u.role
      from users u left join job_roles jr on jr.id = u.job_role_id
      where u.contract_company_id = ${companyId} and u.employment_type = 'contractor' and u.role <> 'contractor_admin'
        and (${includeLeft} or not coalesce(u.is_archived, false))
      order by u.last_name, u.first_name`)).rows as any[];
    const out = [];
    for (const r of rows) {
      let competence = null, training = null;
      if (r.isActive && r.approvalStatus === "approved" && r.jobRoleId) {
        const [gap, tr] = await Promise.all([storage.getSkillsGapAnalysis(r.id), storage.getTrainingComplianceStatus(r.id)]);
        competence = gap ? gap.statistics : null; training = tr ? tr.statistics : null;
      }
      const verified = !!competence && competence.expired === 0 && competence.missing === 0 && (!training || (training.expired === 0 && training.missing === 0));
      out.push({ ...r, status: r.isArchived ? "left" : r.approvalStatus === "visitor" ? "visitor" : r.approvalStatus === "pending" ? "pending" : r.approvalStatus === "rejected" ? "rejected" : "active", competence, training, verified });
    }
    return out;
  }));

  const newPerson = z.object({
    firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    jobRoleId: z.string().trim().min(1).max(100).optional().nullable(),
    location: z.string().trim().max(200).optional().nullable(),
    vantageNumber: z.string().trim().max(40).optional().nullable(),
    dateOfBirth: dateStr.optional().nullable(), companyNumber: z.string().trim().max(40).optional().nullable(),
    startDate: dateStr.optional().nullable(),
  });

  // a person the contractor adds waits, inactive, for the host company to approve them
  app.post("/api/contractor/people", ...guard, handle(async (req, res) => {
    const { a, companyId } = await companyOf(req);
    const d = newPerson.parse(req.body ?? {});
    if (d.jobRoleId) { const jr = await storage.getJobRole(d.jobRoleId); if (!jr) throw new HttpError(400, "That job role does not exist"); }
    const message = "Added. They will count once the host company has approved them.";
    // someone who has visited before already has a record: it becomes a person waiting for approval, and keeps their visitor forms
    const visitor = (await db.select().from(users).where(and(sql`lower(${users.email}) = ${d.email}`, eq(users.contractCompanyId, companyId), eq(users.approvalStatus, "visitor"))))[0];
    if (visitor) {
      await db.update(users).set({
        firstName: d.firstName, lastName: d.lastName, jobRoleId: d.jobRoleId || null, location: d.location || null, vantageNumber: d.vantageNumber ? d.vantageNumber.toUpperCase() : null,
        dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null, companyNumber: d.companyNumber || null, startDate: d.startDate ? new Date(d.startDate) : null,
        approvalStatus: "pending", isArchived: false, leftAt: null, updatedAt: new Date(),
      } as any).where(eq(users.id, visitor.id));
      return res.status(201).json({ id: visitor.id, status: "pending", message });
    }
    const rows = await db.insert(users).values({
      email: d.email, firstName: d.firstName, lastName: d.lastName, role: "candidate", employmentType: "contractor", contractCompanyId: companyId,
      jobRoleId: d.jobRoleId || null, location: d.location || null, vantageNumber: d.vantageNumber ? d.vantageNumber.toUpperCase() : null,
      dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null, companyNumber: d.companyNumber || null, startDate: d.startDate ? new Date(d.startDate) : null,
      isActive: false, approvalStatus: "pending",
    } as any).returning();
    res.status(201).json({ id: rows[0].id, status: "pending", message });
  }));

  // marking a person as having left: they are archived with a leaving date, never deleted
  app.post("/api/contractor/people/:id/leave", ...guard, handle(async (req) => {
    const { companyId } = await companyOf(req);
    const p = await personIn(companyId, req.params.id);
    if (p.role === "contractor_admin") throw new HttpError(403, "A contractor administrator is removed by the host company");
    const leftAt = req.body?.leftAt ? new Date(dateStr.parse(req.body.leftAt)) : new Date();
    await db.update(users).set({ isArchived: true, leftAt, updatedAt: new Date() }).where(eq(users.id, p.id));
    return { success: true };
  }));

  // the host company's decision on a person the contractor added
  app.post("/api/contractor/people/:id/approve", ...hostOnly, handle(async (req) => {
    const a = await actor(req);
    const p = (await db.select().from(users).where(eq(users.id, req.params.id)))[0];
    if (!p || p.employmentType !== "contractor") throw new HttpError(404, "Person not found");
    if (p.approvalStatus !== "pending") throw new HttpError(409, "This person is not waiting for approval");
    await db.update(users).set({ isActive: true, approvalStatus: "approved", updatedAt: new Date() }).where(eq(users.id, p.id));
    if (p.jobRoleId) await storage.assignJobRoleToUser(p.id, p.jobRoleId, a.id);
    return { success: true };
  }));
  app.post("/api/contractor/people/:id/reject", ...hostOnly, handle(async (req) => {
    const p = (await db.select().from(users).where(eq(users.id, req.params.id)))[0];
    if (!p || p.employmentType !== "contractor") throw new HttpError(404, "Person not found");
    if (p.approvalStatus !== "pending") throw new HttpError(409, "This person is not waiting for approval");
    await db.update(users).set({ isActive: false, isArchived: true, leftAt: new Date(), approvalStatus: "rejected", updatedAt: new Date() }).where(eq(users.id, p.id));
    return { success: true };
  }));
  // every person waiting, across all contracting companies (host administrators)
  app.get("/api/contractor/pending", ...hostOnly, handle(async () => (await db.execute(sql`
    select u.id, u.first_name as "firstName", u.last_name as "lastName", u.email, jr.name as "jobRoleName", cc.name as "companyName", u.created_at as "createdAt"
    from users u left join job_roles jr on jr.id = u.job_role_id left join contract_companies cc on cc.id = u.contract_company_id
    where u.approval_status = 'pending' and not coalesce(u.is_archived, false) order by u.created_at`)).rows));

  // ------------------------------------------------------------------ what can be recorded
  app.get("/api/contractor/catalogue", ...guard, handle(async () => ({
    trainings: (await db.select({ id: trainings.id, name: trainings.name, validityPeriod: trainings.validityPeriod }).from(trainings).where(eq(trainings.isActive, true)).orderBy(trainings.name)),
    elements: (await db.select({ id: competencyElements.id, code: competencyElements.code, name: competencyElements.name, reassessmentYears: competencyElements.reassessmentYears }).from(competencyElements).orderBy(competencyElements.code)),
  })));

  // one person's full picture, for the contractor's own view (the same figures as everywhere else)
  app.get("/api/contractor/people/:id", ...guard, handle(async (req) => {
    const { companyId } = await companyOf(req);
    const p = await personIn(companyId, req.params.id);
    const [gap, tr] = await Promise.all([storage.getSkillsGapAnalysis(p.id), storage.getTrainingComplianceStatus(p.id)]);
    const decl = await db.select().from(contractorDeclarations).where(eq(contractorDeclarations.userId, p.id)).orderBy(desc(contractorDeclarations.declaredAt));
    return {
      person: { id: p.id, firstName: p.firstName, lastName: p.lastName, email: p.email, vantageNumber: p.vantageNumber, isActive: p.isActive, approvalStatus: p.approvalStatus },
      competence: gap ? gap.elements.map(e => ({ code: e.element.code, name: e.element.name, required: e.required, status: e.status, expiryDate: e.assessment?.expiryDate ?? null })) : [],
      training: tr ? tr.items.map(i => ({ label: i.label, required: i.required, status: i.status, expiryDate: i.members.find(m => m.enrollment?.expiryDate)?.enrollment?.expiryDate ?? null })) : [],
      declarations: decl,
    };
  }));

  // ------------------------------------------------------------------ recording
  const trainingEntry = z.object({
    trainingId: z.string().trim().min(1).max(100), completedOn: dateStr, expiryDate: dateStr.optional().nullable(),
    certificateRef: z.string().trim().max(200).optional().nullable(), note: z.string().trim().max(1000).optional().nullable(),
  });
  const competenceEntry = z.object({
    elementId: z.string().trim().min(1).max(100), achievedOn: dateStr, expiryDate: dateStr.optional().nullable(),
    certificateRef: z.string().trim().max(200).optional().nullable(), note: z.string().trim().max(1000).optional().nullable(),
  });
  const activePerson = async (companyId: string, id: string) => {
    const p = await personIn(companyId, id);
    if (!p.isActive || p.approvalStatus !== "approved" || p.isArchived) throw new HttpError(409, "Records can only be recorded for people who have been approved and are still working");
    return p;
  };
  const checkDates = (achieved: Date, expiry: Date | null) => {
    if (achieved.getTime() > today().getTime() + 24 * 3600_000) throw new HttpError(400, "The date achieved cannot be in the future");
    if (achieved.getFullYear() < 1980) throw new HttpError(400, "The date achieved is not valid");
    if (expiry && expiry.getTime() <= achieved.getTime()) throw new HttpError(400, "The expiry date must be after the date achieved");
  };

  app.post("/api/contractor/people/:id/training", ...guard, handle(async (req, res) => {
    const { a, companyId } = await companyOf(req);
    const p = await activePerson(companyId, req.params.id);
    const d = trainingEntry.parse(req.body ?? {});
    const t = await storage.getTraining(d.trainingId);
    if (!t || t.isActive === false) throw new HttpError(400, "That training does not exist");
    const achieved = new Date(d.completedOn);
    let expiry = d.expiryDate ? new Date(d.expiryDate) : null;
    if (!expiry && t.validityPeriod) expiry = addMonths(achieved, t.validityPeriod);
    checkDates(achieved, expiry);
    const enr = await storage.createTrainingEnrollment({ userId: p.id, trainingId: t.id, allocatedBy: a.id, status: "completed", achievementDate: achieved, expiryDate: expiry } as any);
    await storage.recordTrainingCompletion({ userId: p.id, trainingId: t.id, enrollmentId: enr.id, method: "contractor_declared", completedAt: achieved } as any);
    const decl = (await db.insert(contractorDeclarations).values({
      userId: p.id, contractCompanyId: companyId, kind: "training", trainingId: t.id, trainingEnrollmentId: enr.id, achievedAt: achieved, expiryDate: expiry,
      certificateRef: d.certificateRef || null, note: d.note || null, declaredBy: a.id,
    }).returning())[0];
    await recordSystemEvent({ actorId: a.id, action: "Contractor declared training", entityType: "Contractor record", entityId: decl.id, entityLabel: `${p.firstName} ${p.lastName}: ${t.name}`, summary: `Declared by the contractor company's administrator` }).catch(() => {});
    res.status(201).json(decl);
  }));

  app.post("/api/contractor/people/:id/competence", ...guard, handle(async (req, res) => {
    const { a, companyId } = await companyOf(req);
    const p = await activePerson(companyId, req.params.id);
    const d = competenceEntry.parse(req.body ?? {});
    const el = (await db.select().from(competencyElements).where(eq(competencyElements.id, d.elementId)))[0];
    if (!el) throw new HttpError(400, "That competence element does not exist");
    const achieved = new Date(d.achievedOn);
    let expiry = d.expiryDate ? new Date(d.expiryDate) : null;
    // with no date given, the standard's own validity period applies; a standard set not to lapse has none
    const months = validityMonthsFor(el);
    if (!expiry && months) expiry = addMonths(achieved, months);
    checkDates(achieved, expiry);
    const asm = await storage.createAssessment({
      candidateId: p.id, elementId: el.id, assessorId: a.id, assessmentDate: achieved, outcome: "competent", expiryDate: expiry,
      assessorComments: `Declared by the contractor company's administrator${d.certificateRef ? ` (certificate ${d.certificateRef})` : ""}`,
      origin: "contractor_declared", isAssignment: false, verificationStatus: "not_verified",
    } as any);
    const decl = (await db.insert(contractorDeclarations).values({
      userId: p.id, contractCompanyId: companyId, kind: "competence", elementId: el.id, assessmentId: asm.id, achievedAt: achieved, expiryDate: expiry,
      certificateRef: d.certificateRef || null, note: d.note || null, declaredBy: a.id,
    }).returning())[0];
    await recordSystemEvent({ actorId: a.id, action: "Contractor declared competence", entityType: "Contractor record", entityId: decl.id, entityLabel: `${p.firstName} ${p.lastName}: ${el.code} ${el.name}`, summary: `Declared by the contractor company's administrator` }).catch(() => {});
    res.status(201).json(decl);
  }));

  // ------------------------------------------------------------------ review and revoke
  app.get("/api/contractor/declarations", ...guard, handle(async (req) => {
    const a = await actor(req);
    const asked = typeof req.query.companyId === "string" ? req.query.companyId : "";
    const own = a.isContractorAdmin && !a.isHostAdmin ? a.user.contractCompanyId : null;
    if (a.isContractorAdmin && !a.isHostAdmin && !own) throw new HttpError(403, "Your account is not linked to a contracting company yet.");
    const company = own || asked || null;
    const status = req.query.status === "revoked" ? "revoked" : req.query.status === "all" ? null : "active";
    return (await db.execute(sql`
      select d.id, d.kind, d.status, d.achieved_at as "achievedAt", d.expiry_date as "expiryDate", d.certificate_ref as "certificateRef", d.note, d.declared_at as "declaredAt",
        d.revoked_at as "revokedAt", d.revoked_reason as "revokedReason", d.user_id as "userId", u.first_name as "firstName", u.last_name as "lastName",
        cc.name as "companyName", coalesce(t.name, e.code || ' ' || e.name) as "what", db.first_name || ' ' || db.last_name as "declaredByName"
      from contractor_declarations d join users u on u.id = d.user_id left join contract_companies cc on cc.id = d.contract_company_id
        left join trainings t on t.id = d.training_id left join competency_elements e on e.id = d.element_id left join users db on db.id = d.declared_by
      where (${company}::text is null or d.contract_company_id = ${company}) and (${status}::text is null or d.status = ${status})
      order by d.declared_at desc limit 500`)).rows;
  }));

  // revoking switches the underlying record off, so it stops counting; the declaration stays as the history
  app.post("/api/contractor/declarations/:id/revoke", ...guard, handle(async (req) => {
    const a = await actor(req);
    const d = (await db.select().from(contractorDeclarations).where(eq(contractorDeclarations.id, req.params.id)))[0];
    if (!d) throw new HttpError(404, "Not found");
    if (!a.isHostAdmin && !(a.isContractorAdmin && a.user.contractCompanyId === d.contractCompanyId)) throw new HttpError(404, "Not found");
    if (d.status === "revoked") throw new HttpError(409, "Already revoked");
    const reason = z.string().trim().min(3).max(500).parse(req.body?.reason);
    if (d.trainingEnrollmentId) await db.update(trainingEnrollments).set({ isActive: false }).where(eq(trainingEnrollments.id, d.trainingEnrollmentId));
    if (d.assessmentId) await db.update(assessments).set({ isActive: false }).where(eq(assessments.id, d.assessmentId));
    await db.update(contractorDeclarations).set({ status: "revoked", revokedBy: a.id, revokedAt: new Date(), revokedReason: reason }).where(eq(contractorDeclarations.id, d.id));
    await recordSystemEvent({ actorId: a.id, action: "Contractor declaration revoked", entityType: "Contractor record", entityId: d.id, entityLabel: d.kind, summary: reason }).catch(() => {});
    return { success: true };
  }));
}
