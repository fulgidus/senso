---
phase: "14"
created: "2026-04-04"
status: ready-for-planning
---

# Phase 14 Context - E2E Messaging Backend

## What This Phase Does

Build the **server-side plumbing** for E2E encrypted messaging:

1. `undelivered_messages` routing table - stores encrypted blobs addressed to recipient hashes
2. `delivered_messages` inbox table - per-message record tracking delivery events per recipient
3. Pull-on-login delivery - `POST /messages/poll` endpoint authenticated via Bearer JWT
4. Message send endpoint - `POST /messages/send` with minimal validation
5. TTL purge - APScheduler background task (hourly), `MESSAGE_TTL_DAYS` configurable
6. Admin `!handle` - DB column + claim endpoint only (no UI, that's Phase 15)
7. BIP-39 recovery envelope - backend generation only (no UI, that's Phase 15)

**No client-side crypto, no inbox UI** - that's Phase 15.

---

## ✅ Locked Decisions (from Phase 13)

- Crypto stack: PyNaCl - X25519 (DH) + Ed25519 (signing), already generated at signup
- `public_key_b64` (X25519) and `signing_key_b64` (Ed25519 verify key) on `User` model
- Routing scheme: `undelivered_messages` table, pull-on-login, per-recipient hash removal, 30-day configurable TTL
- Username format: `$adjective-noun-NNNN` (regular), `!handle` (admin claim - scoped partially to Phase 14)
- Multi-envelope key architecture: login envelope done in Phase 13; recovery envelope backend added in Phase 14

---

<domain>
## Phase Boundary

**In scope:**

- `undelivered_messages` DB table (routing)
- `delivered_messages` DB table (inbox log)
- `POST /messages/send` - store encrypted blob for recipient hashes
- `POST /messages/poll` - deliver pending messages to authenticated user
- APScheduler TTL purge (hourly)
- Admin `!handle` claim: DB column `admin_handle` on users + `POST /admin/claim-handle` endpoint
- BIP-39 recovery envelope: `nacl_key_recovery_envelope_b64` column + generation logic in signup; phrase returned once in signup response

**Not in scope:**

- Client-side libsodium encrypt/decrypt (Phase 15)
- Inbox UI (Phase 15)
- Admin `!handle` settings UI (Phase 15)
- Recovery envelope re-view UI (Phase 15)
- Chatroom extensions
- Read receipts / delivery receipts
- WebSockets (poll+probe for v1)
- Rate limiting (add when abuse observed)
- Message size limits (defer until needed)
- Attachment upload to S3 (Phase 15)

</domain>

<decisions>
## Implementation Decisions

### Recipient Hash Construction

- **D-01:** Hash input is `sha256($username)` - include the `$` prefix verbatim. No normalization, no stripping.
- **D-02:** Hashing is **deterministic** - same hash always for a given username. No per-message salt. Simple `WHERE hash = ANY(recipient_hashes)` lookup.
- **D-03:** Admin `!handle` usernames are **NOT hashed** - routed as cleartext in the routing fields. `!handle` is public and meant for official/transparent communication.
- **D-04:** No server-side pepper on the hash for v1. If collision analysis becomes a concern, pepper can be added in a future migration (requires a backfill of all hashes).

### Pull-on-Login API

- **D-05:** Separate `POST /messages/poll` endpoint - not wired into the login response. Client calls it explicitly after login. Enables re-polling without re-authentication.
- **D-06:** Auth: standard Bearer JWT. The authenticated user's username is resolved server-side; the server computes `sha256($username)` internally to look up matching messages. Client sends nothing extra.
- **D-07:** Poll response structure per message: `{ id, encrypted_payload: str, payload_size_bytes: int, created_at: datetime }`. No sender hash, no other cleartext metadata exposed.
- **D-08:** Delivery loop: poll finds undelivered rows WHERE caller's hash = ANY(recipient_hashes), copies each to `delivered_messages`, removes caller's hash from `recipient_hashes[]`, deletes the `undelivered_messages` row when `recipient_hashes` becomes empty.

### undelivered_messages Schema

- **D-09:** `recipient_hashes` stored as `text[]` (Postgres array) with a **GIN index** for fast `= ANY()` lookups.
- **D-10:** Server-visible metadata per row: `id`, `encrypted_payload` (text), `recipient_hashes` (text[]), `payload_size_bytes` (int), `created_at` (datetime). No sender hash or other identity metadata.
- **D-11:** No `user_id` FK anywhere in the messaging tables. Recipient identity is anchored solely to the hash. Zero-knowledge posture against external DB breach.

### delivered_messages Schema

- **D-12:** One row per **message** (not per recipient). Multiple recipients share a row.
- **D-13:** Columns: `id`, `recipient_hashes` (text[] - all original recipients, for client context), `encrypted_payload` (text), `payload_size_bytes` (int), `created_at` (datetime - original message creation time, NOT row insertion time), `delivered_at` (JSONB array of `{hash: str, at: datetime}` delivery events - first delivery creates the row, subsequent deliveries append), `source_message_id` (nullable text - FK reference to original `undelivered_messages.id`, may be null after TTL purge).
- **D-14:** GIN index on `delivered_messages.recipient_hashes` for inbox queries (`WHERE sha256($username) = ANY(recipient_hashes)`).
- **D-15:** No `user_id` FK. No `is_read` column - client manages read state locally.

### TTL Purge

- **D-16:** APScheduler background task, runs **hourly**. Deletes `undelivered_messages WHERE created_at < now() - MESSAGE_TTL_DAYS`.
- **D-17:** `MESSAGE_TTL_DAYS: int = 30` added to `Settings` class. Configurable via environment variable.
- **D-18:** No startup sweep - background task handles it. (If the task is missed during downtime, it catches up on next scheduled run.)

### Message Send Endpoint

- **D-19:** `POST /messages/send` - authenticated (Bearer JWT).
- **D-20:** Request body: `{ recipient_hashes: list[str], encrypted_payload: str }`.
- **D-21:** Server validation (minimal - no content inspection):
  - Each hash in `recipient_hashes` must match a known user (server computes `sha256($username)` for all users and checks membership). Reject with 422 if any hash is unknown.
  - No payload size limit in Phase 14 - defer until abuse observed.
- **D-22:** Success response: `{ message_id: str, created_at: datetime, recipient_count: int }`.
- **D-23:** On send, `payload_size_bytes` is computed server-side as `len(encrypted_payload.encode('utf-8'))`.

### Admin !handle (Partial - Backend Only)

- **D-24:** `admin_handle` column added to `users` table (nullable `VARCHAR(64)`, unique where non-null). GSD migration round 18.
- **D-25:** `POST /admin/claim-handle` endpoint - admin-only (requires admin role check). Validates uniqueness, stores the `!`-prefixed handle. Returns `{ admin_handle: str }`.
- **D-26:** `admin_handle` exposed in `UserDTO` as optional field.
- **D-27:** No settings UI in Phase 14. Phase 15 adds the UI.

### BIP-39 Recovery Envelope (Partial - Backend Only)

- **D-28:** `nacl_key_recovery_envelope_b64` column added to `users` (nullable text). GSD migration round 18 (same migration as admin_handle).
- **D-29:** At signup, generate a 24-word BIP-39 mnemonic, derive a wrap key from it (`PBKDF2(mnemonic_string, nacl_pbkdf2_salt, 600_000)`), and AES-GCM wrap the `nacl_master_key` → store as `nacl_key_recovery_envelope_b64`.
- **D-30:** The 24-word phrase is returned **once** in the signup response as `recovery_phrase: str`. It is NOT stored in plaintext anywhere. Client must save it. No re-view endpoint in Phase 14.
- **D-31:** Use the standard English BIP-39 wordlist (2048 words, 24 words = ~256 bits entropy). No custom fiscal-themed wordlist.
- **D-32:** `recovery_phrase` is NOT added to `UserDTO` - it's returned in the signup response body directly (`AuthResponseDTO`) as a one-time field.

### Claude's Discretion

- Router structure: create `api/app/api/messages.py` with `/messages` prefix. Mount in `create_app()`.
- APScheduler setup: use `apscheduler` (already available or add as dependency) with `BackgroundScheduler`. Start in `lifespan` hook after `create_tables()`.
- Repository helpers: `get_user_by_recipient_hash(db, hash)` for validation on send. Batch lookup for multi-recipient validation.
- Error responses: 422 for unknown recipient hashes, 401 for unauthenticated, 403 for admin-only endpoints.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 13 - Crypto Identity Foundation

- `.planning/phases/13-crypto-identity-foundation-asymmetric-key-pairs-at-signup-username-generation-and-pii-encryption-replacing-obfuscated-email/13-CONTEXT.md` - Full locked decisions for the multi-envelope key architecture, username format, NaCl stack. Phase 14 extends this - read it first.

### Architecture Design Doc

- `.planning/todos/pending/2026-03-31-replace-obfuscate-email-with-envelope-based-admin-readable-encryption.md` - Complete E2E messaging architecture spec: message format, routing design, admin handle spec, open questions. This is the source doc that informed all Phase 13-15 decisions.

### Existing Crypto Implementation

- `api/app/db/nacl_crypto.py` - AES-GCM helpers, PBKDF2 derivation, Phase 13 private key encryption. Phase 14 recovery envelope reuses `wrap_nacl_master_key()` and `derive_nacl_login_wrap_key()`.
- `api/app/db/session.py` - `_add_missing_columns()` migration pattern (round 17 = Phase 13). Phase 14 adds round 18.
- `api/app/db/models.py` - `User` model with Phase 13 columns. Phase 14 adds `admin_handle` + `nacl_key_recovery_envelope_b64`.

### Auth Service (login hook point)

- `api/app/services/auth_service.py` - `login()` method. Pull-on-login is a SEPARATE endpoint, not hooked here - but understand the auth flow.
- `api/app/api/auth.py` - Auth router. `POST /messages/poll` is a new router, not here.

### App Startup / Lifespan

- `api/app/main.py` - `lifespan()` async context manager. APScheduler background task starts here.

### Settings

- `api/app/core/config.py` (or equivalent) - `Settings` class. `MESSAGE_TTL_DAYS: int = 30` added here.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `api/app/db/nacl_crypto.py`: `wrap_nacl_master_key()`, `derive_nacl_login_wrap_key()` - reuse for BIP-39 recovery envelope (same AES-GCM wrap pattern)
- `api/app/db/session.py`: `_add_missing_columns()` round-N migration pattern - use for round 18 (admin_handle + recovery envelope columns + new tables)
- `api/app/api/notifications.py`: existing router pattern with `get_current_user` dependency - messages router follows same structure
- `api/app/db/repository.py`: `get_user_by_username()` helper from Phase 13 - extend with `get_all_recipient_hashes()` for send validation

### Established Patterns

- Router: `APIRouter()` + `Depends(get_current_user)` + `Depends(get_db)` - use in `messages.py`
- Migration: `_add_missing_columns()` with `engine.connect() + sa.text()` - do NOT mix ORM + DDL (convention)
- Settings: `get_settings()` singleton - add `MESSAGE_TTL_DAYS` there
- No Alembic - schema changes via `_add_missing_columns()` in `session.py`

### Integration Points

- `api/app/main.py` `lifespan()`: add APScheduler startup after `create_tables()`
- `api/app/main.py` `create_app()`: mount `messages_router` with prefix `/messages`
- `api/app/services/auth_service.py` `signup()`: add recovery phrase generation + `nacl_key_recovery_envelope_b64` storage after existing Phase 13 NaCl block
- `api/app/schemas/auth.py` `AuthResponseDTO`: add `recovery_phrase: str | None = None` (one-time field)
- `api/app/schemas/auth.py` `UserDTO`: add `admin_handle: str | None = None`

</code_context>

<specifics>
## Specific Implementation Notes

- **delivered_messages.delivered_at** is JSONB array of `{"hash": "sha256...", "at": "ISO datetime"}` objects. First delivery inserts the row AND appends the first entry. Subsequent deliveries for other recipients append to the existing row's array (UPDATE + append).
- **Inbox query pattern**: `WHERE sha256($caller_username) = ANY(recipient_hashes)` on `delivered_messages` - returns all messages addressed to this user that have been delivered. A separate query for `undelivered_messages` (same WHERE clause) shows pending messages not yet delivered to this user.
- **Server computes sha256 at query time** - the server derives `sha256($username)` from the authenticated caller's username. No client-provided hash needed.
- **BIP-39**: Use the `mnemonic` Python package (or `bip-utils`) for standard English wordlist generation. Return the phrase as a space-separated string in `signup()` response.

</specifics>

<deferred>
## Deferred Ideas

- **Chatroom extension** - same mechanism with hash of room IDs. Defer until 1:1 messaging is stable.
- **Read receipts / delivery receipts** - complex in E2E model. Defer.
- **WebSockets** - poll+probe for v1. Transition wrapper in place for future upgrade.
- **Rate limiting** on poll/send - add when abuse is observed.
- **Message size limits** - add when needed.
- **Attachment upload to S3** - Phase 15 scope.
- **Admin !handle settings UI** - Phase 15.
- **Recovery envelope re-view UI** - Phase 15.
- **Username change flow** - Phase 15+.
- **Passkey (WebAuthn) recovery envelope** - Phase 15+.
- **Admin emergency access to contact PII** - open question from architecture doc, not scoped.
- **BIP-39 custom fiscal-themed wordlist** - decided against for now; use standard English list.

### Reviewed Todos (not folded)

All UI todos (pagination, sort affordance, coach picker, etc.) matched by the tool were correctly NOT folded - they are unrelated to this backend messaging phase. Addressed in Phase 12.1 or pending for a future UI pass.

</deferred>

---

_Phase: 14-e2e-messaging-backend_
_Context gathered: 2026-04-04_
