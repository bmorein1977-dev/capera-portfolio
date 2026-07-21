CREATE TABLE "training_requirement_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "role_trainings" ADD COLUMN "group_id" varchar;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD COLUMN "achievement_date" timestamp;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD COLUMN "expiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "training_enrollments" ADD COLUMN "certificate_file_name" text;