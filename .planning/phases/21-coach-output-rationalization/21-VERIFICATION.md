---
status: passed
phase: "21"
verified: "2026-04-08"
---

# Phase 21 Verification - Coach Output Rationalization

## Must-Haves

| #   | Requirement                                                          | Status | Evidence |
| --- | -------------------------------------------------------------------- | ------ | -------- |
| 1   | Purchase intent classifier ≥90% accuracy on 20 labeled messages      | ✓      | test_accuracy_threshold: 100% (23 tests pass) |
| 2   | Informational questions never receive affordability_verdict          | ✓      | test_verdict_nullified_on_informational_question passes |
| 3   | Unconditional fallback card injection removed entirely               | ✓      | `grep -c "_inject_fallback_cards" service.py` = 0 |
| 4   | content_cards capped at ≤2 per response                              | ✓      | _gate_enrichments caps via settings.coaching_cap_content_cards=2 |
| 5   | interactive_cards capped at ≤1 per response (reminder only)          | ✓      | schema enum: ["reminder"], cap=1 |
| 6   | transaction_evidence capped at ≤5 rows                               | ✓      | test_evidence_rows_capped_at_five passes |
| 7   | details_a2ui with <2 rows → null                                     | ✓      | _validate_a2ui(), test_strips_panel_with_one_row passes |
| 8   | content_cards empty when search_content not called                   | ✓      | test_content_cards_stripped_without_search_content passes |
| 9   | Tool-usage SSE events emitted during streaming                       | ✓      | threading+queue in /chat/stream, tool_use + tools_complete events |
| 10  | Chat UI renders: verdict → message → evidence → goal → cards → details | ✓      | AssistantBubble rendering hierarchy updated |
| 11  | Empty enrichment arrays render no container element                  | ✓      | `{resp.content_cards.length > 0 && ...}` conditional rendering |
| 12  | new_insight has no visible rendering (D-05)                          | ✓      | No new_insight render code in AssistantBubble |
| 13  | details_a2ui shows only in STS mode with collapsed toggle            | ✓      | DetailsToggle with `isStsMode` gate, collapsed default |
| 14  | Admin-tunable caps in Settings (env var overridable)                 | ✓      | COACHING_CAP_* env vars, test_custom_caps passes |
| 15  | All i18n keys present in it.json and en.json                         | ✓      | showDetails, toolUsage.*, evidence.*, cardType.* in both locales |
| 16  | All pytest tests pass                                                | ✓      | 63 tests pass: intent(23) + caps(2) + enrichment(15) + endpoints(22) |
| 17  | `pnpm build` clean                                                   | ✓      | tsc -b + vite build exit 0, no type errors |

## Score: 17/17 must-haves verified

## Test Evidence

```
tests/test_intent_classifier.py — 23 passed
tests/test_config_caps.py — 2 passed
tests/test_enrichment_pipeline.py — 15 passed (including TestPhase21AcceptanceGate)
tests/test_coaching_endpoints.py — 22 passed (including streaming SSE test)
pnpm build — clean (exit 0)
```

## Human Verification Items

None - all requirements are automatically verifiable.
