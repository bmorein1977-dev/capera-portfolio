ALTER TABLE "verifications" ADD COLUMN "verification_type" varchar;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "assessment_location" text;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "sampling_rate_at_verification" integer;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "technical_expert_name" text;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "checklist_answers" jsonb;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "development_needs_required" boolean;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "development_needs_plan" text;