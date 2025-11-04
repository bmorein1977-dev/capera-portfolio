-- 102_enable_multi_assessors.sql
-- Allow multiple assessors to be assigned per candidate using your existing candidate_allocations table.
-- This assumes candidate_allocations has candidate_id and assessor_id columns.

-- 1) Ensure required columns exist (noop if already there)
ALTER TABLE candidate_allocations
  ADD COLUMN IF NOT EXISTS candidate_id uuid,
  ADD COLUMN IF NOT EXISTS assessor_id uuid;

-- 2) Ensure the pair is unique to prevent duplicates, while allowing multiple assessors per candidate.
DO $$
BEGIN
  -- Drop any old single-assessor unique constraint if it exists (best effort by name)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'candidate_allocations_candidate_id_key'
  ) THEN
    ALTER TABLE candidate_allocations DROP CONSTRAINT candidate_allocations_candidate_id_key;
  END IF;

  -- Create a composite uniqueness constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_candidate_allocations_candidate_assessor'
  ) THEN
    ALTER TABLE candidate_allocations
      ADD CONSTRAINT uq_candidate_allocations_candidate_assessor UNIQUE (candidate_id, assessor_id);
  END IF;
END $$;
