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
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

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
  safetyCriticality: text("safety_criticality").notNull().default("low"), // "low", "medium", "high"
  validityPeriod: integer("validity_period"), // months
  requiresAssessorGuidance: boolean("requires_assessor_guidance").default(false),
  assessorGuidance: text("assessor_guidance"),
  order: integer("order").default(0),
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
  department: text("department"),
  level: text("level"), // "trainee", "technician", "supervisor", "manager", etc.
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

export type InsertCompetencyMatrix = z.infer<typeof insertCompetencyMatrixSchema>;
export type CompetencyMatrix = typeof competencyMatrix.$inferSelect;

export type InsertCompetencyCertification = z.infer<typeof insertCompetencyCertificationSchema>;
export type CompetencyCertification = typeof competencyCertifications.$inferSelect;

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
