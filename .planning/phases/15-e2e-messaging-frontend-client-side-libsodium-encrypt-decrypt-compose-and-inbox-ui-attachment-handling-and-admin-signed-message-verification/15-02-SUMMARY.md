---
plan: "15-02"
phase: "15"
status: complete
completed: 2026-04-05
tasks_completed: 3
commits: [014402f, ecca7dc, f3bbcd0]
---

# Plan 15-02 SUMMARY — libsodium Init + Argon2id KDF + AuthContext Key Lifecycle

## What Was Built

- **SodiumProvider** (`senso/src/providers/SodiumProvider.tsx`): awaits `sodium.ready` once at app startup, renders loading screen during WASM init (~200ms), wraps entire React tree in App.tsx
- **crypto.ts** (`senso/src/features/messages/crypto.ts`): full client-side crypto module — ARGON2ID_PARAMS (RFC 9106 Low Memory), Argon2id KDF, v1/v2 envelope unwrap (AES-GCM + secretbox), X25519 ephemeral DH encrypt/decrypt (XSalsa20-Poly1305), Ed25519 sign/verify, seed expansion, attachment secretbox, base64 helpers
- **CryptoKeyMaterial type** (`types.ts`): memory-only key material (naclMasterKey, x25519PrivateKey, ed25519SigningKey[64B], ed25519PublicKey) — excluded from User serialization
- **AuthContext** extended with `cryptoKeys`, `setCryptoKeys`, `isPolling`, `setIsPolling`
- **useAuth.ts**: `deriveCryptoKeys()` called after login — fail-silent try/catch; `setCryptoKeys(null)` + `setIsPolling(false)` on signOut
- **session.ts**: maps all envelope fields + adminHandle + recoveryPhrase from API response
- **api/app/schemas/auth.py**: UserDTO exposes nacl_pbkdf2_salt + login envelope fields
- **vite.config.ts**: vite-plugin-wasm added for argon2-browser WASM bundling

## Key Files Created/Modified

- `senso/src/providers/SodiumProvider.tsx` (new)
- `senso/src/features/messages/crypto.ts` (new, 297 lines)
- `senso/src/features/auth/types.ts` (CryptoKeyMaterial + new User fields)
- `senso/src/features/auth/AuthContext.tsx` (cryptoKeys + isPolling)
- `senso/src/features/auth/useAuth.ts` (deriveCryptoKeys + signOut cleanup)
- `senso/src/features/auth/session.ts` (field mapping)
- `api/app/schemas/auth.py` (UserDTO envelope fields)

## Self-Check: PASSED

- [x] SodiumProvider wraps App.tsx BrowserRouter
- [x] crypto.ts exports all required functions incl. ARGON2ID_PARAMS, expandEd25519Seed
- [x] CryptoKeyMaterial defined, never serialized
- [x] AuthContext has cryptoKeys + isPolling (review amendment: bootstrap race fix)
- [x] deriveCryptoKeys() wired in useAuth login flow, cleared on signOut
- [x] All 59 frontend tests pass
