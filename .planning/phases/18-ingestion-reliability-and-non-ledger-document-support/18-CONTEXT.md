---
phase: "18"
slug: ingestion-reliability-and-non-ledger-document-support
created: "2026-04-06"
status: ready-to-execute
---

# Phase 18 Context - Ingestion Reliability + Non-Ledger Document Support

## Why This Phase Exists

The ingestion pipeline has two compounding problems:

### Problem 1: Flaky Fingerprinting

The `ModuleRegistry` scores modules by counting keyword matches in the first 4096 bytes of
file content. This fails because:
- **Binary formats** (XLSX, ODS): the first 4096 bytes are ZIP/OLE headers, not text.
  `"conto corrente"` is never found. All Fineco XLSX uploads fall through to the adaptive
  LLM path (slower, costs money, less accurate).
- **Binary threshold**: matching is `1 if keyword in text else 0` - a file matching 3/5
  keywords scores the same as 5/5 if one is a false negative. Order of modules matters.
- **No content-hash dedup**: the same file can be re-uploaded and re-processed indefinitely,
  burning LLM calls and creating duplicate transaction rows.

### Problem 2: Non-Ledger Files Ignored

The schema defines `payslip`, `receipt`, `invoice`, `utility_bill` as valid `document_type`
values with dedicated fields (`net_salary`, `employer`, `monthly_amount`, `provider`, etc.).
But the ingestion pipeline only validates extraction success via `transaction count > 0`.
A correctly parsed payslip with `net_salary = 1850` and `0 transactions` is treated as
a failure and falls through to the LLM fallback - which then tries to extract transactions
from a pay stub, failing again.

The profile is never enriched from non-ledger documents. Users who upload their payslip
get nothing useful back.

## What This Phase Does

### 18-01: Content-hash dedup + MIME-first module routing
- `sha256(file_bytes)` → check `uploads` table for existing hash for this user → reject
  as duplicate before any processing
- MIME type pre-routes to candidate modules before keyword scan (XLSX → only try XLSX
  modules; PDF → only try PDF modules)
- For binary formats: decompress XLSX to sheet text in-process, then run keyword scan on
  actual cell values (not ZIP bytes)

### 18-02: Payslip extractor (busta paga italiana)
- Builtin module for Italian payslips (INPS, IRPEF, netto, lordo, datore di lavoro)
- Extracts: `net_salary`, `gross_salary`, `employer`, `pay_period`, `inps_contribution`,
  `irpef_withheld`
- Fingerprint keywords: `"busta paga"`, `"cedolino"`, `"netto"`, `"lordo"`, `"datore di lavoro"`
- Profile enrichment: upsert `user_profiles.verified_income_sources[]`

### 18-03: Utility bill + invoice extractors
- Builtin module for Italian utility bills (luce, gas, acqua, telefono)
- Extracts: `provider`, `service_type`, `monthly_amount`, `billing_period`, `account_number`
- Builtin module for generic Italian invoices (fattura)
- Extracts: `vendor`, `total_amount`, `vat_amount`, `due_date`, `invoice_number`
- Both feed `user_profiles.fixed_expenses[]` and `one_off_expenses[]`

### 18-04: Receipt extractor + non-ledger profile enrichment service
- Builtin module for receipts (scontrino, ricevuta)
- Extracts: `merchant`, `total_amount`, `items[]`, `date`
- `ProfileService.enrich_from_extraction()`: unified method called after any non-ledger
  successful extraction to update the relevant profile fields

### 18-05: Pipeline fix - non-ledger success condition + tests
- Fix `run_adaptive_pipeline()` success condition: success is
  `transactions > 0 OR (non-ledger fields populated AND confidence ≥ 0.6)`
- Fix `IngestionService._run_extraction()` to call profile enrichment after non-ledger
  extraction completes
- Unit tests: fixture files for each document type, dedup behaviour, profile fields updated

## Scope

**In scope:**
- `api/app/ingestion/registry.py` - MIME routing, binary XLSX text extraction for scan
- `api/app/db/models.py` - `content_hash` column on `uploads`, `fixed_expenses` +
  `one_off_expenses` + `verified_income_sources` on `user_profiles`
- `api/app/db/session.py` - migration for new columns
- `api/app/ingestion/modules/builtin/` - 4 new modules
- `api/app/ingestion/adaptive.py` - success condition fix
- `api/app/services/ingestion_service.py` - dedup check, profile enrichment call
- `api/app/services/profile_service.py` - `enrich_from_extraction()` method
- `api/tests/` - tests for each new path

**Not in scope:**
- Vector embeddings for documents
- Multi-page receipt parsing
- Bank statement formats beyond existing builtins
- Frontend changes (profile UI will show new fields in Phase 22)
