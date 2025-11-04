-- 014_dashboard_visibility.sql
-- Purpose: Ensure assessors can see only their candidates and those candidates' assigned elements.

-- 1) Useful view joining users -> candidate_assessors -> candidate_assigned_elements -> elements
CREATE OR REPLACE VIEW assessor_candidate_elements AS
SELECT
  ca.assessor_id,
  cae.candidate_id,
  u.display_name AS candidate_name,
  cae.element_id,
  e.title AS element_title,
  e.priority,
  e.validity_months,
  cae.assigned_at
FROM candidate_assessors ca
JOIN candidate_assigned_elements cae ON cae.candidate_id = ca.candidate_id
JOIN users u ON u.id = cae.candidate_id
JOIN elements e ON e.id = cae.element_id;
