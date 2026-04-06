---
status: pending
phase: "18"
---

# Phase 18 Verification — Ingestion Reliability + Non-Ledger Document Support

## Must-Haves

| # | Requirement | Status | Evidence |
|---|-------------|--------|---------|
| 1 | `content_hash` column on `uploads` table | ⏳ | |
| 2 | Duplicate file upload returns 409 | ⏳ | |
| 3 | XLSX modules use cell-text scan (not ZIP bytes) | ⏳ | |
| 4 | MIME-type pre-routing in ModuleRegistry | ⏳ | |
| 5 | Payslip builtin module extracts net_salary, employer, pay_period | ⏳ | |
| 6 | Utility bill builtin module extracts provider, monthly_amount | ⏳ | |
| 7 | Invoice builtin module extracts vendor, total_amount, due_date | ⏳ | |
| 8 | Receipt builtin module extracts merchant, amount | ⏳ | |
| 9 | `ProfileService.enrich_from_extraction()` updates profile columns | ⏳ | |
| 10 | Non-ledger extraction with 0 transactions = success when fields populated | ⏳ | |
| 11 | All new pytest tests pass | ⏳ | |
