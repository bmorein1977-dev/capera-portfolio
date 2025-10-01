# Capera Competence Builder v2 (Replit patch)

This archive adds:
- **Updated Excel importer** (Type mapping & KG/PG numbering in preview).
- **Manual builder API** that mirrors Excel columns **A–J** and auto-numbers **K/KG** and **P/PG**.
- **Printable/preview endpoint** that renders a SIMOPS-style document (guidance shown only to assessors).
- **Criteria modal (React)** with **Assessment Criteria (F)** and **Assessor Guidance (G)**, plus C/H/I/J controls.

## Files & where to place them

```
app/backend/app/api/standards_import.py      # replace existing importer
app/backend/app/api/framework_items.py       # new: manual create route
app/backend/app/api/assessments_view.py      # new: print/preview route
app/backend/templates/assessment_print.html  # new: Jinja template

app/frontend/src/components/CriteriaModal.tsx # replace existing modal component
```

## Wire the routes (backend)
In `app/backend/app/main.py`:
```python
from app.api import standards_import, framework_items, assessments_view
app.include_router(standards_import.router, prefix="/framework", tags=["framework"])
app.include_router(framework_items.router, prefix="/framework", tags=["framework"])
app.include_router(assessments_view.router, prefix="/framework", tags=["framework"])
```

Install deps if needed:
```bash
pip install openpyxl jinja2
```

## Quick checks
- Dry-run an import:
```bash
curl -F "file=@Assessment\ build\ template.xlsx" \
  "http://localhost:8000/framework/import-xlsx?dry_run=true"
```
- Create one line manually:
```bash
curl -X POST "http://localhost:8000/framework/elements/123/criteria" \
  -H "Content-Type: application/json" \
  -d '{"criteria_type":"knowledge","subcategory":"General","criteria_text":"What is SIMOPS?","guidance":"Assessor-only","required_flag":"M","prof_level":3,"criticality":"High","reassess_years":3}'
```
- Render preview:
```
/framework/elements/123/print?format=html&role=assessor
/framework/elements/123/print?format=json&role=candidate
```

**Notes**
- Column **F** → Assessment Criteria (modal textarea).
- Column **G** → Assessor Guidance (optional; assessor-only in print/preview).
- Column **J** applies per row (Mandatory/Optional).
- Element-level: **C**(scheme), **H**(criticality), **I**(reassessment years).
