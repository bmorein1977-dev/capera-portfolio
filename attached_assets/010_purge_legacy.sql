-- 010_purge_legacy.sql
-- Purpose: Remove legacy competency elements from candidate assignments that are not in the new set.

-- 1) A safety backup view (optional). Adjust schema name as needed.
-- CREATE MATERIALIZED VIEW IF NOT EXISTS backup_legacy_candidate_elements AS
-- SELECT * FROM candidate_assigned_elements;

-- 2) Delete any assigned elements that are not in the current set uploaded in 'elements' table and flagged as current.
-- Assumes 'elements' table has a boolean column 'is_current' and primary key 'id'.
-- If 'is_current' does not exist yet, add it and set appropriate flags in 011 migration before running this.

DELETE FROM candidate_assigned_elements cae
USING elements e
WHERE cae.element_id = e.id
AND e.is_current = false;

-- 3) Optional: hard-purge orphaned assignments whose element_id no longer exists in elements.
DELETE FROM candidate_assigned_elements cae
WHERE NOT EXISTS (SELECT 1 FROM elements e WHERE e.id = cae.element_id);
