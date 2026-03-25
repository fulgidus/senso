---
phase: 03-financial-profile-clarity
plan: 02
subsystem: api
tags: [fastapi, python, ingestion, categorization, background-tasks, profile]

# Dependency graph
requires:
  - phase: 03-financial-profile-clarity
    provides: "ProfileService.trigger_categorization_for_user() and CategorizationJob model from plan 03-01"
  - phase: 02-financial-input-ingestion
    provides: "IngestionService with confirm_upload(), Upload model with extraction_status/confirmed fields"
provides:
  - "POST /ingestion/confirm-all endpoint that confirms all success uploads and queues categorization"
  - "IngestionService.confirm_all_uploads() method returning {confirmed_count: N}"
  - "After confirm-all, GET /profile/status returns 'queued' immediately"
affects:
  - 03-financial-profile-clarity
  - frontend-ingestion-flow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Confirm-all pattern: bulk confirm + trigger side-effect in single endpoint"
    - "BackgroundTasks dependency injection for non-blocking categorization trigger"

key-files:
  created: []
  modified:
    - api/app/services/ingestion_service.py
    - api/app/api/ingestion.py
    - api/tests/test_ingestion_endpoints.py

key-decisions:
  - "confirm-all always triggers categorization regardless of confirmed_count (even 0 uploads confirmed)"
  - "endpoint uses internal _get_profile_service lazy import to avoid circular dep at module level"
  - "test_confirm_all_queues_categorization_job accepts any non-not_started status to handle sync test execution"

patterns-established:
  - "Bulk confirm uses filter(confirmed==False, extraction_status=='success') query pattern"

requirements-completed:
  - PROF-01

# Metrics
duration: 1min
completed: 2026-03-25
---

# Phase 3 Plan 2: Confirm-All Endpoint + Categorization Trigger Summary

**POST /ingestion/confirm-all endpoint wires bulk upload confirmation to automatic background categorization via IngestionService.confirm_all_uploads() + ProfileService.trigger_categorization_for_user()**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-25T07:47:54Z
- **Completed:** 2026-03-25T07:48:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `IngestionService.confirm_all_uploads()` method confirms all success/unconfirmed uploads for a user and returns count
- `POST /ingestion/confirm-all` endpoint integrates confirm-all + categorization trigger into a single atomic operation
- 3 new tests covering 401 auth guard, zero-confirmed case, and categorization job queuing
- All 45 tests pass (prior ingestion + auth tests unaffected)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add confirm_all_uploads to IngestionService** - `d6a3307` (feat)
2. **Task 2: Add POST /ingestion/confirm-all endpoint + update tests** - `929edb3` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `api/app/services/ingestion_service.py` - Added `confirm_all_uploads(user_id)` method
- `api/app/api/ingestion.py` - Added `_get_profile_service` dependency and `confirm_all` endpoint
- `api/tests/test_ingestion_endpoints.py` - Added 3 confirm-all tests

## Decisions Made
- **Always trigger categorization**: `confirm-all` calls `trigger_categorization_for_user` regardless of `confirmed_count`. Even if 0 uploads are confirmable, the user may have previously confirmed uploads — triggering categorization unconditionally matches D-10.
- **Lazy import for ProfileService**: Used `_get_profile_service` with a local import inside the function body to avoid circular import at module load time (ingestion.py → profile_service.py → categorization_service.py).
- **Test status flexibility**: `test_confirm_all_queues_categorization_job` accepts `queued|complete|categorizing|generating_insights` because TestClient runs background tasks synchronously, so the job may already complete by the time the status is polled.

## Deviations from Plan

None - plan executed exactly as written. Both tasks were already partially implemented from prior session work; verified all must_haves and ran full test suite confirming all pass.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- confirm-all endpoint is fully wired: confirms uploads + queues CategorizationJob in single call
- Frontend can now call POST /ingestion/confirm-all and redirect to ProcessingScreen polling GET /profile/status
- Ready for Plan 03-03 (processing screen / status polling UI)

---
*Phase: 03-financial-profile-clarity*
*Completed: 2026-03-25*
