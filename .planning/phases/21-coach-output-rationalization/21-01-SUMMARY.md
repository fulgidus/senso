---
plan: "21-01"
phase: "21"
status: complete
completed: "2026-04-08"
commit: bbbf238
---

# Plan 21-01 SUMMARY: Response Schema Redesign + Admin Config + Intent Classifier

## What Was Built

Rewrote the coaching response JSON schema, added admin-tunable enrichment caps to Settings, and implemented a lightweight regex-based purchase intent classifier.

## Key Files Created/Modified

- `api/app/coaching/schemas/coaching_response.schema.json` — Unified schema with `content_cards` (replacing `resource_cards`+`learn_cards`), `interactive_cards` (replacing `action_cards`, reminder-only), new `transaction_evidence` and `goal_progress` surfaces
- `api/app/core/config.py` — Added `coaching_cap_content_cards`, `coaching_cap_interactive_cards`, `coaching_cap_evidence_rows`, `coaching_cap_goal_progress`, `tool_usage_granularity` fields
- `api/app/coaching/intent.py` — `classify_purchase_intent()` with 11 Italian + 7 English patterns + 4 informational override patterns
- `api/tests/test_intent_classifier.py` — 23 tests, 100% accuracy on 20 labeled messages
- `api/tests/test_config_caps.py` — 2 tests for default/custom cap loading

## Must-Have Verification

- ✓ `content_cards` with `maxItems: 2` in schema
- ✓ `interactive_cards` with `enum: ["reminder"]` in schema
- ✓ `transaction_evidence` with `maxItems: 5` in schema
- ✓ `goal_progress` with `estimated_pct` in schema
- ✓ No `resource_cards`, `learn_cards`, `action_cards` in schema
- ✓ `additionalProperties: false` at schema root
- ✓ All 5 cap fields in Settings with correct defaults
- ✓ 100% accuracy on 20 labeled messages (≥90% threshold met)
- ✓ All new tests pass in Docker

## Self-Check: PASSED
