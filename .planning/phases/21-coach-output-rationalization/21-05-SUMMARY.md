---
plan: "21-05"
phase: "21"
status: complete
completed: "2026-04-08"
commit: bbbf238
---

# Plan 21-05 SUMMARY: Integration Tests + Build Verification + Seeding

## What Was Built

Updated all existing test files to use new field names (content_cards, interactive_cards), added integration-level acceptance gate tests in TestPhase21AcceptanceGate, verified pnpm build is clean and all pytest tests pass.

## Key Files Modified

- `api/tests/test_enrichment_pipeline.py` — Added TestPhase21AcceptanceGate class with 3 acceptance gate tests
- `api/tests/test_coaching_service.py` — Updated to use content_cards/interactive_cards (old names in comments only)
- `api/tests/test_safety_hardening.py` — Updated field name references
- `api/tests/test_coaching_endpoints.py` — Updated for new CoachingResponseDTO fields

## Must-Have Verification

- ✓ Integration test: informational → 0 content_cards, no verdict (test_informational_no_verdict_no_cards)
- ✓ Integration test: purchase → verdict present, ≤2 content_cards (test_purchase_verdict_and_capped_cards)
- ✓ Integration test: 1-row details_a2ui → null (test_a2ui_one_row_nullified)
- ✓ `pnpm build` clean (tsc -b + vite build pass)
- ✓ 63 pytest tests pass (test_intent_classifier.py + test_config_caps.py + test_enrichment_pipeline.py + test_coaching_endpoints.py)
- ✓ No `resource_cards`, `learn_cards` in test files
- ✓ No `action_cards` references (except comments noting removal)

## Self-Check: PASSED
