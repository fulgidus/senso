---
phase: 26
phase_name: enriched-coach-messages-rendering-fix-backend-response-format-null-issue
status: passed
verified_at: "2026-04-10"
---

# Phase 26 Verification

## Must-Haves

| # | Check | Status |
|---|-------|--------|
| 1 | `pytest tests/test_safety_hardening.py` exits 0 (67/67 green) | ✓ |
| 2 | `if data.get("content_cards") is None` guard present in service.py | ✓ |
| 3 | No `setdefault` for content_cards or interactive_cards | ✓ |
| 4 | Schema required array contains content_cards and interactive_cards | ✓ |
| 5 | `pnpm build` exits 0 — no TypeScript errors | ✓ |
| 6 | `resp.content_cards.length` and `resp.interactive_cards.length` removed | ✓ |
| 7 | `(resp.content_cards ?? []).length` and `(resp.interactive_cards ?? []).length` present | ✓ |
| 8 | `parsed.content_cards ??= []` and `parsed.interactive_cards ??= []` in parseStoredMessage | ✓ |

## Summary

Phase 26 closes the null-crash bug in full:

**Backend (26-01):** `_repair_response()` previously used `setdefault()` which is a no-op when the key exists with `None`. Replaced with explicit `is None` checks. Schema `required` array updated to include array fields to enforce arrays in structured LLM output. Regression test added and passing.

**Frontend (26-02):** Belt-and-suspenders null safety added: live API responses guarded with `?? []` before `.length` access; stored history messages normalized with `??=` after JSON.parse to prevent replay crashes from pre-fix null values.

## Requirements Coverage

- D-01 ✓ null coercion in _repair_response
- D-02 ✓ guards against key-present-with-None
- D-03 ✓ backend fix committed
- D-04 ✓ schema type already array (no-op confirmed)
- D-05 ✓ AssistantBubble null-safe render
- D-06 ✓ parseStoredMessage normalization
- D-07 ✓ TypeScript build clean
- D-08 ✓ schema required array extended
