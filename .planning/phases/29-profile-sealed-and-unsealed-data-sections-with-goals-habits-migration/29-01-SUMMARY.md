---
plan: 29-01
status: complete
wave: 1
completed_at: 2026-04-11
commits:
  - 7ab3b6b7
key-files:
  created:
    - api/app/db/models.py
    - api/app/db/session.py
    - api/app/api/profile.py
    - api/app/schemas/auth.py
    - api/app/services/auth_service.py
    - api/app/api/coaching.py
    - api/app/coaching/safety.py
---

# Plan 29-01 Summary: Backend — Two-Tier Profile Data Model and API

## What was built

Added two-tier profile data model to the FastAPI backend:
- **8 new columns** on `user_profiles`: `sealed_profile` (TEXT, NaCl ciphertext) + 7 unsealed demographics columns
- **Round 23 migration** with idempotent `ALTER TABLE IF NOT EXISTS` + UPDATE to null PII name fields
- **4 new endpoints**: `GET/PATCH /profile/sealed-profile` and `GET/PATCH /profile/demographics`
- **firstName/lastName removed** from `UpdateMeRequest`, `auth_service.update_me()`, coaching welcome call, and PII safety filter

## Decisions made

- Used `SmallInteger` for `household_size` (imported from sqlalchemy)
- `sealed_profile` is opaque ciphertext — backend stores/returns without inspection
- Demographics PATCH uses selective field update (only non-null values applied)
- PII filter removal of first_name/last_name entries cleans up safety.py _PROFILE_FIELD_HINTS dict

## Self-Check: PASSED
