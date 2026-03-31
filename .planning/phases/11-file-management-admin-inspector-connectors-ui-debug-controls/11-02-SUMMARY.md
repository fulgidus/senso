---
phase: 11-file-management-admin-inspector-connectors-ui-debug-controls
plan: "02"
subsystem: backend/ingestion
tags: [tracing, admin, ingestion, pipeline, debugging]
dependency_graph:
  requires: []
  provides: [ingestion-pipeline-tracing, admin-trace-endpoint]
  affects: [api/app/api/admin.py, api/app/services/ingestion_service.py, api/app/db/models.py, api/app/db/session.py]
tech_stack:
  added: []
  patterns: [never-raise trace helper, additive instrumentation, admin-guarded endpoint]
key_files:
  created: []
  modified:
    - api/app/db/models.py
    - api/app/db/session.py
    - api/app/services/ingestion_service.py
    - api/app/api/admin.py
decisions:
  - "IngestionTrace model and Round 16 migration were completed by the 11-01 parallel agent (commit e43a3a5) — no re-work needed"
  - "_record_trace never raises so tracing is purely additive and cannot break ingestion"
  - "IngestionTraceDTO placed inline in admin.py consistent with other Phase 9 DTOs in that file"
  - "Trace endpoint URL is /admin/ingestion/uploads/{upload_id}/trace (not /admin/uploads/{upload_id}/trace) for namespace clarity"
metrics:
  duration: "~45 minutes (active work; context loaded from prior agent session)"
  completed_date: "2026-03-31"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
requirements: [FILE-02]
---

# Phase 11 Plan 02: Ingestion Pipeline Tracing Summary

**One-liner:** Server-side pipeline step tracing with `IngestionTrace` ORM model, 5 instrumentation points in the ingestion background task, and `GET /admin/ingestion/uploads/{id}/trace` admin endpoint returning ordered steps.

## What Was Built

### Task 1: IngestionTrace model + Round 16 migration
Already completed by the 11-01 parallel agent (commit `e43a3a5`). Verified present:
- `IngestionTrace` ORM model in `api/app/db/models.py` (line 763)
- `traces` relationship on `Upload` model (back-populates)
- Round 16 migration in `api/app/db/session.py` creating `ingestion_traces` table + index on `upload_id`

### Task 2: Instrumented ingestion service + admin endpoint (commit `a870328`)

**`api/app/services/ingestion_service.py`:**
- Added `_record_trace(self, db, upload_id, step_order, step_name, ...)` helper — never raises, swallows and logs all exceptions
- Instrumented `run_extraction_background()` with 5 trace points:
  1. `start` (step_order=1) — file identity confirmed
  2. `ocr_extraction` (step_order=2) — OCR/extraction pipeline output (doc_type, tier, confidence), with timing + error capture
  3. `module_match` (step_order=3) — matched module name/source
  4. `llm_call` (step_order=4) — raw text snippet (first 500 chars), transaction + warning counts
  5. `persistence` (step_order=5) — DB write timing

**`api/app/api/admin.py`:**
- Added `IngestionTraceDTO` (Pydantic, `from_attributes=True`)
- Added `GET /admin/ingestion/uploads/{upload_id}/trace` endpoint: requires admin auth, verifies upload exists (404 if not), returns traces ordered by `step_order`

## Deviations from Plan

### Pre-existing completion
**Task 1 already done by 11-01 parallel agent** — `IngestionTrace` model, `Upload.traces` relationship, and Round 16 migration were all committed in `e43a3a5` as part of the 11-01 execution. This agent skipped Task 1 and proceeded directly to Task 2.

**Rule applied:** None — this was the expected outcome of parallel plan execution. No deviation from intent.

### Trace endpoint URL
Plan spec showed `/admin/uploads/{upload_id}/trace` in one place and `/admin/ingestion/uploads/{upload_id}/trace` in another. Chose the longer form (`/admin/ingestion/uploads/...`) for namespace clarity and consistency with ingestion-focused admin operations.

## Test Results

- 237 passed, 1 skipped (pre-existing TTS import issue), 21 deselected (`slow` + `test_tts`)
- All existing ingestion tests pass — tracing is purely additive

## Known Stubs

None — all trace instrumentation writes real data from the actual pipeline execution.

## Self-Check: PASSED

- `api/app/services/ingestion_service.py` — `_record_trace` present (line 215), 5 trace calls instrumented ✓
- `api/app/api/admin.py` — `IngestionTraceDTO` present, `get_ingestion_trace` endpoint present ✓
- `api/app/db/models.py` — `IngestionTrace` class present (line 763) ✓
- `api/app/db/session.py` — Round 16 migration present ✓
- Commit `a870328` exists ✓
