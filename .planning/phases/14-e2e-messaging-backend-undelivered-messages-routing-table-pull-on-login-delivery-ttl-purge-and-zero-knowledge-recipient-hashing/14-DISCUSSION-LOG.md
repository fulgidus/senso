# Phase 14: E2E Messaging Backend — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 14 — E2E Messaging Backend — undelivered_messages routing table, pull-on-login delivery, TTL purge, and zero-knowledge recipient hashing
**Areas discussed:** Recipient hash construction, Pull-on-login API shape, undelivered_messages schema, TTL purge trigger, Deferred scope from Phase 13, Message send endpoint

---

## Recipient Hash Construction

### What gets hashed?

| Option                               | Description                                                                       | Selected |
| ------------------------------------ | --------------------------------------------------------------------------------- | -------- |
| sha256($username) — include $ prefix | Simple, consistent, matches canonical username format                             | ✓        |
| sha256(username_without_prefix)      | Strip $ before hashing; requires consistent normalization                         |          |
| sha256(username + server_pepper)     | Static pepper prevents offline precomputation; pepper must be in settings forever |          |

**Selected:** `sha256($username)` — include the `$` prefix verbatim.

### Deterministic vs per-message?

| Option                           | Description                                                                   | Selected |
| -------------------------------- | ----------------------------------------------------------------------------- | -------- |
| Deterministic — same hash always | Simple WHERE lookup; traffic analysis risk minimal since server routes anyway | ✓        |
| Per-message random tag + mapping | Better unlinkability but complex; server still holds the mapping              |          |

**Selected:** Deterministic.

### Admin !handle hashing?

| Option                                      | Description                                   | Selected |
| ------------------------------------------- | --------------------------------------------- | -------- |
| Same hash scheme — !admin hashed like $user | Consistent zero-knowledge                     |          |
| Cleartext for admin handles — not hashed    | Admin routing is public/transparent by design | ✓        |
| Defer — admin routing is Phase 15           |                                               |          |

**Selected:** Admin `!handle` usernames routed as cleartext — they are public identifiers for official communication.

---

## Pull-on-Login API Shape

### Where does polling live?

| Option                         | Description                                            | Selected |
| ------------------------------ | ------------------------------------------------------ | -------- |
| Separate POST /messages/poll   | Clean separation; supports re-polling without re-login | ✓        |
| Wired into login response      | Saves round-trip but couples auth to messaging         |          |
| Login flag + separate endpoint | Belt-and-suspenders                                    |          |

**Selected:** Separate `POST /messages/poll` endpoint.

### Client proof mechanism?

| Option                                       | Description                                                                               | Selected |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| JWT token only — server derives hash         | Simplest; server computes sha256($username) from authenticated identity                   |          |
| JWT + client-computed hash                   | Adds consistency check; redundant since server can compute it                             |          |
| Blind challenge-response                     | Most private; significantly more complex for v1                                           |          |
| Signed JWT with public key (user suggestion) | Client signs JWT with Ed25519 private key; server verifies against stored signing_key_b64 |          |

**User notes:** "since the client is able to sign JWTs using the retrieved private key, it could simply send a signed JWT containing the public key, which the server can search against the internal database for proof of existence, and use to verify JWT manifest+signature"

**Resolved to:** Standard Bearer JWT for Phase 14 (user confirmed). The signed-JWT proof is an interesting v2 capability for unauthenticated polling — deferred to Phase 15.

### Poll response per message?

| Option                   | Description                            | Selected |
| ------------------------ | -------------------------------------- | -------- |
| Full encrypted blob only | Minimal metadata                       |          |
| Blob + size hint         | Client can show size before decrypting |          |
| Blob + sender hash       | Exposes sender as cleartext metadata   |          |

**User clarification:** "the messages are just encrypted pgp strings, we cannot do shit, just deliver the ones with the correct recipient to the recipient, and reorg the db by copying to the delivered mail table"

**Selected:** `{ id, encrypted_payload, payload_size_bytes, created_at }` — minimal, size hint included.

---

## delivered_messages Schema

### Delivery model?

| Option                                           | Description                                                   | Selected |
| ------------------------------------------------ | ------------------------------------------------------------- | -------- |
| Per-recipient row (one row per user per message) | Simple FK model                                               |          |
| Per-message row with delivery events array       | One row per message; delivered_at tracks per-recipient events | ✓        |
| Per-message row, no delivery tracking            | Simple; no delivery event history                             |          |

**User design (verbatim):** "id, recipient_hashes(text[]), encrypted_payload, payload_size, created_at(when message was created, not the row), delivered_at({text, datetime}[])(for each time a delivery happens, the first creates the row, the others just add one entry here), source_message_id. This way messages can be delivered at different times to different recipients and still the recipient can know/see when"

### Inbox query pattern?

| Option                                  | Description                      | Selected |
| --------------------------------------- | -------------------------------- | -------- |
| WHERE hash = ANY(recipient_hashes)      | All messages addressed to me     |          |
| WHERE hash in delivered_at[]            | Messages already delivered to me |          |
| Both — pending + inbox separate queries | Full picture                     | ✓        |

**User:** "both and the server takes care of the delivery changes"

### user_id FK?

| Option                         | Description                                                   | Selected |
| ------------------------------ | ------------------------------------------------------------- | -------- |
| No user_id FK — hash-only      | Zero-knowledge against external breach; GIN index for queries | ✓        |
| sha256(user_id) column instead | Same privacy posture, different identifier                    |          |
| Accept user_id FK              | Simpler; documents the tradeoff                               |          |

**User question:** "how can we store delivered mail without FK-ing it straight to a user, violating their privacy?"

**Resolution:** Recipient hash IS the stable pseudonymous identity. GIN index on `text[]` gives efficient queries. No FK = zero-knowledge against raw DB dump. Server always knows the mapping anyway (it computes the hash from the authenticated user's username) — so privacy is against external breach, not the server itself.

---

## undelivered_messages Schema

### recipient_hashes storage?

| Option                         | Description                                  | Selected |
| ------------------------------ | -------------------------------------------- | -------- |
| Postgres text[] with GIN index | Native array; fast = ANY() queries; mutable  | ✓        |
| JSONB with GIN index           | More flexible; slightly more overhead        |          |
| Separate junction table        | Cleanest relational; JOIN overhead per query |          |

**Selected:** `text[]` with GIN index.

### Server-visible metadata?

| Option                                                       | Description                                      | Selected |
| ------------------------------------------------------------ | ------------------------------------------------ | -------- |
| Minimal: id, encrypted_payload, recipient_hashes, created_at | No identity info                                 |          |
| + sender_hash                                                | Useful for abuse detection                       |          |
| + payload_size_bytes                                         | Storage quotas and abuse prevention; no identity | ✓        |

**Selected:** Minimal + `payload_size_bytes`.

---

## TTL Purge Trigger

### Mechanism?

| Option                               | Description                         | Selected |
| ------------------------------------ | ----------------------------------- | -------- |
| Startup sweep only                   | Simple; uses existing lifespan hook |          |
| APScheduler background task (hourly) | Reliable for long-running servers   | ✓        |
| Both                                 | Belt-and-suspenders                 |          |

**Selected:** APScheduler background task (hourly).

### TTL configurable?

| Option                                           | Description                   | Selected |
| ------------------------------------------------ | ----------------------------- | -------- |
| Yes — MESSAGE_TTL_DAYS in settings (default: 30) | Easy to tune for demo/testing | ✓        |
| No — hardcoded constant                          | Simpler                       |          |

**Selected:** Configurable via `MESSAGE_TTL_DAYS: int = 30` in Settings.

---

## Deferred Scope from Phase 13

### Admin !handle claim?

| Option                                     | Description | Selected |
| ------------------------------------------ | ----------- | -------- |
| Yes — full UI in Phase 14                  |             |          |
| No — defer to Phase 15                     |             |          |
| Partial — DB column + endpoint only, no UI |             | ✓        |

**Selected:** Partial. `admin_handle` column + `POST /admin/claim-handle` endpoint in Phase 14. Settings UI in Phase 15.

### BIP-39 recovery envelope?

| Option                                                 | Description | Selected |
| ------------------------------------------------------ | ----------- | -------- |
| Yes — full UX in Phase 14                              |             |          |
| No — defer to Phase 15                                 |             |          |
| Partial — backend only, phrase returned once in signup |             | ✓        |

**Selected:** Partial. `nacl_key_recovery_envelope_b64` column + generation at signup. Phrase returned once in `AuthResponseDTO`. No re-view UI in Phase 14.

---

## Message Send Endpoint

### Server validation?

| Option                                              | Description                                 | Selected |
| --------------------------------------------------- | ------------------------------------------- | -------- |
| Minimal: verify recipient hashes exist + size limit | No content inspection                       | ✓        |
| Existence check only (accept unknown hashes)        | True zero-knowledge but allows dead letters |          |
| Strict: parse + validate frontmatter                | Server reads message structure              |          |

**Selected:** Minimal — validate hashes exist in users, no size limit in Phase 14.

### Max size?

| Option                        | Description                       | Selected |
| ----------------------------- | --------------------------------- | -------- |
| 10 MB configurable            | Generous                          |          |
| 1 MB                          | Sufficient for text + frontmatter |          |
| Defer — no limit until needed |                                   | ✓        |

**Selected:** Deferred. Add when abuse is observed.

### Send response?

| Option                                      | Description                  | Selected |
| ------------------------------------------- | ---------------------------- | -------- |
| { message_id, created_at }                  | Minimal                      |          |
| { message_id, created_at, recipient_count } | Confirms delivery queue size | ✓        |
| 204 No Content                              | Fire and forget              |          |

**Selected:** `{ message_id, created_at, recipient_count }`.

---

## Claude's Discretion

- Router structure: `api/app/api/messages.py` with `/messages` prefix
- APScheduler setup and lifespan integration
- Repository helper design for batch recipient hash validation
- Error response codes (422 for unknown hashes, 401/403 for auth)

## Deferred Ideas

- Signed-JWT proof of identity for unauthenticated polling (Phase 15)
- Rate limiting on poll/send (add when abuse observed)
- Message size limits (add when needed)
- Chatroom extensions
- Read/delivery receipts
- WebSocket upgrade
- Admin emergency PII access
