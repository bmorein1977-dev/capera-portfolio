-- 701_assessments_add_assignment_layer.sql
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS is_assignment boolean,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE assessments SET created_at = COALESCE(created_at, now()) WHERE created_at IS NULL;
UPDATE assessments SET updated_at = COALESCE(updated_at, now()) WHERE updated_at IS NULL;

UPDATE assessments
SET is_assignment = COALESCE(is_assignment, (status IS NULL AND valid_until IS NULL));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_assignment_unique_triplet') THEN
    CREATE UNIQUE INDEX uq_assignment_unique_triplet
      ON assessments (candidate_id, element_id, COALESCE(level_id::text, ''))
      WHERE is_assignment IS TRUE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assessments_status_values2') THEN
    ALTER TABLE assessments
      ADD CONSTRAINT ck_assessments_status_values2
      CHECK (status IS NULL OR status IN ('competent','not_yet_competent','competent_with_minor_needs'));
  END IF;
END $$;
