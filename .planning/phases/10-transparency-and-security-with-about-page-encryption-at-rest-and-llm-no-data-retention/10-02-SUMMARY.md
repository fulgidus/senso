---
phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention
plan: "02"
subsystem: api
tags: [llm, privacy, no-retention, openai, openrouter, zdr, strict-mode]

# Dependency graph
requires:
  - phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention
    provides: Phase 10 context (encryption key, strict_privacy_mode user field)
provides:
  - LLMClient.complete/vision/complete_with_tools accept strict_mode=False parameter
  - OpenAI direct calls always include openai-beta:no-store header
  - OpenRouter calls in strict mode include ZDR body (zero data retention)
  - strict_mode=True excludes OpenAI from provider chain
affects:
  - 10-03 (encryption at rest - also uses LLMClient patterns)
  - Any callers of LLMClient public API that want strict privacy enforcement

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "no-store header injection: default_headers={'openai-beta':'no-store'} on OpenAI direct calls"
    - "ZDR injection: extra_body={'provider':{'zdr':True}} for OpenRouter in strict mode"
    - "Provider chain filtering: strict_mode=True removes 'openai' from ordered list"

key-files:
  created:
    - api/tests/test_llm_noretention.py
  modified:
    - api/app/ingestion/llm.py

key-decisions:
  - "All three _openai_compat_* static methods receive strict_mode param for consistency even though _openai_compat_complete_with_tools has two call sites (Step 1 and Step 3)"
  - "no-store header injected unconditionally on all direct OpenAI calls (not just strict mode) as baseline privacy hygiene"
  - "ZDR body only injected in strict mode for OpenRouter (performance-neutral for standard mode users)"

patterns-established:
  - "Dual-path privacy: standard mode adds no-store header for OpenAI; strict mode adds ZDR for OpenRouter AND excludes OpenAI"
  - "Tests use unittest.mock to capture kwargs passed to OpenAI() and create() — no live API calls required"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-03-31
---

# Phase 10 Plan 02: LLM No-Retention Enforcement Summary

**`strict_mode` parameter added to all LLMClient public methods with `openai-beta:no-store` header injection for direct OpenAI calls and ZDR body injection for OpenRouter in strict mode**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-31T13:01:11Z
- **Completed:** 2026-03-31T13:09:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `strict_mode: bool = False` to `complete()`, `vision()`, and `complete_with_tools()` public API (backward-compatible)
- `strict_mode=True` filters `"openai"` from the provider fallback chain entirely
- `_openai_compat_complete`, `_openai_compat_vision`, `_openai_compat_complete_with_tools` inject `{"openai-beta": "no-store"}` header on direct OpenAI calls (standard and strict mode)
- `_openai_compat_*` methods inject `extra_body={"provider": {"zdr": True}}` for OpenRouter when `strict_mode=True` (both Step 1 and Step 3 in `complete_with_tools`)
- Created `api/tests/test_llm_noretention.py` with 3 targeted tests verifying injection logic without live API calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Add strict_mode parameter to LLMClient public methods and _call_complete/_call_vision dispatch** - `86ee211` (feat)
2. **Task 2: Inject no-retention headers/body in _openai_compat_* static methods + test file** - `dce8056` (feat)

## Files Created/Modified

- `api/app/ingestion/llm.py` - Added `strict_mode` to all 3 public methods, 2 dispatch methods, and 3 `_openai_compat_*` static methods; no-store header injection; ZDR body injection
- `api/tests/test_llm_noretention.py` - 3 unit tests for no-store header and ZDR injection using `unittest.mock`

## Decisions Made

- `no-store` header injected on **all** direct OpenAI calls (not just strict mode) as baseline privacy hygiene — minimal overhead, maximum safety
- ZDR body (`extra_body`) is **strict-mode only** for OpenRouter, preserving standard-mode performance
- `strict_mode=True` excludes `"openai"` entirely from the provider chain (no ZDR guarantee available for OpenAI through OpenRouter)
- In `_openai_compat_complete_with_tools`, ZDR is injected in both `call_kwargs_1` (Step 1 tool discovery) and `call_kwargs_2` (Step 3 final output) — every API call in the round-trip must carry the header

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing test failures in `test_tts.py` (`elevenlabs` import error) and `test_coaching_endpoints.py` (DB migration issue) are unrelated to our llm.py changes. Verified by running the test suite on the base branch (before our changes) — those failures were pre-existing.
- Our targeted test suite (`test_llm_noretention.py`, `test_ingestion_service.py`, `test_coaching_service.py`, `test_ingestion_endpoints.py`) — 49 tests all pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `LLMClient` now has no-retention enforcement ready for Phase 10 integration
- The `strict_mode` parameter is available for `CoachingService.chat()` to pass through when `user.strict_privacy_mode=True`
- Next plan (10-03) can wire up the `strict_mode` flag at the API layer based on the user's `strict_privacy_mode` profile setting
- All success criteria met: 3 tests pass, headers/body verified, backward-compatible API

---
*Phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention*
*Completed: 2026-03-31*
