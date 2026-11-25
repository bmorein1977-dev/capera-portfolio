CREATE TABLE IF NOT EXISTS "contractor_visit_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"title" text NOT NULL,
	"expiry_date" date,
	"file_name" text NOT NULL,
	"mime_type" varchar NOT NULL,
	"size_bytes" integer NOT NULL,
	"object_key" text NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contractor_visits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar NOT NULL,
	"contract_company_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"visitor_first_name" text NOT NULL,
	"visitor_last_name" text NOT NULL,
	"arrival_date" date,
	"days" integer,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"private_details" jsonb,
	"private_removed_at" timestamp,
	"keep_private" boolean DEFAULT false NOT NULL,
	"keep_private_reason" text,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot" jsonb,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"late" boolean DEFAULT false NOT NULL,
	"late_reason" text,
	"submitted_at" timestamp,
	"submitted_by" varchar,
	"reviewed_at" timestamp,
	"reviewed_by" varchar,
	"review_note" text,
	"email_status" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_visits_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visitor_settings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
