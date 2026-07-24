CREATE TABLE "standard_draft_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_matter_id" varchar NOT NULL,
	"level_id" varchar,
	"question_text" text NOT NULL,
	"options" text[] NOT NULL,
	"correct_answer_index" integer NOT NULL,
	"explanation" text,
	"status" text DEFAULT 'ai_generated' NOT NULL,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "standard_draft_scenarios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_matter_id" varchar NOT NULL,
	"level_id" varchar,
	"title" text NOT NULL,
	"scenario_text" text NOT NULL,
	"assessment_criteria" text[],
	"status" text DEFAULT 'ai_generated' NOT NULL,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "standard_draft_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_by" varchar NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"job_level_ids" text[],
	"job_description_file_url" text,
	"company_procedure_file_urls" text[],
	"published_element_id" varchar,
	"published_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "standard_draft_subject_matters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_session_id" varchar NOT NULL,
	"name" text NOT NULL,
	"requested_question_count" integer DEFAULT 5 NOT NULL,
	"performance_assessment_type" text,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "standard_levels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "standard_levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "ai_verdict" varchar;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "ai_confidence" integer;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "ai_reasoning" text;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "ai_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "competence_criteria" ADD COLUMN "applicable_levels" text[];