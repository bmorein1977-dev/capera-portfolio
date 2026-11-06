CREATE TABLE "retention_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auto_remove_enabled" boolean DEFAULT false NOT NULL,
	"retention_months" integer DEFAULT 24 NOT NULL,
	"warn_days" integer DEFAULT 30 NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "anonymised_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "retention_hold" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "retention_hold_reason" text;