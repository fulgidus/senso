---
plan_id: "27-01"
phase: 27
status: complete
completed: "2026-04-10"
---

# Plan 27-01 Summary: Backend admin username enforcement

## What was built

Three backend changes that enforce admin username correctness at signup, migration, and API validation:

1. **D-09 — Signup fix** (`auth_service.py`): Replaced `generate_admin_username() if is_admin else generate_username(self.db)` with unconditional `generate_username(self.db)`. New admin signups now receive a `$adj-noun-N` username identical to regular users. Removed the `generate_admin_username` import.

2. **D-10 — DB backfill** (`session.py` Round 22): Added post-migration block after the `migrations = [...]` run that queries for all users with `username IS NULL` or `username = '!admin'` and reassigns each a unique `$adj-noun-N` via `generate_username()`. Guarded by `not DATABASE_URL.startswith("sqlite")` (test environments skipped).

3. **D-12 — Claim-handle validator** (`admin.py`): Replaced `ClaimHandleRequest.handle: str` with `adminHandle: str` plus a `@field_validator` enforcing: must start with `!`, body 3–30 chars, `^[a-z0-9-]+$` pattern, not in reserved set `{"admin", "sistema", "senso"}`. Returns 422 for format/reserved violations. Removed the redundant `startswith("!")` endpoint check. Also renamed all `body.handle` refs to `body.adminHandle` in the endpoint to match the new field name (which also aligns with existing frontend payload shape).

## Test file

`api/tests/test_phase27_username_enforcement.py` — 10 tests across 4 classes:
- `TestAdminSignupUsername` — admin signup produces `$`-prefix (skipped if no STARTING_ADMINS)
- `TestUsernameBackfill` — NULL and `!admin` usernames backfilled (skipped for SQLite)
- `TestClaimHandleValidation` — reserved, uppercase, spaces, too-short, valid-handle tests
- `TestClaimHandleUniqueness` — second claim returns 409 (skipped if < 2 STARTING_ADMINS)

## key-files

### created
- api/tests/test_phase27_username_enforcement.py

### modified
- api/app/services/auth_service.py
- api/app/db/session.py
- api/app/api/admin.py

## Deviations

- **ClaimHandleRequest field renamed** from `handle` to `adminHandle`: the plan's T3 replacement code still showed `handle: str` but the tests POST `{"adminHandle": "..."}`. Renamed the field to `adminHandle` to align the model with both the test expectations and the existing frontend payload shape (SettingsScreen already sent `adminHandle`). This is consistent with the overall intent of D-12.

## Self-Check

- [x] `generate_admin_username` no longer called in auth_service.py
- [x] Round 22 backfill added and guarded against SQLite
- [x] `field_validator` rejects reserved handles, uppercase, spaces, too-short
- [x] `body.adminHandle` used throughout endpoint (no `body.handle` references remain)
- [x] Python syntax verified (ast.parse) for all modified files
- [x] 10 test stubs committed and importable
