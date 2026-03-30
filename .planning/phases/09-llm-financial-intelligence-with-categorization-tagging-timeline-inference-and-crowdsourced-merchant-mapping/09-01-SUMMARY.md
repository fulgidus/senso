---
phase: 09-llm-financial-intelligence
plan: "01"
subsystem: backend/db
tags: [models, migrations, llm-routing, phase9-foundation]
dependency_graph:
  requires: []
  provides: [MerchantMap, FinancialTimeline, ModerationLog, Notification, text:classification route]
  affects: [api/app/db/models.py, api/app/db/session.py]
tech_stack:
  added: []
  patterns: [SQLAlchemy ORM append-only pattern, SAVEPOINT idempotent migrations]
key_files:
  created: []
  modified:
    - api/app/db/models.py
    - api/app/db/session.py
decisions:
  - "date imported from datetime for FinancialTimeline.event_date (was missing from models.py imports)"
  - "LLMType already included 'classification' in llm_config.py — no change needed to llm.py"
  - "classification route verified: _parse_route('text:classification:sm') returns ('text','classification','sm')"
metrics:
  duration: "11 min"
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_modified: 2
---

# Phase 09 Plan 01: DB Models & LLM Classification Route — Summary

**One-liner:** Added 4 Phase 9 SQLAlchemy ORM models (MerchantMap, FinancialTimeline, ModerationLog, Notification) with idempotent Round 11 DDL migrations and confirmed text:classification:sm/md/lg route parsing works.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Add MerchantMap, FinancialTimeline, ModerationLog, Notification ORM models | a161858 | ✅ |
| 2 | DDL for new tables in session.py + verify classification route | a161858 | ✅ |

## What Was Built

### New ORM Models (`api/app/db/models.py`)

- **`MerchantMap`** (`merchant_map` table): Crowdsourced merchant description → category mapping. Has `description_raw`, `canonical_merchant`, `category`, `confidence`, `learned_method`, `contributing_user_id` (FK → users SET NULL), `is_blacklisted`.
- **`FinancialTimeline`** (`financial_timeline` table): User-specific financial events inferred from documents. Has `user_id` (FK → users CASCADE), `event_type`, `event_date` (Date), `title`, `evidence_json`, `context_tos_status`.
- **`ModerationLog`** (`moderation_log` table): Audit log of moderation actions. Has `user_id` (FK → users CASCADE), `content_type`, `raw_input`, `detected_violations` (JSON), `severity`, `action_taken`.
- **`Notification`** (`notifications` table): User notifications for moderation events and system messages. Has `user_id` (FK → users CASCADE), `type`, `title`, `body`, `is_read`, `action_url`.

### DDL Migrations (`api/app/db/session.py`)

Added Round 11 block to `_add_missing_columns()` with 8 statements:
- `CREATE TABLE IF NOT EXISTS merchant_map` + index on `description_raw`
- `CREATE TABLE IF NOT EXISTS financial_timeline` + index on `user_id`
- `CREATE TABLE IF NOT EXISTS moderation_log` + index on `user_id`
- `CREATE TABLE IF NOT EXISTS notifications` + index on `user_id`

All protected by the existing SAVEPOINT idempotent pattern.

### LLM Classification Route

`LLMType = Literal["generation", "ocr", "classification"]` was already defined in `api/app/core/llm_config.py`. No change needed to `llm.py`. Verified: `_parse_route('text:classification:sm')` → `('text', 'classification', 'sm')`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing import] Added `date` to datetime imports**
- **Found during:** Task 1
- **Issue:** `FinancialTimeline.event_date` uses `Column(Date)` with type annotation `date`, but `from datetime import date` was missing from models.py.
- **Fix:** Added `date` to the existing `from datetime import UTC, datetime` import line.
- **Files modified:** `api/app/db/models.py` (line 1)
- **Commit:** a161858

### Discoveries (No Change Needed)

- `LLMType` in `llm_config.py` already includes `"classification"` — the plan's Task 2 llm.py change was a no-op.
- Docker stack port conflicts with another project on port 9000/9001 (MinIO). Tests run with `--no-deps` using SQLite. Verified: 56 tests pass (auth, ingestion service, coaching service, module registry).

## Self-Check

### Created files exist:
- `api/app/db/models.py` — modified ✅
- `api/app/db/session.py` — modified ✅

### Commits exist:
- `a161858` — `feat(09-01): add Phase 9 ORM models and DDL migrations` ✅

## Self-Check: PASSED
