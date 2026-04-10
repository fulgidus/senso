# Phase 26: Enriched coach messages rendering fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 26-enriched-coach-messages-rendering-fix-backend-response-format-null-issue
**Session type:** Context update (prior CONTEXT.md revised)
**Areas discussed:** Coercion condition, Schema null type, Regression test, Other frontend fields

---

## Coercion condition

| Option | Description | Selected |
|--------|-------------|----------|
| `is None` check | More precise — only fixes null, won't touch valid empty arrays `[]` | ✓ |
| `if not get()` | Simpler, harmless idempotent overwrite on empty arrays, common Python falsy convention | |

**User's choice:** `is None` check
**Notes:** Intentional precision — `[]` is a valid LLM response meaning "no cards". Overwriting it is harmless but semantically wrong. `is None` is the correct gate.

---

## Schema null type

| Option | Description | Selected |
|--------|-------------|----------|
| Strict array | Remove `null` from type union + add to `required[]`. Belt + suspenders, most reliable for OpenAI structured outputs | ✓ |
| Keep nullable | Just add to `required[]`, rely on backend `is None` coercion as safety net | |

**User's choice:** Strict array
**Notes:** OpenAI structured outputs with `additionalProperties: false` can behave inconsistently with nullable array types. Making the type strictly `"array"` removes ambiguity at the prompt level. Backend coercion (D-01) remains as a safety net for any edge cases.

---

## Regression test

| Option | Description | Selected |
|--------|-------------|----------|
| Required backend test | pytest in `api/tests/` — confirms null `content_cards` coerces to `[]` | ✓ |
| Required frontend test | vitest — confirms `parseStoredMessage` normalizes null fields | |
| Both | Backend + frontend regression tests required | |
| Agent discretion | Not worth adding as required task | |

**User's choice:** Required backend test
**Notes:** pytest covers the root-cause code path. Frontend normalization (D-07) is simple enough that a test is not required.

---

## Other frontend fields

| Option | Description | Selected |
|--------|-------------|----------|
| No changes needed | Existing `&&` guards are null-safe for `details_a2ui`, `affordability_verdict`, etc. | |
| Add `??=` in parseStoredMessage for all array fields | Belt + suspenders for history, future-proofs against new array fields | ✓ |

**User's choice:** Add `??=` normalization for all array fields in `parseStoredMessage`
**Notes:** Current code review confirmed `details_a2ui`, `affordability_verdict`, `transaction_evidence`, `goal_progress` are already null-safe via `&&` short-circuit in `AssistantBubble`. The `??=` additions are scoped to `parseStoredMessage` only, for history message normalization.

---

## Agent's Discretion

None — all four areas were locked down with explicit decisions.

## Deferred Ideas

- Full `response_payload` column for lossless history restore — separate phase
- D-09 gating tuning (search_content must-call before showing cards) — separate product decision
