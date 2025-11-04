-- 301_candidate_elements_with_status.sql
-- Purpose: One-stop view for "My Assessments" showing every assigned element for a candidate,
-- along with the most recent assessment outcome, validity, and a color status.
--
-- Tables used (adapt names if needed):
--   candidate_assigned_elements (candidate_id, element_id, assigned_at)
--   competency_elements (id, title, code, priority, validity_months, is_current)
--   assessments (candidate_id, element_id, status, assessed_at, valid_until)
--
-- Color logic:
--   red    = valid_until < now()
--   amber  = valid_until <= now() + 90 days
--   green  = otherwise
--   gray   = never assessed (no row) -> treat as 'not_started' with null valid_until

CREATE OR REPLACE VIEW candidate_elements_with_status AS
WITH latest_assessment AS (
  SELECT a.*
  FROM (
    SELECT
      a.*,
      ROW_NUMBER() OVER (
        PARTITION BY a.candidate_id, a.element_id
        ORDER BY COALESCE(a.assessed_at, a.created_at, now()) DESC
      ) AS rn
    FROM assessments a
  ) a
  WHERE a.rn = 1
)
SELECT
  cae.candidate_id,
  cae.element_id,
  e.title              AS element_title,
  e.code               AS element_code,
  e.priority           AS element_priority,
  e.validity_months,
  e.is_current,
  cae.assigned_at,
  la.status            AS last_status,             -- 'competent' | 'not_yet_competent' | 'competent_with_minor_needs' | null
  la.assessed_at       AS last_assessed_at,
  la.valid_until       AS last_valid_until,
  CASE
    WHEN la.valid_until IS NULL THEN 'gray'
    WHEN la.valid_until < now() THEN 'red'
    WHEN la.valid_until <= now() + interval '90 days' THEN 'amber'
    ELSE 'green'
  END AS color_status
FROM candidate_assigned_elements cae
JOIN competency_elements e ON e.id = cae.element_id
LEFT JOIN latest_assessment la
  ON la.candidate_id = cae.candidate_id
 AND la.element_id   = cae.element_id
WHERE e.is_current = true;
