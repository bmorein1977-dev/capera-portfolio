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
  type NotificationSetting,
  type InsertNotificationSetting,
  type NotificationLog,
  type InsertNotificationLog,
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
  users,
  competencyCategories,
  competencyElements,
  competenceSubcategories,
  competenceCriteria,
  competencies,
  jobRoles,
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
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, or, asc, desc, isNull, sql, leftJoin, inArray, ilike } from "drizzle-orm";

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
  getUserLanguagePreference(userId: string): Promise<any | null>;
  createOrUpdateUserLanguagePreference(userId: string, preferences: {
    primaryLanguage: string;
    fallbackLanguage: string;
    autoTranslate: boolean;
  }): Promise<any>;

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
  }): Promise<Assessment | undefined>;
  deleteAssessment(id: string): Promise<boolean>;
  getAssessmentsWithExpiry(assessorId?: string, candidateId?: string): Promise<Array<Assessment & { 
    candidateName: string; 
    elementName: string; 
    status: 'green' | 'amber' | 'red' | 'not_assessed';
    daysUntilExpiry?: number;
  }>>;

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

  // Historical Data Import operations
  processHistoricalImport(importData: Array<{
    userName: string;
    userRole: string;
    location?: string;
    teamShift?: string;
    jobRoleName?: string;
    dateOfBirth?: Date;
    companyNumber?: string;
    competenceCategoryName: string;
    competenceElementName: string;
    assessorName: string;
    assessmentDate: Date;
    validityYears: number;
    expiryDate: Date;
  }>, importedBy: string): Promise<{
    success: number;
    errors: Array<{ row: number; error: string }>;
    usersCreated: number;
    assessmentsCreated: number;
  }>;
  getCompetencyCategoryByName(name: string): Promise<CompetencyCategory | undefined>;
  getCompetencyElementByName(categoryId: string, name: string): Promise<CompetencyElement | undefined>;
  getJobRoleByName(name: string): Promise<JobRole | undefined>;
  
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
    userRole: string;
    location?: string;
    jobRoleName?: string;
    dateOfBirth?: Date;
    companyNumber?: string;
    competenceCategoryName: string;
    competenceElementName: string;
    assessorName: string;
    assessmentDate: Date;
    validityYears: number;
    expiryDate: Date;
  }>, importedBy: string): Promise<{
    success: number;
    errors: Array<{ row: number; error: string }>;
    usersCreated: number;
    assessmentsCreated: number;
  }> {
    const errors: Array<{ row: number; error: string }> = [];
    const usersCreated = new Set<string>();
    let assessmentsCreated = 0;

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

        // 3. Generate email from name if user doesn't exist
        const emailBase = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@imported.local`;

        // 4. Look up or create user
        let user = await this.getUserByEmail(emailBase);
        
        if (!user) {
          // Look up job role if provided
          let jobRoleId: string | undefined;
          if (row.jobRoleName) {
            const jobRole = await this.getJobRoleByName(row.jobRoleName);
            if (!jobRole) {
              errors.push({ row: rowNumber, error: `Job role not found: "${row.jobRoleName}"` });
              continue;
            }
            jobRoleId = jobRole.id;
          }

          // Create new user
          user = await this.createUser({
            firstName,
            lastName,
            email: emailBase,
            role: normalizedRole,
            location: row.location,
            teamShift: row.teamShift,
            jobRoleId,
            dateOfBirth: row.dateOfBirth,
            companyNumber: row.companyNumber,
          });
          usersCreated.add(user.id);
        }

        // 5. Look up competency category
        const category = await this.getCompetencyCategoryByName(row.competenceCategoryName);
        if (!category) {
          errors.push({ row: rowNumber, error: `Competence category not found: "${row.competenceCategoryName}"` });
          continue;
        }

        // 6. Look up competency element
        const element = await this.getCompetencyElementByName(category.id, row.competenceElementName);
        if (!element) {
          errors.push({ row: rowNumber, error: `Competence element not found: "${row.competenceElementName}" in category "${row.competenceCategoryName}"` });
          continue;
        }

        // 7. Look up or create assessor
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
          // Create assessor user with "assessor" role
          assessor = await this.createUser({
            firstName: assessorFirstName,
            lastName: assessorLastName,
            email: assessorEmail,
            role: 'assessor',
          });
          usersCreated.add(assessor.id);
        }

        // 8. Create assessment with historical data
        const assessment = await this.createAssessment({
          candidateId: user.id,
          elementId: element.id,
          assessorId: assessor.id,
          assessmentDate: row.assessmentDate,
          outcome: 'competent', // Historical assessments are assumed competent
          assessmentMethods: [],
          assessorComments: 'Imported from legacy system',
          expiryDate: row.expiryDate,
        });
        assessmentsCreated++;

      } catch (error: any) {
        errors.push({ row: rowNumber, error: error.message });
      }
    }

    return {
      success: importData.length - errors.length,
      errors,
      usersCreated: usersCreated.size,
      assessmentsCreated,
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

  async getUserLanguagePreference(userId: string): Promise<any | null> {
    // Language preferences not implemented yet in database - return null for now
    return null;
  }

  async createOrUpdateUserLanguagePreference(userId: string, preferences: {
    primaryLanguage: string;
    fallbackLanguage: string;
    autoTranslate: boolean;
  }): Promise<any> {
    throw new Error("Method not implemented");
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
      required: boolean;
      requirementLevel: string | null;
      activityType: string | null;
      validityYears: number | null;
      safetyCritical: boolean | null;
    }>;
  } | undefined> {
    const role = await this.getJobRole(roleId);
    if (!role) return undefined;

    const elements = await db
      .select({
        id: roleElements.id,
        elementId: roleElements.elementId,
        elementName: competencyElements.name,
        required: roleElements.required,
        requirementLevel: roleElements.requirementLevel,
        activityType: roleElements.activityType,
        validityYears: roleElements.validityYears,
        safetyCritical: roleElements.safetyCritical,
      })
      .from(roleElements)
      .innerJoin(competencyElements, eq(roleElements.elementId, competencyElements.id))
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
    
    // Enrich with user data
    const enrichedAllocations = await Promise.all(
      allocations.map(async (allocation) => {
        const candidateUsers = await db.select().from(users).where(eq(users.id, allocation.candidateId));
        const candidate = candidateUsers[0];
        
        return {
          ...allocation,
          candidateName: candidate ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() : null,
          candidateEmail: candidate?.email || null,
          location: candidate?.location || null,
          jobRoleId: candidate?.jobRoleId || null,
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
    const result = await db.update(assessments).set(assessment).where(eq(assessments.id, id)).returning();
    return result[0];
  }

  async updateAssessmentSignOff(id: string, signOffData: {
    outcome: string;
    knowledgeOutcomes?: string;
    performanceOutcomes?: string;
    overallComment?: string;
    assessmentMethods?: string[];
    signOffAssessorId: string;
  }): Promise<Assessment | undefined> {
    const result = await db.update(assessments).set({
      outcome: signOffData.outcome,
      knowledgeOutcomes: signOffData.knowledgeOutcomes,
      performanceOutcomes: signOffData.performanceOutcomes,
      overallComment: signOffData.overallComment,
      assessmentMethods: signOffData.assessmentMethods,
      signOffAssessorId: signOffData.signOffAssessorId,
      signOffAt: new Date(),
    }).where(eq(assessments.id, id)).returning();
    return result[0];
  }

  async deleteAssessment(id: string): Promise<boolean> {
    const result = await db.update(assessments).set({ isActive: false }).where(eq(assessments.id, id));
    return result.rowCount > 0;
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
        sql`${users.id} = ANY(${assessorIds})`,
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
      const assessmentsList = await db.select().from(assessments).where(
        and(
          eq(assessments.assessorId, assessorId),
          eq(assessments.verificationStatus, 'not_verified'),
          eq(assessments.isActive, true)
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
    
    // Count total assessments
    const totalAssessments = await db.select({ count: sql`count(*)` })
      .from(assessments)
      .where(
        and(
          sql`${assessments.assessorId} = ANY(${assessorIds})`,
          eq(assessments.isActive, true)
        )
      );
    
    // Count verified assessments
    const verifiedAssessments = await db.select({ count: sql`count(*)` })
      .from(assessments)
      .where(
        and(
          sql`${assessments.assessorId} = ANY(${assessorIds})`,
          eq(assessments.verificationStatus, 'verified'),
          eq(assessments.isActive, true)
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
        return { training: m.training, status: result.status, enrollment: result.enrollment, daysUntilExpiry: result.daysUntilExpiry };
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

    const members = await db.select().from(users).where(and(
      eq(users.jobRoleId, roleId),
      eq(users.location, location),
      eq(users.isActive, true),
      eq(users.isArchived, false),
    ));

    const now = new Date();
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
