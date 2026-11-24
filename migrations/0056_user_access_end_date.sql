ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_ends_on" timestamp with time zone;
