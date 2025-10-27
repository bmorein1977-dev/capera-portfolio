import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Role Types
export type UserRole = 'developer' | 'super_admin' | 'admin' | 'internal_verifier' | 'assessor' | 'candidate' | 'trainee';

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Updated users table for Replit Auth + Role system
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("candidate"),
  department: varchar("department"),
  location: varchar("location"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  department: true,
  location: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

// Training Management Tables

export const trainingCategories = pgTable("training_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: varchar("color").notNull().default("#6b7280"),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trainings = pgTable("trainings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  assessmentMethods: text("assessment_methods").array(),
  isSafetyCritical: boolean("is_safety_critical").default(false),
  validityPeriod: integer("validity_period"), // in months
  prerequisites: text("prerequisites").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trainingLevels = pgTable("training_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trainingId: varchar("training_id").notNull(),
  level: integer("level").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  criteria: text("criteria").array(),
  knowledgeElements: text("knowledge_elements").array(),
  performanceElements: text("performance_elements").array(),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trainingCertificates = pgTable("training_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  trainingId: varchar("training_id").notNull(),
  achievementDate: timestamp("achievement_date"),
  expiryDate: timestamp("expiry_date"),
  certificateUrl: text("certificate_url"),
  certificateFileName: text("certificate_file_name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Training schema exports
export const insertTrainingCategorySchema = createInsertSchema(trainingCategories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTrainingSchema = createInsertSchema(trainings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTrainingLevelSchema = createInsertSchema(trainingLevels).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTrainingCertificateSchema = createInsertSchema(trainingCertificates).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertTrainingCategory = z.infer<typeof insertTrainingCategorySchema>;
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type InsertTrainingLevel = z.infer<typeof insertTrainingLevelSchema>;
export type InsertTrainingCertificate = z.infer<typeof insertTrainingCertificateSchema>;

export type TrainingCategory = typeof trainingCategories.$inferSelect;
export type Training = typeof trainings.$inferSelect;
export type TrainingLevel = typeof trainingLevels.$inferSelect;
export type TrainingCertificate = typeof trainingCertificates.$inferSelect;

// Competency Management Tables

export const competencyCategories = pgTable("competency_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  parentId: varchar("parent_id"),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const competencyElements = pgTable("competency_elements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  externalId: text("external_id"),
  description: text("description"),
  proficiencyScale: text("proficiency_scale").notNull().default("one-point"), // "one-point" or "three-point" 
  proficiencyScheme: integer("proficiency_scheme").default(1), // Column C: 1, 3, or 4 level system
  safetyCriticality: text("safety_criticality").notNull().default("Medium"), // Column H: "Low", "Medium", "High"
  validityPeriod: integer("validity_period"), // months (internal)
  reassessmentYears: integer("reassessment_years"), // Column I: years for reassessment
  requiresAssessorGuidance: boolean("requires_assessor_guidance").default(false),
  assessorGuidance: text("assessor_guidance"),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Competence criteria subcategories (for organizing K and P criteria)
export const competenceSubcategories = pgTable("competence_subcategories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  elementId: varchar("element_id").notNull(),
  name: text("name").notNull(), // e.g., "Sub Category Here"
  type: text("type").notNull(), // "knowledge" or "performance"
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual competence criteria (K1.1, K1.2, P1.1, P1.2, etc.)
export const competenceCriteria = pgTable("competence_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subcategoryId: varchar("subcategory_id"), // Made optional - can be null for criteria directly under element
  elementId: varchar("element_id").notNull(),
  code: text("code").notNull(), // e.g., "K 1.1", "P 2.3" (with space)
  criteriaText: text("criteria_text").notNull(), // Column F: Assessment Criteria (PRIMARY field for V2)
  description: text("description"), // LEGACY: Kept for backward compatibility, auto-synced with criteriaText
  type: text("type").notNull(), // "knowledge" or "performance"
  subcategoryNumber: integer("subcategory_number"), // Made optional - null for element-level criteria
  criteriaNumber: integer("criteria_number").notNull(), // 1, 2, 3, etc. (minor number within subcategory)
  assessmentMethods: text("assessment_methods").array(), // [1, 2, 3, 4, 5, 6] checkboxes
  assessorGuidance: text("assessor_guidance"), // Column G: Assessor Guidance (optional, assessor-only)
  guidanceNumber: text("guidance_number"), // e.g., "KG 1.1", "PG 2.3" (auto-generated when guidance exists)
  required: boolean("required").default(true), // Column J: M (true) or O (false)
  fmtBold: boolean("fmt_bold").default(false), // Text formatting
  fmtItalic: boolean("fmt_italic").default(false), // Text formatting
  guidanceFmtBold: boolean("guidance_fmt_bold").default(false), // Guidance formatting
  guidanceFmtItalic: boolean("guidance_fmt_italic").default(false), // Guidance formatting
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const competencies = pgTable("competencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  elementId: varchar("element_id").notNull(),
  name: text("name").notNull(),
  externalId: text("external_id"),
  type: text("type").notNull().default("technical"), // "knowledge", "skill", "technical", "behavior", "safety"
  level: text("level"), // "basic", "intermediate", "advanced" for 3-point scales
  critical: boolean("critical").default(false),
  safetyCritical: boolean("safety_critical").default(false),
  group: text("group"),
  assessmentMethods: text("assessment_methods").array(), // array of method codes
  evidenceRequirements: text("evidence_requirements").array(),
  passingThreshold: integer("passing_threshold").default(80),
  translations: json("translations"), // JSON object for multi-language support
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobRoles = pgTable("job_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  description: text("description"),
  clientId: varchar("client_id"), // For multi-client deployments
  department: text("department"),
  location: text("location"), // Physical location or region
  businessUnit: text("business_unit"), // Organizational division
  level: text("level"), // "trainee", "technician", "supervisor", "manager", etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Role Elements - Maps job roles to competency elements (element-level assignments)
export const roleElements = pgTable("role_elements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  elementId: varchar("element_id").notNull(),
  required: boolean("required").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const competencyMatrix = pgTable("competency_matrix", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobRoleId: varchar("job_role_id").notNull(),
  competencyId: varchar("competency_id").notNull(),
  proficiencyLevel: text("proficiency_level").notNull(), // "S", "B", "I", "A" (Standard, Basic, Intermediate, Advanced)
  isMandatory: boolean("is_mandatory").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const competencyCertifications = pgTable("competency_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  competencyId: varchar("competency_id").notNull(),
  proficiencyLevel: text("proficiency_level").notNull(), // "S", "B", "I", "A"
  certifiedDate: timestamp("certified_date").notNull(),
  expiryDate: timestamp("expiry_date"), // Based on element validity period
  assessorId: varchar("assessor_id"),
  assessmentMethod: text("assessment_method"),
  evidenceReference: text("evidence_reference"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const expiryAlerts = pgTable("expiry_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  certificationId: varchar("certification_id").notNull(),
  alertType: text("alert_type").notNull(), // "30_days", "7_days", "expired"
  alertDate: timestamp("alert_date").notNull(),
  isRead: boolean("is_read").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert Schemas
export const insertCompetencyCategorySchema = createInsertSchema(competencyCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompetencyElementSchema = createInsertSchema(competencyElements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompetencySchema = createInsertSchema(competencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobRoleSchema = createInsertSchema(jobRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleElementSchema = createInsertSchema(roleElements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompetencyMatrixSchema = createInsertSchema(competencyMatrix).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompetencyCertificationSchema = createInsertSchema(competencyCertifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompetenceSubcategorySchema = createInsertSchema(competenceSubcategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompetenceCriteriaSchema = createInsertSchema(competenceCriteria).omit({
  id: true,
  code: true,
  subcategoryNumber: true,
  criteriaNumber: true,
  guidanceNumber: true, // Auto-generated based on whether guidance exists
  createdAt: true,
  updatedAt: true,
});

export const insertExpiryAlertSchema = createInsertSchema(expiryAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertCompetencyCategory = z.infer<typeof insertCompetencyCategorySchema>;
export type CompetencyCategory = typeof competencyCategories.$inferSelect;

export type InsertCompetencyElement = z.infer<typeof insertCompetencyElementSchema>;
export type CompetencyElement = typeof competencyElements.$inferSelect;

export type InsertCompetency = z.infer<typeof insertCompetencySchema>;
export type Competency = typeof competencies.$inferSelect;

export type InsertJobRole = z.infer<typeof insertJobRoleSchema>;
export type JobRole = typeof jobRoles.$inferSelect;

export type InsertRoleElement = z.infer<typeof insertRoleElementSchema>;
export type RoleElement = typeof roleElements.$inferSelect;

export type InsertCompetencyMatrix = z.infer<typeof insertCompetencyMatrixSchema>;
export type CompetencyMatrix = typeof competencyMatrix.$inferSelect;

export type InsertCompetencyCertification = z.infer<typeof insertCompetencyCertificationSchema>;
export type CompetencyCertification = typeof competencyCertifications.$inferSelect;

export type InsertCompetenceSubcategory = z.infer<typeof insertCompetenceSubcategorySchema>;
export type CompetenceSubcategory = typeof competenceSubcategories.$inferSelect;

export type InsertCompetenceCriteria = z.infer<typeof insertCompetenceCriteriaSchema>;
export type CompetenceCriteria = typeof competenceCriteria.$inferSelect;

export type InsertExpiryAlert = z.infer<typeof insertExpiryAlertSchema>;
export type ExpiryAlert = typeof expiryAlerts.$inferSelect;

// Additional types for UI components
export interface CompetencyTreeNode {
  id: string;
  name: string;
  type: 'category' | 'element';
  children?: CompetencyTreeNode[];
  elementCount?: number;
  categoryId?: string;
}

export interface CompetencyWithDetails extends Competency {
  element: CompetencyElement;
  category: CompetencyCategory;
  jobRoles?: (CompetencyMatrix & { jobRole: JobRole })[];
}

export interface AssessmentMethod {
  id: string;
  name: string;
  code: number;
  selected: boolean;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

// Excel Import Types for Competence Standards
export const excelImportRowSchema = z.object({
  // Column mapping A-J for client assessment standards
  category: z.string().min(1, "Category is required"), // Column A
  element: z.string().min(1, "Element is required"), // Column B  
  subcategory: z.string().min(1, "Subcategory is required"), // Column C
  type: z.enum(['knowledge', 'performance'], { 
    errorMap: () => ({ message: "Type must be 'knowledge' or 'performance'" })
  }), // Column D
  description: z.string().min(1, "Criteria description is required"), // Column E
  proficiencyLevels: z.string().optional(), // Column F - "1", "3", "4" level systems
  proficiencyTerminology: z.string().optional(), // Column G - custom level names
  assessmentMethods: z.array(z.enum(['K', 'KE', 'KP', 'T'])).default([]), // Column H
  criticality: z.enum(['Low', 'Medium', 'High']).default('Medium'), // Column I - case-sensitive
  validityPeriod: z.coerce.number().min(1).max(10).default(3), // Column J - years (with coercion)
  required: z.enum(['O', 'M']).default('M'), // O=Optional, M=Mandatory
  assessorGuidance: z.string().optional(), // KG/PG codes - assessor only
  rowNumber: z.coerce.number().optional(), // For error reporting (with coercion)
});

export const excelImportResultSchema = z.object({
  successCount: z.number(),
  errorCount: z.number(), 
  errors: z.array(z.object({
    row: z.number(),
    field: z.string().optional(),
    message: z.string(),
  })),
  warnings: z.array(z.object({
    row: z.number(), 
    message: z.string(),
  })),
  preview: z.array(excelImportRowSchema).optional(),
});

export type ExcelImportRow = z.infer<typeof excelImportRowSchema>;
export type ExcelImportResult = z.infer<typeof excelImportResultSchema>;

// Client Sector Management
export const businessSectorSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Sector name is required"),
  description: z.string().optional(),
  industry: z.enum([
    'energy_renewables', // Wind, Solar, Hydroelectric
    'oil_gas', // Petroleum, Natural Gas, Offshore
    'manufacturing', // Industrial, Automotive, Aerospace
    'healthcare', // Medical, Pharmaceutical, Biotechnology  
    'technology', // Software, Hardware, AI/ML
    'construction', // Infrastructure, Building, Civil Engineering
    'mining', // Extractive Industries, Minerals
    'logistics', // Transportation, Supply Chain, Shipping
    'finance', // Banking, Insurance, Investment
    'agriculture', // Farming, Food Production, Forestry
    'telecommunications', // Communications, Network Infrastructure
    'defense', // Military, Security, Aerospace Defense
  ]),
  primaryColors: z.array(z.string()).optional(), // AI-generated color palette
  themePrompt: z.string().optional(), // AI prompt for theme generation
  heroImageUrl: z.string().url().optional(), // AI-generated hero image
  lastUpdated: z.string().optional(),
});

export const clientSectorConfigSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  sectorId: z.string(), 
  isActive: z.boolean().default(true),
  customizations: z.object({
    brandName: z.string().optional(),
    logoUrl: z.string().url().optional(),
    customColors: z.array(z.string()).optional(),
    customHeroImage: z.string().url().optional(),
    skillCategories: z.array(z.string()).optional(), // Sector-specific skills
  }).optional(),
});

export type BusinessSector = z.infer<typeof businessSectorSchema>;
export type ClientSectorConfig = z.infer<typeof clientSectorConfigSchema>;

// Translation and Language Support

export const supportedLanguageSchema = z.object({
  code: z.string().min(2, "Language code must be at least 2 characters"), // ISO 639-1 codes
  name: z.string().min(1, "Language name is required"),
  nativeName: z.string().min(1, "Native name is required"),
  rtl: z.boolean().default(false), // Right-to-left languages like Arabic
});

export const languagePreferenceSchema = z.object({
  userId: z.string(),
  primaryLanguage: z.string().default("en"), // ISO 639-1 code
  fallbackLanguage: z.string().default("en"),
  autoTranslate: z.boolean().default(true),
  lastUpdated: z.string().optional(),
});

export const translationRequestSchema = z.object({
  text: z.union([z.string(), z.array(z.string())]),
  sourceLanguage: z.string().optional(), // Auto-detect if not provided
  targetLanguage: z.string(),
  context: z.enum(['competency', 'assessment', 'training', 'skill', 'general']).default('general'),
  preserveFormatting: z.boolean().default(true),
});

export const translationResponseSchema = z.object({
  originalText: z.union([z.string(), z.array(z.string())]),
  translatedText: z.union([z.string(), z.array(z.string())]),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  context: z.string(),
});

// Multilingual data interfaces for competency manager data
export interface MultilingualText {
  [languageCode: string]: string;
}

export interface MultilingualArray {
  [languageCode: string]: string[];
}

// Extended types with translation support
export interface CompetencyCategoryWithTranslations extends CompetencyCategory {
  nameTranslations?: MultilingualText;
  descriptionTranslations?: MultilingualText;
}

export interface CompetencyElementWithTranslations extends CompetencyElement {
  nameTranslations?: MultilingualText;
  descriptionTranslations?: MultilingualText;
  assessorGuidanceTranslations?: MultilingualText;
}

export interface CompetenceSubcategoryWithTranslations extends CompetenceSubcategory {
  nameTranslations?: MultilingualText;
}

export interface CompetenceCriteriaWithTranslations extends CompetenceCriteria {
  descriptionTranslations?: MultilingualText;
}

export interface TrainingWithTranslations extends Training {
  nameTranslations?: MultilingualText;
  descriptionTranslations?: MultilingualText;
}

export interface CompetencyWithTranslations extends Competency {
  nameTranslations?: MultilingualText;
  descriptionTranslations?: MultilingualText;
}

// Assessment and self-assessment translation interfaces
export interface AssessmentTranslation {
  title?: MultilingualText;
  description?: MultilingualText;
}

export interface SelfAssessmentQuestionTranslation {
  question?: MultilingualText;
  description?: MultilingualText;
  options?: MultilingualArray;
  scaleLabels?: MultilingualArray;
  checklistItems?: MultilingualArray;
}

// Skill translation interface
export interface SkillTranslation {
  name?: MultilingualText;
  category?: MultilingualText;
}

// Translation cache for performance optimization
export const translationCacheSchema = z.object({
  id: z.string(),
  sourceText: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  translatedText: z.string(),
  context: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().optional(), // For cache invalidation
});

export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;
export type LanguagePreference = z.infer<typeof languagePreferenceSchema>;
export type TranslationRequest = z.infer<typeof translationRequestSchema>;
export type TranslationResponse = z.infer<typeof translationResponseSchema>;
export type TranslationCache = z.infer<typeof translationCacheSchema>;

// Business Sectors for dropdown selection
export const businessSectors = [
  { value: 'energy_renewables', label: 'Energy & Renewables', description: 'Wind, Solar, Hydroelectric' },
  { value: 'oil_gas', label: 'Oil & Gas', description: 'Petroleum, Natural Gas, Offshore Operations' },
  { value: 'manufacturing', label: 'Manufacturing', description: 'Industrial, Automotive, Aerospace' },
  { value: 'healthcare', label: 'Healthcare', description: 'Medical, Pharmaceutical, Biotechnology' },
  { value: 'technology', label: 'Technology', description: 'Software, Hardware, AI/ML' },
  { value: 'construction', label: 'Construction', description: 'Infrastructure, Building, Civil Engineering' },
  { value: 'mining', label: 'Mining', description: 'Extractive Industries, Minerals' },
  { value: 'logistics', label: 'Logistics', description: 'Transportation, Supply Chain, Shipping' },
  { value: 'finance', label: 'Finance', description: 'Banking, Insurance, Investment' },
  { value: 'agriculture', label: 'Agriculture', description: 'Farming, Food Production, Forestry' },
  { value: 'telecommunications', label: 'Telecommunications', description: 'Communications, Network Infrastructure' },
  { value: 'defense', label: 'Defense', description: 'Military, Security, Aerospace Defense' },
] as const;

// Client Sectors table
export const clientSectors = pgTable("client_sectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id"),
  industry: varchar("industry").notNull(),
  companyName: varchar("company_name"),
  primaryColors: text("primary_colors").array(),
  themeData: json("theme_data"), // AI-generated theme content
  heroImageUrl: varchar("hero_image_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientSectorSchema = createInsertSchema(clientSectors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SelectClientSector = typeof clientSectors.$inferSelect;
export type InsertClientSector = z.infer<typeof insertClientSectorSchema>;

// Assessment & Verification Tables

// Training Enrollments - Track candidate training course allocations
export const trainingEnrollments = pgTable("training_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Candidate
  trainingId: varchar("training_id").notNull(),
  allocatedBy: varchar("allocated_by"), // Admin who allocated
  allocatedDate: timestamp("allocated_date").defaultNow(),
  dueDate: timestamp("due_date"),
  status: varchar("status").notNull().default("allocated"), // allocated, in_progress, completed
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Candidate Allocations - Link assessors to candidates
export const candidateAllocations = pgTable("candidate_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessorId: varchar("assessor_id").notNull(), // User with assessor role
  candidateId: varchar("candidate_id").notNull(), // User with candidate role
  allocatedBy: varchar("allocated_by"), // Admin who created allocation
  allocatedDate: timestamp("allocated_date").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Assessments - Track competence element assessments
export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull(),
  elementId: varchar("element_id").notNull(),
  assessorId: varchar("assessor_id").notNull(),
  assessmentDate: timestamp("assessment_date").defaultNow(),
  outcome: varchar("outcome").notNull(), // competent, not_yet_competent, competent_with_minor_needs
  assessmentMethods: text("assessment_methods").array(), // Methods used: K, KE, KP, T
  assessorComments: text("assessor_comments"),
  expiryDate: timestamp("expiry_date"), // Based on element reassessment period
  verificationId: varchar("verification_id"), // Linked verification if completed
  verificationStatus: varchar("verification_status").default("not_verified"), // not_verified, verified
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Assessment Evidence - File uploads for assessments
export const assessmentEvidence = pgTable("assessment_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"), // bytes
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by").notNull(), // User who uploaded
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Verifier Allocations - Link verifiers to assessors
export const verifierAllocations = pgTable("verifier_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verifierId: varchar("verifier_id").notNull(), // User with internal_verifier role
  assessorId: varchar("assessor_id").notNull(), // User with assessor role
  allocatedBy: varchar("allocated_by"), // Admin who created allocation
  allocatedDate: timestamp("allocated_date").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sampling Plans - Verifier sampling requirements
export const samplingPlans = pgTable("sampling_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verifierId: varchar("verifier_id").notNull(),
  assessorId: varchar("assessor_id").notNull(),
  targetPercentage: integer("target_percentage").notNull().default(10), // % to sample
  periodStartDate: timestamp("period_start_date"),
  periodEndDate: timestamp("period_end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Verifications - Track verification of assessments
export const verifications = pgTable("verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").notNull(),
  verifierId: varchar("verifier_id").notNull(),
  verificationDate: timestamp("verification_date").defaultNow(),
  outcome: varchar("outcome").notNull(), // agreed, disagreed, further_evidence_required
  verifierComments: text("verifier_comments"),
  emailSent: boolean("email_sent").default(false),
  emailSentDate: timestamp("email_sent_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert Schemas for new tables
export const insertTrainingEnrollmentSchema = createInsertSchema(trainingEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCandidateAllocationSchema = createInsertSchema(candidateAllocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssessmentEvidenceSchema = createInsertSchema(assessmentEvidence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerifierAllocationSchema = createInsertSchema(verifierAllocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSamplingPlanSchema = createInsertSchema(samplingPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerificationSchema = createInsertSchema(verifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for new tables
export type InsertTrainingEnrollment = z.infer<typeof insertTrainingEnrollmentSchema>;
export type TrainingEnrollment = typeof trainingEnrollments.$inferSelect;

export type InsertCandidateAllocation = z.infer<typeof insertCandidateAllocationSchema>;
export type CandidateAllocation = typeof candidateAllocations.$inferSelect;

export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;

export type InsertAssessmentEvidence = z.infer<typeof insertAssessmentEvidenceSchema>;
export type AssessmentEvidence = typeof assessmentEvidence.$inferSelect;

export type InsertVerifierAllocation = z.infer<typeof insertVerifierAllocationSchema>;
export type VerifierAllocation = typeof verifierAllocations.$inferSelect;

export type InsertSamplingPlan = z.infer<typeof insertSamplingPlanSchema>;
export type SamplingPlan = typeof samplingPlans.$inferSelect;

export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verifications.$inferSelect;

// Shared AI Theming interfaces
export interface SectorSkills {
  technicalSkills: string[];
  safetySkills: string[];
  leadershipSkills: string[];
  specializedSkills: string[];
}

export interface SectorTheme {
  primaryColors: string[];
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  featuresContent: {
    title: string;
    description: string;
  }[];
  ctaTitle: string;
  ctaDescription: string;
  heroImagePrompt: string;
  industry?: string;
  companyName?: string;
  heroImageUrl?: string;
  skills?: SectorSkills;
}
