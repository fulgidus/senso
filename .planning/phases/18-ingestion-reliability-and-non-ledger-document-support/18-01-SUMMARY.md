---
plan: "18-01"
phase: "18"
status: complete
completed: "2026-04-07"
---

# Summary: 18-01 - Content-Hash Dedup + MIME-First Module Routing

## What was built

- SHA-256 content hash stored on every upload row; duplicate detection rejects second upload with HTTP 409 `duplicate_file`
- Registry upgraded with `MIME_TYPES` per-module filtering + `_extract_xlsx_text()` reads actual cell text from XLSX workbooks (not ZIP bytes)
- `fineco_it` module gains `MIME_TYPES = [xlsx, xls]`

## Key files modified

- `api/app/db/models.py` — `content_hash VARCHAR(64)` on `Upload`
- `api/app/db/session.py` — Round 20 migration (content_hash + 3 profile columns)
- `api/app/services/ingestion_service.py` — dedup check + hash stored on upload
- `api/app/ingestion/registry.py` — `ModuleEntry.mime_types`, `_extract_xlsx_text()`, `_get_scan_text()`, `match(mime_type=...)` MIME pre-filter
- `api/app/ingestion/modules/builtin/fineco_it.py` — `MIME_TYPES` added

## Self-Check: PASSED
