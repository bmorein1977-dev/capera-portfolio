CREATE TABLE "contract_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contract_companies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "secondary_job_role_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "employment_type" varchar DEFAULT 'employee';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "contract_company_id" varchar;