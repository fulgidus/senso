---
plan: "21-03"
phase: "21"
status: complete
completed: "2026-04-08"
commit: bbbf238
---

# Plan 21-03 SUMMARY: Service Enrichment Pipeline Rewrite + Prompt Updates

## What Was Built

Rewrote the coaching service enrichment pipeline: deleted `_inject_fallback_cards()`, updated `_repair_response()` for new field names, added `_gate_enrichments()` with full conditional gating and caps, added `_validate_a2ui()` quality gate. Updated Jinja2 prompt templates.

## Key Files Modified

- `api/app/coaching/service.py` — Deleted `_inject_fallback_cards()`, rewrote `_repair_response()`, added `_gate_enrichments()` and `_validate_a2ui()`, `_tool_executor()` returns (fn, set) tuple, `tools_called` tracking
- `api/app/coaching/prompts/response_format.j2` — References `content_cards`, `interactive_cards`, `transaction_evidence`, `goal_progress`, updated tool instructions
- `api/app/coaching/prompts/system_base.j2` — Updated tool descriptions for new schema
- `api/tests/test_enrichment_pipeline.py` — 15 tests covering all gating scenarios and acceptance gate

## Must-Have Verification

- ✓ `_inject_fallback_cards` completely removed (0 occurrences)
- ✓ `_repair_response` uses `content_cards` / `interactive_cards` / `transaction_evidence` / `goal_progress`
- ✓ Caps applied: content_cards ≤ 2, interactive_cards ≤ 1, evidence rows ≤ 5
- ✓ `content_cards` empty if `search_content` not in tools_called
- ✓ `transaction_evidence` null if `search_user_transactions` not in tools_called
- ✓ `affordability_verdict` nullified on non-purchase intent
- ✓ `details_a2ui` stripped if < 2 data rows
- ✓ All 15 enrichment pipeline tests pass

## Self-Check: PASSED
