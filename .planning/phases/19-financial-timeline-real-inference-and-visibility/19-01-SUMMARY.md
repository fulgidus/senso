---
plan: "19-01"
phase: "19"
status: complete
completed: "2026-04-07"
---

# Summary: 19-01 - Complete 6/6 Event Types

## What was built

Added `relocation` and `debt_change` event detection to `_run_timeline_inference()`:
- **relocation**: detects moving-related transaction keywords (trasloco, allaccio, caparra, etc.) and clusters them within 30-day windows
- **debt_change**: detects recurring monthly transactions ≥200 EUR, same counterpart, ±3% amount consistency, ≥3 occurrences

All 6 D-13 event types are now implemented.

## Key files modified
- `api/app/services/categorization_service.py`

## Self-Check: PASSED
