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
  type InsertTrainingCertificate
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations - Required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  // Additional user operations
  getUserByEmail(email: string): Promise<User | undefined>;
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
  getCompetenceSubcategories(elementId?: string): Promise<CompetenceSubcategory[]>;
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
  generateCompetenceCriteriaCode(subcategoryId: string, type: 'knowledge' | 'performance'): Promise<string>;

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
  async getCompetenceSubcategories(elementId?: string): Promise<CompetenceSubcategory[]> {
    let subcategories = Array.from(this.competenceSubcategories.values())
      .filter(sub => sub.isActive);

    if (elementId) {
      subcategories = subcategories.filter(sub => sub.elementId === elementId);
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
      // Sort by subcategory number, then criteria number
      if (a.subcategoryNumber !== b.subcategoryNumber) {
        return a.subcategoryNumber - b.subcategoryNumber;
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
    
    // Auto-generate subcategoryNumber and criteriaNumber if not provided
    let subcategoryNumber = criteria.subcategoryNumber;
    let criteriaNumber = criteria.criteriaNumber;
    
    if (!subcategoryNumber) {
      // Find max subcategory number for this element and type
      const existingSubcategories = Array.from(this.competenceCriteria.values())
        .filter(c => c.elementId === criteria.elementId && c.type === criteria.type);
      subcategoryNumber = Math.max(...existingSubcategories.map(c => c.subcategoryNumber), 0) + 1;
    }
    
    if (!criteriaNumber) {
      // Find max criteria number for this subcategory
      const existingCriteria = Array.from(this.competenceCriteria.values())
        .filter(c => c.subcategoryId === criteria.subcategoryId);
      criteriaNumber = Math.max(...existingCriteria.map(c => c.criteriaNumber), 0) + 1;
    }

    // Generate code in K1.1 or P1.1 format
    const typePrefix = criteria.type === 'knowledge' ? 'K' : 'P';
    const code = `${typePrefix}${subcategoryNumber}.${criteriaNumber}`;

    const newCriteria: CompetenceCriteria = {
      ...criteria,
      id,
      code,
      subcategoryNumber,
      criteriaNumber,
      assessmentMethods: criteria.assessmentMethods || [],
      isActive: criteria.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.competenceCriteria.set(id, newCriteria);
    return newCriteria;
  }

  async updateCompetenceCriteria(id: string, criteria: Partial<InsertCompetenceCriteria>): Promise<CompetenceCriteria | undefined> {
    const existing = this.competenceCriteria.get(id);
    if (!existing) return undefined;
    
    const updated: CompetenceCriteria = {
      ...existing,
      ...criteria,
      id,
      updatedAt: new Date(),
    };
    this.competenceCriteria.set(id, updated);
    return updated;
  }

  async deleteCompetenceCriteria(id: string): Promise<boolean> {
    return this.competenceCriteria.delete(id);
  }

  async generateCompetenceCriteriaCode(subcategoryId: string, type: 'knowledge' | 'performance'): Promise<string> {
    const subcategory = this.competenceSubcategories.get(subcategoryId);
    if (!subcategory) throw new Error('Subcategory not found');

    // Get existing criteria for this subcategory to determine next number
    const existingCriteria = Array.from(this.competenceCriteria.values())
      .filter(c => c.subcategoryId === subcategoryId && c.isActive);
    const nextNumber = Math.max(...existingCriteria.map(c => c.criteriaNumber), 0) + 1;

    // Find subcategory number by counting subcategories of same type
    const allSubcategories = Array.from(this.competenceSubcategories.values())
      .filter(s => s.elementId === subcategory.elementId && s.type === type && s.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const subcategoryNumber = allSubcategories.findIndex(s => s.id === subcategoryId) + 1;

    const typePrefix = type === 'knowledge' ? 'K' : 'P';
    return `${typePrefix}${subcategoryNumber}.${nextNumber}`;
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
}

export const storage = new MemStorage();
