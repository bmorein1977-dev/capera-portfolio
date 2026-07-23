CREATE TABLE "training_content" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content_type" text DEFAULT 'document' NOT NULL,
	"object_key" varchar,
	"file_name" text,
	"mime_type" text,
	"external_url" text,
	"duration_seconds" integer,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_content_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"content_id" varchar NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"progress_percentage" integer DEFAULT 0,
	"time_spent_seconds" integer DEFAULT 0,
	"last_position_seconds" integer,
	"completed_at" timestamp,
	"last_accessed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
