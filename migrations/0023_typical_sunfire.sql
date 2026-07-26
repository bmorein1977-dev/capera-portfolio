ALTER TABLE "teams" DROP CONSTRAINT "teams_name_unique";--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "location_id" varchar;