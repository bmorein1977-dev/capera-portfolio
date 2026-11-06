CREATE TABLE "certificate_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_mode" varchar DEFAULT 'auto' NOT NULL,
	"issuer_name" text DEFAULT 'Capera Training' NOT NULL,
	"signatory_name" text,
	"signatory_title" text,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "elearning_certificates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_number" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"training_id" varchar NOT NULL,
	"enrollment_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"mode" varchar NOT NULL,
	"learner_name" text NOT NULL,
	"course_name" text NOT NULL,
	"completed_at" timestamp NOT NULL,
	"expiry_date" timestamp,
	"issued_at" timestamp,
	"decided_by" varchar,
	"decision_note" text,
	"evidence" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "trainings" ADD COLUMN "certificate_mode" varchar;--> statement-breakpoint
CREATE UNIQUE INDEX "elearning_certificates_number_idx" ON "elearning_certificates" USING btree ("certificate_number");--> statement-breakpoint
CREATE INDEX "elearning_certificates_user_idx" ON "elearning_certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "elearning_certificates_training_idx" ON "elearning_certificates" USING btree ("training_id","user_id");