CREATE TABLE "kpi_targets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"label" text NOT NULL,
	"target_percentage" integer NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kpi_targets_key_unique" UNIQUE("key")
);
