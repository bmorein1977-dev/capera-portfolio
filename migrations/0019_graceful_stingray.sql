CREATE TABLE "assessment_knowledge_answers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"criteria_id" varchar NOT NULL,
	"selected_answer_index" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "competency_element_target_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"element_id" varchar NOT NULL,
	"standard_level_id" varchar NOT NULL,
	"target_score" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "self_assessment_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "self_assessment_score_percent" integer;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "self_score" integer;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "self_score_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "assessor_score" integer;--> statement-breakpoint
ALTER TABLE "competence_criteria" ADD COLUMN "mcq_options" text[];--> statement-breakpoint
ALTER TABLE "competence_criteria" ADD COLUMN "mcq_correct_answer_index" integer;--> statement-breakpoint
ALTER TABLE "competency_elements" ADD COLUMN "self_assessment_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "job_roles" ADD COLUMN "standard_level_id" varchar;