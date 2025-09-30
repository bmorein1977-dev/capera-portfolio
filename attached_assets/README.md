
# Capera Standards Importer (Excel → Assessment Standards)

This bundle adds a robust **.xlsx importer** for your Competency Manager. It:
- Tolerates **trailing spaces / header variants**
- **Fill-downs** Category/Element/Criteria Type
- Builds **K/KG** (knowledge) and **P/PG** (performance) numbering with **subcategory resets**
- Parses **Assessor Guidance**, **Bold/Italic**
- Captures **Proficiency Scheme (1/3/4)**, **Criticality**, **Reassessment Validity (years)**
- Supports **Required flag** (M=Mandatory, O=Optional)

## Install

1) Copy files into your project (keep same paths).
2) Add the router in `app/backend/app/main.py`:
   ```python
   from app.api import standards_import
   app.include_router(standards_import.router, prefix="/framework", tags=["framework"])
   ```
3) Install dependency:
   ```bash
   pip install openpyxl
   ```
4) Restart backend:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Test (dry-run)

```bash
curl -F "file=@Assessment build template.xlsx" \
  "http://localhost:8000/framework/import-xlsx?dry_run=true"
```

If you get `400 Missing columns`, run the validator (below).

## Validate headers

```bash
python tools/validate_xlsx.py "Assessment build template.xlsx"
```

## Commit to DB

Non-dry-run currently returns `commit_skipped`. Replace that with your ORM upserts/inserts; see the comments in the README of the previous message or ask me to wire it to your models.
