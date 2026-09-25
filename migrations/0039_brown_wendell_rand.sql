CREATE TABLE "competency_element_review_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"element_id" varchar NOT NULL,
	"reviewed_by" varchar NOT NULL,
	"reviewed_at" timestamp DEFAULT now(),
	"comment" text,
	"previous_due_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "competency_elements" ADD COLUMN "review_cycle_months" integer;--> statement-breakpoint
ALTER TABLE "competency_elements" ADD COLUMN "standard_owner_id" varchar;--> statement-breakpoint
ALTER TABLE "competency_elements" ADD COLUMN "standard_approver_id" varchar;--> statement-breakpoint
ALTER TABLE "competency_elements" ADD COLUMN "standard_reviewer_id" varchar;--> statement-breakpoint
ALTER TABLE "competency_elements" ADD COLUMN "last_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "competency_elements" ADD COLUMN "last_reviewed_by" varchar;