-- 012_assessments_and_status.sql
-- Purpose: support assessments with knowledge/performance criteria, outcomes, methods, validity and evidence

-- Assumptions: existing tables 'elements', 'criteria' (with type 'knowledge'|'performance'), 'users', 'candidate_assigned_elements'.

-- 1) Assessment session header (per candidate per element)
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessor_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  element_id uuid NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('competent','not_yet_competent','competent_with_minor_needs')),
  methods text[] NOT NULL, -- e.g. ARRAY['Observation','Questioning']
  assessed_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Assessment per-criterion outcomes
CREATE TABLE IF NOT EXISTS assessment_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  result text NOT NULL CHECK (result IN ('meets','does_not_meet','not_applicable')),
  guidance_snapshot text, -- store assessor guidance at time of assessment
  evidence_note text
);

-- 3) Evidence uploads (file metadata only; actual file stored in S3/Supabase Storage)
CREATE TABLE IF NOT EXISTS assessment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  file_key text NOT NULL, -- path/key in storage bucket
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Validity default coming from element table: add validity_months to elements if missing
ALTER TABLE elements ADD COLUMN IF NOT EXISTS validity_months int;

-- 5) Trigger to auto-set valid_until when inserting an assessment
CREATE OR REPLACE FUNCTION set_valid_until_from_element()
RETURNS trigger AS $$
DECLARE v_months int;
BEGIN
  SELECT validity_months INTO v_months FROM elements WHERE id = NEW.element_id;
  IF v_months IS NOT NULL THEN
    NEW.valid_until := (NEW.assessed_at + (v_months || ' months')::interval);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_valid_until ON assessments;
CREATE TRIGGER trg_set_valid_until BEFORE INSERT ON assessments
FOR EACH ROW EXECUTE FUNCTION set_valid_until_from_element();
