# Capera Standards Importer v1.1 — Fix for “Type must be 'knowledge' or 'performance'”

This patch relaxes validation so rows using “Underpinning Knowledge”, “Performance Criteria”, or short forms like K/UK/PC/P import cleanly without 400.

## Install
1) Replace `app/backend/app/api/standards_import.py` with the file from this zip.
2) Ensure the router is included in `app/backend/app/main.py`:
   ```python
   from app.api import standards_import
   app.include_router(standards_import.router, prefix="/framework", tags=["framework"])
   ```
3) Make sure `openpyxl` is installed:
   ```bash
   pip install openpyxl
   ```
4) Restart backend:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Test (dry run)
```bash
curl -F "file=@Assessment build template.xlsx" \
  "http://localhost:8000/framework/import-xlsx?dry_run=true"
```
You should get 200 OK with a JSON preview and (if needed) a `warnings` array.

## Optional checker
```bash
python tools/check_types.py "Assessment build template.xlsx"
```
This prints any rows with unrecognised type values.
