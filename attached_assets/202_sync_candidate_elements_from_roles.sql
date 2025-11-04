-- 202_sync_candidate_elements_from_roles.sql
-- Creates a generic function that syncs a candidate's assigned elements from their job roles.
-- It dynamically discovers the job-role<->element mapping table by looking for columns (job_role_id, element_id).

CREATE OR REPLACE FUNCTION sync_candidate_elements_from_roles(p_candidate uuid)
RETURNS void AS $$
DECLARE
  map_table regclass;
  col_check int;
  sql text;
BEGIN
  -- Find a mapping table that has job_role_id and element_id columns
  SELECT c.oid::regclass
  INTO map_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = n.nspname AND table_name = c.relname AND column_name = 'job_role_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = n.nspname AND table_name = c.relname AND column_name = 'element_id'
    )
  LIMIT 1;

  IF map_table IS NULL THEN
    RAISE NOTICE 'Could not find job role->element mapping table (needs job_role_id + element_id columns).';
    RETURN;
  END IF;

  -- Insert missing candidate_assigned_elements from the role mapping, only for current elements.
  sql := format($$
    INSERT INTO candidate_assigned_elements (candidate_id, element_id, assigned_at)
    SELECT caj.candidate_id, m.element_id, now()
    FROM (
      SELECT p_candidate AS candidate_id
    ) caj
    JOIN user_job_roles ujr ON ujr.user_id = caj.candidate_id
    JOIN %s m ON m.job_role_id = ujr.job_role_id
    JOIN competency_elements e ON e.id = m.element_id AND e.is_current = true
    WHERE NOT EXISTS (
      SELECT 1 FROM candidate_assigned_elements ce
      WHERE ce.candidate_id = caj.candidate_id AND ce.element_id = m.element_id
    );
  $$, map_table::text);

  EXECUTE sql;
END;
$$ LANGUAGE plpgsql;

-- Optional: trigger to auto-sync when a job role is assigned to a user
DROP TRIGGER IF EXISTS trg_sync_candidate_elements_on_job_role ON user_job_roles;
CREATE TRIGGER trg_sync_candidate_elements_on_job_role
AFTER INSERT ON user_job_roles
FOR EACH ROW EXECUTE FUNCTION sync_candidate_elements_from_roles(NEW.user_id);

-- One-off sync for all candidates
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id AS candidate_id FROM user_job_roles LOOP
    PERFORM sync_candidate_elements_from_roles(r.candidate_id);
  END LOOP;
END $$;
