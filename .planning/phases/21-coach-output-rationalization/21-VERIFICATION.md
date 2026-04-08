---
status: pending
phase: "21"
---

# Phase 21 Verification - Coach Output Rationalization

## Must-Haves

| #   | Requirement                                                          | Status | Evidence |
| --- | -------------------------------------------------------------------- | ------ | -------- |
| 1   | Purchase intent classifier ≥90% accuracy on 20 labeled messages      | ⏳      |          |
| 2   | Informational questions never receive affordability_verdict          | ⏳      |          |
| 3   | Unconditional fallback card injection removed entirely               | ⏳      |          |
| 4   | content_cards capped at ≤2 per response                              | ⏳      |          |
| 5   | interactive_cards capped at ≤1 per response (reminder only)          | ⏳      |          |
| 6   | transaction_evidence capped at ≤5 rows                               | ⏳      |          |
| 7   | details_a2ui with <2 rows → null                                     | ⏳      |          |
| 8   | content_cards empty when search_content not called                   | ⏳      |          |
| 9   | Tool-usage SSE events emitted during streaming                       | ⏳      |          |
| 10  | Chat UI renders: verdict → message → evidence → goal → cards → details | ⏳      |          |
| 11  | Empty enrichment arrays render no container element                  | ⏳      |          |
| 12  | new_insight has no visible rendering (D-05)                          | ⏳      |          |
| 13  | details_a2ui shows only in STS mode with collapsed toggle            | ⏳      |          |
| 14  | Admin-tunable caps in Settings (env var overridable)                 | ⏳      |          |
| 15  | All i18n keys present in it.json and en.json                         | ⏳      |          |
| 16  | All pytest tests pass                                                | ⏳      |          |
| 17  | `pnpm build` clean                                                   | ⏳      |          |
