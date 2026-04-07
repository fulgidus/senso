---
plan: 13-01
phase: 13-crypto-identity-foundation
status: complete
completed: 2026-04-03
commit: a17ee98
duration: ~15 min
---

# Summary: 13-01 - PyNaCl + nacl_crypto.py + username_generator + Round 17 migration

## What Was Built

**PyNaCl dependency** added to `api/pyproject.toml`.

**`api/app/db/nacl_crypto.py`** - 14 exports implementing the full multi-envelope crypto identity:
- X25519 key pair: `generate_x25519_keypair`, `public_key_b64`, `private_key_b64`
- Ed25519 key pair: `generate_ed25519_keypair`, `generate_admin_signing_keypair`, `verify_key_b64`, `signing_key_b64`, `sign_message`, `verify_signature`
- Master key: `generate_nacl_master_key()` → 32 random bytes (KEK, never stored plaintext)
- Login envelope: `derive_nacl_login_wrap_key` (PBKDF2-SHA256, 600k iter), `wrap_nacl_master_key`, `unwrap_nacl_master_key`
- Private key blobs: `encrypt_nacl_private_key`, `decrypt_nacl_private_key`
- AES-GCM storage format: `base64(nonce_12 + ciphertext_with_tag)` - identical to crypto.py

**`api/app/services/username_generator.py`** - username generation:
- `generate_username(db)` → unique `$adjective-noun-NNNN` with collision retry
- `generate_admin_username()` → `!admin`
- `is_admin_username` / `is_user_username` predicates
- 40 adjectives × 40 nouns word lists

**`api/app/db/session.py`** - Round 17 migration adds 7 new columns + unique index:
`username`, `public_key_b64`, `signing_key_b64`, `nacl_pbkdf2_salt`, `nacl_key_login_envelope_b64`, `encrypted_x25519_private_b64`, `encrypted_ed25519_signing_b64`

**`api/app/db/models.py`** - User ORM model extended with all 7 new column attributes.

## Test Results

```
26 passed in 9.95s
tests/test_nacl_crypto.py   - 18 tests (key pairs, signing, master key, envelope, private-key roundtrips, full signup flow)
tests/test_username_generator.py - 8 tests (format, uniqueness, admin variants, word lists)
```

## Key Decisions

- AES-GCM nonce = `os.urandom(12)`, stored as `base64(nonce+ciphertext)` - matches crypto.py
- PBKDF2 params: SHA-256, 600k iterations - matches crypto.py / OWASP 2024
- nacl_pbkdf2_salt is SEPARATE from Phase 10 pbkdf2_salt (independent envelope system)
- Private keys stored server-side encrypted (Phase 15 will move custody to client)

## Files Created/Modified

- `api/pyproject.toml` - PyNaCl>=1.5.0 added
- `api/app/db/nacl_crypto.py` - NEW (213 lines)
- `api/app/services/username_generator.py` - NEW (75 lines)
- `api/app/db/session.py` - Round 17 block added (8 SQL statements)
- `api/app/db/models.py` - 7 new column attributes on User
- `api/tests/test_nacl_crypto.py` - NEW (18 tests)
- `api/tests/test_username_generator.py` - NEW (8 tests)
