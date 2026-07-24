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
  providerSub: varchar("provider_sub"), // OIDC provider subject identifier
  role: varchar("role").notNull().default("candidate"),
  department: varchar("department"),
  location: varchar("location"),
  teamShift: varchar("team_shift"),
  jobRoleId: varchar("job_role_id"),
  dateOfBirth: timestamp("date_of_birth"),
  companyNumber: varchar("company_number"),
  locationId: varchar("location_id"), // structured replacement for `location` - see comment above jobRoles
  businessUnitId: varchar("business_unit_id"), // structured replacement for `department`/free-text org grouping
  managerId: varchar("manager_id"), // self-reference - who this person reports to, for the org chart
  isActive: boolean("is_active").default(true),
  isArchived: boolean("is_archived").default(false),
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
  teamShift: true,
  jobRoleId: true,
  dateOfBirth: true,
  companyNumber: true,
  locationId: true,
  businessUnitId: true,
  managerId: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  providerSub: true,
  role: true,
  department: true,
  location: true,
  teamShift: true,
  jobRoleId: true,
  dateOfBirth: true,
  companyNumber: true,
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
  code: text("code"), // leading 5-digit matrix code extracted from name, e.g. "03164" - used to match this course to a competency element with the same code
  description: text("description"),
  assessmentMethods: text("assessment_methods").array(),
  isSafetyCritical: boolean("is_safety_critical").default(false),
  validityPeriod: integer("validity_period"), // in months
  prerequisites: text("prerequisites").array(),
  estimatedHours: text("estimated_hours"), // free text - source data includes non-numeric values like "TBC"
  deliveryMethod: text("delivery_method"), // "I" Internal or "E" External
  trainingSource: text("training_source"), // "E" E-learning, "TC" Practical Training Course, or "OJT" On the Job Training
  preferredProviderId: varchar("preferred_provider_id"), // optional link to training_providers
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
  reassessmentYears: integer("reassessment_years"), // Column J: years for reassessment
  requiresAssessorGuidance: boolean("requires_assessor_guidance").default(false),
  assessorGuidance: text("assessor_guidance"),
  isCurrent: boolean("is_current").notNull().default(true), // Flag to hide legacy elements
  validityMonths: integer("validity_months"), // Alias for validity period in months
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
  levelId: varchar("level_id"), // Optional - links to proficiency level for multi-level elements (null for single-level)
  code: text("code").notNull(), // e.g., "K 1.1", "P 2.3" (with space)
  criteriaText: text("criteria_text").notNull(), // Column G: Assessment Criteria (PRIMARY field for V2)
  description: text("description"), // LEGACY: Kept for backward compatibility, auto-synced with criteriaText
  type: text("type").notNull(), // "knowledge" or "performance"
  subcategoryNumber: integer("subcategory_number"), // Made optional - null for element-level criteria
  criteriaNumber: integer("criteria_number").notNull(), // 1, 2, 3, etc. (minor number within subcategory)
  assessmentMethods: text("assessment_methods").array(), // [1, 2, 3, 4, 5, 6] checkboxes
  assessorGuidance: text("assessor_guidance"), // Column H: Assessor Guidance (optional, assessor-only)
  guidanceNumber: text("guidance_number"), // e.g., "KG 1.1", "PG 2.3" (auto-generated when guidance exists)
  criticalityRating: text("criticality_rating"), // Column I: Low/Medium/High
  required: boolean("required").default(true), // Column J: M (true) or O (false)
  fmtBold: boolean("fmt_bold").default(false), // Text formatting
  fmtItalic: boolean("fmt_italic").default(false), // Text formatting
  guidanceFmtBold: boolean("guidance_fmt_bold").default(false), // Guidance formatting
  guidanceFmtItalic: boolean("guidance_fmt_italic").default(false), // Guidance formatting
  applicableLevels: text("applicable_levels").array(), // job-seniority level names (standard_levels.name) this criterion applies to, from the SME wizard - null/empty = applies to all
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const competencyLevels = pgTable("competency_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  elementId: varchar("element_id").notNull(),
  name: text("name").notNull(), // "Basic", "Intermediate", "Advanced", or custom names
  code: text("code").notNull(), // "B", "I", "A", or custom codes
  description: text("description"),
  order: integer("order").notNull().default(0), // Display order (0=Basic, 1=Intermediate, 2=Advanced)
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

// Organisational structure - Locations, Business Units, Job Families. These formalize what
// used to be free-text strings scattered across users/jobRoles (location, department,
// businessUnit) into real, referenceable entities. The old free-text columns on users/jobRoles
// are kept as-is for now (existing filters/reports/exports depend on them) - the new *Id columns
// below are additive, backfilled from the existing text values, and are what new features
// (org chart, strategic workforce planning, structured reporting) should build on going forward.
export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  code: text("code"),
  assetType: text("asset_type"), // e.g. "Offshore Platform", "Onshore Terminal", "Office"
  region: text("region"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const businessUnits = pgTable("business_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  code: text("code"),
  parentBusinessUnitId: varchar("parent_business_unit_id"), // self-reference for hierarchy (division > department > team)
  leaderId: varchar("leader_id"), // user who owns rollup reporting for this unit ("asset leader")
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobFamilies = pgTable("job_families", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  code: text("code"),
  description: text("description"),
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
  locationId: varchar("location_id"), // structured replacement for `location`, see comment above
  businessUnitId: varchar("business_unit_id"), // structured replacement for `businessUnit`
  jobFamilyId: varchar("job_family_id"), // groups related roles (e.g. progression ladder) - new dimension, no free-text predecessor
  successionCritical: boolean("succession_critical").default(false), // flags roles that need a succession plan tracked
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Strategic Workforce Planning - future headcount demand (from projects/initiatives) and
// succession coverage for critical roles. Readiness against a target role is computed on the
// fly via getRoleTransitionPlan rather than stored, so it never goes stale.
export const workforceInitiatives = pgTable("workforce_initiatives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  locationId: varchar("location_id"),
  businessUnitId: varchar("business_unit_id"),
  targetDate: timestamp("target_date"), // when the initiative needs its workforce in place
  status: text("status").default("planned"), // "planned", "active", "complete", "cancelled"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Headcount demand for a specific job role, generated by an initiative (new or vacant positions)
export const initiativeRoleRequirements = pgTable("initiative_role_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  initiativeId: varchar("initiative_id").notNull(),
  jobRoleId: varchar("job_role_id").notNull(),
  headcountNeeded: integer("headcount_needed").notNull().default(1),
  requiredByDate: timestamp("required_by_date"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// One succession plan per critical role, optionally tied to whoever currently holds it
export const successionPlans = pgTable("succession_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobRoleId: varchar("job_role_id").notNull(),
  incumbentUserId: varchar("incumbent_user_id"), // nullable - role may already be vacant
  riskLevel: text("risk_level").default("medium"), // "low", "medium", "high" - risk of this becoming vacant
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Nominated successors for a succession plan, ranked by preference
export const successionCandidates = pgTable("succession_candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  successionPlanId: varchar("succession_plan_id").notNull(),
  candidateUserId: varchar("candidate_user_id").notNull(),
  readiness: text("readiness").default("developing"), // "ready_now", "ready_1_2_years", "ready_3_5_years", "developing"
  rank: integer("rank").default(1), // 1 = primary successor
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Onboarding & Induction - checklist templates a new starter (or someone moving into a new
// role) works through, distinct from competency assessment: tasks here are administrative/
// orientation steps (paperwork, site tours, safety briefings, meet-the-team), though a task can
// optionally point at an existing training course for the "book onto this course" steps.
export const inductionPrograms = pgTable("induction_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  jobFamilyId: varchar("job_family_id"), // optional - auto-suggested for new starters in this family
  jobRoleId: varchar("job_role_id"), // optional - more specific than jobFamilyId; either or neither may be set
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inductionTasks = pgTable("induction_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("general"), // "administrative", "safety", "training", "social", "general"
  order: integer("order").default(0),
  required: boolean("required").default(true),
  dueOffsetDays: integer("due_offset_days"), // due N days after the assignment's start date; null = no fixed due date
  linkedTrainingId: varchar("linked_training_id"), // optional - task is "complete this training course"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// One per person going through a program (a new starter, or an existing employee moving role)
export const onboardingAssignments = pgTable("onboarding_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  programId: varchar("program_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  targetCompletionDate: timestamp("target_completion_date"),
  status: text("status").default("in_progress"), // "in_progress", "complete", "overdue", "cancelled"
  assignedBy: varchar("assigned_by"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const onboardingTaskCompletions = pgTable("onboarding_task_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull(),
  taskId: varchar("task_id").notNull(),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"), // who ticked it off - the new starter, their manager, or a buddy
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Learning content hosted against a training course - videos, documents, external links -
// turning the training matrix's course records into actual e-learning material people can work
// through, not just a compliance record. Multiple items per training, shown in order.
export const trainingContent = pgTable("training_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trainingId: varchar("training_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  contentType: text("content_type").notNull().default("document"), // "video_upload", "video_link", "document", "link"
  objectKey: varchar("object_key"), // set for video_upload/document - the Object Storage key holding the real bytes
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  externalUrl: text("external_url"), // set for video_link/link - e.g. a YouTube/Vimeo/SharePoint URL
  durationSeconds: integer("duration_seconds"), // optional, for videos - lets progress be tracked against a known length
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Per-user, per-content-item progress - the granular tracking that makes this a real LMS rather
// than just a pass/fail training record. Rolls up into the training's own enrollment/compliance
// status and, when a task is linked to a training, into that induction task's completion.
export const trainingContentProgress = pgTable("training_content_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  contentId: varchar("content_id").notNull(),
  status: text("status").notNull().default("not_started"), // "not_started", "in_progress", "completed"
  progressPercentage: integer("progress_percentage").default(0),
  timeSpentSeconds: integer("time_spent_seconds").default(0),
  lastPositionSeconds: integer("last_position_seconds"), // for resuming a video partway through
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Append-only audit trail of training completions - a permanent record of "who completed what,
// when, and how" that survives even if the underlying enrollment/progress row is later edited or
// reset. Never updated after insert, only ever added to; a person can appear more than once for
// the same training (e.g. recertification), and that's intentional - each row is one real event.
export const trainingCompletionAudit = pgTable("training_completion_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  trainingId: varchar("training_id").notNull(),
  enrollmentId: varchar("enrollment_id"), // the training_enrollments row this completion applies to, if any existed
  method: text("method").notNull(), // "content_completed" (auto, from watching all e-learning content), "admin_marked", "self_reported"
  completedAt: timestamp("completed_at").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Role Elements - Maps job roles to competency elements (element-level assignments)
export const roleElements = pgTable("role_elements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  elementId: varchar("element_id").notNull(),
  required: boolean("required").default(true), // derived compliance flag: true for M and R, false for D
  requirementLevel: text("requirement_level").default("M"), // "M" Mandatory, "R" Role Specific, "D" Discretionary - per training matrix
  activityType: text("activity_type").default("both"), // "knowledge", "performance", or "both" - which assessment(s) this role needs for the element
  validityYears: integer("validity_years"), // per-role override of reassessment period; falls back to the element's own reassessmentYears when null
  safetyCritical: boolean("safety_critical"), // per-role override of safety criticality; falls back to the element's own safetyCriticality when null
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Role Element Levels - Maps job roles to specific competency element levels
export const roleElementLevels = pgTable("role_element_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  elementId: varchar("element_id").notNull(),
  levelId: varchar("level_id").notNull(), // References competency_levels.id
  required: boolean("required").default(true),
  notes: text("notes"), // Optional notes about why this level is assigned
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Role Trainings - Maps job roles to training courses
// Groups a set of a role's training requirements as alternatives - achieving ANY ONE member
// satisfies the whole group (e.g. three regional variants of the same safety induction course).
// Scoped per role since the same courses could be independent requirements for a different role.
export const trainingRequirementGroups = pgTable("training_requirement_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  label: text("label"), // e.g. "Basic Offshore Safety Induction (any one)" - falls back to member names when null
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const roleTrainings = pgTable("role_trainings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  trainingId: varchar("training_id").notNull(),
  required: boolean("required").default(true), // derived compliance flag: true for M and R, false for D
  requirementLevel: text("requirement_level").default("M"), // "M" Mandatory, "R" Role Specific, "D" Discretionary - per training matrix
  groupId: varchar("group_id"), // set when this requirement is one of several alternatives - see training_requirement_groups
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

// ========================================
// AI-ASSISTED STANDARD AUTHORING (SME wizard)
// ========================================

// Job-seniority levels a knowledge question / scenario can be pitched at - a distinct concept
// from competencyLevels (per-element proficiency scale) and jobRoles.level (free text).
export const standardLevels = pgTable("standard_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // "Apprentice", "Technician", "Engineer", etc.
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// One row per SME "new competency standard" authoring session, from title through to publish.
export const standardDraftSessions = pgTable("standard_draft_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(), // proposed standard/element title
  createdBy: varchar("created_by").notNull(),
  status: text("status").notNull().default("draft"), // "draft" | "published" | "archived"
  jobLevelIds: text("job_level_ids").array(), // selected standard_levels.id values
  jobDescriptionFileUrl: text("job_description_file_url"), // optional grounding document (object storage key)
  companyProcedureFileUrls: text("company_procedure_file_urls").array(), // optional grounding documents
  publishedElementId: varchar("published_element_id"), // set once published into competency_elements
  publishedAt: timestamp("published_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subject matter topics within a draft session (e.g. "Generator Alternator"), each with the
// SME's requested question count and chosen performance-assessment type.
export const standardDraftSubjectMatters = pgTable("standard_draft_subject_matters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  draftSessionId: varchar("draft_session_id").notNull(),
  name: text("name").notNull(),
  requestedQuestionCount: integer("requested_question_count").notNull().default(5),
  performanceAssessmentType: text("performance_assessment_type"), // "scenario" | "work_evidence" - null until SME chooses
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI-generated (then SME-reviewed) knowledge questions per subject matter, optionally pitched
// at a specific job level.
export const standardDraftQuestions = pgTable("standard_draft_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subjectMatterId: varchar("subject_matter_id").notNull(),
  levelId: varchar("level_id"), // standard_levels.id this question is pitched at; null = applies to all selected levels
  questionText: text("question_text").notNull(),
  options: text("options").array().notNull(),
  correctAnswerIndex: integer("correct_answer_index").notNull(),
  explanation: text("explanation"),
  status: text("status").notNull().default("ai_generated"), // "ai_generated" | "approved" | "edited" | "rejected"
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI-generated (then SME-reviewed) performance scenarios per subject matter - only generated
// when the subject matter's performanceAssessmentType is "scenario".
export const standardDraftScenarios = pgTable("standard_draft_scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subjectMatterId: varchar("subject_matter_id").notNull(),
  levelId: varchar("level_id"), // standard_levels.id this scenario is pitched at; null = applies to all selected levels
  title: text("title").notNull(),
  scenarioText: text("scenario_text").notNull(),
  assessmentCriteria: text("assessment_criteria").array(),
  status: text("status").notNull().default("ai_generated"), // "ai_generated" | "approved" | "edited" | "rejected"
  order: integer("order").default(0),
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

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBusinessUnitSchema = createInsertSchema(businessUnits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobFamilySchema = createInsertSchema(jobFamilies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkforceInitiativeSchema = createInsertSchema(workforceInitiatives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // drizzle-zod's default timestamp validation only accepts a real Date object, but clients
  // send dates as JSON strings (e.g. from <input type="date">) - coerce so those aren't rejected.
  targetDate: z.coerce.date().optional().nullable(),
});

export const insertInitiativeRoleRequirementSchema = createInsertSchema(initiativeRoleRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  requiredByDate: z.coerce.date().optional().nullable(),
});

export const insertSuccessionPlanSchema = createInsertSchema(successionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSuccessionCandidateSchema = createInsertSchema(successionCandidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInductionProgramSchema = createInsertSchema(inductionPrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInductionTaskSchema = createInsertSchema(inductionTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOnboardingAssignmentSchema = createInsertSchema(onboardingAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // drizzle-zod's default timestamp validation only accepts a real Date object, but clients
  // send dates as JSON strings (e.g. from <input type="date">) - coerce so those aren't rejected.
  startDate: z.coerce.date(),
  targetCompletionDate: z.coerce.date().optional().nullable(),
});

export const insertOnboardingTaskCompletionSchema = createInsertSchema(onboardingTaskCompletions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  completedAt: z.coerce.date().optional().nullable(),
});

export const insertTrainingContentSchema = createInsertSchema(trainingContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingContentProgressSchema = createInsertSchema(trainingContentProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  completedAt: z.coerce.date().optional().nullable(),
  lastAccessedAt: z.coerce.date().optional().nullable(),
});

export const insertTrainingCompletionAuditSchema = createInsertSchema(trainingCompletionAudit).omit({
  id: true,
  recordedAt: true,
}).extend({
  completedAt: z.coerce.date(),
});

export const insertStandardLevelSchema = createInsertSchema(standardLevels).omit({
  id: true,
  createdAt: true,
});

export const insertStandardDraftSessionSchema = createInsertSchema(standardDraftSessions).omit({
  id: true,
  publishedElementId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStandardDraftSubjectMatterSchema = createInsertSchema(standardDraftSubjectMatters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStandardDraftQuestionSchema = createInsertSchema(standardDraftQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStandardDraftScenarioSchema = createInsertSchema(standardDraftScenarios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompetencyLevelSchema = createInsertSchema(competencyLevels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleElementSchema = createInsertSchema(roleElements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleElementLevelSchema = createInsertSchema(roleElementLevels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleTrainingSchema = createInsertSchema(roleTrainings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingRequirementGroupSchema = createInsertSchema(trainingRequirementGroups).omit({
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

// Bulk criteria creation schema - for adding multiple criteria at once
export const bulkCompetenceCriteriaSchema = z.object({
  // Shared fields applied to all criteria
  elementId: z.string(),
  subcategoryId: z.string().nullable(),
  levelId: z.string().nullable(),
  type: z.enum(["knowledge", "performance", "safety"]),
  assessmentMethods: z.array(z.string()),
  required: z.boolean().default(true),
  
  // Array of individual criteria rows
  criteria: z.array(z.object({
    criteriaText: z.string().min(1, "Criteria text is required"),
    assessorGuidance: z.string().optional().nullable(),
    fmtBold: z.boolean().optional().default(false),
    fmtItalic: z.boolean().optional().default(false),
    guidanceFmtBold: z.boolean().optional().default(false),
    guidanceFmtItalic: z.boolean().optional().default(false),
  })).min(1, "At least one criterion is required"),
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

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

export type InsertBusinessUnit = z.infer<typeof insertBusinessUnitSchema>;
export type BusinessUnit = typeof businessUnits.$inferSelect;

export type InsertJobFamily = z.infer<typeof insertJobFamilySchema>;
export type JobFamily = typeof jobFamilies.$inferSelect;

export type InsertWorkforceInitiative = z.infer<typeof insertWorkforceInitiativeSchema>;
export type WorkforceInitiative = typeof workforceInitiatives.$inferSelect;

export type InsertInitiativeRoleRequirement = z.infer<typeof insertInitiativeRoleRequirementSchema>;
export type InitiativeRoleRequirement = typeof initiativeRoleRequirements.$inferSelect;

export type InsertSuccessionPlan = z.infer<typeof insertSuccessionPlanSchema>;
export type SuccessionPlan = typeof successionPlans.$inferSelect;

export type InsertSuccessionCandidate = z.infer<typeof insertSuccessionCandidateSchema>;
export type SuccessionCandidate = typeof successionCandidates.$inferSelect;

export type InsertInductionProgram = z.infer<typeof insertInductionProgramSchema>;
export type InductionProgram = typeof inductionPrograms.$inferSelect;

export type InsertInductionTask = z.infer<typeof insertInductionTaskSchema>;
export type InductionTask = typeof inductionTasks.$inferSelect;

export type InsertOnboardingAssignment = z.infer<typeof insertOnboardingAssignmentSchema>;
export type OnboardingAssignment = typeof onboardingAssignments.$inferSelect;

export type InsertOnboardingTaskCompletion = z.infer<typeof insertOnboardingTaskCompletionSchema>;
export type OnboardingTaskCompletion = typeof onboardingTaskCompletions.$inferSelect;

// Composite view for a user's onboarding checklist - one program, its tasks, and completion state
export interface OnboardingChecklist {
  assignment: OnboardingAssignment;
  program: InductionProgram;
  tasks: Array<{
    task: InductionTask;
    completion: OnboardingTaskCompletion | null;
  }>;
  statistics: {
    totalTasks: number;
    completedTasks: number;
    completionPercentage: number;
  };
}

export type InsertTrainingContent = z.infer<typeof insertTrainingContentSchema>;
export type TrainingContent = typeof trainingContent.$inferSelect;

export type InsertTrainingContentProgress = z.infer<typeof insertTrainingContentProgressSchema>;
export type TrainingContentProgress = typeof trainingContentProgress.$inferSelect;

// A training's content items paired with the given user's progress on each - the shape both
// the admin content manager and the learner-facing views (My Onboarding, My Training) render.
export interface TrainingContentWithProgress {
  content: TrainingContent;
  progress: TrainingContentProgress | null;
}

export type InsertTrainingCompletionAudit = z.infer<typeof insertTrainingCompletionAuditSchema>;
export type TrainingCompletionAudit = typeof trainingCompletionAudit.$inferSelect;

export type InsertStandardLevel = z.infer<typeof insertStandardLevelSchema>;
export type StandardLevel = typeof standardLevels.$inferSelect;

export type InsertStandardDraftSession = z.infer<typeof insertStandardDraftSessionSchema>;
export type StandardDraftSession = typeof standardDraftSessions.$inferSelect;

export type InsertStandardDraftSubjectMatter = z.infer<typeof insertStandardDraftSubjectMatterSchema>;
export type StandardDraftSubjectMatter = typeof standardDraftSubjectMatters.$inferSelect;

export type InsertStandardDraftQuestion = z.infer<typeof insertStandardDraftQuestionSchema>;
export type StandardDraftQuestion = typeof standardDraftQuestions.$inferSelect;

export type InsertStandardDraftScenario = z.infer<typeof insertStandardDraftScenarioSchema>;
export type StandardDraftScenario = typeof standardDraftScenarios.$inferSelect;

// One row of the completions report - an audit entry enriched with the display fields an admin
// actually wants (who, which course, when, how) so the client never has to stitch these together.
export interface TrainingCompletionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  trainingId: string;
  trainingName: string;
  categoryName: string | null;
  method: string;
  completedAt: Date;
  recordedAt: Date | null;
}

export type InsertCompetencyLevel = z.infer<typeof insertCompetencyLevelSchema>;
export type CompetencyLevel = typeof competencyLevels.$inferSelect;

export type InsertRoleElement = z.infer<typeof insertRoleElementSchema>;
export type RoleElement = typeof roleElements.$inferSelect;

export type InsertRoleElementLevel = z.infer<typeof insertRoleElementLevelSchema>;
export type RoleElementLevel = typeof roleElementLevels.$inferSelect;

export type InsertRoleTraining = z.infer<typeof insertRoleTrainingSchema>;
export type RoleTraining = typeof roleTrainings.$inferSelect;
export type InsertTrainingRequirementGroup = z.infer<typeof insertTrainingRequirementGroupSchema>;
export type TrainingRequirementGroup = typeof trainingRequirementGroups.$inferSelect;

export type InsertCompetencyMatrix = z.infer<typeof insertCompetencyMatrixSchema>;
export type CompetencyMatrix = typeof competencyMatrix.$inferSelect;

export type InsertCompetencyCertification = z.infer<typeof insertCompetencyCertificationSchema>;
export type CompetencyCertification = typeof competencyCertifications.$inferSelect;

export type InsertCompetenceSubcategory = z.infer<typeof insertCompetenceSubcategorySchema>;
export type CompetenceSubcategory = typeof competenceSubcategories.$inferSelect;

export type InsertCompetenceCriteria = z.infer<typeof insertCompetenceCriteriaSchema>;
export type CompetenceCriteria = typeof competenceCriteria.$inferSelect;
export type BulkCompetenceCriteria = z.infer<typeof bulkCompetenceCriteriaSchema>;

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
  type: z.enum(['knowledge', 'performance', 'safety'], {
    errorMap: () => ({ message: "Type must be 'knowledge', 'performance', or 'safety'" })
  }), // Column D
  levelTerm: z.string().optional(), // Column E - Level Terms (Basic, Intermediate, Advanced, etc.)
  proficiencyLevels: z.string().optional(), // Column F - "1", "3", "4" level systems
  description: z.string().min(1, "Criteria description is required"), // Column G - Assessment Criteria
  assessorGuidance: z.string().optional(), // Column H - Assessor Guidance
  criticality: z.enum(['Low', 'Medium', 'High']).default('Medium'), // Column I - case-sensitive
  required: z.enum(['O', 'M']).default('M'), // Column J - M=Mandatory, O=Optional
  assessmentMethods: z.array(z.enum(['K', 'KE', 'KP', 'T'])).default([]), // Legacy field
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
  achievementDate: timestamp("achievement_date"), // when the candidate actually completed the training
  expiryDate: timestamp("expiry_date"), // when this completion stops counting as current
  certificateFileName: text("certificate_file_name"), // display name shown to users
  certificateObjectKey: text("certificate_object_key"), // Object Storage key - never exposed directly, downloads go through a route that checks permissions first
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
  levelId: varchar("level_id"), // Optional: Specific proficiency level (Basic, Intermediate, Advanced)
  assessorId: varchar("assessor_id").notNull(),
  assessmentDate: timestamp("assessment_date").defaultNow(),
  outcome: varchar("outcome").notNull(), // competent, not_yet_competent, competent_with_minor_needs
  assessmentMethods: text("assessment_methods").array(), // Methods used: Observation, Simulation, Demonstration, etc.
  assessorComments: text("assessor_comments"),
  
  // Sign-off specific fields
  knowledgeOutcomes: text("knowledge_outcomes"), // Knowledge outcomes from sign-off
  performanceOutcomes: text("performance_outcomes"), // Performance outcomes from sign-off
  overallComment: text("overall_comment"), // Overall assessment comment from sign-off
  signOffAt: timestamp("sign_off_at"), // When assessment was signed off
  signOffAssessorId: varchar("sign_off_assessor_id"), // Who signed off the assessment
  
  // Minor needs fields for competent_with_minor_needs outcome
  minorNeedsComment: text("minor_needs_comment"), // Comment explaining minor needs
  minorNeedsDueDate: timestamp("minor_needs_due_date", { withTimezone: true }), // Due date for minor needs completion

  expiryDate: timestamp("expiry_date"), // Based on element reassessment period
  verificationId: varchar("verification_id"), // Linked verification if completed
  verificationStatus: varchar("verification_status").default("not_verified"), // not_verified, verified
  notifiedCandidateAt: timestamp("notified_candidate_at", { withTimezone: true }), // When candidate was notified of outcome
  plannedAssessmentDate: timestamp("planned_assessment_date", { withTimezone: true }), // Actual scheduled date/time, set by the assessor
  plannedAssessmentLocation: varchar("planned_assessment_location"), // Where the scheduled assessment will take place
  plannedAssessmentNotes: text("planned_assessment_notes"), // Assessor's instructions for the candidate (e.g. evidence to bring)
  candidateReadyAt: timestamp("candidate_ready_at", { withTimezone: true }), // When the candidate flagged themselves ready for assessment
  isAssignment: boolean("is_assignment"), // True if this row is an element assignment placeholder rather than a completed assessment
  origin: text("origin"), // Where this assessment/assignment row originated from (e.g. role assignment vs manual)
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
  aiVerdict: varchar("ai_verdict"), // "valid" | "inconclusive" | "invalid" - set by the AI evidence review
  aiConfidence: integer("ai_confidence"), // 0-100
  aiReasoning: text("ai_reasoning"),
  aiReviewedAt: timestamp("ai_reviewed_at"),
  rejectedAt: timestamp("rejected_at"), // set by an assessor/verifier marking this evidence not applicable
  rejectedBy: varchar("rejected_by"),
  rejectionReason: text("rejection_reason"), // relayed to the candidate by email when rejected
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
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }), // when the assessor acknowledged this verification
  acknowledgedBy: varchar("acknowledged_by"), // who acknowledged it - usually the assessment's own assessor
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Assessment Feedback - Feedback threads for assessments
export const assessmentFeedback = pgTable("assessment_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").notNull(),
  authorId: varchar("author_id").notNull(),
  authorRole: varchar("author_role").notNull(), // candidate, assessor, verifier
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Verification Tasks - Queue for verifier workflow
export const verificationTasks = pgTable("verification_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").notNull().unique(),
  assessorId: varchar("assessor_id"),
  verifierId: varchar("verifier_id"),
  status: varchar("status").notNull().default("pending"), // pending, verified, rejected
  createdAt: timestamp("created_at").defaultNow(),
  decidedAt: timestamp("decided_at"),
});

// Insert Schemas for new tables
export const insertTrainingEnrollmentSchema = createInsertSchema(trainingEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // See insertAssessmentSchema above for why these need coercion - same drizzle-zod issue.
  allocatedDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  achievementDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
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
}).extend({
  levelId: z.string().optional().nullable(),
  // drizzle-zod's default timestamp validation only accepts a real Date object, but every
  // client sends dates as JSON strings (e.g. from <input type="date">) - coerce so those
  // requests don't get rejected with "Expected date, received string".
  assessmentDate: z.coerce.date().optional().nullable(),
  signOffAt: z.coerce.date().optional().nullable(),
  minorNeedsDueDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  notifiedCandidateAt: z.coerce.date().optional().nullable(),
  plannedAssessmentDate: z.coerce.date().optional().nullable(),
  candidateReadyAt: z.coerce.date().optional().nullable(),
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

export const insertAssessmentFeedbackSchema = createInsertSchema(assessmentFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertVerificationTaskSchema = createInsertSchema(verificationTasks).omit({
  id: true,
  createdAt: true,
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

export type InsertAssessmentFeedback = z.infer<typeof insertAssessmentFeedbackSchema>;
export type AssessmentFeedback = typeof assessmentFeedback.$inferSelect;

export type InsertVerificationTask = z.infer<typeof insertVerificationTaskSchema>;
export type VerificationTask = typeof verificationTasks.$inferSelect;

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

// Skills Gap Analysis Types
export type ElementStatus = 'current' | 'expiring_30' | 'expiring_60' | 'expiring_90' | 'expired' | 'missing';

export interface SkillsGapElement {
  element: CompetencyElement;
  required: boolean;
  requirementLevel: string; // "M" Mandatory, "R" Role Specific, "D" Discretionary - from the role's own requirement, not the element's
  safetyCritical: boolean; // role_elements.safetyCritical override, falling back to the element's own safetyCriticality when null
  status: ElementStatus;
  assessment?: Assessment;
  daysUntilExpiry?: number;
}

export interface SkillsGapAnalysis {
  user: User;
  jobRole: JobRole;
  elements: SkillsGapElement[];
  statistics: {
    totalRequired: number;
    totalOptional: number;
    current: number;
    expiringSoon30: number;
    expiringSoon60: number;
    expiringSoon90: number;
    expired: number;
    missing: number;
    coveragePercentage: number;
  };
}

// Training Compliance Types
export interface TrainingComplianceMember {
  training: Training;
  requirementLevel: string; // "M" Mandatory, "R" Role Specific, "D" Discretionary - from the role's own requirement
  status: ElementStatus;
  enrollment?: TrainingEnrollment;
  daysUntilExpiry?: number;
}

// One row in a person's training compliance view. Standalone requirements have exactly one
// member and groupId is null; a 1-of-N alternative group has 2+ members and groupId set - its
// status is the BEST status among its members, since completing any one satisfies the group.
export interface TrainingComplianceItem {
  groupId: string | null;
  label: string;
  required: boolean;
  requirementLevel: string; // "M" Mandatory, "R" Role Specific, "D" Discretionary - from the first member's requirement
  status: ElementStatus;
  members: TrainingComplianceMember[];
}

export interface TrainingComplianceAnalysis {
  user: User;
  jobRole: JobRole;
  items: TrainingComplianceItem[];
  statistics: {
    totalRequired: number;
    totalOptional: number;
    current: number;
    expiringSoon30: number;
    expiringSoon60: number;
    expiringSoon90: number;
    expired: number;
    missing: number;
    coveragePercentage: number;
  };
}

// Role Transition Planning Types
export interface RoleTransitionElement {
  element: CompetencyElement;
  requiredByTarget: boolean;
  status: ElementStatus;
  assessment?: Assessment;
  daysUntilExpiry?: number;
  alreadyRequiredByCurrentRole: boolean; // false = a genuinely new requirement for the target role
}

export interface RoleTransitionPlan {
  user: User;
  currentRole: JobRole | null;
  targetRole: JobRole;
  elements: RoleTransitionElement[];
  statistics: {
    totalRequiredByTarget: number;
    alreadyMet: number;
    gapsToClose: number;
    newRequirements: number;
    coveragePercentage: number;
  };
}

// Competence Document Import Types
export type ElementCriteriaType = "safety" | "knowledge" | "performance";

export interface CompetenceDocumentImportSummary {
  filesProcessed: string[];
  filesSkipped: Array<{ path: string; reason: string }>;
  elementsCreated: number;
  elementsReused: number;
  subcategoriesCreated: number;
  subcategoriesReused: number;
  criteriaCreated: number;
  criteriaUpdated: number;
  roleElementLinksCreated: number;
  roleElementLinksSkipped: number;
  errors: string[];
}

// Training Matrix Import Types
export interface TrainingMatrixImportSummary {
  sheetsProcessed: string[];
  sheetsSkipped: string[];
  categoriesCreated: number;
  categoriesReused: number;
  trainingsCreated: number;
  trainingsReused: number;
  jobRolesCreated: number;
  jobRolesReused: number;
  roleTrainingLinksCreated: number;
  roleTrainingLinksUpdated: number;
  roleTrainingLinksSkipped: number;
  errors: string[];
  pendingChanges: TrainingMatrixPendingChanges;
}

// A proposed training-course requirement change/removal for an existing role_trainings link,
// held for admin review rather than applied automatically (unlike new links, which are safe
// to auto-apply since they can't affect anyone's existing compliance status).
export interface PendingTrainingLinkChange {
  roleTrainingId: string;
  roleId: string;
  roleName: string;
  trainingId: string;
  trainingName: string;
  fromLevel: string | null;
  toLevel: string | null; // null for a removal (cell was blank in the re-uploaded matrix)
}

// A proposed role_elements link/change/removal. "direct" means the matrix's own COMPETENCE
// ELEMENTS section gave per-role M/R/D for this element by code - authoritative. "inferred"
// means it was guessed by matching a competency element's 5-digit code to a training course
// with the same code and borrowing that course's per-role M/R/D - a heuristic, used only when
// no direct data exists. Either way this is always advisory - the admin must confirm, never
// auto-applied.
export interface PendingElementLinkSuggestion {
  roleElementId: string | null; // null for a brand-new suggested link
  roleId: string;
  roleName: string;
  elementId: string;
  elementName: string;
  source: "direct" | "inferred";
  matchedTrainingName: string | null; // set only when source is "inferred"
  matchedCode: string;
  fromLevel: string | null; // null for a new suggestion
  toLevel: string | null; // null for a removal
  activityType?: string | null; // only populated for new "direct" additions
  validityYears?: number | null;
  safetyCritical?: boolean | null;
}

// The same role name appears as a column on more than one sheet (common for cross-discipline
// roles like "Maintenance Manager"), and those sheets disagree on the M/R/D value for the same
// course/element. There's no single correct answer to auto-resolve here - surfaced as-is so the
// admin can fix the source workbook or resolve it directly in the app. Never auto-applied.
export interface PendingTrainingLinkConflict {
  roleId: string;
  roleName: string;
  trainingId: string;
  trainingName: string;
  observedValues: Array<{ value: string | null; sheets: string[] }>; // value null = blank/not required
}

export interface PendingElementLinkConflict {
  roleId: string;
  roleName: string;
  elementId: string;
  elementName: string;
  observedValues: Array<{ value: string | null; sheets: string[] }>;
}

export interface TrainingMatrixPendingChanges {
  trainingLinkChanges: PendingTrainingLinkChange[];
  trainingLinkRemovals: PendingTrainingLinkChange[];
  trainingLinkConflicts: PendingTrainingLinkConflict[];
  elementLinkAdditions: PendingElementLinkSuggestion[];
  elementLinkChanges: PendingElementLinkSuggestion[];
  elementLinkRemovals: PendingElementLinkSuggestion[];
  elementLinkConflicts: PendingElementLinkConflict[];
}

// A single approved item sent back to the apply-pending endpoint, identifying which pending
// change the admin confirmed and from which bucket.
export interface ApplyTrainingMatrixPendingRequest {
  trainingLinkChanges?: PendingTrainingLinkChange[];
  trainingLinkRemovals?: PendingTrainingLinkChange[];
  elementLinkAdditions?: PendingElementLinkSuggestion[];
  elementLinkChanges?: PendingElementLinkSuggestion[];
  elementLinkRemovals?: PendingElementLinkSuggestion[];
}

// Team Compliance Matrix Types
export interface TeamComplianceElementResult {
  element: CompetencyElement;
  required: boolean;
  status: ElementStatus;
  daysUntilExpiry?: number;
}

export interface TeamComplianceMember {
  user: User;
  elements: TeamComplianceElementResult[];
  coveragePercentage: number;
}

export interface TeamComplianceMatrix {
  jobRole: JobRole;
  location: string;
  requiredElements: CompetencyElement[];
  members: TeamComplianceMember[];
}

// Notification System Tables
export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  notificationType: varchar("notification_type").notNull(),
  daysBeforeExpiry: integer("days_before_expiry"),
  isEnabled: boolean("is_enabled").default(true),
  recipientRoles: text("recipient_roles").array(),
  emailTemplate: text("email_template"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settingId: varchar("setting_id"),
  recipientId: varchar("recipient_id").notNull(),
  recipientEmail: varchar("recipient_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at"),
  status: varchar("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSettingSchema = createInsertSchema(notificationSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationSetting = z.infer<typeof insertNotificationSettingSchema>;
export type NotificationSetting = typeof notificationSettings.$inferSelect;

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({ id: true, createdAt: true });
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;

// Training Management & Booking System (External Courses)
// For booking external training courses/sessions with providers

export const trainingProviders = pgTable("training_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  website: varchar("website"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trainingVenues = pgTable("training_venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  isVirtual: boolean("is_virtual").default(false),
  capacity: integer("capacity"),
  amenities: text("amenities").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const externalTrainingCourses = pgTable("external_training_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  modality: varchar("modality"), // e.g., 'Online', 'In-Person', 'Hybrid'
  durationHours: integer("duration_hours"),
  cost: text("cost"), // storing as text for flexibility (e.g., "500.00 USD")
  providerId: varchar("provider_id"),
  language: varchar("language").default("en"),
  tags: text("tags").array(),
  prerequisites: text("prerequisites").array(),
  targetAudience: text("target_audience"),
  learningOutcomes: text("learning_outcomes").array(),
  certificationProvided: boolean("certification_provided").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const courseTrainingSessions = pgTable("course_training_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  timezone: varchar("timezone").default("UTC"),
  capacity: integer("capacity").notNull(),
  seatsRemaining: integer("seats_remaining").notNull(),
  venueId: varchar("venue_id"),
  language: varchar("language").default("en"),
  instructor: text("instructor"),
  status: varchar("status").default("scheduled"), // scheduled, in_progress, completed, cancelled
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Training Policy Matrix - defines training requirements by job role
export const trainingPolicyMatrix = pgTable("training_policy_matrix", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobRoleId: varchar("job_role_id").notNull(),
  courseId: varchar("course_id").notNull(),
  policyStatus: varchar("policy_status").notNull(), // MANDATORY, OPTIONAL, NA
  requiresApproval: boolean("requires_approval").default(false),
  costCap: text("cost_cap"), // maximum cost allowed for this role/course
  approverChain: jsonb("approver_chain"), // array of approver roles [{role: 'manager', level: 1}, ...]
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const courseBookings = pgTable("course_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  status: varchar("status").notNull().default("requested"), // requested, pending_approval, approved, booked, waitlisted, cancelled, completed, no_show
  priceLocked: text("price_locked"),
  fundingSource: text("funding_source"),
  requestedBy: varchar("requested_by"),
  notes: text("notes"),
  completionDate: timestamp("completion_date"),
  certificateUrl: text("certificate_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bookingApprovals = pgTable("booking_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(),
  step: integer("step").notNull(), // approval step number
  approverRole: varchar("approver_role").notNull(),
  approverId: varchar("approver_id"),
  state: varchar("state").notNull().default("pending"), // pending, approved, rejected, expired
  decidedAt: timestamp("decided_at"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas and types for Training Management & Booking
export const insertTrainingProviderSchema = createInsertSchema(trainingProviders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrainingProvider = z.infer<typeof insertTrainingProviderSchema>;
export type TrainingProvider = typeof trainingProviders.$inferSelect;

export const insertTrainingVenueSchema = createInsertSchema(trainingVenues).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrainingVenue = z.infer<typeof insertTrainingVenueSchema>;
export type TrainingVenue = typeof trainingVenues.$inferSelect;

export const insertExternalTrainingCourseSchema = createInsertSchema(externalTrainingCourses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExternalTrainingCourse = z.infer<typeof insertExternalTrainingCourseSchema>;
export type ExternalTrainingCourse = typeof externalTrainingCourses.$inferSelect;

export const insertCourseTrainingSessionSchema = createInsertSchema(courseTrainingSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCourseTrainingSession = z.infer<typeof insertCourseTrainingSessionSchema>;
export type CourseTrainingSession = typeof courseTrainingSessions.$inferSelect;

export const insertTrainingPolicyMatrixSchema = createInsertSchema(trainingPolicyMatrix).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrainingPolicyMatrix = z.infer<typeof insertTrainingPolicyMatrixSchema>;
export type TrainingPolicyMatrix = typeof trainingPolicyMatrix.$inferSelect;

export const insertCourseBookingSchema = createInsertSchema(courseBookings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCourseBooking = z.infer<typeof insertCourseBookingSchema>;
export type CourseBooking = typeof courseBookings.$inferSelect;

export const insertBookingApprovalSchema = createInsertSchema(bookingApprovals).omit({ id: true, createdAt: true });
export type InsertBookingApproval = z.infer<typeof insertBookingApprovalSchema>;
export type BookingApproval = typeof bookingApprovals.$inferSelect;
