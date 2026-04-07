---
phase: "19"
slug: financial-timeline-real-inference-and-visibility
status: draft
nyquist_compliant: false
created: "2026-04-06"
---

# Phase 19 - Validation Strategy

## Test Commands

```bash
docker compose run --rm api uv run pytest api/tests/test_timeline_inference.py -v
docker compose run --rm frontend pnpm test
docker compose run --rm frontend pnpm build
```

## Per-Plan Test Map

| Plan  | Test                                                                          | What it guards                                |
| ----- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| 19-01 | `test_timeline_inference.py::test_relocation_*`                               | Utility address change → relocation event     |
| 19-01 | `test_timeline_inference.py::test_debt_change_*`                              | Recurring fixed large txn → debt_change event |
| 19-02 | `test_timeline_inference.py::test_payslip_triggers_income_shift`              | Payslip >5% salary change → income_shift      |
| 19-02 | `test_timeline_inference.py::test_utility_triggers_subscription_accumulation` | New utility → subscription event              |
| 19-03 | `test_coaching_service.py::test_timeline_in_system_prompt`                    | Timeline block present when events exist      |
| 19-04 | Frontend vitest: TimelineTab renders date labels                              | Date formatting, empty state                  |

## Acceptance Gate

- All 6 event types can be triggered by appropriate test data
- Payslip upload with salary change → `income_shift` event created within same request cycle
- Coach system prompt contains timeline block when events exist (assert in pytest)
- `pnpm build` clean
