CREATE TABLE IF NOT EXISTS "appraisal_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appraisal_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"author_role" varchar NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "appraisals" ADD COLUMN IF NOT EXISTS "supervisor_id" varchar;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD COLUMN IF NOT EXISTS "period_type" varchar DEFAULT 'annual' NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD COLUMN IF NOT EXISTS "auto_launch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD COLUMN IF NOT EXISTS "carry_forward" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD COLUMN IF NOT EXISTS "opens_on" timestamp;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD COLUMN IF NOT EXISTS "self_review_opens_on" timestamp;--> statement-breakpoint
ALTER TABLE "performance_cycles" ADD COLUMN IF NOT EXISTS "launched_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supervisor_id" varchar;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appraisal_comments_appraisal_idx" ON "appraisal_comments" USING btree ("appraisal_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appraisals_supervisor_idx" ON "appraisals" USING btree ("supervisor_id");
