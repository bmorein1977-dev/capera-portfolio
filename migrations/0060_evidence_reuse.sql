ALTER TABLE "assessment_evidence" ADD COLUMN IF NOT EXISTS "linked_from_id" varchar;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN IF NOT EXISTS "linked_by" varchar;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN IF NOT EXISTS "linked_at" timestamp;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD COLUMN IF NOT EXISTS "content_hash" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_evidence_hash_idx" ON "assessment_evidence" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_evidence_link_once_idx" ON "assessment_evidence" USING btree ("assessment_id","linked_from_id") WHERE is_active and linked_from_id is not null;--> statement-breakpoint
-- A file in evidence belongs to one candidate. The application checks this; the database enforces it too, so no route, script or fault can break it.
-- (drizzle-kit does not know about functions and triggers: keep this part by hand.)
CREATE OR REPLACE FUNCTION assessment_evidence_one_candidate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id varchar;
BEGIN
  IF NOT coalesce(NEW.is_active, true) THEN RETURN NEW; END IF;
  SELECT candidate_id INTO owner_id FROM assessments WHERE id = NEW.assessment_id;
  IF NEW.linked_from_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM assessment_evidence s JOIN assessments a ON a.id = s.assessment_id WHERE s.id = NEW.linked_from_id AND a.candidate_id = owner_id
  ) THEN
    RAISE EXCEPTION 'evidence can only be attached to assessments of the same candidate' USING ERRCODE = 'check_violation';
  END IF;
  IF coalesce(NEW.file_url, '') <> '' OR NEW.content_hash IS NOT NULL THEN
    -- one at a time for the same file, so two uploads at once cannot both pass
    PERFORM pg_advisory_xact_lock(hashtext('evidence:' || coalesce(NEW.content_hash, NEW.file_url)));
    IF EXISTS (
      SELECT 1 FROM assessment_evidence o JOIN assessments a ON a.id = o.assessment_id
      WHERE o.id <> NEW.id AND coalesce(o.is_active, true) AND a.candidate_id IS DISTINCT FROM owner_id
        AND ((coalesce(NEW.file_url, '') <> '' AND o.file_url = NEW.file_url) OR (NEW.content_hash IS NOT NULL AND o.content_hash = NEW.content_hash))
    ) THEN
      RAISE EXCEPTION 'this file belongs to another candidate' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS assessment_evidence_one_candidate_trg ON assessment_evidence;--> statement-breakpoint
CREATE TRIGGER assessment_evidence_one_candidate_trg BEFORE INSERT OR UPDATE OF assessment_id, file_url, linked_from_id, content_hash, is_active
  ON assessment_evidence FOR EACH ROW EXECUTE FUNCTION assessment_evidence_one_candidate();
