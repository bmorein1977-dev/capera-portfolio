# Capera Competence Update v1 — fix duplicate Knowledge, add Job Roles & Matrix

This patch includes:
1) Two‑column assessment display fix (Knowledge not duplicated under Performance).
2) Print endpoint that correctly separates knowledge vs performance.
3) Job role + matrix endpoints and models.

## Files

**Backend**
- app/backend/app/api/assessments_view.py
- app/backend/templates/assessment_print.html
- app/backend/app/api/job_roles.py
- app/models/roles.py

**Frontend**
- app/frontend/src/components/AssessmentTwoColumn.tsx

## Wire up
In app/backend/app/main.py:

from app.api import assessments_view, job_roles
app.include_router(assessments_view.router, prefix="/framework", tags=["framework"])
app.include_router(job_roles.router,        prefix="/framework", tags=["job-roles"])

Create tables (SQL):
CREATE TABLE IF NOT EXISTS job_roles (
  id INTEGER PRIMARY KEY,
  client_id INTEGER,
  name TEXT NOT NULL,
  location TEXT,
  business_unit TEXT,
  UNIQUE (client_id, name)
);
CREATE TABLE IF NOT EXISTS role_elements (
  id INTEGER PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES job_roles(id) ON DELETE CASCADE,
  element_id INTEGER NOT NULL REFERENCES competence_elements(id) ON DELETE CASCADE,
  required BOOLEAN DEFAULT 1,
  UNIQUE (role_id, element_id)
);
