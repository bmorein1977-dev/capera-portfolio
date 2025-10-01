from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from jinja2 import Environment, FileSystemLoader, select_autoescape
from app.db import get_db
try:
    from app.models.framework import CompetenceElement, KnowledgeItem, PerformanceItem
except Exception:
    from app.models import CompetenceElement, KnowledgeItem, PerformanceItem  # type: ignore
router = APIRouter()
def _fetch_element(db: Session, element_id: int) -> CompetenceElement:
    el = db.query(CompetenceElement).get(element_id)
    if not el:
        raise HTTPException(404, "Element not found")
    return el
def _gather(db: Session, model, element_id: int):
    return (db.query(model).filter(model.element_id == element_id)
            .order_by(model.sub_index.asc(), model.order_index.asc(), model.id.asc()).all())
@router.get("/elements/{element_id}/print")
def print_element(element_id: int = Path(...), role: str = Query("assessor", regex="^(assessor|candidate)$"),
                  format: str = Query("html", regex="^(html|json)$"), db: Session = Depends(get_db)):
    el = _fetch_element(db, element_id)
    knowledge_rows   = _gather(db, KnowledgeItem, el.id)
    performance_rows = _gather(db, PerformanceItem, el.id)
    def pack(rows, prefix: str, include_guidance: bool):
        out: List[Dict[str, Any]] = []
        current_sub = None
        group = None
        major = 0
        for it in rows:
            sub = (getattr(it, "sub_title", None) or "General").strip() or "General"
            if sub != current_sub:
                major += 1
                current_sub = sub
                group = {"title": sub, "items": []}
                out.append(group)
            num = (it.number or f"{prefix} {major}.{getattr(it,'order_index',1)}").strip()
            item = {"number": num, "text": it.text, "required": bool(getattr(it,'required', False))}
            gtxt = (getattr(it,'assessor_guidance', '') or '').strip()
            if include_guidance and gtxt:
                part = num.split()
                item["guidance_number"] = f"{prefix}G {part[1]}" if len(part) > 1 else None
                item["assessor_guidance"] = gtxt
            group["items"].append(item)
        return out
    include_guidance = (role == 'assessor')
    knowledge = pack(knowledge_rows, 'K', include_guidance)
    performance = pack(performance_rows, 'P', include_guidance)
    data = {
        'category': getattr(el, 'category', None).name if getattr(el, 'category', None) else None,
        'element': getattr(el, 'name', 'Element'),
        'criticality': getattr(el, 'criticality', ''),
        'reassess_years': getattr(el, 'reassess_years', 0),
        'proficiency_scheme': getattr(el, 'proficiency_scheme', 1),
        'sections': {'knowledge': knowledge, 'performance': performance}
    }
    if format == 'json':
        return data
    env = Environment(loader=FileSystemLoader('app/backend/templates'),
                      autoescape=select_autoescape(['html']))
    tpl = env.get_template('assessment_print.html')
    html = tpl.render(data=data, role=role)
    return Response(content=html, media_type='text/html')
