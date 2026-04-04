---
phase: 15
slug: e2e-messaging-frontend-client-side-libsodium-encrypt-decrypt-compose-and-inbox-ui-attachment-handling-and-admin-signed-message-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 15 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **Framework**          | vitest (frontend) + pytest (backend, for KDF migration tests)                                   |
| **Config file**        | `senso/vite.config.ts` (vitest config)                                                          |
| **Quick run command**  | `docker compose run --rm frontend pnpm test --run`                                              |
| **Full suite command** | `docker compose run --rm frontend pnpm test --run && docker compose run --rm api uv run pytest` |
| **Estimated runtime**  | ~45 seconds                                                                                     |

---

## Sampling Rate

- **After every task commit:** Run `docker compose run --rm frontend pnpm test --run`
- **After every plan wave:** Run full suite (frontend + backend)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Area                        | Test Type   | Automated Command                            | Status     |
| -------- | ---- | ---- | --------------------------- | ----------- | -------------------------------------------- | ---------- |
| 15-01-01 | 01   | 1    | libsodium init              | unit        | `pnpm test --run crypto`                     | ⬜ pending |
| 15-01-02 | 01   | 1    | argon2 KDF                  | unit        | `pnpm test --run kdf`                        | ⬜ pending |
| 15-01-03 | 01   | 1    | Argon2id interop            | integration | `pytest tests/test_kdf_interop.py`           | ⬜ pending |
| 15-02-01 | 02   | 1    | X25519 encrypt/decrypt      | unit        | `pnpm test --run crypto_box`                 | ⬜ pending |
| 15-02-02 | 02   | 1    | Ed25519 sign/verify         | unit        | `pnpm test --run sign`                       | ⬜ pending |
| 15-02-03 | 02   | 2    | Envelope migration          | integration | `pytest tests/test_envelope_migration.py`    | ⬜ pending |
| 15-03-01 | 03   | 2    | /messages route             | unit        | `pnpm test --run MessagesPage`               | ⬜ pending |
| 15-03-02 | 03   | 2    | Inbox tab render            | unit        | `pnpm test --run InboxTab`                   | ⬜ pending |
| 15-03-03 | 03   | 2    | Contacts tab + localStorage | unit        | `pnpm test --run ContactsTab`                | ⬜ pending |
| 15-04-01 | 04   | 2    | Compose + encrypt           | unit        | `pnpm test --run ComposeMessage`             | ⬜ pending |
| 15-04-02 | 04   | 2    | POST /messages/send         | integration | `pytest tests/test_messages_send.py`         | ⬜ pending |
| 15-05-01 | 05   | 3    | Recovery phrase display     | unit        | `pnpm test --run RecoveryPhraseInterstitial` | ⬜ pending |
| 15-05-02 | 05   | 3    | Attachment encrypt+upload   | unit        | `pnpm test --run AttachmentUpload`           | ⬜ pending |
| 15-06-01 | 06   | 3    | Verified badge (admin)      | unit        | `pnpm test --run VerifiedBadge`              | ⬜ pending |
| 15-06-02 | 06   | 3    | Signature invalid state     | unit        | `pnpm test --run SignatureInvalid`           | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `senso/src/features/messages/__tests__/crypto.test.ts` — libsodium encrypt/decrypt + Ed25519 sign/verify round-trip stubs
- [ ] `senso/src/features/messages/__tests__/kdf.test.ts` — Argon2id KDF stub with known vector
- [ ] `api/tests/test_kdf_interop.py` — Python Argon2id vs browser argon2-browser cross-language interop test vectors
- [ ] `api/tests/test_envelope_migration.py` — AES-GCM → secretbox migration round-trip test

_These must be created in Wave 0 (first plan) before any implementation tasks._

---

## Manual-Only Verifications

| Behavior                            | Why Manual                                    | Test Instructions                                                                |
| ----------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| Recovery phrase copy-to-clipboard   | Clipboard API not testable in jsdom           | Manually verify copied text matches displayed 24 words                           |
| Voice STT in Chrome (hold-to-speak) | Existing STT tests manual                     | Hold microphone button, speak, verify transcript appears                         |
| Attachment download + decrypt       | Requires live MinIO + key material in session | Upload file, send message to self, open inbox, click attachment, verify download |
| libsodium WASM load time            | Performance concern, not unit-testable        | Open DevTools Network tab, verify sodium.ready resolves < 500ms on cold load     |
| Admin verified badge visual         | UI rendering                                  | Sign in as admin, send message, verify shield badge appears on received message  |

---

## Crypto Interop Test Vector

Lock these vectors across Python and browser before any migration lands:

```
# Argon2id test vector (RFC 9106 Low Memory)
password = "password"
salt = b"\x00" * 16  # 16 zero bytes
time_cost = 3
memory_cost = 65536
parallelism = 4
hash_len = 32
expected_hex = "<derive and lock>"
```

**Both Python (`argon2-cffi`) and browser (`argon2-browser`) MUST produce identical output for this vector before any envelope migration ships.**

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 stubs
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
