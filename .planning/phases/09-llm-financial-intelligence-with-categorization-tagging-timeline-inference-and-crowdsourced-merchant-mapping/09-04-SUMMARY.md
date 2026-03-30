---
phase: 09-llm-financial-intelligence
plan: "04"
subsystem: backend/api
tags: [api-endpoints, timeline, notifications, uncategorized, merchant-map, phase9]

dependency_graph:
  requires:
    - phase: 09-02
      provides: lookup_merchant_map, write_merchant_map, timeline repository functions
    - phase: 09-03
      provides: ModerationService, NotificationService
  provides:
    - GET /profile/timeline
    - POST /profile/timeline/{id}/dismiss
    - POST /profile/timeline/{id}/context (async TOS+distill)
    - GET /profile/uncategorized
    - PATCH /profile/transactions/{id}/category (D-09 manual merchant_map write)
    - GET /notifications
    - POST /notifications/{id}/read
    - POST /notifications/read-all
  affects: [09-06, 09-07, senso/src/api/profileApi.ts, senso/src/api/notificationsApi.ts]

tech_stack:
  added: []
  patterns:
    - "BackgroundTasks for async TOS+distillation: background_tasks.add_task(svc.check_timeline_context, ...)"
    - "403 write_blocked guard before context submission (D-20)"
    - "D-15: user_context_distilled returned (never raw)"

key_files:
  created:
    - api/app/api/notifications.py
  modified:
    - api/app/api/profile.py
    - api/app/main.py

key_decisions:
  - "get_llm_client() factory used in endpoints instead of LLMClient(get_settings().llm_config) for consistency with profile_service.py"
  - "Uncategorized transactions sorted: frequency-first (same description grouped) then by abs amount — surfaces most-actionable items first"
  - "BackgroundTasks used for async TOS check — 202 Accepted returns immediately, check runs after response"

requirements-completed: []

metrics:
  duration: "~15 min"
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_modified: 3
---

# Phase 09 Plan 04: Timeline, Uncategorized, and Notification API Endpoints — Summary

**5 new profile sub-endpoints (timeline CRUD + uncategorized review + manual category correction) and a notifications router, with async TOS check on context submission.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-03-31
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added 5 endpoints to `profile.py`: GET timeline, POST dismiss, POST context (async), GET uncategorized, PATCH transaction category
- Created `notifications.py` router with 3 endpoints: GET list, POST read, POST read-all
- Registered notifications router in `main.py` at `/notifications` prefix
- Write-blocked users receive 403 on context submission (D-20)
- PATCH /transactions/{id}/category writes to merchant_map with `learned_method="manual"` (D-09)
- All endpoints verified importable and route-registered

## Task Commits

1. **Task 1+2: Profile timeline/uncategorized endpoints + notifications router** - `336ab1a` (feat)

**Plan metadata:** pending (this SUMMARY)

## Files Created/Modified

- `api/app/api/profile.py` — Added DTOs (TimelineEventDTO, UncategorizedTransactionDTO, DismissEventRequest, AddContextRequest, CategoryUpdateRequest) + 5 new endpoints
- `api/app/api/notifications.py` — New router: GET /notifications, POST /{id}/read, POST /read-all
- `api/app/main.py` — Added `notifications_router` import and `app.include_router(notifications_router, prefix="/notifications")`

## Decisions Made

- **`get_llm_client()` factory** used to instantiate LLMClient in the context endpoint, consistent with `profile_service.py` pattern.
- **Frequency-first sorting** for uncategorized: surfaces high-frequency descriptions at top so user can batch-correct common merchants.
- **202 Accepted** returned immediately for context submission; TOS+distillation runs in background.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 06/07 can wire frontend: all API contracts are live
- `GET /profile/timeline` → TimelineTab.tsx
- `GET /profile/uncategorized` → UncategorizedScreen.tsx  
- `GET /notifications` + `POST /read-all` → NotificationPanel.tsx

---
*Phase: 09-llm-financial-intelligence*
*Completed: 2026-03-31*
