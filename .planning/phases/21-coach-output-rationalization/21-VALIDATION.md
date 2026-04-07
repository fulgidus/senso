---
phase: "21"
slug: coach-output-rationalization
status: draft
nyquist_compliant: false
created: "2026-04-06"
---

# Phase 21 - Validation Strategy

## Per-Plan Test Map

| Plan  | Test                                                             | What it guards                        |
| ----- | ---------------------------------------------------------------- | ------------------------------------- |
| 21-01 | `test_coaching_service.py::test_purchase_intent_classifier`      | 20 labeled messages, ≥90% accuracy    |
| 21-01 | `test_coaching_service.py::test_no_verdict_on_informational`     | Non-purchase Q → verdict null/absent  |
| 21-02 | `test_coaching_service.py::test_no_fallback_cards_informational` | Informational Q → resource_cards = [] |
| 21-02 | `test_coaching_service.py::test_resource_cards_capped_at_2`      | LLM returns 5 cards → response has ≤2 |
| 21-03 | `test_coaching_cards.py::test_a2ui_quality_gate`                 | 1-row panel → details_a2ui = null     |
| 21-04 | `pnpm build` clean                                               | No TS errors in UI changes            |

## Acceptance Gate

- Informational question ("cos'è il TFR?") → 0 resource_cards, no verdict
- Purchase question ("posso comprare una moto?") → verdict present, ≤2 resource_cards
- details_a2ui with 1 row → null in response
- `pnpm build` clean
- All pytest tests pass, no regressions
