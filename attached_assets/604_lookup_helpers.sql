-- 604_lookup_helpers.sql
-- Handy diagnostics to run when things look wrong.

-- Find candidate/user ID by email or name
-- SELECT id, email, display_name FROM users WHERE email ILIKE '%test.inst%';

-- List job roles for a user
-- SELECT * FROM user_job_roles WHERE user_id = '<candidate-uuid>';

-- Elements mapped to those job roles (showing level if present)
-- Replace job_role_element_map with your actual mapping table name if different:
-- SELECT m.*, e.title, e.code FROM job_role_element_map m
-- JOIN competency_elements e ON e.id = m.element_id
-- WHERE m.job_role_id IN (SELECT job_role_id FROM user_job_roles WHERE user_id = '<candidate-uuid>');

-- Candidate-assigned elements (after sync)
-- SELECT cae.*, e.title, e.code FROM candidate_assigned_elements cae
-- JOIN competency_elements e ON e.id = cae.element_id
-- WHERE candidate_id = '<candidate-uuid>'
-- ORDER BY e.title, COALESCE(proficiency_level,'');
