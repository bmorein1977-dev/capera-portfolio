import { 
  type User, 
  type InsertUser,
  type UpsertUser,
  type CompetencyCategory,
  type InsertCompetencyCategory,
  type CompetencyElement,
  type InsertCompetencyElement,
  type CompetenceSubcategory,
  type InsertCompetenceSubcategory,
  type CompetenceCriteria,
  type InsertCompetenceCriteria,
  type BulkCompetenceCriteria,
  type Competency,
  type InsertCompetency,
  type JobRole,
  type InsertJobRole,
  type Location,
  type InsertLocation,
  type Team,
  type InsertTeam,
  type ContractCompany,
  type InsertContractCompany,
  type BusinessUnit,
  type InsertBusinessUnit,
  type JobFamily,
  type InsertJobFamily,
  type WorkforceInitiative,
  type InsertWorkforceInitiative,
  type InitiativeRoleRequirement,
  type InsertInitiativeRoleRequirement,
  type SuccessionPlan,
  type InsertSuccessionPlan,
  type SuccessionCandidate,
  type InsertSuccessionCandidate,
  type InductionProgram,
  type InsertInductionProgram,
  type InductionTask,
  type InsertInductionTask,
  type OnboardingAssignment,
  type InsertOnboardingAssignment,
  type OnboardingTaskCompletion,
  type InsertOnboardingTaskCompletion,
  type OnboardingChecklist,
  type TrainingContent,
  type InsertTrainingContent,
  type TrainingContentProgress,
  type InsertTrainingContentProgress,
  type TrainingContentWithProgress,
  type InsertTrainingCompletionAudit,
  type TrainingCompletionRecord,
  type CompetencyLevel,
  type InsertCompetencyLevel,
  type RoleElement,
  type InsertRoleElement,
  type RoleElementLevel,
  type InsertRoleElementLevel,
  type RoleTraining,
  type InsertRoleTraining,
  type TrainingRequirementGroup,
  type InsertTrainingRequirementGroup,
  type TrainingComplianceAnalysis,
  type CompetencyMatrix,
  type InsertCompetencyMatrix,
  type CompetencyCertification,
  type InsertCompetencyCertification,
  type ExpiryAlert,
  type InsertExpiryAlert,
  type CompetencyTreeNode,
  type CompetencyWithDetails,
  type TrainingCategory,
  type InsertTrainingCategory,
  type Training,
  type InsertTraining,
  type TrainingLevel,
  type InsertTrainingLevel,
  type TrainingCertificate,
  type InsertTrainingCertificate,
  type TrainingEnrollment,
  type InsertTrainingEnrollment,
  type CandidateAllocation,
  type InsertCandidateAllocation,
  type Assessment,
  type InsertAssessment,
  type AssessmentExpiryHistory,
  type InsertAssessmentExpiryHistory,
  type AssessmentEvidence,
  type InsertAssessmentEvidence,
  type VerifierAllocation,
  type InsertVerifierAllocation,
  type SamplingPlan,
  type InsertSamplingPlan,
  type Verification,
  type InsertVerification,
  type ExcelImportRow,
  type ExcelImportResult,
  type SkillsGapAnalysis,
  type ElementStatus,
  type RoleTransitionPlan,
  type TeamComplianceMatrix,
  type Element3KpiReport,
  type ComplianceBucket,
  type ComplianceRow,
  type ComplianceOverview,
  type ComplianceExplorerFilters,
  type ComplianceExplorerResult,
  type CompetenceDetailResult,
  type CompetenceDetailElement,
  type CompetenceDetailPerson,
  type CompetenceDetailCell,
  type OrgChartNode,
  type OrgChartPerson,
  type Absence,
  type InsertAbsence,
  type NotificationSetting,
  type InsertNotificationSetting,
  type NotificationLog,
  type InsertNotificationLog,
  type KpiTarget,
  type InsertKpiTarget,
  type UserLanguagePreference,
  type InsertUserLanguagePreference,
  type TrainingProvider,
  type InsertTrainingProvider,
  type TrainingVenue,
  type InsertTrainingVenue,
  type ExternalTrainingCourse,
  type InsertExternalTrainingCourse,
  type CourseTrainingSession,
  type InsertCourseTrainingSession,
  type TrainingPolicyMatrix,
  type InsertTrainingPolicyMatrix,
  type CourseBooking,
  type InsertCourseBooking,
  type BookingApproval,
  type InsertBookingApproval,
  type StandardLevel,
  type InsertStandardLevel,
  type StandardDraftSession,
  type InsertStandardDraftSession,
  type StandardDraftSubjectMatter,
  type InsertStandardDraftSubjectMatter,
  type StandardDraftQuestion,
  type InsertStandardDraftQuestion,
  type StandardDraftScenario,
  type InsertStandardDraftScenario,
  type AssessmentKnowledgeAnswer,
  type InsertAssessmentKnowledgeAnswer,
  type CompetencyElementTargetScore,
  type InsertCompetencyElementTargetScore,
  users,
  competencyCategories,
  competencyElements,
  competenceSubcategories,
  competenceCriteria,
  competencies,
  jobRoles,
  locations,
  teams,
  contractCompanies,
  businessUnits,
  jobFamilies,
  workforceInitiatives,
  initiativeRoleRequirements,
  successionPlans,
  successionCandidates,
  inductionPrograms,
  inductionTasks,
  onboardingAssignments,
  onboardingTaskCompletions,
  absences,
  kpiTargets,
  userLanguagePreferences,
  trainingContent,
  trainingContentProgress,
  trainingCompletionAudit,
  competencyLevels,
  roleElements,
  roleElementLevels,
  roleTrainings,
  trainingRequirementGroups,
  competencyMatrix,
  competencyCertifications,
  expiryAlerts,
  trainingCategories,
  trainings,
  trainingLevels,
  trainingCertificates,
  trainingEnrollments,
  candidateAllocations,
  assessments,
  assessmentExpiryHistory,
  assessmentEvidence,
  verifierAllocations,
  samplingPlans,
  verifications,
  notificationSettings,
  notificationLogs,
  trainingProviders,
  trainingVenues,
  externalTrainingCourses,
  courseTrainingSessions,
  trainingPolicyMatrix,
  courseBookings,
  bookingApprovals,
  standardLevels,
  standardDraftSessions,
  standardDraftSubjectMatters,
  standardDraftQuestions,
  standardDraftScenarios,
  assessmentKnowledgeAnswers,
  competencyElementTargetScores,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, or, asc, desc, isNull, sql, leftJoin, inArray, ilike, gte, lte } from "drizzle-orm";

// Utility function to compute assessment timeline dates
export function computeAssessmentTimeline(params: {
  assignmentDate?: Date | string | null;
  signOffAt?: Date | string | null;
  assessedAt?: Date | string | null;
  storedExpiryDate?: Date | string | null;
  validityYears?: number;
  validityMonths?: number;
}): {
  assessedAt: Date | null;
  dueDate: Date | null;
  expiryDate: Date | null;
} {
  const { assignmentDate, signOffAt, assessedAt: providedAssessedAt, storedExpiryDate, validityYears, validityMonths } = params;
  
  // If there's a stored expiry date (from imports), use it directly
  if (storedExpiryDate) {
    return {
      assessedAt: signOffAt ? new Date(signOffAt) : null,
      dueDate: new Date(storedExpiryDate),
      expiryDate: new Date(storedExpiryDate),
    };
  }
  
  // assessedAt: use provided value, or derive from signOffAt if available
  const assessedAt = providedAssessedAt 
    ? new Date(providedAssessedAt) 
    : signOffAt 
    ? new Date(signOffAt) 
    : null;
  
  // Calculate dueDate
  let dueDate: Date | null = null;
  if (assessedAt) {
    // Completed assessment: due date is validity period from assessed date
    dueDate = new Date(assessedAt);
    if (validityMonths) {
      // Use exact months if available
      dueDate.setMonth(dueDate.getMonth() + validityMonths);
    } else if (validityYears) {
      // Otherwise use years
      dueDate.setFullYear(dueDate.getFullYear() + validityYears);
    } else {
      // Default to 4 years
      dueDate.setFullYear(dueDate.getFullYear() + 4);
    }
  } else if (assignmentDate) {
    // Not completed: due date is 2 years from assignment (grace period)
    dueDate = new Date(assignmentDate);
    dueDate.setFullYear(dueDate.getFullYear() + 2);
  }
  
  // expiryDate is same as dueDate for completed assessments, null otherwise
  const expiryDate = assessedAt && dueDate ? new Date(dueDate) : null;
  
  return {
    assessedAt,
    dueDate,
    expiryDate,
  };
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations - Required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  // Additional user operations
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  // User ID reconciliation for test scenario compatibility
  reconcileUserId(oldId: string, newId: string, providerSub: string): Promise<void>;
  // Bulk user import for HR functionality
  createBulkUsers(users: InsertUser[]): Promise<{ success: User[], failed: { user: InsertUser, error: string }[] }>;

  // Competency Category operations
  getCompetencyCategories(): Promise<CompetencyCategory[]>;
  getCompetencyCategory(id: string): Promise<CompetencyCategory | undefined>;
  createCompetencyCategory(category: InsertCompetencyCategory): Promise<CompetencyCategory>;
  updateCompetencyCategory(id: string, category: Partial<InsertCompetencyCategory>): Promise<CompetencyCategory | undefined>;
  deleteCompetencyCategory(id: string): Promise<boolean>;

  // Competency Element operations
  getCompetencyElements(categoryId?: string): Promise<CompetencyElement[]>;
  getCompetencyElement(id: string): Promise<CompetencyElement | undefined>;
  createCompetencyElement(element: InsertCompetencyElement): Promise<CompetencyElement>;
  updateCompetencyElement(id: string, element: Partial<InsertCompetencyElement>): Promise<CompetencyElement | undefined>;
  deleteCompetencyElement(id: string): Promise<boolean>;
  autoFixUncategorizedElements(): Promise<{
    fixed: { id: string; name: string; categoryId: string; categoryName: string }[];
    stillUncategorized: { id: string; name: string }[];
  }>;

  // Competence Subcategory operations
  getCompetenceSubcategories(elementId?: string, type?: 'knowledge' | 'performance' | 'safety'): Promise<CompetenceSubcategory[]>;
  getCompetenceSubcategory(id: string): Promise<CompetenceSubcategory | undefined>;
  createCompetenceSubcategory(subcategory: InsertCompetenceSubcategory): Promise<CompetenceSubcategory>;
  updateCompetenceSubcategory(id: string, subcategory: Partial<InsertCompetenceSubcategory>): Promise<CompetenceSubcategory | undefined>;
  deleteCompetenceSubcategory(id: string): Promise<boolean>;

  // Competence Criteria operations (K1.1, P1.1, etc.)
  getCompetenceCriteria(filters?: { subcategoryId?: string; elementId?: string; type?: 'knowledge' | 'performance' | 'safety'; levelId?: string | null }): Promise<CompetenceCriteria[]>;
  getCompetenceCriteriaWithSubcategories(filters: { elementId: string; type?: 'knowledge' | 'performance' | 'safety'; levelId?: string | null }): Promise<Array<CompetenceCriteria & { subcategoryName?: string }>>;
  getCompetenceCriterion(id: string): Promise<CompetenceCriteria | undefined>;
  createCompetenceCriteria(criteria: InsertCompetenceCriteria): Promise<CompetenceCriteria>;
  createBulkCompetenceCriteria(bulkData: BulkCompetenceCriteria): Promise<CompetenceCriteria[]>;
  // For document imports only: preserves the exact code/numbering from the source document
  // instead of auto-generating sequential numbers (createCompetenceCriteria/createBulkCompetenceCriteria
  // renumber sequentially, which would lose intentional gaps like "S 1.3" -> "S 1.5" in the source).
  upsertImportedCompetenceCriteria(criteria: InsertCompetenceCriteria & { code: string; subcategoryNumber: number; criteriaNumber: number }): Promise<CompetenceCriteria>;
  updateCompetenceCriteria(id: string, criteria: Partial<InsertCompetenceCriteria>): Promise<CompetenceCriteria | undefined>;
  deleteCompetenceCriteria(id: string): Promise<boolean>;
  generateCompetenceCriteriaCode(elementId: string, type: 'knowledge' | 'performance' | 'safety', subcategoryId?: string): Promise<string>;

  // Word/Excel import operations
  importClientStandards(file: Buffer, elementId: string): Promise<{ success: boolean; imported: number; errors: string[] }>;

  // Competency operations
  getCompetencies(filters?: { elementId?: string; type?: string; critical?: boolean; safetyCritical?: boolean }): Promise<Competency[]>;
  getCompetency(id: string): Promise<Competency | undefined>;
  createCompetency(competency: InsertCompetency): Promise<Competency>;
  updateCompetency(id: string, competency: Partial<InsertCompetency>): Promise<Competency | undefined>;
  deleteCompetency(id: string): Promise<boolean>;

  // Job Role operations
  getJobRoles(): Promise<JobRole[]>;
  getJobRole(id: string): Promise<JobRole | undefined>;
  createJobRole(jobRole: InsertJobRole): Promise<JobRole>;
  updateJobRole(id: string, jobRole: Partial<InsertJobRole>): Promise<JobRole | undefined>;
  deleteJobRole(id: string): Promise<boolean>;
  duplicateJobRole(sourceRoleId: string, name: string, code: string): Promise<{ role: JobRole; elementsCopied: number; trainingsCopied: number }>;

  // Organisational structure - Locations, Business Units, Job Families
  getLocations(): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<boolean>;
  getTeams(locationId?: string): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<boolean>;
  getContractCompanies(): Promise<ContractCompany[]>;
  getContractCompany(id: string): Promise<ContractCompany | undefined>;
  createContractCompany(company: InsertContractCompany): Promise<ContractCompany>;
  updateContractCompany(id: string, company: Partial<InsertContractCompany>): Promise<ContractCompany | undefined>;
  deleteContractCompany(id: string): Promise<boolean>;
  getBusinessUnits(): Promise<BusinessUnit[]>;
  getBusinessUnit(id: string): Promise<BusinessUnit | undefined>;
  createBusinessUnit(businessUnit: InsertBusinessUnit): Promise<BusinessUnit>;
  updateBusinessUnit(id: string, businessUnit: Partial<InsertBusinessUnit>): Promise<BusinessUnit | undefined>;
  deleteBusinessUnit(id: string): Promise<boolean>;
  getJobFamilies(): Promise<JobFamily[]>;
  getJobFamily(id: string): Promise<JobFamily | undefined>;
  createJobFamily(jobFamily: InsertJobFamily): Promise<JobFamily>;
  updateJobFamily(id: string, jobFamily: Partial<InsertJobFamily>): Promise<JobFamily | undefined>;
  deleteJobFamily(id: string): Promise<boolean>;
  backfillOrganisationStructure(): Promise<{ locationsCreated: number; businessUnitsCreated: number; usersLinked: number; jobRolesLinked: number }>;

  // Strategic Workforce Planning - future headcount demand and succession coverage
  getWorkforceInitiatives(): Promise<WorkforceInitiative[]>;
  getWorkforceInitiative(id: string): Promise<WorkforceInitiative | undefined>;
  createWorkforceInitiative(initiative: InsertWorkforceInitiative): Promise<WorkforceInitiative>;
  updateWorkforceInitiative(id: string, initiative: Partial<InsertWorkforceInitiative>): Promise<WorkforceInitiative | undefined>;
  deleteWorkforceInitiative(id: string): Promise<boolean>;
  getInitiativeRoleRequirements(initiativeId: string): Promise<InitiativeRoleRequirement[]>;
  createInitiativeRoleRequirement(requirement: InsertInitiativeRoleRequirement): Promise<InitiativeRoleRequirement>;
  updateInitiativeRoleRequirement(id: string, requirement: Partial<InsertInitiativeRoleRequirement>): Promise<InitiativeRoleRequirement | undefined>;
  deleteInitiativeRoleRequirement(id: string): Promise<boolean>;
  getSuccessionPlans(): Promise<SuccessionPlan[]>;
  getSuccessionPlan(id: string): Promise<SuccessionPlan | undefined>;
  createSuccessionPlan(plan: InsertSuccessionPlan): Promise<SuccessionPlan>;
  updateSuccessionPlan(id: string, plan: Partial<InsertSuccessionPlan>): Promise<SuccessionPlan | undefined>;
  deleteSuccessionPlan(id: string): Promise<boolean>;
  getSuccessionCandidates(successionPlanId: string): Promise<SuccessionCandidate[]>;
  createSuccessionCandidate(candidate: InsertSuccessionCandidate): Promise<SuccessionCandidate>;
  updateSuccessionCandidate(id: string, candidate: Partial<InsertSuccessionCandidate>): Promise<SuccessionCandidate | undefined>;
  deleteSuccessionCandidate(id: string): Promise<boolean>;

  // Onboarding & Induction - checklist templates and per-person assignments
  getInductionPrograms(): Promise<InductionProgram[]>;
  getInductionProgram(id: string): Promise<InductionProgram | undefined>;
  createInductionProgram(program: InsertInductionProgram): Promise<InductionProgram>;
  updateInductionProgram(id: string, program: Partial<InsertInductionProgram>): Promise<InductionProgram | undefined>;
  deleteInductionProgram(id: string): Promise<boolean>;
  getInductionTasks(programId: string): Promise<InductionTask[]>;
  createInductionTask(task: InsertInductionTask): Promise<InductionTask>;
  updateInductionTask(id: string, task: Partial<InsertInductionTask>): Promise<InductionTask | undefined>;
  deleteInductionTask(id: string): Promise<boolean>;
  getOnboardingAssignments(userId?: string): Promise<OnboardingAssignment[]>;
  getOnboardingAssignment(id: string): Promise<OnboardingAssignment | undefined>;
  createOnboardingAssignment(assignment: InsertOnboardingAssignment): Promise<OnboardingAssignment>;
  updateOnboardingAssignment(id: string, assignment: Partial<InsertOnboardingAssignment>): Promise<OnboardingAssignment | undefined>;
  deleteOnboardingAssignment(id: string): Promise<boolean>;
  getOnboardingChecklist(assignmentId: string): Promise<OnboardingChecklist | null>;
  setOnboardingTaskCompletion(assignmentId: string, taskId: string, completedBy: string | null, notes: string | null): Promise<OnboardingTaskCompletion>;
  clearOnboardingTaskCompletion(assignmentId: string, taskId: string): Promise<boolean>;

  // Absences (long-term sick, holiday, other leave)
  getAbsences(userId?: string): Promise<Absence[]>;
  getAbsence(id: string): Promise<Absence | undefined>;
  createAbsence(absence: InsertAbsence): Promise<Absence>;
  updateAbsence(id: string, absence: Partial<InsertAbsence>): Promise<Absence | undefined>;
  deleteAbsence(id: string): Promise<boolean>;
  getActiveAbsencesForUsers(userIds: string[]): Promise<Map<string, Absence>>;

  // Admin-configurable KPI targets (competence compliance targets shown on the Executive Dashboard)
  getKpiTargets(): Promise<KpiTarget[]>;
  upsertKpiTarget(key: string, target: { label: string; targetPercentage: number; updatedBy?: string }): Promise<KpiTarget>;

  // Learning content (e-learning videos/documents/links hosted against a training) and progress
  getTrainingContent(trainingId: string): Promise<TrainingContent[]>;
  getTrainingContentItem(id: string): Promise<TrainingContent | undefined>;
  createTrainingContent(content: InsertTrainingContent): Promise<TrainingContent>;
  updateTrainingContent(id: string, content: Partial<InsertTrainingContent>): Promise<TrainingContent | undefined>;
  deleteTrainingContent(id: string): Promise<boolean>;
  getTrainingContentWithProgress(trainingId: string, userId: string): Promise<TrainingContentWithProgress[]>;
  setTrainingContentProgress(contentId: string, userId: string, update: Partial<InsertTrainingContentProgress>): Promise<TrainingContentProgress>;

  // Training completion audit trail - append-only record of who completed what, when, and how
  recordTrainingCompletion(entry: InsertTrainingCompletionAudit): Promise<void>;
  getTrainingCompletionRecords(filters: { trainingId?: string; userId?: string; from?: Date; to?: Date }): Promise<TrainingCompletionRecord[]>;
  repairTrainingCompletionRollups(): Promise<{ pairsChecked: number }>;

  // Standard levels (job-seniority reference list for the SME new-standard wizard)
  getStandardLevels(): Promise<StandardLevel[]>;
  createStandardLevel(level: InsertStandardLevel): Promise<StandardLevel>;
  updateStandardLevel(id: string, level: Partial<InsertStandardLevel>): Promise<StandardLevel | undefined>;
  deleteStandardLevel(id: string): Promise<boolean>;

  // SME new-standard authoring wizard
  getStandardDraftSessions(createdBy?: string): Promise<StandardDraftSession[]>;
  getStandardDraftSession(id: string): Promise<StandardDraftSession | undefined>;
  createStandardDraftSession(session: InsertStandardDraftSession): Promise<StandardDraftSession>;
  updateStandardDraftSession(id: string, session: Partial<InsertStandardDraftSession>): Promise<StandardDraftSession | undefined>;
  deleteStandardDraftSession(id: string): Promise<boolean>;

  getStandardDraftSubjectMatters(draftSessionId: string): Promise<StandardDraftSubjectMatter[]>;
  getStandardDraftSubjectMatter(id: string): Promise<StandardDraftSubjectMatter | undefined>;
  createStandardDraftSubjectMatter(subjectMatter: InsertStandardDraftSubjectMatter): Promise<StandardDraftSubjectMatter>;
  updateStandardDraftSubjectMatter(id: string, subjectMatter: Partial<InsertStandardDraftSubjectMatter>): Promise<StandardDraftSubjectMatter | undefined>;
  deleteStandardDraftSubjectMatter(id: string): Promise<boolean>;

  getStandardDraftQuestions(subjectMatterId: string): Promise<StandardDraftQuestion[]>;
  createStandardDraftQuestions(questions: InsertStandardDraftQuestion[]): Promise<StandardDraftQuestion[]>;
  updateStandardDraftQuestion(id: string, question: Partial<InsertStandardDraftQuestion>): Promise<StandardDraftQuestion | undefined>;
  deleteStandardDraftQuestion(id: string): Promise<boolean>;

  getStandardDraftScenarios(subjectMatterId: string): Promise<StandardDraftScenario[]>;
  createStandardDraftScenarios(scenarios: InsertStandardDraftScenario[]): Promise<StandardDraftScenario[]>;
  updateStandardDraftScenario(id: string, scenario: Partial<InsertStandardDraftScenario>): Promise<StandardDraftScenario | undefined>;
  deleteStandardDraftScenario(id: string): Promise<boolean>;
  publishStandardDraft(draftSessionId: string, categoryId: string): Promise<CompetencyElement>;
  syncPublishedStandardDraft(draftSessionId: string): Promise<{ created: number; updated: number }>;

  // Role Elements operations (competence elements assigned to job roles)
  getRoleElementsWithDetails(roleId: string): Promise<Array<RoleElement & { element: CompetencyElement }>>;

  // Role Trainings operations (training courses assigned to job roles)
  getRoleTrainings(roleId: string): Promise<RoleTraining[]>;
  getRoleTrainingsWithDetails(roleId: string): Promise<Array<RoleTraining & { training: Training }>>;
  getRoleTrainingsByTrainingId(trainingId: string): Promise<RoleTraining[]>;
  createRoleTraining(roleTraining: InsertRoleTraining): Promise<RoleTraining>;
  updateRoleTraining(id: string, roleTraining: Partial<InsertRoleTraining>): Promise<RoleTraining | undefined>;
  deleteRoleTraining(id: string): Promise<boolean>;

  // Archives trainings/categories wrongly created from the training matrix's COMPETENCE
  // ELEMENTS section (a layout the general course importer misread as regular courses before
  // it learned to parse that section separately) - see trainingMatrixImport.ts for detail.
  cleanupCompetenceElementImportArtifacts(): Promise<{ categoriesArchived: number; trainingsArchived: number; roleTrainingsArchived: number }>;

  // One-time repair for pending assessments whose assessorId doesn't match the candidate's
  // real assigned assessor(s) in candidateAllocations.
  repairMisassignedAssessorAssignments(): Promise<{ assessmentsRepaired: number }>;

  // Training Requirement Groups (1-of-N alternative training requirements)
  getTrainingRequirementGroups(roleId: string): Promise<TrainingRequirementGroup[]>;
  createTrainingRequirementGroup(group: InsertTrainingRequirementGroup): Promise<TrainingRequirementGroup>;
  updateTrainingRequirementGroup(id: string, group: Partial<InsertTrainingRequirementGroup>): Promise<TrainingRequirementGroup | undefined>;
  deleteTrainingRequirementGroup(id: string): Promise<boolean>;

  // Training compliance - parallel to getSkillsGapAnalysis but for a person's required trainings
  getTrainingComplianceStatus(userId: string): Promise<TrainingComplianceAnalysis | null>;

  // Auto-assignment operations
  assignJobRoleToUser(userId: string, roleId: string, allocatedBy?: string): Promise<{ assessmentsCreated: number; trainingsEnrolled: number }>;
  syncRoleRequirementsToUsers(roleId: string, allocatedBy?: string): Promise<{ usersSynced: number; assessmentsCreated: number; trainingsEnrolled: number }>;
  addCompetenceElementToUser(userId: string, elementId: string, assessorId?: string, levelId?: string): Promise<Assessment>;
  addTrainingToUser(userId: string, trainingId: string, allocatedBy?: string): Promise<{ enrollment: TrainingEnrollment; isNew: boolean }>;

  // Bulk assignment operations
  bulkAssignJobRole(userIds: string[], roleId: string, allocatedBy: string): Promise<{ successful: number; failed: Array<{ userId: string; error: string }>; totalAssessmentsCreated: number }>;
  bulkAssignCompetenceElement(userIds: string[], elementId: string, assessorId: string, levelId?: string): Promise<{ successful: number; failed: Array<{ userId: string; error: string }>; totalAssessmentsCreated: number }>;
  bulkAssignTraining(userIds: string[], trainingId: string, allocatedBy: string): Promise<{ successful: number; skipped: number; failed: Array<{ userId: string; error: string }>; totalEnrollmentsCreated: number }>;

  // Competency Matrix operations
  getCompetencyMatrix(jobRoleId?: string, competencyId?: string): Promise<CompetencyMatrix[]>;
  createCompetencyMatrix(matrix: InsertCompetencyMatrix): Promise<CompetencyMatrix>;
  updateCompetencyMatrix(id: string, matrix: Partial<InsertCompetencyMatrix>): Promise<CompetencyMatrix | undefined>;
  deleteCompetencyMatrix(id: string): Promise<boolean>;

  // Competency Certification operations
  getCompetencyCertifications(userId?: string, competencyId?: string): Promise<CompetencyCertification[]>;
  getCompetencyCertification(id: string): Promise<CompetencyCertification | undefined>;
  createCompetencyCertification(certification: InsertCompetencyCertification): Promise<CompetencyCertification>;
  updateCompetencyCertification(id: string, certification: Partial<InsertCompetencyCertification>): Promise<CompetencyCertification | undefined>;
  deleteCompetencyCertification(id: string): Promise<boolean>;
  getExpiringCertifications(days?: number): Promise<CompetencyCertification[]>;

  // Expiry Alert operations  
  getExpiryAlerts(userId?: string): Promise<ExpiryAlert[]>;
  createExpiryAlert(alert: InsertExpiryAlert): Promise<ExpiryAlert>;
  markAlertAsRead(id: string): Promise<boolean>;
  deleteExpiryAlert(id: string): Promise<boolean>;
  generateExpiryAlerts(): Promise<ExpiryAlert[]>;

  // Training Category operations
  getTrainingCategories(): Promise<TrainingCategory[]>;
  getTrainingCategory(id: string): Promise<TrainingCategory | undefined>;
  createTrainingCategory(category: InsertTrainingCategory): Promise<TrainingCategory>;
  updateTrainingCategory(id: string, category: Partial<InsertTrainingCategory>): Promise<TrainingCategory | undefined>;
  deleteTrainingCategory(id: string): Promise<boolean>;

  // Training operations
  getTrainings(categoryId?: string): Promise<Training[]>;
  getTraining(id: string): Promise<Training | undefined>;
  createTraining(training: InsertTraining): Promise<Training>;
  updateTraining(id: string, training: Partial<InsertTraining>): Promise<Training | undefined>;
  deleteTraining(id: string): Promise<boolean>;

  // Training Level operations
  getTrainingLevels(trainingId?: string): Promise<TrainingLevel[]>;
  getTrainingLevel(id: string): Promise<TrainingLevel | undefined>;
  createTrainingLevel(level: InsertTrainingLevel): Promise<TrainingLevel>;
  updateTrainingLevel(id: string, level: Partial<InsertTrainingLevel>): Promise<TrainingLevel | undefined>;
  deleteTrainingLevel(id: string): Promise<boolean>;

  // Training Certificate operations
  getTrainingCertificates(userId?: string, trainingId?: string): Promise<TrainingCertificate[]>;
  getTrainingCertificate(id: string): Promise<TrainingCertificate | undefined>;
  createTrainingCertificate(certificate: InsertTrainingCertificate): Promise<TrainingCertificate>;
  updateTrainingCertificate(id: string, certificate: Partial<InsertTrainingCertificate>): Promise<TrainingCertificate | undefined>;
  deleteTrainingCertificate(id: string): Promise<boolean>;
  getExpiringTrainingCertificates(days?: number): Promise<TrainingCertificate[]>;
  
  // Training Records with expiry tracking
  getTrainingRecordsWithStatus(userId?: string): Promise<Array<TrainingCertificate & { trainingName: string; status: 'green' | 'amber' | 'red' | 'unknown' }>>;
  updateTrainingCertificateDates(id: string, achievementDate?: Date, expiryDate?: Date): Promise<TrainingCertificate | undefined>;

  // Special operations
  getCompetencyTree(): Promise<CompetencyTreeNode[]>;
  getCompetenciesWithDetails(filters?: { categoryId?: string; elementId?: string; jobRoleId?: string }): Promise<CompetencyWithDetails[]>;

  // Excel Import operations  
  importCompetenceStandards(rows: ExcelImportRow[]): Promise<ExcelImportResult>;

  // Language Preferences operations
  getUserLanguagePreference(userId: string): Promise<UserLanguagePreference | undefined>;
  createOrUpdateUserLanguagePreference(userId: string, preferences: {
    primaryLanguage: string;
    fallbackLanguage: string;
    autoTranslate: boolean;
  }): Promise<UserLanguagePreference>;

  // Competency Levels operations
  getCompetencyLevels(elementId?: string): Promise<CompetencyLevel[]>;
  getCompetencyLevel(id: string): Promise<CompetencyLevel | undefined>;
  createCompetencyLevel(level: InsertCompetencyLevel): Promise<CompetencyLevel>;
  updateCompetencyLevel(id: string, level: Partial<InsertCompetencyLevel>): Promise<CompetencyLevel | undefined>;
  deleteCompetencyLevel(id: string): Promise<boolean>;
  
  // Role Elements operations (element-level job role assignments)
  getRoleElements(roleId?: string, elementId?: string): Promise<RoleElement[]>;
  getRoleElement(id: string): Promise<RoleElement | undefined>;
  createRoleElement(roleElement: InsertRoleElement): Promise<RoleElement>;
  updateRoleElement(id: string, roleElement: Partial<InsertRoleElement>): Promise<RoleElement | undefined>;
  deleteRoleElement(id: string): Promise<boolean>;
  
  // Role Element Levels operations (level-specific job role assignments)
  getRoleElementLevels(roleId?: string, elementId?: string): Promise<(RoleElementLevel & { element: CompetencyElement; level: CompetencyLevel })[]>;
  getRoleElementLevel(id: string): Promise<RoleElementLevel | undefined>;
  createRoleElementLevel(roleElementLevel: InsertRoleElementLevel): Promise<RoleElementLevel>;
  updateRoleElementLevel(id: string, roleElementLevel: Partial<InsertRoleElementLevel>): Promise<RoleElementLevel | undefined>;
  deleteRoleElementLevel(id: string): Promise<boolean>;
  bulkCreateRoleElementLevels(roleElementLevels: InsertRoleElementLevel[]): Promise<RoleElementLevel[]>;
  getRoleMatrix(roleId: string): Promise<{ role: JobRole; elements: Array<{ elementId: string; elementName: string; required: boolean; requirementLevel: string | null; activityType: string | null; validityYears: number | null; safetyCritical: boolean | null }> }>;

  // Training Enrollment operations
  getTrainingEnrollments(userId?: string, trainingId?: string): Promise<TrainingEnrollment[]>;
  getTrainingEnrollmentsWithDetails(userId: string): Promise<Array<TrainingEnrollment & { training: Training }>>;
  getTrainingEnrollment(id: string): Promise<TrainingEnrollment | undefined>;
  createTrainingEnrollment(enrollment: InsertTrainingEnrollment): Promise<TrainingEnrollment>;
  updateTrainingEnrollment(id: string, enrollment: Partial<InsertTrainingEnrollment>): Promise<TrainingEnrollment | undefined>;
  deleteTrainingEnrollment(id: string): Promise<boolean>;

  // Candidate Allocation operations
  getCandidateAllocations(assessorId?: string, candidateId?: string): Promise<CandidateAllocation[]>;
  getCandidateAllocation(id: string): Promise<CandidateAllocation | undefined>;
  createCandidateAllocation(allocation: InsertCandidateAllocation): Promise<CandidateAllocation>;
  updateCandidateAllocation(id: string, allocation: Partial<InsertCandidateAllocation>): Promise<CandidateAllocation | undefined>;
  deleteCandidateAllocation(id: string): Promise<boolean>;
  getAssessorCandidates(assessorId: string): Promise<User[]>;

  // Assessment operations
  getAssessments(candidateId?: string, assessorId?: string, elementId?: string): Promise<Assessment[]>;
  getAssessment(id: string): Promise<Assessment | undefined>;
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  updateAssessment(id: string, assessment: Partial<InsertAssessment>): Promise<Assessment | undefined>;
  updateAssessmentSignOff(id: string, signOffData: {
    outcome: string;
    knowledgeOutcomes?: string;
    performanceOutcomes?: string;
    overallComment?: string;
    assessmentMethods?: string[];
    signOffAssessorId: string;
    assessorScore?: number | null;
  }): Promise<Assessment | undefined>;
  deleteAssessment(id: string): Promise<boolean>;
  getAssessmentsWithExpiry(assessorId?: string, candidateId?: string): Promise<Array<Assessment & {
    candidateName: string;
    elementName: string;
    status: 'green' | 'amber' | 'red' | 'not_assessed';
    daysUntilExpiry?: number;
  }>>;

  // Self-assessment operations
  getUserStandardLevel(userId: string): Promise<StandardLevel | undefined>;
  getCompetencyElementTargetScores(elementId: string): Promise<CompetencyElementTargetScore[]>;
  setCompetencyElementTargetScores(elementId: string, scores: { standardLevelId: string; targetScore: number }[]): Promise<CompetencyElementTargetScore[]>;
  getAssessmentKnowledgeAnswers(assessmentId: string): Promise<AssessmentKnowledgeAnswer[]>;
  submitKnowledgeSelfAssessment(assessmentId: string, answers: { criteriaId: string; selectedAnswerIndex?: number; answerText?: string }[]): Promise<{ scorePercent: number | null; answers: AssessmentKnowledgeAnswer[] }>;
  setAssessmentSelfScore(assessmentId: string, selfScore: number): Promise<Assessment | undefined>;

  // Assessment Evidence operations
  getAssessmentEvidence(assessmentId?: string): Promise<AssessmentEvidence[]>;
  getAssessmentEvidenceItem(id: string): Promise<AssessmentEvidence | undefined>;
  createAssessmentEvidence(evidence: InsertAssessmentEvidence): Promise<AssessmentEvidence>;
  updateAssessmentEvidence(id: string, evidence: Partial<InsertAssessmentEvidence>): Promise<AssessmentEvidence | undefined>;
  deleteAssessmentEvidence(id: string): Promise<boolean>;

  // Verifier Allocation operations
  getVerifierAllocations(verifierId?: string, assessorId?: string): Promise<VerifierAllocation[]>;
  getVerifierAllocation(id: string): Promise<VerifierAllocation | undefined>;
  createVerifierAllocation(allocation: InsertVerifierAllocation): Promise<VerifierAllocation>;
  updateVerifierAllocation(id: string, allocation: Partial<InsertVerifierAllocation>): Promise<VerifierAllocation | undefined>;
  deleteVerifierAllocation(id: string): Promise<boolean>;
  getVerifierAssessors(verifierId: string): Promise<User[]>;

  // Sampling Plan operations
  getSamplingPlans(verifierId?: string, assessorId?: string): Promise<SamplingPlan[]>;
  getSamplingPlan(id: string): Promise<SamplingPlan | undefined>;
  createSamplingPlan(plan: InsertSamplingPlan): Promise<SamplingPlan>;
  updateSamplingPlan(id: string, plan: Partial<InsertSamplingPlan>): Promise<SamplingPlan | undefined>;
  deleteSamplingPlan(id: string): Promise<boolean>;

  // Verification operations
  getVerifications(assessmentId?: string, verifierId?: string): Promise<Verification[]>;
  getVerification(id: string): Promise<Verification | undefined>;
  createVerification(verification: InsertVerification): Promise<Verification>;
  updateVerification(id: string, verification: Partial<InsertVerification>): Promise<Verification | undefined>;
  deleteVerification(id: string): Promise<boolean>;
  getUnverifiedAssessments(verifierId: string): Promise<Array<Assessment & { candidateName: string; elementName: string; assessorName: string }>>;
  getVerificationStatistics(verifierId: string, assessorId?: string): Promise<{
    totalAssessments: number;
    verifiedCount: number;
    verificationPercentage: number;
    targetPercentage: number;
  }>;
  getVerificationsForAssessor(assessorId: string, filters?: { dateFrom?: Date; dateTo?: Date; candidateId?: string }): Promise<Array<Verification & {
    candidateId: string;
    candidateName: string;
    candidateLocation: string | null;
    elementName: string;
    verifierName: string;
  }>>;
  getVerifierDashboardSummary(verifierId: string): Promise<{
    assessors: Array<{ id: string; name: string; email: string; targetPercentage: number; totalAssessments: number; verifiedCount: number; verificationPercentage: number; recentActivityCount: number }>;
    assessorQueue: Array<{
      assessorId: string; assessorName: string; assessorEmail: string;
      targetPercentage: number; quotaMet: boolean; remainingNeeded: number; verifiedThisQuarter: number;
      candidates: Array<{
        candidateId: string; candidateName: string; priorVerificationCount: number;
        assessments: Array<{ id: string; elementId: string; elementName: string; assessmentDate: string | Date | null; outcome: string }>;
      }>;
    }>;
    verifiedThisMonth: number;
  }>;
  getElement3KpiReport(): Promise<Element3KpiReport>;
  getComplianceOverview(): Promise<ComplianceOverview>;
  getComplianceExplorer(filters: ComplianceExplorerFilters): Promise<ComplianceExplorerResult>;
  getCompetenceDetail(filters: ComplianceExplorerFilters): Promise<CompetenceDetailResult>;
  getOrgChartNode(userId: string): Promise<OrgChartNode | null>;

  // Historical Data Import operations
  processHistoricalImport(importData: Array<{
    userName: string;
    email?: string;
    userRole: string;
    location?: string;
    teamShift?: string;
    jobRoleName?: string;
    dateOfBirth?: Date;
    companyNumber?: string;
    competenceCategoryName?: string;
    competenceElementName?: string;
    assessmentOutcome?: string;
    assessorName?: string;
    assessmentDate?: Date;
    validityYears?: number;
    expiryDate?: Date;
    trainingName?: string;
    trainingCompletionDate?: Date;
    trainingExpiryDate?: Date;
  }>, importedBy: string): Promise<{
    success: number;
    errors: Array<{ row: number; error: string }>;
    usersCreated: number;
    usersUpdated: number;
    assessmentsCreated: number;
    assessmentsUpdated: number;
    trainingCompletionsCreated: number;
    trainingCompletionsUpdated: number;
  }>;
  getCompetencyCategoryByName(name: string): Promise<CompetencyCategory | undefined>;
  getCompetencyElementByName(categoryId: string, name: string): Promise<CompetencyElement | undefined>;
  getJobRoleByName(name: string): Promise<JobRole | undefined>;
  getTrainingByName(name: string): Promise<Training | undefined>;
  
  // Skills Gap Analysis
  getSkillsGapAnalysis(userId: string): Promise<SkillsGapAnalysis | null>;

  // Role Transition Planning
  getRoleTransitionPlan(userId: string, targetRoleId: string): Promise<RoleTransitionPlan | null>;

  // Team Compliance Matrix
  getDistinctLocations(): Promise<string[]>;
  getTeamComplianceMatrix(roleId: string, location: string): Promise<TeamComplianceMatrix | null>;

  // Bulk Assignment Operations
  bulkAssignJobRole(userIds: string[], roleId: string, allocatedBy: string): Promise<{
    successful: number;
    failed: Array<{ userId: string; error: string }>;
    totalAssessmentsCreated: number;
  }>;
  bulkAssignCompetenceElement(userIds: string[], elementId: string, assessorId: string): Promise<{
    successful: number;
    failed: Array<{ userId: string; error: string }>;
    totalAssessmentsCreated: number;
  }>;
  
  // Notification Settings operations
  getNotificationSettings(): Promise<NotificationSetting[]>;
  getNotificationSetting(id: string): Promise<NotificationSetting | undefined>;
  createNotificationSetting(setting: InsertNotificationSetting): Promise<NotificationSetting>;
  updateNotificationSetting(id: string, setting: Partial<InsertNotificationSetting>): Promise<NotificationSetting | undefined>;
  deleteNotificationSetting(id: string): Promise<boolean>;
  
  // Notification Logs operations
  getNotificationLogs(filters?: { recipientId?: string; status?: string; settingId?: string }): Promise<NotificationLog[]>;
  getNotificationLog(id: string): Promise<NotificationLog | undefined>;
  createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog>;
  
  // Training Management & Booking operations
  // Providers
  getTrainingProviders(): Promise<TrainingProvider[]>;
  getTrainingProvider(id: string): Promise<TrainingProvider | undefined>;
  createTrainingProvider(provider: InsertTrainingProvider): Promise<TrainingProvider>;
  updateTrainingProvider(id: string, provider: Partial<InsertTrainingProvider>): Promise<TrainingProvider | undefined>;
  deleteTrainingProvider(id: string): Promise<boolean>;
  
  // Venues
  getTrainingVenues(): Promise<TrainingVenue[]>;
  getTrainingVenue(id: string): Promise<TrainingVenue | undefined>;
  createTrainingVenue(venue: InsertTrainingVenue): Promise<TrainingVenue>;
  updateTrainingVenue(id: string, venue: Partial<InsertTrainingVenue>): Promise<TrainingVenue | undefined>;
  deleteTrainingVenue(id: string): Promise<boolean>;
  
  // External Training Courses
  getExternalTrainingCourses(filters?: { query?: string; tag?: string; modality?: string; providerId?: string }): Promise<ExternalTrainingCourse[]>;
  getExternalTrainingCourse(id: string): Promise<ExternalTrainingCourse | undefined>;
  createExternalTrainingCourse(course: InsertExternalTrainingCourse): Promise<ExternalTrainingCourse>;
  updateExternalTrainingCourse(id: string, course: Partial<InsertExternalTrainingCourse>): Promise<ExternalTrainingCourse | undefined>;
  deleteExternalTrainingCourse(id: string): Promise<boolean>;
  
  // Course Training Sessions
  getCourseTrainingSessions(filters?: { courseId?: string; upcoming?: boolean }): Promise<Array<CourseTrainingSession & { venueName?: string; city?: string; country?: string }>>;
  getCourseTrainingSession(id: string): Promise<CourseTrainingSession | undefined>;
  createCourseTrainingSession(session: InsertCourseTrainingSession): Promise<CourseTrainingSession>;
  updateCourseTrainingSession(id: string, session: Partial<InsertCourseTrainingSession>): Promise<CourseTrainingSession | undefined>;
  deleteCourseTrainingSession(id: string): Promise<boolean>;
  
  // Course Bookings
  getCourseBookings(filters?: { userId?: string; sessionId?: string; status?: string }): Promise<Array<CourseBooking & { sessionInfo?: any; courseInfo?: any }>>;
  getCourseBooking(id: string): Promise<CourseBooking | undefined>;
  createCourseBooking(booking: InsertCourseBooking): Promise<CourseBooking>;
  updateCourseBooking(id: string, booking: Partial<InsertCourseBooking>): Promise<CourseBooking | undefined>;
  cancelCourseBooking(id: string): Promise<boolean>;
  
  // Training Policy Matrix
  getTrainingPolicyMatrixByRole(roleId: string): Promise<TrainingPolicyMatrix[]>;
  getTrainingPolicyMatrix(id: string): Promise<TrainingPolicyMatrix | undefined>;
  createTrainingPolicyMatrix(policy: InsertTrainingPolicyMatrix): Promise<TrainingPolicyMatrix>;
  updateTrainingPolicyMatrix(id: string, policy: Partial<InsertTrainingPolicyMatrix>): Promise<TrainingPolicyMatrix | undefined>;
  deleteTrainingPolicyMatrix(id: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  // Utility method for role normalization
  normalizeRole(role: string): string {
    const roleMap: Record<string, string> = {
      'developer': 'developer',
      'super admin': 'super_admin',
      'super_admin': 'super_admin',
      'superadmin': 'super_admin',
      'admin': 'admin',
      'administrator': 'admin',
      'internal verifier': 'internal_verifier',
      'internal_verifier': 'internal_verifier',
      'verifier': 'internal_verifier',
      'assessor': 'assessor',
      'candidate': 'candidate',
      'trainee': 'trainee',
    };
    
    return roleMap[role.toLowerCase()] || 'candidate';
  }

  // Competency Category operations
  async getCompetencyCategories(): Promise<CompetencyCategory[]> {
    return await db.select().from(competencyCategories).where(eq(competencyCategories.isActive, true));
  }

  async getCompetencyCategory(id: string): Promise<CompetencyCategory | undefined> {
    const result = await db.select().from(competencyCategories).where(eq(competencyCategories.id, id));
    return result[0];
  }

  async createCompetencyCategory(category: InsertCompetencyCategory): Promise<CompetencyCategory> {
    const result = await db.insert(competencyCategories).values(category).returning();
    return result[0];
  }

  async updateCompetencyCategory(id: string, category: Partial<InsertCompetencyCategory>): Promise<CompetencyCategory | undefined> {
    const result = await db.update(competencyCategories).set(category).where(eq(competencyCategories.id, id)).returning();
    return result[0];
  }

  async deleteCompetencyCategory(id: string): Promise<boolean> {
    const result = await db.update(competencyCategories).set({ isActive: false }).where(eq(competencyCategories.id, id));
    return result.rowCount > 0;
  }

  // Competency Element operations
  async getCompetencyElements(categoryId?: string): Promise<CompetencyElement[]> {
    if (categoryId) {
      return await db.select().from(competencyElements).where(
        and(
          eq(competencyElements.categoryId, categoryId), 
          eq(competencyElements.isActive, true),
          eq(competencyElements.isCurrent, true)
        )
      );
    }
    return await db.select().from(competencyElements).where(
      and(
        eq(competencyElements.isActive, true),
        eq(competencyElements.isCurrent, true)
      )
    );
  }

  async getCompetencyElement(id: string): Promise<CompetencyElement | undefined> {
    const result = await db.select().from(competencyElements).where(eq(competencyElements.id, id));
    return result[0];
  }

  async createCompetencyElement(element: InsertCompetencyElement): Promise<CompetencyElement> {
    const result = await db.insert(competencyElements).values(element).returning();
    return result[0];
  }

  async updateCompetencyElement(id: string, element: Partial<InsertCompetencyElement>): Promise<CompetencyElement | undefined> {
    const result = await db.update(competencyElements).set(element).where(eq(competencyElements.id, id)).returning();
    return result[0];
  }

  async deleteCompetencyElement(id: string): Promise<boolean> {
    const result = await db.update(competencyElements).set({ isActive: false }).where(eq(competencyElements.id, id));
    return result.rowCount > 0;
  }

  // One-time bulk cleanup for elements orphaned by the categoryId-wiping tree-edit bug (fixed in
  // 19ff02a) - not something that should recur, but existing damage still needs fixing without
  // manual one-by-one triage. Many elements were named "<Category> - <rest>" (matching how the SME
  // wizard titles standards), so that's used as the repair signal: if an orphaned element's name
  // starts with exactly one existing category's name followed by a separator, auto-assign it.
  // Ambiguous (matches 0 or 2+ categories) or non-matching names are left alone and reported back
  // for manual review via the existing Category field, rather than guessing wrong.
  async autoFixUncategorizedElements(): Promise<{
    fixed: { id: string; name: string; categoryId: string; categoryName: string }[];
    stillUncategorized: { id: string; name: string }[];
  }> {
    const allElements = await db.select().from(competencyElements).where(eq(competencyElements.isActive, true));
    const allCategories = await db.select().from(competencyCategories).where(eq(competencyCategories.isActive, true));
    const categoryIds = new Set(allCategories.map(c => c.id));

    const orphaned = allElements.filter(e => !e.categoryId || !categoryIds.has(e.categoryId));

    const fixed: { id: string; name: string; categoryId: string; categoryName: string }[] = [];
    const stillUncategorized: { id: string; name: string }[] = [];

    for (const element of orphaned) {
      const matches = allCategories.filter(c =>
        element.name.startsWith(`${c.name} - `) || element.name.startsWith(`${c.name}-`)
      );
      if (matches.length === 1) {
        await db.update(competencyElements).set({ categoryId: matches[0].id, updatedAt: new Date() }).where(eq(competencyElements.id, element.id));
        fixed.push({ id: element.id, name: element.name, categoryId: matches[0].id, categoryName: matches[0].name });
      } else {
        stillUncategorized.push({ id: element.id, name: element.name });
      }
    }

    return { fixed, stillUncategorized };
  }

  // Competence Subcategory operations
  async getCompetenceSubcategories(elementId?: string, type?: 'knowledge' | 'performance' | 'safety'): Promise<CompetenceSubcategory[]> {
    const conditions = [eq(competenceSubcategories.isActive, true)];
    
    if (elementId) {
      conditions.push(eq(competenceSubcategories.elementId, elementId));
    }
    
    if (type) {
      conditions.push(eq(competenceSubcategories.type, type));
    }
    
    return await db.select().from(competenceSubcategories).where(and(...conditions));
  }

  async getCompetenceSubcategory(id: string): Promise<CompetenceSubcategory | undefined> {
    const result = await db.select().from(competenceSubcategories).where(eq(competenceSubcategories.id, id));
    return result[0];
  }

  async createCompetenceSubcategory(subcategory: InsertCompetenceSubcategory): Promise<CompetenceSubcategory> {
    const result = await db.insert(competenceSubcategories).values(subcategory).returning();
    return result[0];
  }

  async updateCompetenceSubcategory(id: string, subcategory: Partial<InsertCompetenceSubcategory>): Promise<CompetenceSubcategory | undefined> {
    const result = await db.update(competenceSubcategories).set(subcategory).where(eq(competenceSubcategories.id, id)).returning();
    return result[0];
  }

  async deleteCompetenceSubcategory(id: string): Promise<boolean> {
    const result = await db.update(competenceSubcategories).set({ isActive: false }).where(eq(competenceSubcategories.id, id));
    return result.rowCount > 0;
  }

  // Competence Criteria operations (K1.1, P1.1, etc.)
  async getCompetenceCriteria(filters?: { subcategoryId?: string; elementId?: string; type?: 'knowledge' | 'performance' | 'safety'; levelId?: string | null }): Promise<CompetenceCriteria[]> {
    const conditions: any[] = [eq(competenceCriteria.isActive, true)];
    
    if (filters?.subcategoryId) {
      conditions.push(eq(competenceCriteria.subcategoryId, filters.subcategoryId));
    }
    if (filters?.elementId) {
      conditions.push(eq(competenceCriteria.elementId, filters.elementId));
    }
    if (filters?.type) {
      conditions.push(eq(competenceCriteria.type, filters.type));
    }
    if (filters?.levelId !== undefined) {
      // Filter by levelId - supports both specific level ID and null (for non-level criteria)
      if (filters.levelId === null) {
        conditions.push(isNull(competenceCriteria.levelId));
      } else {
        conditions.push(eq(competenceCriteria.levelId, filters.levelId));
      }
    }
    
    return await db.select().from(competenceCriteria).where(and(...conditions));
  }

  async getCompetenceCriteriaWithSubcategories(filters: { elementId: string; type?: 'knowledge' | 'performance' | 'safety'; levelId?: string | null }): Promise<Array<CompetenceCriteria & { subcategoryName?: string }>> {
    const conditions: any[] = [
      eq(competenceCriteria.isActive, true),
      eq(competenceCriteria.elementId, filters.elementId)
    ];
    
    if (filters.type) {
      conditions.push(eq(competenceCriteria.type, filters.type));
    }
    if (filters.levelId !== undefined) {
      if (filters.levelId === null) {
        conditions.push(isNull(competenceCriteria.levelId));
      } else {
        conditions.push(eq(competenceCriteria.levelId, filters.levelId));
      }
    }
    
    // Join with subcategories to get subcategory name
    const results = await db.select({
      criteria: competenceCriteria,
      subcategory: competenceSubcategories
    })
    .from(competenceCriteria)
    .leftJoin(competenceSubcategories, eq(competenceCriteria.subcategoryId, competenceSubcategories.id))
    .where(and(...conditions))
    .orderBy(competenceCriteria.subcategoryNumber, competenceCriteria.criteriaNumber);
    
    return results.map(r => ({
      ...r.criteria,
      subcategoryName: r.subcategory?.name
    }));
  }

  async getCompetenceCriterion(id: string): Promise<CompetenceCriteria | undefined> {
    const result = await db.select().from(competenceCriteria).where(eq(competenceCriteria.id, id));
    return result[0];
  }

  async createCompetenceCriteria(criteria: InsertCompetenceCriteria): Promise<CompetenceCriteria> {
    const codePrefix = criteria.type === 'knowledge' ? 'K' : criteria.type === 'safety' ? 'S' : 'P';
    return db.transaction(async (tx) => {
      let code: string;
      let guidanceNumber: string | null = null;
      let criteriaNumber: number;
      let subcategoryNumber: number | null = null;
      let levelDisplayOrder: number | null = null;

      // Check if criteria is associated with a proficiency level
      if (criteria.levelId) {
        const level = await tx.select().from(competencyLevels).where(eq(competencyLevels.id, criteria.levelId)).limit(1);
        if (level.length > 0) {
          levelDisplayOrder = level[0].order;
        }
      }

      if (criteria.subcategoryId) {
        // Subcategory-level criteria (K 1.1, P 1.1 format with space)
        // When level exists: Filter by level to get criteria count within that level
        const existingCriteria = await tx.select().from(competenceCriteria).where(
          criteria.levelId
            ? and(
                eq(competenceCriteria.subcategoryId, criteria.subcategoryId),
                eq(competenceCriteria.type, criteria.type),
                eq(competenceCriteria.levelId, criteria.levelId),
                eq(competenceCriteria.isActive, true)
              )
            : and(
                eq(competenceCriteria.subcategoryId, criteria.subcategoryId),
                eq(competenceCriteria.type, criteria.type),
                eq(competenceCriteria.isActive, true)
              )
        );
        
        const subcategory = await this.getCompetenceSubcategory(criteria.subcategoryId);
        if (!subcategory) throw new Error('Subcategory not found');
        
        // CRITICAL: Calculate subcategory number based on position among subcategories OF THE SAME TYPE
        const allSubcategoriesOfType = await tx.select().from(competenceSubcategories).where(
          and(
            eq(competenceSubcategories.elementId, subcategory.elementId),
            eq(competenceSubcategories.type, criteria.type),
            eq(competenceSubcategories.isActive, true)
          )
        ).orderBy(competenceSubcategories.order);
        
        subcategoryNumber = allSubcategoriesOfType.findIndex(s => s.id === criteria.subcategoryId) + 1;
        if (subcategoryNumber <= 0) throw new Error('Could not determine subcategory number');
        
        criteriaNumber = existingCriteria.length + 1;
        
        // V2: Add space between prefix and number
        // When level exists, use format: K {level}.{number} or P {level}.{number}
        if (levelDisplayOrder !== null) {
          code = `${codePrefix} ${levelDisplayOrder}.${criteriaNumber}`;
          if (criteria.assessorGuidance && criteria.assessorGuidance.trim()) {
            guidanceNumber = `${codePrefix}G ${levelDisplayOrder}.${criteriaNumber}`;
          }
        } else {
          code = `${codePrefix} ${subcategoryNumber}.${criteriaNumber}`;
          if (criteria.assessorGuidance && criteria.assessorGuidance.trim()) {
            guidanceNumber = `${codePrefix}G ${subcategoryNumber}.${criteriaNumber}`;
          }
        }
      } else {
        // Element-level criteria (K 1, P 1 format with space)
        // When level exists: Filter by level to get criteria count within that level
        const existingCriteria = await tx.select().from(competenceCriteria).where(
          criteria.levelId
            ? and(
                eq(competenceCriteria.elementId, criteria.elementId),
                eq(competenceCriteria.type, criteria.type),
                eq(competenceCriteria.levelId, criteria.levelId),
                isNull(competenceCriteria.subcategoryId),
                eq(competenceCriteria.isActive, true)
              )
            : and(
                eq(competenceCriteria.elementId, criteria.elementId),
                eq(competenceCriteria.type, criteria.type),
                isNull(competenceCriteria.subcategoryId),
                eq(competenceCriteria.isActive, true)
              )
        );
        
        criteriaNumber = existingCriteria.length + 1;
        
        // V2: Add space between prefix and number
        // When level exists, use format: K {level}.{number} or P {level}.{number}
        if (levelDisplayOrder !== null) {
          code = `${codePrefix} ${levelDisplayOrder}.${criteriaNumber}`;
          if (criteria.assessorGuidance && criteria.assessorGuidance.trim()) {
            guidanceNumber = `${codePrefix}G ${levelDisplayOrder}.${criteriaNumber}`;
          }
        } else {
          code = `${codePrefix} ${criteriaNumber}`;
          if (criteria.assessorGuidance && criteria.assessorGuidance.trim()) {
            guidanceNumber = `${codePrefix}G ${criteriaNumber}`;
          }
        }
      }

      // Create the complete insert payload with generated fields
      const insertPayload: typeof competenceCriteria.$inferInsert = {
        ...criteria,
        code,
        criteriaNumber,
        subcategoryNumber,
        guidanceNumber,
        description: criteria.criteriaText || '', // V2: Set description for backward compatibility
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log(`Creating criteria with code: ${code}, guidanceNumber: ${guidanceNumber || 'none'}, criteriaNumber: ${criteriaNumber}, subcategoryNumber: ${subcategoryNumber}`);

      const result = await tx.insert(competenceCriteria).values(insertPayload).returning();
      return result[0];
    });
  }

  async upsertImportedCompetenceCriteria(criteria: InsertCompetenceCriteria & { code: string; subcategoryNumber: number; criteriaNumber: number }): Promise<CompetenceCriteria> {
    const existing = await db.select().from(competenceCriteria).where(
      and(
        eq(competenceCriteria.elementId, criteria.elementId),
        eq(competenceCriteria.code, criteria.code),
        eq(competenceCriteria.isActive, true)
      )
    );

    if (existing.length > 0) {
      const result = await db.update(competenceCriteria)
        .set({
          criteriaText: criteria.criteriaText,
          description: criteria.criteriaText,
          subcategoryId: criteria.subcategoryId,
          required: criteria.required,
          updatedAt: new Date(),
        })
        .where(eq(competenceCriteria.id, existing[0].id))
        .returning();
      return result[0];
    }

    const insertPayload: typeof competenceCriteria.$inferInsert = {
      ...criteria,
      description: criteria.criteriaText || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.insert(competenceCriteria).values(insertPayload).returning();
    return result[0];
  }

  async createBulkCompetenceCriteria(bulkData: BulkCompetenceCriteria): Promise<CompetenceCriteria[]> {
    const codePrefix = bulkData.type === 'knowledge' ? 'K' : bulkData.type === 'safety' ? 'S' : 'P';
    return db.transaction(async (tx) => {
      const createdCriteria: CompetenceCriteria[] = [];
      
      // Check if criteria is associated with a proficiency level
      let levelDisplayOrder: number | null = null;
      if (bulkData.levelId) {
        const level = await tx.select().from(competencyLevels).where(eq(competencyLevels.id, bulkData.levelId)).limit(1);
        if (level.length > 0) {
          levelDisplayOrder = level[0].order;
        }
      }
      
      // Get the current highest criteria number for this context
      // When level exists: Filter by level to get criteria count within that level
      const existingCriteria = await tx.select().from(competenceCriteria).where(
        bulkData.subcategoryId 
          ? (bulkData.levelId
              ? and(
                  eq(competenceCriteria.subcategoryId, bulkData.subcategoryId),
                  eq(competenceCriteria.type, bulkData.type),
                  eq(competenceCriteria.levelId, bulkData.levelId),
                  eq(competenceCriteria.isActive, true)
                )
              : and(
                  eq(competenceCriteria.subcategoryId, bulkData.subcategoryId),
                  eq(competenceCriteria.type, bulkData.type),
                  eq(competenceCriteria.isActive, true)
                ))
          : (bulkData.levelId
              ? and(
                  eq(competenceCriteria.elementId, bulkData.elementId),
                  eq(competenceCriteria.type, bulkData.type),
                  eq(competenceCriteria.levelId, bulkData.levelId),
                  isNull(competenceCriteria.subcategoryId),
                  eq(competenceCriteria.isActive, true)
                )
              : and(
                  eq(competenceCriteria.elementId, bulkData.elementId),
                  eq(competenceCriteria.type, bulkData.type),
                  isNull(competenceCriteria.subcategoryId),
                  eq(competenceCriteria.isActive, true)
                ))
      );
      
      let subcategoryNumber: number | null = null;
      
      // If using a subcategory, calculate its number
      if (bulkData.subcategoryId) {
        const subcategory = await this.getCompetenceSubcategory(bulkData.subcategoryId);
        if (!subcategory) throw new Error('Subcategory not found');
        
        const allSubcategoriesOfType = await tx.select().from(competenceSubcategories).where(
          and(
            eq(competenceSubcategories.elementId, subcategory.elementId),
            eq(competenceSubcategories.type, bulkData.type),
            eq(competenceSubcategories.isActive, true)
          )
        ).orderBy(competenceSubcategories.order);
        
        subcategoryNumber = allSubcategoriesOfType.findIndex(s => s.id === bulkData.subcategoryId) + 1;
        if (subcategoryNumber <= 0) throw new Error('Could not determine subcategory number');
      }
      
      // Find the max existing criteria number to handle gaps from deletions
      let maxCriteriaNumber = 0;
      for (const existing of existingCriteria) {
        if (existing.criteriaNumber && existing.criteriaNumber > maxCriteriaNumber) {
          maxCriteriaNumber = existing.criteriaNumber;
        }
      }
      
      // Start from max + 1 to avoid code collisions
      let criteriaNumber = maxCriteriaNumber + 1;
      
      for (const criterionData of bulkData.criteria) {
        let code: string;
        let guidanceNumber: string | null = null;
        
        // When level exists, use format: K {level}.{number} or P {level}.{number}
        if (levelDisplayOrder !== null) {
          code = `${codePrefix} ${levelDisplayOrder}.${criteriaNumber}`;
          if (criterionData.assessorGuidance && criterionData.assessorGuidance.trim()) {
            guidanceNumber = `${codePrefix}G ${levelDisplayOrder}.${criteriaNumber}`;
          }
        } else if (bulkData.subcategoryId && subcategoryNumber) {
          // Subcategory-level criteria (K 1.1, P 1.1 format with space)
          code = `${codePrefix} ${subcategoryNumber}.${criteriaNumber}`;
          
          // Generate guidance number if guidance text is provided
          if (criterionData.assessorGuidance && criterionData.assessorGuidance.trim()) {
            guidanceNumber = `${codePrefix}G ${subcategoryNumber}.${criteriaNumber}`;
          }
        } else {
          // Element-level criteria (K 1, P 1 format with space)
          code = `${codePrefix} ${criteriaNumber}`;
          
          // Generate guidance number if guidance text is provided
          if (criterionData.assessorGuidance && criterionData.assessorGuidance.trim()) {
            guidanceNumber = `${codePrefix}G ${criteriaNumber}`;
          }
        }
        
        // Create the complete insert payload
        const insertPayload: typeof competenceCriteria.$inferInsert = {
          elementId: bulkData.elementId,
          subcategoryId: bulkData.subcategoryId,
          levelId: bulkData.levelId,
          type: bulkData.type,
          criteriaText: criterionData.criteriaText,
          description: criterionData.criteriaText, // Backward compatibility
          assessorGuidance: criterionData.assessorGuidance || null,
          assessmentMethods: bulkData.assessmentMethods,
          required: bulkData.required,
          code,
          criteriaNumber,
          subcategoryNumber,
          guidanceNumber,
          fmtBold: criterionData.fmtBold || false,
          fmtItalic: criterionData.fmtItalic || false,
          guidanceFmtBold: criterionData.guidanceFmtBold || false,
          guidanceFmtItalic: criterionData.guidanceFmtItalic || false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const result = await tx.insert(competenceCriteria).values(insertPayload).returning();
        createdCriteria.push(result[0]);
        
        // Increment for next criterion
        criteriaNumber++;
      }
      
      return createdCriteria;
    });
  }

  async updateCompetenceCriteria(id: string, criteria: Partial<InsertCompetenceCriteria>): Promise<CompetenceCriteria | undefined> {
    // V2: Auto-update guidance number if guidance text changes
    const updatePayload: any = { ...criteria, updatedAt: new Date() };
    
    // V2: Sync description field with criteriaText for backward compatibility
    if ('criteriaText' in criteria) {
      updatePayload.description = criteria.criteriaText || '';
    }
    
    if ('assessorGuidance' in criteria) {
      // Fetch existing criteria to get code and type
      const existing = await this.getCompetenceCriterion(id);
      if (existing) {
        // If guidance is being added/updated and has content, ensure guidance number exists
        if (criteria.assessorGuidance && criteria.assessorGuidance.trim()) {
          // Extract the number part from the code (e.g., "K 1.1" -> "1.1")
          const codeMatch = existing.code.match(/[KP]\s+(.+)/);
          const numberPart = codeMatch ? codeMatch[1] : '';
          updatePayload.guidanceNumber = `${existing.type === 'knowledge' ? 'KG' : 'PG'} ${numberPart}`;
        } else {
          // If guidance is being removed, clear guidance number
          updatePayload.guidanceNumber = null;
        }
      }
    }
    
    const result = await db.update(competenceCriteria).set(updatePayload).where(eq(competenceCriteria.id, id)).returning();
    return result[0];
  }

  async deleteCompetenceCriteria(id: string): Promise<boolean> {
    const result = await db.update(competenceCriteria).set({ isActive: false }).where(eq(competenceCriteria.id, id));
    return result.rowCount > 0;
  }

  async generateCompetenceCriteriaCode(elementId: string, type: 'knowledge' | 'performance' | 'safety', subcategoryId?: string): Promise<string> {
    const codePrefix = type === 'knowledge' ? 'K' : type === 'safety' ? 'S' : 'P';
    if (subcategoryId) {
      // Subcategory-level criteria (K 1.1, P 1.1 format with space)
      const existingCriteria = await db.select().from(competenceCriteria).where(
        and(
          eq(competenceCriteria.subcategoryId, subcategoryId),
          eq(competenceCriteria.type, type),  // CRITICAL: Filter by type for independent K/P numbering
          eq(competenceCriteria.isActive, true)
        )
      );
      
      const subcategory = await this.getCompetenceSubcategory(subcategoryId);
      if (!subcategory) throw new Error('Subcategory not found');
      
      const nextNumber = existingCriteria.length + 1;
      // V2: Add space between prefix and number
      return `${codePrefix} ${subcategory.order}.${nextNumber}`;
    } else {
      // Element-level criteria (K 1, P 1 format with space)
      const existingCriteria = await db.select().from(competenceCriteria).where(
        and(
          eq(competenceCriteria.elementId, elementId),
          eq(competenceCriteria.type, type),
          isNull(competenceCriteria.subcategoryId),
          eq(competenceCriteria.isActive, true)
        )
      );
      
      const nextNumber = existingCriteria.length + 1;
      // V2: Add space between prefix and number
      return `${codePrefix} ${nextNumber}`;
    }
  }

  // Competency Tree operation
  async getCompetencyTree(): Promise<CompetencyTreeNode[]> {
    const categories = await this.getCompetencyCategories();
    const elements = await this.getCompetencyElements();
    
    return categories.map(category => ({
      id: category.id,
      name: category.name,
      type: 'category' as const,
      order: category.order,
      children: elements
        .filter(element => element.categoryId === category.id)
        .map(element => ({
          id: element.id,
          name: element.name,
          type: 'element' as const,
          order: element.order,
          children: []
        }))
        .sort((a, b) => a.order - b.order)
    }))
    .sort((a, b) => a.order - b.order);
  }

  // Stub implementations for other methods - implement as needed
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    try {
      // Check for existing user by ID first, then by email
      let existingUser = await this.getUser(user.id);
      
      if (!existingUser && user.email) {
        // If no user found by ID, check by email to handle email conflicts
        existingUser = await this.getUserByEmail(user.email);
      }
      
      if (existingUser) {
        // Update existing user (could be found by ID or email)
        const updateData: any = {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          role: user.role || existingUser.role, // Use provided role or keep existing
          updatedAt: new Date()
        };
        
        // Add optional candidate-specific fields if provided
        if (user.location !== undefined) updateData.location = user.location;
        if (user.teamShift !== undefined) updateData.teamShift = user.teamShift;
        if (user.jobRoleId !== undefined) updateData.jobRoleId = user.jobRoleId;
        if (user.dateOfBirth !== undefined) updateData.dateOfBirth = user.dateOfBirth;
        if (user.companyNumber !== undefined) updateData.companyNumber = user.companyNumber;
        if (user.secondaryJobRoleId !== undefined) updateData.secondaryJobRoleId = user.secondaryJobRoleId;
        if (user.employmentType !== undefined) updateData.employmentType = user.employmentType;
        if (user.contractCompanyId !== undefined) updateData.contractCompanyId = user.contractCompanyId;

        const result = await db.update(users).set(updateData).where(eq(users.id, existingUser.id)).returning();
        return result[0];
      } else {
        // Create new user
        const insertData: any = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          role: user.role || 'candidate', // Use provided role or default to candidate
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Add optional candidate-specific fields if provided
        if (user.location !== undefined) insertData.location = user.location;
        if (user.teamShift !== undefined) insertData.teamShift = user.teamShift;
        if (user.jobRoleId !== undefined) insertData.jobRoleId = user.jobRoleId;
        if (user.dateOfBirth !== undefined) insertData.dateOfBirth = user.dateOfBirth;
        if (user.companyNumber !== undefined) insertData.companyNumber = user.companyNumber;
        if (user.secondaryJobRoleId !== undefined) insertData.secondaryJobRoleId = user.secondaryJobRoleId;
        if (user.employmentType !== undefined) insertData.employmentType = user.employmentType;
        if (user.contractCompanyId !== undefined) insertData.contractCompanyId = user.contractCompanyId;

        const result = await db.insert(users).values(insertData).returning();
        return result[0];
      }
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === '23505' && error.constraint?.includes('email')) {
        // Email unique constraint violated - try to find and update the existing user
        console.warn(`[UPSERT] Email constraint violation for ${user.email}, attempting recovery`);
        const existingUser = await this.getUserByEmail(user.email!);
        
        if (existingUser) {
          // Update the existing user with new data
          const updateData: any = {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            role: user.role || existingUser.role,
            updatedAt: new Date()
          };
          
          if (user.location !== undefined) updateData.location = user.location;
          if (user.teamShift !== undefined) updateData.teamShift = user.teamShift;
          if (user.jobRoleId !== undefined) updateData.jobRoleId = user.jobRoleId;
          if (user.dateOfBirth !== undefined) updateData.dateOfBirth = user.dateOfBirth;
          if (user.companyNumber !== undefined) updateData.companyNumber = user.companyNumber;
          if (user.secondaryJobRoleId !== undefined) updateData.secondaryJobRoleId = user.secondaryJobRoleId;
          if (user.employmentType !== undefined) updateData.employmentType = user.employmentType;
          if (user.contractCompanyId !== undefined) updateData.contractCompanyId = user.contractCompanyId;

          const result = await db.update(users).set(updateData).where(eq(users.id, existingUser.id)).returning();
          return result[0];
        }
      }
      
      // Re-throw if we can't handle it
      console.error('[UPSERT] Error upserting user:', error);
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true));
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return result[0];
  }

  async reconcileUserId(oldId: string, newId: string, providerSub: string): Promise<void> {
    console.log(`[RECONCILIATION] Starting ID reconciliation: ${oldId} → ${newId}`);
    
    // Get the existing user data
    const existingUser = await this.getUser(oldId);
    if (!existingUser) {
      console.log(`[RECONCILIATION] Old user ${oldId} not found, skipping reconciliation`);
      return;
    }

    // Update all foreign key references first, then update the user
    
    // 1. Update candidate_allocations (both assessorId and candidateId)
    await db.update(candidateAllocations)
      .set({ assessorId: newId })
      .where(eq(candidateAllocations.assessorId, oldId));
    
    await db.update(candidateAllocations)
      .set({ candidateId: newId })
      .where(eq(candidateAllocations.candidateId, oldId));
    
    // 2. Update assessments (candidateId, assessorId)
    await db.update(assessments)
      .set({ candidateId: newId })
      .where(eq(assessments.candidateId, oldId));
    
    await db.update(assessments)
      .set({ assessorId: newId })
      .where(eq(assessments.assessorId, oldId));
    
    // 3. Update assessment_evidence (uploadedBy)
    await db.update(assessmentEvidence)
      .set({ uploadedBy: newId })
      .where(eq(assessmentEvidence.uploadedBy, oldId));
    
    // 4. Update verifier_allocations (verifierId only - no candidateId in this table)
    await db.update(verifierAllocations)
      .set({ verifierId: newId })
      .where(eq(verifierAllocations.verifierId, oldId));
    
    // 5. Update training_enrollments (userId, allocatedBy)
    await db.update(trainingEnrollments)
      .set({ userId: newId })
      .where(eq(trainingEnrollments.userId, oldId));
    
    await db.update(trainingEnrollments)
      .set({ allocatedBy: newId })
      .where(eq(trainingEnrollments.allocatedBy, oldId));
    
    // 6. Update competence_certifications (userId)
    await db.update(competencyCertifications)
      .set({ userId: newId })
      .where(eq(competencyCertifications.userId, oldId));
    
    // 7. Update course_bookings (userId, approver - note: approver handling removed as it's not in schema)
    await db.update(courseBookings)
      .set({ userId: newId })
      .where(eq(courseBookings.userId, oldId));
    
    // 8. Update booking_approvals (approverId, not approvedBy)
    await db.update(bookingApprovals)
      .set({ approverId: newId })
      .where(eq(bookingApprovals.approverId, oldId));
    
    // 9. Update notification_logs (recipientId, not userId)
    await db.update(notificationLogs)
      .set({ recipientId: newId })
      .where(eq(notificationLogs.recipientId, oldId));
    
    // 10. Finally, update the user record itself with new ID and providerSub
    // First, soft-delete the old user record to release the email constraint
    await db.update(users)
      .set({ isActive: false, email: null, updatedAt: new Date() })
      .where(eq(users.id, oldId));
    
    // Then, insert or update the new user record with providerSub
    await db.insert(users).values({
      id: newId,
      email: existingUser.email,
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      profileImageUrl: existingUser.profileImageUrl,
      providerSub: providerSub,
      role: existingUser.role,
      department: existingUser.department,
      location: existingUser.location,
      teamShift: existingUser.teamShift,
      jobRoleId: existingUser.jobRoleId,
      dateOfBirth: existingUser.dateOfBirth,
      companyNumber: existingUser.companyNumber,
      isActive: existingUser.isActive,
      isArchived: existingUser.isArchived,
      createdAt: existingUser.createdAt,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        providerSub: providerSub,
        updatedAt: new Date()
      }
    });
    
    console.log(`[RECONCILIATION] Successfully reconciled user ${oldId} → ${newId}`);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.update(users).set({ isActive: false }).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async bulkDeleteUsers(userIds: string[]): Promise<{ deleted: number; failed: number; errors: Array<{ userId: string; error: string }> }> {
    const results = {
      deleted: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; error: string }>
    };

    for (const userId of userIds) {
      try {
        const success = await this.deleteUser(userId);
        if (success) {
          results.deleted++;
        } else {
          results.failed++;
          results.errors.push({ userId, error: 'User not found or already deleted' });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ userId, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return results;
  }

  async createBulkUsers(users: InsertUser[]): Promise<{ success: User[], failed: { user: InsertUser, error: string }[] }> {
    throw new Error("Method not implemented");
  }

  async importClientStandards(file: Buffer, elementId: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    throw new Error("Method not implemented");
  }

  async getCompetencies(filters?: { elementId?: string; type?: string; critical?: boolean; safetyCritical?: boolean }): Promise<Competency[]> {
    // Legacy method - return empty array as we're using CompetenceCriteria system instead
    return [];
  }

  async getCompetency(id: string): Promise<Competency | undefined> {
    // Legacy method - return undefined as we're using CompetenceCriteria system instead
    return undefined;
  }

  async createCompetency(competency: InsertCompetency): Promise<Competency> {
    throw new Error("Legacy method not supported - use CompetenceCriteria APIs instead");
  }

  async updateCompetency(id: string, competency: Partial<InsertCompetency>): Promise<Competency | undefined> {
    throw new Error("Legacy method not supported - use CompetenceCriteria APIs instead");
  }

  async deleteCompetency(id: string): Promise<boolean> {
    throw new Error("Legacy method not supported - use CompetenceCriteria APIs instead");
  }

  async getJobRoles(): Promise<JobRole[]> {
    return await db.select().from(jobRoles).where(eq(jobRoles.isActive, true));
  }

  async getJobRole(id: string): Promise<JobRole | undefined> {
    const result = await db.select().from(jobRoles).where(eq(jobRoles.id, id));
    return result[0];
  }

  async createJobRole(jobRole: InsertJobRole): Promise<JobRole> {
    const result = await db.insert(jobRoles).values(jobRole).returning();
    return result[0];
  }

  async updateJobRole(id: string, jobRole: Partial<InsertJobRole>): Promise<JobRole | undefined> {
    const result = await db.update(jobRoles).set(jobRole).where(eq(jobRoles.id, id)).returning();
    return result[0];
  }

  async deleteJobRole(id: string): Promise<boolean> {
    const result = await db.update(jobRoles).set({ isActive: false }).where(eq(jobRoles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Organisational structure - Locations
  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).where(eq(locations.isActive, true)).orderBy(asc(locations.name));
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const result = await db.select().from(locations).where(eq(locations.id, id));
    return result[0];
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const result = await db.insert(locations).values(location).returning();
    return result[0];
  }

  async updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined> {
    const result = await db.update(locations).set({ ...location, updatedAt: new Date() }).where(eq(locations.id, id)).returning();
    return result[0];
  }

  async deleteLocation(id: string): Promise<boolean> {
    const result = await db.update(locations).set({ isActive: false }).where(eq(locations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Organisational structure - Teams/Shifts
  async getTeams(locationId?: string): Promise<Team[]> {
    const conditions = [eq(teams.isActive, true)];
    if (locationId) conditions.push(eq(teams.locationId, locationId));
    return await db.select().from(teams).where(and(...conditions)).orderBy(asc(teams.name));
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const result = await db.select().from(teams).where(eq(teams.id, id));
    return result[0];
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const result = await db.insert(teams).values(team).returning();
    return result[0];
  }

  async updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team | undefined> {
    const result = await db.update(teams).set({ ...team, updatedAt: new Date() }).where(eq(teams.id, id)).returning();
    return result[0];
  }

  async deleteTeam(id: string): Promise<boolean> {
    const result = await db.update(teams).set({ isActive: false }).where(eq(teams.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Organisational structure - Contract Companies
  async getContractCompanies(): Promise<ContractCompany[]> {
    return await db.select().from(contractCompanies).where(eq(contractCompanies.isActive, true)).orderBy(asc(contractCompanies.name));
  }

  async getContractCompany(id: string): Promise<ContractCompany | undefined> {
    const result = await db.select().from(contractCompanies).where(eq(contractCompanies.id, id));
    return result[0];
  }

  async createContractCompany(company: InsertContractCompany): Promise<ContractCompany> {
    const result = await db.insert(contractCompanies).values(company).returning();
    return result[0];
  }

  async updateContractCompany(id: string, company: Partial<InsertContractCompany>): Promise<ContractCompany | undefined> {
    const result = await db.update(contractCompanies).set({ ...company, updatedAt: new Date() }).where(eq(contractCompanies.id, id)).returning();
    return result[0];
  }

  async deleteContractCompany(id: string): Promise<boolean> {
    const result = await db.update(contractCompanies).set({ isActive: false }).where(eq(contractCompanies.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Organisational structure - Business Units
  async getBusinessUnits(): Promise<BusinessUnit[]> {
    return await db.select().from(businessUnits).where(eq(businessUnits.isActive, true)).orderBy(asc(businessUnits.name));
  }

  async getBusinessUnit(id: string): Promise<BusinessUnit | undefined> {
    const result = await db.select().from(businessUnits).where(eq(businessUnits.id, id));
    return result[0];
  }

  async createBusinessUnit(businessUnit: InsertBusinessUnit): Promise<BusinessUnit> {
    const result = await db.insert(businessUnits).values(businessUnit).returning();
    return result[0];
  }

  async updateBusinessUnit(id: string, businessUnit: Partial<InsertBusinessUnit>): Promise<BusinessUnit | undefined> {
    const result = await db.update(businessUnits).set({ ...businessUnit, updatedAt: new Date() }).where(eq(businessUnits.id, id)).returning();
    return result[0];
  }

  async deleteBusinessUnit(id: string): Promise<boolean> {
    const result = await db.update(businessUnits).set({ isActive: false }).where(eq(businessUnits.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Organisational structure - Job Families
  async getJobFamilies(): Promise<JobFamily[]> {
    return await db.select().from(jobFamilies).where(eq(jobFamilies.isActive, true)).orderBy(asc(jobFamilies.name));
  }

  async getJobFamily(id: string): Promise<JobFamily | undefined> {
    const result = await db.select().from(jobFamilies).where(eq(jobFamilies.id, id));
    return result[0];
  }

  async createJobFamily(jobFamily: InsertJobFamily): Promise<JobFamily> {
    const result = await db.insert(jobFamilies).values(jobFamily).returning();
    return result[0];
  }

  async updateJobFamily(id: string, jobFamily: Partial<InsertJobFamily>): Promise<JobFamily | undefined> {
    const result = await db.update(jobFamilies).set({ ...jobFamily, updatedAt: new Date() }).where(eq(jobFamilies.id, id)).returning();
    return result[0];
  }

  async deleteJobFamily(id: string): Promise<boolean> {
    const result = await db.update(jobFamilies).set({ isActive: false }).where(eq(jobFamilies.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Strategic Workforce Planning - Workforce Initiatives
  async getWorkforceInitiatives(): Promise<WorkforceInitiative[]> {
    return await db.select().from(workforceInitiatives).where(eq(workforceInitiatives.isActive, true)).orderBy(asc(workforceInitiatives.targetDate));
  }

  async getWorkforceInitiative(id: string): Promise<WorkforceInitiative | undefined> {
    const result = await db.select().from(workforceInitiatives).where(eq(workforceInitiatives.id, id));
    return result[0];
  }

  async createWorkforceInitiative(initiative: InsertWorkforceInitiative): Promise<WorkforceInitiative> {
    const result = await db.insert(workforceInitiatives).values(initiative).returning();
    return result[0];
  }

  async updateWorkforceInitiative(id: string, initiative: Partial<InsertWorkforceInitiative>): Promise<WorkforceInitiative | undefined> {
    const result = await db.update(workforceInitiatives).set({ ...initiative, updatedAt: new Date() }).where(eq(workforceInitiatives.id, id)).returning();
    return result[0];
  }

  async deleteWorkforceInitiative(id: string): Promise<boolean> {
    const result = await db.update(workforceInitiatives).set({ isActive: false }).where(eq(workforceInitiatives.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Strategic Workforce Planning - Initiative Role Requirements (headcount demand)
  async getInitiativeRoleRequirements(initiativeId: string): Promise<InitiativeRoleRequirement[]> {
    return await db.select().from(initiativeRoleRequirements)
      .where(and(eq(initiativeRoleRequirements.initiativeId, initiativeId), eq(initiativeRoleRequirements.isActive, true)));
  }

  async createInitiativeRoleRequirement(requirement: InsertInitiativeRoleRequirement): Promise<InitiativeRoleRequirement> {
    const result = await db.insert(initiativeRoleRequirements).values(requirement).returning();
    return result[0];
  }

  async updateInitiativeRoleRequirement(id: string, requirement: Partial<InsertInitiativeRoleRequirement>): Promise<InitiativeRoleRequirement | undefined> {
    const result = await db.update(initiativeRoleRequirements).set({ ...requirement, updatedAt: new Date() }).where(eq(initiativeRoleRequirements.id, id)).returning();
    return result[0];
  }

  async deleteInitiativeRoleRequirement(id: string): Promise<boolean> {
    const result = await db.update(initiativeRoleRequirements).set({ isActive: false }).where(eq(initiativeRoleRequirements.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Strategic Workforce Planning - Succession Plans
  async getSuccessionPlans(): Promise<SuccessionPlan[]> {
    return await db.select().from(successionPlans).where(eq(successionPlans.isActive, true));
  }

  async getSuccessionPlan(id: string): Promise<SuccessionPlan | undefined> {
    const result = await db.select().from(successionPlans).where(eq(successionPlans.id, id));
    return result[0];
  }

  async createSuccessionPlan(plan: InsertSuccessionPlan): Promise<SuccessionPlan> {
    const result = await db.insert(successionPlans).values(plan).returning();
    return result[0];
  }

  async updateSuccessionPlan(id: string, plan: Partial<InsertSuccessionPlan>): Promise<SuccessionPlan | undefined> {
    const result = await db.update(successionPlans).set({ ...plan, updatedAt: new Date() }).where(eq(successionPlans.id, id)).returning();
    return result[0];
  }

  async deleteSuccessionPlan(id: string): Promise<boolean> {
    const result = await db.update(successionPlans).set({ isActive: false }).where(eq(successionPlans.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Strategic Workforce Planning - Succession Candidates (nominated successors)
  async getSuccessionCandidates(successionPlanId: string): Promise<SuccessionCandidate[]> {
    return await db.select().from(successionCandidates)
      .where(and(eq(successionCandidates.successionPlanId, successionPlanId), eq(successionCandidates.isActive, true)))
      .orderBy(asc(successionCandidates.rank));
  }

  async createSuccessionCandidate(candidate: InsertSuccessionCandidate): Promise<SuccessionCandidate> {
    const result = await db.insert(successionCandidates).values(candidate).returning();
    return result[0];
  }

  async updateSuccessionCandidate(id: string, candidate: Partial<InsertSuccessionCandidate>): Promise<SuccessionCandidate | undefined> {
    const result = await db.update(successionCandidates).set({ ...candidate, updatedAt: new Date() }).where(eq(successionCandidates.id, id)).returning();
    return result[0];
  }

  async deleteSuccessionCandidate(id: string): Promise<boolean> {
    const result = await db.update(successionCandidates).set({ isActive: false }).where(eq(successionCandidates.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Onboarding & Induction - Programs
  async getInductionPrograms(): Promise<InductionProgram[]> {
    return await db.select().from(inductionPrograms).where(eq(inductionPrograms.isActive, true)).orderBy(asc(inductionPrograms.name));
  }

  async getInductionProgram(id: string): Promise<InductionProgram | undefined> {
    const result = await db.select().from(inductionPrograms).where(eq(inductionPrograms.id, id));
    return result[0];
  }

  async createInductionProgram(program: InsertInductionProgram): Promise<InductionProgram> {
    const result = await db.insert(inductionPrograms).values(program).returning();
    return result[0];
  }

  async updateInductionProgram(id: string, program: Partial<InsertInductionProgram>): Promise<InductionProgram | undefined> {
    const result = await db.update(inductionPrograms).set({ ...program, updatedAt: new Date() }).where(eq(inductionPrograms.id, id)).returning();
    return result[0];
  }

  async deleteInductionProgram(id: string): Promise<boolean> {
    const result = await db.update(inductionPrograms).set({ isActive: false }).where(eq(inductionPrograms.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Onboarding & Induction - Tasks (steps within a program)
  async getInductionTasks(programId: string): Promise<InductionTask[]> {
    return await db.select().from(inductionTasks)
      .where(and(eq(inductionTasks.programId, programId), eq(inductionTasks.isActive, true)))
      .orderBy(asc(inductionTasks.order));
  }

  async createInductionTask(task: InsertInductionTask): Promise<InductionTask> {
    const result = await db.insert(inductionTasks).values(task).returning();
    return result[0];
  }

  async updateInductionTask(id: string, task: Partial<InsertInductionTask>): Promise<InductionTask | undefined> {
    const result = await db.update(inductionTasks).set({ ...task, updatedAt: new Date() }).where(eq(inductionTasks.id, id)).returning();
    return result[0];
  }

  async deleteInductionTask(id: string): Promise<boolean> {
    const result = await db.update(inductionTasks).set({ isActive: false }).where(eq(inductionTasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Onboarding & Induction - Assignments (a person working through a program)
  async getOnboardingAssignments(userId?: string): Promise<OnboardingAssignment[]> {
    const conditions = userId
      ? and(eq(onboardingAssignments.isActive, true), eq(onboardingAssignments.userId, userId))
      : eq(onboardingAssignments.isActive, true);
    return await db.select().from(onboardingAssignments).where(conditions).orderBy(desc(onboardingAssignments.startDate));
  }

  async getOnboardingAssignment(id: string): Promise<OnboardingAssignment | undefined> {
    const result = await db.select().from(onboardingAssignments).where(eq(onboardingAssignments.id, id));
    return result[0];
  }

  async createOnboardingAssignment(assignment: InsertOnboardingAssignment): Promise<OnboardingAssignment> {
    const result = await db.insert(onboardingAssignments).values(assignment).returning();
    return result[0];
  }

  async updateOnboardingAssignment(id: string, assignment: Partial<InsertOnboardingAssignment>): Promise<OnboardingAssignment | undefined> {
    const result = await db.update(onboardingAssignments).set({ ...assignment, updatedAt: new Date() }).where(eq(onboardingAssignments.id, id)).returning();
    return result[0];
  }

  async deleteOnboardingAssignment(id: string): Promise<boolean> {
    const result = await db.update(onboardingAssignments).set({ isActive: false }).where(eq(onboardingAssignments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Builds the full checklist view: the assignment's program, its tasks in order, and each
  // task's completion state (if any) - the shape the "My Onboarding" UI renders directly.
  async getOnboardingChecklist(assignmentId: string): Promise<OnboardingChecklist | null> {
    const assignment = await this.getOnboardingAssignment(assignmentId);
    if (!assignment) return null;

    const program = await this.getInductionProgram(assignment.programId);
    if (!program) return null;

    const taskList = await this.getInductionTasks(assignment.programId);
    const completions = await db.select().from(onboardingTaskCompletions)
      .where(eq(onboardingTaskCompletions.assignmentId, assignmentId));
    const completionByTaskId = new Map(completions.map(c => [c.taskId, c]));

    const tasks = taskList.map(task => ({
      task,
      completion: completionByTaskId.get(task.id) ?? null,
    }));

    const requiredTasks = tasks.filter(t => t.task.required);
    const completedTasks = requiredTasks.filter(t => t.completion?.completedAt).length;

    return {
      assignment,
      program,
      tasks,
      statistics: {
        totalTasks: requiredTasks.length,
        completedTasks,
        completionPercentage: requiredTasks.length > 0 ? Math.round((completedTasks / requiredTasks.length) * 100) : 0,
      },
    };
  }

  // Marks a task complete (upsert - re-completing just refreshes completedAt/notes), then
  // auto-advances the assignment to "complete" once every required task has a completion.
  async setOnboardingTaskCompletion(assignmentId: string, taskId: string, completedBy: string | null, notes: string | null): Promise<OnboardingTaskCompletion> {
    const existing = await db.select().from(onboardingTaskCompletions)
      .where(and(eq(onboardingTaskCompletions.assignmentId, assignmentId), eq(onboardingTaskCompletions.taskId, taskId)));

    let completion: OnboardingTaskCompletion;
    if (existing[0]) {
      const result = await db.update(onboardingTaskCompletions)
        .set({ completedAt: new Date(), completedBy, notes, updatedAt: new Date() })
        .where(eq(onboardingTaskCompletions.id, existing[0].id))
        .returning();
      completion = result[0];
    } else {
      const result = await db.insert(onboardingTaskCompletions)
        .values({ assignmentId, taskId, completedAt: new Date(), completedBy, notes })
        .returning();
      completion = result[0];
    }

    await this.recomputeOnboardingAssignmentStatus(assignmentId);
    return completion;
  }

  async clearOnboardingTaskCompletion(assignmentId: string, taskId: string): Promise<boolean> {
    const result = await db.delete(onboardingTaskCompletions)
      .where(and(eq(onboardingTaskCompletions.assignmentId, assignmentId), eq(onboardingTaskCompletions.taskId, taskId)));
    await this.recomputeOnboardingAssignmentStatus(assignmentId);
    return (result.rowCount ?? 0) > 0;
  }

  private async recomputeOnboardingAssignmentStatus(assignmentId: string): Promise<void> {
    const checklist = await this.getOnboardingChecklist(assignmentId);
    if (!checklist || checklist.assignment.status === 'cancelled') return;
    const allComplete = checklist.statistics.totalTasks > 0 && checklist.statistics.completedTasks === checklist.statistics.totalTasks;
    const nextStatus = allComplete ? 'complete' : 'in_progress';
    if (checklist.assignment.status !== nextStatus) {
      await db.update(onboardingAssignments).set({ status: nextStatus, updatedAt: new Date() }).where(eq(onboardingAssignments.id, assignmentId));
    }
  }

  // Absences - long-term sick, holiday, other leave. Listed most-recent-first; userId narrows to
  // one person's history (used by the Workforce Lifecycle admin page's per-person view).
  async getAbsences(userId?: string): Promise<Absence[]> {
    const conditions = userId
      ? and(eq(absences.isActive, true), eq(absences.userId, userId))
      : eq(absences.isActive, true);
    return await db.select().from(absences).where(conditions).orderBy(desc(absences.startDate));
  }

  async getAbsence(id: string): Promise<Absence | undefined> {
    const result = await db.select().from(absences).where(eq(absences.id, id));
    return result[0];
  }

  async createAbsence(absence: InsertAbsence): Promise<Absence> {
    const result = await db.insert(absences).values(absence).returning();
    return result[0];
  }

  async updateAbsence(id: string, absence: Partial<InsertAbsence>): Promise<Absence | undefined> {
    const result = await db.update(absences).set({ ...absence, updatedAt: new Date() }).where(eq(absences.id, id)).returning();
    return result[0];
  }

  async deleteAbsence(id: string): Promise<boolean> {
    const result = await db.update(absences).set({ isActive: false }).where(eq(absences.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Every currently-open absence (isActive, no actualReturnDate yet, already started) across the
  // given users, in one query - used by the compliance aggregates to know who's "on leave" without
  // a per-person round trip. Callers check `.isFrozen` on the returned row to decide whether it
  // should actually affect compliance counts (a holiday doesn't, long-term sick typically does).
  async getActiveAbsencesForUsers(userIds: string[]): Promise<Map<string, Absence>> {
    if (userIds.length === 0) return new Map();
    const now = new Date();
    const rows = await db.select().from(absences).where(and(
      inArray(absences.userId, userIds),
      eq(absences.isActive, true),
      sql`${absences.actualReturnDate} IS NULL`,
      lte(absences.startDate, now),
    ));
    return new Map(rows.map(a => [a.userId, a]));
  }

  async getKpiTargets(): Promise<KpiTarget[]> {
    return await db.select().from(kpiTargets).orderBy(asc(kpiTargets.key));
  }

  async upsertKpiTarget(key: string, target: { label: string; targetPercentage: number; updatedBy?: string }): Promise<KpiTarget> {
    const result = await db.insert(kpiTargets)
      .values({ key, label: target.label, targetPercentage: target.targetPercentage, updatedBy: target.updatedBy })
      .onConflictDoUpdate({
        target: kpiTargets.key,
        set: { label: target.label, targetPercentage: target.targetPercentage, updatedBy: target.updatedBy, updatedAt: new Date() },
      })
      .returning();
    return result[0];
  }

  // Learning content (e-learning) hosted against a training course
  async getTrainingContent(trainingId: string): Promise<TrainingContent[]> {
    return await db.select().from(trainingContent)
      .where(and(eq(trainingContent.trainingId, trainingId), eq(trainingContent.isActive, true)))
      .orderBy(asc(trainingContent.order));
  }

  async getTrainingContentItem(id: string): Promise<TrainingContent | undefined> {
    const result = await db.select().from(trainingContent).where(eq(trainingContent.id, id));
    return result[0];
  }

  async createTrainingContent(content: InsertTrainingContent): Promise<TrainingContent> {
    const result = await db.insert(trainingContent).values(content).returning();
    return result[0];
  }

  async updateTrainingContent(id: string, content: Partial<InsertTrainingContent>): Promise<TrainingContent | undefined> {
    const result = await db.update(trainingContent).set({ ...content, updatedAt: new Date() }).where(eq(trainingContent.id, id)).returning();
    return result[0];
  }

  async deleteTrainingContent(id: string): Promise<boolean> {
    const result = await db.update(trainingContent).set({ isActive: false }).where(eq(trainingContent.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Pairs a training's content items with one user's progress on each - the shape both the
  // admin content manager and learner-facing views (My Onboarding, My Training) render directly.
  async getTrainingContentWithProgress(trainingId: string, userId: string): Promise<TrainingContentWithProgress[]> {
    const items = await this.getTrainingContent(trainingId);
    if (items.length === 0) return [];

    const progressRows = await db.select().from(trainingContentProgress)
      .where(and(
        eq(trainingContentProgress.userId, userId),
        inArray(trainingContentProgress.contentId, items.map(i => i.id)),
      ));
    const progressByContentId = new Map(progressRows.map(p => [p.contentId, p]));

    return items.map(content => ({
      content,
      progress: progressByContentId.get(content.id) ?? null,
    }));
  }

  // Upserts one user's progress on one content item (re-marking just refreshes the row).
  async setTrainingContentProgress(contentId: string, userId: string, update: Partial<InsertTrainingContentProgress>): Promise<TrainingContentProgress> {
    const existing = await db.select().from(trainingContentProgress)
      .where(and(eq(trainingContentProgress.contentId, contentId), eq(trainingContentProgress.userId, userId)));

    const now = new Date();
    let saved: TrainingContentProgress;
    if (existing[0]) {
      const result = await db.update(trainingContentProgress)
        .set({ ...update, lastAccessedAt: now, updatedAt: now })
        .where(eq(trainingContentProgress.id, existing[0].id))
        .returning();
      saved = result[0];
    } else {
      const result = await db.insert(trainingContentProgress)
        .values({ contentId, userId, lastAccessedAt: now, ...update })
        .returning();
      saved = result[0];
    }

    // Must run regardless of which branch above ran - in real usage the row almost always
    // already exists by the time a video reaches "completed" (created earlier by a periodic
    // in-progress save during playback), so this previously only firing after the insert branch
    // meant the rollup essentially never triggered for a real watch-through, only in a synthetic
    // test that marks something complete on its very first progress call.
    if (update.status === 'completed') {
      const contentItem = await this.getTrainingContentItem(contentId);
      if (contentItem) {
        await this.maybeCompleteTrainingFromContent(userId, contentItem.trainingId);
      }
    }
    return saved;
  }

  // Called whenever a content item is marked complete - checks whether every content item for
  // that training is now complete for this user, and if so, rolls that up into the actual
  // compliance record (the training_enrollment), plus logs it to the audit trail. Guarded so it
  // only fires once per real completion, not on every subsequent progress update.
  private async maybeCompleteTrainingFromContent(userId: string, trainingId: string): Promise<void> {
    const items = await this.getTrainingContent(trainingId);
    if (items.length === 0) return;

    const progressRows = await db.select().from(trainingContentProgress)
      .where(and(eq(trainingContentProgress.userId, userId), inArray(trainingContentProgress.contentId, items.map(i => i.id))));
    const allComplete = items.every(item => progressRows.find(p => p.contentId === item.id)?.status === 'completed');
    if (!allComplete) return;

    const now = new Date();
    const [enrollment] = await db.select().from(trainingEnrollments)
      .where(and(eq(trainingEnrollments.userId, userId), eq(trainingEnrollments.trainingId, trainingId), eq(trainingEnrollments.isActive, true)));

    if (enrollment) {
      if (enrollment.status === 'completed') return; // already rolled up and logged when it first completed
      await db.update(trainingEnrollments).set({ status: 'completed', achievementDate: now, updatedAt: now }).where(eq(trainingEnrollments.id, enrollment.id));
      await this.recordTrainingCompletion({ userId, trainingId, enrollmentId: enrollment.id, method: 'content_completed', completedAt: now });
      return;
    }

    // No enrollment record to gate on - fall back to checking whether this exact completion was
    // already logged, so re-triggering this check doesn't insert duplicate audit rows.
    const [existingAudit] = await db.select().from(trainingCompletionAudit)
      .where(and(
        eq(trainingCompletionAudit.userId, userId),
        eq(trainingCompletionAudit.trainingId, trainingId),
        eq(trainingCompletionAudit.method, 'content_completed'),
      ));
    if (existingAudit) return;
    await this.recordTrainingCompletion({ userId, trainingId, enrollmentId: null, method: 'content_completed', completedAt: now });
  }

  // One-time repair for completions that were recorded (training_content_progress marked
  // "completed") before a bug meant the rollup into training_enrollments and the audit log never
  // ran for them - re-runs the same rollup check against every (user, training) pair that has at
  // least one completed content item. Idempotent and safe to run repeatedly.
  async repairTrainingCompletionRollups(): Promise<{ pairsChecked: number }> {
    const completedProgress = await db.select({ userId: trainingContentProgress.userId, contentId: trainingContentProgress.contentId })
      .from(trainingContentProgress)
      .where(eq(trainingContentProgress.status, 'completed'));
    if (completedProgress.length === 0) return { pairsChecked: 0 };

    const contentIds = Array.from(new Set(completedProgress.map(p => p.contentId)));
    const contentRows = await db.select().from(trainingContent).where(inArray(trainingContent.id, contentIds));
    const trainingIdByContentId = new Map(contentRows.map(c => [c.id, c.trainingId]));

    const pairs = new Set<string>();
    for (const p of completedProgress) {
      const trainingId = trainingIdByContentId.get(p.contentId);
      if (trainingId) pairs.add(`${p.userId}::${trainingId}`);
    }

    for (const pair of Array.from(pairs)) {
      const [userId, trainingId] = pair.split('::');
      await this.maybeCompleteTrainingFromContent(userId, trainingId);
    }
    return { pairsChecked: pairs.size };
  }

  async recordTrainingCompletion(entry: InsertTrainingCompletionAudit): Promise<void> {
    await db.insert(trainingCompletionAudit).values(entry);
  }

  async getTrainingCompletionRecords(filters: { trainingId?: string; userId?: string; from?: Date; to?: Date }): Promise<TrainingCompletionRecord[]> {
    const conditions = [];
    if (filters.trainingId) conditions.push(eq(trainingCompletionAudit.trainingId, filters.trainingId));
    if (filters.userId) conditions.push(eq(trainingCompletionAudit.userId, filters.userId));
    if (filters.from) conditions.push(gte(trainingCompletionAudit.completedAt, filters.from));
    if (filters.to) conditions.push(lte(trainingCompletionAudit.completedAt, filters.to));

    const rows = await db.select({
      id: trainingCompletionAudit.id,
      userId: trainingCompletionAudit.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      trainingId: trainingCompletionAudit.trainingId,
      trainingName: trainings.name,
      categoryName: trainingCategories.name,
      method: trainingCompletionAudit.method,
      completedAt: trainingCompletionAudit.completedAt,
      recordedAt: trainingCompletionAudit.recordedAt,
    })
      .from(trainingCompletionAudit)
      .leftJoin(users, eq(trainingCompletionAudit.userId, users.id))
      .leftJoin(trainings, eq(trainingCompletionAudit.trainingId, trainings.id))
      .leftJoin(trainingCategories, eq(trainings.categoryId, trainingCategories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(trainingCompletionAudit.completedAt));

    return rows.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || 'Unknown user',
      userEmail: r.email,
      trainingId: r.trainingId,
      trainingName: r.trainingName || 'Unknown training',
      categoryName: r.categoryName,
      method: r.method,
      completedAt: r.completedAt,
      recordedAt: r.recordedAt,
    }));
  }

  async getStandardLevels(): Promise<StandardLevel[]> {
    const existing = await db.select().from(standardLevels).where(eq(standardLevels.isActive, true)).orderBy(asc(standardLevels.order));
    if (existing.length > 0) return existing;

    const defaultLevels = [
      'Apprentice', 'Trainee Technician', 'Technician', 'Lead Technician', 'Graduate Engineer',
      'Engineer', 'Lead Engineer', 'Technical Authority', 'Planner', 'Scheduler', 'HSE Advisor',
      'OIM', 'Superintendent', 'Supervisor',
    ];
    // Seeded once, idempotently, the first time the levels are requested against an empty table.
    const seeded = await db.insert(standardLevels).values(
      defaultLevels.map((name, index) => ({ name, order: index }))
    ).returning();
    return seeded.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async createStandardLevel(level: InsertStandardLevel): Promise<StandardLevel> {
    const result = await db.insert(standardLevels).values(level).returning();
    return result[0];
  }

  async updateStandardLevel(id: string, level: Partial<InsertStandardLevel>): Promise<StandardLevel | undefined> {
    const result = await db.update(standardLevels).set(level).where(eq(standardLevels.id, id)).returning();
    return result[0];
  }

  async deleteStandardLevel(id: string): Promise<boolean> {
    const result = await db.update(standardLevels).set({ isActive: false }).where(eq(standardLevels.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getStandardDraftSessions(createdBy?: string): Promise<StandardDraftSession[]> {
    const conditions = [eq(standardDraftSessions.isActive, true)];
    if (createdBy) conditions.push(eq(standardDraftSessions.createdBy, createdBy));
    return await db.select().from(standardDraftSessions).where(and(...conditions)).orderBy(desc(standardDraftSessions.createdAt));
  }

  async getStandardDraftSession(id: string): Promise<StandardDraftSession | undefined> {
    const result = await db.select().from(standardDraftSessions).where(eq(standardDraftSessions.id, id));
    return result[0];
  }

  async createStandardDraftSession(session: InsertStandardDraftSession): Promise<StandardDraftSession> {
    const result = await db.insert(standardDraftSessions).values(session).returning();
    return result[0];
  }

  async updateStandardDraftSession(id: string, session: Partial<InsertStandardDraftSession>): Promise<StandardDraftSession | undefined> {
    const result = await db.update(standardDraftSessions).set({ ...session, updatedAt: new Date() }).where(eq(standardDraftSessions.id, id)).returning();
    return result[0];
  }

  async deleteStandardDraftSession(id: string): Promise<boolean> {
    const subjectMatterIds = (
      await db.select({ id: standardDraftSubjectMatters.id }).from(standardDraftSubjectMatters)
        .where(eq(standardDraftSubjectMatters.draftSessionId, id))
    ).map(row => row.id);

    if (subjectMatterIds.length > 0) {
      await db.update(standardDraftQuestions).set({ isActive: false }).where(inArray(standardDraftQuestions.subjectMatterId, subjectMatterIds));
      await db.update(standardDraftScenarios).set({ isActive: false }).where(inArray(standardDraftScenarios.subjectMatterId, subjectMatterIds));
      await db.update(standardDraftSubjectMatters).set({ isActive: false }).where(inArray(standardDraftSubjectMatters.id, subjectMatterIds));
    }

    const result = await db.update(standardDraftSessions).set({ isActive: false }).where(eq(standardDraftSessions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getStandardDraftSubjectMatters(draftSessionId: string): Promise<StandardDraftSubjectMatter[]> {
    return await db.select().from(standardDraftSubjectMatters)
      .where(and(eq(standardDraftSubjectMatters.draftSessionId, draftSessionId), eq(standardDraftSubjectMatters.isActive, true)))
      .orderBy(asc(standardDraftSubjectMatters.order));
  }

  async getStandardDraftSubjectMatter(id: string): Promise<StandardDraftSubjectMatter | undefined> {
    const result = await db.select().from(standardDraftSubjectMatters).where(eq(standardDraftSubjectMatters.id, id));
    return result[0];
  }

  async createStandardDraftSubjectMatter(subjectMatter: InsertStandardDraftSubjectMatter): Promise<StandardDraftSubjectMatter> {
    const result = await db.insert(standardDraftSubjectMatters).values(subjectMatter).returning();
    return result[0];
  }

  async updateStandardDraftSubjectMatter(id: string, subjectMatter: Partial<InsertStandardDraftSubjectMatter>): Promise<StandardDraftSubjectMatter | undefined> {
    const result = await db.update(standardDraftSubjectMatters).set({ ...subjectMatter, updatedAt: new Date() }).where(eq(standardDraftSubjectMatters.id, id)).returning();
    return result[0];
  }

  async deleteStandardDraftSubjectMatter(id: string): Promise<boolean> {
    const result = await db.update(standardDraftSubjectMatters).set({ isActive: false }).where(eq(standardDraftSubjectMatters.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getStandardDraftQuestions(subjectMatterId: string): Promise<StandardDraftQuestion[]> {
    return await db.select().from(standardDraftQuestions)
      .where(and(eq(standardDraftQuestions.subjectMatterId, subjectMatterId), eq(standardDraftQuestions.isActive, true)))
      .orderBy(asc(standardDraftQuestions.order));
  }

  async createStandardDraftQuestions(questions: InsertStandardDraftQuestion[]): Promise<StandardDraftQuestion[]> {
    if (questions.length === 0) return [];
    return await db.insert(standardDraftQuestions).values(questions).returning();
  }

  async updateStandardDraftQuestion(id: string, question: Partial<InsertStandardDraftQuestion>): Promise<StandardDraftQuestion | undefined> {
    const result = await db.update(standardDraftQuestions).set({ ...question, updatedAt: new Date() }).where(eq(standardDraftQuestions.id, id)).returning();
    return result[0];
  }

  async deleteStandardDraftQuestion(id: string): Promise<boolean> {
    const result = await db.update(standardDraftQuestions).set({ isActive: false }).where(eq(standardDraftQuestions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getStandardDraftScenarios(subjectMatterId: string): Promise<StandardDraftScenario[]> {
    return await db.select().from(standardDraftScenarios)
      .where(and(eq(standardDraftScenarios.subjectMatterId, subjectMatterId), eq(standardDraftScenarios.isActive, true)))
      .orderBy(asc(standardDraftScenarios.order));
  }

  async createStandardDraftScenarios(scenarios: InsertStandardDraftScenario[]): Promise<StandardDraftScenario[]> {
    if (scenarios.length === 0) return [];
    return await db.insert(standardDraftScenarios).values(scenarios).returning();
  }

  async updateStandardDraftScenario(id: string, scenario: Partial<InsertStandardDraftScenario>): Promise<StandardDraftScenario | undefined> {
    const result = await db.update(standardDraftScenarios).set({ ...scenario, updatedAt: new Date() }).where(eq(standardDraftScenarios.id, id)).returning();
    return result[0];
  }

  async deleteStandardDraftScenario(id: string): Promise<boolean> {
    const result = await db.update(standardDraftScenarios).set({ isActive: false }).where(eq(standardDraftScenarios.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Materializes an approved SME draft into real competency_elements/competence_subcategories/
  // competence_criteria rows. Only "approved" or "edited" questions/scenarios are published -
  // "ai_generated" (never reviewed) and "rejected" items are left behind. Reuses
  // createCompetenceCriteria for its existing code/numbering logic rather than duplicating it.
  async publishStandardDraft(draftSessionId: string, categoryId: string): Promise<CompetencyElement> {
    const draft = await this.getStandardDraftSession(draftSessionId);
    if (!draft) throw new Error('Draft session not found');
    if (draft.status === 'published') throw new Error('This draft has already been published');

    const allLevels = await this.getStandardLevels();
    const levelNameById = new Map(allLevels.map(l => [l.id, l.name]));
    const selectedLevelNames = (draft.jobLevelIds || [])
      .map(id => levelNameById.get(id))
      .filter((name): name is string => !!name);

    const element = await this.createCompetencyElement({
      categoryId,
      name: draft.title,
      description: `Authored via the SME new-standard wizard.${selectedLevelNames.length ? ` Job levels: ${selectedLevelNames.join(', ')}.` : ''}`,
    } as InsertCompetencyElement);

    const subjectMatters = await this.getStandardDraftSubjectMatters(draftSessionId);

    for (const sm of subjectMatters) {
      const questions = (await this.getStandardDraftQuestions(sm.id)).filter(q => q.status === 'approved' || q.status === 'edited');
      const scenarios = sm.performanceAssessmentType === 'scenario'
        ? (await this.getStandardDraftScenarios(sm.id)).filter(s => s.status === 'approved' || s.status === 'edited')
        : [];

      if (questions.length > 0) {
        const knowledgeSubcategory = await this.createCompetenceSubcategory({
          elementId: element.id,
          name: sm.name,
          type: 'knowledge',
        } as InsertCompetenceSubcategory);

        for (const q of questions) {
          const levelName = q.levelId ? levelNameById.get(q.levelId) : undefined;
          // criteriaText is candidate-visible (matches this platform's existing convention of a
          // knowledge criterion simply being the question the assessor will ask) - the multiple
          // choice options, correct answer, and explanation are assessor-only reference material
          // for grading the candidate's spoken/written answer, so they go in assessorGuidance,
          // never in criteriaText. Generated "without assessor guidance" questions have no
          // options at all, so there's nothing to put there.
          let assessorGuidance: string | undefined;
          if (q.options && q.options.length > 0) {
            const optionLines = q.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}${i === q.correctAnswerIndex ? ' [CORRECT]' : ''}`).join('\n');
            assessorGuidance = `Options:\n${optionLines}${q.explanation ? `\n\nExplanation: ${q.explanation}` : ''}`;
          }
          await this.createCompetenceCriteria({
            elementId: element.id,
            subcategoryId: knowledgeSubcategory.id,
            type: 'knowledge',
            criteriaText: q.questionText,
            assessorGuidance,
            // Structured mirror of the same options/answer, used by the self-assessment quiz to
            // grade candidate answers - assessorGuidance above stays the human-readable text.
            mcqOptions: q.options && q.options.length > 0 ? q.options : undefined,
            mcqCorrectAnswerIndex: q.options && q.options.length > 0 ? q.correctAnswerIndex : undefined,
            criteriaNumber: 0, // overwritten by createCompetenceCriteria's own numbering logic
            applicableLevels: levelName ? [levelName] : (selectedLevelNames.length ? selectedLevelNames : undefined),
          } as InsertCompetenceCriteria);
        }
      }

      if (scenarios.length > 0) {
        const performanceSubcategory = await this.createCompetenceSubcategory({
          elementId: element.id,
          name: sm.name,
          type: 'performance',
        } as InsertCompetenceSubcategory);

        for (const s of scenarios) {
          const levelName = s.levelId ? levelNameById.get(s.levelId) : undefined;
          // criteriaText is candidate-visible (the scenario itself - what they'll be asked to do).
          // The assessment criteria are what the assessor should look for while grading it, so
          // those go in assessorGuidance, not in the candidate-facing text.
          await this.createCompetenceCriteria({
            elementId: element.id,
            subcategoryId: performanceSubcategory.id,
            type: 'performance',
            criteriaText: `${s.title}: ${s.scenarioText}`,
            assessorGuidance: s.assessmentCriteria?.length ? `Assessment criteria:\n${s.assessmentCriteria.map(c => `- ${c}`).join('\n')}` : undefined,
            criteriaNumber: 0, // overwritten by createCompetenceCriteria's own numbering logic
            applicableLevels: levelName ? [levelName] : (selectedLevelNames.length ? selectedLevelNames : undefined),
          } as InsertCompetenceCriteria);
        }
      }
      // Work-evidence subject matters publish no scripted scenario criteria - they're assessed via
      // evidence review (Part 1) against the subcategory/subject matter itself, not a fixed script.
    }

    await db.update(standardDraftSessions)
      .set({ status: 'published', publishedElementId: element.id, publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(standardDraftSessions.id, draftSessionId));

    return element;
  }

  // Re-syncs an already-published draft into its existing competency element: updates published
  // criteria that match an approved question/scenario by criteriaText (so re-generating a question
  // with a newer answer-key format, or editing one after the original publish, can be pushed
  // through), and creates criteria for anything approved that wasn't part of the original publish
  // (e.g. a subject matter or question added afterward). Criteria with no matching draft item are
  // left untouched - additive/update-only, never deletes, matching this platform's established
  // sync philosophy elsewhere (job-role requirement sync, etc.).
  async syncPublishedStandardDraft(draftSessionId: string): Promise<{ created: number; updated: number }> {
    const draft = await this.getStandardDraftSession(draftSessionId);
    if (!draft) throw new Error('Draft session not found');
    if (draft.status !== 'published' || !draft.publishedElementId) {
      throw new Error('This draft has not been published yet - use Publish first');
    }
    const elementId = draft.publishedElementId;

    const allLevels = await this.getStandardLevels();
    const levelNameById = new Map(allLevels.map(l => [l.id, l.name]));
    const selectedLevelNames = (draft.jobLevelIds || [])
      .map(id => levelNameById.get(id))
      .filter((name): name is string => !!name);

    const existingCriteria = await db.select().from(competenceCriteria)
      .where(and(eq(competenceCriteria.elementId, elementId), eq(competenceCriteria.isActive, true)));
    const existingSubcategories = await this.getCompetenceSubcategories(elementId);

    let created = 0;
    let updated = 0;

    const subjectMatters = await this.getStandardDraftSubjectMatters(draftSessionId);
    for (const sm of subjectMatters) {
      const questions = (await this.getStandardDraftQuestions(sm.id)).filter(q => q.status === 'approved' || q.status === 'edited');
      const scenarios = sm.performanceAssessmentType === 'scenario'
        ? (await this.getStandardDraftScenarios(sm.id)).filter(s => s.status === 'approved' || s.status === 'edited')
        : [];

      for (const q of questions) {
        const levelName = q.levelId ? levelNameById.get(q.levelId) : undefined;
        let assessorGuidance: string | undefined;
        if (q.options && q.options.length > 0) {
          const optionLines = q.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}${i === q.correctAnswerIndex ? ' [CORRECT]' : ''}`).join('\n');
          assessorGuidance = `Options:\n${optionLines}${q.explanation ? `\n\nExplanation: ${q.explanation}` : ''}`;
        }
        const mcqOptions = q.options && q.options.length > 0 ? q.options : undefined;
        const mcqCorrectAnswerIndex = q.options && q.options.length > 0 ? q.correctAnswerIndex : undefined;
        const applicableLevels = levelName ? [levelName] : (selectedLevelNames.length ? selectedLevelNames : undefined);

        const match = existingCriteria.find(c => c.type === 'knowledge' && c.criteriaText === q.questionText);
        if (match) {
          await db.update(competenceCriteria).set({
            assessorGuidance, mcqOptions, mcqCorrectAnswerIndex, applicableLevels, updatedAt: new Date(),
          }).where(eq(competenceCriteria.id, match.id));
          updated++;
        } else {
          let subcategory = existingSubcategories.find(s => s.name === sm.name && s.type === 'knowledge');
          if (!subcategory) {
            subcategory = await this.createCompetenceSubcategory({ elementId, name: sm.name, type: 'knowledge' } as InsertCompetenceSubcategory);
            existingSubcategories.push(subcategory);
          }
          await this.createCompetenceCriteria({
            elementId,
            subcategoryId: subcategory.id,
            type: 'knowledge',
            criteriaText: q.questionText,
            assessorGuidance,
            mcqOptions,
            mcqCorrectAnswerIndex,
            criteriaNumber: 0,
            applicableLevels,
          } as InsertCompetenceCriteria);
          created++;
        }
      }

      for (const s of scenarios) {
        const levelName = s.levelId ? levelNameById.get(s.levelId) : undefined;
        const criteriaText = `${s.title}: ${s.scenarioText}`;
        const assessorGuidance = s.assessmentCriteria?.length ? `Assessment criteria:\n${s.assessmentCriteria.map(c => `- ${c}`).join('\n')}` : undefined;
        const applicableLevels = levelName ? [levelName] : (selectedLevelNames.length ? selectedLevelNames : undefined);

        const match = existingCriteria.find(c => c.type === 'performance' && c.criteriaText === criteriaText);
        if (match) {
          await db.update(competenceCriteria).set({
            assessorGuidance, applicableLevels, updatedAt: new Date(),
          }).where(eq(competenceCriteria.id, match.id));
          updated++;
        } else {
          let subcategory = existingSubcategories.find(sc => sc.name === sm.name && sc.type === 'performance');
          if (!subcategory) {
            subcategory = await this.createCompetenceSubcategory({ elementId, name: sm.name, type: 'performance' } as InsertCompetenceSubcategory);
            existingSubcategories.push(subcategory);
          }
          await this.createCompetenceCriteria({
            elementId,
            subcategoryId: subcategory.id,
            type: 'performance',
            criteriaText,
            assessorGuidance,
            criteriaNumber: 0,
            applicableLevels,
          } as InsertCompetenceCriteria);
          created++;
        }
      }
    }

    await db.update(standardDraftSessions).set({ updatedAt: new Date() }).where(eq(standardDraftSessions.id, draftSessionId));

    return { created, updated };
  }

  // One-time backfill: creates Location/BusinessUnit records from the existing free-text
  // location/businessUnit values on users and job_roles, then links each record to the new
  // structured *Id column by matching on name. Safe to run repeatedly - only fills in gaps
  // (never overwrites an already-set locationId/businessUnitId, never creates a duplicate
  // location/business unit for a name that already exists).
  async backfillOrganisationStructure(): Promise<{ locationsCreated: number; businessUnitsCreated: number; usersLinked: number; jobRolesLinked: number }> {
    const existingLocations = await db.select().from(locations);
    const locationByName = new Map(existingLocations.map(l => [l.name.trim().toLowerCase(), l]));

    const existingBusinessUnits = await db.select().from(businessUnits);
    const businessUnitByName = new Map(existingBusinessUnits.map(b => [b.name.trim().toLowerCase(), b]));

    const distinctUserLocations = await db.selectDistinct({ location: users.location }).from(users);
    const distinctRoleLocations = await db.selectDistinct({ location: jobRoles.location }).from(jobRoles);
    const distinctRoleBusinessUnits = await db.selectDistinct({ businessUnit: jobRoles.businessUnit }).from(jobRoles);

    let locationsCreated = 0;
    const allLocationNames = new Set([
      ...distinctUserLocations.map(r => r.location),
      ...distinctRoleLocations.map(r => r.location),
    ].filter((v): v is string => !!v && v.trim().length > 0));

    for (const name of allLocationNames) {
      const key = name.trim().toLowerCase();
      if (locationByName.has(key)) continue;
      const created = await this.createLocation({ name: name.trim() });
      locationByName.set(key, created);
      locationsCreated++;
    }

    let businessUnitsCreated = 0;
    const allBusinessUnitNames = new Set(
      distinctRoleBusinessUnits.map(r => r.businessUnit).filter((v): v is string => !!v && v.trim().length > 0)
    );
    for (const name of allBusinessUnitNames) {
      const key = name.trim().toLowerCase();
      if (businessUnitByName.has(key)) continue;
      const created = await this.createBusinessUnit({ name: name.trim() });
      businessUnitByName.set(key, created);
      businessUnitsCreated++;
    }

    // Link users.locationId where missing
    const usersToLink = await db.select().from(users).where(and(isNull(users.locationId), eq(users.isActive, true)));
    let usersLinked = 0;
    for (const u of usersToLink) {
      if (!u.location) continue;
      const loc = locationByName.get(u.location.trim().toLowerCase());
      if (!loc) continue;
      await db.update(users).set({ locationId: loc.id }).where(eq(users.id, u.id));
      usersLinked++;
    }

    // Link job_roles.locationId/businessUnitId where missing
    const rolesToLink = await db.select().from(jobRoles).where(eq(jobRoles.isActive, true));
    let jobRolesLinked = 0;
    for (const r of rolesToLink) {
      const update: Partial<InsertJobRole> = {};
      if (!r.locationId && r.location) {
        const loc = locationByName.get(r.location.trim().toLowerCase());
        if (loc) update.locationId = loc.id;
      }
      if (!r.businessUnitId && r.businessUnit) {
        const bu = businessUnitByName.get(r.businessUnit.trim().toLowerCase());
        if (bu) update.businessUnitId = bu.id;
      }
      if (Object.keys(update).length > 0) {
        await db.update(jobRoles).set(update).where(eq(jobRoles.id, r.id));
        jobRolesLinked++;
      }
    }

    return { locationsCreated, businessUnitsCreated, usersLinked, jobRolesLinked };
  }

  async duplicateJobRole(sourceRoleId: string, name: string, code: string): Promise<{ role: JobRole; elementsCopied: number; trainingsCopied: number }> {
    const sourceRole = await this.getJobRole(sourceRoleId);
    if (!sourceRole) {
      throw new Error("Source job role not found");
    }

    const newRole = await this.createJobRole({
      name,
      code,
      description: sourceRole.description,
      department: sourceRole.department,
      location: sourceRole.location,
      businessUnit: sourceRole.businessUnit,
      level: sourceRole.level,
    });

    const sourceElements = await this.getRoleElements(sourceRoleId);
    for (const el of sourceElements) {
      await this.createRoleElement({
        roleId: newRole.id,
        elementId: el.elementId,
        requirementLevel: el.requirementLevel ?? undefined,
        activityType: el.activityType ?? undefined,
        validityYears: el.validityYears ?? undefined,
        safetyCritical: el.safetyCritical ?? undefined,
      });
    }

    const sourceTrainings = await this.getRoleTrainings(sourceRoleId);
    for (const t of sourceTrainings) {
      await this.createRoleTraining({
        roleId: newRole.id,
        trainingId: t.trainingId,
        requirementLevel: t.requirementLevel ?? undefined,
      });
    }

    return { role: newRole, elementsCopied: sourceElements.length, trainingsCopied: sourceTrainings.length };
  }

  async getRoleElementsWithDetails(roleId: string): Promise<Array<RoleElement & { element: CompetencyElement }>> {
    const elements = await db
      .select({
        roleElement: roleElements,
        element: competencyElements
      })
      .from(roleElements)
      .leftJoin(competencyElements, eq(roleElements.elementId, competencyElements.id))
      .where(and(
        eq(roleElements.roleId, roleId),
        eq(roleElements.isActive, true),
        eq(competencyElements.isActive, true)
      ));
    
    return elements
      .filter(e => e.element)
      .map(e => ({
        ...e.roleElement,
        element: e.element!
      }));
  }

  // Role Trainings operations
  async getRoleTrainings(roleId: string): Promise<RoleTraining[]> {
    return await db.select().from(roleTrainings)
      .where(and(
        eq(roleTrainings.roleId, roleId),
        eq(roleTrainings.isActive, true)
      ));
  }

  async getRoleTrainingsWithDetails(roleId: string): Promise<Array<RoleTraining & { training: Training }>> {
    const roleTrainingRows = await db
      .select({
        roleTraining: roleTrainings,
        training: trainings
      })
      .from(roleTrainings)
      .leftJoin(trainings, eq(roleTrainings.trainingId, trainings.id))
      .where(and(
        eq(roleTrainings.roleId, roleId),
        eq(roleTrainings.isActive, true),
        eq(trainings.isActive, true)
      ))
      .orderBy(asc(trainings.name));

    return roleTrainingRows
      .filter(t => t.training)
      .map(t => ({
        ...t.roleTraining,
        training: t.training!
      }));
  }

  async getRoleTrainingsByTrainingId(trainingId: string): Promise<RoleTraining[]> {
    return await db.select().from(roleTrainings)
      .where(and(
        eq(roleTrainings.trainingId, trainingId),
        eq(roleTrainings.isActive, true)
      ));
  }

  async createRoleTraining(roleTraining: InsertRoleTraining): Promise<RoleTraining> {
    const payload = { ...roleTraining };
    if (payload.requirementLevel && payload.required === undefined) {
      payload.required = payload.requirementLevel !== 'D';
    }
    const result = await db.insert(roleTrainings).values(payload).returning();
    return result[0];
  }

  async updateRoleTraining(id: string, roleTraining: Partial<InsertRoleTraining>): Promise<RoleTraining | undefined> {
    const payload = { ...roleTraining };
    if (payload.requirementLevel && payload.required === undefined) {
      payload.required = payload.requirementLevel !== 'D';
    }
    const result = await db.update(roleTrainings).set(payload).where(eq(roleTrainings.id, id)).returning();
    return result[0];
  }

  async deleteRoleTraining(id: string): Promise<boolean> {
    const result = await db.update(roleTrainings).set({ isActive: false }).where(eq(roleTrainings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async cleanupCompetenceElementImportArtifacts(): Promise<{ categoriesArchived: number; trainingsArchived: number; roleTrainingsArchived: number }> {
    // Bogus categories come in two shapes: the literal "COMPETENCE ELEMENTS" section header
    // itself (when older imports created it as a real category), and individual element rows
    // whose 5-digit-coded name got misread as a category name due to inconsistent cell merging
    // in the source workbook (e.g. "03046OBS 47/3B Wellheads Flow Lines and Headers B01").
    const badCategories = await db.select().from(trainingCategories).where(
      and(
        eq(trainingCategories.isActive, true),
        or(
          ilike(trainingCategories.name, "competence element%"),
          sql`${trainingCategories.name} ~ '^[0-9]{5}'`
        )
      )
    );

    let trainingsArchived = 0;
    let roleTrainingsArchived = 0;

    for (const category of badCategories) {
      const categoryTrainings = await db.select().from(trainings).where(
        and(eq(trainings.categoryId, category.id), eq(trainings.isActive, true))
      );
      for (const training of categoryTrainings) {
        const links = await db.update(roleTrainings).set({ isActive: false }).where(
          and(eq(roleTrainings.trainingId, training.id), eq(roleTrainings.isActive, true))
        ).returning();
        roleTrainingsArchived += links.length;
        await db.update(trainings).set({ isActive: false }).where(eq(trainings.id, training.id));
        trainingsArchived++;
      }
    }

    if (badCategories.length > 0) {
      await db.update(trainingCategories).set({ isActive: false }).where(
        inArray(trainingCategories.id, badCategories.map(c => c.id))
      );
    }

    return { categoriesArchived: badCategories.length, trainingsArchived, roleTrainingsArchived };
  }

  // One-time repair for assessments auto-created before assignJobRoleToUser looked up the
  // candidate's real assessor from candidateAllocations - those got assessorId set to whoever
  // triggered the role assignment (often an admin, or the candidate's own id) instead. Only
  // touches still-pending assessments; completed ones are historical record of who actually
  // assessed and must not be rewritten.
  async repairMisassignedAssessorAssignments(): Promise<{ assessmentsRepaired: number }> {
    const activeAllocations = await db.select().from(candidateAllocations).where(eq(candidateAllocations.isActive, true));
    const primaryAssessorByCandidateId = new Map<string, string>();
    for (const allocation of activeAllocations) {
      if (!primaryAssessorByCandidateId.has(allocation.candidateId)) {
        primaryAssessorByCandidateId.set(allocation.candidateId, allocation.assessorId);
      }
    }

    const pendingAssessments = await db.select().from(assessments).where(
      and(eq(assessments.isActive, true), eq(assessments.outcome, 'not_yet_competent'))
    );

    let assessmentsRepaired = 0;
    for (const assessment of pendingAssessments) {
      const correctAssessorId = primaryAssessorByCandidateId.get(assessment.candidateId);
      if (correctAssessorId && correctAssessorId !== assessment.assessorId) {
        await db.update(assessments).set({ assessorId: correctAssessorId }).where(eq(assessments.id, assessment.id));
        assessmentsRepaired++;
      }
    }

    return { assessmentsRepaired };
  }

  // Training Requirement Groups (1-of-N alternative training requirements)
  async getTrainingRequirementGroups(roleId: string): Promise<TrainingRequirementGroup[]> {
    return await db.select().from(trainingRequirementGroups).where(
      and(eq(trainingRequirementGroups.roleId, roleId), eq(trainingRequirementGroups.isActive, true))
    );
  }

  async createTrainingRequirementGroup(group: InsertTrainingRequirementGroup): Promise<TrainingRequirementGroup> {
    const result = await db.insert(trainingRequirementGroups).values(group).returning();
    return result[0];
  }

  async updateTrainingRequirementGroup(id: string, group: Partial<InsertTrainingRequirementGroup>): Promise<TrainingRequirementGroup | undefined> {
    const result = await db.update(trainingRequirementGroups).set(group).where(eq(trainingRequirementGroups.id, id)).returning();
    return result[0];
  }

  async deleteTrainingRequirementGroup(id: string): Promise<boolean> {
    // Ungroup member requirements first so they revert to standalone rather than orphaned.
    await db.update(roleTrainings).set({ groupId: null }).where(eq(roleTrainings.groupId, id));
    const result = await db.update(trainingRequirementGroups).set({ isActive: false }).where(eq(trainingRequirementGroups.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Auto-assignment operations
  async assignJobRoleToUser(userId: string, roleId: string, allocatedBy?: string): Promise<{ assessmentsCreated: number; trainingsEnrolled: number }> {
    let assessmentsCreated = 0;
    let trainingsEnrolled = 0;

    // Auto-created assessments should be assigned to the candidate's actual assessor
    // (from candidateAllocations, set via the Admin UI), not whoever triggered this
    // role assignment - that's often an admin or, on self-registration, the candidate
    // themselves, neither of whom should end up as the assessor of record.
    const candidateAllocationsList = await this.getCandidateAllocations(undefined, userId);
    const assignedAssessorId = candidateAllocationsList[0]?.assessorId || allocatedBy || 'unassigned';

    // Get all competence elements for this role
    const roleElementsList = await this.getRoleElements(roleId);

    // Get all level-specific assignments for this role
    const roleElementLevelsList = await this.getRoleElementLevels(roleId);

    // Create assessments for each element
    for (const roleElement of roleElementsList) {
      // Check if this element has specific levels assigned
      const assignedLevels = roleElementLevelsList.filter(rel => rel.elementId === roleElement.elementId);

      if (assignedLevels.length > 0) {
        // Element has specific levels - create one assessment per level
        for (const levelAssignment of assignedLevels) {
          // Check if level-specific assessment already exists
          const existingAssessments = await db
            .select()
            .from(assessments)
            .where(and(
              eq(assessments.candidateId, userId),
              eq(assessments.elementId, roleElement.elementId),
              eq(assessments.levelId, levelAssignment.levelId),
              eq(assessments.isActive, true)
            ));

          if (existingAssessments.length === 0) {
            // Create new level-specific assessment
            await this.createAssessment({
              candidateId: userId,
              elementId: roleElement.elementId,
              levelId: levelAssignment.levelId,
              assessorId: assignedAssessorId,
              outcome: 'not_yet_competent',
              assessmentMethods: [],
              assessorComments: `Auto-assigned from job role - ${levelAssignment.level.name} level`,
              isAssignment: true,
              origin: 'role_assignment',
            });
            assessmentsCreated++;
          }
        }
      } else {
        // No specific levels - create regular assessment without levelId
        const existingAssessments = await this.getAssessments(userId, undefined, roleElement.elementId);

        if (existingAssessments.length === 0) {
          // Create new assessment with "not_yet_competent" status
          await this.createAssessment({
            candidateId: userId,
            elementId: roleElement.elementId,
            assessorId: assignedAssessorId,
            outcome: 'not_yet_competent',
            assessmentMethods: [],
            assessorComments: 'Auto-assigned from job role',
            isAssignment: true,
            origin: 'role_assignment',
          });
          assessmentsCreated++;
        }
      }
    }

    // Phase 2: Training enrollments
    const roleTrainingsList = await this.getRoleTrainings(roleId);
    
    for (const roleTraining of roleTrainingsList) {
      const result = await this.addTrainingToUser(userId, roleTraining.trainingId, allocatedBy);
      if (result.isNew) {
        trainingsEnrolled++;
      }
    }

    return { assessmentsCreated, trainingsEnrolled };
  }

  // Catches up every active user already in a job role when that role's required elements or
  // trainings change - runs the same additive assignJobRoleToUser logic used by the manual
  // per-user "sync" button, but for everyone in the role at once. Additive only: it creates
  // assessments/enrollments for newly-required items but never removes one for a requirement
  // that was taken away, since an auto-assigned placeholder can't currently be distinguished
  // from a real recorded "not yet competent" outcome - removing a requirement doesn't retroactively
  // erase a candidate's existing assessment history.
  async syncRoleRequirementsToUsers(roleId: string, allocatedBy?: string): Promise<{ usersSynced: number; assessmentsCreated: number; trainingsEnrolled: number }> {
    const usersInRole = await db.select().from(users).where(and(eq(users.jobRoleId, roleId), eq(users.isActive, true)));

    let assessmentsCreated = 0;
    let trainingsEnrolled = 0;
    for (const roleUser of usersInRole) {
      const result = await this.assignJobRoleToUser(roleUser.id, roleId, allocatedBy);
      assessmentsCreated += result.assessmentsCreated;
      trainingsEnrolled += result.trainingsEnrolled;
    }

    return { usersSynced: usersInRole.length, assessmentsCreated, trainingsEnrolled };
  }

  async addCompetenceElementToUser(userId: string, elementId: string, assessorId?: string, levelId?: string): Promise<Assessment> {
    // Check if assessment already exists for this element and level combination
    const existingAssessments = await this.getAssessments(userId, undefined, elementId);
    const existingMatch = existingAssessments.find(a => a.levelId === (levelId || null));
    
    if (existingMatch) {
      return existingMatch;
    }

    // Create new assessment
    const assessorComment = levelId 
      ? 'Manually assigned competence element with level'
      : 'Manually assigned competence element';
    
    return await this.createAssessment({
      candidateId: userId,
      elementId: elementId,
      assessorId: assessorId || 'unassigned',
      outcome: 'not_yet_competent',
      assessmentMethods: [],
      assessorComments: assessorComment,
      levelId: levelId || undefined,
      isAssignment: true,
      origin: 'manual_assignment',
    });
  }

  async addTrainingToUser(userId: string, trainingId: string, allocatedBy?: string): Promise<{ enrollment: TrainingEnrollment; isNew: boolean }> {
    // Check if training enrollment already exists
    const existingEnrollments = await this.getTrainingEnrollments(userId, trainingId);
    
    if (existingEnrollments.length > 0) {
      return { enrollment: existingEnrollments[0], isNew: false };
    }

    // Create new training enrollment
    const newEnrollment = await this.createTrainingEnrollment({
      userId: userId,
      trainingId: trainingId,
      allocatedBy: allocatedBy,
      status: 'allocated',
      allocatedDate: new Date(),
    });
    
    return { enrollment: newEnrollment, isNew: true };
  }

  // Historical Data Import operations
  async processHistoricalImport(importData: Array<{
    userName: string;
    email?: string;
    userRole: string;
    location?: string;
    teamShift?: string;
    jobRoleName?: string;
    dateOfBirth?: Date;
    companyNumber?: string;
    competenceCategoryName?: string;
    competenceElementName?: string;
    assessmentOutcome?: string;
    assessorName?: string;
    assessmentDate?: Date;
    validityYears?: number;
    expiryDate?: Date;
    trainingName?: string;
    trainingCompletionDate?: Date;
    trainingExpiryDate?: Date;
  }>, importedBy: string): Promise<{
    success: number;
    errors: Array<{ row: number; error: string }>;
    usersCreated: number;
    usersUpdated: number;
    assessmentsCreated: number;
    assessmentsUpdated: number;
    trainingCompletionsCreated: number;
    trainingCompletionsUpdated: number;
  }> {
    const errors: Array<{ row: number; error: string }> = [];
    const usersCreated = new Set<string>();
    const usersUpdated = new Set<string>();
    let assessmentsCreated = 0;
    let assessmentsUpdated = 0;
    let trainingCompletionsCreated = 0;
    let trainingCompletionsUpdated = 0;

    for (let i = 0; i < importData.length; i++) {
      const row = importData[i];
      const rowNumber = i + 2; // Excel row number (header is row 1)

      try {
        // 1. Parse user name (split into first and last)
        const nameParts = row.userName.trim().split(' ');
        if (nameParts.length < 2) {
          errors.push({ row: rowNumber, error: `Invalid user name format: "${row.userName}". Expected "FirstName LastName"` });
          continue;
        }
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        // 2. Normalize role
        const normalizedRole = this.normalizeRole(row.userRole);

        // 3. Identity - prefer the real email column so re-importing the same person (even
        // across multiple rows for their different achievements) resolves to one account and
        // updates it, rather than colliding same-named people or leaving a fake @imported.local
        // address nobody can log in with. Falls back to the old synthetic email only when no
        // real email is given, for backward compatibility with older import files.
        const email = row.email?.trim() || `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@imported.local`;

        // 4. Look up job role if provided (needed whether creating or updating)
        let jobRoleId: string | undefined;
        if (row.jobRoleName) {
          const jobRole = await this.getJobRoleByName(row.jobRoleName);
          if (!jobRole) {
            errors.push({ row: rowNumber, error: `Job role not found: "${row.jobRoleName}"` });
            continue;
          }
          jobRoleId = jobRole.id;
        }

        // 5. Look up or create/update user
        let user = await this.getUserByEmail(email);
        if (!user) {
          user = await this.createUser({
            firstName,
            lastName,
            email,
            role: normalizedRole,
            location: row.location,
            teamShift: row.teamShift,
            jobRoleId,
            dateOfBirth: row.dateOfBirth,
            companyNumber: row.companyNumber,
          });
          usersCreated.add(user.id);
        } else {
          // Only update fields actually provided on this row, so a later row for the same
          // person with blank profile columns doesn't blank out data captured earlier.
          const updates: Partial<InsertUser> = {};
          if (row.location) updates.location = row.location;
          if (row.teamShift) updates.teamShift = row.teamShift;
          if (jobRoleId) updates.jobRoleId = jobRoleId;
          if (row.dateOfBirth) updates.dateOfBirth = row.dateOfBirth;
          if (row.companyNumber) updates.companyNumber = row.companyNumber;
          if (Object.keys(updates).length > 0) {
            user = (await this.updateUser(user.id, updates)) || user;
            usersUpdated.add(user.id);
          }
        }

        // 6. Competence achievement - optional per row, so a row can carry just a training
        // completion, just a competence outcome, both, or just a profile update.
        if (row.competenceCategoryName && row.competenceElementName) {
          const category = await this.getCompetencyCategoryByName(row.competenceCategoryName);
          if (!category) {
            errors.push({ row: rowNumber, error: `Competence category not found: "${row.competenceCategoryName}"` });
            continue;
          }
          const element = await this.getCompetencyElementByName(category.id, row.competenceElementName);
          if (!element) {
            errors.push({ row: rowNumber, error: `Competence element not found: "${row.competenceElementName}" in category "${row.competenceCategoryName}"` });
            continue;
          }
          if (!row.assessorName) {
            errors.push({ row: rowNumber, error: `Assessor is required when a Competence Element is provided` });
            continue;
          }
          const assessorNameParts = row.assessorName.trim().split(' ');
          if (assessorNameParts.length < 2) {
            errors.push({ row: rowNumber, error: `Invalid assessor name format: "${row.assessorName}". Expected "FirstName LastName"` });
            continue;
          }
          const assessorFirstName = assessorNameParts[0];
          const assessorLastName = assessorNameParts.slice(1).join(' ');
          const assessorEmail = `${assessorFirstName.toLowerCase()}.${assessorLastName.toLowerCase().replace(/\s+/g, '')}@imported.local`;
          let assessor = await this.getUserByEmail(assessorEmail);
          if (!assessor) {
            assessor = await this.createUser({
              firstName: assessorFirstName,
              lastName: assessorLastName,
              email: assessorEmail,
              role: 'assessor',
            });
            usersCreated.add(assessor.id);
          }

          let outcome = 'competent';
          if (row.assessmentOutcome) {
            const normalizedOutcome = row.assessmentOutcome.trim().toLowerCase().replace(/\s+/g, '_');
            if (!['competent', 'not_yet_competent', 'competent_with_minor_needs'].includes(normalizedOutcome)) {
              errors.push({ row: rowNumber, error: `Invalid Assessment Outcome: "${row.assessmentOutcome}". Expected Competent, Not Yet Competent, or Competent with Minor Needs` });
              continue;
            }
            outcome = normalizedOutcome;
          }

          if (!row.assessmentDate || isNaN(row.assessmentDate.getTime())) {
            errors.push({ row: rowNumber, error: `A valid Assessment Date is required when a Competence Element is provided` });
            continue;
          }

          // Upsert on (candidate, element) - re-running an import (e.g. after fixing earlier
          // row errors) updates the existing historical record instead of duplicating it.
          const existingAssessments = await db.select().from(assessments).where(and(
            eq(assessments.candidateId, user.id),
            eq(assessments.elementId, element.id),
            eq(assessments.isActive, true)
          ));
          if (existingAssessments[0]) {
            await this.updateAssessment(existingAssessments[0].id, {
              assessorId: assessor.id,
              assessmentDate: row.assessmentDate,
              outcome,
              expiryDate: row.expiryDate,
              assessorComments: 'Imported from legacy system',
            });
            assessmentsUpdated++;
          } else {
            await this.createAssessment({
              candidateId: user.id,
              elementId: element.id,
              assessorId: assessor.id,
              assessmentDate: row.assessmentDate,
              outcome,
              assessmentMethods: [],
              assessorComments: 'Imported from legacy system',
              expiryDate: row.expiryDate,
            });
            assessmentsCreated++;
          }
        }

        // 7. Training achievement - optional per row, matched against an existing training
        // course by exact name (doesn't create new courses, same philosophy as competence
        // elements above - the source-of-truth training catalogue must already exist).
        if (row.trainingName) {
          const training = await this.getTrainingByName(row.trainingName);
          if (!training) {
            errors.push({ row: rowNumber, error: `Training course not found: "${row.trainingName}"` });
            continue;
          }
          if (!row.trainingCompletionDate || isNaN(row.trainingCompletionDate.getTime())) {
            errors.push({ row: rowNumber, error: `A valid Training Completion Date is required when a Training Course is provided` });
            continue;
          }

          const existingEnrollments = await db.select().from(trainingEnrollments).where(and(
            eq(trainingEnrollments.userId, user.id),
            eq(trainingEnrollments.trainingId, training.id),
            eq(trainingEnrollments.isActive, true)
          ));
          if (existingEnrollments[0]) {
            await this.updateTrainingEnrollment(existingEnrollments[0].id, {
              status: 'completed',
              achievementDate: row.trainingCompletionDate,
              expiryDate: row.trainingExpiryDate,
            });
            trainingCompletionsUpdated++;
          } else {
            await this.createTrainingEnrollment({
              userId: user.id,
              trainingId: training.id,
              allocatedBy: importedBy,
              status: 'completed',
              achievementDate: row.trainingCompletionDate,
              expiryDate: row.trainingExpiryDate,
            });
            trainingCompletionsCreated++;
          }
        }

      } catch (error: any) {
        errors.push({ row: rowNumber, error: error.message });
      }
    }

    return {
      success: importData.length - errors.length,
      errors,
      usersCreated: usersCreated.size,
      usersUpdated: usersUpdated.size,
      assessmentsCreated,
      assessmentsUpdated,
      trainingCompletionsCreated,
      trainingCompletionsUpdated,
    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(
      and(eq(users.email, email), eq(users.isActive, true))
    );
    return result[0];
  }

  async getCompetencyCategoryByName(name: string): Promise<CompetencyCategory | undefined> {
    const result = await db.select().from(competencyCategories).where(
      and(eq(competencyCategories.name, name), eq(competencyCategories.isActive, true))
    );
    return result[0];
  }

  async getCompetencyElementByName(categoryId: string, name: string): Promise<CompetencyElement | undefined> {
    const result = await db.select().from(competencyElements).where(
      and(
        eq(competencyElements.categoryId, categoryId),
        eq(competencyElements.name, name),
        eq(competencyElements.isActive, true)
      )
    );
    return result[0];
  }

  async getJobRoleByName(name: string): Promise<JobRole | undefined> {
    // Try exact match first
    let result = await db.select().from(jobRoles).where(
      and(eq(jobRoles.name, name), eq(jobRoles.isActive, true))
    );
    
    if (result.length > 0) {
      return result[0];
    }

    // Try matching with code in parentheses (e.g., "Electrical Technician (EL01)")
    const match = name.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (match) {
      const [, roleName, roleCode] = match;
      result = await db.select().from(jobRoles).where(
        and(
          eq(jobRoles.code, roleCode.trim()),
          eq(jobRoles.isActive, true)
        )
      );
      
      if (result.length > 0) {
        return result[0];
      }
    }

    return undefined;
  }

  async getTrainingByName(name: string): Promise<Training | undefined> {
    const result = await db.select().from(trainings).where(
      and(eq(trainings.name, name), eq(trainings.isActive, true))
    );
    return result[0];
  }

  async bulkAssignJobRole(userIds: string[], roleId: string, allocatedBy: string): Promise<{
    successful: number;
    failed: Array<{ userId: string; error: string }>;
    totalAssessmentsCreated: number;
  }> {
    const failed: Array<{ userId: string; error: string }> = [];
    let successful = 0;
    let totalAssessmentsCreated = 0;

    for (const userId of userIds) {
      try {
        // Update user's job role
        const user = await this.getUser(userId);
        if (!user) {
          failed.push({ userId, error: "User not found" });
          continue;
        }

        await this.updateUser(userId, { jobRoleId: roleId });
        
        // Auto-assign competence elements for this role
        const result = await this.assignJobRoleToUser(userId, roleId, allocatedBy);
        totalAssessmentsCreated += result.assessmentsCreated;
        successful++;
      } catch (error: any) {
        failed.push({ userId, error: error.message });
      }
    }

    return {
      successful,
      failed,
      totalAssessmentsCreated,
    };
  }

  async bulkAssignCompetenceElement(userIds: string[], elementId: string, assessorId: string, levelId?: string): Promise<{
    successful: number;
    failed: Array<{ userId: string; error: string }>;
    totalAssessmentsCreated: number;
  }> {
    const failed: Array<{ userId: string; error: string }> = [];
    let successful = 0;
    let totalAssessmentsCreated = 0;

    for (const userId of userIds) {
      try {
        const user = await this.getUser(userId);
        if (!user) {
          failed.push({ userId, error: "User not found" });
          continue;
        }

        await this.addCompetenceElementToUser(userId, elementId, assessorId, levelId);
        totalAssessmentsCreated++;
        successful++;
      } catch (error: any) {
        failed.push({ userId, error: error.message });
      }
    }

    return {
      successful,
      failed,
      totalAssessmentsCreated,
    };
  }

  async bulkAssignTraining(userIds: string[], trainingId: string, allocatedBy: string): Promise<{
    successful: number;
    skipped: number;
    failed: Array<{ userId: string; error: string }>;
    totalEnrollmentsCreated: number;
  }> {
    const failed: Array<{ userId: string; error: string }> = [];
    let successful = 0;
    let skipped = 0;
    let totalEnrollmentsCreated = 0;

    for (const userId of userIds) {
      try {
        const user = await this.getUser(userId);
        if (!user) {
          failed.push({ userId, error: "User not found" });
          continue;
        }

        const result = await this.addTrainingToUser(userId, trainingId, allocatedBy);
        if (result.isNew) {
          totalEnrollmentsCreated++;
          successful++;
        } else {
          skipped++;
        }
      } catch (error: any) {
        failed.push({ userId, error: error.message });
      }
    }

    return {
      successful,
      skipped,
      failed,
      totalEnrollmentsCreated,
    };
  }

  async getCompetencyMatrix(jobRoleId?: string, competencyId?: string): Promise<CompetencyMatrix[]> {
    // Legacy table - we now use role_elements for job role assignments
    // Return empty array to prevent errors
    return [];
  }

  async createCompetencyMatrix(matrix: InsertCompetencyMatrix): Promise<CompetencyMatrix> {
    const result = await db.insert(competencyMatrix).values(matrix).returning();
    return result[0];
  }

  async updateCompetencyMatrix(id: string, matrix: Partial<InsertCompetencyMatrix>): Promise<CompetencyMatrix | undefined> {
    const result = await db.update(competencyMatrix).set(matrix).where(eq(competencyMatrix.id, id)).returning();
    return result[0];
  }

  async deleteCompetencyMatrix(id: string): Promise<boolean> {
    const result = await db.delete(competencyMatrix).where(eq(competencyMatrix.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getCompetencyCertifications(userId?: string, competencyId?: string): Promise<CompetencyCertification[]> {
    throw new Error("Method not implemented");
  }

  async getCompetencyCertification(id: string): Promise<CompetencyCertification | undefined> {
    throw new Error("Method not implemented");
  }

  async createCompetencyCertification(certification: InsertCompetencyCertification): Promise<CompetencyCertification> {
    throw new Error("Method not implemented");
  }

  async updateCompetencyCertification(id: string, certification: Partial<InsertCompetencyCertification>): Promise<CompetencyCertification | undefined> {
    throw new Error("Method not implemented");
  }

  async deleteCompetencyCertification(id: string): Promise<boolean> {
    throw new Error("Method not implemented");
  }

  async getExpiringCertifications(days?: number): Promise<CompetencyCertification[]> {
    throw new Error("Method not implemented");
  }

  async getExpiryAlerts(userId?: string): Promise<ExpiryAlert[]> {
    throw new Error("Method not implemented");
  }

  async createExpiryAlert(alert: InsertExpiryAlert): Promise<ExpiryAlert> {
    throw new Error("Method not implemented");
  }

  async markAlertAsRead(id: string): Promise<boolean> {
    throw new Error("Method not implemented");
  }

  async deleteExpiryAlert(id: string): Promise<boolean> {
    throw new Error("Method not implemented");
  }

  async generateExpiryAlerts(): Promise<ExpiryAlert[]> {
    throw new Error("Method not implemented");
  }

  async getTrainingCategories(): Promise<TrainingCategory[]> {
    return await db.select().from(trainingCategories).where(eq(trainingCategories.isActive, true));
  }

  async getTrainingCategory(id: string): Promise<TrainingCategory | undefined> {
    const result = await db.select().from(trainingCategories).where(eq(trainingCategories.id, id));
    return result[0];
  }

  async createTrainingCategory(category: InsertTrainingCategory): Promise<TrainingCategory> {
    const result = await db.insert(trainingCategories).values(category).returning();
    return result[0];
  }

  async updateTrainingCategory(id: string, category: Partial<InsertTrainingCategory>): Promise<TrainingCategory | undefined> {
    const result = await db.update(trainingCategories).set(category).where(eq(trainingCategories.id, id)).returning();
    return result[0];
  }

  async deleteTrainingCategory(id: string): Promise<boolean> {
    const result = await db.update(trainingCategories).set({ isActive: false }).where(eq(trainingCategories.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getTrainings(categoryId?: string): Promise<Training[]> {
    if (categoryId) {
      return await db.select().from(trainings).where(and(
        eq(trainings.categoryId, categoryId),
        eq(trainings.isActive, true)
      ));
    }
    return await db.select().from(trainings).where(eq(trainings.isActive, true));
  }

  async getTraining(id: string): Promise<Training | undefined> {
    const result = await db.select().from(trainings).where(eq(trainings.id, id));
    return result[0];
  }

  async createTraining(training: InsertTraining): Promise<Training> {
    const result = await db.insert(trainings).values(training).returning();
    return result[0];
  }

  async updateTraining(id: string, training: Partial<InsertTraining>): Promise<Training | undefined> {
    const result = await db.update(trainings).set(training).where(eq(trainings.id, id)).returning();
    return result[0];
  }

  async deleteTraining(id: string): Promise<boolean> {
    const result = await db.update(trainings).set({ isActive: false }).where(eq(trainings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getTrainingLevels(trainingId?: string): Promise<TrainingLevel[]> {
    throw new Error("Method not implemented");
  }

  async getTrainingLevel(id: string): Promise<TrainingLevel | undefined> {
    throw new Error("Method not implemented");
  }

  async createTrainingLevel(level: InsertTrainingLevel): Promise<TrainingLevel> {
    throw new Error("Method not implemented");
  }

  async updateTrainingLevel(id: string, level: Partial<InsertTrainingLevel>): Promise<TrainingLevel | undefined> {
    throw new Error("Method not implemented");
  }

  async deleteTrainingLevel(id: string): Promise<boolean> {
    throw new Error("Method not implemented");
  }

  async getTrainingCertificates(userId?: string, trainingId?: string): Promise<TrainingCertificate[]> {
    throw new Error("Method not implemented");
  }

  async getTrainingCertificate(id: string): Promise<TrainingCertificate | undefined> {
    throw new Error("Method not implemented");
  }

  async createTrainingCertificate(certificate: InsertTrainingCertificate): Promise<TrainingCertificate> {
    throw new Error("Method not implemented");
  }

  async updateTrainingCertificate(id: string, certificate: Partial<InsertTrainingCertificate>): Promise<TrainingCertificate | undefined> {
    throw new Error("Method not implemented");
  }

  async deleteTrainingCertificate(id: string): Promise<boolean> {
    throw new Error("Method not implemented");
  }

  async getExpiringTrainingCertificates(days?: number): Promise<TrainingCertificate[]> {
    throw new Error("Method not implemented");
  }

  async getTrainingRecordsWithStatus(userId?: string): Promise<Array<TrainingCertificate & { trainingName: string; status: 'green' | 'amber' | 'red' | 'unknown' }>> {
    throw new Error("Method not implemented");
  }

  async updateTrainingCertificateDates(id: string, achievementDate?: Date, expiryDate?: Date): Promise<TrainingCertificate | undefined> {
    throw new Error("Method not implemented");
  }

  async getCompetenciesWithDetails(filters?: { categoryId?: string; elementId?: string; jobRoleId?: string }): Promise<CompetencyWithDetails[]> {
    throw new Error("Method not implemented");
  }

  async importCompetenceStandards(rows: ExcelImportRow[]): Promise<ExcelImportResult> {
    console.log(`[IMPORT DEBUG] Starting import with ${rows.length} rows`);
    const result: ExcelImportResult = {
      successCount: 0,
      errorCount: 0,
      errors: [],
      warnings: []
    };

    // Track created categories, elements, and levels to avoid duplicates
    const createdCategories = new Map<string, string>();
    const createdElements = new Map<string, string>();
    const createdSubcategories = new Map<string, string>();
    const createdLevels = new Map<string, string>();

    // Get all existing codes (including deleted ones) to avoid conflicts
    const existingCategoryCodes = new Set(
      (await db.select({ code: competencyCategories.code }).from(competencyCategories))
        .map(c => c.code)
    );
    const existingElementCodes = new Set(
      (await db.select({ code: competencyElements.code }).from(competencyElements))
        .map(e => e.code)
    );

    // Helper function to generate unique category code
    const generateCategoryCode = (name: string): string => {
      const cleaned = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const prefix = cleaned.substring(0, 3) || 'CAT';
      let counter = 1;
      let code = `${prefix}${counter}`;
      while (existingCategoryCodes.has(code)) {
        counter++;
        code = `${prefix}${counter}`;
      }
      existingCategoryCodes.add(code); // Mark as used
      return code;
    };

    // Helper function to generate unique element code
    const generateElementCode = (categoryCode: string, name: string): string => {
      const cleaned = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const prefix = cleaned.substring(0, 2) || 'EL';
      let counter = 1;
      let code = `${categoryCode}_${prefix}${counter}`;
      while (existingElementCodes.has(code)) {
        counter++;
        code = `${categoryCode}_${prefix}${counter}`;
      }
      existingElementCodes.add(code); // Mark as used
      return code;
    };

    for (const row of rows) {
      try {
        console.log(`[IMPORT DEBUG] Processing row for element: ${row.element}, level: ${row.levelTerm || 'none'}, criteria: ${row.description?.substring(0, 30)}...`);
        // 1. Create or find competency category
        const categoryKey = row.category.toLowerCase().trim();
        let categoryId = createdCategories.get(categoryKey);
        
        if (!categoryId) {
          // Check if ACTIVE category exists (deleted items stay deleted)
          const existingCategory = await db.select().from(competencyCategories)
            .where(and(
              eq(competencyCategories.name, row.category),
              eq(competencyCategories.isActive, true)
            ));
          
          if (existingCategory.length > 0) {
            // Use existing active category
            categoryId = existingCategory[0].id;
          } else {
            // Generate unique category code
            const categoryCode = generateCategoryCode(row.category);
            
            // Create new category (even if an inactive one exists with same name)
            const newCategory = await db.insert(competencyCategories).values({
              name: row.category,
              code: categoryCode,
              description: `Imported category: ${row.category}`,
              order: createdCategories.size + 1,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning();
            categoryId = newCategory[0].id;
          }
          createdCategories.set(categoryKey, categoryId);
        }

        // Get category code for element generation
        const categoryRecord = await db.select().from(competencyCategories)
          .where(eq(competencyCategories.id, categoryId))
          .limit(1);
        const categoryCode = categoryRecord[0]?.code || 'CAT';

        // 2. Create or find competency element
        const elementKey = `${categoryKey}-${row.element.toLowerCase().trim()}`;
        let elementId = createdElements.get(elementKey);
        
        if (!elementId) {
          // Check if ACTIVE element exists for this category (deleted items stay deleted)
          const existingElement = await db.select().from(competencyElements)
            .where(and(
              eq(competencyElements.categoryId, categoryId),
              eq(competencyElements.name, row.element),
              eq(competencyElements.isActive, true)
            ));
          
          if (existingElement.length > 0) {
            // Use existing active element
            elementId = existingElement[0].id;
          } else {
            // Generate element code
            const elementCode = generateElementCode(categoryCode, row.element);
            
            // Create new element (even if an inactive one exists with same name)
            const newElement = await db.insert(competencyElements).values({
              categoryId: categoryId,
              name: row.element,
              code: elementCode,
              description: `Imported element: ${row.element}`,
              order: createdElements.size + 1,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning();
            elementId = newElement[0].id;
          }
          createdElements.set(elementKey, elementId);
        }

        // 3. Create or find subcategory
        const subcategoryKey = `${elementKey}-${row.subcategory.toLowerCase().trim()}-${row.type}`;
        let subcategoryId = createdSubcategories.get(subcategoryKey);
        
        if (!subcategoryId) {
          // Check if subcategory exists for this element and type
          const existingSubcategory = await db.select().from(competenceSubcategories)
            .where(and(
              eq(competenceSubcategories.elementId, elementId),
              eq(competenceSubcategories.name, row.subcategory),
              eq(competenceSubcategories.type, row.type)
            ));
          
          if (existingSubcategory.length > 0) {
            subcategoryId = existingSubcategory[0].id;
          } else {
            // Create new subcategory (no code field required)
            const subcategoryOrder = Array.from(createdSubcategories.values()).length + 1;
            const newSubcategory = await db.insert(competenceSubcategories).values({
              elementId: elementId,
              name: row.subcategory,
              type: row.type,
              order: subcategoryOrder,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning();
            subcategoryId = newSubcategory[0].id;
          }
          createdSubcategories.set(subcategoryKey, subcategoryId);
        }

        // 4. Auto-create or find competency level (if proficiency levels > 1)
        let levelId: string | null = null;
        if (row.proficiencyLevels && parseInt(row.proficiencyLevels) > 1 && row.levelTerm) {
          // Create a unique key for tracking levels within this import
          const levelKey = `${elementId}-${row.levelTerm.toLowerCase().trim()}`;
          
          // Check if we already created this level in this import session
          if (createdLevels.has(levelKey)) {
            levelId = createdLevels.get(levelKey)!;
          } else {
            // Look up existing competency levels for this element
            const existingLevels = await db.select().from(competencyLevels)
              .where(and(
                eq(competencyLevels.elementId, elementId),
                eq(competencyLevels.isActive, true)
              ));
            
            // Find matching level by name (case-insensitive)
            const normalizedTerm = row.levelTerm.toLowerCase().trim();
            const matchingLevel = existingLevels.find(level => 
              level.name.toLowerCase().trim() === normalizedTerm
            );
            
            if (matchingLevel) {
              // Use existing level
              levelId = matchingLevel.id;
              createdLevels.set(levelKey, levelId);
            } else {
              // Auto-create the level with proper code generation
              const levelCode = row.levelTerm.substring(0, 3).toUpperCase() + (existingLevels.length + 1);
              const displayOrder = existingLevels.length + 1;
              
              const newLevel = await db.insert(competencyLevels).values({
                elementId: elementId,
                name: row.levelTerm,
                code: levelCode,
                description: `Auto-created from Excel import: ${row.levelTerm}`,
                order: displayOrder,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
              }).returning();
              
              levelId = newLevel[0].id;
              createdLevels.set(levelKey, levelId);
              console.log(`[IMPORT DEBUG] Auto-created level: ${row.levelTerm} with ID ${levelId}`);
            }
          }
        }

        // 5. Create competence criteria with level assignment
        const criteriaData: InsertCompetenceCriteria = {
          elementId: elementId,
          subcategoryId: subcategoryId,
          levelId: levelId,  // Link to proficiency level if multi-level element
          criteriaText: row.description, // V2: Use criteriaText instead of description
          type: row.type,
          assessorGuidance: row.assessorGuidance || null,
          criticalityRating: row.criticality || 'Medium', // Column I: Low/Medium/High
          assessmentMethods: row.assessmentMethods || null,
          required: row.required === 'M' // Column J: M = true, O = false
        };

        await this.createCompetenceCriteria(criteriaData);
        result.successCount++;
        console.log(`[IMPORT DEBUG] Successfully created criteria for ${row.element} (level: ${row.levelTerm || 'none'}). Total successes: ${result.successCount}`);

      } catch (error) {
        result.errorCount++;
        console.error(`[IMPORT DEBUG] Error processing row:`, error);
        result.errors.push({
          row: row.rowNumber || result.successCount + result.errorCount,
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }
    
    console.log(`[IMPORT DEBUG] Import complete. Successes: ${result.successCount}, Errors: ${result.errorCount}`);

    return result;
  }

  async getUserLanguagePreference(userId: string): Promise<UserLanguagePreference | undefined> {
    const result = await db.select().from(userLanguagePreferences).where(eq(userLanguagePreferences.userId, userId));
    return result[0];
  }

  async createOrUpdateUserLanguagePreference(userId: string, preferences: {
    primaryLanguage: string;
    fallbackLanguage: string;
    autoTranslate: boolean;
  }): Promise<UserLanguagePreference> {
    const result = await db.insert(userLanguagePreferences)
      .values({ userId, ...preferences })
      .onConflictDoUpdate({
        target: userLanguagePreferences.userId,
        set: { ...preferences, updatedAt: new Date() },
      })
      .returning();
    return result[0];
  }

  // Role Elements operations (element-level job role assignments)
  async getRoleElements(roleId?: string, elementId?: string): Promise<RoleElement[]> {
    let query = db.select().from(roleElements);
    
    if (roleId && elementId) {
      return await query.where(and(
        eq(roleElements.roleId, roleId),
        eq(roleElements.elementId, elementId),
        eq(roleElements.isActive, true)
      ));
    } else if (roleId) {
      return await query.where(and(
        eq(roleElements.roleId, roleId),
        eq(roleElements.isActive, true)
      ));
    } else if (elementId) {
      return await query.where(and(
        eq(roleElements.elementId, elementId),
        eq(roleElements.isActive, true)
      ));
    }
    
    return await query.where(eq(roleElements.isActive, true));
  }

  async getRoleElement(id: string): Promise<RoleElement | undefined> {
    const result = await db.select().from(roleElements).where(eq(roleElements.id, id));
    return result[0];
  }

  async createRoleElement(roleElement: InsertRoleElement): Promise<RoleElement> {
    const payload = { ...roleElement };
    if (payload.requirementLevel && payload.required === undefined) {
      payload.required = payload.requirementLevel !== 'D';
    }
    const result = await db.insert(roleElements).values(payload).returning();
    return result[0];
  }

  async updateRoleElement(id: string, roleElement: Partial<InsertRoleElement>): Promise<RoleElement | undefined> {
    const payload = { ...roleElement };
    if (payload.requirementLevel && payload.required === undefined) {
      payload.required = payload.requirementLevel !== 'D';
    }
    const result = await db.update(roleElements).set(payload).where(eq(roleElements.id, id)).returning();
    return result[0];
  }

  async deleteRoleElement(id: string): Promise<boolean> {
    const result = await db.update(roleElements).set({ isActive: false }).where(eq(roleElements.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // COMPETENCY LEVELS METHODS
  // ============================================================================

  async getCompetencyLevels(elementId?: string): Promise<CompetencyLevel[]> {
    if (elementId) {
      return await db.select().from(competencyLevels)
        .where(and(
          eq(competencyLevels.elementId, elementId),
          eq(competencyLevels.isActive, true)
        ))
        .orderBy(competencyLevels.order);
    }
    return await db.select().from(competencyLevels)
      .where(eq(competencyLevels.isActive, true))
      .orderBy(competencyLevels.order);
  }

  async getCompetencyLevel(id: string): Promise<CompetencyLevel | undefined> {
    const result = await db.select().from(competencyLevels).where(eq(competencyLevels.id, id));
    return result[0];
  }

  async createCompetencyLevel(level: InsertCompetencyLevel): Promise<CompetencyLevel> {
    const result = await db.insert(competencyLevels).values(level).returning();
    return result[0];
  }

  async updateCompetencyLevel(id: string, level: Partial<InsertCompetencyLevel>): Promise<CompetencyLevel | undefined> {
    const result = await db.update(competencyLevels).set(level).where(eq(competencyLevels.id, id)).returning();
    return result[0];
  }

  async deleteCompetencyLevel(id: string): Promise<boolean> {
    const result = await db.update(competencyLevels).set({ isActive: false }).where(eq(competencyLevels.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============================================================================
  // ROLE ELEMENT LEVELS METHODS
  // ============================================================================

  async getRoleElementLevels(roleId?: string, elementId?: string): Promise<(RoleElementLevel & { element: CompetencyElement; level: CompetencyLevel })[]> {
    let query = db.select({
      id: roleElementLevels.id,
      roleId: roleElementLevels.roleId,
      elementId: roleElementLevels.elementId,
      levelId: roleElementLevels.levelId,
      required: roleElementLevels.required,
      notes: roleElementLevels.notes,
      isActive: roleElementLevels.isActive,
      createdAt: roleElementLevels.createdAt,
      updatedAt: roleElementLevels.updatedAt,
      element: competencyElements,
      level: competencyLevels,
    })
    .from(roleElementLevels)
    .innerJoin(competencyElements, eq(roleElementLevels.elementId, competencyElements.id))
    .innerJoin(competencyLevels, eq(roleElementLevels.levelId, competencyLevels.id));

    if (roleId && elementId) {
      return await query.where(and(
        eq(roleElementLevels.roleId, roleId),
        eq(roleElementLevels.elementId, elementId),
        eq(roleElementLevels.isActive, true)
      ));
    } else if (roleId) {
      return await query.where(and(
        eq(roleElementLevels.roleId, roleId),
        eq(roleElementLevels.isActive, true)
      ));
    } else if (elementId) {
      return await query.where(and(
        eq(roleElementLevels.elementId, elementId),
        eq(roleElementLevels.isActive, true)
      ));
    }

    return await query.where(eq(roleElementLevels.isActive, true));
  }

  async getRoleElementLevel(id: string): Promise<RoleElementLevel | undefined> {
    const result = await db.select().from(roleElementLevels).where(eq(roleElementLevels.id, id));
    return result[0];
  }

  async createRoleElementLevel(roleElementLevel: InsertRoleElementLevel): Promise<RoleElementLevel> {
    const result = await db.insert(roleElementLevels).values(roleElementLevel).returning();
    return result[0];
  }

  async updateRoleElementLevel(id: string, roleElementLevel: Partial<InsertRoleElementLevel>): Promise<RoleElementLevel | undefined> {
    const result = await db.update(roleElementLevels).set(roleElementLevel).where(eq(roleElementLevels.id, id)).returning();
    return result[0];
  }

  async deleteRoleElementLevel(id: string): Promise<boolean> {
    const result = await db.update(roleElementLevels).set({ isActive: false }).where(eq(roleElementLevels.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async bulkCreateRoleElementLevels(roleElementLevels: InsertRoleElementLevel[]): Promise<RoleElementLevel[]> {
    if (roleElementLevels.length === 0) return [];
    const result = await db.insert(roleElementLevels).values(roleElementLevels).returning();
    return result;
  }

  async getRoleMatrix(roleId: string): Promise<{
    role: JobRole;
    elements: Array<{
      id: string;
      elementId: string;
      elementName: string;
      categoryId: string | null;
      categoryName: string | null;
      required: boolean;
      requirementLevel: string | null;
      activityType: string | null;
      validityYears: number | null;
      safetyCritical: boolean | null;
    }>;
  } | undefined> {
    const role = await this.getJobRole(roleId);
    if (!role) return undefined;

    // leftJoin (not inner) on category: an element with no valid category - e.g. one orphaned by
    // a past bug - must still show up here as "assigned", just without a category to group under,
    // rather than silently vanishing from the list because its category lookup failed.
    const elements = await db
      .select({
        id: roleElements.id,
        elementId: roleElements.elementId,
        elementName: competencyElements.name,
        categoryId: competencyElements.categoryId,
        categoryName: competencyCategories.name,
        required: roleElements.required,
        requirementLevel: roleElements.requirementLevel,
        activityType: roleElements.activityType,
        validityYears: roleElements.validityYears,
        safetyCritical: roleElements.safetyCritical,
      })
      .from(roleElements)
      .innerJoin(competencyElements, eq(roleElements.elementId, competencyElements.id))
      .leftJoin(competencyCategories, eq(competencyElements.categoryId, competencyCategories.id))
      .where(and(
        eq(roleElements.roleId, roleId),
        eq(roleElements.isActive, true)
      ))
      .orderBy(asc(competencyElements.name));

    return {
      role,
      elements,
    };
  }

  // Training-related methods continue below (do not close class here!)

  // ============================================================================
  // TRAINING PROVIDER METHODS
  // ============================================================================

  async getTrainingProviders(): Promise<TrainingProvider[]> {
    return await db.select().from(trainingProviders).where(eq(trainingProviders.isActive, true));
  }

  async getTrainingProvider(id: string): Promise<TrainingProvider | undefined> {
    const result = await db.select().from(trainingProviders).where(eq(trainingProviders.id, id));
    return result[0];
  }

  async createTrainingProvider(provider: InsertTrainingProvider): Promise<TrainingProvider> {
    const result = await db.insert(trainingProviders).values(provider).returning();
    return result[0];
  }

  async updateTrainingProvider(id: string, provider: Partial<InsertTrainingProvider>): Promise<TrainingProvider | undefined> {
    const result = await db.update(trainingProviders).set(provider).where(eq(trainingProviders.id, id)).returning();
    return result[0];
  }

  async deleteTrainingProvider(id: string): Promise<boolean> {
    const result = await db.update(trainingProviders).set({ isActive: false }).where(eq(trainingProviders.id, id));
    return result.rowCount > 0;
  }

  // Training Venues
  async getTrainingVenues(): Promise<TrainingVenue[]> {
    return await db.select().from(trainingVenues).where(eq(trainingVenues.isActive, true));
  }

  async getTrainingVenue(id: string): Promise<TrainingVenue | undefined> {
    const result = await db.select().from(trainingVenues).where(eq(trainingVenues.id, id));
    return result[0];
  }

  async createTrainingVenue(venue: InsertTrainingVenue): Promise<TrainingVenue> {
    const result = await db.insert(trainingVenues).values(venue).returning();
    return result[0];
  }

  async updateTrainingVenue(id: string, venue: Partial<InsertTrainingVenue>): Promise<TrainingVenue | undefined> {
    const result = await db.update(trainingVenues).set(venue).where(eq(trainingVenues.id, id)).returning();
    return result[0];
  }

  async deleteTrainingVenue(id: string): Promise<boolean> {
    const result = await db.update(trainingVenues).set({ isActive: false }).where(eq(trainingVenues.id, id));
    return result.rowCount > 0;
  }

  // External Training Courses
  async getExternalTrainingCourses(filters?: { query?: string; tag?: string; modality?: string; providerId?: string }): Promise<ExternalTrainingCourse[]> {
    const conditions: any[] = [eq(externalTrainingCourses.isActive, true)];

    if (filters?.query) {
      conditions.push(
        sql`(${externalTrainingCourses.title} ILIKE ${`%${filters.query}%`} OR ${externalTrainingCourses.description} ILIKE ${`%${filters.query}%`})`
      );
    }
    if (filters?.tag) {
      conditions.push(sql`${filters.tag} = ANY(${externalTrainingCourses.tags})`);
    }
    if (filters?.modality) {
      conditions.push(eq(externalTrainingCourses.modality, filters.modality));
    }
    if (filters?.providerId) {
      conditions.push(eq(externalTrainingCourses.providerId, filters.providerId));
    }

    return await db.select().from(externalTrainingCourses).where(and(...conditions)).orderBy(externalTrainingCourses.title).limit(200);
  }

  async getExternalTrainingCourse(id: string): Promise<ExternalTrainingCourse | undefined> {
    const result = await db.select().from(externalTrainingCourses).where(eq(externalTrainingCourses.id, id));
    return result[0];
  }

  async createExternalTrainingCourse(course: InsertExternalTrainingCourse): Promise<ExternalTrainingCourse> {
    const result = await db.insert(externalTrainingCourses).values(course).returning();
    return result[0];
  }

  async updateExternalTrainingCourse(id: string, course: Partial<InsertExternalTrainingCourse>): Promise<ExternalTrainingCourse | undefined> {
    const result = await db.update(externalTrainingCourses).set(course).where(eq(externalTrainingCourses.id, id)).returning();
    return result[0];
  }

  async deleteExternalTrainingCourse(id: string): Promise<boolean> {
    const result = await db.update(externalTrainingCourses).set({ isActive: false }).where(eq(externalTrainingCourses.id, id));
    return result.rowCount > 0;
  }

  // Course Training Sessions
  async getCourseTrainingSessions(filters?: { courseId?: string; upcoming?: boolean }): Promise<Array<CourseTrainingSession & { venueName?: string; city?: string; country?: string }>> {
    const conditions: any[] = [eq(courseTrainingSessions.isActive, true)];

    if (filters?.courseId) {
      conditions.push(eq(courseTrainingSessions.courseId, filters.courseId));
    }
    if (filters?.upcoming) {
      conditions.push(sql`${courseTrainingSessions.startAt} > NOW()`);
    }

    const results = await db
      .select({
        session: courseTrainingSessions,
        venueName: trainingVenues.name,
        city: trainingVenues.city,
        country: trainingVenues.country,
      })
      .from(courseTrainingSessions)
      .leftJoin(trainingVenues, eq(courseTrainingSessions.venueId, trainingVenues.id))
      .where(and(...conditions))
      .orderBy(courseTrainingSessions.startAt);

    return results.map(r => ({
      ...r.session,
      venueName: r.venueName || undefined,
      city: r.city || undefined,
      country: r.country || undefined,
    }));
  }

  async getCourseTrainingSession(id: string): Promise<CourseTrainingSession | undefined> {
    const result = await db.select().from(courseTrainingSessions).where(eq(courseTrainingSessions.id, id));
    return result[0];
  }

  async createCourseTrainingSession(session: InsertCourseTrainingSession): Promise<CourseTrainingSession> {
    const result = await db.insert(courseTrainingSessions).values(session).returning();
    return result[0];
  }

  async updateCourseTrainingSession(id: string, session: Partial<InsertCourseTrainingSession>): Promise<CourseTrainingSession | undefined> {
    const result = await db.update(courseTrainingSessions).set(session).where(eq(courseTrainingSessions.id, id)).returning();
    return result[0];
  }

  async deleteCourseTrainingSession(id: string): Promise<boolean> {
    const result = await db.update(courseTrainingSessions).set({ isActive: false }).where(eq(courseTrainingSessions.id, id));
    return result.rowCount > 0;
  }

  // Course Bookings
  async getCourseBookings(filters?: { userId?: string; sessionId?: string; status?: string }): Promise<Array<CourseBooking & { sessionInfo?: any; courseInfo?: any }>> {
    const conditions: any[] = [eq(courseBookings.isActive, true)];

    if (filters?.userId) {
      conditions.push(eq(courseBookings.userId, filters.userId));
    }
    if (filters?.sessionId) {
      conditions.push(eq(courseBookings.sessionId, filters.sessionId));
    }
    if (filters?.status) {
      conditions.push(eq(courseBookings.status, filters.status));
    }

    const results = await db
      .select({
        booking: courseBookings,
        session: courseTrainingSessions,
        course: externalTrainingCourses,
        venue: trainingVenues,
      })
      .from(courseBookings)
      .leftJoin(courseTrainingSessions, eq(courseBookings.sessionId, courseTrainingSessions.id))
      .leftJoin(externalTrainingCourses, eq(courseTrainingSessions.courseId, externalTrainingCourses.id))
      .leftJoin(trainingVenues, eq(courseTrainingSessions.venueId, trainingVenues.id))
      .where(and(...conditions))
      .orderBy(desc(courseBookings.createdAt));

    return results.map(r => ({
      ...r.booking,
      sessionInfo: r.session ? {
        ...r.session,
        venueName: r.venue?.name,
        city: r.venue?.city,
        country: r.venue?.country,
      } : undefined,
      courseInfo: r.course || undefined,
    }));
  }

  async getCourseBooking(id: string): Promise<CourseBooking | undefined> {
    const result = await db.select().from(courseBookings).where(eq(courseBookings.id, id));
    return result[0];
  }

  async createCourseBooking(booking: InsertCourseBooking): Promise<CourseBooking> {
    const result = await db.insert(courseBookings).values(booking).returning();
    return result[0];
  }

  async updateCourseBooking(id: string, booking: Partial<InsertCourseBooking>): Promise<CourseBooking | undefined> {
    const result = await db.update(courseBookings).set(booking).where(eq(courseBookings.id, id)).returning();
    return result[0];
  }

  async cancelCourseBooking(id: string): Promise<boolean> {
    const result = await db.update(courseBookings).set({ status: 'cancelled' }).where(eq(courseBookings.id, id));
    return result.rowCount > 0;
  }

  // Training Policy Matrix
  async getTrainingPolicyMatrixByRole(roleId: string): Promise<TrainingPolicyMatrix[]> {
    return await db.select().from(trainingPolicyMatrix).where(and(
      eq(trainingPolicyMatrix.jobRoleId, roleId),
      eq(trainingPolicyMatrix.isActive, true)
    ));
  }

  async getTrainingPolicyMatrix(id: string): Promise<TrainingPolicyMatrix | undefined> {
    const result = await db.select().from(trainingPolicyMatrix).where(eq(trainingPolicyMatrix.id, id));
    return result[0];
  }

  async createTrainingPolicyMatrix(policy: InsertTrainingPolicyMatrix): Promise<TrainingPolicyMatrix> {
    const result = await db.insert(trainingPolicyMatrix).values(policy).returning();
    return result[0];
  }

  async updateTrainingPolicyMatrix(id: string, policy: Partial<InsertTrainingPolicyMatrix>): Promise<TrainingPolicyMatrix | undefined> {
    const result = await db.update(trainingPolicyMatrix).set(policy).where(eq(trainingPolicyMatrix.id, id)).returning();
    return result[0];
  }

  async deleteTrainingPolicyMatrix(id: string): Promise<boolean> {
    const result = await db.update(trainingPolicyMatrix).set({ isActive: false }).where(eq(trainingPolicyMatrix.id, id));
    return result.rowCount > 0;
  }

  // Training Enrollment operations
  async getTrainingEnrollments(userId?: string, trainingId?: string): Promise<TrainingEnrollment[]> {
    const query = db.select().from(trainingEnrollments);
    
    if (userId && trainingId) {
      return await query.where(and(
        eq(trainingEnrollments.userId, userId),
        eq(trainingEnrollments.trainingId, trainingId),
        eq(trainingEnrollments.isActive, true)
      ));
    } else if (userId) {
      return await query.where(and(
        eq(trainingEnrollments.userId, userId),
        eq(trainingEnrollments.isActive, true)
      ));
    } else if (trainingId) {
      return await query.where(and(
        eq(trainingEnrollments.trainingId, trainingId),
        eq(trainingEnrollments.isActive, true)
      ));
    }
    
    return await query.where(eq(trainingEnrollments.isActive, true));
  }

  async getTrainingEnrollmentsWithDetails(userId: string): Promise<Array<TrainingEnrollment & { training: Training }>> {
    const rows = await db
      .select({ enrollment: trainingEnrollments, training: trainings })
      .from(trainingEnrollments)
      .leftJoin(trainings, eq(trainingEnrollments.trainingId, trainings.id))
      .where(and(
        eq(trainingEnrollments.userId, userId),
        eq(trainingEnrollments.isActive, true)
      ))
      .orderBy(asc(trainings.name));

    return rows
      .filter(r => r.training)
      .map(r => ({ ...r.enrollment, training: r.training! }));
  }

  async getTrainingEnrollment(id: string): Promise<TrainingEnrollment | undefined> {
    const result = await db.select().from(trainingEnrollments).where(eq(trainingEnrollments.id, id));
    return result[0];
  }

  async createTrainingEnrollment(enrollment: InsertTrainingEnrollment): Promise<TrainingEnrollment> {
    const result = await db.insert(trainingEnrollments).values(enrollment).returning();
    return result[0];
  }

  async updateTrainingEnrollment(id: string, enrollment: Partial<InsertTrainingEnrollment>): Promise<TrainingEnrollment | undefined> {
    const result = await db.update(trainingEnrollments).set(enrollment).where(eq(trainingEnrollments.id, id)).returning();
    return result[0];
  }

  async deleteTrainingEnrollment(id: string): Promise<boolean> {
    const result = await db.update(trainingEnrollments).set({ isActive: false }).where(eq(trainingEnrollments.id, id));
    return result.rowCount > 0;
  }

  // Candidate Allocation operations
  async getCandidateAllocations(assessorId?: string, candidateId?: string): Promise<any[]> {
    // Fetch allocations first
    let allocations: CandidateAllocation[];
    const query = db.select().from(candidateAllocations);
    
    if (assessorId && candidateId) {
      allocations = await query.where(and(
        eq(candidateAllocations.assessorId, assessorId),
        eq(candidateAllocations.candidateId, candidateId),
        eq(candidateAllocations.isActive, true)
      ));
    } else if (assessorId) {
      allocations = await query.where(and(
        eq(candidateAllocations.assessorId, assessorId),
        eq(candidateAllocations.isActive, true)
      ));
    } else if (candidateId) {
      allocations = await query.where(and(
        eq(candidateAllocations.candidateId, candidateId),
        eq(candidateAllocations.isActive, true)
      ));
    } else {
      allocations = await query.where(eq(candidateAllocations.isActive, true));
    }

    // Defensively collapse duplicate active rows for the same assessor+candidate pair (can
    // arise from independent creation paths racing) - an assessor should never see the same
    // candidate listed twice. Keep the most recently created row.
    const byPair = new Map<string, CandidateAllocation>();
    for (const a of allocations) {
      const key = `${a.assessorId}:${a.candidateId}`;
      const existing = byPair.get(key);
      if (!existing || (a.createdAt && existing.createdAt && a.createdAt > existing.createdAt)) {
        byPair.set(key, a);
      }
    }
    allocations = Array.from(byPair.values());

    // Enrich with user data
    const enrichedAllocations = await Promise.all(
      allocations.map(async (allocation) => {
        const candidateUsers = await db.select().from(users).where(eq(users.id, allocation.candidateId));
        const candidate = candidateUsers[0];
        const jobRole = candidate?.jobRoleId ? await this.getJobRole(candidate.jobRoleId) : undefined;

        return {
          ...allocation,
          candidateName: candidate ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() : null,
          candidateEmail: candidate?.email || null,
          location: candidate?.location || null,
          jobRoleId: candidate?.jobRoleId || null,
          jobRole: jobRole?.name || null,
        };
      })
    );
    
    return enrichedAllocations;
  }

  async getCandidateAllocation(id: string): Promise<CandidateAllocation | undefined> {
    const result = await db.select().from(candidateAllocations).where(eq(candidateAllocations.id, id));
    return result[0];
  }

  async createCandidateAllocation(allocation: InsertCandidateAllocation): Promise<CandidateAllocation> {
    const result = await db.insert(candidateAllocations).values(allocation).returning();
    return result[0];
  }

  async updateCandidateAllocation(id: string, allocation: Partial<InsertCandidateAllocation>): Promise<CandidateAllocation | undefined> {
    const result = await db.update(candidateAllocations).set(allocation).where(eq(candidateAllocations.id, id)).returning();
    return result[0];
  }

  async deleteCandidateAllocation(id: string): Promise<boolean> {
    const result = await db.update(candidateAllocations).set({ isActive: false }).where(eq(candidateAllocations.id, id));
    return result.rowCount > 0;
  }

  async getAssessorCandidates(assessorId: string): Promise<any[]> {
    const allocations = await this.getCandidateAllocations(assessorId);
    const candidateIds = allocations.map(a => a.candidateId);
    
    if (candidateIds.length === 0) return [];
    
    const candidates = await db.select().from(users).where(
      and(
        inArray(users.id, candidateIds),
        eq(users.isActive, true),
        eq(users.isArchived, false)
      )
    );
    
    // Enrich candidates with assessments and computed fields
    const enrichedCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        // Get ALL assessments for this candidate (including assignments and assessments by this assessor)
        // Assessors should see all element assignments that need to be assessed
        const candidateAssessments = await this.getAssessments(candidate.id);
        
        // Calculate overall progress and status based on signOffAt
        const totalAssessments = candidateAssessments.length;
        const completedAssessments = candidateAssessments.filter(a => a.signOffAt).length;
        const overallProgress = totalAssessments > 0 ? Math.round((completedAssessments / totalAssessments) * 100) : 0;
        
        let status: 'not_started' | 'in_progress' | 'completed' | 'overdue' = 'not_started';
        if (totalAssessments === 0) {
          status = 'not_started';
        } else if (completedAssessments === totalAssessments) {
          status = 'completed';
        } else if (completedAssessments > 0) {
          status = 'in_progress';
        } else {
          status = 'not_started';
        }
        
        return {
          id: candidate.id,
          name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email,
          role: candidate.role,
          department: candidate.location || '',
          avatar: undefined,
          assessments: candidateAssessments.map((a: any) => {
            // Get validity period from element - prefer months for precision
            const validityMonths = a.element?.validityMonths || a.element?.validityPeriod;
            const validityYears = a.element?.reassessmentYears;
            
            // Compute timeline dates using centralized utility
            // Respect stored expiryDate from historical imports
            const timeline = computeAssessmentTimeline({
              assignmentDate: a.assessmentDate,
              signOffAt: a.signOffAt,
              storedExpiryDate: a.expiryDate,
              validityMonths,
              validityYears,
            });
            
            // Determine assessment status based on completion and due date
            const isCompleted = !!timeline.assessedAt;
            let assessmentStatus: 'scheduled' | 'in_progress' | 'awaiting_review' | 'completed' | 'overdue' = 'scheduled';
            let progress = 0;
            
            if (isCompleted) {
              assessmentStatus = 'completed';
              progress = 100;
            } else if (timeline.dueDate && new Date(timeline.dueDate) < new Date()) {
              // Past due date and not completed
              assessmentStatus = 'overdue';
              progress = 0;
            } else {
              // Not completed and not overdue - consider it scheduled
              assessmentStatus = 'scheduled';
              progress = 0;
            }
            
            return {
              id: a.id,
              standardName: a.element?.name || 'Unknown',
              type: 'practical' as const,
              status: assessmentStatus,
              scheduledDate: a.plannedAssessmentDate || undefined,
              scheduledLocation: a.plannedAssessmentLocation || undefined,
              scheduledNotes: a.plannedAssessmentNotes || undefined,
              candidateReadyAt: a.candidateReadyAt || undefined,
              completedDate: timeline.assessedAt?.toISOString(),
              dueDate: timeline.dueDate?.toISOString(),
              progress,
              result: a.outcome === 'competent' ? 'competent' : a.outcome === 'not_yet_competent' ? 'not_yet_competent' : a.outcome === 'competent_with_minor_needs' ? 'training_needs' : undefined,
              evidence: [],
              observations: [],
              feedback: a.feedback,
              nextReviewDate: undefined,
            };
          }),
          overallProgress,
          status,
        };
      })
    );
    
    return enrichedCandidates;
  }

  // Assessment operations
  async getAssessments(candidateId?: string, assessorId?: string, elementId?: string): Promise<any[]> {
    const conditions: any[] = [
      eq(assessments.isActive, true),
      eq(competencyElements.isCurrent, true) // Only show current elements
    ];
    
    if (candidateId) conditions.push(eq(assessments.candidateId, candidateId));
    if (assessorId) conditions.push(eq(assessments.assessorId, assessorId));
    if (elementId) conditions.push(eq(assessments.elementId, elementId));
    
    const results = await db
      .select({
        assessment: assessments,
        element: competencyElements,
        level: competencyLevels,
      })
      .from(assessments)
      .leftJoin(competencyElements, eq(assessments.elementId, competencyElements.id))
      .leftJoin(competencyLevels, eq(assessments.levelId, competencyLevels.id))
      .where(and(...conditions))
      .orderBy(desc(assessments.assessmentDate));

    return results.map(r => ({
      ...r.assessment,
      element: r.element,
      level: r.level,
      elementName: r.element?.name, // Add flat elementName for Assessment Dashboard compatibility
    }));
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const result = await db.select().from(assessments).where(eq(assessments.id, id));
    return result[0];
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const result = await db.insert(assessments).values(assessment).returning();
    return result[0];
  }

  async updateAssessment(id: string, assessment: Partial<InsertAssessment>): Promise<Assessment | undefined> {
    // Any explicit outcome update means a real result has been recorded, not just a pending
    // role-assignment placeholder - clear isAssignment so downstream compliance aggregation
    // (hasRealOutcome, used by the Compliance Explorer/Executive Dashboard/Element 3 KPIs) picks
    // it up. updateAssessmentSignOff already does this for the normal assessor sign-off flow;
    // this covers the admin-side quick-edit path (AdminUsers' Edit Assessment dialog), which was
    // leaving isAssignment stuck at true even after a competent outcome was recorded.
    const updateData = assessment.outcome !== undefined && assessment.isAssignment === undefined
      ? { ...assessment, isAssignment: false }
      : assessment;
    const result = await db.update(assessments).set(updateData).where(eq(assessments.id, id)).returning();
    return result[0];
  }

  async updateAssessmentSignOff(id: string, signOffData: {
    outcome: string;
    knowledgeOutcomes?: string;
    performanceOutcomes?: string;
    overallComment?: string;
    assessmentMethods?: string[];
    signOffAssessorId: string;
    assessorScore?: number | null;
  }): Promise<Assessment | undefined> {
    // If this assessment was already signed off once, this is a renewal - snapshot the prior
    // cycle into assessment_expiry_history before it's overwritten below. This is what EI PSM
    // KPI 3.2b/c ("closeout timeliness") is computed from; see the schema comment on
    // assessmentExpiryHistory for why this can't be reconstructed after the fact.
    const current = await this.getAssessment(id);
    if (current?.signOffAt && current.outcome) {
      let previousExpiryDate: Date | null = current.expiryDate ? new Date(current.expiryDate) : null;
      if (!previousExpiryDate) {
        const element = await this.getCompetencyElement(current.elementId);
        previousExpiryDate = computeAssessmentTimeline({
          signOffAt: current.signOffAt,
          validityYears: element?.reassessmentYears ?? undefined,
          validityMonths: element?.validityMonths ?? element?.validityPeriod ?? undefined,
        }).expiryDate;
      }
      if (previousExpiryDate) {
        const renewalClosedAt = new Date();
        await db.insert(assessmentExpiryHistory).values({
          assessmentId: id,
          candidateId: current.candidateId,
          elementId: current.elementId,
          previousOutcome: current.outcome,
          previousSignOffAt: current.signOffAt,
          previousExpiryDate,
          renewalClosedAt,
          newOutcome: signOffData.outcome,
          wasBreach: renewalClosedAt.getTime() > previousExpiryDate.getTime(),
        });
      }
    }

    const result = await db.update(assessments).set({
      outcome: signOffData.outcome,
      knowledgeOutcomes: signOffData.knowledgeOutcomes,
      performanceOutcomes: signOffData.performanceOutcomes,
      overallComment: signOffData.overallComment,
      assessmentMethods: signOffData.assessmentMethods,
      signOffAssessorId: signOffData.signOffAssessorId,
      signOffAt: new Date(),
      isAssignment: false, // a real outcome has now been recorded - no longer just a pending placeholder
      ...(signOffData.assessorScore !== undefined ? { assessorScore: signOffData.assessorScore } : {}),
    }).where(eq(assessments.id, id)).returning();
    return result[0];
  }

  async deleteAssessment(id: string): Promise<boolean> {
    const result = await db.update(assessments).set({ isActive: false }).where(eq(assessments.id, id));
    return result.rowCount > 0;
  }

  // Resolves a user's proficiency level (e.g. Graduate Engineer/Engineer/Technical Authority) via
  // their job role's standardLevelId - there's no direct users->standardLevels link, only
  // users.jobRoleId -> jobRoles.standardLevelId -> standardLevels.
  async getUserStandardLevel(userId: string): Promise<StandardLevel | undefined> {
    const user = await this.getUser(userId);
    if (!user?.jobRoleId) return undefined;
    const role = await this.getJobRole(user.jobRoleId);
    if (!role?.standardLevelId) return undefined;
    const result = await db.select().from(standardLevels).where(eq(standardLevels.id, role.standardLevelId));
    return result[0];
  }

  async getCompetencyElementTargetScores(elementId: string): Promise<CompetencyElementTargetScore[]> {
    return await db.select().from(competencyElementTargetScores).where(eq(competencyElementTargetScores.elementId, elementId));
  }

  // Full replace: deletes any existing target scores for the element, then inserts the given set.
  async setCompetencyElementTargetScores(elementId: string, scores: { standardLevelId: string; targetScore: number }[]): Promise<CompetencyElementTargetScore[]> {
    return db.transaction(async (tx) => {
      await tx.delete(competencyElementTargetScores).where(eq(competencyElementTargetScores.elementId, elementId));
      if (scores.length === 0) return [];
      const result = await tx.insert(competencyElementTargetScores).values(
        scores.map(s => ({ elementId, standardLevelId: s.standardLevelId, targetScore: s.targetScore }))
      ).returning();
      return result;
    });
  }

  async getAssessmentKnowledgeAnswers(assessmentId: string): Promise<AssessmentKnowledgeAnswer[]> {
    return await db.select().from(assessmentKnowledgeAnswers).where(eq(assessmentKnowledgeAnswers.assessmentId, assessmentId));
  }

  // Grades MCQ answers against competenceCriteria.mcqCorrectAnswerIndex; open-ended answers (a
  // criterion with no mcqOptions) are stored as free text with isCorrect left null for the
  // assessor to review directly - they aren't auto-gradable. Replaces any prior attempt's answers
  // for this assessment. scorePercent is computed only over auto-graded (MCQ) answers - null if
  // the element's knowledge criteria are entirely open-ended, rather than a misleading 0%/100%.
  async submitKnowledgeSelfAssessment(assessmentId: string, answers: { criteriaId: string; selectedAnswerIndex?: number; answerText?: string }[]): Promise<{ scorePercent: number | null; answers: AssessmentKnowledgeAnswer[] }> {
    return db.transaction(async (tx) => {
      const criteriaIds = answers.map(a => a.criteriaId);
      const criteriaRows = criteriaIds.length > 0
        ? await tx.select().from(competenceCriteria).where(inArray(competenceCriteria.id, criteriaIds))
        : [];
      const criteriaById = new Map(criteriaRows.map(c => [c.id, c]));

      const graded = answers
        .map(a => {
          const criterion = criteriaById.get(a.criteriaId);
          const hasOptions = !!criterion?.mcqOptions?.length;
          if (hasOptions && a.selectedAnswerIndex !== undefined) {
            return {
              assessmentId,
              criteriaId: a.criteriaId,
              selectedAnswerIndex: a.selectedAnswerIndex,
              answerText: null,
              isCorrect: a.selectedAnswerIndex === criterion!.mcqCorrectAnswerIndex,
            };
          }
          if (a.answerText && a.answerText.trim()) {
            return {
              assessmentId,
              criteriaId: a.criteriaId,
              selectedAnswerIndex: null,
              answerText: a.answerText.trim(),
              isCorrect: null,
            };
          }
          return null;
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);

      await tx.delete(assessmentKnowledgeAnswers).where(eq(assessmentKnowledgeAnswers.assessmentId, assessmentId));
      const inserted = graded.length > 0
        ? await tx.insert(assessmentKnowledgeAnswers).values(graded).returning()
        : [];

      const gradable = inserted.filter(a => a.isCorrect !== null);
      const scorePercent = gradable.length > 0
        ? Math.round((gradable.filter(a => a.isCorrect).length / gradable.length) * 100)
        : null;

      await tx.update(assessments).set({
        selfAssessmentCompletedAt: new Date(),
        selfAssessmentScorePercent: scorePercent,
      }).where(eq(assessments.id, assessmentId));

      return { scorePercent, answers: inserted };
    });
  }

  async setAssessmentSelfScore(assessmentId: string, selfScore: number): Promise<Assessment | undefined> {
    const result = await db.update(assessments).set({
      selfScore,
      selfScoreAt: new Date(),
    }).where(eq(assessments.id, assessmentId)).returning();
    return result[0];
  }

  async getAssessmentsWithExpiry(assessorId?: string, candidateId?: string): Promise<Array<Assessment & { 
    candidateName: string; 
    elementName: string; 
    status: 'green' | 'amber' | 'red' | 'not_assessed';
    daysUntilExpiry?: number;
  }>> {
    const assessmentsList = await this.getAssessments(candidateId, assessorId);
    
    const result = await Promise.all(assessmentsList.map(async (assessment) => {
      const candidate = await this.getUser(assessment.candidateId);
      const element = await this.getCompetencyElement(assessment.elementId);
      
      const candidateName = candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Unknown';
      const elementName = element?.name || 'Unknown Element';
      
      let status: 'green' | 'amber' | 'red' | 'not_assessed' = 'not_assessed';
      let daysUntilExpiry: number | undefined;
      
      if (assessment.expiryDate) {
        const now = new Date();
        const expiry = new Date(assessment.expiryDate);
        daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          status = 'red'; // Expired
        } else if (daysUntilExpiry <= 90) {
          status = 'amber'; // Expiring within 90 days
        } else {
          status = 'green'; // Competent
        }
      }
      
      return { ...assessment, candidateName, elementName, status, daysUntilExpiry };
    }));
    
    // Sort by expiry date (soonest first)
    return result.sort((a, b) => {
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
  }

  // Assessment Evidence operations
  async getAssessmentEvidence(assessmentId?: string): Promise<AssessmentEvidence[]> {
    const query = db.select().from(assessmentEvidence);
    
    if (assessmentId) {
      return await query.where(and(
        eq(assessmentEvidence.assessmentId, assessmentId),
        eq(assessmentEvidence.isActive, true)
      ));
    }
    
    return await query.where(eq(assessmentEvidence.isActive, true));
  }

  async getAssessmentEvidenceItem(id: string): Promise<AssessmentEvidence | undefined> {
    const result = await db.select().from(assessmentEvidence).where(eq(assessmentEvidence.id, id));
    return result[0];
  }

  async createAssessmentEvidence(evidence: InsertAssessmentEvidence): Promise<AssessmentEvidence> {
    const result = await db.insert(assessmentEvidence).values(evidence).returning();
    return result[0];
  }

  async updateAssessmentEvidence(id: string, evidence: Partial<InsertAssessmentEvidence>): Promise<AssessmentEvidence | undefined> {
    const result = await db.update(assessmentEvidence).set(evidence).where(eq(assessmentEvidence.id, id)).returning();
    return result[0];
  }

  async deleteAssessmentEvidence(id: string): Promise<boolean> {
    const result = await db.update(assessmentEvidence).set({ isActive: false }).where(eq(assessmentEvidence.id, id));
    return result.rowCount > 0;
  }

  // Verifier Allocation operations
  async getVerifierAllocations(verifierId?: string, assessorId?: string): Promise<VerifierAllocation[]> {
    const query = db.select().from(verifierAllocations);
    
    if (verifierId && assessorId) {
      return await query.where(and(
        eq(verifierAllocations.verifierId, verifierId),
        eq(verifierAllocations.assessorId, assessorId),
        eq(verifierAllocations.isActive, true)
      ));
    } else if (verifierId) {
      return await query.where(and(
        eq(verifierAllocations.verifierId, verifierId),
        eq(verifierAllocations.isActive, true)
      ));
    } else if (assessorId) {
      return await query.where(and(
        eq(verifierAllocations.assessorId, assessorId),
        eq(verifierAllocations.isActive, true)
      ));
    }
    
    return await query.where(eq(verifierAllocations.isActive, true));
  }

  async getVerifierAllocation(id: string): Promise<VerifierAllocation | undefined> {
    const result = await db.select().from(verifierAllocations).where(eq(verifierAllocations.id, id));
    return result[0];
  }

  async createVerifierAllocation(allocation: InsertVerifierAllocation): Promise<VerifierAllocation> {
    const result = await db.insert(verifierAllocations).values(allocation).returning();
    return result[0];
  }

  async updateVerifierAllocation(id: string, allocation: Partial<InsertVerifierAllocation>): Promise<VerifierAllocation | undefined> {
    const result = await db.update(verifierAllocations).set(allocation).where(eq(verifierAllocations.id, id)).returning();
    return result[0];
  }

  async deleteVerifierAllocation(id: string): Promise<boolean> {
    const result = await db.update(verifierAllocations).set({ isActive: false }).where(eq(verifierAllocations.id, id));
    return result.rowCount > 0;
  }

  async getVerifierAssessors(verifierId: string): Promise<User[]> {
    const allocations = await this.getVerifierAllocations(verifierId);
    const assessorIds = allocations.map(a => a.assessorId);
    
    if (assessorIds.length === 0) return [];
    
    return await db.select().from(users).where(
      and(
        inArray(users.id, assessorIds),
        eq(users.isActive, true)
      )
    );
  }

  // Sampling Plan operations
  async getSamplingPlans(verifierId?: string, assessorId?: string): Promise<SamplingPlan[]> {
    const query = db.select().from(samplingPlans);
    
    if (verifierId && assessorId) {
      return await query.where(and(
        eq(samplingPlans.verifierId, verifierId),
        eq(samplingPlans.assessorId, assessorId),
        eq(samplingPlans.isActive, true)
      ));
    } else if (verifierId) {
      return await query.where(and(
        eq(samplingPlans.verifierId, verifierId),
        eq(samplingPlans.isActive, true)
      ));
    } else if (assessorId) {
      return await query.where(and(
        eq(samplingPlans.assessorId, assessorId),
        eq(samplingPlans.isActive, true)
      ));
    }
    
    return await query.where(eq(samplingPlans.isActive, true));
  }

  async getSamplingPlan(id: string): Promise<SamplingPlan | undefined> {
    const result = await db.select().from(samplingPlans).where(eq(samplingPlans.id, id));
    return result[0];
  }

  async createSamplingPlan(plan: InsertSamplingPlan): Promise<SamplingPlan> {
    const result = await db.insert(samplingPlans).values(plan).returning();
    return result[0];
  }

  async updateSamplingPlan(id: string, plan: Partial<InsertSamplingPlan>): Promise<SamplingPlan | undefined> {
    const result = await db.update(samplingPlans).set(plan).where(eq(samplingPlans.id, id)).returning();
    return result[0];
  }

  async deleteSamplingPlan(id: string): Promise<boolean> {
    const result = await db.update(samplingPlans).set({ isActive: false }).where(eq(samplingPlans.id, id));
    return result.rowCount > 0;
  }

  // Verification operations
  async getVerifications(assessmentId?: string, verifierId?: string): Promise<Verification[]> {
    const query = db.select().from(verifications);
    const conditions: any[] = [eq(verifications.isActive, true)];
    
    if (assessmentId) conditions.push(eq(verifications.assessmentId, assessmentId));
    if (verifierId) conditions.push(eq(verifications.verifierId, verifierId));
    
    return await query.where(and(...conditions)).orderBy(desc(verifications.verificationDate));
  }

  async getVerification(id: string): Promise<Verification | undefined> {
    const result = await db.select().from(verifications).where(eq(verifications.id, id));
    return result[0];
  }

  async createVerification(verification: InsertVerification): Promise<Verification> {
    const result = await db.insert(verifications).values(verification).returning();
    
    // Update assessment verification status
    if (verification.assessmentId) {
      await this.updateAssessment(verification.assessmentId, {
        verificationId: result[0].id,
        verificationStatus: 'verified'
      });
    }
    
    return result[0];
  }

  async updateVerification(id: string, verification: Partial<InsertVerification>): Promise<Verification | undefined> {
    const result = await db.update(verifications).set(verification).where(eq(verifications.id, id)).returning();
    return result[0];
  }

  async deleteVerification(id: string): Promise<boolean> {
    const result = await db.update(verifications).set({ isActive: false }).where(eq(verifications.id, id));
    return result.rowCount > 0;
  }

  async getUnverifiedAssessments(verifierId: string): Promise<Array<Assessment & { candidateName: string; elementName: string; assessorName: string }>> {
    // Get assessors allocated to this verifier
    const allocations = await this.getVerifierAllocations(verifierId);
    const assessorIds = allocations.map(a => a.assessorId);
    
    if (assessorIds.length === 0) return [];
    
    // Get all assessments from these assessors that are not yet verified
    const unverifiedAssessments: Array<Assessment & { candidateName: string; elementName: string; assessorName: string }> = [];
    
    for (const assessorId of assessorIds) {
      // signOffAt IS NOT NULL - only assessments the assessor has actually signed off, not the
      // assignment placeholder rows (isAssignment: true, no real assessment done yet) that make
      // up most of a candidate's assessment list. Those aren't verifiable; there's nothing there
      // yet.
      const assessmentsList = await db.select().from(assessments).where(
        and(
          eq(assessments.assessorId, assessorId),
          eq(assessments.verificationStatus, 'not_verified'),
          eq(assessments.isActive, true),
          sql`${assessments.signOffAt} IS NOT NULL`
        )
      );

      for (const assessment of assessmentsList) {
        const candidate = await this.getUser(assessment.candidateId);
        const element = await this.getCompetencyElement(assessment.elementId);
        const assessor = await this.getUser(assessment.assessorId);
        
        unverifiedAssessments.push({
          ...assessment,
          candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Unknown',
          elementName: element?.name || 'Unknown Element',
          assessorName: assessor ? `${assessor.firstName} ${assessor.lastName}` : 'Unknown'
        });
      }
    }
    
    return unverifiedAssessments;
  }

  async getVerificationStatistics(verifierId: string, assessorId?: string): Promise<{
    totalAssessments: number;
    verifiedCount: number;
    verificationPercentage: number;
    targetPercentage: number;
  }> {
    // Get target percentage from sampling plan
    let targetPercentage = 10; // Default 10%
    const plans = await this.getSamplingPlans(verifierId, assessorId);
    if (plans.length > 0) {
      targetPercentage = plans[0].targetPercentage;
    }
    
    // Get assessor IDs
    const allocations = assessorId 
      ? await this.getVerifierAllocations(verifierId, assessorId)
      : await this.getVerifierAllocations(verifierId);
    const assessorIds = assessorId ? [assessorId] : allocations.map(a => a.assessorId);
    
    if (assessorIds.length === 0) {
      return { totalAssessments: 0, verifiedCount: 0, verificationPercentage: 0, targetPercentage };
    }
    
    // Count total assessments - inArray, not a raw `= ANY(${array})` SQL fragment, which mangles
    // a single-element array into a bare unquoted string ("malformed array literal") since JS
    // stringifies a 1-item array as just that item with no braces. signOffAt IS NOT NULL excludes
    // assignment placeholder rows that haven't actually been assessed yet - see
    // getUnverifiedAssessments for the same filter.
    const totalAssessments = await db.select({ count: sql`count(*)` })
      .from(assessments)
      .where(
        and(
          inArray(assessments.assessorId, assessorIds),
          eq(assessments.isActive, true),
          sql`${assessments.signOffAt} IS NOT NULL`
        )
      );

    // Count verified assessments
    const verifiedAssessments = await db.select({ count: sql`count(*)` })
      .from(assessments)
      .where(
        and(
          inArray(assessments.assessorId, assessorIds),
          eq(assessments.verificationStatus, 'verified'),
          eq(assessments.isActive, true),
          sql`${assessments.signOffAt} IS NOT NULL`
        )
      );
    
    const total = Number(totalAssessments[0]?.count || 0);
    const verified = Number(verifiedAssessments[0]?.count || 0);
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
    
    return {
      totalAssessments: total,
      verifiedCount: verified,
      verificationPercentage: percentage,
      targetPercentage
    };
  }

  // Verifications completed on this assessor's own assessments (i.e. someone verified their
  // work), for the Assessor Dashboard's verification summary - filterable by date/candidate.
  async getVerificationsForAssessor(assessorId: string, filters?: { dateFrom?: Date; dateTo?: Date; candidateId?: string }): Promise<Array<Verification & {
    candidateId: string;
    candidateName: string;
    candidateLocation: string | null;
    elementName: string;
    verifierName: string;
  }>> {
    const conditions: any[] = [
      eq(verifications.isActive, true),
      eq(assessments.assessorId, assessorId),
    ];
    if (filters?.dateFrom) conditions.push(gte(verifications.verificationDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(verifications.verificationDate, filters.dateTo));
    if (filters?.candidateId) conditions.push(eq(assessments.candidateId, filters.candidateId));

    const rows = await db
      .select({ verification: verifications, assessment: assessments })
      .from(verifications)
      .innerJoin(assessments, eq(verifications.assessmentId, assessments.id))
      .where(and(...conditions))
      .orderBy(desc(verifications.verificationDate));

    return await Promise.all(rows.map(async (r) => {
      const candidate = await this.getUser(r.assessment.candidateId);
      const element = await this.getCompetencyElement(r.assessment.elementId);
      const verifier = await this.getUser(r.verification.verifierId);
      return {
        ...r.verification,
        candidateId: r.assessment.candidateId,
        candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Unknown',
        candidateLocation: candidate?.location || null,
        elementName: element?.name || 'Unknown Element',
        verifierName: verifier ? `${verifier.firstName} ${verifier.lastName}` : 'Unknown',
      };
    }));
  }

  // Everything the Internal Verifier's dashboard needs in one call: each allocated assessor with
  // their sampling rate vs target and a "recent activity" flag (signed off in the last 14 days,
  // regardless of verification status yet - this is the "warn me an assessment has happened"
  // requirement, not a verification-outstanding count, which assessorQueue already covers),
  // plus the quota-aware queue of what still needs sampling this quarter.
  async getVerifierDashboardSummary(verifierId: string): Promise<{
    assessors: Array<{ id: string; name: string; email: string; targetPercentage: number; totalAssessments: number; verifiedCount: number; verificationPercentage: number; recentActivityCount: number }>;
    assessorQueue: Array<{
      assessorId: string; assessorName: string; assessorEmail: string;
      targetPercentage: number; quotaMet: boolean; remainingNeeded: number; verifiedThisQuarter: number;
      candidates: Array<{
        candidateId: string; candidateName: string; priorVerificationCount: number;
        assessments: Array<{ id: string; elementId: string; elementName: string; assessmentDate: string | Date | null; outcome: string }>;
      }>;
    }>;
    verifiedThisMonth: number;
  }> {
    const allocations = await this.getVerifierAllocations(verifierId);
    const recentCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const now = new Date();
    const quarterIndex = Math.floor(now.getMonth() / 3);
    const quarterStart = new Date(now.getFullYear(), quarterIndex * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), quarterIndex * 3 + 3, 1);

    const assessorSummaries = await Promise.all(allocations.map(async (allocation) => {
      const assessor = await this.getUser(allocation.assessorId);
      const stats = await this.getVerificationStatistics(verifierId, allocation.assessorId);
      const recentActivity = await db.select({ count: sql`count(*)` })
        .from(assessments)
        .where(and(
          eq(assessments.assessorId, allocation.assessorId),
          eq(assessments.isActive, true),
          gte(assessments.signOffAt, recentCutoff)
        ));
      return {
        id: allocation.assessorId,
        name: assessor ? `${assessor.firstName} ${assessor.lastName}` : 'Unknown',
        email: assessor?.email || '',
        targetPercentage: stats.targetPercentage,
        totalAssessments: stats.totalAssessments,
        verifiedCount: stats.verifiedCount,
        verificationPercentage: stats.verificationPercentage,
        recentActivityCount: Number(recentActivity[0]?.count || 0),
      };
    }));

    // Quota-aware queue, grouped by assessor then candidate. "Verification take place quarterly -
    // once the target sampling rate is met for the quarter, remaining backlog stops being shown
    // (it's not required reading, not that it doesn't exist) rather than an ever-growing list."
    // requiredSampleCount is recomputed against (still-pending + already-verified-this-quarter),
    // so it naturally shrinks as the backlog is worked through and resets each new quarter (since
    // verifiedThisQuarter is a live query, not a stored counter).
    const assessorQueue = await Promise.all(allocations.map(async (allocation) => {
      const assessorId = allocation.assessorId;
      const assessor = await this.getUser(assessorId);
      const plans = await this.getSamplingPlans(verifierId, assessorId);
      const targetPercentage = plans.length > 0 ? plans[0].targetPercentage : 10;

      const pendingList = await db.select().from(assessments).where(and(
        eq(assessments.assessorId, assessorId),
        eq(assessments.verificationStatus, 'not_verified'),
        eq(assessments.isActive, true),
        sql`${assessments.signOffAt} IS NOT NULL`
      ));

      const verifiedThisQuarterRows = await db.select({ count: sql`count(*)` })
        .from(verifications)
        .innerJoin(assessments, eq(verifications.assessmentId, assessments.id))
        .where(and(
          eq(verifications.verifierId, verifierId),
          eq(assessments.assessorId, assessorId),
          eq(verifications.isActive, true),
          gte(verifications.verificationDate, quarterStart),
          sql`${verifications.verificationDate} < ${quarterEnd}`
        ));
      const verifiedThisQuarter = Number(verifiedThisQuarterRows[0]?.count || 0);

      const totalConsidered = pendingList.length + verifiedThisQuarter;
      const requiredSampleCount = Math.ceil((targetPercentage / 100) * totalConsidered);
      const remainingNeeded = Math.max(0, requiredSampleCount - verifiedThisQuarter);
      const quotaMet = remainingNeeded === 0;

      const byCandidate = new Map<string, typeof pendingList>();
      for (const a of pendingList) {
        if (!byCandidate.has(a.candidateId)) byCandidate.set(a.candidateId, []);
        byCandidate.get(a.candidateId)!.push(a);
      }

      const candidateEntries = await Promise.all(Array.from(byCandidate.entries()).map(async ([candidateId, candidateAssessments]) => {
        const candidate = await this.getUser(candidateId);
        const priorCountRows = await db.select({ count: sql`count(*)` })
          .from(verifications)
          .innerJoin(assessments, eq(verifications.assessmentId, assessments.id))
          .where(and(
            eq(verifications.verifierId, verifierId),
            eq(assessments.candidateId, candidateId),
            eq(verifications.isActive, true)
          ));
        const priorVerificationCount = Number(priorCountRows[0]?.count || 0);

        const withNames = await Promise.all(candidateAssessments.map(async (a) => ({
          id: a.id,
          elementId: a.elementId,
          elementName: (await this.getCompetencyElement(a.elementId))?.name || 'Unknown Element',
          assessmentDate: a.assessmentDate,
          outcome: a.outcome,
        })));
        withNames.sort((a, b) => new Date(a.assessmentDate || 0).getTime() - new Date(b.assessmentDate || 0).getTime());

        return {
          candidateId,
          candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Unknown',
          priorVerificationCount,
          assessments: withNames,
        };
      }));

      // Least-reviewed candidates first (never-verified candidates surface before ones already
      // sampled before), tie-broken by whoever has been waiting longest.
      candidateEntries.sort((a, b) => {
        if (a.priorVerificationCount !== b.priorVerificationCount) return a.priorVerificationCount - b.priorVerificationCount;
        const aOldest = new Date(a.assessments[0]?.assessmentDate || 0).getTime();
        const bOldest = new Date(b.assessments[0]?.assessmentDate || 0).getTime();
        return aOldest - bOldest;
      });

      // Once quota is met, stop selecting further candidates - but a candidate already selected
      // is shown in full (reviewing half a candidate's assessments is worse than a small overshoot
      // past the quota).
      const selectedCandidates: typeof candidateEntries = [];
      let remaining = remainingNeeded;
      if (!quotaMet) {
        for (const c of candidateEntries) {
          if (remaining <= 0) break;
          selectedCandidates.push(c);
          remaining -= c.assessments.length;
        }
      }

      return {
        assessorId,
        assessorName: assessor ? `${assessor.firstName} ${assessor.lastName}` : 'Unknown',
        assessorEmail: assessor?.email || '',
        targetPercentage,
        quotaMet,
        remainingNeeded,
        verifiedThisQuarter,
        candidates: selectedCandidates,
      };
    }));

    const assessorIds = allocations.map(a => a.assessorId);
    let verifiedThisMonth = 0;
    if (assessorIds.length > 0) {
      const monthRows = await db.select({ count: sql`count(*)` })
        .from(verifications)
        .innerJoin(assessments, eq(verifications.assessmentId, assessments.id))
        .where(and(
          eq(verifications.verifierId, verifierId),
          eq(verifications.isActive, true),
          gte(verifications.verificationDate, monthStart)
        ));
      verifiedThisMonth = Number(monthRows[0]?.count || 0);
    }

    return { assessors: assessorSummaries, assessorQueue, verifiedThisMonth };
  }

  async getElement3KpiReport(): Promise<Element3KpiReport> {
    const now = new Date();

    // ---------- Shared population pass: active users with a job role, and what's required of them ----------
    const inScopeUsers = await db.select().from(users).where(and(
      eq(users.isActive, true),
      this.notArchivedOrNotYetLeft(now),
      sql`${users.jobRoleId} IS NOT NULL`
    ));

    const roleIds = Array.from(new Set(inScopeUsers.map(u => u.jobRoleId!).filter(Boolean)));
    const roleElementsByRole = new Map<string, Array<RoleElement & { element: CompetencyElement }>>();
    for (const roleId of roleIds) {
      roleElementsByRole.set(roleId, await this.getRoleElementsWithDetails(roleId));
    }

    const candidateIds = inScopeUsers.map(u => u.id);
    const allAssessments = candidateIds.length > 0
      ? await db.select().from(assessments).where(and(inArray(assessments.candidateId, candidateIds), eq(assessments.isActive, true)))
      : [];
    const assessmentByPair = new Map<string, Assessment>();
    for (const a of allAssessments) {
      const key = `${a.candidateId}:${a.elementId}`;
      const existing = assessmentByPair.get(key);
      if (!existing || new Date(a.updatedAt || 0).getTime() > new Date(existing.updatedAt || 0).getTime()) {
        assessmentByPair.set(key, a);
      }
    }

    const isSafetyCriticalRole = (re: RoleElement & { element: CompetencyElement }) =>
      re.safetyCritical !== null && re.safetyCritical !== undefined ? re.safetyCritical : re.element.safetyCriticality === 'High';

    const resolveExpiry = (a: Assessment, re: { validityYears?: number | null; element: CompetencyElement }): Date | null => {
      if (a.expiryDate) return new Date(a.expiryDate);
      if (!a.signOffAt) return null;
      return computeAssessmentTimeline({
        signOffAt: a.signOffAt,
        validityYears: re.validityYears ?? re.element.reassessmentYears ?? undefined,
        validityMonths: re.element.validityMonths ?? re.element.validityPeriod ?? undefined,
      }).expiryDate;
    };

    // isAssignment is the codebase's existing "this is a real completed outcome, not just an
    // assigned placeholder" signal - don't additionally require signOffAt here, since imported/
    // seeded assessments legitimately carry a real outcome + expiryDate without ever having gone
    // through the in-app sign-off flow that sets signOffAt.
    const hasRealOutcome = (a: Assessment | undefined): a is Assessment =>
      !!a && !a.isAssignment && ['competent', 'competent_with_minor_needs'].includes(a.outcome);

    const isCurrentlyValid = (a: Assessment | undefined, re: { validityYears?: number | null; element: CompetencyElement }): boolean => {
      if (!hasRealOutcome(a)) return false;
      const expiry = resolveExpiry(a, re);
      return !expiry || expiry.getTime() > now.getTime();
    };

    // ---------- KPI 3.2a (currency) + KPI 3.5 (overdue ageing) ----------
    // A person with an open, frozen absence (long-term sick) is excluded from 3.5's overdue
    // counts/list specifically - a certification lapsing while someone is out isn't a compliance
    // failure. Currency (3.2a) is left untouched; it's a different measure (valid/total), and this
    // person genuinely doesn't hold a valid cert right now regardless of why.
    const activeAbsenceByUserId = await this.getActiveAbsencesForUsers(candidateIds);
    let validCount = 0, totalInScope = 0;
    const under1Month = { total: 0, safetyCritical: 0, nonSafetyCritical: 0 };
    const over1Month = { total: 0, safetyCritical: 0, nonSafetyCritical: 0 };
    const overdueItems: Element3KpiReport['overdueAgeing']['items'] = [];

    for (const user of inScopeUsers) {
      const required = (roleElementsByRole.get(user.jobRoleId!) || []).filter(re => re.required);
      for (const re of required) {
        totalInScope++;
        const a = assessmentByPair.get(`${user.id}:${re.elementId}`);
        const safetyCritical = isSafetyCriticalRole(re);

        if (isCurrentlyValid(a, re)) {
          validCount++;
          continue;
        }
        // Only a previously-completed, now-lapsed assessment counts as "overdue" for KPI 3.5 -
        // never-assessed/not-yet-competent is a currency gap (3.2a), not an ageing one.
        if (!hasRealOutcome(a)) continue;
        if (activeAbsenceByUserId.get(user.id)?.isFrozen) continue;
        const expiry = resolveExpiry(a, re);
        if (!expiry) continue;
        const daysOverdue = Math.floor((now.getTime() - expiry.getTime()) / 86400000);
        if (daysOverdue <= 0) continue;

        const bucket = daysOverdue <= 30 ? under1Month : over1Month;
        bucket.total++;
        if (safetyCritical) bucket.safetyCritical++; else bucket.nonSafetyCritical++;
        overdueItems.push({
          candidateId: user.id,
          candidateName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
          elementId: re.elementId,
          elementName: re.element.name,
          expiryDate: expiry.toISOString(),
          daysOverdue,
          safetyCritical,
          assessorId: a.assessorId || null,
        });
      }
    }
    overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
    const currencyPercentage = totalInScope > 0 ? Math.round((validCount / totalInScope) * 1000) / 10 : 0;

    // ---------- KPI 3.2b/c (closeout timeliness), from assessment_expiry_history ----------
    const historyRows = await db.select().from(assessmentExpiryHistory).orderBy(desc(assessmentExpiryHistory.renewalClosedAt));
    const daysBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 86400000;
    const alertDateFor = (expiry: Date) => new Date(expiry.getTime() - 90 * 86400000);
    const compliantRows = historyRows.filter(h => !h.wasBreach);
    const breachRows = historyRows.filter(h => h.wasBreach);
    const compliantAvg = compliantRows.length > 0
      ? Math.round(compliantRows.reduce((sum, h) => sum + daysBetween(new Date(h.renewalClosedAt), alertDateFor(new Date(h.previousExpiryDate))), 0) / compliantRows.length)
      : null;
    const breachAvg = breachRows.length > 0
      ? Math.round(breachRows.reduce((sum, h) => sum + daysBetween(new Date(h.renewalClosedAt), new Date(h.previousExpiryDate)), 0) / breachRows.length)
      : null;
    const breachOver30 = breachRows.filter(h => daysBetween(new Date(h.renewalClosedAt), new Date(h.previousExpiryDate)) > 30).length;

    // ---------- KPI 3.6a (outcome distribution, current calendar month) ----------
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthAssessments = await db.select().from(assessments).where(and(
      eq(assessments.isActive, true),
      sql`${assessments.signOffAt} IS NOT NULL`,
      gte(assessments.signOffAt, monthStart)
    ));
    const outcomeDistribution = {
      periodStart: monthStart.toISOString(),
      competent: monthAssessments.filter(a => a.outcome === 'competent').length,
      competentWithMinorNeeds: monthAssessments.filter(a => a.outcome === 'competent_with_minor_needs').length,
      notYetCompetent: monthAssessments.filter(a => a.outcome === 'not_yet_competent').length,
      total: monthAssessments.length,
    };

    // ---------- KPI 3.6b (IV assurance, all-time acceptance rate) ----------
    const allVerifications = await db.select().from(verifications).where(eq(verifications.isActive, true));
    const ivAccepted = allVerifications.filter(v => v.outcome === 'agreed').length;
    const ivDiscrepancy = allVerifications.filter(v => v.outcome === 'disagreed' || v.outcome === 'further_evidence_required').length;
    const ivTotal = allVerifications.length;

    // ---------- KPI 3.6c (sampling compliance), reusing the verifier dashboard's quota math system-wide ----------
    const allPlans = await this.getSamplingPlans();
    const quarterIndex = Math.floor(now.getMonth() / 3);
    const quarterStart = new Date(now.getFullYear(), quarterIndex * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), quarterIndex * 3 + 3, 1);
    const samplingPairs = await Promise.all(allPlans.map(async (plan) => {
      const verifier = await this.getUser(plan.verifierId);
      const assessor = await this.getUser(plan.assessorId);
      const pendingList = await db.select().from(assessments).where(and(
        eq(assessments.assessorId, plan.assessorId),
        eq(assessments.verificationStatus, 'not_verified'),
        eq(assessments.isActive, true),
        sql`${assessments.signOffAt} IS NOT NULL`
      ));
      const verifiedThisQuarterRows = await db.select({ count: sql`count(*)` })
        .from(verifications)
        .innerJoin(assessments, eq(verifications.assessmentId, assessments.id))
        .where(and(
          eq(verifications.verifierId, plan.verifierId),
          eq(assessments.assessorId, plan.assessorId),
          eq(verifications.isActive, true),
          gte(verifications.verificationDate, quarterStart),
          sql`${verifications.verificationDate} < ${quarterEnd}`
        ));
      const verifiedThisQuarter = Number(verifiedThisQuarterRows[0]?.count || 0);
      const totalConsidered = pendingList.length + verifiedThisQuarter;
      const requiredSampleCount = Math.ceil((plan.targetPercentage / 100) * totalConsidered);
      return {
        verifierId: plan.verifierId,
        verifierName: verifier ? `${verifier.firstName} ${verifier.lastName}` : 'Unknown',
        assessorId: plan.assessorId,
        assessorName: assessor ? `${assessor.firstName} ${assessor.lastName}` : 'Unknown',
        targetPercentage: plan.targetPercentage,
        requiredSampleCount,
        verifiedThisQuarter,
        quotaMet: verifiedThisQuarter >= requiredSampleCount,
      };
    }));
    const sumRequired = samplingPairs.reduce((s, p) => s + p.requiredSampleCount, 0);
    const sumCompleted = samplingPairs.reduce((s, p) => s + Math.min(p.verifiedThisQuarter, p.requiredSampleCount), 0);
    const samplingOverallPercentage = sumRequired > 0 ? Math.round((sumCompleted / sumRequired) * 1000) / 10 : (samplingPairs.length > 0 ? 100 : null);

    // ---------- KPI 3.4a/b (succession currency + depth) ----------
    const plans = await db.select().from(successionPlans).where(eq(successionPlans.isActive, true));
    const sixMonthsAgo = new Date(now.getTime() - 182 * 86400000);
    const successionDetails = await Promise.all(plans.map(async (p) => {
      const role = await this.getJobRole(p.jobRoleId);
      const candidates = await db.select().from(successionCandidates).where(and(
        eq(successionCandidates.successionPlanId, p.id),
        eq(successionCandidates.isActive, true)
      ));
      const successorsWithDevPlan = candidates.filter(c => c.developmentPlanDueDate).length;
      const isCurrent = p.updatedAt ? new Date(p.updatedAt).getTime() >= sixMonthsAgo.getTime() : false;
      return {
        id: p.id,
        jobRoleId: p.jobRoleId,
        jobRoleName: role?.name || 'Unknown',
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
        isCurrent,
        successorCount: candidates.length,
        successorsWithDevPlan,
        hasDepth: successorsWithDevPlan >= 2,
      };
    }));
    const successionCurrencyPercentage = successionDetails.length > 0
      ? Math.round((successionDetails.filter(p => p.isCurrent).length / successionDetails.length) * 1000) / 10 : null;
    const successionDepthPercentage = successionDetails.length > 0
      ? Math.round((successionDetails.filter(p => p.hasDepth).length / successionDetails.length) * 1000) / 10 : null;

    // ---------- KPI 3.10 (coverage gap detection only - no SARA/ORA logging exists yet) ----------
    // Groups by the free-text location/teamShift pair actually in use on user records (the
    // structured locations/teams tables aren't populated yet - see the Role Transition Planning
    // location-matching fix from this same session for why free text is still the ground truth).
    const groups = new Map<string, { location: string | null; teamShift: string | null; members: typeof inScopeUsers }>();
    for (const u of inScopeUsers) {
      if (!u.location && !u.teamShift) continue;
      const key = `${u.location || ''}||${u.teamShift || ''}`;
      if (!groups.has(key)) groups.set(key, { location: u.location, teamShift: u.teamShift, members: [] });
      groups.get(key)!.members.push(u);
    }
    const coverageGaps: Element3KpiReport['coverageGaps']['gaps'] = [];
    for (const group of Array.from(groups.values())) {
      const scElements = new Map<string, RoleElement & { element: CompetencyElement }>();
      for (const member of group.members) {
        if (!member.jobRoleId) continue;
        for (const re of roleElementsByRole.get(member.jobRoleId) || []) {
          if (re.required && isSafetyCriticalRole(re)) scElements.set(re.elementId, re);
        }
      }
      for (const [elementId, re] of Array.from(scElements.entries())) {
        const hasValidHolder = group.members.some(m => isCurrentlyValid(assessmentByPair.get(`${m.id}:${elementId}`), re));
        if (!hasValidHolder) {
          coverageGaps.push({
            location: group.location,
            teamShift: group.teamShift,
            elementId,
            elementName: re.element.name,
            membersChecked: group.members.length,
          });
        }
      }
    }

    return {
      generatedAt: now.toISOString(),
      currency: { percentage: currencyPercentage, validCount, totalInScope },
      overdueAgeing: { under1Month, over1Month, items: overdueItems },
      closeoutTimeliness: {
        compliant: { count: compliantRows.length, averageDaysFromAlert: compliantAvg },
        breach: { count: breachRows.length, averageDaysFromExpiry: breachAvg, over30Days: breachOver30 },
        trackingSince: historyRows.length > 0 ? new Date(Math.min(...historyRows.map(h => new Date(h.createdAt || h.renewalClosedAt).getTime()))).toISOString() : null,
      },
      outcomeDistribution,
      ivAssurance: {
        accepted: ivAccepted,
        discrepancy: ivDiscrepancy,
        total: ivTotal,
        percentage: ivTotal > 0 ? Math.round((ivAccepted / ivTotal) * 1000) / 10 : null,
      },
      samplingCompliance: {
        overallPercentage: samplingOverallPercentage,
        pairsCompliant: samplingPairs.filter(p => p.quotaMet).length,
        pairsTotal: samplingPairs.length,
        pairs: samplingPairs,
      },
      succession: {
        currencyPercentage: successionCurrencyPercentage,
        depthPercentage: successionDepthPercentage,
        plans: successionDetails,
      },
      coverageGaps: { totalGaps: coverageGaps.length, gaps: coverageGaps },
    };
  }

  // A leaver marked with a future leaving date (e.g. resignation logged today, last day in three
  // weeks) should stay in every compliance figure through their notice period - only actually out
  // of scope once that date has passed. isArchived flips to true immediately when the leaver is
  // recorded (see routes.ts POST /api/users/:id/archive), so "in scope" can't just mean
  // isArchived=false; it means not archived, OR archived but not yet at their leaving date.
  private notArchivedOrNotYetLeft(now: Date) {
    return or(eq(users.isArchived, false), sql`${users.leftAt} > ${now}`);
  }

  // Shared population-to-rows pass for the Executive Dashboard and Compliance Explorer - batches
  // every lookup across the whole candidate list up front (role elements/trainings per distinct
  // role, assessments and enrollments via inArray) instead of the per-user queries
  // getTrainingComplianceStatus uses, since here the population can be the entire org rather than
  // one person.
  private async buildComplianceRows(userList: User[]): Promise<ComplianceRow[]> {
    const now = new Date();
    if (userList.length === 0) return [];

    const jobRoleIds = Array.from(new Set(userList.map(u => u.jobRoleId).filter((id): id is string => !!id)));
    const secondaryJobRoleIds = Array.from(new Set(userList.map(u => u.secondaryJobRoleId).filter((id): id is string => !!id)));
    const allRoleIds = Array.from(new Set([...jobRoleIds, ...secondaryJobRoleIds]));
    const jobRolesById = new Map<string, JobRole>();
    for (const roleId of allRoleIds) {
      const role = await this.getJobRole(roleId);
      if (role) jobRolesById.set(roleId, role);
    }

    const roleElementsByRole = new Map<string, Array<RoleElement & { element: CompetencyElement }>>();
    const roleTrainingsByRole = new Map<string, Array<RoleTraining & { training: Training }>>();
    for (const roleId of jobRoleIds) {
      roleElementsByRole.set(roleId, await this.getRoleElementsWithDetails(roleId));
      roleTrainingsByRole.set(roleId, await this.getRoleTrainingsWithDetails(roleId));
    }

    const userIds = userList.map(u => u.id);
    const allAssessments = await db.select().from(assessments).where(and(inArray(assessments.candidateId, userIds), eq(assessments.isActive, true)));
    const assessmentByPair = new Map<string, Assessment>();
    for (const a of allAssessments) {
      const key = `${a.candidateId}:${a.elementId}`;
      const existing = assessmentByPair.get(key);
      if (!existing || new Date(a.updatedAt || 0).getTime() > new Date(existing.updatedAt || 0).getTime()) {
        assessmentByPair.set(key, a);
      }
    }

    const allEnrollments = await db.select().from(trainingEnrollments).where(and(inArray(trainingEnrollments.userId, userIds), eq(trainingEnrollments.isActive, true)));
    const enrollmentsByPair = new Map<string, TrainingEnrollment[]>();
    for (const e of allEnrollments) {
      const key = `${e.userId}:${e.trainingId}`;
      if (!enrollmentsByPair.has(key)) enrollmentsByPair.set(key, []);
      enrollmentsByPair.get(key)!.push(e);
    }

    const contractCompanyIds = Array.from(new Set(userList.map(u => u.contractCompanyId).filter((id): id is string => !!id)));
    const contractCompanyNameById = new Map<string, string>();
    for (const id of contractCompanyIds) {
      const c = await this.getContractCompany(id);
      if (c) contractCompanyNameById.set(id, c.name);
    }

    const activeAbsenceByUserId = await this.getActiveAbsencesForUsers(userList.map(u => u.id));

    // Same safety-critical/expiry/validity resolution as getElement3KpiReport, above.
    const isSafetyCriticalRole = (re: RoleElement & { element: CompetencyElement }) =>
      re.safetyCritical !== null && re.safetyCritical !== undefined ? re.safetyCritical : re.element.safetyCriticality === 'High';

    const resolveExpiry = (a: Assessment, re: { validityYears?: number | null; element: CompetencyElement }): Date | null => {
      if (a.expiryDate) return new Date(a.expiryDate);
      if (!a.signOffAt) return null;
      return computeAssessmentTimeline({
        signOffAt: a.signOffAt,
        validityYears: re.validityYears ?? re.element.reassessmentYears ?? undefined,
        validityMonths: re.element.validityMonths ?? re.element.validityPeriod ?? undefined,
      }).expiryDate;
    };

    const hasRealOutcome = (a: Assessment | undefined): a is Assessment =>
      !!a && !a.isAssignment && ['competent', 'competent_with_minor_needs'].includes(a.outcome);

    const statusFromExpiry = (expiry: Date | null): ElementStatus => {
      if (!expiry) return 'current';
      const daysRemaining = Math.floor((expiry.getTime() - now.getTime()) / 86400000);
      if (daysRemaining < 0) return 'expired';
      if (daysRemaining <= 30) return 'expiring_30';
      if (daysRemaining <= 60) return 'expiring_60';
      if (daysRemaining <= 90) return 'expiring_90';
      return 'current';
    };

    const emptyBucket = (): ComplianceBucket => ({
      current: 0, expiring30: 0, expiring60: 0, expiring90: 0, expired: 0, missing: 0,
      total: 0, safetyCriticalTotal: 0, safetyCriticalCurrent: 0, percentage: 0,
    });
    const addToBucket = (bucket: ComplianceBucket, status: ElementStatus, safetyCritical: boolean) => {
      bucket.total++;
      if (safetyCritical) bucket.safetyCriticalTotal++;
      switch (status) {
        case 'current': bucket.current++; if (safetyCritical) bucket.safetyCriticalCurrent++; break;
        case 'expiring_30': bucket.expiring30++; break;
        case 'expiring_60': bucket.expiring60++; break;
        case 'expiring_90': bucket.expiring90++; break;
        case 'expired': bucket.expired++; break;
        case 'missing': bucket.missing++; break;
      }
    };
    const finalizeBucket = (bucket: ComplianceBucket) => {
      bucket.percentage = bucket.total > 0 ? Math.round((bucket.current / bucket.total) * 1000) / 10 : 0;
      return bucket;
    };

    const rows: ComplianceRow[] = [];
    for (const user of userList) {
      const competenceBucket = emptyBucket();
      const trainingBucket = emptyBucket();

      if (user.jobRoleId) {
        const requiredElements = (roleElementsByRole.get(user.jobRoleId) || []).filter(re => re.required);
        for (const re of requiredElements) {
          const a = assessmentByPair.get(`${user.id}:${re.elementId}`);
          const safetyCritical = isSafetyCriticalRole(re);
          if (!hasRealOutcome(a)) {
            addToBucket(competenceBucket, 'missing', safetyCritical);
            continue;
          }
          addToBucket(competenceBucket, statusFromExpiry(resolveExpiry(a, re)), safetyCritical);
        }

        // 1-of-N alternative training requirements (groupId) are satisfied once any member is
        // current - same rule as getTrainingComplianceStatus, applied across the whole population.
        const roleTrainingsList = (roleTrainingsByRole.get(user.jobRoleId) || []).filter(rt => rt.required ?? true);
        const groupedByKey = new Map<string, typeof roleTrainingsList>();
        for (const rt of roleTrainingsList) {
          const key = rt.groupId ?? `single:${rt.id}`;
          if (!groupedByKey.has(key)) groupedByKey.set(key, []);
          groupedByKey.get(key)!.push(rt);
        }
        for (const members of Array.from(groupedByKey.values())) {
          const memberResults = members.map(rt => {
            const completions = (enrollmentsByPair.get(`${user.id}:${rt.trainingId}`) || [])
              .filter(e => e.achievementDate)
              .sort((a, b) => new Date(b.achievementDate!).getTime() - new Date(a.achievementDate!).getTime());
            const latest = completions[0];
            const status: ElementStatus = latest ? statusFromExpiry(latest.expiryDate ? new Date(latest.expiryDate) : null) : 'missing';
            return { status, safetyCritical: !!rt.training.isSafetyCritical };
          });
          const best = memberResults.reduce((a, b) => DbStorage.TRAINING_STATUS_RANK[a.status] <= DbStorage.TRAINING_STATUS_RANK[b.status] ? a : b);
          // Safety-critical if any alternative in the group is flagged - the requirement itself is
          // safety-critical regardless of which specific alternative the candidate holds.
          const groupSafetyCritical = memberResults.some(m => m.safetyCritical);
          addToBucket(trainingBucket, best.status, groupSafetyCritical);
        }
      }

      finalizeBucket(competenceBucket);
      finalizeBucket(trainingBucket);

      const jobRole = user.jobRoleId ? jobRolesById.get(user.jobRoleId) : undefined;
      const secondaryRole = user.secondaryJobRoleId ? jobRolesById.get(user.secondaryJobRoleId) : undefined;

      rows.push({
        userId: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
        email: user.email,
        jobRoleId: user.jobRoleId,
        jobRoleName: jobRole?.name || null,
        secondaryJobRoleName: secondaryRole?.name || null,
        location: user.location,
        teamShift: user.teamShift,
        employmentType: user.employmentType,
        contractCompanyName: user.contractCompanyId ? (contractCompanyNameById.get(user.contractCompanyId) || null) : null,
        onLeave: !!activeAbsenceByUserId.get(user.id)?.isFrozen,
        competence: competenceBucket,
        training: trainingBucket,
      });
    }

    return rows;
  }

  async getComplianceOverview(): Promise<ComplianceOverview> {
    const now = new Date();
    const inScopeUsers = await db.select().from(users).where(and(
      eq(users.isActive, true),
      this.notArchivedOrNotYetLeft(now),
      sql`${users.jobRoleId} IS NOT NULL`
    ));
    const rows = await this.buildComplianceRows(inScopeUsers);
    const pct = (num: number, den: number) => den > 0 ? Math.round((num / den) * 1000) / 10 : 0;

    // Frozen (onLeave) people are excluded from every figure below except headcount itself - one
    // person's long-term sick shouldn't drag down the team's percentages or inflate the overdue
    // count for a certification that lapsed while they were out. They're still fully visible (with
    // their real numbers) in the Compliance Explorer/Competence Detail drill-down views.
    const activeRows = rows.filter(r => !r.onLeave);
    const onLeaveCount = rows.length - activeRows.length;

    const summarize = (rowList: ComplianceRow[], pick: (r: ComplianceRow) => ComplianceBucket) => {
      const acc = { total: 0, current: 0, scTotal: 0, scCurrent: 0, expiring30: 0, expiring60: 0, expiring90: 0, expired: 0, missing: 0 };
      for (const r of rowList) {
        const b = pick(r);
        acc.total += b.total; acc.current += b.current; acc.scTotal += b.safetyCriticalTotal; acc.scCurrent += b.safetyCriticalCurrent;
        acc.expiring30 += b.expiring30; acc.expiring60 += b.expiring60; acc.expiring90 += b.expiring90; acc.expired += b.expired; acc.missing += b.missing;
      }
      return acc;
    };
    const comp = summarize(activeRows, r => r.competence);
    const train = summarize(activeRows, r => r.training);

    // Assessments overview: an assignment placeholder with no scheduled date is "assigned" only,
    // a scheduled one in the future is "scheduled", a scheduled one in the past is "overdue", and
    // any non-assignment row is complete - split by outcome (competent/competent_with_minor_needs
    // vs not_yet_competent) so a completed-but-failed assessment doesn't read as a success next to
    // "Overdue". A frozen person's own overdue items count as "assigned" instead - still pending,
    // just not held against them while they're on leave.
    const frozenUserIds = new Set(rows.filter(r => r.onLeave).map(r => r.userId));
    const userIds = inScopeUsers.map(u => u.id);
    let assigned = 0, scheduled = 0, overdue = 0, completeCompetent = 0, completeNotYetCompetent = 0;
    if (userIds.length > 0) {
      const allA = await db.select().from(assessments).where(and(inArray(assessments.candidateId, userIds), eq(assessments.isActive, true)));
      for (const a of allA) {
        if (!a.isAssignment) {
          if (a.outcome === 'competent' || a.outcome === 'competent_with_minor_needs') completeCompetent++;
          else completeNotYetCompetent++;
          continue;
        }
        if (a.plannedAssessmentDate) {
          if (new Date(a.plannedAssessmentDate).getTime() < now.getTime()) {
            if (frozenUserIds.has(a.candidateId)) assigned++; else overdue++;
          } else {
            scheduled++;
          }
        } else {
          assigned++;
        }
      }
    }

    const byRole = new Map<string, ComplianceRow[]>();
    for (const r of activeRows) {
      const key = r.jobRoleName || 'Unassigned';
      if (!byRole.has(key)) byRole.set(key, []);
      byRole.get(key)!.push(r);
    }
    const groupPerformance = Array.from(byRole.entries()).map(([groupLabel, groupRows]) => {
      const gComp = summarize(groupRows, r => r.competence);
      const gTrain = summarize(groupRows, r => r.training);
      return {
        groupLabel,
        headcount: groupRows.length,
        trainingPercentage: pct(gTrain.current, gTrain.total),
        competencePercentage: pct(gComp.current, gComp.total),
      };
    }).sort((a, b) => b.headcount - a.headcount);

    return {
      generatedAt: now.toISOString(),
      headcount: inScopeUsers.length,
      onLeaveCount,
      trainingCompliance: { percentage: pct(train.current, train.total), current: train.current, total: train.total },
      competenceCompliance: { percentage: pct(comp.current, comp.total), current: comp.current, total: comp.total },
      safetyCriticalTraining: { percentage: pct(train.scCurrent, train.scTotal), current: train.scCurrent, total: train.scTotal },
      safetyCriticalCompetence: { percentage: pct(comp.scCurrent, comp.scTotal), current: comp.scCurrent, total: comp.scTotal },
      expiringCertifications: {
        in30Days: comp.expiring30 + train.expiring30,
        in60Days: comp.expiring60 + train.expiring60,
        in90Days: comp.expiring90 + train.expiring90,
        expired: comp.expired + train.expired,
      },
      assessmentsOverview: { assigned, scheduled, overdue, completeCompetent, completeNotYetCompetent },
      statusBreakdown: {
        competence: { current: comp.current, expiring: comp.expiring30 + comp.expiring60 + comp.expiring90, expired: comp.expired, missing: comp.missing },
        training: { current: train.current, expiring: train.expiring30 + train.expiring60 + train.expiring90, expired: train.expired, missing: train.missing },
      },
      groupPerformance,
    };
  }

  // Shared by getComplianceExplorer and getCompetenceDetail - both need the same "which users
  // match these filters" resolution.
  private async getFilteredUsers(filters: ComplianceExplorerFilters): Promise<User[]> {
    const conditions: any[] = [eq(users.isActive, true), this.notArchivedOrNotYetLeft(new Date())];
    if (filters.jobRoleId) conditions.push(eq(users.jobRoleId, filters.jobRoleId));
    if (filters.secondaryJobRoleId) conditions.push(eq(users.secondaryJobRoleId, filters.secondaryJobRoleId));
    if (filters.teamShift) conditions.push(eq(users.teamShift, filters.teamShift));
    if (filters.employmentType) conditions.push(eq(users.employmentType, filters.employmentType));
    if (filters.contractCompanyId) conditions.push(eq(users.contractCompanyId, filters.contractCompanyId));
    if (filters.candidateIds?.length) conditions.push(inArray(users.id, filters.candidateIds));

    let candidateUsers = await db.select().from(users).where(and(...conditions));

    // Location is independently-populated free text with inconsistent conventions between records
    // (e.g. "47/3B" vs "Rough 47-3B" for the same site - see the Role Transition Planning fix from
    // earlier this session) - exact equality would silently drop real matches, so normalize and
    // check containment either direction instead.
    const normalizeForMatch = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (filters.location) {
      const target = normalizeForMatch(filters.location);
      candidateUsers = candidateUsers.filter(u => {
        if (!u.location) return false;
        const norm = normalizeForMatch(u.location);
        return norm.includes(target) || target.includes(norm);
      });
    }
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      candidateUsers = candidateUsers.filter(u =>
        `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
      );
    }

    return candidateUsers;
  }

  async getComplianceExplorer(filters: ComplianceExplorerFilters): Promise<ComplianceExplorerResult> {
    const now = new Date();
    const candidateUsers = await this.getFilteredUsers(filters);
    const rows = await this.buildComplianceRows(candidateUsers);
    const pct = (num: number, den: number) => den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
    const sum = (rowList: ComplianceRow[], pick: (r: ComplianceRow) => ComplianceBucket) => {
      const acc = { total: 0, current: 0, scTotal: 0, scCurrent: 0 };
      for (const r of rowList) {
        const b = pick(r);
        acc.total += b.total; acc.current += b.current; acc.scTotal += b.safetyCriticalTotal; acc.scCurrent += b.safetyCriticalCurrent;
      }
      return acc;
    };
    // Same onLeave exclusion as getComplianceOverview - percentages here are computed from
    // active (non-frozen) people only, but the full roster (including on-leave people, flagged)
    // still comes back in `people` so this drill-down view shows the real underlying data.
    const activeRows = rows.filter(r => !r.onLeave);
    const comp = sum(activeRows, r => r.competence);
    const train = sum(activeRows, r => r.training);

    const byGroup = new Map<string, ComplianceRow[]>();
    for (const r of rows) {
      const key = `${r.location || ''}||${r.teamShift || ''}`;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(r);
    }
    const byTeamShift = Array.from(byGroup.values()).map(groupRows => {
      const gActiveRows = groupRows.filter(r => !r.onLeave);
      const gComp = sum(gActiveRows, r => r.competence);
      const gTrain = sum(gActiveRows, r => r.training);
      return {
        location: groupRows[0].location,
        teamShift: groupRows[0].teamShift,
        headcount: groupRows.length,
        trainingPercentage: pct(gTrain.current, gTrain.total),
        competencePercentage: pct(gComp.current, gComp.total),
      };
    }).sort((a, b) => b.headcount - a.headcount);

    return {
      generatedAt: now.toISOString(),
      filtersApplied: filters,
      totalMatched: rows.length,
      summary: {
        trainingPercentage: pct(train.current, train.total),
        competencePercentage: pct(comp.current, comp.total),
        safetyCriticalTrainingPercentage: pct(train.scCurrent, train.scTotal),
        safetyCriticalCompetencePercentage: pct(comp.scCurrent, comp.scTotal),
      },
      byTeamShift,
      people: rows,
    };
  }

  // Element-level grid behind the Competence Detail report - reuses the same filter resolution as
  // getComplianceExplorer, but surfaces every required competence element with its own status +
  // expiry date instead of aggregating into a bucket. The element set is the union of required
  // elements across every role represented in the filtered population (not a single role like
  // getTeamComplianceMatrix), so a cell can legitimately be "not required" for someone whose role
  // doesn't call for that element - shown as N/A rather than a false "missing".
  async getCompetenceDetail(filters: ComplianceExplorerFilters): Promise<CompetenceDetailResult> {
    const now = new Date();
    const candidateUsers = await this.getFilteredUsers(filters);

    const jobRoleIds = Array.from(new Set(candidateUsers.map(u => u.jobRoleId).filter((id): id is string => !!id)));
    const roleElementsByRole = new Map<string, Array<RoleElement & { element: CompetencyElement }>>();
    const jobRolesById = new Map<string, JobRole>();
    for (const roleId of jobRoleIds) {
      roleElementsByRole.set(roleId, await this.getRoleElementsWithDetails(roleId));
      const role = await this.getJobRole(roleId);
      if (role) jobRolesById.set(roleId, role);
    }

    const userIds = candidateUsers.map(u => u.id);
    const allAssessments = userIds.length > 0
      ? await db.select().from(assessments).where(and(inArray(assessments.candidateId, userIds), eq(assessments.isActive, true)))
      : [];
    const assessmentByPair = new Map<string, Assessment>();
    for (const a of allAssessments) {
      const key = `${a.candidateId}:${a.elementId}`;
      const existing = assessmentByPair.get(key);
      if (!existing || new Date(a.updatedAt || 0).getTime() > new Date(existing.updatedAt || 0).getTime()) {
        assessmentByPair.set(key, a);
      }
    }

    const activeAbsenceByUserId = await this.getActiveAbsencesForUsers(userIds);

    // Same safety-critical/expiry/validity resolution used everywhere else this report family
    // relies on (see buildComplianceRows/getElement3KpiReport, above).
    const isSafetyCriticalRole = (re: RoleElement & { element: CompetencyElement }) =>
      re.safetyCritical !== null && re.safetyCritical !== undefined ? re.safetyCritical : re.element.safetyCriticality === 'High';
    const resolveExpiry = (a: Assessment, re: { validityYears?: number | null; element: CompetencyElement }): Date | null => {
      if (a.expiryDate) return new Date(a.expiryDate);
      if (!a.signOffAt) return null;
      return computeAssessmentTimeline({
        signOffAt: a.signOffAt,
        validityYears: re.validityYears ?? re.element.reassessmentYears ?? undefined,
        validityMonths: re.element.validityMonths ?? re.element.validityPeriod ?? undefined,
      }).expiryDate;
    };
    const statusFromExpiry = (expiry: Date | null): ElementStatus => {
      if (!expiry) return 'current';
      const daysRemaining = Math.floor((expiry.getTime() - now.getTime()) / 86400000);
      if (daysRemaining < 0) return 'expired';
      if (daysRemaining <= 30) return 'expiring_30';
      if (daysRemaining <= 60) return 'expiring_60';
      if (daysRemaining <= 90) return 'expiring_90';
      return 'current';
    };

    const elementMap = new Map<string, CompetenceDetailElement>();
    for (const roleId of jobRoleIds) {
      for (const re of (roleElementsByRole.get(roleId) || [])) {
        if (!re.required) continue;
        const safetyCritical = isSafetyCriticalRole(re);
        const existing = elementMap.get(re.elementId);
        if (!existing) {
          elementMap.set(re.elementId, {
            elementId: re.elementId,
            elementName: re.element.name,
            elementCode: re.element.code,
            safetyCritical,
          });
        } else if (safetyCritical) {
          // Flagged safety-critical for at least one role that requires it - surface that even if
          // another role in the mix doesn't carry the override.
          existing.safetyCritical = true;
        }
      }
    }
    const elementsList = Array.from(elementMap.values()).sort((a, b) => a.elementName.localeCompare(b.elementName));

    const people: CompetenceDetailPerson[] = candidateUsers.map(user => {
      const roleElements = user.jobRoleId ? (roleElementsByRole.get(user.jobRoleId) || []) : [];
      const requiredByElementId = new Map(roleElements.filter(re => re.required).map(re => [re.elementId, re]));

      const cells: Record<string, CompetenceDetailCell> = {};
      let currentCount = 0, requiredCount = 0;
      for (const el of elementsList) {
        const re = requiredByElementId.get(el.elementId);
        if (!re) {
          cells[el.elementId] = { status: 'missing', outcome: null, expiryDate: null, daysUntilExpiry: null, required: false, safetyCritical: el.safetyCritical };
          continue;
        }
        requiredCount++;
        const assessmentRow = assessmentByPair.get(`${user.id}:${el.elementId}`);
        const safetyCritical = isSafetyCriticalRole(re);
        if (!assessmentRow) {
          cells[el.elementId] = { status: 'missing', outcome: null, expiryDate: null, daysUntilExpiry: null, required: true, safetyCritical };
          continue;
        }
        // Inlined rather than calling hasRealOutcome(assessmentRow) - once assessmentRow is
        // already narrowed to a plain Assessment (not Assessment | undefined), TS's negated
        // type-predicate narrowing collapses the false branch to `never` instead of `Assessment`,
        // since the predicate's own signature only distinguishes Assessment from undefined.
        const outcomeIsReal = !assessmentRow.isAssignment && ['competent', 'competent_with_minor_needs'].includes(assessmentRow.outcome);
        if (!outcomeIsReal) {
          cells[el.elementId] = { status: 'missing', outcome: assessmentRow.outcome, expiryDate: null, daysUntilExpiry: null, required: true, safetyCritical };
          continue;
        }
        const expiry = resolveExpiry(assessmentRow, re);
        const status = statusFromExpiry(expiry);
        if (status === 'current') currentCount++;
        const daysUntilExpiry = expiry ? Math.floor((expiry.getTime() - now.getTime()) / 86400000) : null;
        cells[el.elementId] = { status, outcome: assessmentRow.outcome, expiryDate: expiry ? expiry.toISOString() : null, daysUntilExpiry, required: true, safetyCritical };
      }

      const jobRole = user.jobRoleId ? jobRolesById.get(user.jobRoleId) : undefined;
      return {
        userId: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
        jobRoleName: jobRole?.name || null,
        location: user.location,
        teamShift: user.teamShift,
        onLeave: !!activeAbsenceByUserId.get(user.id)?.isFrozen,
        cells,
        coveragePercentage: requiredCount > 0 ? Math.round((currentCount / requiredCount) * 100) : 0,
      };
    });

    return {
      generatedAt: now.toISOString(),
      filtersApplied: filters,
      elements: elementsList,
      people,
    };
  }

  // Org chart node - the focused person, their manager, and their direct reports, each carrying
  // their OWN direct-report count so the frontend can show a "N reports" badge before drilling in.
  // Built entirely on users.managerId (a self-reference that already existed in the schema with no
  // UI ever wired up to set it) - most people will show 0 reports until managers get assigned via
  // the new Manager field on the user edit form.
  async getOrgChartNode(userId: string): Promise<OrgChartNode | null> {
    const focusUser = await this.getUser(userId);
    if (!focusUser) return null;

    const manager = focusUser.managerId ? await this.getUser(focusUser.managerId) : undefined;
    const directReportRows = await db.select().from(users).where(and(eq(users.managerId, userId), eq(users.isActive, true)));
    const directReportIds = directReportRows.map(u => u.id);

    // Second level - each direct report's own direct reports, fetched in one batched query so the
    // chart can render a real 3-tier view (focus / direct reports / their reports) without a click
    // per level.
    const grandReportRows = directReportIds.length > 0
      ? await db.select().from(users).where(and(inArray(users.managerId, directReportIds), eq(users.isActive, true)))
      : [];
    const grandReportsByManagerId = new Map<string, typeof grandReportRows>();
    for (const gr of grandReportRows) {
      if (!gr.managerId) continue;
      if (!grandReportsByManagerId.has(gr.managerId)) grandReportsByManagerId.set(gr.managerId, []);
      grandReportsByManagerId.get(gr.managerId)!.push(gr);
    }

    // Batch-count everyone we're about to show a "N reports" badge for - manager, direct reports,
    // and grandchildren (focus's own count is just directReportRows.length, no query needed).
    const idsNeedingCounts = [manager?.id, ...directReportIds, ...grandReportRows.map(u => u.id)].filter((id): id is string => !!id);
    const countByManagerId = new Map<string, number>();
    if (idsNeedingCounts.length > 0) {
      const countRows = await db
        .select({ managerId: users.managerId, count: sql<number>`count(*)` })
        .from(users)
        .where(and(inArray(users.managerId, idsNeedingCounts), eq(users.isActive, true)))
        .groupBy(users.managerId);
      for (const row of countRows) {
        if (row.managerId) countByManagerId.set(row.managerId, Number(row.count));
      }
    }

    const jobRoleIds = Array.from(new Set(
      [focusUser.jobRoleId, manager?.jobRoleId, ...directReportRows.map(u => u.jobRoleId), ...grandReportRows.map(u => u.jobRoleId)]
        .filter((id): id is string => !!id)
    ));
    const jobRolesById = new Map<string, JobRole>();
    for (const roleId of jobRoleIds) {
      const role = await this.getJobRole(roleId);
      if (role) jobRolesById.set(roleId, role);
    }

    const toPerson = (u: User, directReportCount: number): OrgChartPerson => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown',
      email: u.email,
      jobRoleName: u.jobRoleId ? (jobRolesById.get(u.jobRoleId)?.name || null) : null,
      location: u.location,
      profileImageUrl: u.profileImageUrl || null,
      directReportCount,
    });

    const directReports = directReportRows
      .map(u => ({
        ...toPerson(u, countByManagerId.get(u.id) || 0),
        reports: (grandReportsByManagerId.get(u.id) || [])
          .map(gr => toPerson(gr, countByManagerId.get(gr.id) || 0))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      focus: toPerson(focusUser, directReportRows.length),
      manager: manager ? toPerson(manager, countByManagerId.get(manager.id) || 0) : null,
      directReports,
    };
  }

  async getSkillsGapAnalysis(userId: string): Promise<SkillsGapAnalysis | null> {
    // 1. Get user
    const user = await this.getUser(userId);
    if (!user || !user.jobRoleId) {
      return null;
    }

    // 2. Get job role
    const jobRole = await this.getJobRole(user.jobRoleId);
    if (!jobRole) {
      return null;
    }

    // 3. Get all role elements for this job role
    const roleElementsList = await this.getRoleElementsWithDetails(user.jobRoleId);

    // 4. Get all assessments for the user
    const userAssessments = await this.getAssessments(userId);

    // 5. Calculate status for each element
    const now = new Date();
    const elements = roleElementsList.map(roleElement => {
      // Find the most recent assessment for this element
      const elementAssessments = userAssessments.filter(
        a => a.elementId === roleElement.elementId && a.outcome === 'competent'
      );
      
      // Sort by assessment date descending to get the most recent
      elementAssessments.sort((a, b) => {
        const dateA = a.assessmentDate ? new Date(a.assessmentDate).getTime() : 0;
        const dateB = b.assessmentDate ? new Date(b.assessmentDate).getTime() : 0;
        return dateB - dateA;
      });
      
      const latestAssessment = elementAssessments[0];
      
      let status: 'current' | 'expiring_30' | 'expiring_60' | 'expiring_90' | 'expired' | 'missing' = 'missing';
      let daysUntilExpiry: number | undefined;
      
      if (latestAssessment && latestAssessment.expiryDate) {
        const expiryDate = new Date(latestAssessment.expiryDate);
        const daysRemaining = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        daysUntilExpiry = daysRemaining;
        
        if (daysRemaining < 0) {
          status = 'expired';
        } else if (daysRemaining <= 30) {
          status = 'expiring_30';
        } else if (daysRemaining <= 60) {
          status = 'expiring_60';
        } else if (daysRemaining <= 90) {
          status = 'expiring_90';
        } else {
          status = 'current';
        }
      } else if (latestAssessment && !latestAssessment.expiryDate) {
        status = 'current';
      }
      
      return {
        element: roleElement.element,
        required: roleElement.required,
        requirementLevel: roleElement.requirementLevel || 'M',
        safetyCritical: roleElement.safetyCritical ?? (roleElement.element.safetyCriticality === 'High'),
        status,
        assessment: latestAssessment,
        daysUntilExpiry,
      };
    });

    // 6. Calculate statistics
    const requiredElements = elements.filter(e => e.required);
    const optionalElements = elements.filter(e => !e.required);
    
    const statistics = {
      totalRequired: requiredElements.length,
      totalOptional: optionalElements.length,
      current: requiredElements.filter(e => e.status === 'current').length,
      expiringSoon30: requiredElements.filter(e => e.status === 'expiring_30').length,
      expiringSoon60: requiredElements.filter(e => e.status === 'expiring_60').length,
      expiringSoon90: requiredElements.filter(e => e.status === 'expiring_90').length,
      expired: requiredElements.filter(e => e.status === 'expired').length,
      missing: requiredElements.filter(e => e.status === 'missing').length,
      coveragePercentage: requiredElements.length > 0 
        ? Math.round((requiredElements.filter(e => e.status === 'current').length / requiredElements.length) * 100)
        : 0,
    };

    return {
      user,
      jobRole,
      elements,
      statistics,
    };
  }

  // Lower rank = better. Used to pick a 1-of-N group's overall status from its members.
  private static readonly TRAINING_STATUS_RANK: Record<ElementStatus, number> = {
    current: 0,
    expiring_90: 1,
    expiring_60: 2,
    expiring_30: 3,
    expired: 4,
    missing: 5,
  };

  async getTrainingComplianceStatus(userId: string): Promise<TrainingComplianceAnalysis | null> {
    const user = await this.getUser(userId);
    if (!user || !user.jobRoleId) {
      return null;
    }

    const jobRole = await this.getJobRole(user.jobRoleId);
    if (!jobRole) {
      return null;
    }

    const roleTrainingsList = await this.getRoleTrainingsWithDetails(user.jobRoleId);
    const userEnrollments = await this.getTrainingEnrollments(userId);
    const now = new Date();

    const statusForTraining = (trainingId: string): { status: ElementStatus; enrollment?: TrainingEnrollment; daysUntilExpiry?: number } => {
      const completions = userEnrollments
        .filter(e => e.trainingId === trainingId && e.achievementDate)
        .sort((a, b) => new Date(b.achievementDate!).getTime() - new Date(a.achievementDate!).getTime());
      const latest = completions[0];

      if (!latest) return { status: "missing" };

      if (latest.expiryDate) {
        const daysRemaining = Math.floor((new Date(latest.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let status: ElementStatus;
        if (daysRemaining < 0) status = "expired";
        else if (daysRemaining <= 30) status = "expiring_30";
        else if (daysRemaining <= 60) status = "expiring_60";
        else if (daysRemaining <= 90) status = "expiring_90";
        else status = "current";
        return { status, enrollment: latest, daysUntilExpiry: daysRemaining };
      }

      return { status: "current", enrollment: latest };
    };

    // Group role_trainings by groupId - ungrouped ones are their own group of one.
    const groupedByKey = new Map<string, typeof roleTrainingsList>();
    for (const rt of roleTrainingsList) {
      const key = rt.groupId ?? `single:${rt.id}`;
      if (!groupedByKey.has(key)) groupedByKey.set(key, []);
      groupedByKey.get(key)!.push(rt);
    }

    const groupLabels = new Map<string, string | null>();
    const groupIds = Array.from(new Set(roleTrainingsList.map(rt => rt.groupId).filter((id): id is string => !!id)));
    if (groupIds.length > 0) {
      const groups = await db.select().from(trainingRequirementGroups).where(inArray(trainingRequirementGroups.id, groupIds));
      for (const g of groups) groupLabels.set(g.id, g.label);
    }

    const items: TrainingComplianceAnalysis["items"] = Array.from(groupedByKey.entries()).map(([key, members]) => {
      const memberResults = members.map(m => {
        const result = statusForTraining(m.trainingId);
        return { training: m.training, requirementLevel: m.requirementLevel || 'M', status: result.status, enrollment: result.enrollment, daysUntilExpiry: result.daysUntilExpiry };
      });
      const best = memberResults.reduce((a, b) =>
        DbStorage.TRAINING_STATUS_RANK[a.status] <= DbStorage.TRAINING_STATUS_RANK[b.status] ? a : b
      );
      const groupId = key.startsWith("single:") ? null : key;
      const label = groupId
        ? (groupLabels.get(groupId) || members.map(m => m.training.name).join(" OR "))
        : members[0].training.name;

      return {
        groupId,
        label,
        required: members.some(m => m.required ?? true),
        requirementLevel: members[0]?.requirementLevel || 'M',
        status: best.status,
        members: memberResults,
      };
    });

    const requiredItems = items.filter(i => i.required);
    const optionalItems = items.filter(i => !i.required);

    const statistics = {
      totalRequired: requiredItems.length,
      totalOptional: optionalItems.length,
      current: requiredItems.filter(i => i.status === 'current').length,
      expiringSoon30: requiredItems.filter(i => i.status === 'expiring_30').length,
      expiringSoon60: requiredItems.filter(i => i.status === 'expiring_60').length,
      expiringSoon90: requiredItems.filter(i => i.status === 'expiring_90').length,
      expired: requiredItems.filter(i => i.status === 'expired').length,
      missing: requiredItems.filter(i => i.status === 'missing').length,
      coveragePercentage: requiredItems.length > 0
        ? Math.round((requiredItems.filter(i => i.status === 'current').length / requiredItems.length) * 100)
        : 0,
    };

    return { user, jobRole, items, statistics };
  }

  async getRoleTransitionPlan(userId: string, targetRoleId: string): Promise<RoleTransitionPlan | null> {
    // 1. Get user
    const user = await this.getUser(userId);
    if (!user) {
      return null;
    }

    // 2. Get target role
    const targetRole = await this.getJobRole(targetRoleId);
    if (!targetRole) {
      return null;
    }

    // 3. Get current role (may be null if the user has no role assigned yet)
    const currentRole = (user.jobRoleId ? await this.getJobRole(user.jobRoleId) : null) ?? null;

    // 4. Get elements required by the current role (to identify genuinely new requirements) and the target role
    const currentRoleElementsList = user.jobRoleId ? await this.getRoleElementsWithDetails(user.jobRoleId) : [];
    const currentRoleElementIds = new Set(currentRoleElementsList.map(re => re.elementId));
    const targetRoleElementsList = await this.getRoleElementsWithDetails(targetRoleId);

    // 5. Get all assessments for the user
    const userAssessments = await this.getAssessments(userId);

    // 6. Calculate status for each target-role element, same logic as skills gap analysis
    const now = new Date();
    const elements = targetRoleElementsList.map(roleElement => {
      const elementAssessments = userAssessments.filter(
        a => a.elementId === roleElement.elementId && a.outcome === 'competent'
      );

      elementAssessments.sort((a, b) => {
        const dateA = a.assessmentDate ? new Date(a.assessmentDate).getTime() : 0;
        const dateB = b.assessmentDate ? new Date(b.assessmentDate).getTime() : 0;
        return dateB - dateA;
      });

      const latestAssessment = elementAssessments[0];

      let status: ElementStatus = 'missing';
      let daysUntilExpiry: number | undefined;

      if (latestAssessment && latestAssessment.expiryDate) {
        const expiryDate = new Date(latestAssessment.expiryDate);
        const daysRemaining = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        daysUntilExpiry = daysRemaining;

        if (daysRemaining < 0) {
          status = 'expired';
        } else if (daysRemaining <= 30) {
          status = 'expiring_30';
        } else if (daysRemaining <= 60) {
          status = 'expiring_60';
        } else if (daysRemaining <= 90) {
          status = 'expiring_90';
        } else {
          status = 'current';
        }
      } else if (latestAssessment && !latestAssessment.expiryDate) {
        status = 'current';
      }

      return {
        element: roleElement.element,
        requiredByTarget: roleElement.required ?? true,
        status,
        assessment: latestAssessment,
        daysUntilExpiry,
        alreadyRequiredByCurrentRole: currentRoleElementIds.has(roleElement.elementId),
      };
    });

    // 7. Calculate statistics (based on elements required by the target role)
    const requiredElements = elements.filter(e => e.requiredByTarget);
    const alreadyMet = requiredElements.filter(e => e.status === 'current').length;
    const newRequirements = requiredElements.filter(e => !e.alreadyRequiredByCurrentRole).length;

    const statistics = {
      totalRequiredByTarget: requiredElements.length,
      alreadyMet,
      gapsToClose: requiredElements.length - alreadyMet,
      newRequirements,
      coveragePercentage: requiredElements.length > 0
        ? Math.round((alreadyMet / requiredElements.length) * 100)
        : 0,
    };

    return {
      user,
      currentRole,
      targetRole,
      elements,
      statistics,
    };
  }

  async getDistinctLocations(): Promise<string[]> {
    const rows = await db.selectDistinct({ location: users.location })
      .from(users)
      .where(and(eq(users.isActive, true), eq(users.isArchived, false)));

    return rows
      .map(r => r.location?.trim())
      .filter((location): location is string => !!location)
      .sort((a, b) => a.localeCompare(b));
  }

  async getTeamComplianceMatrix(roleId: string, location: string): Promise<TeamComplianceMatrix | null> {
    const jobRole = await this.getJobRole(roleId);
    if (!jobRole) {
      return null;
    }

    const roleElementsList = await this.getRoleElementsWithDetails(roleId);

    const now = new Date();
    const members = await db.select().from(users).where(and(
      eq(users.jobRoleId, roleId),
      eq(users.location, location),
      eq(users.isActive, true),
      this.notArchivedOrNotYetLeft(now),
    ));

    const memberResults = await Promise.all(members.map(async (member) => {
      const memberAssessments = await this.getAssessments(member.id);

      const elements = roleElementsList.map(roleElement => {
        const elementAssessments = memberAssessments.filter(
          a => a.elementId === roleElement.elementId && a.outcome === 'competent'
        );

        elementAssessments.sort((a, b) => {
          const dateA = a.assessmentDate ? new Date(a.assessmentDate).getTime() : 0;
          const dateB = b.assessmentDate ? new Date(b.assessmentDate).getTime() : 0;
          return dateB - dateA;
        });

        const latestAssessment = elementAssessments[0];

        let status: ElementStatus = 'missing';
        let daysUntilExpiry: number | undefined;

        if (latestAssessment && latestAssessment.expiryDate) {
          const expiryDate = new Date(latestAssessment.expiryDate);
          const daysRemaining = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          daysUntilExpiry = daysRemaining;

          if (daysRemaining < 0) {
            status = 'expired';
          } else if (daysRemaining <= 30) {
            status = 'expiring_30';
          } else if (daysRemaining <= 60) {
            status = 'expiring_60';
          } else if (daysRemaining <= 90) {
            status = 'expiring_90';
          } else {
            status = 'current';
          }
        } else if (latestAssessment && !latestAssessment.expiryDate) {
          status = 'current';
        }

        return {
          element: roleElement.element,
          required: roleElement.required ?? true,
          status,
          daysUntilExpiry,
        };
      });

      const requiredElements = elements.filter(e => e.required);
      const coveragePercentage = requiredElements.length > 0
        ? Math.round((requiredElements.filter(e => e.status === 'current').length / requiredElements.length) * 100)
        : 0;

      return {
        user: member,
        elements,
        coveragePercentage,
      };
    }));

    return {
      jobRole,
      location,
      requiredElements: roleElementsList.filter(re => re.required ?? true).map(re => re.element),
      members: memberResults,
    };
  }

  // Notification Settings operations
  async getNotificationSettings(): Promise<NotificationSetting[]> {
    return await db.select().from(notificationSettings).orderBy(desc(notificationSettings.createdAt));
  }

  async getNotificationSetting(id: string): Promise<NotificationSetting | undefined> {
    const result = await db.select().from(notificationSettings).where(eq(notificationSettings.id, id));
    return result[0];
  }

  async createNotificationSetting(setting: InsertNotificationSetting): Promise<NotificationSetting> {
    const result = await db.insert(notificationSettings).values(setting).returning();
    return result[0];
  }

  async updateNotificationSetting(id: string, setting: Partial<InsertNotificationSetting>): Promise<NotificationSetting | undefined> {
    const result = await db.update(notificationSettings).set({
      ...setting,
      updatedAt: new Date(),
    }).where(eq(notificationSettings.id, id)).returning();
    return result[0];
  }

  async deleteNotificationSetting(id: string): Promise<boolean> {
    const result = await db.delete(notificationSettings).where(eq(notificationSettings.id, id));
    return result.rowCount > 0;
  }

  // Notification Logs operations
  async getNotificationLogs(filters?: { recipientId?: string; status?: string; settingId?: string }): Promise<NotificationLog[]> {
    const query = db.select().from(notificationLogs);
    const conditions: any[] = [];

    if (filters?.recipientId) conditions.push(eq(notificationLogs.recipientId, filters.recipientId));
    if (filters?.status) conditions.push(eq(notificationLogs.status, filters.status));
    if (filters?.settingId) conditions.push(eq(notificationLogs.settingId, filters.settingId));

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(notificationLogs.createdAt));
    }

    return await query.orderBy(desc(notificationLogs.createdAt));
  }

  async getNotificationLog(id: string): Promise<NotificationLog | undefined> {
    const result = await db.select().from(notificationLogs).where(eq(notificationLogs.id, id));
    return result[0];
  }

  async createNotificationLog(log: InsertNotificationLog): Promise<NotificationLog> {
    const result = await db.insert(notificationLogs).values(log).returning();
    return result[0];
  }

}
