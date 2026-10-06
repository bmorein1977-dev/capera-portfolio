ALTER TABLE "appraisals" ADD COLUMN "objectives_due_date" timestamp;--> statement-breakpoint
ALTER TABLE "appraisals" ADD COLUMN "self_review_due_date" timestamp;--> statement-breakpoint
ALTER TABLE "appraisals" ADD COLUMN "manager_review_due_date" timestamp;--> statement-breakpoint
ALTER TABLE "appraisals" ADD COLUMN "shared_at" timestamp;--> statement-breakpoint
ALTER TABLE "appraisals" ADD COLUMN "initiated_by" varchar;
--> statement-breakpoint
UPDATE "appraisals" SET "shared_at" = COALESCE("meeting_date", "updated_at") WHERE "status" = 'signed_off' AND "shared_at" IS NULL;
