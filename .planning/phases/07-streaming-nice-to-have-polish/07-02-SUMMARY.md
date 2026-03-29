---
phase: 07-streaming-nice-to-have-polish
plan: "02"
subsystem: api
tags: [fastapi, sse, coaching, safety, streaming, testing]
requires:
  - phase: 04-safe-grounded-text-coaching
    provides: stateless CoachingService.chat and DB-backed coaching session persistence
  - phase: 07-streaming-nice-to-have-polish
    provides: persona metadata and saved persona preference groundwork from 07-01
provides:
  - POST /coaching/chat/stream SSE endpoint with message deltas and final structured payload
  - shared chat execution and persistence flow for blocking and streaming routes
  - rewrite-first live-profile own_pii_unsolicited sanitization for assistant payloads
affects: [07-03 frontend SSE client, 07-04 persona polish on restored chat history]
tech-stack:
  added: []
  patterns:
    - backend SSE streams only validated message text while final event carries the complete response DTO
    - own-profile safety is enforced by post-generation payload rewriting instead of hard blocking
key-files:
  created: []
  modified:
    - api/app/api/coaching.py
    - api/app/coaching/service.py
    - api/app/coaching/safety.py
    - api/tests/test_coaching_endpoints.py
    - api/tests/test_safety_hardening.py
key-decisions:
  - "Kept CoachingService.chat as the single generation path and layered SSE on top of the final validated response rather than introducing provider-native token streaming."
  - "Applied own-profile protection as a live-profile rewrite pass so useful answers survive while unsolicited facts are trimmed out of message, reasoning, verdict, and A2UI payloads."
patterns-established:
  - "Streaming route pattern: run the normal chat flow once, persist messages once, then emit meta/delta/final/done SSE events from the validated DTO."
  - "Privacy rewrite pattern: collect live profile/user facts, compare them to the latest user question, and sanitize matched unsolicited details before returning output."
requirements-completed: [SAFE-01]
duration: 4min
completed: 2026-03-29
---

# Phase 7 Plan 02: Streaming backend and live-profile rewrite Summary

**SSE coaching delivery with final-payload streaming and rewrite-first sanitization of unsolicited profile facts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T18:49:43Z
- **Completed:** 2026-03-29T18:54:03Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `POST /coaching/chat/stream` that reuses the existing chat/session pipeline and emits `meta`, `delta`, `final`, and `done` SSE events.
- Extracted shared chat execution/persistence logic so streaming and non-streaming coaching requests cannot drift.
- Added a live-profile rewrite pass that removes unsolicited own-profile details from assistant payloads without turning normal coaching replies into hard blocks.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a low-risk SSE chat endpoint that streams only the final message field** - `2cf2025` (feat)
2. **Task 2: Add rewrite-first live-profile own_pii_unsolicited protection** - `d0d2ee3` (fix)

## Files Created/Modified
- `api/app/api/coaching.py` - added shared chat flow helper plus `/coaching/chat/stream` SSE route.
- `api/app/coaching/service.py` - allowed configured personas and inserted live-profile sanitization before returning final payloads.
- `api/app/coaching/safety.py` - added candidate extraction and rewrite helpers for unsolicited own-profile facts.
- `api/tests/test_coaching_endpoints.py` - covered SSE event order and single-persistence behavior.
- `api/tests/test_safety_hardening.py` - covered rewrite vs allowed grounded-answer behavior.

## Decisions Made
- Streaming stays low risk by chunking the already-validated `message` field only; structured UI arrives in the `final` event as one complete payload.
- own-profile enforcement remains soft: sanitize and preserve the answer where possible, and only fall back if sanitization empties the main reply.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt the API Docker image during verification**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** Dockerized pytest runs require the latest source tree in the `api` image; without rebuilds, verification can execute stale code.
- **Fix:** Rebuilt the `api` image before mandated Docker test runs.
- **Files modified:** none
- **Verification:** `docker compose run --rm api uv run pytest tests/test_coaching_endpoints.py tests/test_safety_hardening.py -q`
- **Committed in:** `2cf2025`, `d0d2ee3` (verification step only)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope change; the rebuild was required to make Docker-based verification reflect the implemented code.

## Issues Encountered
- Pre-existing Postgres migration warnings about legacy `user_id` references still appear during test startup. They remain out of scope for this plan and are already tracked in `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Frontend can now consume `/coaching/chat/stream` with a stable SSE contract.
- Streamed chat UI can rely on final-event structured payloads and does not need to reconstruct cards incrementally.
- Persona/history polish can build on message-level persona persistence while keeping the live-profile rewrite pass active in the backend.

## Self-Check: PASSED

- Found summary file: `.planning/phases/07-streaming-nice-to-have-polish/07-02-SUMMARY.md`
- Found task commit: `2cf2025`
- Found task commit: `d0d2ee3`
