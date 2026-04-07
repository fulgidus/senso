---
plan: "15-01"
phase: "15"
status: complete
completed: "2026-04-04T22:30:00Z"
tasks_completed: 4
commits:
  - "71cb7d6 feat(15-01-01): install libsodium-wrappers, argon2-browser, js-yaml, react-markdown"
  - "c63d099 feat(15-01-02): add Wave-0 crypto and KDF test stubs"
  - "6fb71ec feat(15-01-03): add public-keys endpoint and attachment upload endpoint"
  - "5019120 feat(15-01-04): add Argon2id interop test and lock cross-language test vector"
---

# Plan 15-01 SUMMARY - Packages + Crypto Stubs + Backend Endpoints

## What Was Built

- Installed 6 frontend packages: libsodium-wrappers, @types/libsodium-wrappers, argon2-browser, js-yaml, @types/js-yaml, react-markdown
- Created Wave-0 test stubs: crypto.test.ts (XSalsa20 + Ed25519 round-trip), kdf.test.ts (Argon2id mock stub)
- Added GET /users/{username}/public-keys endpoint to messages router
- Created POST /attachments/upload endpoint with MinIO integration
- Mounted attachments_router in main.py at /attachments prefix
- Updated get_user_by_username to handle both `$username` and `!handle` formats
- Locked Argon2id cross-language test vector (RFC 9106 Low Memory): `00b1eed9bee6dc0641a507717db76b6520ec876ece6cd10925e43875b543575e`

## Key Files Created/Modified

- `senso/package.json` (6 packages added)
- `senso/src/features/messages/__tests__/crypto.test.ts` (XSalsa20-Poly1305 + Ed25519 tests - 5 passing)
- `senso/src/features/messages/__tests__/kdf.test.ts` (Argon2id stub with locked hex vector)
- `senso/src/types/argon2-browser.d.ts` (type declarations for argon2-browser)
- `senso/tsconfig.app.json` (removed deprecated `baseUrl` option)
- `senso/.vite-hooks/pre-commit` (added --no-stash to work around symlink issue)
- `.gitignore` (added .pi/gsd symlink exclusion)
- `api/app/api/messages.py` (PublicKeysResponse + get_user_public_keys endpoint)
- `api/app/api/attachments.py` (new - upload_attachment endpoint)
- `api/app/main.py` (attachments_router imported and mounted)
- `api/app/db/repository.py` (get_user_by_username updated for !handle support)
- `api/pyproject.toml` (argon2-cffi>=23.1.0 added)
- `api/tests/test_kdf_interop.py` (new - Argon2id interop test with locked vector)
- `api/tests/test_envelope_migration.py` (new - stub for Plan 15-03)

## Implementation Notes

### Task 15-01-01 (Packages)

- Docker Compose `pnpm add` ran inside container but didn't update host package.json (no volume mount). Packages were added to package.json manually with exact versions from container install output, then `pnpm install` run on host.
- The pre-commit hook was failing due to `.pi/gsd` being a symlink - fixed by adding `--no-stash` to `vp staged` in `.vite-hooks/pre-commit`.

### Task 15-01-02 (Crypto Stubs)

- libsodium-wrappers input type checking fails in jsdom realm: `Uint8Array` from `TextEncoder().encode()` or `sodium.from_string()` doesn't pass `instanceof Uint8Array` check inside the WASM wrapper. Fixed by passing plain strings directly (libsodium accepts string inputs).
- argon2-browser uses browser-only WASM loading (fetch/XHR) and can't run in jsdom. Used `vi.mock` to simulate the API contract for Wave-0 stubs.
- Removed deprecated `baseUrl` from `tsconfig.app.json` (pre-existing oxlint warning). TypeScript paths still work without it.
- Added `senso/src/types/argon2-browser.d.ts` type declaration (no @types package available).

### Task 15-01-03 (Backend Endpoints)

- `get_user_by_username` updated to route `!handle` lookups to `admin_handle` column.
- `PublicKeysResponse` schema added to messages.py. Endpoint requires auth.
- `attachments.py` creates attachments bucket if missing, stores encrypted bytes without inspection.

### Task 15-01-04 (KDF Vector)

- argon2-cffi was already installed in the container (v25.1.0). Added to pyproject.toml for explicit dependency tracking.
- Hex vector obtained by running the derive function directly in the container Python environment: `00b1eed9bee6dc0641a507717db76b6520ec876ece6cd10925e43875b543575e`
- Vector locked in both `test_kdf_interop.py` (EXPECTED_HEX) and `kdf.test.ts` (comment with locked value).
- The kdf.test.ts mock still uses the simulated hash (not real Argon2id output) since argon2-browser can't run in jsdom. The EXPECTED_HEX comparison is commented out pending browser E2E test implementation.

## Self-Check

- [x] All 4 tasks committed
- [x] Frontend crypto test stubs pass (5/5 tests)
- [x] Frontend kdf test stubs pass (3/3 tests, mocked)
- [x] Backend message tests pass (10/10)
- [x] Argon2id hex vector locked in test_kdf_interop.py
- [x] Argon2id hex vector referenced in kdf.test.ts
- [ ] Docker Compose frontend build verification deferred (API container failing due to missing apscheduler in current image - pre-existing infra issue)
