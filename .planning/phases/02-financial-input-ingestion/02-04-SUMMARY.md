---
phase: 02-financial-input-ingestion
plan: 04
subsystem: ingestion
tags: [openpyxl, csv, pdf, pytesseract, fineco, revolut, satispay, paypal, edison, extraction]

# Dependency graph
requires:
  - phase: 02-financial-input-ingestion
    provides: "ExtractionResult/ExtractedDocument/Transaction Pydantic schemas from plan 02-02; ModuleRegistry from plan 02-02"
provides:
  - "7 builtin conversion modules in api/app/ingestion/modules/builtin/"
  - "FinecoIT XLSX extractor (737 transactions from real sample)"
  - "RevolutIT CSV/PDF extractor (117 transactions from real sample)"
  - "SatispayIT XLSX/PDF extractor (792 transactions from real sample)"
  - "PaypalIT CSV/PDF extractor (70 transactions from real sample)"
  - "EdisonEnergiaIT PDF utility-bill extractor (OCR-based)"
  - "GenericInvoiceIT PDF invoice extractor (OCR-based, best-effort)"
  - "GenericCSV last-resort CSV fallback (score floor 0.1 per D-27)"
  - "openpyxl added to pyproject.toml dependencies"
affects:
  - 02-financial-input-ingestion
  - 03-financial-profile-building

# Tech tracking
tech-stack:
  added: [openpyxl>=3.1.0 (XLSX parsing)]
  patterns:
    - "Module interface contract: FINGERPRINT list[str] + MODULE_VERSION str + extract(path) -> ExtractionResult"
    - "FINGERPRINT keywords verified against actual sample file content before writing (D-26)"
    - "Lazy imports inside extract() for optional deps (pytesseract, pdf2image) to avoid import-time failures"
    - "Italian decimal format parser (_parse_italian_decimal) for PayPal CSV"
    - "PDF modules return low-confidence skeleton when OCR unavailable — OCR tier handles these better"
    - "GenericCSV score floored at 0.1 in registry (D-27)"

key-files:
  created:
    - api/app/ingestion/modules/__init__.py
    - api/app/ingestion/modules/builtin/__init__.py
    - api/app/ingestion/modules/builtin/fineco_it.py
    - api/app/ingestion/modules/builtin/revolut_it.py
    - api/app/ingestion/modules/builtin/satispay_it.py
    - api/app/ingestion/modules/builtin/generic_csv.py
    - api/app/ingestion/modules/builtin/paypal_it.py
    - api/app/ingestion/modules/builtin/edison_energia_it.py
    - api/app/ingestion/modules/builtin/generic_invoice_it.py
  modified:
    - api/pyproject.toml

key-decisions:
  - "FINGERPRINT keywords for all modules derived from actual sample file inspection before writing any code (D-26)"
  - "Revolut/Satispay/PayPal: skip REVERTED/CANCELLED transactions to avoid double-counting"
  - "PDF modules (Edison, GenericInvoice) return low-confidence graceful fallback when pytesseract/pdf2image unavailable — OCR tier handles full extraction better"
  - "PayPal Italian CSV uses comma decimal separator — dedicated _parse_italian_decimal() helper"
  - "SatispayIT FINGERPRINT uses emoji-containing text strings ('to a store', 'from bank') from actual sample content"
  - "openpyxl added to pyproject.toml as project dependency (D-41)"

patterns-established:
  - "Builtin module structure: module-level FINGERPRINT list + MODULE_VERSION str + extract() function"
  - "All imports of optional heavy deps (openpyxl, pytesseract, pdf2image) are inside functions not at module level"
  - "extract() returns ExtractionResult with confidence=0.9 when transactions found, 0.4 when not, 0.1 for PDF without OCR"

requirements-completed: [INGT-01, INGT-02]

# Metrics
duration: 4min
completed: 2026-03-24
---

# Phase 02 Plan 04: Builtin Conversion Modules Summary

**7 format-specific Python extraction modules implemented from actual sample file inspection: FinecoIT XLSX (737 txns), RevolutIT CSV (117 txns), SatispayIT XLSX (792 txns), PaypalIT Italian CSV (70 txns), plus Edison/GenericInvoice PDF extractors and GenericCSV fallback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T22:24:43Z
- **Completed:** 2026-03-24T22:29:03Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Read all sample files before writing any FINGERPRINT patterns or extract logic (D-26 compliance)
- 4 structured-data modules (fineco_it, revolut_it, satispay_it, paypal_it) extract real transactions from sample files with 0.9 confidence
- 3 best-effort modules (edison_energia_it, generic_invoice_it, generic_csv) handle PDF invoices and CSV fallback
- All 7 modules discovered and loaded by ModuleRegistry at startup without errors
- openpyxl added to pyproject.toml for XLSX support (D-41)

## Task Commits

Each task was committed atomically:

1. **Task 1: XLSX/CSV builtin modules** - `b103e84` (feat)
2. **Task 2: PDF/invoice builtin modules** - `87e7214` (feat)
3. **chore: openpyxl dependency** - `92beeb3` (chore)

## Files Created/Modified

- `api/app/ingestion/modules/__init__.py` — Empty package init
- `api/app/ingestion/modules/builtin/__init__.py` — Empty package init
- `api/app/ingestion/modules/builtin/fineco_it.py` — FinecoBank XLSX extractor; reads Data_Operazione/Entrate/Uscite/Descrizione_Completa; extracts account_holder and statement period
- `api/app/ingestion/modules/builtin/revolut_it.py` — Revolut CSV extractor; maps Type/Started Date/Amount/Balance; skips REVERTED/DECLINED
- `api/app/ingestion/modules/builtin/satispay_it.py` — Satispay XLSX extractor; maps Date/Name/Amount/Status columns; skips cancelled
- `api/app/ingestion/modules/builtin/generic_csv.py` — Last-resort CSV fallback (D-27); score floor 0.1; Italian+English column variants
- `api/app/ingestion/modules/builtin/paypal_it.py` — PayPal Italy CSV extractor; Italian decimal format handling; skips zero-net rows
- `api/app/ingestion/modules/builtin/edison_energia_it.py` — Edison Energia PDF extractor; pytesseract OCR; extracts service type, total_due, billing period
- `api/app/ingestion/modules/builtin/generic_invoice_it.py` — Generic Italian invoice PDF extractor; OCR-based regex extraction
- `api/pyproject.toml` — Added openpyxl>=3.1.0 dependency

## Decisions Made

- FINGERPRINT keywords for all modules derived from actual sample file inspection before writing any code (D-26 compliance)
- PDF modules return graceful low-confidence skeleton when pytesseract/pdf2image not installed — OCR tier handles full PDF extraction better; avoids import-time failures
- PayPal Italian CSV requires dedicated decimal parser (comma as decimal separator)
- Revolut, Satispay, PayPal modules skip cancelled/reverted/declined transactions
- openpyxl added as project dependency per D-41

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added openpyxl to pyproject.toml**
- **Found during:** Task 1 (fineco_it and satispay_it implementation)
- **Issue:** openpyxl was not in pyproject.toml dependencies despite being required by XLSX modules
- **Fix:** Added `openpyxl>=3.1.0` to pyproject.toml dependencies (D-41 mandates this)
- **Files modified:** api/pyproject.toml
- **Verification:** uv pip install openpyxl succeeded; modules import and extract correctly
- **Committed in:** 92beeb3 (chore commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical dependency)
**Impact on plan:** Fix was necessary for XLSX extraction to work. No scope creep.

## Issues Encountered

- `openpyxl` not available in project venv at execution start — installed via `uv pip install openpyxl` into `.venv`, then added to `pyproject.toml`. Normal setup step for first run.
- PDF modules (Edison, GenericInvoice) could not be fully tested for OCR output since `pytesseract`/`pdf2image` are not installed in the executor environment. Both modules gracefully return low-confidence ExtractionResult without crashing — the OCR tier will handle full PDF extraction in the running Docker container where tesseract-ocr is installed (D-41).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 builtin modules ready for use by ingestion_service.py (plan 02-05)
- Registry loads all modules at startup — verified
- FINGERPRINT patterns verified against real sample files — registry matching will work correctly
- PDF modules will benefit from pytesseract being available in Docker container (D-41 already specifies `apt-get install tesseract-ocr` in Dockerfile)

---
*Phase: 02-financial-input-ingestion*
*Completed: 2026-03-24*
