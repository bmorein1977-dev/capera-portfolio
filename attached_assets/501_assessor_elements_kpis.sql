-- 501_assessor_elements_kpis.sql
-- Purpose: KPIs for assessor dashboards: expired, expiring soon (<= 90 days), ok, and not_started.
-- Uses candidate_allocations (assessor->candidate), candidate_assigned_elements, competency_elements, assessments.
-- Relies on 'candidate_elements_with_status' view created earlier; if not present, we rebuild logic inline.

-- Helper: latest assessment per candidate/element
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
),
assessor_elements AS (
  SELECT
    ca.assessor_id,
    cae.candidate_id,
    cae.element_id,
    e.is_current,
    e.title        AS element_title,
    e.code         AS element_code,
    e.validity_months,
    la.valid_until,
    la.status AS last_status
  FROM candidate_allocations ca
  JOIN candidate_assigned_elements cae ON cae.candidate_id = ca.candidate_id
  JOIN competency_elements e ON e.id = cae.element_id
  LEFT JOIN latest_assessment la
    ON la.candidate_id = cae.candidate_id
   AND la.element_id   = cae.element_id
  WHERE e.is_current = true
)
-- Main KPI table per assessor
SELECT
  ae.assessor_id,
  COUNT(*) FILTER (WHERE ae.valid_until IS NULL)                           AS not_started,
  COUNT(*) FILTER (WHERE ae.valid_until IS NOT NULL AND ae.valid_until < now()) AS expired,
  COUNT(*) FILTER (WHERE ae.valid_until IS NOT NULL AND ae.valid_until >= now() AND ae.valid_until <= now() + interval '90 days') AS expiring_90,
  COUNT(*) FILTER (WHERE ae.valid_until IS NOT NULL AND ae.valid_until > now() + interval '90 days') AS ok
FROM assessor_elements ae
GROUP BY ae.assessor_id;
