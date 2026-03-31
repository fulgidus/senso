# Phase 10: Transparency & Security - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention
**Areas discussed:** About page content, Encryption scope, Encryption approach, LLM no-data-retention

---

## About Page Content

| Option | Description | Selected |
|---|---|---|
| Transparency-first | What data is collected, how AI works, disclaimers, safety boundaries - written for 20-year-olds | ✓ |
| Marketing/pitch copy | Mission statement, team/hack credits, no technical depth | |
| Disclaimer-only | Only legal/safety disclaimers | |

**User's choice:** Transparency-first

---

| Option | Description | Selected |
|---|---|---|
| Public page (/about) | Anyone can read it without logging in | |
| In-app only | Only accessible when logged in | |
| Both public + in-app | Public /about page + Settings > About section in-app | ✓ |

**User's choice:** Both public + in-app

---

| Option | Description | Selected |
|---|---|---|
| Full transparency sections | Sections: What is S.E.N.S.O. / How it works / What data we store / Which AIs we use / Safety & boundaries / Disclaimers | ✓ |
| Single scrolling narrative | Mission, AI role, disclaimer in one scroll | |
| Agent's discretion | You decide the structure | |

**User's choice:** Full transparency sections

**Notes:** User clarified — do NOT name specific LLM providers or models. Use generic "AI language technology" framing. Include a forward-looking note about RAG and custom tools for data sanitization and per-user isolation. Quote: *"Don't be specific about which LLMs provider:model(s) we use, just explain we rely on LLM tech, and in the future we might roll-out RAG and/or custom tools to ensure information retrieval is properly sanitized and isolated by user."*

---

## Encryption Scope

### Initial scoping discussion

User questioned: admin-configurable scope? Runtime toggle? E2E vs server-side? Key derivation with passkeys/OAuth compatibility?

The agent provided a trade-off breakdown:
- E2E is incompatible with AI coaching (backend needs plaintext to reason over transactions)
- Admin-configurable encryption scope creates dangerous migrate-on-toggle complexity
- Server-side envelope encryption protects against the most common breach (DB dump without server config)
- Wrapped key architecture is future-proof for passkeys/OAuth/biometrics

### Tiered model discussion

User proposed a tiered data classification framework and independently landed on the privacy-first fintech architecture pattern (decouple identity from behavioral data). User noted this is a strong selling point for banks and enterprise customers.

User explicitly moved `moderation_log.raw_input` from E2E to server AES because: *"moderated raw content is to be post-processable for large-scale analytics."*

| Option | Description | Selected |
|---|---|---|
| T1 + T3 E2E, T2 server AES | Raw personal content + identity = E2E; behavioral = server AES | ✓ |
| All tiers E2E including behavioral | Everything E2E even if it breaks batch analytics | |

**User's choice (after one re-ask - original answer was accidental):** T1 + T2 server AES + T3 E2E with moderation raw_input moved to T2.

### E2E key design

User raised concern about future auth methods (passkeys, biometrics, SSO/OAuth). The agent presented four options:

| Option | Description | Selected |
|---|---|---|
| Password-derived session key | PBKDF2 from password, breaks with OAuth | |
| Server-escrowed wrapped key | Random key wrapped with password-derived secret; re-wrap on auth method change | ✓ |
| Client-only key | localStorage/IndexedDB, no server escrow | |
| Server-managed per-user key | Server holds key, not true E2E | |

**User's choice:** Wrapped key architecture

**Notes:** User expressed enthusiasm for the architecture and surfaced future features: optional recovery phrase, admin backdoor for testing period, future multi-profile support, joint accounts, business/personal data segregation. Quote: *"one day we'll have passkeys... biometrics... sso-oauth... this way we can also allow users to provision new authentication methods, generate a custom recovery phrase for shtf access (optional) and even inject in the process a backdoor for the testing period..."*

---

## Encryption Approach

| Option | Description | Selected |
|---|---|---|
| SQLAlchemy EncryptedType + Python cryptography | Transparent ORM encryption, matches existing patterns | ✓ |
| pgcrypto in Postgres | SQL-level encryption/decryption | |
| Manual repository-layer encryption | Custom encrypt/decrypt in repository functions | |

**User's choice:** SQLAlchemy EncryptedType + Python cryptography

---

## LLM No-Data-Retention

| Option | Description | Selected |
|---|---|---|
| Header injection per provider | OpenAI: `openai-beta: no-store`. OpenRouter: verify. Gemini: no header needed. | ✓ |
| Provider selection policy only | Only use providers with contractual no-retention | |
| Prompt-level instruction | System prompt tells LLM not to store data | |

**User's choice:** Header injection (best-effort) + strict privacy mode toggle

**Notes:** User wanted users to be informed of the limitation. Quote: *"Header injection is best effort... users might want more assurance... user must be informed that apart from their first name the llm doesn't have access to pii during normal operation; that we always try to ask for no data retention when analyzing files or other data sources."*

User noted ElevenLabs EULA must be checked before deciding whether TTS is disabled in strict mode.

| Option | Description | Selected |
|---|---|---|
| Strict privacy mode toggle | Per-user boolean in settings. On: only no-retention-confirmed providers, TTS disabled. Off: best-effort. | ✓ |
| Admin-level policy only | System-wide setting, not per-user | |
| Always strict, no toggle | All users always get max privacy | |

**User's choice:** Strict privacy mode toggle (per-user, stored in `users` table, exposed in Settings screen)

---

## Agent's Discretion

- Exact PBKDF2 iteration count and hash algorithm
- Whether T1 file encryption is client-side (browser WebCrypto) or server-side at upload endpoint
- AES-GCM nonce strategy
- Recovery phrase format (if implemented in this phase)
- Admin backdoor key wrapping details and audit log schema
- Privacy mode badge UI design in chat
- OpenRouter no-retention header name (needs verification against current docs)
- ElevenLabs EULA check outcome and policy decision
- Migration strategy for existing plaintext data

## Deferred Ideas

- PGP multi-recipient architecture with independent admin passpartout revocation
- Client-side browser file encryption (WebCrypto API)
- Multi-profile support per user (each with own data key)
- Recovery phrase UI at onboarding
- Joint account / business+personal data segregation
- Registration confirmation email (noted in Phase 9 also)
