-- 601_add_level_and_origin.sql
-- Adds optional 'proficiency_level' and 'origin' to candidate_assigned_elements to track duplicates and source.
-- 'proficiency_level' values: 'basic' | 'intermediate' | 'advanced' (lowercase); NULL means not levelled.
-- 'origin' values: 'role' | 'manual' | 'import'.

ALTER TABLE candidate_assigned_elements
  ADD COLUMN IF NOT EXISTS proficiency_level text,
  ADD COLUMN IF NOT EXISTS origin text;

-- Normalize level text to lowercase and valid set (best-effort).
UPDATE candidate_assigned_elements
SET proficiency_level = LOWER(proficiency_level)
WHERE proficiency_level IS NOT NULL;

-- Optional: constrain values (do not break if other values used)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_cae_level_valid'
  ) THEN
    ALTER TABLE candidate_assigned_elements
    ADD CONSTRAINT ck_cae_level_valid
    CHECK (proficiency_level IS NULL OR proficiency_level IN ('basic','intermediate','advanced'));
  END IF;
END $$;

-- Unique guard to prevent duplicates at (candidate, element, level)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_cae_candidate_element_level'
  ) THEN
    CREATE UNIQUE INDEX uq_cae_candidate_element_level
      ON candidate_assigned_elements (candidate_id, element_id, COALESCE(proficiency_level, ''));
  END IF;
END $$;
