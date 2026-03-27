---
phase: 04-safe-grounded-text-coaching
plan: "02"
subsystem: backend-api
tags:
  - fastapi
  - coaching
  - session-management
  - pydantic
  - integration-tests
dependency_graph:
  requires:
    - 04-01 (CoachingService, SafetyScanner, ChatSession/ChatMessage models)
    - 03-01 (ProfileService, ProfileError)
  provides:
    - POST /coaching/chat HTTP endpoint
    - GET /coaching/sessions HTTP endpoint
    - GET /coaching/sessions/{id}/messages HTTP endpoint
    - GET /coaching/personas HTTP endpoint
  affects:
    - 04-03 (frontend coaching screen — consumes these endpoints)
tech_stack:
  added: []
  patterns:
    - "API layer owns session DB persistence; CoachingService stays stateless (messages:list[dict])"
    - "Safety gate (check_coaching_input) before any service call"
    - "ProfileError → HTTP 422 profile_required; CoachingError → HTTP status from exc.status_code"
key_files:
  created:
    - api/app/schemas/coaching.py
    - api/app/api/coaching.py
    - api/tests/test_coaching_endpoints.py
  modified:
    - api/app/main.py
decisions:
  - "API layer wires session persistence: load prior messages from DB, call CoachingService.chat(messages=list[dict]), persist user+assistant messages after response"
  - "session_id in POST /chat body: None → create new ChatSession; provided → load and continue existing session"
  - "CoachingService.chat() takes messages:list[dict] (stateless per 04-01 design); API layer builds the list from DB history"
  - "GET /personas filters to available=true only from config.json"
metrics:
  duration: "4 min"
  completed_date: "2026-03-27"
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Phase 4 Plan 02: Coaching API Endpoints Summary

**One-liner:** FastAPI coaching router with stateful chat, session CRUD, persona listing, and full safety/auth gates wired to CoachingService.

## What Was Built

Three tasks executed exactly as planned:

1. **Pydantic schemas** (`api/app/schemas/coaching.py`): `ChatRequest`, `CoachingResponseDTO` (with required `session_id`), `SessionSummaryDTO`, `ChatMessageDTO`, `PersonaDTO`, and all nested card types.

2. **FastAPI coaching router** (`api/app/api/coaching.py`): Four endpoints under `/coaching` prefix:
   - `POST /chat` — auth guard → safety gate → session load/create → CoachingService.chat() → persist messages → return CoachingResponseDTO with session_id
   - `GET /sessions` — list user's sessions with message counts and assistant preview
   - `GET /sessions/{id}/messages` — full ordered message history, 404 on missing/wrong-user
   - `GET /personas` — available personas from config.json

3. **main.py wiring** (`api/app/main.py`): coaching router imported and registered.

4. **Integration tests** (`api/tests/test_coaching_endpoints.py`): 20 tests covering all 15+ plan scenarios.

## Architecture Note

The key design: `CoachingService.chat()` is **stateless** (takes `messages: list[dict]`). The API layer owns session persistence:
- Loads prior `ChatMessage` rows from DB
- Builds the `messages` list (prior history + new user message)
- Calls `service.chat(user_id, messages, locale, persona_id)`
- Persists user message + assistant response to DB after success

## Test Results

```
20 passed in tests/test_coaching_endpoints.py
45 passed in tests/test_coaching_endpoints.py + tests/test_coaching_service.py
89 passed in full suite, 1 pre-existing failure (out of scope)
```

Pre-existing failure: `test_coaching_service.py::TestPromptTemplates::test_context_block_handles_missing_income` — template doesn't include "non disponibile" text. This was already failing in Plan 04-01 scope; deferred to 04-04 boundary testing.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one adaptation:

**Adaptation: CoachingService.chat() signature mismatch**
- **Found during:** Task 2 (reading service.py)
- **Issue:** Plan interface spec said `chat(user_id, message_content: str, ...)` but actual 04-01 implementation is `chat(user_id, messages: list[dict], ...)` — the API layer owns session persistence
- **Fix:** Implemented API-layer session management correctly: load DB history → build messages list → call service with full list → persist after response
- **Status:** Correct per STATE.md decision D-04 entry: "CoachingService uses messages:list[dict] (stateless) for chat() — DB session persistence wired at API layer in 04-02"

## Known Stubs

None. All endpoints are fully wired with real DB persistence and safety gates. Persona cards (action/resource/learn) are returned as-is from LLM output without filtering — full card rendering is Phase 6.

## Commits

- `450bd8e` — feat(04-02): add Pydantic schemas for coaching API
- `ba38898` — feat(04-02): add coaching API router and register in main.py
- `1264cd5` — test(04-02): add integration tests for coaching endpoints

## Self-Check: PASSED
