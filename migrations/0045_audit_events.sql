CREATE TABLE "audit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"actor_id" varchar,
	"actor_name" text,
	"actor_role" text,
	"acting_as_id" varchar,
	"acting_as_name" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"entity_label" text,
	"summary" text NOT NULL,
	"changes" jsonb,
	"method" varchar NOT NULL,
	"path" text NOT NULL,
	"status_code" integer,
	"ip_address" varchar
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_events_occurred_idx" ON "audit_events" ("occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_entity_idx" ON "audit_events" ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_actor_idx" ON "audit_events" ("actor_id");
