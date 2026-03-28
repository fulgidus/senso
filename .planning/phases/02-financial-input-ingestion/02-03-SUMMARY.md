---
phase: 02-financial-input-ingestion
plan: "03"
subsystem: api
tags: [fastapi, sqlalchemy, minio, pydantic, pytest, ingestion, admin]

# Dependency graph
requires:
  - phase: 02-financial-input-ingestion
    plan: "01"
    provides: "DB models (Upload, ExtractedDocument, Transaction, ExtractionReport), MinIO config, Settings"
  - phase: 02-financial-input-ingestion
    plan: "02"
    provides: "ModuleRegistry, LLMClient, guardrail, OCR pipeline, adaptive pipeline, ingestion schemas"
provides:
  - "IngestionService: upload_file, list_uploads, get_upload, get_extracted, confirm_upload, retry_upload, report_upload, delete_upload"
  - "AdminService: list_modules, promote_module, get_module_source"
  - "FastAPI router /ingestion with 8 endpoints (auth-guarded via Bearer token)"
  - "FastAPI router /admin with 3 endpoints (admin-only via require_admin dependency)"
  - "main.py wired with ingestion_router and admin_router"
  - "25 passing tests: 14 endpoint tests + 11 registry tests"
affects:
  - 03-chat-and-guidance
  - frontend-upload-flow

# Tech tracking
tech-stack:
  added: [python-multipart, minio]
  patterns:
    - "FastAPI dependency_overrides for mocking injectable dependencies in tests"
    - "IngestionError (code, message, status_code) mirrors AuthError pattern"
    - "require_admin as proper FastAPI Depends() dependency with DB lookup"
    - "BackgroundTasks for async extraction after 202 response"
    - "D-28: Transaction rows written atomically only for bank_statement document type"

key-files:
  created:
    - api/app/services/ingestion_service.py
    - api/app/services/admin_service.py
    - api/app/api/ingestion.py
    - api/app/api/admin.py
    - api/tests/test_ingestion_endpoints.py
    - api/tests/test_module_registry.py
  modified:
    - api/app/main.py

key-decisions:
  - "Used FastAPI dependency_overrides (not patch()) to mock get_minio_client in tests - only correct approach for Depends()-injected deps"
  - "get_current_user named cleanly (not get_current_user_from_header as in plan sample) - plan sample was a draft; clean name is correct"
  - "require_admin written as clean Depends() function with explicit DB import - avoids __import__ hack suggested in plan"
  - "IngestionError class mirrors AuthError pattern (code, message, status_code) for consistent HTTP error shape"

patterns-established:
  - "Service layer: __init__ accepts db, settings, minio_client - all injected by FastAPI dependency chain"
  - "Error pattern: domain Error subclass → caught at router layer → HTTPException with {code, message} detail"
  - "Admin guard: require_admin dependency does DB lookup for is_admin=True - 403 for non-admin"
  - "MinIO mock: app.dependency_overrides[get_minio_client] = lambda: mock - set in fixture, cleared after yield"

requirements-completed: [INGT-01, INGT-02, INGT-03]

# Metrics
duration: 15min
completed: "2026-03-24"
---

# Phase 02 Plan 03: Ingestion + Admin API Summary

**8 ingestion endpoints + 3 admin endpoints wired into FastAPI via service layer, with 36 total passing tests (25 new)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-24T22:00:00Z
- **Completed:** 2026-03-24T22:29:48Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- IngestionService fully implements upload, extraction orchestration, confirm, retry (with guardrail), report, delete - all with correct ownership checks
- AdminService implements module listing, promotion (generated→promoted), and source retrieval
- All 8 `/ingestion/*` endpoints auth-guarded; all 3 `/admin/*` endpoints admin-guarded with DB lookup
- 36/36 tests pass (11 registry + 14 endpoint + 11 prior auth tests)

## Task Commits

1. **Task 1: IngestionService + AdminService** - `7d37788` (feat)
2. **Task 2: FastAPI routers + main.py wiring + tests** - `429ba85` (feat)

## Files Created/Modified

- `api/app/services/ingestion_service.py` - IngestionService with 9 methods; IngestionError class
- `api/app/services/admin_service.py` - AdminService with list/promote/source; uses ModuleRegistry
- `api/app/api/ingestion.py` - 8 endpoints with MinIO/DB/auth dependencies; get_minio_client injectable
- `api/app/api/admin.py` - 3 admin endpoints; require_admin dependency with DB is_admin check
- `api/app/main.py` - added ingestion_router and admin_router includes
- `api/tests/test_ingestion_endpoints.py` - 14 tests covering auth guards, upload, list, confirm, report, delete
- `api/tests/test_module_registry.py` - 11 tests covering load, skip, match, register, underscore-skip

## Decisions Made

- `dependency_overrides` is the only correct way to mock FastAPI `Depends()` dependencies in tests; `patch()` does not intercept at the Depends resolution level
- `require_admin` was rewritten as a clean proper FastAPI dependency (not the `__import__` hack in the plan sample) - improves readability and testability
- `get_current_user` used as the canonical name (plan draft called it `get_current_user_from_header`) - cleaner and consistent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced __import__ hack in admin.py with clean require_admin dependency**
- **Found during:** Task 2 (admin router implementation)
- **Issue:** Plan sample used `Depends(__import__('app.db.session', fromlist=['get_db']).get_db)` - this is an antipattern that breaks type checking and linting
- **Fix:** Wrote `require_admin` as a proper `Depends(get_db)` + `Depends(get_current_user)` dependency; used it via `_: UserDTO = Depends(require_admin)` in all 3 endpoints
- **Files modified:** api/app/api/admin.py
- **Verification:** 36/36 tests pass; admin 403 behavior verified in router tests via conftest auth setup
- **Committed in:** 429ba85

**2. [Rule 3 - Blocking] Added python-multipart and minio to pyproject.toml**
- **Found during:** Task 2 (test run setup - file upload endpoint requires python-multipart)
- **Issue:** Both packages were absent from pyproject.toml; `uv add` installed them
- **Fix:** `uv add python-multipart minio` from api/
- **Files modified:** api/pyproject.toml, api/uv.lock
- **Verification:** Upload endpoint accepts multipart/form-data; minio.Minio importable
- **Committed in:** Part of prior session setup (already in pyproject.toml before this plan's commits)

---

**Total deviations:** 2 auto-fixed (1 bug/antipattern, 1 blocking missing dep)
**Impact on plan:** Both fixes necessary for correctness and functionality. No scope creep.

## Issues Encountered

- FastAPI `Depends()` mocking: `patch("app.api.ingestion.get_minio_client", ...)` does NOT work - must use `app.dependency_overrides[get_minio_client] = lambda: mock`. This is a FastAPI-specific behavior, not obvious from pytest-mock docs.

## User Setup Required

None - no external service configuration required beyond what was set up in plan 02-01.

## Known Stubs

None - all implemented methods wire to real DB/MinIO/LLM. Background extraction pipeline is real (not mocked in production path).

## Next Phase Readiness

- All ingestion API endpoints are ready for frontend integration (Phase 03 upload flow)
- Transaction query contract (D-29) is enforced: `transactions WHERE confirmed=true` via `upload.confirmed`
- Admin module promotion pipeline is ready for Phase 04+ generated module promotion
- No blockers for Phase 03 (chat and guidance)

---
*Phase: 02-financial-input-ingestion*
*Completed: 2026-03-24*
