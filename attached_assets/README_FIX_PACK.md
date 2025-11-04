# Capera Fix Pack — Assessor Workflow & Legacy Cleanup

This folder contains SQL migrations you can run against your Postgres/Supabase DB to enable:
- Purging legacy elements from candidate assignments
- Multiple assessors per candidate
- Full assessment recording (status, methods, per-criterion results, evidence)
- Booking system with email audit log
- View to power the assessor dashboard (only see your candidates and their elements)

## Files
- 010_purge_legacy.sql
- 011_multi_assessors.sql
- 012_assessments_and_status.sql
- 013_assessment_bookings.sql
- 014_dashboard_visibility.sql

## Order to Apply
1. 011_multi_assessors.sql
2. 012_assessments_and_status.sql
3. 013_assessment_bookings.sql
4. 014_dashboard_visibility.sql
5. 010_purge_legacy.sql  (run last once 'elements.is_current' is correct)

> Note: If your 'elements' table does not have 'is_current' yet, add it first:
>
> ```sql
> ALTER TABLE elements ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
> UPDATE elements SET is_current = true WHERE id IN (SELECT id FROM elements); -- set correctly for the 7 uploaded elements
> ```

## Frontend/API Pointers
- Add REST endpoints in `server/routes.ts` for:
  - `GET /assessors/:id/candidates` (from `assessor_candidate_elements` view)
  - `POST /assessments` (creates header + criteria rows + evidence metadata)
  - `POST /assessments/:id/evidence` (pre-signed upload URL to Storage)
  - `POST /bookings` and `GET /bookings?role=assessor|candidate`
- Update `shared/schema.ts` with new types (tables above).
- In `client/src/pages/AssessmentsPage.tsx`:
  - Switch to list view with filters; group by candidate; show color coding:
    - **Red**: `valid_until < now()`
    - **Amber**: `valid_until <= now() + interval '90 days'`
    - **Green**: else
  - Show criteria with guidance and mark result per criterion.
  - Outcome chips: Competent / Not Yet Competent / Competent (Minor Needs).
  - Methods checklist: Observation, Simulation, Demonstration, Questioning, Self‑assessment, Work products, Professional discussion, Expert witness testimony.
  - Drag-drop evidence zone (fallback to file picker).

## Offline
- Cache candidates, elements, criteria, and pending assessments in IndexedDB.
- Queue `POST /assessments` when back online.

## Security
- Enable SSO (SAML/OIDC) via your auth provider.
- Turn on MFA via authenticator app or WebAuthn keys.

