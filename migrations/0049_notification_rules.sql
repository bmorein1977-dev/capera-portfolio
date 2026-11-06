CREATE TABLE "notification_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_key" varchar NOT NULL,
	"recipient_id" varchar,
	"recipient_email" varchar NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"path" text,
	"created_at" timestamp DEFAULT now(),
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_key" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"send_to_default" boolean DEFAULT true NOT NULL,
	"also_roles" text[],
	"also_user_ids" text[],
	"include_manager" boolean DEFAULT false NOT NULL,
	"frequency" varchar DEFAULT 'immediate' NOT NULL,
	"reminder_days" integer[],
	"subject_template" text,
	"body_template" text,
	"last_digest_at" timestamp,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "type_key" varchar;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "resend_of" varchar;--> statement-breakpoint
CREATE INDEX "notification_queue_pending_idx" ON "notification_queue" USING btree ("type_key","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_rules_type_idx" ON "notification_rules" USING btree ("type_key");--> statement-breakpoint
CREATE INDEX "notification_logs_created_idx" ON "notification_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_logs_type_idx" ON "notification_logs" USING btree ("type_key");