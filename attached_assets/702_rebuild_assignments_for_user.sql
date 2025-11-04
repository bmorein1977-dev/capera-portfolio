-- 702_rebuild_assignments_for_user.sql
CREATE OR REPLACE FUNCTION rebuild_assignments_for_user(p_user uuid, p_strict boolean DEFAULT true)
RETURNS void AS $$
DECLARE
  map_table regclass;
  has_level boolean := false;
  v_job_role uuid;
  sql text;
BEGIN
  SELECT job_role_id INTO v_job_role FROM users WHERE id = p_user;
  IF v_job_role IS NULL THEN RETURN; END IF;

  SELECT c.oid::regclass
  INTO map_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = n.nspname AND table_name = c.relname AND column_name = 'job_role_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = n.nspname AND table_name = c.relname AND column_name = 'element_id')
  ORDER BY c.relname
  LIMIT 1;

  IF map_table IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = map_table::text AND column_name = 'level_id'
  ) INTO has_level;

  IF p_strict THEN
    DELETE FROM assessments WHERE candidate_id = p_user AND is_assignment IS TRUE AND COALESCE(origin,'role') = 'role';
  END IF;

  IF has_level THEN
    sql := format($SQL$
      INSERT INTO assessments (candidate_id, element_id, level_id, is_assignment, origin, created_at, updated_at)
      SELECT $1::uuid, m.element_id, m.level_id, TRUE, 'role', now(), now()
      FROM %s m
      JOIN competency_elements e ON e.id = m.element_id AND e.is_current = true
      WHERE m.job_role_id = $2
        AND NOT EXISTS (
          SELECT 1 FROM assessments a
          WHERE a.candidate_id = $1 AND a.is_assignment IS TRUE
            AND a.element_id = m.element_id
            AND COALESCE(a.level_id, '00000000-0000-0000-0000-000000000000') = COALESCE(m.level_id, '00000000-0000-0000-0000-000000000000')
        );
    $SQL$, map_table::text);
    EXECUTE sql USING p_user, v_job_role;
  ELSE
    sql := format($SQL$
      INSERT INTO assessments (candidate_id, element_id, is_assignment, origin, created_at, updated_at)
      SELECT $1::uuid, m.element_id, TRUE, 'role', now(), now()
      FROM %s m
      JOIN competency_elements e ON e.id = m.element_id AND e.is_current = true
      WHERE m.job_role_id = $2
        AND NOT EXISTS (
          SELECT 1 FROM assessments a
          WHERE a.candidate_id = $1 AND a.is_assignment IS TRUE
            AND a.element_id = m.element_id
        );
    $SQL$, map_table::text);
    EXECUTE sql USING p_user, v_job_role;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rebuild_assignments_on_user_role ON users;
CREATE TRIGGER trg_rebuild_assignments_on_user_role
AFTER UPDATE OF job_role_id ON users
FOR EACH ROW WHEN (NEW.job_role_id IS DISTINCT FROM OLD.job_role_id)
EXECUTE FUNCTION rebuild_assignments_for_user(NEW.id, true);
