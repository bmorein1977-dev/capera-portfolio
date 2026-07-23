CREATE TABLE "initiative_role_requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initiative_id" varchar NOT NULL,
	"job_role_id" varchar NOT NULL,
	"headcount_needed" integer DEFAULT 1 NOT NULL,
	"required_by_date" timestamp,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "succession_candidates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"succession_plan_id" varchar NOT NULL,
	"candidate_user_id" varchar NOT NULL,
	"readiness" text DEFAULT 'developing',
	"rank" integer DEFAULT 1,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "succession_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_role_id" varchar NOT NULL,
	"incumbent_user_id" varchar,
	"risk_level" text DEFAULT 'medium',
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workforce_initiatives" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"location_id" varchar,
	"business_unit_id" varchar,
	"target_date" timestamp,
	"status" text DEFAULT 'planned',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "job_roles" ADD COLUMN "succession_critical" boolean DEFAULT false;