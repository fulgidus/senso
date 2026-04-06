---
phase: "18"
slug: ingestion-reliability-and-non-ledger-document-support
status: draft
nyquist_compliant: false
created: "2026-04-06"
---

# Phase 18 — Validation Strategy

## Test Commands

```bash
docker compose run --rm api uv run pytest api/tests/test_ingestion_service.py -v
docker compose run --rm api uv run pytest api/tests/test_ingestion_dedup.py -v
docker compose run --rm api uv run pytest api/tests/test_non_ledger_extractors.py -v
docker compose run --rm api uv run pytest api/tests/test_profile_enrichment.py -v
```

## Per-Plan Test Map

| Plan | Test file | What it guards |
|---|---|---|
| 18-01 | `test_ingestion_dedup.py` | Same file rejected on second upload; XLSX keyword scan uses cell text not ZIP bytes |
| 18-02 | `test_non_ledger_extractors.py::test_payslip_*` | Payslip fixture → net_salary, employer, pay_period extracted |
| 18-03 | `test_non_ledger_extractors.py::test_utility_*` + `test_invoice_*` | Utility bill and invoice fixture files extract correct fields |
| 18-04 | `test_non_ledger_extractors.py::test_receipt_*` | Receipt fixture → merchant, amount, items |
| 18-04 | `test_profile_enrichment.py` | `enrich_from_extraction()` writes to correct profile columns |
| 18-05 | `test_ingestion_service.py` | Non-ledger doc with 0 transactions → success (not failure) when fields populated |

## Fixture Files Required

All fixture files placed in `api/tests/fixtures/`:
- `payslip_sample_it.pdf` — synthetic Italian payslip (can be generated text PDF)
- `bolletta_enel_sample.pdf` — synthetic electricity bill
- `fattura_sample.pdf` — synthetic invoice
- `scontrino_sample.pdf` or `.txt` — synthetic receipt

Fixtures may be minimal synthetic docs (not real personal data).

## Acceptance Gate

- `pytest api/tests/` passes with 0 failures (not counting pre-existing skips)
- Duplicate upload returns HTTP 409 with `code: "duplicate_file"`
- Payslip upload → `user_profiles.verified_income_sources` contains entry with `net_salary`
- Utility upload → `user_profiles.fixed_expenses` contains entry with `provider` + `monthly_amount`
- `pnpm build` still passes (no frontend changes in this phase)
