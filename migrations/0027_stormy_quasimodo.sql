CREATE TABLE "absences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"absence_type" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"expected_return_date" timestamp,
	"actual_return_date" timestamp,
	"is_frozen" boolean DEFAULT false,
	"notes" text,
	"created_by" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "left_at" timestamp;