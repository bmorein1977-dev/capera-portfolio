-- 703_view_assigned_elements_status.sql
CREATE OR REPLACE VIEW my_assigned_elements_status AS
WITH latest_result AS (
  SELECT a.*
  FROM (
    SELECT a.*,
           ROW_NUMBER() OVER (
             PARTITION BY a.candidate_id, a.element_id, COALESCE(a.level_id::text,'')
             ORDER BY COALESCE(a.assessed_at, a.created_at, now()) DESC
           ) AS rn
    FROM assessments a
    WHERE a.is_assignment IS DISTINCT FROM TRUE
  ) a
  WHERE a.rn = 1
)
SELECT
  assign.candidate_id,
  assign.element_id,
  assign.level_id,
  e.title  AS element_title,
  e.code   AS element_code,
  e.validity_months,
  lr.status      AS last_status,
  lr.assessed_at AS last_assessed_at,
  lr.valid_until AS last_valid_until,
  CASE
    WHEN lr.valid_until IS NULL THEN 'gray'
    WHEN lr.valid_until < now() THEN 'red'
    WHEN lr.valid_until <= now() + interval '90 days' THEN 'amber'
    ELSE 'green'
  END AS color_status
FROM assessments assign
JOIN competency_elements e ON e.id = assign.element_id AND e.is_current = true
LEFT JOIN latest_result lr
  ON lr.candidate_id = assign.candidate_id
 AND lr.element_id   = assign.element_id
 AND COALESCE(lr.level_id::text,'') = COALESCE(assign.level_id::text,'')
WHERE assign.is_assignment IS TRUE;
