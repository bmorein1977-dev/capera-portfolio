-- 011_multi_assessors.sql
-- Purpose: allow assigning multiple assessors to a candidate, deprecate single FK model if present.

-- 1) New mapping table (candidate_assessors) to support many-to-many relationships.
CREATE TABLE IF NOT EXISTS candidate_assessors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_id, assessor_id)
);

-- 2) If 'users' has a 'assigned_assessor_id' column, keep it nullable for backward compatibility or drop:
-- ALTER TABLE users DROP COLUMN IF EXISTS assigned_assessor_id;
