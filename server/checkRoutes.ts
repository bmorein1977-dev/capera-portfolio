// The QR code "full check": what a phone shows when someone scans a person's badge.
// A signed-in person who is not a checker (or, for an external verifier or contractor administrator, not responsible for that person) sees
// only the name, photo and a verified / not verified tick. A checker sees the full training and competence record, item by item. Every full
// check is written to the audit log (who scanned whom), so a scan is not anonymous.
import type { Express } from "express";
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import { contractorDeclarations, contractCompanies } from "@shared/schema";
import type { IStorage } from "./storage";
import { canAccessPerson } from "./services/personAccess";
import { recordSystemEvent } from "./services/auditLog";
import { rateLimit } from "./security";

interface Deps { storage: IStorage; isAuthenticated: any }

const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");
// may check anyone; an external verifier or a contractor administrator only the people they are responsible for
const CHECKER_ANYONE = ["developer", "super_admin", "admin", "manager", "assessor", "internal_verifier"];
const CHECKER_OWN = ["external_verifier", "contractor_admin"];

export function registerCheckRoutes(app: Express, { storage, isAuthenticated }: Deps) {
  app.get("/api/check/:userId", isAuthenticated, rateLimit({ name: "check", max: 300, windowMs: 60 * 60 * 1000, by: "user" }), async (req: any, res) => {
    try {
      const viewerId = req.session?.impersonatedUserId || req.user?.claims?.sub;
      const roles = (await storage.getEffectiveRoles(viewerId)).map(norm);
      const subject = await storage.getUser(req.params.userId);
      if (!subject || subject.anonymisedAt) return res.status(404).json({ error: "This code is not recognised" });

      const full = viewerId === subject.id
        || roles.some(r => CHECKER_ANYONE.includes(r))
        || (roles.some(r => CHECKER_OWN.includes(r)) && await canAccessPerson(viewerId, roles, subject.id));

      const [gap, tr] = await Promise.all([storage.getSkillsGapAnalysis(subject.id), storage.getTrainingComplianceStatus(subject.id)]);
      const competence = gap?.statistics ?? null, training = tr?.statistics ?? null;
      const working = !!subject.isActive && !subject.isArchived && subject.approvalStatus !== "pending";
      // "verified" = nothing mandatory is expired or missing, on competence or training, and the person is currently working
      const verified = working && !!competence && competence.expired === 0 && competence.missing === 0 && (!training || (training.expired === 0 && training.missing === 0));

      const company = subject.contractCompanyId ? (await db.select().from(contractCompanies).where(eq(contractCompanies.id, subject.contractCompanyId)))[0] : null;
      const identity = {
        id: subject.id, firstName: subject.firstName, lastName: subject.lastName, profileImageUrl: subject.profileImageUrl,
        jobRoleName: gap?.jobRole?.name ?? tr?.jobRole?.name ?? null, employer: company ? company.name : subject.employmentType === "contractor" ? "Contractor" : null,
        working, notWorkingReason: !working ? (subject.approvalStatus === "pending" ? "Waiting for approval" : "No longer active") : null,
      };
      if (!full) return res.json({ full: false, verified, identity, generatedAt: new Date().toISOString() });

      const declared = await db.select().from(contractorDeclarations).where(and(eq(contractorDeclarations.userId, subject.id), eq(contractorDeclarations.status, "active")));
      const byAssessment = new Set(declared.map(d => d.assessmentId).filter(Boolean));
      const byEnrollment = new Set(declared.map(d => d.trainingEnrollmentId).filter(Boolean));

      void recordSystemEvent({
        actorId: viewerId, action: "Checked by QR code", entityType: "Person", entityId: subject.id,
        entityLabel: `${subject.firstName ?? ""} ${subject.lastName ?? ""}`.trim(), summary: "Full training and competence check viewed",
      }).catch(() => {});

      res.json({
        full: true, verified, generatedAt: new Date().toISOString(),
        identity: { ...identity, vantageNumber: subject.vantageNumber, location: subject.location, employmentType: subject.employmentType },
        competence: { statistics: competence, items: (gap?.elements ?? []).map(e => ({
          code: e.element.code, name: e.element.name, required: e.required, safetyCritical: e.safetyCritical, status: e.status, daysUntilExpiry: e.daysUntilExpiry ?? null,
          achievedOn: e.assessment?.assessmentDate ?? null, expiryDate: e.assessment?.expiryDate ?? null,
          declaredByContractor: !!(e.assessment && byAssessment.has(e.assessment.id)),
        })) },
        training: { statistics: training, items: (tr?.items ?? []).map(i => {
          const best = i.members.find(m => m.enrollment) ?? i.members[0];
          return {
            label: i.label, required: i.required, status: i.status, daysUntilExpiry: best?.daysUntilExpiry ?? null,
            achievedOn: best?.enrollment?.achievementDate ?? null, expiryDate: best?.enrollment?.expiryDate ?? null,
            declaredByContractor: !!(best?.enrollment && byEnrollment.has(best.enrollment.id)),
          };
        }) },
      });
    } catch (error) {
      console.error("Error building the check:", error);
      res.status(500).json({ error: "Failed to load the check" });
    }
  });
}
