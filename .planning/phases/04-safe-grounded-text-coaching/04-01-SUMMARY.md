---
phase: 04-safe-grounded-text-coaching
plan: "01"
subsystem: coaching-backend-core
tags: [coaching, safety, llm, jinja2, jsonschema, sqlalchemy]
dependency_graph:
  requires: [03-01]
  provides: [CoachingService, SafetyScanner, check_coaching_input, ChatSession, ChatMessage, coaching-schemas, prompt-templates]
  affects: [04-02, 04-03, 04-04]
tech_stack:
  added: [jinja2==3.1.6, jsonschema==4.26.0, pyyaml]
  patterns: [composable-jinja2-prompts, jsonschema-output-validation, safety-scanner-pattern, stateful-db-models]
key_files:
  created:
    - api/app/coaching/__init__.py
    - api/app/coaching/schemas/coaching_response.schema.json
    - api/app/coaching/schemas/coaching_simple_response.schema.json
    - api/app/coaching/schemas/capabilities.schema.json
    - api/app/coaching/prompts/system_base.j2
    - api/app/coaching/prompts/context_block.j2
    - api/app/coaching/prompts/response_format.j2
    - api/app/coaching/safety.py
    - api/app/coaching/service.py
    - api/tests/test_coaching_service.py
  modified:
    - api/app/ingestion/guardrail.py
    - api/app/db/models.py
    - api/app/personas/hard-boundaries.yml
    - api/pyproject.toml
decisions:
  - "D-02: JSONSchema files at api/app/coaching/schemas/ as standalone files, loaded at init time"
  - "D-03: Jinja2 templates in api/app/coaching/prompts/, no hardcoded prompt strings"
  - "D-06: own_pii_unsolicited group has no patterns[] in hard-boundaries.yml — SafetyScanner skips pattern-less groups in Phase 4"
  - "D-07: 3-layer safety: check_coaching_input (input guard) + system prompt persona boundaries + SafetyScanner output scan"
  - "D-09: ChatSession/ChatMessage DB models added to models.py; session persistence wired at API layer (Plan 04-02)"
  - "D-10: jsonschema.validate() on every LLM response before returning; _repair_response() fallback for partial violations"
  - "chat() uses messages: list[dict] (stateless history injection); DB session creation wired in 04-02 endpoints"
metrics:
  duration: "7 minutes"
  completed_at: "2026-03-28"
  tasks_completed: 6
  files_created: 10
  files_modified: 4
  tests_added: 25
  tests_passing: 25
---

# Phase 04 Plan 01: Coaching Service Backend Core Summary

**One-liner:** Composable Jinja2 prompt system + JSONSchema LLM output validation + 3-layer SafetyScanner + ChatSession/ChatMessage DB models — full coaching backend core.

## What Was Built

This plan creates every reusable building block for the S.E.N.S.O. text coaching pipeline:

1. **3 JSONSchema files** in `api/app/coaching/schemas/` define the LLM output contracts — `coaching_response.schema.json` (colloquial mode), `coaching_simple_response.schema.json` (machine mode), `capabilities.schema.json` (capability shapes for LLM reference).

2. **3 Jinja2 templates** in `api/app/coaching/prompts/` — `system_base.j2` injects ethos+soul+boundaries+allowlist+locale, `context_block.j2` structures user financial numbers, `response_format.j2` injects the output schema instruction. All templates render correctly for both `it` and `en` locales.

3. **`SafetyScanner`** in `api/app/coaching/safety.py` — loads `hard-boundaries.yml` at init, compiles patterns in severity order (hard_ban first), implements `scan_input`/`scan_output` with proper severity semantics. `own_pii_unsolicited` group (no patterns in Phase 4) is gracefully skipped.

4. **`check_coaching_input()`** in `api/app/ingestion/guardrail.py` — thin wrapper around `SafetyScanner.scan_input()`, follows `check_hint_safety()` tuple return pattern, never blocks on scanner error.

5. **`ChatSession` and `ChatMessage` SQLAlchemy models** appended to `api/app/db/models.py` with proper FK relationships and cascade deletes. `User.chat_sessions` relationship added.

6. **`CoachingService`** in `api/app/coaching/service.py` — `chat(user_id, messages, locale, persona_id)` method that renders templates, calls LLM, validates schema, scans output. `CoachingError` exception class for structured error handling.

7. **25 unit tests** in `api/tests/test_coaching_service.py` — all passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing Python dependencies**
- **Found during:** Task 2 verification
- **Issue:** `jinja2`, `jsonschema`, `pyyaml` not in `pyproject.toml` — `ModuleNotFoundError` blocked all verification
- **Fix:** Added via `uv add jinja2 jsonschema pyyaml`
- **Files modified:** `api/pyproject.toml`, `api/uv.lock`
- **Commit:** b0df535

**2. [Rule 1 - Bug] Fixed `hard-boundaries.yml` pattern quantifier bug**
- **Found during:** Task 3 verification
- **Issue:** Patterns `ignore (all |previous |...)?` used `?` (zero or one) for optional modifiers, causing `ignore all previous instructions` (two modifiers) to not match
- **Fix:** Changed `?` → `*` on `ignore` and `disregard` patterns (line 45-46) — allows zero or more modifiers
- **Files modified:** `api/app/personas/hard-boundaries.yml`
- **Commit:** b414c8d

**3. [Design] Stateful session persistence deferred to Plan 04-02**
- **Context:** The "stateful chat amendment" in the plan key context specified `chat(user_id, message_content, locale, persona_id, session_id=None) → tuple[dict, ChatSession]`
- **Conflict:** The plan's Task 5 action block and Task 6 test code both use `chat(user_id, messages: list[dict], ...)` (stateless/stateful agnostic)
- **Resolution:** Implemented the `messages: list[dict]` signature matching the test assertions. `ChatSession`/`ChatMessage` DB models are created (Task 4b) and ready for Plan 04-02 endpoints to wire session persistence. This is consistent with how prior phases wired DB models separately from service logic.

## Known Stubs

None — all functionality implemented as specified. No placeholder data flows to UI rendering in this plan (backend-only).

## Self-Check

### PASSED

**Files verified:**
- ✅ api/app/coaching/__init__.py
- ✅ api/app/coaching/safety.py
- ✅ api/app/coaching/service.py
- ✅ api/app/coaching/schemas/coaching_response.schema.json
- ✅ api/app/coaching/schemas/coaching_simple_response.schema.json
- ✅ api/app/coaching/schemas/capabilities.schema.json
- ✅ api/app/coaching/prompts/system_base.j2
- ✅ api/app/coaching/prompts/context_block.j2
- ✅ api/app/coaching/prompts/response_format.j2
- ✅ api/tests/test_coaching_service.py

**Commits verified:**
- ✅ b912fb9: feat(04-01): add coaching package and JSONSchema output definitions
- ✅ b0df535: feat(04-01): add Jinja2 composable prompt templates for coaching
- ✅ b414c8d: feat(04-01): implement SafetyScanner with hard-boundaries.yml pattern matching
- ✅ 4737ea2: feat(04-01): extend guardrail.py with check_coaching_input()
- ✅ 309eded: feat(04-01): add ChatSession and ChatMessage SQLAlchemy models
- ✅ a154cf0: feat(04-01): implement CoachingService with chat() method
- ✅ bb8fd49: test(04-01): add comprehensive unit tests for coaching service core

**Test results:** 25/25 passed (5.14s), 0 failures, 0 errors
