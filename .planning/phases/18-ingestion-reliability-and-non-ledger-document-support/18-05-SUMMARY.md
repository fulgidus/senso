---
plan: "18-05"
phase: "18"
status: complete
completed: "2026-04-07"
---

# Summary: 18-05 - Pipeline Success Condition Fix + Full Test Suite

## What was built

- `_extraction_has_content()` helper in `adaptive.py`: non-ledger types succeed when any key field (net_income, total_due, total_amount, merchant, provider) is non-null, even with 0 transactions
- Full pytest test suite: 21 tests covering dedup, XLSX fingerprinting, all 4 module types, profile enrichment dispatch, regression on existing registry/ingestion tests

## Key files modified/created

- `api/app/ingestion/adaptive.py` — `_extraction_has_content()` + `_NON_LEDGER_TYPES`
- `api/tests/test_ingestion_dedup.py` — 5 tests (dedup, same bytes diff user, XLSX registry, module loading)
- `api/tests/test_non_ledger_extractors.py` — 11 tests (payslip, utility, invoice, receipt)
- `api/tests/test_profile_enrichment.py` — 5 tests (all 4 enrichment paths + bank_statement no-op)

## Test results

**21/21 new tests pass. 14/14 existing registry+ingestion tests pass. No regressions.**

## Self-Check: PASSED
