-- 103_assessments_extend.sql
-- Extend your existing assessments table to support status, methods, valid_until, notes.

-- Add columns safely
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS methods text[],
  ADD COLUMN IF NOT EXISTS assessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS element_id uuid,
  ADD COLUMN IF NOT EXISTS candidate_id uuid,
  ADD COLUMN IF NOT EXISTS assessor_id uuid;

-- Constrain status values (best-effort check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_assessments_status_valid_values'
  ) THEN
    ALTER TABLE assessments
      ADD CONSTRAINT ck_assessments_status_valid_values
      CHECK (status IN ('competent','not_yet_competent','competent_with_minor_needs'));
  END IF;
END $$;

-- Auto-calc valid_until from competency_elements.validity_months when present
CREATE OR REPLACE FUNCTION set_valid_until_from_competency_element()
RETURNS trigger AS $$
DECLARE v_months int;
BEGIN
  IF NEW.element_id IS NOT NULL THEN
    SELECT validity_months INTO v_months FROM competency_elements WHERE id = NEW.element_id;
    IF v_months IS NOT NULL THEN
      NEW.valid_until := coalesce(NEW.assessed_at, now()) + (v_months || ' months')::interval;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_valid_until_on_assessments ON assessments;
CREATE TRIGGER trg_set_valid_until_on_assessments
BEFORE INSERT ON assessments
FOR EACH ROW EXECUTE FUNCTION set_valid_until_from_competency_element();
