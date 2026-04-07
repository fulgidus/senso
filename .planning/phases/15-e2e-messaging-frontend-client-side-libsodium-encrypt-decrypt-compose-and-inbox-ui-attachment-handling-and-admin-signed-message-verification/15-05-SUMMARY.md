---
plan: "15-05"
phase: "15"
status: complete
completed: 2026-04-05
tasks_completed: 3
commits: [fb5c7d2, 048fb9d, cb7e87e]
---

# Plan 15-05 SUMMARY - Compose UI + Client-Side Encrypt + Send

## What Was Built

- **ComposeMessage.tsx**: full-screen modal compose form - `$username`/`!handle` recipient
  input with `$`/`!` prefix validation and auto-suggest from localStorage contacts (5 results).
  Markdown body textarea, file attachment picker, loading/error state, i18n throughout.
- **useEncryptAndSend.ts**: complete E2E send pipeline:
  1. `getRecipientPublicKeys()` with key caching to contacts
  2. `computeRecipientHash()` - `sha256($username)` including `$`; `!handle` cleartext
  3. Optional attachment: `encryptAttachment()` → upload → per-file key wrapped for recipient
  4. YAML frontmatter built WITHOUT signature, then signed with Ed25519 (64-byte key)
  5. Full plaintext assembled → X25519 DH encrypt (XSalsa20-Poly1305 via `crypto_box_easy`)
  6. `sendMessage()` with one retry on failure using fresh-fetched keys (Review amendment #2)
  7. `upsertContact()` after success with latest keys + `lastSeen`
- **ComposeMessage.test.tsx**: 4 tests - empty disabled state, prefix validation, valid send flow
- **useEncryptAndSend.test.ts** (in crypto.test.ts): sha256 prefix correctness test
- **i18n**: `messages.compose.*` and `messages.contacts.*` keys in both `it.json` + `en.json`

## Key Files Created/Modified

- `senso/src/features/messages/ComposeMessage.tsx` (new)
- `senso/src/features/messages/useEncryptAndSend.ts` (new, 180 lines)
- `senso/src/features/messages/__tests__/ComposeMessage.test.tsx` (new)
- `senso/src/i18n/locales/it.json` (compose + contacts keys)
- `senso/src/i18n/locales/en.json` (compose + contacts keys)

## Self-Check: PASSED

- [x] sha256($username) includes $ prefix - verified in test
- [x] !handle sent as cleartext (not hashed)
- [x] Key refresh-on-fail retry implemented (review amendment #2)
- [x] Ed25519 sign covers frontmatter-without-signature + body
- [x] Attachment per-file key wrapped for recipient in frontmatter
- [x] All 73 frontend tests pass
