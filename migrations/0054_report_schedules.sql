CREATE TABLE IF NOT EXISTS "report_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"page_path" text NOT NULL,
	"urls" jsonb NOT NULL,
	"frequency" varchar DEFAULT 'weekly' NOT NULL,
	"weekday" integer DEFAULT 1,
	"day_of_month" integer DEFAULT 1,
	"hour" integer DEFAULT 7,
	"timezone" varchar DEFAULT 'Europe/London' NOT NULL,
	"format" varchar DEFAULT 'both' NOT NULL,
	"use_ai" boolean DEFAULT false,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_status" varchar,
	"last_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_schedules_user_idx" ON "report_schedules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_schedules_next_idx" ON "report_schedules" USING btree ("enabled","next_run_at");
