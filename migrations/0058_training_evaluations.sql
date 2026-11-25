CREATE TABLE IF NOT EXISTS "training_course_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_key" varchar NOT NULL,
	"course_title" text NOT NULL,
	"decision" varchar NOT NULL,
	"note" text NOT NULL,
	"next_review_on" date,
	"figures" jsonb,
	"created_by" varchar NOT NULL,
	"created_by_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_evaluation_settings" (
	"id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_evaluations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"training_id" varchar,
	"course_key" varchar NOT NULL,
	"course_title" text NOT NULL,
	"category_name" text,
	"form_type" varchar NOT NULL,
	"stage" varchar DEFAULT 'course' NOT NULL,
	"source" varchar NOT NULL,
	"source_ref" varchar NOT NULL,
	"session_id" varchar,
	"provider_name" text,
	"venue_name" text,
	"instructor" text,
	"job_role_name" text,
	"completed_on" date NOT NULL,
	"opens_on" date NOT NULL,
	"due_on" date NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"answers" jsonb,
	"form" jsonb,
	"named" boolean DEFAULT false NOT NULL,
	"decline_reason" text,
	"entered_by" varchar,
	"submitted_at" timestamp,
	"invited_at" timestamp,
	"last_reminder_at" timestamp,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"safety_concern" boolean DEFAULT false NOT NULL,
	"safety_closed_at" timestamp,
	"safety_closed_by" varchar,
	"safety_action" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "training_course_reviews_course_idx" ON "training_course_reviews" USING btree ("course_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "training_evaluations_once_idx" ON "training_evaluations" USING btree ("user_id","course_key","completed_on","stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "training_evaluations_user_idx" ON "training_evaluations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "training_evaluations_course_idx" ON "training_evaluations" USING btree ("course_key");