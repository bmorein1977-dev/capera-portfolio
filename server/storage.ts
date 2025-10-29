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
  type Competency,
  type InsertCompetency,
  type JobRole,
  type InsertJobRole,
  type RoleElement,
  type InsertRoleElement,
  type RoleTraining,
  type InsertRoleTraining,
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
  type NotificationSetting,
  type InsertNotificationSetting,
  type NotificationLog,
  type InsertNotificationLog,
  users,
  competencyCategories,
  competencyElements,
  competenceSubcategories,
  competenceCriteria,
  competencies,
  jobRoles,
  roleElements,
  roleTrainings,
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
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";

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
  getCompetenceSubcategories(elementId?: string, type?: 'knowledge' | 'performance'): Promise<CompetenceSubcategory[]>;
  getCompetenceSubcategory(id: string): Promise<CompetenceSubcategory | undefined>;
  createCompetenceSubcategory(subcategory: InsertCompetenceSubcategory): Promise<CompetenceSubcategory>;
  updateCompetenceSubcategory(id: string, subcategory: Partial<InsertCompetenceSubcategory>): Promise<CompetenceSubcategory | undefined>;
  deleteCompetenceSubcategory(id: string): Promise<boolean>;

  // Competence Criteria operations (K1.1, P1.1, etc.)
  getCompetenceCriteria(filters?: { subcategoryId?: string; elementId?: string; type?: 'knowledge' | 'performance' }): Promise<CompetenceCriteria[]>;
  getCompetenceCriterion(id: string): Promise<CompetenceCriteria | undefined>;
  createCompetenceCriteria(criteria: InsertCompetenceCriteria): Promise<CompetenceCriteria>;
  updateCompetenceCriteria(id: string, criteria: Partial<InsertCompetenceCriteria>): Promise<CompetenceCriteria | undefined>;
  deleteCompetenceCriteria(id: string): Promise<boolean>;
  generateCompetenceCriteriaCode(elementId: string, type: 'knowledge' | 'performance', subcategoryId?: string): Promise<string>;

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
  
  // Role Elements operations (competence elements assigned to job roles)
  getRoleElements(roleId: string): Promise<RoleElement[]>;
  getRoleElementsWithDetails(roleId: string): Promise<Array<RoleElement & { element: CompetencyElement }>>;
  
  // Role Trainings operations (training courses assigned to job roles)
  getRoleTrainings(roleId: string): Promise<RoleTraining[]>;
  getRoleTrainingsWithDetails(roleId: string): Promise<Array<RoleTraining & { training: Training }>>;
  
  // Auto-assignment operations
  assignJobRoleToUser(userId: string, roleId: string, allocatedBy?: string): Promise<{ assessmentsCreated: number; trainingsEnrolled: number }>;
  addCompetenceElementToUser(userId: string, elementId: string, assessorId?: string): Promise<Assessment>;
  addTrainingToUser(userId: string, trainingId: string, allocatedBy?: string): Promise<{ enrollment: TrainingEnrollment; isNew: boolean }>;

  // Bulk assignment operations
  bulkAssignJobRole(userIds: string[], roleId: string, allocatedBy: string): Promise<{ successful: number; failed: Array<{ userId: string; error: string }>; totalAssessmentsCreated: number }>;
  bulkAssignCompetenceElement(userIds: string[], elementId: string, assessorId: string): Promise<{ successful: number; failed: Array<{ userId: string; error: string }>; totalAssessmentsCreated: number }>;
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

  // Role Elements operations (element-level job role assignments)
  getRoleElements(roleId?: string, elementId?: string): Promise<RoleElement[]>;
  getRoleElement(id: string): Promise<RoleElement | undefined>;
  createRoleElement(roleElement: InsertRoleElement): Promise<RoleElement>;
  updateRoleElement(id: string, roleElement: Partial<InsertRoleElement>): Promise<RoleElement | undefined>;
  deleteRoleElement(id: string): Promise<boolean>;
  getRoleMatrix(roleId: string): Promise<{ role: JobRole; elements: Array<{ elementId: string; elementName: string; required: boolean }> }>;

  // Training Enrollment operations
  getTrainingEnrollments(userId?: string, trainingId?: string): Promise<TrainingEnrollment[]>;
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
        and(eq(competencyElements.categoryId, categoryId), eq(competencyElements.isActive, true))
      );
    }
    return await db.select().from(competencyElements).where(eq(competencyElements.isActive, true));
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
  async getCompetenceSubcategories(elementId?: string, type?: 'knowledge' | 'performance'): Promise<CompetenceSubcategory[]> {
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
  async getCompetenceCriteria(filters?: { subcategoryId?: string; elementId?: string; type?: 'knowledge' | 'performance' }): Promise<CompetenceCriteria[]> {
    let query = db.select().from(competenceCriteria).where(eq(competenceCriteria.isActive, true));
    
    if (filters?.subcategoryId) {
      query = query.where(eq(competenceCriteria.subcategoryId, filters.subcategoryId));
    }
    if (filters?.elementId) {
      query = query.where(eq(competenceCriteria.elementId, filters.elementId));
    }
    if (filters?.type) {
      query = query.where(eq(competenceCriteria.type, filters.type));
    }
    
    return await query;
  }

  async getCompetenceCriterion(id: string): Promise<CompetenceCriteria | undefined> {
    const result = await db.select().from(competenceCriteria).where(eq(competenceCriteria.id, id));
    return result[0];
  }

  async createCompetenceCriteria(criteria: InsertCompetenceCriteria): Promise<CompetenceCriteria> {
    return db.transaction(async (tx) => {
      let code: string;
      let guidanceNumber: string | null = null;
      let criteriaNumber: number;
      let subcategoryNumber: number | null = null;

      if (criteria.subcategoryId) {
        // Subcategory-level criteria (K 1.1, P 1.1 format with space)
        const existingCriteria = await tx.select().from(competenceCriteria).where(
          and(
            eq(competenceCriteria.subcategoryId, criteria.subcategoryId),
            eq(competenceCriteria.type, criteria.type),  // CRITICAL: Filter by type for independent K/P numbering
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
        code = `${criteria.type === 'knowledge' ? 'K' : 'P'} ${subcategoryNumber}.${criteriaNumber}`;
        
        // V2: Generate guidance number (KG/PG) if guidance text is provided
        if (criteria.assessorGuidance && criteria.assessorGuidance.trim()) {
          guidanceNumber = `${criteria.type === 'knowledge' ? 'KG' : 'PG'} ${subcategoryNumber}.${criteriaNumber}`;
        }
      } else {
        // Element-level criteria (K 1, P 1 format with space)
        const existingCriteria = await tx.select().from(competenceCriteria).where(
          and(
            eq(competenceCriteria.elementId, criteria.elementId),
            eq(competenceCriteria.type, criteria.type),
            isNull(competenceCriteria.subcategoryId),
            eq(competenceCriteria.isActive, true)
          )
        );
        
        criteriaNumber = existingCriteria.length + 1;
        // V2: Add space between prefix and number
        code = `${criteria.type === 'knowledge' ? 'K' : 'P'} ${criteriaNumber}`;
        
        // V2: Generate guidance number (KG/PG) if guidance text is provided
        if (criteria.assessorGuidance && criteria.assessorGuidance.trim()) {
          guidanceNumber = `${criteria.type === 'knowledge' ? 'KG' : 'PG'} ${criteriaNumber}`;
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

  async generateCompetenceCriteriaCode(elementId: string, type: 'knowledge' | 'performance', subcategoryId?: string): Promise<string> {
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
      return `${type === 'knowledge' ? 'K' : 'P'} ${subcategory.order}.${nextNumber}`;
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
      return `${type === 'knowledge' ? 'K' : 'P'} ${nextNumber}`;
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
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return result[0];
  }

  async createBulkUsers(users: InsertUser[]): Promise<{ success: User[], failed: { user: InsertUser, error: string }[] }> {
    throw new Error("Method not implemented");
  }

  async importClientStandards(file: Buffer, elementId: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    throw new Error("Method not implemented");
  }

  async getCompetencies(filters?: { elementId?: string; type?: string; critical?: boolean; safetyCritical?: boolean }): Promise<Competency[]> {
    throw new Error("Method not implemented");
  }

  async getCompetency(id: string): Promise<Competency | undefined> {
    throw new Error("Method not implemented");
  }

  async createCompetency(competency: InsertCompetency): Promise<Competency> {
    throw new Error("Method not implemented");
  }

  async updateCompetency(id: string, competency: Partial<InsertCompetency>): Promise<Competency | undefined> {
    throw new Error("Method not implemented");
  }

  async deleteCompetency(id: string): Promise<boolean> {
    throw new Error("Method not implemented");
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

  // Assessment operations
  async getAssessments(candidateId?: string, assessorId?: string, elementId?: string): Promise<Assessment[]> {
    const query = db.select().from(assessments);
    const conditions: any[] = [eq(assessments.isActive, true)];
    
    if (candidateId) conditions.push(eq(assessments.candidateId, candidateId));
    if (assessorId) conditions.push(eq(assessments.assessorId, assessorId));
    if (elementId) conditions.push(eq(assessments.elementId, elementId));
    
    return await query.where(and(...conditions)).orderBy(desc(assessments.assessmentDate));
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

  async deleteAssessment(id: string): Promise<boolean> {
    const result = await db.update(assessments).set({ isActive: false }).where(eq(assessments.id, id));
    return result.rowCount > 0;
  }

  // Role Elements operations
  async getRoleElements(roleId: string): Promise<RoleElement[]> {
    return await db.select().from(roleElements)
      .where(and(
        eq(roleElements.roleId, roleId),
        eq(roleElements.isActive, true)
      ));
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
      ));
    
    return roleTrainingRows
      .filter(t => t.training)
      .map(t => ({
        ...t.roleTraining,
        training: t.training!
      }));
  }

  // Auto-assignment operations
  async assignJobRoleToUser(userId: string, roleId: string, allocatedBy?: string): Promise<{ assessmentsCreated: number; trainingsEnrolled: number }> {
    let assessmentsCreated = 0;
    let trainingsEnrolled = 0;

    // Get all competence elements for this role
    const roleElementsList = await this.getRoleElements(roleId);

    // Create assessments for each element (only if not already exists)
    for (const roleElement of roleElementsList) {
      // Check if assessment already exists
      const existingAssessments = await this.getAssessments(userId, undefined, roleElement.elementId);
      
      if (existingAssessments.length === 0) {
        // Create new assessment with "not_yet_competent" status
        await this.createAssessment({
          candidateId: userId,
          elementId: roleElement.elementId,
          assessorId: allocatedBy || 'unassigned', // Will be assigned later
          outcome: 'not_yet_competent',
          assessmentMethods: [],
          assessorComments: 'Auto-assigned from job role',
        });
        assessmentsCreated++;
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

  async addCompetenceElementToUser(userId: string, elementId: string, assessorId?: string): Promise<Assessment> {
    // Check if assessment already exists
    const existingAssessments = await this.getAssessments(userId, undefined, elementId);
    
    if (existingAssessments.length > 0) {
      return existingAssessments[0];
    }

    // Create new assessment
    return await this.createAssessment({
      candidateId: userId,
      elementId: elementId,
      assessorId: assessorId || 'unassigned',
      outcome: 'not_yet_competent',
      assessmentMethods: [],
      assessorComments: 'Manually assigned competence element',
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
        // Assessment exists but no expiry date - consider it current
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

  async bulkAssignCompetenceElement(userIds: string[], elementId: string, assessorId: string): Promise<{
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

        await this.addCompetenceElementToUser(userId, elementId, assessorId);
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
    throw new Error("Method not implemented");
  }

  async getTrainingCategory(id: string): Promise<TrainingCategory | undefined> {
    throw new Error("Method not implemented");
  }

  async createTrainingCategory(category: InsertTrainingCategory): Promise<TrainingCategory> {
    throw new Error("Method not implemented");
  }

  async updateTrainingCategory(id: string, category: Partial<InsertTrainingCategory>): Promise<TrainingCategory | undefined> {
    throw new Error("Method not implemented");
  }

  async deleteTrainingCategory(id: string): Promise<boolean> {
    throw new Error("Method not implemented");
  }

  async getTrainings(categoryId?: string): Promise<Training[]> {
    throw new Error("Method not implemented");
  }

  async getTraining(id: string): Promise<Training | undefined> {
    throw new Error("Method not implemented");
  }

  async createTraining(training: InsertTraining): Promise<Training> {
    throw new Error("Method not implemented");
  }

  async updateTraining(id: string, training: Partial<InsertTraining>): Promise<Training | undefined> {
    throw new Error("Method not implemented");
  }

  async deleteTraining(id: string): Promise<boolean> {
    throw new Error("Method not implemented");
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
    const result: ExcelImportResult = {
      successCount: 0,
      errorCount: 0,
      errors: [],
      warnings: []
    };

    // Track created categories and elements to avoid duplicates
    const createdCategories = new Map<string, string>();
    const createdElements = new Map<string, string>();
    const createdSubcategories = new Map<string, string>();
    let categoryCodeCounter = 1;
    let elementCodeCounter = 1;

    // Helper function to generate category code
    const generateCategoryCode = (name: string): string => {
      const cleaned = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const prefix = cleaned.substring(0, 3) || 'CAT';
      return `${prefix}${categoryCodeCounter++}`;
    };

    // Helper function to generate element code
    const generateElementCode = (categoryCode: string, name: string): string => {
      const cleaned = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const prefix = cleaned.substring(0, 2) || 'EL';
      return `${categoryCode}_${prefix}${elementCodeCounter++}`;
    };

    for (const row of rows) {
      try {
        // 1. Create or find competency category
        const categoryKey = row.category.toLowerCase().trim();
        let categoryId = createdCategories.get(categoryKey);
        
        if (!categoryId) {
          // Check if category exists
          const existingCategory = await db.select().from(competencyCategories)
            .where(eq(competencyCategories.name, row.category));
          
          if (existingCategory.length > 0) {
            categoryId = existingCategory[0].id;
          } else {
            // Generate unique category code
            const categoryCode = generateCategoryCode(row.category);
            
            // Create new category with code
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
          // Check if element exists for this category
          const existingElement = await db.select().from(competencyElements)
            .where(and(
              eq(competencyElements.categoryId, categoryId),
              eq(competencyElements.name, row.element)
            ));
          
          if (existingElement.length > 0) {
            elementId = existingElement[0].id;
          } else {
            // Generate element code
            const elementCode = generateElementCode(categoryCode, row.element);
            
            // Create new element with optional code
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

        // 4. Create competence criteria
        const criteriaData: InsertCompetenceCriteria = {
          elementId: elementId,
          subcategoryId: subcategoryId,
          criteriaText: row.description, // V2: Use criteriaText instead of description
          type: row.type,
          assessorGuidance: row.assessorGuidance || null,
          assessmentMethods: row.assessmentMethods || null
        };

        await this.createCompetenceCriteria(criteriaData);
        result.successCount++;

      } catch (error) {
        result.errorCount++;
        result.errors.push({
          row: row.rowNumber || result.successCount + result.errorCount,
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }

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
    const result = await db.insert(roleElements).values(roleElement).returning();
    return result[0];
  }

  async updateRoleElement(id: string, roleElement: Partial<InsertRoleElement>): Promise<RoleElement | undefined> {
    const result = await db.update(roleElements).set(roleElement).where(eq(roleElements.id, id)).returning();
    return result[0];
  }

  async deleteRoleElement(id: string): Promise<boolean> {
    const result = await db.update(roleElements).set({ isActive: false }).where(eq(roleElements.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getRoleMatrix(roleId: string): Promise<{
    role: JobRole;
    elements: Array<{
      id: string;
      elementId: string;
      elementName: string;
      required: boolean;
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
      })
      .from(roleElements)
      .innerJoin(competencyElements, eq(roleElements.elementId, competencyElements.id))
      .where(and(
        eq(roleElements.roleId, roleId),
        eq(roleElements.isActive, true)
      ));

    return {
      role,
      elements,
    };
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private competencyCategories: Map<string, CompetencyCategory>;
  private competencyElements: Map<string, CompetencyElement>;
  private competenceSubcategories: Map<string, CompetenceSubcategory>;
  private competenceCriteria: Map<string, CompetenceCriteria>;
  private competencies: Map<string, Competency>;
  private jobRoles: Map<string, JobRole>;
  private competencyMatrix: Map<string, CompetencyMatrix>;
  private competencyCertifications: Map<string, CompetencyCertification>;
  private expiryAlerts: Map<string, ExpiryAlert>;
  private trainingCategories: Map<string, TrainingCategory>;
  private trainings: Map<string, Training>;
  private trainingLevels: Map<string, TrainingLevel>;
  private trainingCertificates: Map<string, TrainingCertificate>;
  private languagePreferences: Map<string, any>;

  constructor() {
    this.users = new Map();
    this.competencyCategories = new Map();
    this.competencyElements = new Map();
    this.competenceSubcategories = new Map();
    this.competenceCriteria = new Map();
    this.competencies = new Map();
    this.jobRoles = new Map();
    this.competencyMatrix = new Map();
    this.competencyCertifications = new Map();
    this.expiryAlerts = new Map();
    this.trainingCategories = new Map();
    this.trainings = new Map();
    this.trainingLevels = new Map();
    this.trainingCertificates = new Map();
    this.languagePreferences = new Map();
    this.initializeMockTrainingData();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = { 
      id,
      email: insertUser.email || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profileImageUrl: null,
      role: insertUser.role || "candidate",
      department: insertUser.department || null,
      location: insertUser.location || null,
      jobRoleId: insertUser.jobRoleId || null,
      dateOfBirth: insertUser.dateOfBirth || null,
      companyNumber: insertUser.companyNumber || null,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, user);
    return user;
  }

  async createBulkUsers(users: InsertUser[]): Promise<{ success: User[], failed: { user: InsertUser, error: string }[] }> {
    const success: User[] = [];
    const failed: { user: InsertUser, error: string }[] = [];

    for (const insertUser of users) {
      try {
        // Check if user with this email already exists
        if (insertUser.email) {
          const existingUser = await this.getUserByEmail(insertUser.email);
          if (existingUser) {
            failed.push({ user: insertUser, error: `User with email ${insertUser.email} already exists` });
            continue;
          }
        }

        // Validate required fields
        if (!insertUser.email || !insertUser.firstName || !insertUser.lastName) {
          failed.push({ user: insertUser, error: 'Missing required fields: email, firstName, lastName' });
          continue;
        }

        const createdUser = await this.createUser(insertUser);
        success.push(createdUser);
      } catch (error) {
        failed.push({ user: insertUser, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return { success, failed };
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (!userData.id) {
      throw new Error("User ID is required for upsert operation");
    }
    
    const existingUser = this.users.get(userData.id);
    const now = new Date();
    
    if (existingUser) {
      const updatedUser: User = {
        ...existingUser,
        email: userData.email ?? existingUser.email,
        firstName: userData.firstName ?? existingUser.firstName,
        lastName: userData.lastName ?? existingUser.lastName,
        profileImageUrl: userData.profileImageUrl ?? existingUser.profileImageUrl,
        updatedAt: now
      };
      this.users.set(userData.id, updatedUser);
      return updatedUser;
    } else {
      const newUser: User = {
        id: userData.id,
        email: userData.email ?? null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        role: "candidate", // Default role for new users
        department: null,
        location: null,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };
      this.users.set(userData.id, newUser);
      return newUser;
    }
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...userData,
      updatedAt: new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Competency Category operations
  async getCompetencyCategories(): Promise<CompetencyCategory[]> {
    return Array.from(this.competencyCategories.values())
      .filter(cat => cat.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getCompetencyCategory(id: string): Promise<CompetencyCategory | undefined> {
    return this.competencyCategories.get(id);
  }

  async createCompetencyCategory(category: InsertCompetencyCategory): Promise<CompetencyCategory> {
    const id = randomUUID();
    const now = new Date();
    const newCategory: CompetencyCategory = {
      ...category,
      id,
      description: category.description ?? null,
      parentId: category.parentId ?? null,
      isActive: category.isActive ?? true,
      order: category.order ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.competencyCategories.set(id, newCategory);
    return newCategory;
  }

  async updateCompetencyCategory(id: string, category: Partial<InsertCompetencyCategory>): Promise<CompetencyCategory | undefined> {
    const existing = this.competencyCategories.get(id);
    if (!existing) return undefined;
    
    const updated: CompetencyCategory = {
      ...existing,
      ...category,
      id,
      updatedAt: new Date(),
    };
    this.competencyCategories.set(id, updated);
    return updated;
  }

  async deleteCompetencyCategory(id: string): Promise<boolean> {
    return this.competencyCategories.delete(id);
  }

  // Competency Element operations
  async getCompetencyElements(categoryId?: string): Promise<CompetencyElement[]> {
    const elements = Array.from(this.competencyElements.values())
      .filter(el => el.isActive);
    
    if (categoryId) {
      return elements.filter(el => el.categoryId === categoryId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    return elements.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getCompetencyElement(id: string): Promise<CompetencyElement | undefined> {
    return this.competencyElements.get(id);
  }

  async createCompetencyElement(element: InsertCompetencyElement): Promise<CompetencyElement> {
    const id = randomUUID();
    const now = new Date();
    const newElement: CompetencyElement = {
      ...element,
      id,
      code: element.code ?? null,
      externalId: element.externalId ?? null,
      description: element.description ?? null,
      validityPeriod: element.validityPeriod ?? null,
      assessorGuidance: element.assessorGuidance ?? null,
      isActive: element.isActive ?? true,
      order: element.order ?? 0,
      proficiencyScale: element.proficiencyScale || "one-point",
      safetyCriticality: element.safetyCriticality || "low",
      requiresAssessorGuidance: element.requiresAssessorGuidance ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.competencyElements.set(id, newElement);
    return newElement;
  }

  async updateCompetencyElement(id: string, element: Partial<InsertCompetencyElement>): Promise<CompetencyElement | undefined> {
    const existing = this.competencyElements.get(id);
    if (!existing) return undefined;
    
    const updated: CompetencyElement = {
      ...existing,
      ...element,
      id,
      updatedAt: new Date(),
    };
    this.competencyElements.set(id, updated);
    return updated;
  }

  async deleteCompetencyElement(id: string): Promise<boolean> {
    return this.competencyElements.delete(id);
  }

  // Competency operations
  async getCompetencies(filters?: { elementId?: string; type?: string; critical?: boolean; safetyCritical?: boolean }): Promise<Competency[]> {
    let competencies = Array.from(this.competencies.values())
      .filter(comp => comp.isActive);

    if (filters) {
      if (filters.elementId) {
        competencies = competencies.filter(comp => comp.elementId === filters.elementId);
      }
      if (filters.type) {
        competencies = competencies.filter(comp => comp.type === filters.type);
      }
      if (filters.critical !== undefined) {
        competencies = competencies.filter(comp => comp.critical === filters.critical);
      }
      if (filters.safetyCritical !== undefined) {
        competencies = competencies.filter(comp => comp.safetyCritical === filters.safetyCritical);
      }
    }

    return competencies;
  }

  async getCompetency(id: string): Promise<Competency | undefined> {
    return this.competencies.get(id);
  }

  async createCompetency(competency: InsertCompetency): Promise<Competency> {
    const id = randomUUID();
    const now = new Date();
    const newCompetency: Competency = {
      ...competency,
      id,
      externalId: competency.externalId ?? null,
      level: competency.level ?? null,
      group: competency.group ?? null,
      translations: competency.translations ?? null,
      isActive: competency.isActive ?? true,
      type: competency.type || "technical",
      critical: competency.critical ?? false,
      safetyCritical: competency.safetyCritical ?? false,
      passingThreshold: competency.passingThreshold ?? 80,
      assessmentMethods: competency.assessmentMethods || [],
      evidenceRequirements: competency.evidenceRequirements || [],
      createdAt: now,
      updatedAt: now,
    };
    this.competencies.set(id, newCompetency);
    return newCompetency;
  }

  async updateCompetency(id: string, competency: Partial<InsertCompetency>): Promise<Competency | undefined> {
    const existing = this.competencies.get(id);
    if (!existing) return undefined;
    
    const updated: Competency = {
      ...existing,
      ...competency,
      id,
      updatedAt: new Date(),
    };
    this.competencies.set(id, updated);
    return updated;
  }

  async deleteCompetency(id: string): Promise<boolean> {
    return this.competencies.delete(id);
  }

  // Competence Subcategory operations
  async getCompetenceSubcategories(elementId?: string, type?: 'knowledge' | 'performance'): Promise<CompetenceSubcategory[]> {
    let subcategories = Array.from(this.competenceSubcategories.values())
      .filter(sub => sub.isActive);

    if (elementId) {
      subcategories = subcategories.filter(sub => sub.elementId === elementId);
    }
    
    if (type) {
      subcategories = subcategories.filter(sub => sub.type === type);
    }

    return subcategories.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async getCompetenceSubcategory(id: string): Promise<CompetenceSubcategory | undefined> {
    return this.competenceSubcategories.get(id);
  }

  async createCompetenceSubcategory(subcategory: InsertCompetenceSubcategory): Promise<CompetenceSubcategory> {
    const id = randomUUID();
    const now = new Date();
    const newSubcategory: CompetenceSubcategory = {
      ...subcategory,
      id,
      isActive: subcategory.isActive ?? true,
      order: subcategory.order ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.competenceSubcategories.set(id, newSubcategory);
    return newSubcategory;
  }

  async updateCompetenceSubcategory(id: string, subcategory: Partial<InsertCompetenceSubcategory>): Promise<CompetenceSubcategory | undefined> {
    const existing = this.competenceSubcategories.get(id);
    if (!existing) return undefined;
    
    const updated: CompetenceSubcategory = {
      ...existing,
      ...subcategory,
      id,
      updatedAt: new Date(),
    };
    this.competenceSubcategories.set(id, updated);
    return updated;
  }

  async deleteCompetenceSubcategory(id: string): Promise<boolean> {
    return this.competenceSubcategories.delete(id);
  }

  // Competence Criteria operations (K1.1, P1.1, etc.)
  async getCompetenceCriteria(filters?: { subcategoryId?: string; elementId?: string; type?: 'knowledge' | 'performance' }): Promise<CompetenceCriteria[]> {
    let criteria = Array.from(this.competenceCriteria.values())
      .filter(crit => crit.isActive);

    if (filters) {
      if (filters.subcategoryId) {
        criteria = criteria.filter(crit => crit.subcategoryId === filters.subcategoryId);
      }
      if (filters.elementId) {
        criteria = criteria.filter(crit => crit.elementId === filters.elementId);
      }
      if (filters.type) {
        criteria = criteria.filter(crit => crit.type === filters.type);
      }
    }

    return criteria.sort((a, b) => {
      // Sort by subcategory number (nulls first), then criteria number
      const aSubNum = a.subcategoryNumber ?? 0;
      const bSubNum = b.subcategoryNumber ?? 0;
      if (aSubNum !== bSubNum) {
        return aSubNum - bSubNum;
      }
      return a.criteriaNumber - b.criteriaNumber;
    });
  }

  async getCompetenceCriterion(id: string): Promise<CompetenceCriteria | undefined> {
    return this.competenceCriteria.get(id);
  }

  async createCompetenceCriteria(criteria: InsertCompetenceCriteria): Promise<CompetenceCriteria> {
    const id = randomUUID();
    const now = new Date();
    
    let elementId: string;
    let subcategoryNumber: number | null = null;
    
    // Handle optional subcategory
    if (criteria.subcategoryId) {
      // Validate subcategory exists and is active
      const subcategory = this.competenceSubcategories.get(criteria.subcategoryId);
      if (!subcategory) throw new Error('Subcategory not found');
      if (!subcategory.isActive) throw new Error('Cannot create criteria for inactive subcategory');
      
      // Enforce type consistency
      if (criteria.type !== subcategory.type) {
        throw new Error(`Type mismatch: criteria type '${criteria.type}' does not match subcategory type '${subcategory.type}'`);
      }
      
      // Use subcategory's elementId
      elementId = subcategory.elementId;
      if (criteria.elementId && criteria.elementId !== elementId) {
        throw new Error(`Element mismatch: criteria elementId '${criteria.elementId}' does not match subcategory elementId '${elementId}'`);
      }
      
      // Calculate subcategory number
      const allSubcategories = Array.from(this.competenceSubcategories.values())
        .filter(s => s.elementId === subcategory.elementId && s.type === subcategory.type && s.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      subcategoryNumber = allSubcategories.findIndex(s => s.id === criteria.subcategoryId) + 1;
      
      if (subcategoryNumber <= 0) {
        throw new Error('Could not determine subcategory number - subcategory may be inactive or not found');
      }
    } else {
      // Direct element-level criteria
      if (!criteria.elementId) {
        throw new Error('Either subcategoryId or elementId must be provided');
      }
      elementId = criteria.elementId;
      
      // Validate element exists
      const element = this.competencyElements.get(elementId);
      if (!element) throw new Error('Element not found');
      if (!element.isActive) throw new Error('Cannot create criteria for inactive element');
    }
    
    // Find next available criteria number
    const existingCriteria = Array.from(this.competenceCriteria.values())
      .filter(c => {
        if (criteria.subcategoryId) {
          return c.subcategoryId === criteria.subcategoryId && c.type === criteria.type && c.isActive;
        } else {
          return c.elementId === elementId && c.subcategoryId === null && c.type === criteria.type && c.isActive;
        }
      });
    let criteriaNumber = 1;
    
    // Find the first available number (handles gaps from deletes)
    while (existingCriteria.some(c => c.criteriaNumber === criteriaNumber)) {
      criteriaNumber++;
    }

    // Generate code in K1.1 or P1.1 format (always server-computed)
    const typePrefix = criteria.type === 'knowledge' ? 'K' : 'P';
    const code = criteria.subcategoryId ? 
      `${typePrefix}${subcategoryNumber}.${criteriaNumber}` : 
      `${typePrefix}${criteriaNumber}`;
    
    // Check for duplicate codes (additional safety)
    const existingCode = Array.from(this.competenceCriteria.values())
      .find(c => c.code === code && c.elementId === elementId && c.isActive);
    if (existingCode) {
      throw new Error(`Code '${code}' already exists for this element`);
    }

    const newCriteria: CompetenceCriteria = {
      ...criteria,
      id,
      elementId, // Server-computed from subcategory
      code, // Server-computed
      subcategoryId: criteria.subcategoryId || null, // Ensure it's string | null, not undefined
      subcategoryNumber, // Server-computed
      criteriaNumber, // Server-computed
      assessmentMethods: criteria.assessmentMethods || [],
      assessorGuidance: criteria.assessorGuidance || null,
      isActive: criteria.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.competenceCriteria.set(id, newCriteria);
    return newCriteria;
  }

  async updateCompetenceCriteria(id: string, criteria: Partial<InsertCompetenceCriteria & { code?: string; subcategoryNumber?: number; criteriaNumber?: number }>): Promise<CompetenceCriteria | undefined> {
    const existing = this.competenceCriteria.get(id);
    if (!existing) return undefined;
    
    // Block changes to structural fields that would require recomputation
    if (criteria.subcategoryId && criteria.subcategoryId !== existing.subcategoryId) {
      throw new Error('Cannot change subcategoryId - create a new criteria instead');
    }
    if (criteria.type && criteria.type !== existing.type) {
      throw new Error('Cannot change type - create a new criteria instead');
    }
    if (criteria.elementId && criteria.elementId !== existing.elementId) {
      throw new Error('Cannot change elementId - it must match the subcategory');
    }
    if (criteria.code || criteria.subcategoryNumber !== undefined || criteria.criteriaNumber !== undefined) {
      throw new Error('Cannot manually set code, subcategoryNumber, or criteriaNumber - they are server-computed');
    }
    
    const updated: CompetenceCriteria = {
      ...existing,
      ...criteria,
      id,
      // Preserve server-computed fields
      elementId: existing.elementId,
      code: existing.code,
      subcategoryNumber: existing.subcategoryNumber,
      criteriaNumber: existing.criteriaNumber,
      updatedAt: new Date(),
    };
    this.competenceCriteria.set(id, updated);
    return updated;
  }

  async deleteCompetenceCriteria(id: string): Promise<boolean> {
    return this.competenceCriteria.delete(id);
  }

  async generateCompetenceCriteriaCode(elementId: string, type: 'knowledge' | 'performance', subcategoryId?: string): Promise<string> {
    // Validate element exists
    const element = this.competencyElements.get(elementId);
    if (!element) throw new Error('Element not found');
    if (!element.isActive) throw new Error('Cannot generate code for inactive element');

    if (subcategoryId) {
      // Subcategory-level criteria (K1.1, P1.2, etc.)
      const subcategory = this.competenceSubcategories.get(subcategoryId);
      if (!subcategory) throw new Error('Subcategory not found');
      if (!subcategory.isActive) throw new Error('Cannot generate code for inactive subcategory');

      // Validate type matches subcategory type
      if (subcategory.type !== type) {
        throw new Error('Type mismatch between criteria and subcategory');
      }

      // Find subcategory number by counting subcategories of same type
      const allSubcategories = Array.from(this.competenceSubcategories.values())
        .filter(s => s.elementId === elementId && s.type === type && s.isActive)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const subcategoryNumber = allSubcategories.findIndex(s => s.id === subcategoryId) + 1;
      
      if (subcategoryNumber <= 0) {
        throw new Error('Could not determine subcategory number - subcategory may be inactive or not found');
      }

      // Find next available criteria number for this subcategory
      const existingCriteria = Array.from(this.competenceCriteria.values())
        .filter(c => c.subcategoryId === subcategoryId && c.type === type && c.isActive);
      let nextNumber = 1;
      
      // Find the first available number (handles gaps from deletes)
      while (existingCriteria.some(c => c.criteriaNumber === nextNumber)) {
        nextNumber++;
      }

      const typePrefix = type === 'knowledge' ? 'K' : 'P';
      return `${typePrefix}${subcategoryNumber}.${nextNumber}`;
    } else {
      // Element-level criteria (K1, P1, etc.)
      const existingCriteria = Array.from(this.competenceCriteria.values())
        .filter(c => c.elementId === elementId && c.subcategoryId === null && c.type === type && c.isActive);
      let nextNumber = 1;
      
      // Find the first available number (handles gaps from deletes)
      while (existingCriteria.some(c => c.criteriaNumber === nextNumber)) {
        nextNumber++;
      }

      const typePrefix = type === 'knowledge' ? 'K' : 'P';
      return `${typePrefix}${nextNumber}`;
    }
  }

  // Word/Excel import operations (stub implementation)
  async importClientStandards(file: Buffer, elementId: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    // TODO: Implement Word/Excel parsing with xlsx and mammoth packages
    // For now, return a stub response
    return { success: false, imported: 0, errors: ['Import functionality not yet implemented'] };
  }

  // Job Role operations
  async getJobRoles(): Promise<JobRole[]> {
    return Array.from(this.jobRoles.values())
      .filter(role => role.isActive);
  }

  async getJobRole(id: string): Promise<JobRole | undefined> {
    return this.jobRoles.get(id);
  }

  async createJobRole(jobRole: InsertJobRole): Promise<JobRole> {
    const id = randomUUID();
    const now = new Date();
    const newJobRole: JobRole = {
      ...jobRole,
      id,
      description: jobRole.description ?? null,
      department: jobRole.department ?? null,
      level: jobRole.level ?? null,
      isActive: jobRole.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.jobRoles.set(id, newJobRole);
    return newJobRole;
  }

  async updateJobRole(id: string, jobRole: Partial<InsertJobRole>): Promise<JobRole | undefined> {
    const existing = this.jobRoles.get(id);
    if (!existing) return undefined;
    
    const updated: JobRole = {
      ...existing,
      ...jobRole,
      id,
      updatedAt: new Date(),
    };
    this.jobRoles.set(id, updated);
    return updated;
  }

  async deleteJobRole(id: string): Promise<boolean> {
    return this.jobRoles.delete(id);
  }

  // Role Elements operations (MemStorage - stubs)
  async getRoleElements(roleId: string): Promise<RoleElement[]> {
    // TODO: Implement for MemStorage
    return [];
  }

  async getRoleElementsWithDetails(roleId: string): Promise<Array<RoleElement & { element: CompetencyElement }>> {
    // TODO: Implement for MemStorage
    return [];
  }

  // Role Trainings operations (MemStorage - stubs)
  async getRoleTrainings(roleId: string): Promise<RoleTraining[]> {
    // TODO: Implement for MemStorage
    return [];
  }

  async getRoleTrainingsWithDetails(roleId: string): Promise<Array<RoleTraining & { training: Training }>> {
    // TODO: Implement for MemStorage
    return [];
  }

  // Auto-assignment operations (MemStorage - stubs)
  async assignJobRoleToUser(userId: string, roleId: string, allocatedBy?: string): Promise<{ assessmentsCreated: number; trainingsEnrolled: number }> {
    // TODO: Implement for MemStorage
    return { assessmentsCreated: 0, trainingsEnrolled: 0 };
  }

  async addCompetenceElementToUser(userId: string, elementId: string, assessorId?: string): Promise<Assessment> {
    // TODO: Implement for MemStorage
    throw new Error("Method not implemented for MemStorage");
  }

  async addTrainingToUser(userId: string, trainingId: string, allocatedBy?: string): Promise<{ enrollment: TrainingEnrollment; isNew: boolean }> {
    // TODO: Implement for MemStorage
    throw new Error("Method not implemented for MemStorage");
  }

  async bulkAssignTraining(userIds: string[], trainingId: string, allocatedBy: string): Promise<{ successful: number; skipped: number; failed: Array<{ userId: string; error: string }>; totalEnrollmentsCreated: number }> {
    // TODO: Implement for MemStorage
    return { successful: 0, skipped: 0, failed: [], totalEnrollmentsCreated: 0 };
  }

  // Competency Matrix operations
  async getCompetencyMatrix(jobRoleId?: string, competencyId?: string): Promise<CompetencyMatrix[]> {
    let matrix = Array.from(this.competencyMatrix.values())
      .filter(m => m.isActive);

    if (jobRoleId) {
      matrix = matrix.filter(m => m.jobRoleId === jobRoleId);
    }
    if (competencyId) {
      matrix = matrix.filter(m => m.competencyId === competencyId);
    }

    return matrix;
  }

  async createCompetencyMatrix(matrix: InsertCompetencyMatrix): Promise<CompetencyMatrix> {
    const id = randomUUID();
    const now = new Date();
    const newMatrix: CompetencyMatrix = {
      ...matrix,
      id,
      isActive: matrix.isActive ?? true,
      isMandatory: matrix.isMandatory ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.competencyMatrix.set(id, newMatrix);
    return newMatrix;
  }

  async updateCompetencyMatrix(id: string, matrix: Partial<InsertCompetencyMatrix>): Promise<CompetencyMatrix | undefined> {
    const existing = this.competencyMatrix.get(id);
    if (!existing) return undefined;
    
    const updated: CompetencyMatrix = {
      ...existing,
      ...matrix,
      id,
      updatedAt: new Date(),
    };
    this.competencyMatrix.set(id, updated);
    return updated;
  }

  async deleteCompetencyMatrix(id: string): Promise<boolean> {
    return this.competencyMatrix.delete(id);
  }

  // Competency Certification operations
  async getCompetencyCertifications(userId?: string, competencyId?: string): Promise<CompetencyCertification[]> {
    const certifications = Array.from(this.competencyCertifications.values());
    return certifications.filter(cert => 
      (!userId || cert.userId === userId) &&
      (!competencyId || cert.competencyId === competencyId)
    );
  }

  async getCompetencyCertification(id: string): Promise<CompetencyCertification | undefined> {
    return this.competencyCertifications.get(id);
  }

  async createCompetencyCertification(certification: InsertCompetencyCertification): Promise<CompetencyCertification> {
    const now = new Date();
    
    // Calculate expiry date based on element validity period
    let expiryDate: Date | null = null;
    if (certification.competencyId) {
      const competency = await this.getCompetency(certification.competencyId);
      if (competency) {
        const element = await this.getCompetencyElement(competency.elementId);
        if (element?.validityPeriod) {
          expiryDate = new Date(certification.certifiedDate);
          expiryDate.setMonth(expiryDate.getMonth() + element.validityPeriod);
        }
      }
    }

    const newCertification: CompetencyCertification = {
      id: randomUUID(),
      userId: certification.userId,
      competencyId: certification.competencyId,
      proficiencyLevel: certification.proficiencyLevel,
      certifiedDate: certification.certifiedDate,
      assessorId: certification.assessorId ?? null,
      assessmentMethod: certification.assessmentMethod ?? null,
      evidenceReference: certification.evidenceReference ?? null,
      expiryDate,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    this.competencyCertifications.set(newCertification.id, newCertification);

    // Generate alerts for this certification
    if (expiryDate) {
      await this.generateAlertsForCertification(newCertification);
    }

    return newCertification;
  }

  async updateCompetencyCertification(id: string, certification: Partial<InsertCompetencyCertification>): Promise<CompetencyCertification | undefined> {
    const existing = this.competencyCertifications.get(id);
    if (!existing) return undefined;
    
    const updated: CompetencyCertification = {
      ...existing,
      ...certification,
      id,
      updatedAt: new Date(),
    };
    this.competencyCertifications.set(id, updated);
    return updated;
  }

  async deleteCompetencyCertification(id: string): Promise<boolean> {
    // Also delete related alerts
    const alerts = Array.from(this.expiryAlerts.values()).filter(alert => alert.certificationId === id);
    alerts.forEach(alert => this.expiryAlerts.delete(alert.id));
    
    return this.competencyCertifications.delete(id);
  }

  async getExpiringCertifications(days: number = 30): Promise<CompetencyCertification[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);
    
    return Array.from(this.competencyCertifications.values()).filter(cert => 
      cert.expiryDate && 
      cert.expiryDate <= cutoffDate && 
      cert.isActive
    );
  }

  // Expiry Alert operations
  async getExpiryAlerts(userId?: string): Promise<ExpiryAlert[]> {
    const alerts = Array.from(this.expiryAlerts.values());
    
    if (!userId) return alerts;
    
    // Filter by user through certifications
    const userCertifications = await this.getCompetencyCertifications(userId);
    const userCertificationIds = new Set(userCertifications.map(cert => cert.id));
    
    return alerts.filter(alert => userCertificationIds.has(alert.certificationId));
  }

  async createExpiryAlert(alert: InsertExpiryAlert): Promise<ExpiryAlert> {
    const now = new Date();
    const newAlert: ExpiryAlert = {
      id: randomUUID(),
      ...alert,
      isRead: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    this.expiryAlerts.set(newAlert.id, newAlert);
    return newAlert;
  }

  async markAlertAsRead(id: string): Promise<boolean> {
    const alert = this.expiryAlerts.get(id);
    if (!alert) return false;
    
    const updated: ExpiryAlert = {
      ...alert,
      isRead: true,
      updatedAt: new Date(),
    };
    this.expiryAlerts.set(id, updated);
    return true;
  }

  async deleteExpiryAlert(id: string): Promise<boolean> {
    return this.expiryAlerts.delete(id);
  }

  async generateExpiryAlerts(): Promise<ExpiryAlert[]> {
    const generatedAlerts: ExpiryAlert[] = [];
    const certifications = await this.getCompetencyCertifications();
    
    for (const certification of certifications) {
      if (!certification.expiryDate || !certification.isActive) continue;
      
      const alerts = await this.generateAlertsForCertification(certification);
      generatedAlerts.push(...alerts);
    }
    
    return generatedAlerts;
  }

  private async generateAlertsForCertification(certification: CompetencyCertification): Promise<ExpiryAlert[]> {
    if (!certification.expiryDate) return [];
    
    const alerts: ExpiryAlert[] = [];
    const expiryDate = new Date(certification.expiryDate);
    const today = new Date();
    
    // Check if we need to generate alerts
    const daysDifference = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Generate 30-day alert
    if (daysDifference <= 30 && daysDifference > 7) {
      const existingAlert = Array.from(this.expiryAlerts.values()).find(alert => 
        alert.certificationId === certification.id && 
        alert.alertType === '30_days' && 
        alert.isActive
      );
      
      if (!existingAlert) {
        const alert = await this.createExpiryAlert({
          certificationId: certification.id,
          alertType: '30_days',
          alertDate: new Date(),
        });
        alerts.push(alert);
      }
    }
    
    // Generate 7-day alert
    if (daysDifference <= 7 && daysDifference > 0) {
      const existingAlert = Array.from(this.expiryAlerts.values()).find(alert => 
        alert.certificationId === certification.id && 
        alert.alertType === '7_days' && 
        alert.isActive
      );
      
      if (!existingAlert) {
        const alert = await this.createExpiryAlert({
          certificationId: certification.id,
          alertType: '7_days',
          alertDate: new Date(),
        });
        alerts.push(alert);
      }
    }
    
    // Generate expired alert
    if (daysDifference <= 0) {
      const existingAlert = Array.from(this.expiryAlerts.values()).find(alert => 
        alert.certificationId === certification.id && 
        alert.alertType === 'expired' && 
        alert.isActive
      );
      
      if (!existingAlert) {
        const alert = await this.createExpiryAlert({
          certificationId: certification.id,
          alertType: 'expired',
          alertDate: new Date(),
        });
        alerts.push(alert);
      }
    }
    
    return alerts;
  }

  // Special operations
  async getCompetencyTree(): Promise<CompetencyTreeNode[]> {
    const categories = await this.getCompetencyCategories();
    const tree: CompetencyTreeNode[] = [];

    for (const category of categories) {
      const elements = await this.getCompetencyElements(category.id);
      const categoryNode: CompetencyTreeNode = {
        id: category.id,
        name: category.name,
        type: 'category',
        elementCount: elements.length,
        children: elements.map(element => ({
          id: element.id,
          name: element.name,
          type: 'element' as const,
          categoryId: category.id,
        }))
      };
      tree.push(categoryNode);
    }

    return tree;
  }

  async getCompetenciesWithDetails(filters?: { categoryId?: string; elementId?: string; jobRoleId?: string }): Promise<CompetencyWithDetails[]> {
    let competencies = await this.getCompetencies(filters?.elementId ? { elementId: filters.elementId } : undefined);

    const competenciesWithDetails: CompetencyWithDetails[] = [];

    for (const competency of competencies) {
      const element = await this.getCompetencyElement(competency.elementId);
      if (!element) continue;

      const category = await this.getCompetencyCategory(element.categoryId);
      if (!category) continue;

      // Filter by categoryId if provided
      if (filters?.categoryId && category.id !== filters.categoryId) continue;

      // Get job roles for this competency
      const matrixEntries = await this.getCompetencyMatrix(filters?.jobRoleId, competency.id);
      const jobRoles = [];
      
      for (const matrixEntry of matrixEntries) {
        const jobRole = await this.getJobRole(matrixEntry.jobRoleId);
        if (jobRole) {
          jobRoles.push({ ...matrixEntry, jobRole });
        }
      }

      competenciesWithDetails.push({
        ...competency,
        element,
        category,
        jobRoles,
      });
    }

    return competenciesWithDetails;
  }

  // Training Category operations
  async getTrainingCategories(): Promise<TrainingCategory[]> {
    return Array.from(this.trainingCategories.values());
  }

  async getTrainingCategory(id: string): Promise<TrainingCategory | undefined> {
    return this.trainingCategories.get(id);
  }

  async createTrainingCategory(category: InsertTrainingCategory): Promise<TrainingCategory> {
    const id = randomUUID();
    const now = new Date();
    const newCategory: TrainingCategory = {
      id,
      name: category.name,
      description: category.description ?? null,
      color: category.color ?? '#6b7280',
      order: category.order ?? 0,
      isActive: category.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.trainingCategories.set(id, newCategory);
    return newCategory;
  }

  async updateTrainingCategory(id: string, category: Partial<InsertTrainingCategory>): Promise<TrainingCategory | undefined> {
    const existing = this.trainingCategories.get(id);
    if (!existing) return undefined;
    
    const updated: TrainingCategory = {
      ...existing,
      ...category,
      updatedAt: new Date()
    };
    this.trainingCategories.set(id, updated);
    return updated;
  }

  async deleteTrainingCategory(id: string): Promise<boolean> {
    return this.trainingCategories.delete(id);
  }

  // Training operations
  async getTrainings(categoryId?: string): Promise<Training[]> {
    const trainings = Array.from(this.trainings.values());
    return categoryId
      ? trainings.filter(t => t.categoryId === categoryId)
      : trainings;
  }

  async getTraining(id: string): Promise<Training | undefined> {
    return this.trainings.get(id);
  }

  async createTraining(training: InsertTraining): Promise<Training> {
    const id = randomUUID();
    const now = new Date();
    const newTraining: Training = {
      id,
      categoryId: training.categoryId,
      name: training.name,
      description: training.description ?? null,
      assessmentMethods: training.assessmentMethods ?? null,
      isSafetyCritical: training.isSafetyCritical ?? false,
      validityPeriod: training.validityPeriod ?? null,
      prerequisites: training.prerequisites ?? null,
      isActive: training.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.trainings.set(id, newTraining);
    return newTraining;
  }

  async updateTraining(id: string, training: Partial<InsertTraining>): Promise<Training | undefined> {
    const existing = this.trainings.get(id);
    if (!existing) return undefined;
    
    const updated: Training = {
      ...existing,
      ...training,
      updatedAt: new Date()
    };
    this.trainings.set(id, updated);
    return updated;
  }

  async deleteTraining(id: string): Promise<boolean> {
    return this.trainings.delete(id);
  }

  // Training Level operations
  async getTrainingLevels(trainingId?: string): Promise<TrainingLevel[]> {
    const levels = Array.from(this.trainingLevels.values());
    return trainingId
      ? levels.filter(l => l.trainingId === trainingId)
      : levels;
  }

  async getTrainingLevel(id: string): Promise<TrainingLevel | undefined> {
    return this.trainingLevels.get(id);
  }

  async createTrainingLevel(level: InsertTrainingLevel): Promise<TrainingLevel> {
    const id = randomUUID();
    const now = new Date();
    const newLevel: TrainingLevel = {
      id,
      trainingId: level.trainingId,
      level: level.level,
      name: level.name,
      description: level.description ?? null,
      criteria: level.criteria ?? null,
      knowledgeElements: level.knowledgeElements ?? null,
      performanceElements: level.performanceElements ?? null,
      order: level.order ?? 0,
      isActive: level.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.trainingLevels.set(id, newLevel);
    return newLevel;
  }

  async updateTrainingLevel(id: string, level: Partial<InsertTrainingLevel>): Promise<TrainingLevel | undefined> {
    const existing = this.trainingLevels.get(id);
    if (!existing) return undefined;
    
    const updated: TrainingLevel = {
      ...existing,
      ...level,
      updatedAt: new Date()
    };
    this.trainingLevels.set(id, updated);
    return updated;
  }

  async deleteTrainingLevel(id: string): Promise<boolean> {
    return this.trainingLevels.delete(id);
  }

  // Training Certificate operations
  async getTrainingCertificates(userId?: string, trainingId?: string): Promise<TrainingCertificate[]> {
    const certificates = Array.from(this.trainingCertificates.values());
    return certificates.filter(cert => 
      (!userId || cert.userId === userId) &&
      (!trainingId || cert.trainingId === trainingId)
    );
  }

  async getTrainingCertificate(id: string): Promise<TrainingCertificate | undefined> {
    return this.trainingCertificates.get(id);
  }

  async createTrainingCertificate(certificate: InsertTrainingCertificate): Promise<TrainingCertificate> {
    const id = randomUUID();
    const now = new Date();
    const newCertificate: TrainingCertificate = {
      id,
      userId: certificate.userId,
      trainingId: certificate.trainingId,
      achievementDate: certificate.achievementDate ?? null,
      expiryDate: certificate.expiryDate ?? null,
      certificateUrl: certificate.certificateUrl ?? null,
      certificateFileName: certificate.certificateFileName ?? null,
      isActive: certificate.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.trainingCertificates.set(id, newCertificate);
    return newCertificate;
  }

  async updateTrainingCertificate(id: string, certificate: Partial<InsertTrainingCertificate>): Promise<TrainingCertificate | undefined> {
    const existing = this.trainingCertificates.get(id);
    if (!existing) return undefined;
    
    const updated: TrainingCertificate = {
      ...existing,
      ...certificate,
      updatedAt: new Date()
    };
    this.trainingCertificates.set(id, updated);
    return updated;
  }

  async deleteTrainingCertificate(id: string): Promise<boolean> {
    return this.trainingCertificates.delete(id);
  }

  async getExpiringTrainingCertificates(days: number = 90): Promise<TrainingCertificate[]> {
    const now = new Date();
    const targetDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    
    return Array.from(this.trainingCertificates.values()).filter(cert => 
      cert.expiryDate && 
      cert.expiryDate <= targetDate && 
      cert.expiryDate > now &&
      cert.isActive
    );
  }

  async getTrainingRecordsWithStatus(userId?: string): Promise<Array<TrainingCertificate & { trainingName: string; status: 'green' | 'amber' | 'red' | 'unknown' }>> {
    const certificates = userId 
      ? Array.from(this.trainingCertificates.values()).filter(cert => cert.userId === userId)
      : Array.from(this.trainingCertificates.values());
    
    const today = new Date();
    
    return certificates.map(cert => {
      const training = this.trainings.get(cert.trainingId);
      const trainingName = training ? training.name : `Training #${cert.trainingId}`;
      
      let status: 'green' | 'amber' | 'red' | 'unknown' = 'unknown';
      
      if (cert.expiryDate) {
        const expiryDate = new Date(cert.expiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysUntilExpiry < 0) {
          status = 'red'; // Expired
        } else if (daysUntilExpiry <= 90) {
          status = 'amber'; // Due within 90 days
        } else {
          status = 'green'; // In date
        }
      }
      
      return {
        ...cert,
        trainingName,
        status
      };
    });
  }

  async updateTrainingCertificateDates(id: string, achievementDate?: Date, expiryDate?: Date): Promise<TrainingCertificate | undefined> {
    const certificate = this.trainingCertificates.get(id);
    if (!certificate) return undefined;

    const updatedCertificate: TrainingCertificate = {
      ...certificate,
      achievementDate: achievementDate !== undefined ? achievementDate : certificate.achievementDate,
      expiryDate: expiryDate !== undefined ? expiryDate : certificate.expiryDate,
      updatedAt: new Date()
    };

    this.trainingCertificates.set(id, updatedCertificate);
    return updatedCertificate;
  }

  private initializeMockTrainingData() {
    // Initialize with some mock training data
    const techCategory: TrainingCategory = {
      id: '1',
      name: 'Technical Training',
      description: 'Core technical training competencies',
      color: '#3b82f6',
      order: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const safetyCategory: TrainingCategory = {
      id: '2',
      name: 'Safety Training',
      description: 'Safety training procedures and compliance requirements',
      color: '#ef4444',
      order: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.trainingCategories.set('1', techCategory);
    this.trainingCategories.set('2', safetyCategory);

    // Add sample trainings
    const equipmentTraining: Training = {
      id: '1',
      categoryId: '1',
      name: 'Equipment Operation',
      description: 'Ability to safely operate manufacturing equipment',
      assessmentMethods: ['Practical Assessment', 'Written Test'],
      isSafetyCritical: true,
      validityPeriod: 12,
      prerequisites: ['Basic Safety Training'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.trainings.set('1', equipmentTraining);
    
    // Add sample training levels
    const beginnerLevel: TrainingLevel = {
      id: '1',
      trainingId: '1',
      level: 1,
      name: 'Beginner',
      description: 'Basic operation under supervision',
      criteria: ['Can start/stop equipment safely', 'Follows basic procedures'],
      knowledgeElements: ['Equipment components', 'Safety procedures'],
      performanceElements: ['Start equipment', 'Stop equipment', 'Follow procedures'],
      order: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.trainingLevels.set('1', beginnerLevel);
  }

  async importCompetenceStandards(rows: ExcelImportRow[]): Promise<ExcelImportResult> {
    const result: ExcelImportResult = {
      successCount: 0,
      errorCount: 0,
      errors: [],
      warnings: [],
    };

    const categoryCache = new Map<string, CompetencyCategory>();
    const elementCache = new Map<string, CompetencyElement>();  
    const subcategoryCache = new Map<string, CompetenceSubcategory>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = row.rowNumber || i + 2; // Excel rows start at 2 (after header)

      try {
        // Step 1: Get or create category
        let category = Array.from(this.competencyCategories.values())
          .find(cat => cat.name.toLowerCase() === row.category.toLowerCase());
        
        if (!category) {
          const categoryId = randomUUID();
          category = {
            id: categoryId,
            name: row.category,
            description: `Auto-imported from Excel: ${row.category}`,
            color: '#3B82F6', // Default blue
            order: this.competencyCategories.size,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.competencyCategories.set(categoryId, category);
          categoryCache.set(row.category, category);
        }

        // Step 2: Get or create element
        let element = Array.from(this.competencyElements.values())
          .find(el => el.name.toLowerCase() === row.element.toLowerCase() && el.categoryId === category.id);
          
        if (!element) {
          const elementId = randomUUID();
          element = {
            id: elementId,
            categoryId: category.id,
            name: row.element,
            description: `Auto-imported from Excel: ${row.element}`,
            order: Array.from(this.competencyElements.values())
              .filter(el => el.categoryId === category.id).length,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.competencyElements.set(elementId, element);
          elementCache.set(`${category.id}:${row.element}`, element);
        }

        // Step 3: Get or create subcategory
        let subcategory = Array.from(this.competenceSubcategories.values())
          .find(sub => 
            sub.name.toLowerCase() === row.subcategory.toLowerCase() && 
            sub.elementId === element.id &&
            sub.type === row.type
          );
          
        if (!subcategory) {
          // Calculate subcategory number and order
          const existingSubcategories = Array.from(this.competenceSubcategories.values())
            .filter(sub => sub.elementId === element.id && sub.type === row.type)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          
          const subcategoryId = randomUUID();
          subcategory = {
            id: subcategoryId,
            elementId: element.id,
            name: row.subcategory,
            type: row.type,
            order: existingSubcategories.length + 1,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.competenceSubcategories.set(subcategoryId, subcategory);
          subcategoryCache.set(`${element.id}:${row.subcategory}:${row.type}`, subcategory);
        }

        // Step 4: Create competence criteria with automatic code generation
        const existingCriteria = Array.from(this.competenceCriteria.values())
          .filter(crit => crit.subcategoryId === subcategory.id)
          .sort((a, b) => (a.criteriaNumber || 0) - (b.criteriaNumber || 0));
          
        const nextCriteriaNumber = existingCriteria.length + 1;
        const code = `${row.type === 'knowledge' ? 'K' : 'P'}${subcategory.order}.${nextCriteriaNumber}`;
        
        const criteriaId = randomUUID();
        const criteria: CompetenceCriteria = {
          id: criteriaId,
          elementId: element.id,
          subcategoryId: subcategory.id,
          criteriaText: row.description, // V2: Use criteriaText
          type: row.type,
          code: code,
          subcategoryNumber: subcategory.order,
          criteriaNumber: nextCriteriaNumber,
          assessmentMethods: row.assessmentMethods || [],
          required: row.required !== 'O', // V2: Convert M/O to boolean (true for M, false for O)
          assessorGuidance: row.assessorGuidance || null,
          guidanceNumber: null, // Will be auto-generated if guidance exists
          fmtBold: false,
          fmtItalic: false,
          guidanceFmtBold: false,
          guidanceFmtItalic: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        this.competenceCriteria.set(criteriaId, criteria);
        result.successCount++;

        // Add warnings for optional fields
        if (row.proficiencyLevels || row.proficiencyTerminology) {
          result.warnings.push({
            row: rowNumber,
            message: 'Proficiency levels and terminology are not yet supported in the current version',
          });
        }

      } catch (error) {
        result.errorCount++;
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Unknown error during import',
        });
      }
    }

    return result;
  }

  // Language Preferences operations
  async getUserLanguagePreference(userId: string): Promise<any | null> {
    return this.languagePreferences.get(userId) || null;
  }

  async createOrUpdateUserLanguagePreference(userId: string, preferences: {
    primaryLanguage: string;
    fallbackLanguage: string;
    autoTranslate: boolean;
  }): Promise<any> {
    const preference = {
      id: randomUUID(),
      userId,
      primaryLanguage: preferences.primaryLanguage,
      fallbackLanguage: preferences.fallbackLanguage,
      autoTranslate: preferences.autoTranslate,
      lastUpdated: new Date().toISOString()
    };

    this.languagePreferences.set(userId, preference);
    return preference;
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
    const result = await db.insert(roleElements).values(roleElement).returning();
    return result[0];
  }

  async updateRoleElement(id: string, roleElement: Partial<InsertRoleElement>): Promise<RoleElement | undefined> {
    const result = await db.update(roleElements).set(roleElement).where(eq(roleElements.id, id)).returning();
    return result[0];
  }

  async deleteRoleElement(id: string): Promise<boolean> {
    const result = await db.update(roleElements).set({ isActive: false }).where(eq(roleElements.id, id));
    return result.rowCount > 0;
  }

  async getRoleMatrix(roleId: string): Promise<{ role: JobRole; elements: Array<{ elementId: string; elementName: string; required: boolean }> }> {
    // Get the role
    const roleResult = await db.select().from(jobRoles).where(eq(jobRoles.id, roleId));
    const role = roleResult[0];
    
    if (!role) {
      throw new Error('Role not found');
    }

    // Get all role elements for this role
    const roleElementsList = await this.getRoleElements(roleId);
    
    // Get the element details
    const elementIds = roleElementsList.map(re => re.elementId);
    const elementsList = elementIds.length > 0 
      ? await db.select().from(competencyElements).where(
          and(
            sql`${competencyElements.id} IN ${elementIds}`,
            eq(competencyElements.isActive, true)
          )
        )
      : [];

    // Build the matrix
    const elements = roleElementsList.map(re => {
      const element = elementsList.find(e => e.id === re.elementId);
      return {
        elementId: re.elementId,
        elementName: element?.name || `Element ${re.elementId}`,
        required: re.required ?? true,
      };
    });

    return { role, elements };
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
  async getCandidateAllocations(assessorId?: string, candidateId?: string): Promise<CandidateAllocation[]> {
    const query = db.select().from(candidateAllocations);
    
    if (assessorId && candidateId) {
      return await query.where(and(
        eq(candidateAllocations.assessorId, assessorId),
        eq(candidateAllocations.candidateId, candidateId),
        eq(candidateAllocations.isActive, true)
      ));
    } else if (assessorId) {
      return await query.where(and(
        eq(candidateAllocations.assessorId, assessorId),
        eq(candidateAllocations.isActive, true)
      ));
    } else if (candidateId) {
      return await query.where(and(
        eq(candidateAllocations.candidateId, candidateId),
        eq(candidateAllocations.isActive, true)
      ));
    }
    
    return await query.where(eq(candidateAllocations.isActive, true));
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

  async getAssessorCandidates(assessorId: string): Promise<User[]> {
    const allocations = await this.getCandidateAllocations(assessorId);
    const candidateIds = allocations.map(a => a.candidateId);
    
    if (candidateIds.length === 0) return [];
    
    return await db.select().from(users).where(
      and(
        sql`${users.id} = ANY(${candidateIds})`,
        eq(users.isActive, true)
      )
    );
  }

  // Assessment operations
  async getAssessments(candidateId?: string, assessorId?: string, elementId?: string): Promise<Assessment[]> {
    const query = db.select().from(assessments);
    const conditions: any[] = [eq(assessments.isActive, true)];
    
    if (candidateId) conditions.push(eq(assessments.candidateId, candidateId));
    if (assessorId) conditions.push(eq(assessments.assessorId, assessorId));
    if (elementId) conditions.push(eq(assessments.elementId, elementId));
    
    return await query.where(and(...conditions)).orderBy(desc(assessments.assessmentDate));
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

  // Historical Import stub implementations (MemStorage uses in-memory, not suitable for bulk imports)
  async processHistoricalImport(importData: Array<any>, importedBy: string): Promise<{
    success: number;
    errors: Array<{ row: number; error: string }>;
    usersCreated: number;
    assessmentsCreated: number;
  }> {
    throw new Error("Historical import not supported for in-memory storage. Use DbStorage instead.");
  }

  async getCompetencyCategoryByName(name: string): Promise<CompetencyCategory | undefined> {
    return Array.from(this.competencyCategories.values()).find(
      cat => cat.name === name && cat.isActive
    );
  }

  async getCompetencyElementByName(categoryId: string, name: string): Promise<CompetencyElement | undefined> {
    return Array.from(this.competencyElements.values()).find(
      el => el.categoryId === categoryId && el.name === name && el.isActive
    );
  }

  async getJobRoleByName(name: string): Promise<JobRole | undefined> {
    // Try exact match first
    const exactMatch = Array.from(this.jobRoles.values()).find(
      role => role.name === name && role.isActive
    );
    if (exactMatch) return exactMatch;

    // Try matching with code in parentheses
    const match = name.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (match) {
      const [, roleName, roleCode] = match;
      return Array.from(this.jobRoles.values()).find(
        role => role.code === roleCode.trim() && role.isActive
      );
    }

    return undefined;
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
        const user = await this.getUser(userId);
        if (!user) {
          failed.push({ userId, error: "User not found" });
          continue;
        }

        await this.updateUser(userId, { jobRoleId: roleId });
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

  async bulkAssignCompetenceElement(userIds: string[], elementId: string, assessorId: string): Promise<{
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

        await this.addCompetenceElementToUser(userId, elementId, assessorId);
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

export const storage = new DbStorage();
