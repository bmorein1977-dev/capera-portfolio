-- 602_dedupe_candidate_assigned.sql
-- Remove duplicate candidate assignments, keeping the newest per (candidate, element, level).

WITH ranked AS (
  SELECT
    id,
    candidate_id,
    element_id,
    COALESCE(proficiency_level, '') AS lvl,
    ROW_NUMBER() OVER (
      PARTITION BY candidate_id, element_id, COALESCE(proficiency_level, '')
      ORDER BY COALESCE(updated_at, created_at, now()) DESC, id DESC
    ) AS rn
  FROM candidate_assigned_elements
)
DELETE FROM candidate_assigned_elements cae
USING ranked r
WHERE cae.id = r.id AND r.rn > 1;
