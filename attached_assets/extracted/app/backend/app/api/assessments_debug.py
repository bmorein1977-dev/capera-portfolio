from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from app.db import get_db

try:
    from app.models.framework import KnowledgeItem, PerformanceItem
except Exception:
    from app.models import KnowledgeItem, PerformanceItem  # type: ignore

router = APIRouter()

@router.get("/elements/{element_id}/section-counts")
def section_counts(element_id: int = Path(...), db: Session = Depends(get_db)):
    k = db.query(KnowledgeItem).filter(KnowledgeItem.element_id == element_id).count()
    p = db.query(PerformanceItem).filter(PerformanceItem.element_id == element_id).count()
    return {"knowledge": k, "performance": p}
