---
phase: 09-llm-financial-intelligence
plan: "03"
subsystem: backend/services
tags: [moderation, notifications, tos-check, progressive-enforcement, phase9]

dependency_graph:
  requires:
    - phase: 09-01
      provides: ModerationLog, Notification ORM models
    - phase: 09-02
      provides: tos_check_system.j2, tos_check_response.schema.json, repository foundation
  provides:
    - NotificationService (create, list, mark-read)
    - ModerationService (TOS check, distillation, progressive enforcement, write-block check)
    - Notification repository functions (create_notification, get_notifications, count_unread, mark_read, mark_all_read)
    - ModerationLog repository functions (log_moderation, count_violations_for_user)
    - users.violation_count and users.banned_until columns (Round 12 DDL)
  affects: [09-04, 09-05, api/app/services/moderation_service.py, api/app/services/notification_service.py]

tech_stack:
  added: []
  patterns:
    - "Threading pattern for LLM side-channel checks: threading.Event + daemon thread + done.wait(timeout)"
    - "Progressive enforcement: count prior violations → warn/24h/7d/ban - same pattern as guardrail.py"
    - "Service wraps repository: NotificationService.create() calls create_notification() then db.commit()"

key_files:
  created:
    - api/app/services/moderation_service.py
    - api/app/services/notification_service.py
  modified:
    - api/app/db/repository.py
    - api/app/db/session.py

key_decisions:
  - "get_schema() imported from app.ingestion.prompts.loader (not app.ingestion.schemas.loader - that file does not exist; loader.py lives in prompts/)"
  - "TOS check defaults to clean=True on LLM error (fail open) - avoids blocking users when LLM is unavailable"
  - "Distillation falls back to raw text[:200] on LLM error - ensures context is always stored even without LLM"
  - "count_violations_for_user counts BEFORE the new violation is applied - so progressive levels are: 0=warn, 1=24h, 2=7d, 3+=ban"

requirements-completed: []

metrics:
  duration: "~12 min"
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_modified: 4
---

# Phase 09 Plan 03: ModerationService + NotificationService - Summary

**TOS check with threading + progressive enforcement (warn→24h→7d→ban) and notification creation service, backed by 7 new repository functions and users penalty columns.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-30T22:40:00Z (approx)
- **Completed:** 2026-03-30T22:52:00Z (approx)
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added 7 notification/moderation repository functions to `repository.py`
- Added Round 12 DDL in `session.py`: `violation_count` and `banned_until` columns on users table
- Created `NotificationService` with full CRUD (create, list, unread count, mark read, mark all read)
- Created `ModerationService` with TOS check, distillation, progressive enforcement, write-block check
- All methods confirmed importable; 25 existing tests pass (no regressions)

## Task Commits

1. **Task 1: Notification/moderation repository + DDL** - `0632fda` (feat)
2. **Task 2: ModerationService + NotificationService** - `9b62878` (feat)

**Plan metadata:** pending (this SUMMARY)

## Files Created/Modified

- `api/app/services/moderation_service.py` - `ModerationService`: `check_timeline_context`, `_run_tos_check`, `_run_distillation`, `_enforce`, `_apply_timeout`, `_apply_ban`, `is_user_write_blocked`
- `api/app/services/notification_service.py` - `NotificationService`: `create`, `list_for_user`, `unread_count`, `mark_read`, `mark_all_read`
- `api/app/db/repository.py` - Added `create_notification`, `get_notifications`, `count_unread_notifications`, `mark_notification_read`, `mark_all_notifications_read`, `log_moderation`, `count_violations_for_user`; updated imports for `ModerationLog`, `Notification`
- `api/app/db/session.py` - Round 12: `ALTER TABLE users ADD COLUMN IF NOT EXISTS violation_count` + `banned_until`

## Decisions Made

- **Import path fix:** `get_schema()` lives in `app.ingestion.prompts.loader`, not `app.ingestion.schemas.loader`. Plan had the wrong path - auto-fixed.
- **Fail-open TOS check:** On LLM error, returns `{"clean": True, ...}` to avoid blocking users when LLM is temporarily unavailable.
- **Distillation fallback:** Returns `raw_text[:200]` on LLM error so context is always stored.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wrong import path for `get_schema()`**
- **Found during:** Task 2 (creating moderation_service.py)
- **Issue:** Plan specified `from app.ingestion.schemas.loader import get_schema` but `schemas/loader.py` does not exist; `get_schema()` is in `app.ingestion.prompts.loader`
- **Fix:** Used correct import `from app.ingestion.prompts.loader import get_schema`
- **Files modified:** `api/app/services/moderation_service.py`
- **Verification:** `from app.services.moderation_service import ModerationService` - exits 0
- **Committed in:** 9b62878

---

**Total deviations:** 1 auto-fixed (1 blocking import path)
**Impact on plan:** Minimal - same functionality, correct module path.

## Issues Encountered

None - apart from the import path deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 04 and 05 can proceed: all services are importable
- `ModerationService.check_timeline_context()` ready to be wired in timeline context API endpoint (Plan 04)
- `NotificationService` ready for notification bell + panel (Plans 04 + 07)
- `is_user_write_blocked()` ready for enforcement check in context submission endpoint

---
*Phase: 09-llm-financial-intelligence*
*Completed: 2026-03-31*
