import { 
  type User, 
  type InsertUser,
  type UpsertUser,
  type CompetencyCategory,
  type InsertCompetencyCategory,
  type CompetencyElement,
  type InsertCompetencyElement,
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
  type CompetencyWithDetails
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

  // Special operations
  getCompetencyTree(): Promise<CompetencyTreeNode[]>;
  getCompetenciesWithDetails(filters?: { categoryId?: string; elementId?: string; jobRoleId?: string }): Promise<CompetencyWithDetails[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private competencyCategories: Map<string, CompetencyCategory>;
  private competencyElements: Map<string, CompetencyElement>;
  private competencies: Map<string, Competency>;
  private jobRoles: Map<string, JobRole>;
  private competencyMatrix: Map<string, CompetencyMatrix>;
  private competencyCertifications: Map<string, CompetencyCertification>;
  private expiryAlerts: Map<string, ExpiryAlert>;

  constructor() {
    this.users = new Map();
    this.competencyCategories = new Map();
    this.competencyElements = new Map();
    this.competencies = new Map();
    this.jobRoles = new Map();
    this.competencyMatrix = new Map();
    this.competencyCertifications = new Map();
    this.expiryAlerts = new Map();
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
}

export const storage = new MemStorage();
