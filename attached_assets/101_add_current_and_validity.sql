-- 101_add_current_and_validity.sql
-- Safe alterations for your existing schema.
-- Assumes your tables are named: competency_elements, competence_criteria, candidate_allocations, assessments (already exists).

-- 1) Flag which elements are current (controls visibility) and add validity months to drive expiry.
ALTER TABLE competency_elements
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS validity_months int;

-- (Optional) quick helper index
CREATE INDEX IF NOT EXISTS ix_competency_elements_is_current ON competency_elements(is_current);
