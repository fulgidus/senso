---
phase: 05-voice-coaching-loop
plan: 02
subsystem: api
tags: [a2ui, coaching, voice, jsonl, jinja2, pydantic, typescript]

# Dependency graph
requires:
  - phase: 04-safe-text-coaching
    provides: CoachingService, CoachingResponseDTO, response_format.j2, coaching_response.schema.json
provides:
  - Updated coaching_response.schema.json with optional details_a2ui field
  - CoachingResponseDTO with details_a2ui: Optional[str] = None
  - a2ui_reference.j2 A2UI component reference for LLM prompt injection
  - Voice-optimised response_format.j2 with dual-channel instructions
  - CoachingResponse TypeScript interface with details_a2ui?: string | null
affects: [05-03, 05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-channel LLM response: voice-optimised message + A2UI JSONL details_a2ui"
    - "Jinja2 template composition: a2ui_reference.j2 injected into response_format.j2 at render time"
    - "Schema-first approach: JSON schema, Pydantic DTO, TypeScript interface all updated in lockstep"

key-files:
  created:
    - api/app/coaching/prompts/a2ui_reference.j2
  modified:
    - api/app/coaching/schemas/coaching_response.schema.json
    - api/app/coaching/prompts/response_format.j2
    - api/app/coaching/service.py
    - api/app/schemas/coaching.py
    - senso/src/features/coaching/coachingApi.ts

key-decisions:
  - "details_a2ui placed after learn_cards in DTO to maintain backwards compat field ordering"
  - "a2ui_reference.j2 loaded once at CoachingService init time and injected via _render_response_format()"
  - "voice-optimised message rules explicitly list 'NO exact decimal numbers', 'NO acronyms', 'NO bullet lists' for LLM compliance"

patterns-established:
  - "Dual-channel response: message field is voice layer, details_a2ui is visual/detail layer"
  - "A2UI JSONL injected as string field - backend passes through opaque string, no A2UI dependency in Python"

requirements-completed: [COCH-02]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 5 Plan 02: Dual-Channel LLM Response Shape Summary

**Updated coaching JSON schema, Pydantic DTO, and TypeScript interface to support dual-channel output: voice-optimised `message` + nullable `details_a2ui` A2UI JSONL; added voice-optimised prompt instructions and A2UI component reference template.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T15:02:01Z
- **Completed:** 2026-03-28T15:08:06Z
- **Tasks:** 2
- **Files modified:** 6 (4 modified, 1 created, 1 created template)

## Accomplishments
- Added `details_a2ui: { type: ["string", "null"] }` to `coaching_response.schema.json` (optional, not in required)
- Added `details_a2ui: Optional[str] = None` to `CoachingResponseDTO` after `learn_cards`
- Added `"details_a2ui": None` to `_BLOCKED_RESPONSE_TEMPLATE` for consistent response shape
- Added `details_a2ui?: string | null` to `CoachingResponse` TypeScript interface
- Created `a2ui_reference.j2` with A2UI protocol reference (surfaceUpdate/dataModelUpdate/beginRendering) and financial breakdown example
- Updated `response_format.j2` with explicit voice-optimised `message` rules (no decimals, no acronyms, no bullet lists, 3-4 sentences) and `details_a2ui` instructions
- `CoachingService` loads `a2ui_reference.j2` at init and injects it into `response_format.j2` render

## Task Commits

Each task was committed atomically:

1. **Task 1: Update JSON schema + Pydantic DTO + TypeScript interface** - `e5c445c` (feat)
2. **Task 2: A2UI reference file + voice-optimised prompt update** - `2194719` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `api/app/coaching/schemas/coaching_response.schema.json` - Added optional `details_a2ui` field
- `api/app/schemas/coaching.py` - Added `details_a2ui: Optional[str] = None` to `CoachingResponseDTO`
- `api/app/coaching/service.py` - Added `_a2ui_reference` loading at init; injected into `_render_response_format()`; added `"details_a2ui": None` to `_BLOCKED_RESPONSE_TEMPLATE`
- `senso/src/features/coaching/coachingApi.ts` - Added `details_a2ui?: string | null` to `CoachingResponse` interface
- `api/app/coaching/prompts/a2ui_reference.j2` - New A2UI component reference template
- `api/app/coaching/prompts/response_format.j2` - Rewrote field descriptions with voice-optimised message rules and A2UI instructions

## Decisions Made
- `details_a2ui` placed after `learn_cards` in the DTO (before `session_id`) to keep backwards-compatible field ordering for existing clients
- `a2ui_reference.j2` rendered once at `CoachingService.__init__()` (not per-request) to avoid repeated file I/O
- Template injection uses `{{ a2ui_reference }}` variable in `response_format.j2` - the Jinja2 include approach was considered but variable injection is cleaner since `a2ui_reference.j2` is a static reference (no looping/conditionals)
- Voice-optimised rules explicitly enumerate forbidden patterns ("NO exact decimal numbers", "NO acronyms", "NO bullet lists") to maximize LLM compliance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `test_coaching_endpoints.py` has 3 pre-existing SQLite table teardown failures (introduced by other parallel plan agents, pre-existing before this plan's changes). All coaching service tests (25/25) pass cleanly. These failures are out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dual-channel data contract is fully established - `details_a2ui` flows through backend as opaque string
- Frontend `CoachingResponse` interface is ready for A2UI renderer (05-03)
- Backend TTS endpoint (05-01) can read `message` field knowing it's voice-optimised
- Ready for 05-03 (A2UI renderer) and 05-05 (frontend TTS wiring)

---
*Phase: 05-voice-coaching-loop*
*Completed: 2026-03-28*
