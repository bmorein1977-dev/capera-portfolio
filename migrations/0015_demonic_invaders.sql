CREATE TABLE "training_completion_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"training_id" varchar NOT NULL,
	"enrollment_id" varchar,
	"method" text NOT NULL,
	"completed_at" timestamp NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
