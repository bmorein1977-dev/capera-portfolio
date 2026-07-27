CREATE TABLE "assessment_expiry_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"candidate_id" varchar NOT NULL,
	"element_id" varchar NOT NULL,
	"previous_outcome" varchar NOT NULL,
	"previous_sign_off_at" timestamp NOT NULL,
	"previous_expiry_date" timestamp NOT NULL,
	"renewal_closed_at" timestamp DEFAULT now() NOT NULL,
	"new_outcome" varchar NOT NULL,
	"was_breach" boolean NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "succession_candidates" ADD COLUMN "development_plan_description" text;--> statement-breakpoint
ALTER TABLE "succession_candidates" ADD COLUMN "development_plan_due_date" timestamp;