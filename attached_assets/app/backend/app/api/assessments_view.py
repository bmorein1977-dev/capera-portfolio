from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session
from app.db import get_db

try:
    from app.models.framework import CompetenceElement, KnowledgeItem, PerformanceItem
except Exception:
    from app.models import CompetenceElement, KnowledgeItem, PerformanceItem  # type: ignore

router = APIRouter()

def _fetch_element(db: Session, element_id: int):
    el = db.query(CompetenceElement).get(element_id)
    if not el:
        raise HTTPException(404, "Element not found")
    return el

def _gather(db: Session, model, element_id: int):
    rows = db.query(model).filter(model.element_id == element_id) \
        .order_by(model.sub_index.asc(), model.order_index.asc(), model.id.asc()).all()
    by_sub = {}
    for it in rows:
        sub = (getattr(it, "sub_title", None) or "General").strip() or "General"
        by_sub.setdefault(sub, []).append(it)
    return by_sub

@router.get("/elements/{element_id}/print")
def print_element(
    element_id: int = Path(...),
    role: str = Query("assessor", regex="^(assessor|candidate)$"),
    format: str = Query("html", regex="^(html|json)$"),
    db: Session = Depends(get_db),
):
    el = _fetch_element(db, element_id)
    knowledge = _gather(db, KnowledgeItem, el.id)
    performance = _gather(db, PerformanceItem, el.id)

    def pack(items_by_sub, prefix: str, include_guidance: bool):
        out = []
        for major, (sub, items) in enumerate(items_by_sub.items(), start=1):
            block = {"title": sub, "items": []}
            for it in items:
                num = (it.number or f"{prefix} {major}.{getattr(it,'order_index',1)}").strip()
                entry = {"number": num, "text": it.text, "required": bool(getattr(it,"required", False))}
                gtxt = (getattr(it,"assessor_guidance", "") or "").strip()
                if include_guidance and gtxt:
                    parts = num.split()
                    entry["guidance_number"] = f"{prefix}G {parts[1]}" if len(parts) > 1 else None
                    entry["assessor_guidance"] = gtxt
                block["items"].append(entry)
            out.append(block)
        return out

    include_guidance = (role == "assessor")
    k = pack(knowledge, "K", include_guidance)
    p = pack(performance, "P", include_guidance)

    data = {
        "category": getattr(el, "category", None).name if getattr(el, "category", None) else None,
        "element": getattr(el, "name", "Element"),
        "criticality": getattr(el, "criticality", ""),
        "reassess_years": getattr(el, "reassess_years", 0),
        "proficiency_scheme": getattr(el, "proficiency_scheme", 1),
        "sections": { "knowledge": k, "performance": p }
    }
    if format == "json":
        return data

    env = Environment(
        loader=FileSystemLoader("app/backend/templates"),
        autoescape=select_autoescape(['html'])
    )
    tpl = env.get_template("assessment_print.html")
    html = tpl.render(data=data, role=role)
    return Response(content=html, media_type="text/html")
