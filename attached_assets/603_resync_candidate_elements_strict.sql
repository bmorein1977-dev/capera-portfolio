-- 603_resync_candidate_elements_strict.sql
-- Resync function that (optionally) removes role-derived assignments and re-creates from the job-role mapping.
-- Preserves manually added items (origin='manual' or origin IS NULL).

CREATE OR REPLACE FUNCTION sync_candidate_elements_from_roles_strict(p_candidate uuid, p_strict boolean DEFAULT true)
RETURNS void AS $$
DECLARE
  map_table regclass;
  sql text;
BEGIN
  -- Find job-role mapping table having (job_role_id, element_id[, proficiency_level])
  SELECT c.oid::regclass
  INTO map_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = n.nspname AND table_name = c.relname AND column_name = 'job_role_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = n.nspname AND table_name = c.relname AND column_name = 'element_id')
  ORDER BY c.relname
  LIMIT 1;

  IF map_table IS NULL THEN
    RAISE NOTICE 'No job role -> element mapping table found (needs job_role_id & element_id).';
    RETURN;
  END IF;

  IF p_strict THEN
    -- Remove any existing role-derived rows for this candidate so we can rebuild cleanly
    DELETE FROM candidate_assigned_elements
    WHERE candidate_id = p_candidate AND COALESCE(origin,'role') = 'role';
  END IF;

  -- Re-insert from current roles → mapping → elements (current only)
  -- If the mapping has a proficiency_level column, we include it.
  sql := format($SQL$
    WITH has_level AS (
      SELECT COUNT(*) > 0 AS yes
      FROM information_schema.columns
      WHERE table_name = %L AND column_name = 'proficiency_level'
    )
    INSERT INTO candidate_assigned_elements (candidate_id, element_id, proficiency_level, origin, created_at)
    SELECT
      ujr.user_id AS candidate_id,
      m.element_id,
      CASE WHEN (SELECT yes FROM has_level) THEN LOWER(m.proficiency_level) ELSE NULL END AS proficiency_level,
      'role' AS origin,
      now()
    FROM user_job_roles ujr
    JOIN %s m ON m.job_role_id = ujr.job_role_id
    JOIN competency_elements e ON e.id = m.element_id AND e.is_current = true
    WHERE ujr.user_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM candidate_assigned_elements existing
        WHERE existing.candidate_id = ujr.user_id
          AND existing.element_id = m.element_id
          AND COALESCE(existing.proficiency_level,'') = COALESCE(CASE WHEN (SELECT yes FROM has_level) THEN LOWER(m.proficiency_level) ELSE NULL END, '')
      );
  $SQL$, map_table::text, map_table::text);

  EXECUTE sql USING p_candidate;
END;
$$ LANGUAGE plpgsql;

-- Optional triggers to keep things in sync
DROP TRIGGER IF EXISTS trg_sync_on_user_job_roles ON user_job_roles;
CREATE TRIGGER trg_sync_on_user_job_roles
AFTER INSERT ON user_job_roles
FOR EACH ROW EXECUTE FUNCTION sync_candidate_elements_from_roles_strict(NEW.user_id, true);
