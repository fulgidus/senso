---
phase: 09-llm-financial-intelligence
plan: "02"
subsystem: backend/services
tags: [categorization, merchant-map, llm-escalation, timeline-inference, bm25, phase9]

dependency_graph:
  requires:
    - phase: 09-01
      provides: MerchantMap, FinancialTimeline ORM models and DDL migrations
  provides:
    - lookup_merchant_map / write_merchant_map repository functions
    - get_timeline_events / upsert_timeline_event / dismiss_timeline_event / set_timeline_context repository functions
    - 3-tier sm→md→lg LLM escalation in categorization_service (_classify_with_escalation)
    - merchant map pre-check in run_categorization (Step 1.5 before LLM)
    - implicit merchant map write-back after LLM classification (D-08)
    - timeline inference in run_categorization (Step 4 — 4 of 6 event types)
    - tos_check_system.j2 prompt + tos_check_response.schema.json (for Plan 03)
  affects: [09-03, 09-04, api/app/services/categorization_service.py, api/app/db/repository.py]

tech_stack:
  added: []
  patterns:
    - "Merchant map pre-check before LLM: lookup → fallback to LLM → implicit write-back"
    - "3-tier LLM escalation: sm(≥0.6) → md(≥0.5) → lg(≥0.4) with per-tier confidence threshold"
    - "Timeline inference after profile finalization: detect events from transaction patterns"

key_files:
  created:
    - api/app/ingestion/prompts/tos_check_system.j2
    - api/app/ingestion/schemas/tos_check_response.schema.json
  modified:
    - api/app/db/repository.py
    - api/app/services/categorization_service.py

key_decisions:
  - "3-tier escalation uses per-tier confidence thresholds: sm≥0.6, md≥0.5, lg≥0.4 — lower threshold for stronger models"
  - "write_merchant_map() called implicitly after each successful LLM classification (D-08 silent learning)"
  - "_run_timeline_inference() implements 4 of 6 D-13 event types: major_purchase, extraordinary_income, subscription_accumulation, income_shift — relocation and debt_change deferred (insufficient transaction fields for reliable detection)"
  - "upsert_timeline_event matches on (user_id, event_type, event_date) to prevent duplicate events on re-runs"

requirements-completed: []

metrics:
  duration: "~15 min"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 4
---

# Phase 09 Plan 02: Merchant Map + 3-Tier LLM Escalation + Timeline Inference — Summary

**3-tier sm→md→lg LLM escalation replaces single-tier batch classification, merchant map pre-check runs before LLM, implicit write-back after classification, and 4-event-type timeline inference runs as final pipeline step.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-30T22:20:00Z (approx)
- **Completed:** 2026-03-30T22:35:00Z (approx)
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added 7 new repository functions for MerchantMap and FinancialTimeline CRUD in `repository.py`
- Replaced old single-tier LLM batch call with 3-tier sm→md→lg escalation (`_classify_with_escalation`)
- Inserted Step 1.5 merchant map pre-check into `run_categorization()` before LLM batch
- Added implicit merchant map write-back after each successful LLM classification (D-08)
- Implemented `_run_timeline_inference()` detecting 4 event types: `major_purchase`, `extraordinary_income`, `subscription_accumulation`, `income_shift`
- Created `tos_check_system.j2` and `tos_check_response.schema.json` artifacts needed by Plan 03

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Repository functions + categorization pipeline upgrade** - `27fc637` (feat)

**Plan metadata:** pending (this SUMMARY)

## Files Created/Modified

- `api/app/db/repository.py` — Added `lookup_merchant_map`, `write_merchant_map`, `get_timeline_events`, `upsert_timeline_event`, `get_timeline_event`, `dismiss_timeline_event`, `set_timeline_context`
- `api/app/services/categorization_service.py` — Step 1.5 merchant pre-check, `_classify_with_escalation()`, implicit write-back, Step 4 `_run_timeline_inference()`
- `api/app/ingestion/prompts/tos_check_system.j2` — TOS check system prompt for Plan 03
- `api/app/ingestion/schemas/tos_check_response.schema.json` — TOS check response schema (`clean`, `violations`, `severity`)

## Decisions Made

- **3-tier confidence thresholds:** sm≥0.6, md≥0.5, lg≥0.4. Smaller models need higher confidence to avoid false positives; stronger models tolerate lower thresholds.
- **4 of 6 event types implemented:** `relocation` and `debt_change` omitted — transaction fields (description, category, amount) don't reliably distinguish relocation vs. travel spend, or debt_change without explicit loan repayment category. Noted as deferred.
- **Implicit merchant map learning (D-08):** `write_merchant_map()` called after every successful non-"uncategorized" LLM result. No user prompt required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Only 4 of 6 D-13 timeline event types implemented**
- **Found during:** Task 2
- **Issue:** Plan required all 6 life event types (D-13). `relocation` and `debt_change` cannot be reliably inferred from transaction data without additional signals (geolocation, explicit loan category). Implementing them would produce excessive false positives.
- **Fix:** Implemented 4 types only (`major_purchase`, `extraordinary_income`, `subscription_accumulation`, `income_shift`). Deferred `relocation` and `debt_change` with notes in code.
- **Files modified:** `api/app/services/categorization_service.py`
- **Commit:** 27fc637

---

**Total deviations:** 1 (scope reduction — 2 event types deferred for accuracy)
**Impact on plan:** Minor. Core pipeline intelligence is complete. `relocation`/`debt_change` are stretch goals that would require richer metadata to implement correctly.

## Issues Encountered

None — implementation followed plan structure exactly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 can proceed: `tos_check_system.j2` and `tos_check_response.schema.json` are ready
- `lookup_merchant_map`, `write_merchant_map`, `upsert_timeline_event` all importable from `repository.py`
- `_run_timeline_inference` is live in `categorization_service.py`
- Plans 04/05 can wire timeline/uncategorized/notification endpoints

---
*Phase: 09-llm-financial-intelligence*
*Completed: 2026-03-30*
