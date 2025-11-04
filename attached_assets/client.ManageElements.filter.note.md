// client.ManageElements.filter.note.md
# Manage Elements Modal — Backend Filter
Ensure the backend query that returns "Available Elements" enforces `is_current = true`:
```sql
SELECT *
FROM competency_elements
WHERE is_current = true
ORDER BY title;
```
If you're filtering client-side, remove legacy items at the API layer instead to avoid accidental assignments.
