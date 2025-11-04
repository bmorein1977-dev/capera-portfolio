-- 402_rls_policies_example.sql
-- Example Supabase/Postgres RLS policies. Adjust table/column names as needed.
-- Assumes:
--   - auth.users holds identities
--   - your app 'users' table (or similar) has id = auth.users.id
--   - candidate_allocations(candidate_id uuid, assessor_id uuid)
--   - JWT contains custom claim 'app_role' for admin overrides (administrator, assessor, verifier, candidate)
-- Enable RLS on target tables and create helper functions.

-- Helper: current app role from JWT
CREATE OR REPLACE FUNCTION current_app_role()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true)::json->>'app_role',''), 'candidate');
$$;

-- Helper: is admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_app_role() IN ('administrator','developer');
$$;

-- 1) candidate_assigned_elements
ALTER TABLE candidate_assigned_elements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cae_select ON candidate_assigned_elements;
CREATE POLICY cae_select ON candidate_assigned_elements
FOR SELECT
USING (
  -- Candidate sees their own rows
  candidate_id = auth.uid()
  OR
  -- Assessor allocated to that candidate
  EXISTS (
    SELECT 1 FROM candidate_allocations ca
    WHERE ca.candidate_id = candidate_assigned_elements.candidate_id
      AND ca.assessor_id = auth.uid()
  )
  OR is_admin()
);

DROP POLICY IF EXISTS cae_insert ON candidate_assigned_elements;
CREATE POLICY cae_insert ON candidate_assigned_elements
FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS cae_update ON candidate_assigned_elements;
CREATE POLICY cae_update ON candidate_assigned_elements
FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS cae_delete ON candidate_assigned_elements;
CREATE POLICY cae_delete ON candidate_assigned_elements
FOR DELETE USING (is_admin());

-- 2) assessments
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS a_select ON assessments;
CREATE POLICY a_select ON assessments
FOR SELECT
USING (
  candidate_id = auth.uid()
  OR assessor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM candidate_allocations ca
    WHERE ca.candidate_id = assessments.candidate_id
      AND ca.assessor_id = auth.uid()
  )
  OR is_admin()
);

DROP POLICY IF EXISTS a_insert ON assessments;
CREATE POLICY a_insert ON assessments
FOR INSERT WITH CHECK (
  assessor_id = auth.uid() OR is_admin()
);

DROP POLICY IF EXISTS a_update ON assessments;
CREATE POLICY a_update ON assessments
FOR UPDATE USING (
  assessor_id = auth.uid() OR is_admin()
) WITH CHECK (
  assessor_id = auth.uid() OR is_admin()
);

-- 3) assessment_evidence
ALTER TABLE assessment_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ae_select ON assessment_evidence;
CREATE POLICY ae_select ON assessment_evidence
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = assessment_evidence.assessment_id
      AND (a.candidate_id = auth.uid() OR a.assessor_id = auth.uid() OR is_admin())
  )
);

DROP POLICY IF EXISTS ae_insert ON assessment_evidence;
CREATE POLICY ae_insert ON assessment_evidence
FOR INSERT WITH CHECK (
  uploaded_by = auth.uid() OR is_admin()
);

-- 4) assessment_bookings
ALTER TABLE assessment_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ab_select ON assessment_bookings;
CREATE POLICY ab_select ON assessment_bookings
FOR SELECT USING (
  candidate_id = auth.uid() OR assessor_id = auth.uid() OR is_admin()
);

DROP POLICY IF EXISTS ab_mutation ON assessment_bookings;
CREATE POLICY ab_mutation ON assessment_bookings
FOR ALL USING (
  assessor_id = auth.uid() OR is_admin()
) WITH CHECK (
  assessor_id = auth.uid() OR is_admin()
);
