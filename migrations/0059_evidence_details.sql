ALTER TABLE "assessment_evidence" ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN IF NOT EXISTS "evidence_type" varchar;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN IF NOT EXISTS "description" text;