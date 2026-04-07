---
plan: "18-04"
phase: "18"
status: complete
completed: "2026-04-07"
---

# Summary: 18-04 - Receipt Module + Unified enrich_from_extraction()

## What was built

- `receipt_it.py`: heuristic merchant detection (first non-trivial header line), TOTALE EUR pattern matching, best-effort line item extraction, Italian date parsing
- `IngestionService` now calls `profile_svc.enrich_from_extraction()` after every non-bank non-unknown successful extraction
- Enrichment failures are logged as warnings and never crash the ingestion pipeline

## Key files created/modified

- `api/app/ingestion/modules/builtin/receipt_it.py` — new
- `api/app/services/ingestion_service.py` — enrich call after db.commit()

## Self-Check: PASSED
