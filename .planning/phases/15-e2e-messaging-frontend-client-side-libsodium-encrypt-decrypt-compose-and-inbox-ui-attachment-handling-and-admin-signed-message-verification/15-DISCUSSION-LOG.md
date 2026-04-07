# Phase 15: E2E Messaging Frontend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 15-CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 15-e2e-messaging-frontend
**Areas discussed:** Crypto library + key lifecycle, Inbox + Compose UI, Recovery phrase display, Attachment handling, Admin signed-message verification

---

## Crypto Library + Key Lifecycle

| Option                         | Description                                                    | Selected |
| ------------------------------ | -------------------------------------------------------------- | -------- |
| libsodium-wrappers (WASM)      | Battle-tested, covers X25519 + Ed25519 + secretbox, async init | ✓        |
| @noble/curves + @noble/ciphers | Pure JS, tree-shakeable, smaller bundle, manual assembly       |          |
| tweetnacl                      | Tiny pure-JS, unmaintained, no AES-GCM mismatch                |          |

**Key storage:**

| Option                                | Description                                            | Selected |
| ------------------------------------- | ------------------------------------------------------ | -------- |
| Memory only (React context / Zustand) | Gone on tab close, cleanest security posture           | ✓        |
| sessionStorage                        | Survives navigation, readable by XSS                   |          |
| IndexedDB (non-extractable)           | Most ergonomic long-term, over-engineered for Phase 15 |          |

**Key derive timing:**

User's answer (freeform): "these keys are needed for all kind of operations that needs access/edit to personal data, files, messages, etc... we need to have them on hand at all times"

→ Interpreted as: derive at login, hold in memory for full session.

---

## Inbox + Compose UI

| Option                     | Description                                      | Selected                    |
| -------------------------- | ------------------------------------------------ | --------------------------- |
| Standalone /messages route | Clean URL, back-button, deep-linkable            | ✓ (+ notification redirect) |
| Slide-over / drawer        | Like NotificationPanel, cramped for messaging    |                             |
| Modal overlay              | Hides context, not right for full messaging flow |                             |

**Compose addressing (freeform answer):**
"$username + contacts from previous comms + we need a contacts management tab inside /messages to manage it"

→ Contacts tab added to scope; auto-populated from prior conversation routing headers.

**Poll timing (freeform answer):**
"The PRESENCE of new messages on polling, the actual messages on /messages enter"

→ Poll at login for count/badge only; full decrypted payload fetched when entering /messages.

---

## Recovery Phrase Display

| Option                                       | Description                                         | Selected |
| -------------------------------------------- | --------------------------------------------------- | -------- |
| Full-screen interstitial (blocks onboarding) | Strongest guarantee user sees it; checkbox required | ✓        |
| Modal overlay                                | Can be closed without confirming                    |          |
| Banner/toast with 'view phrase' action       | Non-blocking, requires Settings re-view path        |          |

**Re-view in Settings:**

| Option                                | Description                                 | Selected |
| ------------------------------------- | ------------------------------------------- | -------- |
| No - one-time display only            | Matches backend design; simpler             | ✓        |
| Yes - password re-auth reveals phrase | More user-friendly but adds Settings screen |          |

---

## Attachment Handling

User directed to canonical spec file rather than picking a preset option.

File read: `.planning/todos/pending/2026-03-31-replace-obfuscate-email-with-envelope-based-admin-readable-encryption.md`

→ Full S3 attachment flow as spec'd: client-side encrypt + MinIO upload + per-attachment symmetric key wrapped for all recipients + embed in message frontmatter. `internal` vs `attachments` block distinction confirmed.

---

## Crypto Alignment (KDF + bulk cipher)

| Option                                               | Description                                     | Selected |
| ---------------------------------------------------- | ----------------------------------------------- | -------- |
| Stick with PBKDF2 - match existing backend           | No migration needed                             |          |
| Migrate to Argon2id - update both backend and client | Follow todo spec; stronger against GPU cracking | ✓        |

| Option                                      | Description                                            | Selected |
| ------------------------------------------- | ------------------------------------------------------ | -------- |
| XChaCha20-Poly1305 for messages (libsodium) | Follow todo spec                                       | ✓        |
| AES-GCM for everything                      | Consistent with existing envelopes, deviates from spec |          |

User's exact words: "XChaCha20-Poly1305. Abandon AES-GCM"

→ Interpreted as: migrate ALL NaCl envelopes from AES-GCM to libsodium secretbox + Argon2id. Message payloads use crypto_box (X25519 DH + XChaCha20-Poly1305).

---

## Admin Signed-Message Verification

| Option                                       | Description                                 | Selected |
| -------------------------------------------- | ------------------------------------------- | -------- |
| Verified badge only                          | Checkmark if valid, warning if invalid      |          |
| Silent verification                          | Nothing shown if valid, error if invalid    |          |
| Verified badge + expandable signature detail | Badge for quick view, panel for power users | ✓        |

**Unsigned messages:**

| Option                                               | Description                               | Selected |
| ---------------------------------------------------- | ----------------------------------------- | -------- |
| Regular $username messages are unverified but normal | No badge, no warning for regular users    |          |
| All messages must be signed - reject unsigned        | Forces Ed25519 signature on every message | ✓        |

---

## the agent's Discretion

- Exact visual design of verified badge
- Contacts tab persistence (localStorage vs IndexedDB)
- Loading skeleton for inbox decryption
- Argon2id parameters (defer to match argon2-cffi defaults)
- Attachment upload progress UX
- Error handling for failed attachment downloads

## Deferred Ideas Noted

- WebSockets (Phase 16)
- Message edit/delete (Phase 16+)
- Delivery/read receipts (Phase 16+)
- Chatroom extensions (Phase 17+)
- Admin !handle second key pair (Phase 16)
- Key revocation, emergency recovery (Phase 18+)
- Recovery phrase re-view in Settings (explicitly deferred)
