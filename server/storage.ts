import { 
  type User, 
  type InsertUser,
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
  type CompetencyTreeNode,
  type CompetencyWithDetails
} from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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

  constructor() {
    this.users = new Map();
    this.competencyCategories = new Map();
    this.competencyElements = new Map();
    this.competencies = new Map();
    this.jobRoles = new Map();
    this.competencyMatrix = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
