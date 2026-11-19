CREATE TABLE IF NOT EXISTS "training_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" varchar NOT NULL,
	"area" varchar NOT NULL,
	"action" varchar NOT NULL,
	"allowed" boolean NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "training_permissions_unique_idx" ON "training_permissions" USING btree ("role","area","action");
