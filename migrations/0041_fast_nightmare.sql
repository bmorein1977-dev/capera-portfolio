ALTER TABLE "users" ADD COLUMN "years_of_experience" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cv_object_key" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cv_file_name" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cv_content_type" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cv_uploaded_at" timestamp;