CREATE TABLE "appraisal_behaviour_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appraisal_id" varchar NOT NULL,
	"behaviour_id" varchar NOT NULL,
	"self_rating" integer,
	"self_comment" text,
	"manager_rating" integer,
	"manager_comment" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appraisals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"cycle_id" varchar NOT NULL,
	"manager_id" varchar,
	"status" varchar DEFAULT 'objectives' NOT NULL,
	"self_summary" text,
	"self_performance_rating" integer,
	"manager_summary" text,
	"performance_rating" integer,
	"potential_rating" integer,
	"development_plan" text,
	"career_aspirations" text,
	"mobility" text,
	"employee_comments" text,
	"calibration_note" text,
	"scores" jsonb,
	"self_submitted_at" timestamp,
	"manager_submitted_at" timestamp,
	"calibrated_at" timestamp,
	"calibrated_by" varchar,
	"meeting_date" timestamp,
	"employee_signed_off_at" timestamp,
	"manager_signed_off_at" timestamp,
	"source" varchar DEFAULT 'internal' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "behaviours" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"indicators" text[],
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appraisal_id" varchar NOT NULL,
	"subject_user_id" varchar NOT NULL,
	"rater_id" varchar NOT NULL,
	"rater_type" varchar NOT NULL,
	"status" varchar DEFAULT 'proposed' NOT NULL,
	"proposed_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"strengths_comment" text,
	"development_comment" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"behaviour_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "objective_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objective_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"note" text NOT NULL,
	"progress_percent" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_cycles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"objective_deadline" timestamp,
	"self_review_deadline" timestamp,
	"manager_review_deadline" timestamp,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"rating_scale" integer DEFAULT 5 NOT NULL,
	"includes_360" boolean DEFAULT true NOT NULL,
	"requires_calibration" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_objectives" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appraisal_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"cycle_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"success_measure" text,
	"weighting" integer DEFAULT 0 NOT NULL,
	"category" varchar DEFAULT 'delivery' NOT NULL,
	"target_date" timestamp,
	"parent_objective_id" varchar,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"agreed_at" timestamp,
	"self_outcome" varchar,
	"self_comment" text,
	"manager_outcome" varchar,
	"manager_comment" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "talent_score_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weight_competence" integer DEFAULT 30 NOT NULL,
	"weight_training" integer DEFAULT 20 NOT NULL,
	"weight_experience" integer DEFAULT 20 NOT NULL,
	"weight_qualifications" integer DEFAULT 10 NOT NULL,
	"weight_performance" integer DEFAULT 20 NOT NULL,
	"experience_years_for_full" integer DEFAULT 10 NOT NULL,
	"review_window_months" integer DEFAULT 18 NOT NULL,
	"perf_weight_objectives" integer DEFAULT 40 NOT NULL,
	"perf_weight_rating" integer DEFAULT 30 NOT NULL,
	"perf_weight_behaviours" integer DEFAULT 30 NOT NULL,
	"feedback_share_of_behaviours" integer DEFAULT 50 NOT NULL,
	"min_feedback_raters" integer DEFAULT 3 NOT NULL,
	"min_components_for_score" integer DEFAULT 3 NOT NULL,
	"include_performance_in_score" boolean DEFAULT true NOT NULL,
	"performance_visible_to_managers" boolean DEFAULT false NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_experience" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"employer" text NOT NULL,
	"title" text NOT NULL,
	"job_family_id" varchar,
	"job_role_id" varchar,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"description" text,
	"source" varchar DEFAULT 'manual' NOT NULL,
	"verified" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_qualifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"level" integer,
	"awarding_body" text,
	"awarded_date" timestamp,
	"expiry_date" timestamp,
	"source" varchar DEFAULT 'manual' NOT NULL,
	"verified" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "appraisal_behaviour_idx" ON "appraisal_behaviour_ratings" USING btree ("appraisal_id","behaviour_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appraisals_user_cycle_idx" ON "appraisals" USING btree ("user_id","cycle_id");--> statement-breakpoint
CREATE INDEX "appraisals_manager_idx" ON "appraisals" USING btree ("manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_request_rater_idx" ON "feedback_requests" USING btree ("appraisal_id","rater_id");--> statement-breakpoint
CREATE INDEX "feedback_request_rater_inbox_idx" ON "feedback_requests" USING btree ("rater_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_response_idx" ON "feedback_responses" USING btree ("request_id","behaviour_id");--> statement-breakpoint
CREATE INDEX "perf_obj_appraisal_idx" ON "performance_objectives" USING btree ("appraisal_id");--> statement-breakpoint
CREATE INDEX "perf_obj_user_idx" ON "performance_objectives" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_experience_user_idx" ON "user_experience" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_qualifications_user_idx" ON "user_qualifications" USING btree ("user_id");