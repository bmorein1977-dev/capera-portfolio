CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"prefix" varchar NOT NULL,
	"key_hash" varchar NOT NULL,
	"scopes" text[] NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" varchar,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competency_element_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"element_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_summary" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"submitted_by" varchar,
	"submitted_at" timestamp with time zone,
	"decided_by" varchar,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "repository_headings" (
	"key" varchar PRIMARY KEY NOT NULL,
	"section" text NOT NULL,
	"title" text NOT NULL,
	"is_core" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "standardisation_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"held_on" date NOT NULL,
	"title" text NOT NULL,
	"element_id" varchar,
	"facilitator_id" varchar NOT NULL,
	"attendee_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"sample_assessment_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"discussion" text NOT NULL,
	"agreed_approach" text,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "element_version_id" varchar;--> statement-breakpoint
ALTER TABLE "competency_elements" ADD COLUMN IF NOT EXISTS "change_control" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "competency_elements" ADD COLUMN IF NOT EXISTS "current_version_id" varchar;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "series_id" varchar;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "status" varchar DEFAULT 'current' NOT NULL;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "review_due_on" date;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "valid_until" date;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "visible_to_auditors" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "approved_by" varchar;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "withdrawn_by" varchar;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "withdrawn_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "withdrawn_reason" text;--> statement-breakpoint
ALTER TABLE "opito_documents" ADD COLUMN IF NOT EXISTS "content_hash" varchar;--> statement-breakpoint
ALTER TABLE "sampling_plans" ADD COLUMN IF NOT EXISTS "method" varchar DEFAULT 'coverage' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "competency_element_versions_number_idx" ON "competency_element_versions" USING btree ("element_id","version_number");--> statement-breakpoint
-- The audit log is append-only in the database itself, not only in the application. The one permitted change is the removal of a person's
-- name when their details are removed under the retention rule; that code says so for its own transaction only.
CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger AS $audit$
BEGIN
  IF current_setting('capera.retention', true) = 'on' AND TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at OR NEW.action IS DISTINCT FROM OLD.action OR NEW.method IS DISTINCT FROM OLD.method THEN
      RAISE EXCEPTION 'audit entries cannot be altered';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'the audit log is append-only: entries cannot be changed or removed';
END;
$audit$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_append_only_trg ON "audit_events";
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only_trg BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
