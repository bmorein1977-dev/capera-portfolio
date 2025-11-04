-- 106_assessor_visibility_view.sql
-- Create a view that powers assessor dashboards using your schema names.
-- This requires candidate_allocations (candidate_id, assessor_id) and some candidate->element link table.
-- We will attempt to bind to the first link table we find (same list as in 105).

DO $$
DECLARE
  link_table regclass;
  vsql text;
BEGIN
  FOR vsql IN
    SELECT unnest(ARRAY[
      'candidate_element_assignments',
      'candidate_elements',
      'candidate_assigned_elements',
      'candidate_element_links'
    ])
  LOOP
    EXECUTE 'SELECT to_regclass('''||vsql||''')' INTO link_table;
    IF link_table IS NOT NULL THEN
      -- Drop existing view if any
      EXECUTE 'DROP VIEW IF EXISTS assessor_candidate_elements';
      -- Create the view targeting the discovered link table
      EXECUTE format($sql$
        CREATE VIEW assessor_candidate_elements AS
        SELECT
          ca.assessor_id,
          l.candidate_id,
          l.element_id,
          e.title       AS element_title,
          e.priority    AS element_priority,
          e.validity_months,
          e.is_current,
          l.created_at  AS assigned_at
        FROM candidate_allocations ca
        JOIN %s l ON l.candidate_id = ca.candidate_id
        JOIN competency_elements e ON e.id = l.element_id
        WHERE e.is_current = true;
      $sql$, link_table::text);
      RETURN;
    END IF;
  END LOOP;

  -- If we didn't find a link table, create a stub view to avoid breaking queries (empty result)
  EXECUTE 'DROP VIEW IF EXISTS assessor_candidate_elements';
  EXECUTE $sql$
    CREATE VIEW assessor_candidate_elements AS
    SELECT NULL::uuid AS assessor_id, NULL::uuid AS candidate_id, NULL::uuid AS element_id,
           NULL::text AS element_title, NULL::text AS element_priority, NULL::int AS validity_months,
           NULL::boolean AS is_current, NULL::timestamptz AS assigned_at
    WHERE false;
  $sql$;
END $$;
