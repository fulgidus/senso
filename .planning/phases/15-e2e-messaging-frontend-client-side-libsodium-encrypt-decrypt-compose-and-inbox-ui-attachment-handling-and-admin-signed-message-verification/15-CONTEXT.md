---
phase: "15"
created: "2026-04-04"
status: ready-for-planning
---

# Phase 15 Context - E2E Messaging Frontend

## What This Phase Does

Wire the client-side half of the E2E encrypted messaging system:

1. **KDF migration** - Migrate all server-side NaCl envelopes from AES-GCM + PBKDF2 to libsodium primitives + Argon2id (backend + client)
2. **Client-side crypto** - `libsodium-wrappers` WASM: key derivation at login, X25519 DH, XChaCha20-Poly1305 encrypt/decrypt, Ed25519 sign/verify
3. **Inbox + Compose UI** - `/messages` standalone route with Inbox and Contacts tabs, compose with `$username` addressing
4. **Attachment flow** - Full S3 encrypted attachments: client encrypts file → uploads ciphertext to MinIO → embeds per-attachment key (wrapped for all recipients) + S3 ref in message frontmatter
5. **Recovery phrase interstitial** - One-time full-screen display of BIP-39 24-word phrase at signup
6. **Admin signed-message verification** - Ed25519 signature verification on received messages; verified badge + expandable signature detail panel

---

<domain>
## Phase Boundary

**In scope:**

- Argon2id migration: swap PBKDF2 + AES-GCM in server-side NaCl envelopes (login envelope, recovery envelope, private key blobs) for Argon2id + libsodium secretbox. Update frontend derivation to match.
- `libsodium-wrappers` installed in frontend; initialized at app load; WASM await handled once.
- Key lifecycle: derive `nacl_master_key` at login (Argon2id(password, nacl_pbkdf2_salt) → unwrap login envelope), hold in React/Zustand memory for session.
- Message format: Markdown body with signed YAML frontmatter (`signature`, `version`, `routing`, `internal`, `attachments`, `body`). All messages must include a valid Ed25519 signature.
- Message bulk encryption: `crypto_box` (X25519 ephemeral DH + XChaCha20-Poly1305) - NOT AES-GCM.
- `POST /messages/send` integration from frontend; recipient input as `$username` (client hashes); sign payload before encrypt.
- `POST /messages/poll` integration: called at login (for badge/count), full decrypt on `/messages` enter.
- `/messages` standalone route:
  - **Inbox tab** - list of decrypted messages, verified badge on admin messages, expandable signature panel
  - **Contacts tab** - manage prior correspondents (auto-populated from sent/received history)
- Compose flow: `$username` addressing, sign + encrypt + send.
- S3 attachment flow: client-side encrypt (random secretbox key per file), upload ciphertext to MinIO, wrap per-attachment key for all recipients, embed in message frontmatter.
- Recovery phrase interstitial: full-screen, blocks onboarding continuation, copy-to-clipboard, "I have saved my phrase" checkbox unlocks Continue. One-time display only.
- Admin handle UI: surface `user.adminHandle` in Settings or profile (display only - claim was in Phase 14 backend).

**Not in scope:**

- WebSockets / real-time push (poll+probe for v1)
- Message edit/delete
- Delivery/read receipts
- Chatroom extensions
- Username change (admin !handle rename)
- Key revocation
- Emergency admin key recovery
- Rate limiting on poll endpoint
- Maximum message size enforcement UI
- `nacl_key_recovery_envelope_b64` "reveal phrase" re-view in Settings (one-time only)

</domain>

<decisions>
## Implementation Decisions

### Crypto Library

- **D-01:** Use `libsodium-wrappers` (WASM) for all client-side crypto. Confirmed explicitly in the phase name and in the canonical architecture spec.
- **D-02:** Initialize libsodium WASM once at app startup (await `sodium.ready` in a top-level provider before any auth or crypto operation runs). Not lazy - keys are needed across the whole app.
- **D-03:** `argon2-browser` (WASM) for client-side KDF (Argon2id). Replaces PBKDF2 in the login envelope derivation path once the migration completes.

### KDF Migration (AES-GCM + PBKDF2 → Argon2id + libsodium secretbox)

- **D-04:** Migrate ALL server-side NaCl envelopes from AES-GCM (Python `cryptography` library) + PBKDF2 to `libsodium secretbox` + Argon2id. Affected columns: `nacl_key_login_envelope_b64`, `nacl_key_recovery_envelope_b64`, `encrypted_x25519_private_b64`, `encrypted_ed25519_signing_b64`.
- **D-05:** Migration strategy: transparent at next login. On login, if server detects old AES-GCM format, derive with PBKDF2 to unwrap, then re-wrap with Argon2id + secretbox and persist. Version field or format prefix on the envelope blob to distinguish old vs new format.
- **D-06:** The Phase 10 `encrypted_user_key` / `pbkdf2_salt` system (symmetric data-at-rest encryption) is a SEPARATE system and is NOT migrated in Phase 15 - it remains unchanged.

### Message Crypto

- **D-07:** Message bulk encryption: `crypto_box` (ephemeral X25519 DH + XChaCha20-Poly1305). Sender generates ephemeral X25519 key pair per message, performs DH with each recipient's `public_key_b64`, encrypts with the shared secret. The ephemeral public key is included in the message routing frontmatter.
- **D-08:** Abandon AES-GCM for message payloads. The `encrypted_payload` stored in `undelivered_messages` is a libsodium `crypto_box` ciphertext.
- **D-09:** All messages MUST include a valid Ed25519 signature in the frontmatter. Client rejects unsigned or invalidly-signed messages at decrypt time. Regular `$username` senders sign with their own Ed25519 signing key.

### Message Format

- **D-10:** Markdown body with YAML frontmatter. Structure per the canonical spec:
  ```
  ---
  signature: <Ed25519 sig of: version + routing + internal + attachments + body>
  version: YYMMDD
  routing:
    from: [$username or !handle]
    to: [$username or !handle, ...]
    cc: [...]
    ccn: [...]    # blind CC - not visible to other recipients
  internal:
    - name, addr (s3://), key (per-attachment sym key wrapped for all recipients), hash
  attachments:
    - name, addr (s3://), key, hash, comments
  ---
  Markdown body. Internal images: ![alt](internal:name.png)
  ```
- **D-11:** `internal` vs `attachments` distinction: `internal` = embedded resources referenced in markdown body (images, etc.); `attachments` = traditional file attachments for download. Both use per-file symmetric keys wrapped for all recipients.

### Key Lifecycle

- **D-12:** Keys derived at login, immediately after password auth succeeds and the server returns the login envelope. Derive: `Argon2id(password, nacl_pbkdf2_salt)` → unwrap `nacl_key_login_envelope_b64` → `nacl_master_key` → decrypt `encrypted_x25519_private_b64` and `encrypted_ed25519_signing_b64`.
- **D-13:** All key material lives in memory only - React context or Zustand store. No key bytes written to `localStorage`, `sessionStorage`, or `IndexedDB`. Cleared on logout/tab close.
- **D-14:** Keys are needed across all app operations (messages, files, profile data) - hold for the full session, not just within the messaging feature.

### Frontend Key Type Extension

- **D-15:** Extend `User` type in `types.ts` to add: `adminHandle: string | null`, `recoveryPhrase: string | null` (transient - only set at signup, cleared after interstitial confirmation).

### Inbox + Compose UI

- **D-16:** `/messages` is a standalone route, added to `App.tsx` behind `ProtectedRoute`. Two tabs: **Inbox** and **Contacts**.
- **D-17:** Poll behavior: call `POST /messages/poll` once at login to get message count/presence (drive a badge count on the nav icon). Full message payloads are fetched and decrypted when user enters `/messages`.
- **D-18:** Recipient input in compose: type a `$username` or `!handle`. Client computes `sha256($username)` locally for routing; `!handle` sent as cleartext per D-03. Auto-suggest from Contacts tab entries.
- **D-19:** Contacts tab: auto-populated from prior sent/received message routing headers. User can label/delete contacts. Stored client-side (localStorage or IndexedDB - up to planner).

### Recovery Phrase Interstitial

- **D-20:** After signup API returns `recoveryPhrase`, render a full-screen interstitial (separate route or forced modal that blocks all navigation). Show 24 words in a numbered 4×6 grid + Copy All button.
- **D-21:** A checkbox "I have written down / saved my recovery phrase" must be checked before the Continue button is enabled. Cannot be skipped.
- **D-22:** After confirmation, clear `recoveryPhrase` from all state. No Settings re-view path in Phase 15.

### Attachment Handling

- **D-23:** Full S3 attachment flow per todo spec:
  1. User picks file in compose
  2. Client generates random 32-byte symmetric key
  3. Client encrypts file with `crypto_secretbox` (XChaCha20-Poly1305) using that key
  4. Upload ciphertext to MinIO via existing upload API (new endpoint or reuse ingestion upload)
  5. Wrap the per-attachment key for all recipients using `crypto_box` with each recipient's X25519 public key
  6. Embed `{name, addr: s3://…, key: <wrapped>, hash: sha256(plaintext)}` in the `attachments` frontmatter block
- **D-24:** `internal` block attachments (images embedded in markdown body) follow the same encrypt-then-upload pattern. Markdown renderer substitutes `internal:name.png` references with decrypted blob URLs.

### Admin Signed-Message Verification UX

- **D-25:** Messages from `!handle` senders display a verified badge (shield/checkmark icon) next to the sender name if signature is valid.
- **D-26:** Tapping/clicking the badge opens an expandable signature detail panel: sender handle, key fingerprint (first 16 chars of `signing_key_b64`), signature timestamp from frontmatter, "Verified by libsodium Ed25519" label.
- **D-27:** If signature is invalid for any message (admin or regular user), show an error state on the message bubble ("⚠ Signature invalid - this message may have been tampered with").

### the agent's Discretion

- Exact visual design of the verified badge icon and color
- Contacts tab persistence mechanism (localStorage vs IndexedDB)
- Loading skeleton design for inbox decryption
- Exact Argon2id parameters (time cost, memory cost, parallelism) - match Python argon2-cffi defaults for cross-platform compatibility
- Attachment upload progress UX
- Error handling for failed attachment downloads

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Full Architecture Spec (PRIMARY - read first)

- `.planning/todos/pending/2026-03-31-replace-obfuscate-email-with-envelope-based-admin-readable-encryption.md` - Complete E2E messaging architecture: message format, crypto stack, routing scheme, attachment design, admin identity model, open questions. This supersedes any earlier partial specs.

### Prior Phase Decisions

- `.planning/phases/13-crypto-identity-foundation-asymmetric-key-pairs-at-signup-username-generation-and-pii-encryption-replacing-obfuscated-email/13-CONTEXT.md` - Username format, key pair generation at signup, multi-envelope architecture, private key storage columns.
- `.planning/phases/14-e2e-messaging-backend-undelivered-messages-routing-table-pull-on-login-delivery-ttl-purge-and-zero-knowledge-recipient-hashing/14-CONTEXT.md` - Backend API contracts (POST /messages/send, POST /messages/poll, POST /admin/claim-handle), recipient hash scheme, delivery loop, TTL purge, BIP-39 recovery envelope backend.

### Existing Frontend Patterns

- `senso/src/lib/api-client.ts` - `apiRequest()` utility; follow for all new API calls
- `senso/src/features/notifications/NotificationPanel.tsx` - Panel/dropdown UI pattern reference
- `senso/src/features/auth/types.ts` - `User` type to extend with `adminHandle` + `recoveryPhrase`
- `senso/src/features/auth/storage.ts` - Token storage pattern (keys must NOT be stored here)
- `senso/src/App.tsx` + `senso/src/routes/` - Route registration pattern for `/messages`
- `senso/src/components/AppShell.tsx` - Nav structure, `MessageCircle` icon already imported

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apiRequest()` (`api-client.ts`): Handles auth headers, 401 intercept, token refresh. Use for all messaging API calls.
- `useAuth` + `AuthContext` (`features/auth/`): Access token, user object. Extend to hold decrypted key material.
- `NotificationPanel` pattern: dropdown/panel with async load on open. Reference for inbox panel design.
- `ConfirmDialog.tsx`: Modal confirmation pattern. Adapt for recovery phrase interstitial "I have saved" confirmation.
- `ProtectedRoute.tsx`: Route guard. Use for `/messages`.
- `AppShell.tsx` nav: `MessageCircle` already imported from Lucide - nav slot exists for inbox link.
- Lucide icons already available: `MessageCircle`, `CheckCircle`, `ShieldOff`, `AlertTriangle`, `Bell`.

### Established Patterns

- Feature-scoped API files: `coachingApi.ts`, `notificationsApi.ts` - create `messagesApi.ts` following same pattern.
- Route registration: import page component in `App.tsx`, add `<Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />`.
- i18n: all user-facing strings go in `senso/src/locales/it.json` and `en.json`. Keys follow dot notation: `messages.inboxTab`, `messages.composeButton`, etc.
- State management: feature-local React state + context. No global state library currently - add Zustand if key material store gets complex.

### Integration Points

- Auth flow: extend `AuthPayload` in `types.ts` to carry `recoveryPhrase` from signup response. Add `adminHandle` to `User` type.
- Key derivation: must happen inside `useAuth` after successful login/signup, before returning to caller.
- Message poll: call `POST /messages/poll` in the auth bootstrap (after token validation), store count in context for badge display.
- MinIO upload: existing ingestion upload API (`features/ingestion/api.ts`) may serve as reference; new encrypted-attachment upload endpoint likely needed.

</code_context>

<specifics>
## Specific Ideas

- Message format is Markdown with YAML frontmatter - the inbox should render the body as Markdown (use `react-markdown` or similar, already in stack if used in coaching).
- The `internal:name.png` URL scheme in markdown bodies requires a custom Markdown renderer component that resolves `internal:` refs to decrypted blob URLs.
- The todo spec explicitly calls out that sender identity is INSIDE the encrypted payload (routing frontmatter), not as cleartext metadata. The server only stores recipient hashes, not sender info.
- Admin `!handle` may have a SECOND key pair (one for `$username` private comms, one for `!handle` official comms). Phase 15 should assume single key pair for now and design the type so a second keypair can be added without breaking the interface.
- The todo notes that `crypto_sign_ed25519_sk_to_curve25519` allows deriving X25519 from Ed25519 - implementation may reuse a single keypair derivation if simpler for Phase 15.

</specifics>

<deferred>
## Deferred Ideas

- WebSocket real-time push - todo spec notes to "wrap the method so we can transition to websockets ASAP" - Phase 16
- Message edit/delete with revision field - Phase 16+
- Delivery/read receipts - Phase 16+
- Chatroom extensions (shared room hash routing) - Phase 17+
- Admin `!handle` rename + username change signing table - Phase 16+
- Key revocation - Phase 17+
- Emergency multi-party admin recovery - Phase 18+
- Second Ed25519 key pair for admin `!handle` official comms - Phase 16
- Rate limiting on `POST /messages/poll` - when abuse observed
- `nacl_key_recovery_envelope_b64` "reveal phrase" re-view in Settings - out of scope Phase 15
- BIP-39 wordlist customization (fiscal-themed) - open question in todo, defer

</deferred>

---

_Phase: 15-e2e-messaging-frontend_
_Context gathered: 2026-04-04_
