CREATE TABLE "user_language_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"primary_language" varchar DEFAULT 'en' NOT NULL,
	"fallback_language" varchar DEFAULT 'en' NOT NULL,
	"auto_translate" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_language_preferences_user_id_unique" UNIQUE("user_id")
);
