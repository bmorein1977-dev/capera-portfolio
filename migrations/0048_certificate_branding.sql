ALTER TABLE "certificate_settings" ADD COLUMN "title" text DEFAULT 'Certificate of Completion' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate_settings" ADD COLUMN "accent_colour" varchar DEFAULT '#1d4ed8' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate_settings" ADD COLUMN "logo_data" text;