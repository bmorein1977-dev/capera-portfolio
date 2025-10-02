from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from app.db import get_db

try:
    from app.models.jobrole import JobRole, JobRoleElement
    from app.models.framework import CompetenceElement
except Exception:
    from app.models import JobRole, JobRoleElement, CompetenceElement  # type: ignore

router = APIRouter()

class JobRoleIn(BaseModel):
    name: str
    code: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None

@router.post("/jobs/roles")
def create_job_role(payload: JobRoleIn, db: Session = Depends(get_db)):
    if db.query(JobRole).filter(JobRole.name==payload.name).first():
        raise HTTPException(409, "Job role already exists")
    r = JobRole(**payload.dict())
    db.add(r); db.commit(); db.refresh(r)
    return {"status":"ok", "id": r.id}

class AssignIn(BaseModel):
    element_ids: List[int]
    default_required: Optional[bool] = True

@router.post("/jobs/roles/{role_id}/assign-elements")
def assign_elements(role_id: int, payload: AssignIn, db: Session = Depends(get_db)):
    role = db.query(JobRole).get(role_id)
    if not role: raise HTTPException(404, "Job role not found")
    existing = {re.element_id for re in role.elements}
    assigned = 0
    for eid in payload.element_ids:
        if eid in existing: continue
        if not db.query(CompetenceElement).get(eid):
            raise HTTPException(400, f"Unknown element_id {eid}")
        re = JobRoleElement(role_id=role.id, element_id=eid, required=1 if payload.default_required else 0)
        db.add(re); assigned += 1
    db.commit()
    return {"status":"ok","assigned": assigned}

@router.get("/jobs/roles/{role_id}/matrix")
def get_role_matrix(role_id: int, db: Session = Depends(get_db)):
    role = db.query(JobRole).get(role_id)
    if not role: raise HTTPException(404, "Job role not found")
    rows = (
        db.query(JobRoleElement, CompetenceElement)
        .join(CompetenceElement, CompetenceElement.id == JobRoleElement.element_id)
        .filter(JobRoleElement.role_id == role_id)
        .all()
    )
    elements = [
        {"element_id": el.id, "element": getattr(el, "name", getattr(el, "title", "Element")), "required": bool(re.required)}
        for re, el in rows
    ]
    return {
        "role": {"id": role.id, "name": role.name, "code": role.code, "department": role.department, "location": role.location},
        "elements": elements
    }
