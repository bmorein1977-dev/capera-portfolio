from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.db import get_db
from app.dependencies_roles import require_roles

try:
    from app.models.framework import CompetenceElement
except Exception:
    from app.models import CompetenceElement  # type: ignore

from app.models.roles import JobRole, RoleElement

router = APIRouter()

class RoleIn(BaseModel):
    name: str
    client_id: Optional[int] = None
    location: Optional[str] = None
    business_unit: Optional[str] = None

@router.post("/roles")
def create_role(payload: RoleIn, db: Session = Depends(get_db), user=Depends(require_roles("Admin","Developer"))):
    existing = db.query(JobRole).filter(JobRole.name==payload.name, JobRole.client_id==payload.client_id).first()
    if existing:
        return existing
    role = JobRole(**payload.dict())
    db.add(role); db.commit(); db.refresh(role)
    return role

class RoleElementIn(BaseModel):
    element_id: int
    required: bool = True

@router.post("/roles/{role_id}/elements")
def attach_element(role_id: int, payload: RoleElementIn, db: Session = Depends(get_db), user=Depends(require_roles("Admin","Developer"))):
    role = db.query(JobRole).get(role_id)
    if not role: raise HTTPException(404, "Role not found")
    el = db.query(CompetenceElement).get(payload.element_id)
    if not el: raise HTTPException(404, "Element not found")
    link = db.query(RoleElement).filter(RoleElement.role_id==role_id, RoleElement.element_id==payload.element_id).first()
    if not link:
        link = RoleElement(role_id=role_id, element_id=payload.element_id, required=payload.required)
        db.add(link); db.commit(); db.refresh(link)
    return {"status":"ok","role_id":role_id,"element_id":payload.element_id,"required":link.required}

@router.get("/roles/{role_id}/matrix")
def role_matrix(role_id: int, db: Session = Depends(get_db), user=Depends(require_roles("Admin","Developer"))):
    role = db.query(JobRole).get(role_id)
    if not role: raise HTTPException(404, "Role not found")
    links = db.query(RoleElement).filter(RoleElement.role_id==role_id).all()
    element_ids = [l.element_id for l in links] or [-1]
    elements = db.query(CompetenceElement).filter(CompetenceElement.id.in_(element_ids)).all()
    rows = []
    for el in elements:
        rows.append({
            "element_id": el.id,
            "element": getattr(el, "name", f"Element {el.id}"),
            "required": next((l.required for l in links if l.element_id==el.id), True),
        })
    return {"role": {"id":role.id,"name":role.name,"client_id":role.client_id}, "elements": rows}
