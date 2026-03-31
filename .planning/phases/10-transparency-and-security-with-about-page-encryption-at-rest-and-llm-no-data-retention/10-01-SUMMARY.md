---
phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention
plan: "01"
subsystem: api
tags: [crypto, encryption, pbkdf2, aes-gcm, settings, db-migration, auth]

# Dependency graph
requires: []
provides:
  - Settings.encryption_key field readable from ENCRYPTION_KEY env var
  - sqlalchemy-utils and cryptography installed in API container
  - api/app/db/crypto.py with 5 PBKDF2/AES-GCM helpers
  - users table has encrypted_user_key, pbkdf2_salt, strict_privacy_mode columns
  - UserDTO and UpdateMeRequest both include strict_privacy_mode
  - signup() generates and stores wrapped user data key
affects:
  - 10-02 (uses Settings.encryption_key via LLMClient)
  - 10-03 (uses Settings.encryption_key for StringEncryptedType)
  - 10-04 (uses strict_privacy_mode in UserDTO / frontend types)

# Tech tracking
tech-stack:
  added:
    - sqlalchemy-utils>=0.41.2
    - cryptography>=42.0.0
  patterns:
    - "Wrapped-key architecture: per-user AES-256 data key, PBKDF2-derived wrapping key"
    - "server_wrap_user_key() for OAuth users (jwt_secret+user_id as password material)"
    - "_add_missing_columns() Round 13 for schema-free DB migration"

key-files:
  created:
    - api/app/db/crypto.py
    - api/tests/test_crypto.py
  modified:
    - api/pyproject.toml
    - api/app/core/config.py
    - api/app/db/session.py
    - api/app/db/models.py
    - api/app/schemas/auth.py
    - api/app/services/auth_service.py

key-decisions:
  - "violation_count and banned_until were already present in Round 12 — NOT added again in Round 13"
  - "server_wrap_user_key() uses lazy import of get_settings() to avoid circular imports at module load"
  - "All UserDTO constructions include strict_privacy_mode=bool(user.strict_privacy_mode) to handle DB NULL safely"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-03-31
---

# Phase 10 Plan 01: Crypto Foundations Summary

**Crypto dependencies, Settings.encryption_key, PBKDF2 key-management helpers in crypto.py, three new users columns, and strict_privacy_mode wired through auth service and Pydantic schemas**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-31T13:02:00Z
- **Completed:** 2026-03-31T13:11:11Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `sqlalchemy-utils>=0.41.2` and `cryptography>=42.0.0` to `api/pyproject.toml`
- Added `encryption_key: str` to `Settings` frozen dataclass with a 32-byte dev-safe default
- Created `api/app/db/crypto.py` with 5 pure helper functions: `generate_user_data_key`, `derive_key_from_password`, `wrap_user_key`, `unwrap_user_key`, `server_wrap_user_key`
- All 4 `test_crypto.py` tests pass (roundtrip, wrong-key raises `InvalidTag`, server wrap returns valid base64)
- Round 13 migration appended to `_add_missing_columns()` adds `encrypted_user_key`, `pbkdf2_salt`, `strict_privacy_mode`
- `User` ORM model gains 3 new column attributes
- `UserDTO` and `UpdateMeRequest` expose `strict_privacy_mode: bool = False`
- `signup()` calls `server_wrap_user_key(user.id)` after commit and stores the result
- `update_me()` persists `strict_privacy_mode` when caller provides it
- All `_user_to_dto()` call sites updated to include `strict_privacy_mode=bool(user.strict_privacy_mode)`

## Task Commits

1. **Task 1: Add crypto dependencies and Settings.encryption_key** — `bea41ef` (feat)
2. **Task 2: Create api/app/db/crypto.py with PBKDF2 wrapped-key helpers** — `81b0260` (feat)
3. **Task 3: DB columns, schema updates, and auth_service hook** — `ee680a2` (feat)

## Files Created/Modified

- `api/pyproject.toml` — added sqlalchemy-utils and cryptography deps
- `api/app/core/config.py` — added `encryption_key` field and `get_settings()` wiring
- `api/app/db/crypto.py` — new file with 5 PBKDF2/AES-GCM helper functions
- `api/tests/test_crypto.py` — new file with 4 passing unit tests
- `api/app/db/session.py` — Round 13 migration block appended
- `api/app/db/models.py` — 3 new columns on `User` model
- `api/app/schemas/auth.py` — `strict_privacy_mode` on `UserDTO` and `UpdateMeRequest`
- `api/app/services/auth_service.py` — key-wrap on signup; strict_privacy_mode on update_me and all DTO constructions

## Decisions Made

- `violation_count` and `banned_until` were already present in Round 12 — only 3 new columns added in Round 13 (avoids "duplicate column" errors on existing DBs)
- `server_wrap_user_key()` uses a lazy local `from app.core.config import get_settings` to avoid circular import at module load time
- `strict_privacy_mode` always coerced to `bool` at the DTO boundary (`bool(user.strict_privacy_mode)`) to safely handle DB NULL on existing rows

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — `ENCRYPTION_KEY` defaults to a dev-safe 32-byte value. Override with real key in production `ENCRYPTION_KEY` env var.

## Next Phase Readiness

- 10-02: `Settings.encryption_key` available ✓
- 10-03: `sqlalchemy-utils`, `cryptography`, `_server_key` pattern ready ✓
- 10-04: `UserDTO.strict_privacy_mode` and `UpdateMeRequest.strict_privacy_mode` available ✓

---
*Phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention*
*Completed: 2026-03-31*
