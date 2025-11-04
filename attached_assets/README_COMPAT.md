# Capera — Assessments-Only Compatibility Pack

**Fully compatible** with your architecture:
- Single `assessments` table (assignments + results)
- `users.job_role_id` FK (no `user_job_roles` M2M required)

## Apply order
1. 701_assessments_add_assignment_layer.sql
2. 702_rebuild_assignments_for_user.sql
3. 703_view_assigned_elements_status.sql
4. 704_dedupe_assignment_rows_once.sql

## Fix a specific user now
```sql
-- Replace with the candidate's UUID
SELECT rebuild_assignments_for_user('<candidate-uuid>', TRUE);

-- Verify the list matches the Job Role exactly:
SELECT * FROM my_assigned_elements_status WHERE candidate_id = '<candidate-uuid>' ORDER BY element_title;
```

## Frontend
Use the view `my_assigned_elements_status` to render "My Assessments" so it always matches Job Role assignments.
