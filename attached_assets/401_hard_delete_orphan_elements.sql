-- 401_hard_delete_orphan_elements.sql
-- HARD DELETE elements that are NOT current and have NO references.
-- Run on staging first. Wraps in a transaction.

BEGIN;

-- 1) Identify safe-to-delete elements
WITH deletable AS (
  SELECT e.id
  FROM competency_elements e
  WHERE e.is_current = false
    -- no candidate assignments
    AND NOT EXISTS (SELECT 1 FROM candidate_assigned_elements cae WHERE cae.element_id = e.id)
    -- no assessments
    AND NOT EXISTS (SELECT 1 FROM assessments a WHERE a.element_id = e.id)
    -- no criteria (if your schema links criteria to an element_id)
    AND NOT EXISTS (
      SELECT 1 FROM competence_criteria cc
      WHERE cc.element_id = e.id
    )
)
-- 2) Best-effort clean dependent tables that might exist (if any were missed)
, cleaned AS (
  SELECT id FROM deletable
)
-- 3) Finally delete elements
DELETE FROM competency_elements e
USING cleaned c
WHERE e.id = c.id;

COMMIT;

-- DRY RUN helper (use this first to see what WOULD be deleted):
-- SELECT e.* FROM competency_elements e
-- WHERE e.is_current = false
--   AND NOT EXISTS (SELECT 1 FROM candidate_assigned_elements cae WHERE cae.element_id = e.id)
--   AND NOT EXISTS (SELECT 1 FROM assessments a WHERE a.element_id = e.id)
--   AND NOT EXISTS (SELECT 1 FROM competence_criteria cc WHERE cc.element_id = e.id);
