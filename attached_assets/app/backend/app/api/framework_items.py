from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from typing import Optional, Literal, Tuple
from sqlalchemy.orm import Session
from app.db import get_db
from app.dependencies_roles import require_roles

try:
    from app.models.framework import CompetenceCategory, CompetenceElement, KnowledgeItem, PerformanceItem
except Exception:
    from app.models import CompetenceCategory, CompetenceElement, KnowledgeItem, PerformanceItem  # type: ignore

router = APIRouter()

class CriteriaIn(BaseModel):
    category: Optional[str] = Field(None, description="Column A")
    element: Optional[str] = Field(None, description="Column B")
    prof_level: Optional[int] = Field(None, description="Column C (1,3,4)")
    criteria_type: Literal["knowledge","performance"] = Field(..., description="Column D")
    subcategory: Optional[str] = Field(None, description="Column E")
    criteria_text: str = Field(..., description="Column F - Assessment Criteria")
    guidance: Optional[str] = Field(None, description="Column G - Assessor Guidance")
    criticality: Optional[str] = Field(None, description="Column H")
    reassess_years: Optional[int] = Field(None, description="Column I (years)")
    required_flag: Optional[Literal["M","O"]] = Field(None, description="Column J")

def _ensure_category(db: Session, name: str, client_id: Optional[int]):
    q = db.query(CompetenceCategory).filter(CompetenceCategory.name == name)
    if hasattr(CompetenceCategory, "client_id"):
        q = q.filter(CompetenceCategory.client_id == client_id)
    cat = q.first()
    if not cat:
        cat = CompetenceCategory(name=name, client_id=client_id) if hasattr(CompetenceCategory, "client_id") else CompetenceCategory(name=name)
        db.add(cat); db.flush()
    return cat

def _ensure_element(db: Session, category_id: int, name: str):
    el = db.query(CompetenceElement).filter(CompetenceElement.category_id == category_id, CompetenceElement.name == name).first()
    if not el:
        el = CompetenceElement(name=name, category_id=category_id)
        db.add(el); db.flush()
    return el

def _sub_map_rows(db: Session, model, element_id: int):
    rows = db.query(model).filter(model.element_id == element_id).all()
    order, mapping = [], {}
    for it in rows:
        sub = (getattr(it, "sub_title", None) or "General").strip() or "General"
        if sub not in mapping:
            order.append(sub)
            mapping[sub] = len(order)
    return mapping, rows

def _next_num(db: Session, model, element_id: int, sub: str, prefix: str) -> Tuple[str,int,int]:
    mapping, rows = _sub_map_rows(db, model, element_id)
    sub = (sub or "General").strip() or "General"
    if sub not in mapping:
        major = len(mapping) + 1
        minor = 1
    else:
        major = mapping[sub]
        minors = []
        for it in rows:
            if (getattr(it, "sub_title", None) or "General").strip() == sub:
                n = (getattr(it, "number", "") or "").strip()
                try:
                    part = n.split()[1]   # "1.3"
                    minors.append(int(part.split(".")[1]))
                except Exception:
                    pass
        minor = (max(minors)+1) if minors else 1
    return f"{prefix} {major}.{minor}", major, minor

@router.post("/elements/{element_id}/criteria")
def create_criteria(
    element_id: int = Path(...),
    payload: CriteriaIn = ...,
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user = Depends(require_roles("Admin","Developer"))
):
    el = db.query(CompetenceElement).get(element_id)
    if not el:
        if not payload.category or not payload.element:
            raise HTTPException(404, "Element not found. Provide Column A (category) and B (element) to create it.")
        cat = _ensure_category(db, payload.category, client_id)
        el = _ensure_element(db, cat.id, payload.element)

    if payload.prof_level is not None and hasattr(el, "proficiency_scheme"):
        el.proficiency_scheme = int(payload.prof_level)
    if payload.criticality is not None and hasattr(el, "criticality"):
        el.criticality = payload.criticality
    if payload.reassess_years is not None and hasattr(el, "reassess_years"):
        el.reassess_years = int(payload.reassess_years)
    db.flush()

    model = KnowledgeItem if payload.criteria_type == "knowledge" else PerformanceItem
    prefix = "K" if payload.criteria_type == "knowledge" else "P"

    sub = (payload.subcategory or "General").strip() or "General"
    number, major, minor = _next_num(db, model, el.id, sub, prefix)

    req_bool = (payload.required_flag or "M").upper() == "M"

    item = model(
        element_id = el.id,
        number = number,
        text = payload.criteria_text.strip(),
        sub_title = sub,
        sub_index = major,
        order_index = minor,
        assessor_guidance = (payload.guidance or ""),
        required = req_bool,
        fmt_bold = False,
        fmt_italic = False,
    )
    db.add(item); db.commit()

    guidance_number = f"{prefix}G {major}.{minor}" if payload.guidance else None

    return {
        "status": "ok",
        "element_id": el.id,
        "id": item.id,
        "number": item.number,
        "guidance_number": guidance_number,
        "saved": {
            "criteria_text": item.text,
            "assessor_guidance": payload.guidance or "",
            "subcategory": sub,
            "required": req_bool,
        }
    }
