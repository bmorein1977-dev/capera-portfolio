ALTER TABLE "assessment_evidence" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "rejected_by" varchar;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN "rejection_reason" text;