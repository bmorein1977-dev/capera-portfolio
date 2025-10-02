# Capera Fixes — Knowledge duplication + Job Roles/Matrix (v1)

This bundle contains:
1) **assessment_print.html** — fixes the duplication issue by ensuring the *Performance* loop iterates over `data.sections.performance` (not knowledge).
2) **assessments_debug.py** — quick counts endpoint to verify that knowledge vs performance rows are correctly saved.
3) **job_roles.py** — working Job Role creation + assignment + matrix fetch routes.

## Install

1) **Template fix**
   - Put `assessment_print.html` in: `app/backend/templates/assessment_print.html` (replace the existing file).

2) **APIs**
   - Copy `assessments_debug.py` to `app/backend/app/api/assessments_debug.py`
   - Copy `job_roles.py` to `app/backend/app/api/job_roles.py`

3) **Wire routers** in `app/backend/app/main.py`:
   ```python
   from app.api import assessments_debug, job_roles
   app.include_router(assessments_debug.router, prefix="/framework", tags=["framework-debug"])
   app.include_router(job_roles.router,          prefix="/framework", tags=["roles"])
   ```

4) **Models (if you don’t have them yet)**  
   Example SQLAlchemy models for Job Role + link table:
   ```python
   # app/models/jobrole.py
   from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
   from sqlalchemy.orm import relationship
   from app.db import Base

   class JobRole(Base):
       __tablename__ = "job_roles"
       id = Column(Integer, primary_key=True)
       name = Column(String, nullable=False)
       code = Column(String, nullable=True)
       department = Column(String, nullable=True)
       location = Column(String, nullable=True)
       elements = relationship("JobRoleElement", back_populates="role", cascade="all, delete-orphan")

   class JobRoleElement(Base):
       __tablename__ = "job_role_elements"
       id = Column(Integer, primary_key=True)
       role_id = Column(Integer, ForeignKey("job_roles.id", ondelete="CASCADE"), nullable=False)
       element_id = Column(Integer, ForeignKey("competence_elements.id", ondelete="CASCADE"), nullable=False)
       required = Column(Integer, default=1)  # 1=required, 0=optional
       UniqueConstraint("role_id","element_id", name="uq_role_element")
       role = relationship("JobRole", back_populates="elements")
   ```

5) **Restart backend**.

## Quick tests

- **Check counts:**  
  `GET /framework/elements/{element_id}/section-counts`  
  → `{"knowledge": 12, "performance": 8}`

- **Create a role:**  
  ```bash
  curl -X POST http://localhost:8000/framework/jobs/roles     -H "content-type: application/json"     -d '{"name":"Production Operator","code":"PO","department":"Ops","location":"Offshore"}'
  ```

- **Assign elements:**  
  ```bash
  curl -X POST http://localhost:8000/framework/jobs/roles/1/assign-elements     -H "content-type: application/json"     -d '{"element_ids":[101,102,103],"default_required":true}'
  ```

- **Fetch matrix:**  
  `GET /framework/jobs/roles/1/matrix`
