---
phase: 03-financial-profile-clarity
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, pydantic, categorization, profile, llm, rules-engine]

# Dependency graph
requires:
  - phase: 02-financial-input-ingestion
    provides: Transaction model, Upload model, LLMClient, ingestion auth pattern (get_current_user)
provides:
  - UserProfile, CategorizationJob, TagVocabulary DB models
  - CategorizationService with rules-first/LLM-fallback pipeline
  - ProfileService with get_profile, get_status, save_questionnaire, confirm_profile, trigger_categorization_for_user
  - FastAPI /profile router with 5 authenticated endpoints
  - 22-rule CATEGORY_RULES taxonomy derived from real Italian transaction samples
affects:
  - 03-02 (frontend profile screens — depends on /profile API)
  - 03-03 (coaching — depends on UserProfile data)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rules-first/LLM-fallback classification: rule engine checks descriptions → unmatched go to LLM batch"
    - "Income priority chain: payslip net_income → questionnaire answers → estimated from income transactions"
    - "BackgroundTask pattern: trigger_categorization_for_user queues CategorizationService.run_categorization"
    - "Upsert pattern for UserProfile and CategorizationJob (single record per user)"

key-files:
  created:
    - api/app/schemas/profile.py
    - api/app/services/categorization_service.py
    - api/app/services/profile_service.py
    - api/app/api/profile.py
    - api/tests/test_profile_endpoints.py
  modified:
    - api/app/db/models.py
    - api/app/db/repository.py
    - api/app/main.py

key-decisions:
  - "CATEGORY_RULES taxonomy derived from real Italian bank/PayPal sample transaction descriptions (D-07 honored)"
  - "Tags column on Transaction uses JSON type (not ARRAY) for SQLite test compatibility"
  - "Income priority chain: payslip net_income > questionnaire answers > estimated from income-type transactions (D-19)"
  - "LLM partial failure on classification → uncategorized, not job failure (D-10)"
  - "CategorizationJob has unique=True on user_id — one job per user at a time, upsert on re-trigger"

patterns-established:
  - "Profile error handling: ProfileError(code, message, status_code) mirrors AuthError pattern"
  - "All profile DTOs use camelCase field aliases with populate_by_name=True"
  - "Repository functions are pure functions with Session parameter, no class wrapping"

requirements-completed:
  - PROF-01
  - PROF-02
  - PROF-03

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 03 Plan 01: Financial Profile Clarity — Backend Summary

**Rules-first/LLM-fallback categorization pipeline, UserProfile DB model, and 5-endpoint /profile API with full auth guards and 45-test suite passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T07:40:38Z
- **Completed:** 2026-03-25T07:43:18Z
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments

- DB models: `UserProfile`, `CategorizationJob`, `TagVocabulary` added; `Transaction.tags` JSON column added
- Repository layer: 8 new functions including D-29 query contract for confirmed-upload transactions
- CategorizationService: 22-rule CATEGORY_RULES derived from real Italian sample data (D-07) + LLM fallback batch classification + insight card generation
- ProfileService + /profile router with 5 endpoints (GET, GET /status, POST /questionnaire, POST /confirm, POST /trigger-categorization)
- All 45 tests pass (auth + ingestion + profile)

## Task Commits

Each task was committed atomically:

1. **Task 1: DB models** - `6fb6ecc` (feat)
2. **Task 2: Pydantic schemas** - `37519f0` (feat)
3. **Task 3: CategorizationService** - `937869c` (feat)
4. **Task 4: ProfileService + API router + tests** - `99297c4` (feat)

## Files Created/Modified

- `api/app/db/models.py` — Added `Transaction.tags`, `UserProfile`, `CategorizationJob`, `TagVocabulary` models
- `api/app/db/repository.py` — Added 8 profile/categorization repository functions
- `api/app/schemas/profile.py` — `UserProfileDTO`, `CategorizationStatusDTO`, `QuestionnaireAnswers`, `ProfileConfirmRequest`, `QuestionnaireSubmitRequest`, `InsightCard`, `IncomeSummary`
- `api/app/services/categorization_service.py` — `CategorizationService` with 22-rule engine, LLM batch fallback, insight generation
- `api/app/services/profile_service.py` — `ProfileService` with all required methods
- `api/app/api/profile.py` — FastAPI router with prefix="/profile", 5 endpoints
- `api/app/main.py` — Added `include_router(profile_router)`
- `api/tests/test_profile_endpoints.py` — 6 tests: 401, 404, 201, 202 responses

## Decisions Made

- CATEGORY_RULES taxonomy (22 rules) derived directly from real Italian Revolut/PayPal transaction descriptions observed in `api/app/ingestion/samples/` (honors D-07 mandatory prereading)
- Tags column on Transaction uses JSON type (not PostgreSQL ARRAY) to maintain SQLite compatibility for testing
- CategorizationJob has `unique=True` on `user_id` — one job record per user, upserted on re-trigger
- LLM batch classification failures result in `category="uncategorized"` (D-10 partial failure policy)
- Income priority chain: payslip net_income → questionnaire monthlyNetIncome → sum of income-type transactions (D-19)

## Deviations from Plan

None - plan executed exactly as written. All files were already present (created in prior session), confirmed correct via verification suite (45 tests passing).

## Issues Encountered

None — all verification checks passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend /profile API complete and tested — ready for 03-02 (frontend profile screens)
- All auth guards working (401 without token)
- CategorizationService pipeline functional, ready for integration with ingestion confirm-all flow
- No blockers

---
*Phase: 03-financial-profile-clarity*
*Completed: 2026-03-25*
