CREATE TABLE "business_units" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"parent_business_unit_id" varchar,
	"leader_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "business_units_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "job_families" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_families_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"asset_type" text,
	"region" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "job_roles" ADD COLUMN "location_id" varchar;--> statement-breakpoint
ALTER TABLE "job_roles" ADD COLUMN "business_unit_id" varchar;--> statement-breakpoint
ALTER TABLE "job_roles" ADD COLUMN "job_family_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_unit_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "manager_id" varchar;