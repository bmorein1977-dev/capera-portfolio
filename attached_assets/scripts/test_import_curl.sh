#!/usr/bin/env bash
set -euo pipefail
FILE="${1:-Assessment build template.xlsx}"
URL="${2:-http://localhost:8000/framework/import-xlsx?dry_run=true}"
echo "Uploading: $FILE -> $URL"
curl -i -F "file=@${FILE}" "$URL"
echo
