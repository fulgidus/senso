---
plan: "15-03"
phase: "15"
status: complete
completed: 2026-04-05
tasks_completed: 3
commits: ["328449c", "34b63f2", "1a28c66"]
---

# Plan 15-03 SUMMARY - Envelope Migration (Backend + Frontend)

## What Was Built

### Backend (Python / FastAPI)

**`api/app/db/nacl_crypto.py`** - Extended with Argon2id KDF and v2 secretbox envelope helpers:

- `derive_argon2id_wrap_key(password, salt_bytes)` - RFC 9106 Low Memory params (time=3, mem=65536, par=4, hash_len=32), matches browser argon2-browser exactly
- `V2_PREFIX = "v2:"` - envelope format tag
- `_secretbox_encrypt` / `_secretbox_decrypt` - XSalsa20-Poly1305 via PyNaCl, compatible with libsodium-wrappers on the frontend
- `detect_envelope_version(envelope_b64)` - returns `"v2"` if starts with `"v2:"`, else `"v1"`
- `wrap_nacl_master_key_v2` / `unwrap_nacl_master_key_v2` - login envelope (de)encryption with v2 wrap key
- `encrypt_nacl_private_key_v2` / `decrypt_nacl_private_key_v2` - private key blob (de)encryption with master key
- `rewrap_all_envelopes(...)` - one-call migration: derives v1 PBKDF2 wrap key → unwraps → derives v2 Argon2id wrap key → re-wraps all 3-4 envelopes

**`api/app/services/auth_service.py`** - Transparent migration at login:

- After password verification succeeds, detects v1 envelope and runs `rewrap_all_envelopes()`
- Persists all updated blobs to DB in the same request
- Logs success/failure; failure does NOT block login (non-breaking)
- `_to_user_dto()` updated to return all 4 envelope fields (`nacl_pbkdf2_salt`, `nacl_key_login_envelope_b64`, `encrypted_x25519_private_b64`, `encrypted_ed25519_signing_b64`) so the frontend can do client-side decryption

**`api/tests/test_envelope_migration.py`** - Full test suite replacing the Phase 15-01-04 stub:

- `test_detect_v1_envelope` - verifies AES-GCM blobs are detected as v1
- `test_detect_v2_envelope` - verifies secretbox blobs are detected as v2
- `test_v2_wrap_unwrap_roundtrip` - secretbox round-trip correctness
- `test_rewrap_all_envelopes_v1_to_v2` - end-to-end migration: all blobs become `v2:` prefix, master key round-trips correctly

### Frontend (TypeScript / React)

**`senso/src/features/messages/crypto.ts`** - Added `derivePbkdf2WrapKey(password, saltB64)`:

- Uses Web Crypto API `PBKDF2-SHA256`, 600,000 iterations, 32-byte output
- Matches Python `derive_nacl_login_wrap_key()` exactly
- Required to unwrap v1 (legacy) envelopes when backend hasn't migrated yet

**`senso/src/features/auth/useAuth.ts`** - `deriveCryptoKeys()` branches on envelope version:

- `envelope.startsWith("v2:")` → use `deriveArgon2idWrapKey` (post-migration path)
- else → use `derivePbkdf2WrapKey` (v1 legacy path, transparently works during migration window)

**`senso/src/features/messages/MessagesPage.tsx`** - Shell component:

- Simple `<main>` with `t("messages.loading")` placeholder
- Full implementation deferred to Plan 15-04

**`senso/src/App.tsx`** - `/messages` route registered inside auth-gated routes using `<ProtectedRoute>`

**`senso/src/i18n/locales/it.json`** and **`en.json`** - Added `messages.loading` key:

- Italian: `"Caricamento messaggi..."`
- English: `"Loading messages..."`

**`senso/pnpm-lock.yaml`** - Added missing `vite-plugin-wasm@3.6.0` entry (was in `package.json` since 15-02-03 but lockfile wasn't updated, breaking Docker build)

**`senso/vite.config.ts`** - Added `optimizeDeps.exclude: ["argon2-browser"]` and `build.rollupOptions.external: [/argon2\.wasm$/]` to fix production build failure with argon2-browser WASM

### Fixed Pre-existing Issues

- `api/uv.lock` - Added missing `apscheduler@3.11.2` (was in `pyproject.toml` but missing from lockfile, causing API container startup failure)
- `api/tests/test_auth_crypto_identity.py` - Updated `test_private_key_blobs_not_in_dto` → `test_private_key_blobs_in_dto` to reflect Phase 15's intentional design change (envelope fields ARE returned to the authenticated user for client-side crypto)
- `senso/pnpm-lock.yaml` - Fixed stale lockfile that blocked Docker build of the frontend

## Key Files

### Modified

- `api/app/db/nacl_crypto.py` - v2 envelope helpers + migration function
- `api/app/services/auth_service.py` - transparent v1→v2 migration at login + expose envelope fields in DTO
- `api/app/schemas/auth.py` - envelope fields (already present from 15-02-03, verified)
- `api/tests/test_auth_crypto_identity.py` - updated test for new design intent
- `api/uv.lock` - added apscheduler
- `senso/src/features/messages/crypto.ts` - derivePbkdf2WrapKey added
- `senso/src/features/auth/useAuth.ts` - dual-format KDF branching
- `senso/src/App.tsx` - /messages route registered
- `senso/src/i18n/locales/it.json` - messages.loading key
- `senso/src/i18n/locales/en.json` - messages.loading key
- `senso/pnpm-lock.yaml` - vite-plugin-wasm entry added
- `senso/vite.config.ts` - WASM build config for argon2-browser

### Created

- `api/tests/test_envelope_migration.py` - full migration test suite (replaced stub)
- `senso/src/features/messages/MessagesPage.tsx` - shell component
- `senso/src/features/messages/__tests__/MessagesPage.test.tsx` - smoke test

## Self-Check: PASSED

- [x] `derive_argon2id_wrap_key` in nacl_crypto.py (time=3, mem=65536, par=4)
- [x] `rewrap_all_envelopes` migrates v1→v2 in one call
- [x] `login()` transparently migrates on first login after upgrade
- [x] Frontend `deriveCryptoKeys` branches on `v2:`/v1 envelope prefix
- [x] `derivePbkdf2WrapKey` in crypto.ts (PBKDF2-SHA256, 600k iter, 32 bytes)
- [x] MessagesPage shell registered at /messages
- [x] `messages.loading` i18n key in both it.json and en.json
- [x] All backend tests pass: `docker compose run --rm api uv run pytest tests/ -q` → 305 passed, 1 skipped
- [x] All frontend tests pass: `docker compose run --rm frontend pnpm test --run` → 60 passed
- [x] Frontend Docker build passes: `docker compose build frontend`
