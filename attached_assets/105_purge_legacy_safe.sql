-- 105_purge_legacy_safe.sql
-- Safely hide/purge legacy elements without breaking your existing schema.
-- Strategy: (A) Ensure queries filter by is_current; (B) Optionally hard-delete any candidate->element links to non-current elements.
-- We don't assume the exact name of your link table. We try common names via dynamic SQL if present.

-- A) Always-true: make sure the flag exists (idempotent if 101 already ran)
ALTER TABLE competency_elements
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

-- B) Best-effort hard purge from one of candidate-element link tables if they exist
DO $$
DECLARE
  link_table regclass;
  stmt text;
BEGIN
  -- Try these common link table names in order
  FOR stmt IN
    SELECT unnest(ARRAY[
      'candidate_element_assignments',
      'candidate_elements',
      'candidate_assigned_elements',
      'candidate_element_links'
    ])
  LOOP
    EXECUTE 'SELECT to_regclass('''||stmt||''')' INTO link_table;
    IF link_table IS NOT NULL THEN
      RAISE NOTICE 'Purging legacy links from %', stmt;
      EXECUTE format($sql$
        DELETE FROM %s ce
        USING competency_elements e
        WHERE ce.element_id = e.id
          AND e.is_current = false
      $sql$, link_table::text);
      -- Also clean up orphans where element_id no longer exists
      EXECUTE format($sql$
        DELETE FROM %s ce
        WHERE NOT EXISTS (SELECT 1 FROM competency_elements e WHERE e.id = ce.element_id)
      $sql$, link_table::text);
      EXIT; -- Once one worked, stop
    END IF;
  END LOOP;
END $$;
