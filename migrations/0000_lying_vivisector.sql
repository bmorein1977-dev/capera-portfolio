CREATE TABLE "assessment_evidence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_by" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assessment_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"author_role" varchar NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" varchar NOT NULL,
	"element_id" varchar NOT NULL,
	"level_id" varchar,
	"assessor_id" varchar NOT NULL,
	"assessment_date" timestamp DEFAULT now(),
	"outcome" varchar NOT NULL,
	"assessment_methods" text[],
	"assessor_comments" text,
	"knowledge_outcomes" text,
	"performance_outcomes" text,
	"overall_comment" text,
	"sign_off_at" timestamp,
	"sign_off_assessor_id" varchar,
	"minor_needs_comment" text,
	"minor_needs_due_date" timestamp,
	"expiry_date" timestamp,
	"verification_id" varchar,
	"verification_status" varchar DEFAULT 'not_verified',
	"notified_candidate_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "booking_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" varchar NOT NULL,
	"step" integer NOT NULL,
	"approver_role" varchar NOT NULL,
	"approver_id" varchar,
	"state" varchar DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "candidate_allocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessor_id" varchar NOT NULL,
	"candidate_id" varchar NOT NULL,
	"allocated_by" varchar,
	"allocated_date" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_sectors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar,
	"industry" varchar NOT NULL,
	"company_name" varchar,
	"primary_colors" text[],
	"theme_data" json,
	"hero_image_url" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competence_criteria" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subcategory_id" varchar,
	"element_id" varchar NOT NULL,
	"level_id" varchar,
	"code" text NOT NULL,
	"criteria_text" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"subcategory_number" integer,
	"criteria_number" integer NOT NULL,
	"assessment_methods" text[],
	"assessor_guidance" text,
	"guidance_number" text,
	"criticality_rating" text,
	"required" boolean DEFAULT true,
	"fmt_bold" boolean DEFAULT false,
	"fmt_italic" boolean DEFAULT false,
	"guidance_fmt_bold" boolean DEFAULT false,
	"guidance_fmt_italic" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competence_subcategories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"element_id" varchar NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"element_id" varchar NOT NULL,
	"name" text NOT NULL,
	"external_id" text,
	"type" text DEFAULT 'technical' NOT NULL,
	"level" text,
	"critical" boolean DEFAULT false,
	"safety_critical" boolean DEFAULT false,
	"group" text,
	"assessment_methods" text[],
	"evidence_requirements" text[],
	"passing_threshold" integer DEFAULT 80,
	"translations" json,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competency_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"parent_id" varchar,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "competency_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "competency_certifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"competency_id" varchar NOT NULL,
	"proficiency_level" text NOT NULL,
	"certified_date" timestamp NOT NULL,
	"expiry_date" timestamp,
	"assessor_id" varchar,
	"assessment_method" text,
	"evidence_reference" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competency_elements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"external_id" text,
	"description" text,
	"proficiency_scale" text DEFAULT 'one-point' NOT NULL,
	"proficiency_scheme" integer DEFAULT 1,
	"safety_criticality" text DEFAULT 'Medium' NOT NULL,
	"validity_period" integer,
	"reassessment_years" integer,
	"requires_assessor_guidance" boolean DEFAULT false,
	"assessor_guidance" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"validity_months" integer,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competency_levels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"element_id" varchar NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competency_matrix" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_role_id" varchar NOT NULL,
	"competency_id" varchar NOT NULL,
	"proficiency_level" text NOT NULL,
	"is_mandatory" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"status" varchar DEFAULT 'requested' NOT NULL,
	"price_locked" text,
	"funding_source" text,
	"requested_by" varchar,
	"notes" text,
	"completion_date" timestamp,
	"certificate_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "course_training_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" varchar NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"timezone" varchar DEFAULT 'UTC',
	"capacity" integer NOT NULL,
	"seats_remaining" integer NOT NULL,
	"venue_id" varchar,
	"language" varchar DEFAULT 'en',
	"instructor" text,
	"status" varchar DEFAULT 'scheduled',
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expiry_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certification_id" varchar NOT NULL,
	"alert_type" text NOT NULL,
	"alert_date" timestamp NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "external_training_courses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"modality" varchar,
	"duration_hours" integer,
	"cost" text,
	"provider_id" varchar,
	"language" varchar DEFAULT 'en',
	"tags" text[],
	"prerequisites" text[],
	"target_audience" text,
	"learning_outcomes" text[],
	"certification_provided" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"client_id" varchar,
	"department" text,
	"location" text,
	"business_unit" text,
	"level" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_roles_name_unique" UNIQUE("name"),
	CONSTRAINT "job_roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_id" varchar,
	"recipient_id" varchar NOT NULL,
	"recipient_email" varchar NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"notification_type" varchar NOT NULL,
	"days_before_expiry" integer,
	"is_enabled" boolean DEFAULT true,
	"recipient_roles" text[],
	"email_template" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_element_levels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"element_id" varchar NOT NULL,
	"level_id" varchar NOT NULL,
	"required" boolean DEFAULT true,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_elements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"element_id" varchar NOT NULL,
	"required" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_trainings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"training_id" varchar NOT NULL,
	"required" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sampling_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verifier_id" varchar NOT NULL,
	"assessor_id" varchar NOT NULL,
	"target_percentage" integer DEFAULT 10 NOT NULL,
	"period_start_date" timestamp,
	"period_end_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" varchar DEFAULT '#6b7280' NOT NULL,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_certificates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"training_id" varchar NOT NULL,
	"achievement_date" timestamp,
	"expiry_date" timestamp,
	"certificate_url" text,
	"certificate_file_name" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"training_id" varchar NOT NULL,
	"allocated_by" varchar,
	"allocated_date" timestamp DEFAULT now(),
	"due_date" timestamp,
	"status" varchar DEFAULT 'allocated' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_levels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_id" varchar NOT NULL,
	"level" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"criteria" text[],
	"knowledge_elements" text[],
	"performance_elements" text[],
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_policy_matrix" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_role_id" varchar NOT NULL,
	"course_id" varchar NOT NULL,
	"policy_status" varchar NOT NULL,
	"requires_approval" boolean DEFAULT false,
	"cost_cap" text,
	"approver_chain" jsonb,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_providers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"contact_email" varchar,
	"contact_phone" varchar,
	"website" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_venues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"address" text,
	"city" text,
	"country" text,
	"latitude" text,
	"longitude" text,
	"is_virtual" boolean DEFAULT false,
	"capacity" integer,
	"amenities" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trainings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"assessment_methods" text[],
	"is_safety_critical" boolean DEFAULT false,
	"validity_period" integer,
	"prerequisites" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"provider_sub" varchar,
	"role" varchar DEFAULT 'candidate' NOT NULL,
	"department" varchar,
	"location" varchar,
	"team_shift" varchar,
	"job_role_id" varchar,
	"date_of_birth" timestamp,
	"company_number" varchar,
	"is_active" boolean DEFAULT true,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"assessor_id" varchar,
	"verifier_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"decided_at" timestamp,
	CONSTRAINT "verification_tasks_assessment_id_unique" UNIQUE("assessment_id")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"verifier_id" varchar NOT NULL,
	"verification_date" timestamp DEFAULT now(),
	"outcome" varchar NOT NULL,
	"verifier_comments" text,
	"email_sent" boolean DEFAULT false,
	"email_sent_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verifier_allocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verifier_id" varchar NOT NULL,
	"assessor_id" varchar NOT NULL,
	"allocated_by" varchar,
	"allocated_date" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");