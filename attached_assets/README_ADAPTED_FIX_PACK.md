# Capera — Adapted Fix Pack (Schema-Safe)

This pack is tailored to **your current schema names** reported by Replit:
- `competency_elements` (instead of `elements`)
- `competence_criteria` (instead of `criteria`)
- `candidate_allocations` (instead of `candidate_assessors`)
- `assessments` already exists (different structure)

## Apply order

1. **101_add_current_and_validity.sql**  
   - Adds `is_current` + `validity_months` to `competency_elements`.

2. **102_enable_multi_assessors.sql**  
   - Ensures `candidate_allocations` supports **multiple assessors per candidate** with a composite unique on `(candidate_id, assessor_id)`.

3. **103_assessments_extend.sql**  
   - Extends your existing `assessments` with: `status`, `methods[]`, `assessed_at`, `valid_until`, `notes`, and links (`element_id`, `candidate_id`, `assessor_id`).  
   - Adds trigger to auto-calc `valid_until` based on `competency_elements.validity_months`.

4. **104_booking_and_emails.sql**  
   - Adds `assessment_bookings` + `outbound_emails` tables for scheduling and email auditing.

5. **105_purge_legacy_safe.sql**  
   - Ensures queries can filter by `is_current`.  
   - **Best-effort purge** of legacy candidate→element links using whichever link table is present (tries a small list).

6. **106_assessor_visibility_view.sql**  
   - Creates `assessor_candidate_elements` view, joining `candidate_allocations` to your discovered candidate→element link table and `competency_elements` (current only).  
   - If it can't find a link table, it creates a harmless empty view so your API won’t crash—update it later with the correct table name.

## What this enables

- Hide legacy elements by flipping `competency_elements.is_current = false` (no code change needed if your queries respect the view).
- Colour-coding via `valid_until` (set by trigger).
- Multiple assessors per candidate supported via `candidate_allocations`.
- Booking flow + email logs ready.
- A stable view for assessor dashboards, returning only **current** elements for their candidates.

## Next steps (API/UI)

- Use: `SELECT * FROM assessor_candidate_elements WHERE assessor_id = $1` to power the assessor workspace list.  
- When creating an assessment, set:
  - `status`: `competent | not_yet_competent | competent_with_minor_needs`
  - `methods`: `{'Observation','Simulation','Demonstration','Questioning','Self-assessment','Work products','Professional discussion','Expert witness testimony'}`
  - `assessed_at`: timestamp of assessment
  - `element_id`, `candidate_id`, `assessor_id`
- To set expiry logic, fill `competency_elements.validity_months` per element (e.g., 12, 24).

## Safety & Rollback

- All scripts are **idempotent** and use **IF NOT EXISTS** guards where practical.
- Run on a staging DB first.  
- Take a snapshot/backup before applying to production.
