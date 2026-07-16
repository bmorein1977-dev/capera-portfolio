ALTER TABLE "assessments" ALTER COLUMN "minor_needs_due_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "notified_candidate_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "is_assignment" boolean;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "origin" text;--> statement-breakpoint
ALTER TABLE "role_elements" ADD COLUMN "requirement_level" text DEFAULT 'M';--> statement-breakpoint
ALTER TABLE "role_elements" ADD COLUMN "activity_type" text DEFAULT 'both';--> statement-breakpoint
ALTER TABLE "role_elements" ADD COLUMN "validity_years" integer;--> statement-breakpoint
ALTER TABLE "role_elements" ADD COLUMN "safety_critical" boolean;