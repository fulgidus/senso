---
plan: 13-02
phase: 13-crypto-identity-foundation
status: complete
completed: 2026-04-03
commit: a894732
duration: ~20 min
---

# Summary: 13-02 — Wire signup() + UserDTO + integration tests

## What Was Built

**`api/app/schemas/auth.py`** — UserDTO extended with 3 new public identity fields:
- `username: str | None = None`
- `public_key_b64: str | None = None` — X25519 public key (safe to expose)
- `signing_key_b64: str | None = None` — Ed25519 verify key (safe to expose)
- Private key blobs (`encrypted_x25519_private_b64`, `encrypted_ed25519_signing_b64`) are NOT in DTO

**`api/app/services/auth_service.py`** — major updates:
- New imports: `nacl_crypto` (8 functions with aliases), `username_generator`, `base64`, `os`
- `_to_user_dto(user)` helper — single source of truth for UserDTO construction
- All 3 inline `UserDTO(...)` constructions replaced with `_to_user_dto(user)`
- `signup()` extended with full Phase 13 multi-envelope block:
  - Generates `$adjective-noun-NNNN` username (or `!admin` for admin users)
  - Generates `nacl_master_key` (32 random bytes, KEK)
  - Derives `login_wrap_key = PBKDF2(password, nacl_salt, 600k iter)`
  - Wraps master key → `nacl_key_login_envelope_b64`
  - Generates X25519 keypair → stores public key + encrypted private key
  - Generates Ed25519 keypair → stores verify key + encrypted signing key

**`api/app/db/repository.py`** — `get_user_by_username(db, username)` added.

**`api/tests/test_auth_crypto_identity.py`** — 7 integration tests:
1. signup returns username in `$adj-noun-N` format
2. signup returns public key fields
3. private key blobs absent from DTO response
4. login returns identity fields
5. /me endpoint returns username (handles `{"user": {...}}` envelope)
6. all 7 DB columns non-null after signup
7. private key recovery roundtrip via login envelope (PBKDF2 → unwrap → decrypt)

## Test Results

```
7 passed in 15.59s
```

## Key Decisions

- `/auth/me` returns `{"user": user.model_dump()}` envelope — tests account for this
- Admin users get `!admin` username via `generate_admin_username()` (no special-casing needed)
- `password` arg to signup() is used directly for PBKDF2 (not the already-hashed version)

## Files Modified

- `api/app/schemas/auth.py` — 3 new UserDTO fields
- `api/app/services/auth_service.py` — imports, _to_user_dto, signup() Phase 13 block
- `api/app/db/repository.py` — get_user_by_username added
- `api/tests/test_auth_crypto_identity.py` — NEW (7 tests)
