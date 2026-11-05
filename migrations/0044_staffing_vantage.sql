CREATE TABLE "staffing_requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text DEFAULT 'location' NOT NULL,
	"scope_id" varchar NOT NULL,
	"job_role_id" varchar NOT NULL,
	"minimum_count" integer NOT NULL,
	"count_by" text DEFAULT 'either' NOT NULL,
	"only_competent" boolean DEFAULT true,
	"exclude_absent" boolean DEFAULT true,
	"duty_to_operate" boolean DEFAULT true,
	"legal_reference" text,
	"notes" text,
	"notify_user_ids" text[],
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staffing_shortfall_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" varchar NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"required_count" integer NOT NULL,
	"actual_count" integer NOT NULL,
	"detected_at" timestamp DEFAULT now(),
	"last_checked_at" timestamp DEFAULT now(),
	"decision" text,
	"decision_comment" text,
	"risk_assessment_ref" text,
	"decided_by" varchar,
	"decided_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "is_offshore" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "vantage_number" varchar;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_vantage_number_unique" ON "users" ("vantage_number") WHERE "vantage_number" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staffing_requirements_scope_idx" ON "staffing_requirements" ("scope_type", "scope_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staffing_reviews_requirement_idx" ON "staffing_shortfall_reviews" ("requirement_id", "status");
--> statement-breakpoint
UPDATE "locations" SET "is_offshore" = true WHERE "is_offshore" IS NOT TRUE AND "asset_type" ILIKE '%offshore%';
