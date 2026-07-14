import type { IStorage } from "./storage";

// Local-dev-only: populates the in-memory pg-mem database with a small demo
// scenario (job roles, competency elements, a candidate with assessments) so
// features like Role Transition Planning have real data to show.
export async function seedLocalDevData(storage: IStorage) {
  const existingRoles = await storage.getJobRoles();
  if (existingRoles.length > 0) {
    return; // already seeded
  }

  const category = await storage.createCompetencyCategory({
    name: "Electrical Systems",
    code: "ELEC",
    description: "Core electrical competencies",
  });

  const [safety, diagnosis, hvSwitching, leadership] = await Promise.all([
    storage.createCompetencyElement({
      categoryId: category.id,
      name: "Basic Electrical Safety",
      code: "EL-01",
      description: "Understanding of electrical safety fundamentals",
      safetyCriticality: "High",
      reassessmentYears: 2,
    }),
    storage.createCompetencyElement({
      categoryId: category.id,
      name: "Circuit Fault Diagnosis",
      code: "EL-02",
      description: "Diagnosing and rectifying circuit faults",
      safetyCriticality: "Medium",
      reassessmentYears: 3,
    }),
    storage.createCompetencyElement({
      categoryId: category.id,
      name: "High Voltage Switching",
      code: "EL-03",
      description: "Safe switching operations on HV systems",
      safetyCriticality: "High",
      reassessmentYears: 1,
    }),
    storage.createCompetencyElement({
      categoryId: category.id,
      name: "Team Leadership",
      code: "LD-01",
      description: "Leading a team of technicians on site",
      safetyCriticality: "Low",
      reassessmentYears: 3,
    }),
  ]);

  const technicianRole = await storage.createJobRole({
    name: "Electrical Technician",
    code: "TECH-EL",
    description: "Frontline electrical maintenance technician",
    level: "technician",
  });

  const seniorTechnicianRole = await storage.createJobRole({
    name: "Senior Electrical Technician",
    code: "SR-TECH-EL",
    description: "Senior technician with HV switching and leadership duties",
    level: "senior_technician",
  });

  // Both roles require basic safety + diagnosis; senior role additionally requires HV switching + leadership
  await storage.createRoleElement({ roleId: technicianRole.id, elementId: safety.id, required: true });
  await storage.createRoleElement({ roleId: technicianRole.id, elementId: diagnosis.id, required: true });

  await storage.createRoleElement({ roleId: seniorTechnicianRole.id, elementId: safety.id, required: true });
  await storage.createRoleElement({ roleId: seniorTechnicianRole.id, elementId: diagnosis.id, required: true });
  await storage.createRoleElement({ roleId: seniorTechnicianRole.id, elementId: hvSwitching.id, required: true });
  await storage.createRoleElement({ roleId: seniorTechnicianRole.id, elementId: leadership.id, required: true });

  const candidate = await storage.upsertUser({
    id: "demo-candidate-jsmith",
    email: "jane.smith@example.com",
    firstName: "Jane",
    lastName: "Smith",
    role: "candidate",
    location: "Manufacturing Site A",
  });
  await storage.updateUser(candidate.id, { jobRoleId: technicianRole.id });

  // Jane is competent in basic safety (current), and not-yet-competent in diagnosis (missing)
  await storage.createAssessment({
    candidateId: candidate.id,
    elementId: safety.id,
    assessorId: "local-dev-admin",
    outcome: "competent",
    assessmentDate: new Date(),
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
  });
  await storage.createAssessment({
    candidateId: candidate.id,
    elementId: diagnosis.id,
    assessorId: "local-dev-admin",
    outcome: "not_yet_competent",
    assessmentDate: new Date(),
  });

  console.log("[local-dev] Seeded demo job roles, competency elements, and candidate Jane Smith");
}
