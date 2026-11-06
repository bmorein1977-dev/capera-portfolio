CREATE TABLE "announcement_reads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"read_at" timestamp DEFAULT now(),
	"acknowledged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"importance" varchar DEFAULT 'normal' NOT NULL,
	"requires_acknowledgement" boolean DEFAULT false NOT NULL,
	"audience_all" boolean DEFAULT false NOT NULL,
	"business_unit_ids" text[],
	"job_role_ids" text[],
	"location_ids" text[],
	"status" varchar DEFAULT 'draft' NOT NULL,
	"send_email" boolean DEFAULT false NOT NULL,
	"publish_at" timestamp,
	"expires_at" timestamp,
	"published_at" timestamp,
	"emailed_at" timestamp,
	"withdrawn_at" timestamp,
	"edited_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "announcement_reads_unique_idx" ON "announcement_reads" USING btree ("announcement_id","user_id");--> statement-breakpoint
CREATE INDEX "announcement_reads_user_idx" ON "announcement_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "announcements_status_idx" ON "announcements" USING btree ("status","publish_at");