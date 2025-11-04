-- 704_dedupe_assignment_rows_once.sql
WITH ranked AS (
  SELECT
    id, candidate_id, element_id, COALESCE(level_id::text,'') AS lvl,
    ROW_NUMBER() OVER (
      PARTITION BY candidate_id, element_id, COALESCE(level_id::text,'')
      ORDER BY COALESCE(updated_at, created_at, now()) DESC, id DESC
    ) AS rn
  FROM assessments
  WHERE is_assignment IS TRUE
)
DELETE FROM assessments a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;
