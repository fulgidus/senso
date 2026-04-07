---
plan: "18-03"
phase: "18"
status: complete
completed: "2026-04-07"
---

# Summary: 18-03 - Utility Bill + Invoice Modules

## What was built

- `utility_bill_it.py`: regex-based provider detection (11 known Italian providers), service type classification (luce/gas/acqua/telefono), amount and account number extraction
- `invoice_it.py`: Italian invoice extraction (vendor, total EUR, VAT, invoice number, due date) with flexible total patterns supporting "Totale Fattura EUR: 1.220,00" format

## Key files created

- `api/app/ingestion/modules/builtin/utility_bill_it.py`
- `api/app/ingestion/modules/builtin/invoice_it.py`

## Self-Check: PASSED
