Research brief written. Here's a summary of the key findings:

---

## Key Findings

### 🔴 Critical Blockers (must resolve before implementation)

1. **Missing `GET /users/{username}/public-keys` endpoint** - The compose flow needs recipient X25519 keys, but no such endpoint exists anywhere in the backend. This is a hard blocker for Phase 15.

2. **Argon2id parallelism parameters** - The backend currently uses PBKDF2 (600k iter). When migrating to Argon2id, the params must be locked at `time=3, mem=65536, parallelism=4, hashLen=32` (RFC 9106 Low Memory). Cross-language interop test vectors are essential before any envelope re-wrapping lands.

### 🟡 Algorithm Clarification

3. **XSalsa20, not XChaCha20** - `crypto_box_easy` (standard libsodium-wrappers) uses XSalsa20-Poly1305, which is exactly what PyNaCl's `nacl.public.Box` uses. The CONTEXT.md says "XChaCha20-Poly1305" but using the XChaCha20 variant from sumo would break cross-platform compat. Use standard `crypto_box_easy`.

4. **Ed25519 seed expansion** - PyNaCl stores 32-byte seeds; libsodium needs 64-byte expanded keys. Use `sodium.crypto_sign_seed_keypair(seed32)`.

### 📦 7 New Packages Needed

None of the crypto dependencies are installed: `libsodium-wrappers`, `@types/libsodium-wrappers`, `argon2-browser`, `js-yaml`, `@types/js-yaml`, `react-markdown`. Zustand is optional (AuthContext extension can work for Phase 15).

### ✅ What Maps Cleanly

- Route registration: `<Route path="/messages" element={<ProtectedRoute>...}>` - same pattern as admin routes
- Tabs: URL search params (`?tab=inbox`) via `useSearchParams` - no extra library
- Contacts: `localStorage` under `senso:contacts` - perfectly adequate for MVP
- AES-GCM format detection: add `v2:` prefix to new secretbox blobs - no schema change needed
- Attachment upload: needs a **new** `/attachments/upload` endpoint, not the ingestion pipeline
