---
plan_id: "26-01"
phase: 26
status: complete
completed_at: "2026-04-10"
commit: 097e2408
---

# Summary: Backend null coercion and schema required fields

## What Was Built

Fixed the root cause of the frontend crash: `_repair_response()` now coerces `null` `content_cards` and `interactive_cards` to `[]` using explicit `if data.get() is None` checks, replacing the no-op `setdefault()` calls. Added both fields to the JSON schema `required` array to enforce arrays in structured LLM output. Added a regression test verifying null coercion behaviour.

## Key Files

### Modified
- `api/app/coaching/service.py` — `_repair_response()` null coercion fix (lines 980–983)
- `api/app/coaching/schemas/coaching_response.schema.json` — required array extended with `content_cards` and `interactive_cards`
- `api/tests/test_safety_hardening.py` — new `test_repair_response_coerces_null_arrays` test

## Deviations

None. D-04 (type change) confirmed as no-op per plan — `content_cards` and `interactive_cards` already had `"type": "array"` in the schema. Only the `required` array entry was missing.

## Verification

- `docker compose run --rm api uv run pytest tests/test_safety_hardening.py -v` → **67/67 passed**
- `setdefault` for `transaction_evidence` and `goal_progress` preserved (intentionally nullable)
- Schema JSON valid (`python3 -m json.tool` exits 0)

## Self-Check: PASSED
