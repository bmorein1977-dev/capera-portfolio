CREATE TABLE "scorm_package_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" varchar NOT NULL,
	"relative_path" text NOT NULL,
	"object_key" varchar NOT NULL,
	"mime_type" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "training_content" ADD COLUMN "scorm_version" text;--> statement-breakpoint
ALTER TABLE "training_content" ADD COLUMN "scorm_launch_path" text;--> statement-breakpoint
ALTER TABLE "training_content_progress" ADD COLUMN "cmi_data" jsonb;--> statement-breakpoint
ALTER TABLE "training_content_progress" ADD COLUMN "score_raw" text;--> statement-breakpoint
ALTER TABLE "training_content_progress" ADD COLUMN "score_min" text;--> statement-breakpoint
ALTER TABLE "training_content_progress" ADD COLUMN "score_max" text;--> statement-breakpoint
ALTER TABLE "training_content_progress" ADD COLUMN "success_status" text;--> statement-breakpoint
ALTER TABLE "training_content_progress" ADD COLUMN "suspend_data" text;--> statement-breakpoint
ALTER TABLE "training_content_progress" ADD COLUMN "session_time" text;