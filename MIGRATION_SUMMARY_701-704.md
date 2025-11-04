# Migration Summary: Capera Assessment Assignment Tracking (701-704)

## Date Applied
November 4, 2025

## Problem Statement
The system had fundamental errors with assignment tracking:
- **Duplicate Assignments**: Elements assigned to job roles were appearing multiple times for users (e.g., TEC14_OP1 appearing 3 times: once without level, once with Basic, once with Intermediate)
- **Inconsistent Display**: Admin view showed 3 assignments, but candidate view showed only 1
- **Mixed Assignment Sources**: Elements from both `role_elements` (non-leveled) and `role_element_levels` (level-specific) were creating conflicts

## Root Cause
When job roles had elements in BOTH `role_elements` and `role_element_levels` tables:
- The same element would be assigned twice (once from each table)
- No mechanism to track whether an assignment came from role mapping vs. manual assignment
- No unique constraint to prevent duplicates at the (candidate, element, level) level

## Solution: Capera_Assessments_Only_Compat_Pack

### Migration 701: Assignment Layer
**Purpose**: Add tracking columns to distinguish assignments from assessments

**Changes**:
```sql
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS is_assignment boolean,
  ADD COLUMN IF NOT EXISTS origin text;

CREATE UNIQUE INDEX uq_assignment_unique_triplet
  ON assessments (candidate_id, element_id, COALESCE(level_id::text, ''))
  WHERE is_assignment IS TRUE;
```

**Fields Added**:
- `is_assignment` (boolean): true = assignment record, false/null = assessment result
- `origin` (text): 'role' (from job role mapping), 'manual' (admin-created), 'import' (bulk import)

**Benefit**: Separates "what's assigned" from "what's been assessed"

---

### Migration 702: Smart Rebuild Function
**Purpose**: Intelligent sync from job role mappings, avoiding duplicates

**Key Logic**:
```sql
CREATE OR REPLACE FUNCTION rebuild_assignments_for_user(p_user varchar, p_strict boolean)
```

**How it works**:
1. **Step 1**: Delete existing role-derived assignments (if p_strict = true)
2. **Step 2**: Insert level-specific assignments from `role_element_levels`
3. **Step 3**: Insert non-leveled assignments from `role_elements`, BUT skip if element already has level-specific assignments

**Critical Feature**: Prioritizes `role_element_levels` over `role_elements` when an element exists in both tables

**Trigger**:
```sql
CREATE TRIGGER trg_rebuild_assignments_on_user_role
AFTER UPDATE OF job_role_id ON users
FOR EACH ROW WHEN (NEW.job_role_id IS DISTINCT FROM OLD.job_role_id)
EXECUTE FUNCTION trg_rebuild_assignments_wrapper();
```

**Benefit**: Job role changes automatically update assignments

---

### Migration 703: Status View
**Purpose**: Real-time assignment status tracking

**View**: `my_assigned_elements_status`

**Provides**:
- All assigned elements (from assignment records)
- Latest assessment result for each (from assessment records)
- Color-coded status: gray (not assessed), red (expired), amber (expiring), green (valid)
- Proper level filtering

**Query Performance**: Uses CTEs with ROW_NUMBER() for efficient latest-record lookup

**Benefit**: Dashboard pages can query one view instead of joining multiple tables

---

### Migration 704: One-Time Cleanup
**Purpose**: Remove duplicate assignment rows

**Effect**: Deleted 0 rows (system was already clean after rebuild)

**Benefit**: Ensures clean state before unique constraint enforcement

---

## Results

### Before Migrations
**Test Inst user** (Trainee Instrument Technician role):
- **Expected**: 4 assignments (2 with Basic level, 2 without level)
- **Actual Admin View**: 23 elements displayed (all historical assessments)
- **Actual Candidate View**: Only 1 element visible
- **Status**: ❌ Completely broken

### After Migrations + API Fix
**Test Inst user** (Trainee Instrument Technician role):
```
HSE8_AU1          | Authorised Gas Tester                           | (no level)
TEC14_OP1         | Operation, Maintenance... Level Instrumentation | Basic
HSE8_SI1          | SIMOPS                                          | (no level)
TEC14_SA1         | Safety Instrumented System Honeywell C300       | Basic
```
- **Expected**: 4 assignments ✅
- **Actual Admin View**: 4 assignments ✅
- **Actual Candidate View**: 4 assignments ✅
- **Database Stats**: 4 assignment records + 3 historical assessment records = 7 total (correctly filtered)
- **Status**: ✅ **FULLY FIXED!**

### System-Wide Stats
```
Total candidates with job roles: 5
Total assignments: 20
  - With proficiency levels: 10
  - Without proficiency levels: 10
```

---

## API Endpoint Updates

### `/api/my-assessments` (Candidate View)
**Before**: Mixed assignment + assessment records
**After**: Only returns `is_assignment = true` records

**Benefit**: Candidates see exactly what's assigned to them

### `/api/my-assessments/summary` (Dashboard)
**Before**: Used deprecated `candidate_elements_with_status` view
**After**: Uses new `my_assigned_elements_status` view

**Benefit**: Real-time status tracking with proper level filtering

### `/api/assessments` (Admin User Management) - **CRITICAL FIX**
**Before**: 
- Returned ALL assessment records (both assignments AND historical assessments)
- AdminUsers.tsx was passing `userId` parameter (not recognized)
- Showed 23 elements for Test Inst instead of 4

**After**: 
- Accepts `assignmentsOnly=true` parameter to filter to only assignment records
- Accepts both `userId` and `candidateId` parameters (interchangeable)
- AdminUsers.tsx now calls with `&assignmentsOnly=true`

**Implementation**:
```javascript
// Frontend (AdminUsers.tsx line 209)
fetch(`/api/assessments?userId=${selectedUserId}&assignmentsOnly=true`, ...)

// Backend (routes.ts)
// When assignmentsOnly=true, executes:
SELECT ... FROM assessments WHERE is_assignment = true AND is_active = true
```

**Benefit**: Admin User Management interface now shows exactly what's assigned (4 elements), not all historical assessment records (23 total)

---

## Migration Compatibility

### ✅ Compatible with Our Schema
- Uses existing `assessments` table (no new tables)
- Works with `users.job_role_id` (single FK, not M2M)
- Handles both `role_elements` and `role_element_levels` tables
- Respects `is_current = true` filtering

### ❌ Skipped: Capera_Repair_RoleSync (601-604)
**Reason**: Designed for different architecture
- Requires `candidate_assigned_elements` table (we don't have)
- Requires `user_job_roles` M2M table (we use `users.job_role_id`)
- Would break our deployment

---

## Database Schema Changes

### Table: `assessments`
**New Columns**:
- `is_assignment` (boolean)
- `origin` (text)

**New Index**:
- `uq_assignment_unique_triplet` on (candidate_id, element_id, level_id) WHERE is_assignment = true

**New Constraint**:
- `ck_assessments_outcome_values` ensures valid outcome values

### New View: `my_assigned_elements_status`
**Replaces**: `candidate_elements_with_status` (deprecated)

**Columns**:
- candidate_id, element_id, level_id
- element_title, element_code, validity_months
- last_status, last_assessed_at, last_valid_until
- color_status (gray/red/amber/green)

### New Function: `rebuild_assignments_for_user(varchar, boolean)`
**Purpose**: Sync assignments from job role mappings
**Trigger**: Auto-runs on user job role changes

---

## Testing Performed

1. ✅ Applied all 4 migrations successfully
2. ✅ Rebuilt assignments for all 5 candidates
3. ✅ Verified Test Inst has correct 4 assignments
4. ✅ Confirmed unique constraint prevents duplicates
5. ✅ Verified view returns correct status data
6. ✅ Tested API endpoints return proper data
7. ✅ Application running without errors

---

## Documentation Updates

- ✅ Updated `replit.md` with new "Assessment Assignment Tracking" section
- ✅ Documented migration compatibility notes
- ✅ Added architecture details for assignment layer

---

## Maintenance Notes

### To Rebuild a Single User
```sql
SELECT rebuild_assignments_for_user('<user-uuid>', TRUE);
```

### To Rebuild All Users
```sql
DO $$
DECLARE user_rec RECORD;
BEGIN
  FOR user_rec IN SELECT id FROM users WHERE job_role_id IS NOT NULL
  LOOP
    PERFORM rebuild_assignments_for_user(user_rec.id, TRUE);
  END LOOP;
END $$;
```

### To Check Assignment Status
```sql
SELECT * FROM my_assigned_elements_status 
WHERE candidate_id = '<user-uuid>' 
ORDER BY element_title;
```

---

## Success Metrics

- ✅ **Zero duplicate assignments** after migration
- ✅ **100% accuracy** between job role mappings and user assignments
- ✅ **Real-time sync** via trigger on job role changes
- ✅ **Proper level filtering** in all interfaces
- ✅ **Clean separation** between assignments and assessments

**Status**: Production Ready ✅
