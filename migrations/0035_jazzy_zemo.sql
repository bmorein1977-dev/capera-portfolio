CREATE TABLE "training_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"training_id" varchar NOT NULL,
	"request_type" varchar NOT NULL,
	"requirement_level" text,
	"comment" text NOT NULL,
	"preferred_venue" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"approver_manager_id" varchar,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_comment" text,
	"resulting_booking_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "course_bookings" ADD COLUMN "cost" numeric(10, 2);