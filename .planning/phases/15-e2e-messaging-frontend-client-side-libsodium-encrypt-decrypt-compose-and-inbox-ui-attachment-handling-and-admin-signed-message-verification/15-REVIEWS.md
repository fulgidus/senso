---
phase: 15
reviewers: [gemini]
reviewed_at: 2026-04-04T21:05:37Z
plans_reviewed:
  [15-01-PLAN.md, 15-02-PLAN.md, 15-03-PLAN.md, 15-04-PLAN.md, 15-05-PLAN.md, 15-06-PLAN.md]
---

# Cross-AI Plan Review — Phase 15: E2E Messaging Frontend

## Gemini Review

# Phase 15 Plan Review: E2E Messaging Frontend

## 1. Summary

Phase 15 is a comprehensive and technically rigorous implementation of client-side E2E encryption for the S.E.N.S.O. platform. The plans demonstrate a deep understanding of cryptographic primitives, specifically the interoperability between `libsodium-wrappers` (JS) and `PyNaCl` (Python). The strategy for a transparent KDF migration (PBKDF2 to Argon2id) via "re-wrap at login" is excellent, ensuring security upgrades without user friction. The architecture correctly prioritizes "memory-only" storage for sensitive key material and respects the destructive nature of the backend message polling system.

## 2. Strengths

- **Cryptographic Interoperability:** The explicit choice of `XSalsa20-Poly1305` (via `crypto_box_easy`) over `XChaCha20` ensures perfect compatibility with the backend `nacl.public.Box`. The use of RFC 9106 Low Memory params for Argon2id across both stacks is a best practice.
- **Transparent Migration:** The v1 to v2 envelope migration (Plan 15-03) is handled surgically. Detecting the version via the `v2:` prefix avoids database schema changes while allowing the system to upgrade security transparently during a standard login flow.
- **Key Lifecycle Management:** Defining a `CryptoKeyMaterial` type that is explicitly excluded from `User` serialization (Plan 15-02) effectively prevents accidental persistence of private keys to `localStorage`.
- **Bootstrapping Logic:** The "Poll Exactly Once" strategy in `AuthContext` (Plan 15-04) is the correct way to handle the backend's delivery-and-purge mechanism. This prevents the common bug where navigating to the inbox twice results in the second view being empty.
- **Zero-Knowledge Attachments:** The "per-attachment random key" pattern (wrapped for the recipient in the message frontmatter) is a robust way to handle files without the server ever having the ability to decrypt them.

## 3. Concerns

- **Stale Contact Keys (MEDIUM):** Plan 15-04-03 caches recipient public keys in `localStorage` contacts. If a recipient rotates their keys (e.g., via a future recovery flow), the sender's local cache will be stale, causing encryption for that recipient to fail or be insecure.
- **Bootstrap Race Condition (LOW):** There is a small window in `App.tsx` where the user might land on `/messages` before the bootstrap `pollMessages()` call in `useAuth` has resolved. `MessagesPage` might briefly show "No messages" before the context updates.
- **Memory Usage (LOW):** Storing all `polledMessages` (even if encrypted) in `AuthContext` is fine for now, but if the platform scales to large message histories, this could lead to memory pressure as the session grows.
- **Recovery Phrase Visibility (LOW):** The interstitial (Plan 15-06) is the only time the phrase is shown. If the user's browser crashes or they accidentally close the tab after the phrase is "cleared" but before they actually saved it, the account becomes unrecoverable.

## 4. Suggestions

- **Key Refresh Logic:** In `useEncryptAndSend.ts`, consider adding a check that fetches fresh keys from the API if the `sendMessage` call fails with a "Recipient key mismatch" (or similar) error, rather than solely relying on the contact cache.
- **Refined Bootstrap State:** Add a `isPolling` boolean to `AuthContext`. `MessagesPage` can then differentiate between "We haven't checked for messages yet" (loading spinner) and "We checked and found zero" (empty state).
- **Atomic Recovery Phrase Clearing:** Ensure the `updateUser({ recoveryPhrase: null })` call in Plan 15-06 is only triggered after the user explicitly dismisses the interstitial, and consider a "Download as PDF/Text" button alongside "Copy" to encourage durable storage.
- **YAML Schema Limitation:** When using `js-yaml`, explicitly use `schema: JSON_SCHEMA` or `FAILSAFE_SCHEMA` to prevent any potential constructor/function injection vulnerabilities, though modern `js-yaml.load` is generally safe.

## 5. Risk Assessment: LOW

The overall risk is **LOW**. The plans are highly detailed, include robust verification steps (cross-language interop tests), and follow established cryptographic standards. The most complex part—the dual-format KDF and envelope migration—is handled with enough fallback logic to prevent user lockouts. The dependency chain between waves is logical and well-sequenced.

**Final Verdict:** The plans are ready for execution. The attention to detail regarding libsodium's `crypto_box_easy` vs `sumo` builds is a highlight of technical competence.

---

## Consensus Summary

_Note: codex CLI unavailable; claude skipped for independence. Consensus from Gemini + internal plan-checker (previous verification pass)._

### Agreed Strengths

- **Crypto interoperability** — explicit `crypto_box_easy` = XSalsa20-Poly1305 (not XChaCha20), compatible with PyNaCl Box. Both reviewers flagged this as a key correctness decision.
- **Poll-once pattern** — single `pollMessages()` at bootstrap, cached in `AuthContext.polledMessages`. Prevents double-delivery bug where navigating to inbox twice clears messages.
- **Transparent envelope migration** — `v2:` prefix detection allows AES-GCM → secretbox migration without schema changes. Both reviewers found this elegant.
- **Memory-only key material** — `CryptoKeyMaterial` type kept outside `User` serialization. Keys cleared on `signOut()`.
- **Cross-language Argon2id interop test** — RFC 9106 Low Memory params locked identically in Python and browser; interop hex vector must be manually locked before Wave 1 ships.

### Agreed Concerns

| Severity | Concern                                                                                                                                                                                                                                                          | Source |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| MEDIUM   | **Stale contact key cache** — if a recipient rotates keys (recovery flow), locally cached X25519 key sends ciphertext the recipient can't decrypt. No refresh-on-failure logic in compose flow.                                                                  | Gemini |
| LOW      | **Bootstrap race condition** — `/messages` might render "No messages" briefly before `polledMessages` resolves in `AuthContext`. `isPolling` flag missing.                                                                                                       | Gemini |
| LOW      | **Recovery phrase tab-close risk** — phrase is cleared after user confirms; if browser crashes between interstitial dismiss and app navigation, account is unrecoverable. `isPolling` boolean would help differentiate "not yet polled" from "polled and empty". | Gemini |
| LOW      | **js-yaml safe loading** — use `schema: JSON_SCHEMA` in `yaml.load()` calls to guard against YAML deserialization edge cases.                                                                                                                                    | Gemini |

### Divergent Views

None — single external reviewer (Gemini). Internal plan-checker found 3 blocking issues (all fixed before this review ran).

### Actionable Items Before Execution

1. **Add `isPolling` state to AuthContext** (15-04-03 or 15-02-03) — lets `MessagesPage` show a spinner instead of empty state during bootstrap poll.
2. **Add key refresh-on-fail in `useEncryptAndSend`** — if `sendMessage` returns a "recipient key mismatch" error (or any encryption failure), re-fetch keys via `getRecipientPublicKeys()` and retry once.
3. **Use `yaml.load(content, { schema: yaml.JSON_SCHEMA })`** in `parseMessage.ts` instead of bare `yaml.load()`.
4. **Add "Download as text" button** to recovery phrase interstitial alongside "Copy all" — encourages durable backup.

### Overall Risk: LOW

Plans are complete, crypto-correct, and well-sequenced. The 3 blocking issues found in the internal verification pass have been fixed. Gemini rates risk LOW with high confidence in the crypto implementation choices.
