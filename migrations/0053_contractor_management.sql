CREATE TABLE IF NOT EXISTS "contractor_declarations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"contract_company_id" varchar NOT NULL,
	"kind" varchar NOT NULL,
	"training_id" varchar,
	"training_enrollment_id" varchar,
	"element_id" varchar,
	"assessment_id" varchar,
	"achieved_at" timestamp NOT NULL,
	"expiry_date" timestamp,
	"certificate_ref" text,
	"note" text,
	"declared_by" varchar NOT NULL,
	"declared_at" timestamp DEFAULT now(),
	"status" varchar DEFAULT 'active' NOT NULL,
	"revoked_by" varchar,
	"revoked_at" timestamp,
	"revoked_reason" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approval_status" varchar DEFAULT 'approved';