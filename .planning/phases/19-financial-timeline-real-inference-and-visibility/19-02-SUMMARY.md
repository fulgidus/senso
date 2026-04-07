---
plan: "19-02"
phase: "19"
status: complete
completed: "2026-04-07"
---

# Summary: 19-02 - Non-Ledger Timeline Triggers

## What was built

- **Payslip → income_shift**: after `enrich_from_payslip()` if net_income changes >5% vs previous entry, a timeline event is created
- **Utility → subscription_accumulation**: after `enrich_from_utility_bill()` if a new provider is added OR total fixed expenses increase >10%, a timeline event is created
- Both triggers are wrapped in try/except — failures are logged, never crash ingestion

## Key files modified
- `api/app/services/profile_service.py`

## Self-Check: PASSED
