-- 201_live_elements_whitelist.sql
-- How to use:
-- 1) Fill the whitelist below with the *codes* (or IDs) of the 7 live elements from Competency Manager.
-- 2) Run this script. It will:
--    - Flip competency_elements.is_current for the whitelist = true, all others = false
--    - Purge non-current elements from candidate/job-role assignments (best-effort dynamic SQL)

-- ***** EDIT THIS SECTION ***** --
-- Option A: If you know the *codes* for the 7 elements, put them here:
WITH whitelist(code) AS (
  VALUES
    ('TEC14_OP1'),   -- example, replace with your real codes
    ('SIMOPS'),
    ('SIS_HONEYWELL_C300'),
    ('CODE4'),
    ('CODE5'),
    ('CODE6'),
    ('CODE7')
)
UPDATE competency_elements e
SET is_current = (e.code IN (SELECT code FROM whitelist));

-- If you don't have 'code', comment the above and use IDs instead:
-- WITH whitelist(id) AS (VALUES ('uuid-1'::uuid), ('uuid-2'::uuid) ...)
-- UPDATE competency_elements e SET is_current = (e.id IN (SELECT id FROM whitelist));

-- Purge assignments to non-current elements from known tables
DO $$
DECLARE
  t text;
  candidates text[] := ARRAY[
    'candidate_assigned_elements',
    'candidate_elements',
    'candidate_element_assignments',
    'job_role_elements',
    'role_elements',
    'jobrole_elements',
    'job_role_element_links'
  ];
BEGIN
  FOREACH t IN ARRAY candidates LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format($sql$
        DELETE FROM %I link
        USING competency_elements e
        WHERE link.element_id = e.id AND e.is_current = false
      $sql$, t);
    END IF;
  END LOOP;
END $$;
