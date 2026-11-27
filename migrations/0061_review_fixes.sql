ALTER TABLE "assessment_evidence" ADD COLUMN IF NOT EXISTS "ai_model" varchar;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN IF NOT EXISTS "ai_requested_by" varchar;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "resolution_action" varchar;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "resolution_note" text;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN IF NOT EXISTS "resolved_by" varchar;--> statement-breakpoint
-- Records that a disagreement had wrongly marked as verified now need action.
UPDATE "assessments" a SET "verification_status" = 'action_required' FROM "verifications" v
 WHERE a."verification_id" = v."id" AND v."outcome" <> 'agreed' AND a."verification_status" = 'verified';
