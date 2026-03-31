# Phase 10: Transparency & Security - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Three distinct sub-deliverables:

1. **About page** — A public `/about` page (accessible without auth) plus a mirrored in-app Settings > About section. Explains how S.E.N.S.O. works, what data is stored, how AI is used, and includes disclaimers. Written for a 20-year-old with no financial background.

2. **Encryption at rest** — Tiered encryption strategy across database columns and object storage. Tier 1 (raw personal content) and Tier 3 (identity fields) get E2E user-key encryption. Tier 2 (behavioral/analytical data) gets server-side AES.

3. **LLM no-data-retention** — Best-effort no-retention headers on all LLM calls, plus a per-user "Strict privacy mode" toggle in Settings that restricts to only providers with confirmed no-retention contracts and disables ElevenLabs TTS when active.

This phase does NOT include the full PGP multi-recipient architecture, multi-profile support, or joint-account features — those are documented in Deferred Ideas as the next-milestone E2E roadmap.

</domain>

<decisions>
## Implementation Decisions

### About Page

- **D-01:** Two entry points: public `/about` route (no auth required, accessible to hackathon judges) AND a Settings > About section for authenticated users. Both render the same content.
- **D-02:** Page structure — full transparency sections:
  - What is S.E.N.S.O.
  - How it works (step-by-step: upload → profile → ask → answer → learn/act)
  - What data we store (honest, plain-language description of each data tier)
  - How AI is used (general statement — no specific provider names, no model names)
  - Safety & boundaries (persona governance, what the AI won't do)
  - Legal disclaimers (not financial advice, educational only)
- **D-03:** AI technology framing — Do NOT name specific LLM providers or models. Use language like: "We use AI language technology to analyze your documents and generate personalized responses." Include a forward-looking note: "In future versions, we plan to introduce retrieval-augmented generation (RAG) and custom tools to ensure information retrieval is properly sanitized and fully isolated per user."
- **D-04:** Audience tone — Simple, direct, jargon-light. Written for 18-30-year-olds with low financial literacy. Same voice as the coaching personas.
- **D-05:** The About page is a static/semi-static React component — no API call needed. Content lives in i18n locale files (`it.json` / `en.json`) per the project i18n convention.

### Encryption Architecture — Tiered Model

- **D-06:** Three-tier encryption model:
  - **Tier 1 — E2E (user key):** Raw personal content that the user authored or uploaded. Fields: `extracted_documents.raw_text`, `chat_messages.content`, `financial_timeline.user_context_raw`, `financial_timeline.user_context_distilled`, `moderation_log.raw_input` is **NOT** T1 — see T2. MinIO uploaded files (PDFs, CSVs, images) encrypted with SSE using per-user key.
  - **Tier 2 — Server AES (batch-analyzable):** Behavioral and analytical data needed for server-side processing. Fields: `transactions.description`, `user_profiles.income_summary` (JSON), `user_profiles.category_totals` (JSON), `user_profiles.insight_cards` (JSON), `user_profiles.coaching_insights` (JSON), `moderation_log.raw_input` (post-processable for abuse analytics — moved from T1 per user decision). Single `ENCRYPTION_KEY` env var.
  - **Tier 3 — E2E (user key):** Identity fields. Fields: `users.first_name`, `users.last_name` (+ future: address, DOB if added). Same user key as T1.
  - **Tier 4 — Plaintext:** Operational data with no personal content: session tokens, job status, notification types, moderation action metadata, timestamps, booleans.

- **D-07:** E2E key mechanism — **Wrapped key architecture** (future-proof for passkeys/OAuth/biometrics):
  - At signup: generate a random 32-byte `user_data_key` (AES-256).
  - Store it wrapped: `encrypted_user_key = encrypt(user_data_key, key=PBKDF2(password + salt) XOR server_secret)`. Store `encrypted_user_key` + `pbkdf2_salt` in `users` table.
  - At login: unwrap `user_data_key`, hold in server-side session context for the request lifetime (NOT in JWT claims, NOT client-side).
  - OAuth/Google users: key wrapped with `PBKDF2(server_secret + user_id)` — not true E2E but same interface. When the user adds a password, re-wrap with password-derived key.
  - Future passkeys/biometrics: re-wrap the stored key with the new authenticator-derived secret — no data migration.
  - Optional recovery phrase at onboarding: user can generate a recovery phrase that wraps the key as a fallback (offline ECDH or BIP39-derived key).
  - Admin backdoor (for testing period): configurable server-side passpartout key that can wrap/unwrap any user key — governed by `is_admin` + audit log.
  - Architecture supports future multi-profile and joint-account features: each profile gets its own data key; shared-access profiles get the profile key wrapped for each authorized user.

- **D-08:** T1/T3 column encryption implementation: `sqlalchemy-utils` `EncryptedType` on ORM model fields. Python `cryptography` library (AES-GCM preferred over Fernet for nonce-based AEAD). Per-user key injected through FastAPI request context (dependency injection, not global state).

- **D-09:** T2 column encryption implementation: same `sqlalchemy-utils` `EncryptedType` but using the server-wide `ENCRYPTION_KEY` env var. Transparent to the ORM layer — no changes to query logic needed.

- **D-10:** Schema changes via `_add_missing_columns()` pattern in `session.py` (no Alembic). New columns added to `users` table: `encrypted_user_key` (Text), `pbkdf2_salt` (String). Existing plaintext data in T1/T2/T3 columns must be migrated to ciphertext on first startup after deploy (one-time migration in `_add_missing_columns()` or a separate startup migration step).

- **D-11:** MinIO file encryption: Enable SSE (Server-Side Encryption) at bucket level in MinIO configuration. For true per-user E2E, files are encrypted client-side before upload using the user's data key, then stored in MinIO. MinIO SSE provides a second layer. Implementation agent's discretion on whether to encrypt at the HTTP request level (client-side encryption in the upload API endpoint using the user's unwrapped key) or rely solely on MinIO SSE.

### LLM No-Data-Retention

- **D-12:** Best-effort no-retention headers injected on every LLM call in `llm.py`:
  - **OpenAI:** `openai-beta: no-store` header via `default_headers` in `OpenAI(**kwargs_init)`.
  - **OpenRouter:** `X-Data-Policy: no-store` header if supported (needs verification — implementation agent checks OpenRouter docs). Fallback: no header (best-effort).
  - **Gemini:** No header needed — Google API Terms of Service already exclude API data from model training. Document this in About page.

- **D-13:** Per-user **Strict Privacy Mode** toggle:
  - New boolean column `strict_privacy_mode` in `users` table (default `false`), added via `_add_missing_columns()`.
  - When `true`: coaching routes only use providers with confirmed contractual no-retention guarantee. ElevenLabs TTS is disabled (pending EULA verification — implementation agent must check ElevenLabs data retention policy and mark TTS as disabled in strict mode if EULA is unclear). User sees a privacy badge/indicator in the chat UI.
  - When `false`: best-effort headers on all calls (current default behavior + header injection from D-12).
  - Settings screen gets a new "Privacy" section with the toggle and plain-language explanation of tradeoffs (performance/TTS impact).

- **D-14:** About page describes the no-retention approach honestly: "We request that AI providers do not use your data for training. Some providers contractually guarantee this. You can enable Strict Privacy Mode in Settings to restrict AI processing to only those providers."

- **D-15:** ElevenLabs EULA check — implementation agent must verify ElevenLabs data retention/training policy before deciding whether standard mode includes TTS or strict mode always disables it.

### Agent's Discretion

- Exact PBKDF2 iteration count and hash algorithm (SHA-256 recommended, 600,000+ iterations per OWASP 2024).
- Whether T1 file encryption is implemented at the FastAPI upload endpoint (server encrypts before writing to MinIO) or as client-side encryption in the browser (true E2E for files).
- Exact AES-GCM nonce strategy (random nonce per ciphertext, prepended to the stored value).
- Recovery phrase format (BIP39 wordlist or custom) — only if implementing optional recovery in this phase.
- Admin backdoor implementation details (key wrapping mechanism, audit log schema).
- Exact UI design for privacy mode badge in chat.
- Which OpenRouter header name to use (verify against current OpenRouter API docs).
- Migration strategy for existing plaintext data (can be a startup migration or a one-off admin command).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Prior Foundation
- `.planning/ROADMAP.md` — Phase 10 goal and boundary.
- `.planning/phases/07-streaming-nice-to-have-polish/07-CONTEXT.md` — PII safety cross-check (D-15 through D-17), soft enforcement decisions. Encryption at rest was explicitly deferred from Phase 7 to here.
- `.planning/phases/09-llm-financial-intelligence-with-categorization-tagging-timeline-inference-and-crowdsourced-merchant-mapping/09-CONTEXT.md` — D-19 (moderation_log schema), D-23 (notifications schema), D-14 (financial_timeline schema). Phase 10 adds encryption to columns defined in Phase 9.

### Existing Code to Extend
- `api/app/ingestion/llm.py` — Phase 10 adds `default_headers` with no-retention headers to `_openai_compat_complete`, `_openai_compat_complete_with_tools`, and `_openai_compat_vision`. Also adds strict-mode provider filtering.
- `api/app/db/models.py` — Phase 10 adds `encrypted_user_key`, `pbkdf2_salt`, `strict_privacy_mode` columns to `User`. Changes T1/T2/T3 column types to `EncryptedType`.
- `api/app/db/session.py` — `_add_missing_columns()` idempotent migration pattern. Phase 10 adds new columns here plus the data migration step for existing plaintext → ciphertext.
- `api/app/core/config.py` — Phase 10 adds `ENCRYPTION_KEY` env var to `Settings` dataclass.
- `senso/src/features/settings/` — Phase 10 adds a "Privacy" section with the strict privacy mode toggle.
- `senso/src/App.tsx` — Phase 10 adds `/about` public route (outside the `ProtectedRoute` wrapper).
- `senso/src/locales/it.json`, `senso/src/locales/en.json` — All About page strings go here per i18n convention.

### Project Constraints
- `CONVENTIONS.md` (in AGENTS.md) — No Alembic, `_add_missing_columns()` only. No mixed ORM + raw connection on same table. All user-facing strings in locale files.
- `personas/boundaries.md` — Tone and safety framing for About page disclaimers must align with existing persona governance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/app/ingestion/llm.py` — `_openai_compat_complete`, `_openai_compat_complete_with_tools`, `_openai_compat_vision` all build `kwargs_init = {"api_key": api_key, "timeout": timeout}`. Phase 10 adds `"default_headers": {"openai-beta": "no-store"}` here.
- `api/app/db/session.py` — `_add_missing_columns()` is the established migration pattern. Phase 10 uses it for new columns on `users` and the encryption migration.
- `api/app/core/config.py` — `Settings` dataclass already has `jwt_secret` as a string field. `ENCRYPTION_KEY` follows the same pattern.
- `senso/src/features/settings/` — Existing settings screen. Phase 10 adds a Privacy section here.
- `senso/src/App.tsx` — Public `/learn/*` route is already outside `ProtectedRoute`. The `/about` route follows the same pattern.
- `docker-compose.yml` — MinIO is already configured with a dedicated `minio_bucket` for user uploads. SSE configuration is added at the MinIO service level.

### Established Patterns
- **No Alembic** — All DB schema changes via idempotent `_add_missing_columns()` in `session.py`. Phase 10 adds new columns + a data migration step in the same function.
- **Settings as frozen dataclass** — `api/app/core/config.py` uses `@dataclass(frozen=True)`. New `ENCRYPTION_KEY` field follows the same pattern.
- **i18n strings in locale files** — Every user-facing string in `senso/src/locales/it.json` + `en.json`. About page content is no exception.
- **Public routes in App.tsx** — `/learn/*` is already publicly accessible. `/about` follows the same pattern (no `ProtectedRoute` wrapper).
- **FastAPI dependency injection** — `get_llm_client()` is already a FastAPI dependency. Per-user encryption key will follow the same DI pattern (`get_user_encryption_key()` dependency that reads the unwrapped key from the session context).

### Integration Points
- `users` table gets 3 new columns: `encrypted_user_key`, `pbkdf2_salt`, `strict_privacy_mode`.
- `_openai_compat_complete` (and vision/tools variants) in `llm.py` gets `default_headers` parameter for no-retention header injection.
- `LLMClient.complete()` and `vision()` and `complete_with_tools()` need a `strict_mode: bool = False` parameter that filters provider chain to no-retention-confirmed providers only.
- `GET/PATCH /auth/me` or `GET/PATCH /settings` endpoints need to expose `strict_privacy_mode` field.
- Auth login flow (`POST /auth/login`) must unwrap `user_data_key` and make it available for the session.
- New `/about` route in `App.tsx` — outside protected routes, renders static i18n content.

</code_context>

<specifics>
## Specific Ideas

- **AI provider framing on About page:** No specific provider names or model names. Use "AI language technology". Include a forward-looking note: "In future versions, we plan to introduce retrieval-augmented generation (RAG) and custom tools to ensure that information retrieval is properly sanitized and fully isolated per user."
- **Wrapped key architecture rationale:** The wrapped-key approach was chosen specifically because it is future-proof for passkeys, biometrics, and OAuth-only users. The stored key is never lost — only the wrapper changes when the auth method changes. Multi-profile and joint-account access (future features) extend naturally: each profile has its own data key, wrapped separately for each authorized user.
- **Strict Privacy Mode UX:** When enabled, show a small privacy badge in the chat interface. TTS is silently disabled with a clear explanation when the user tries to activate voice ("Strict privacy mode is active — voice features require AI providers that cannot currently confirm no-data-retention. Disable strict mode in Settings to re-enable voice.").
- **Moderation raw_input classification:** User explicitly moved `moderation_log.raw_input` from T1 (E2E) to T2 (server AES) because moderation data must be post-processable for large-scale abuse analytics. This is intentional — moderation logs are an admin/system asset, not a user-private asset.

</specifics>

<deferred>
## Deferred Ideas

- **PGP multi-recipient architecture** — Full PGP-style key wrapping where multiple admins can be added as passpartouts, with independent key revocation per admin. Architecturally compatible with D-07 but adds significant key management complexity. Post-hackathon milestone.
- **Client-side file encryption (true browser E2E for uploads)** — Encrypting files in the browser before upload (WebCrypto API) so the server never sees plaintext file bytes. Compatible with D-07 key design but requires significant frontend work and complicates the upload pipeline. Implementation agent may choose server-side encryption at the FastAPI endpoint as the simpler equivalent.
- **Multi-profile support per user** — Each profile gets its own data key wrapped for the user. Profiles can be shared with other users (joint account). Architecturally supported by D-07 but not in scope for Phase 10.
- **Recovery phrase UI** — Optional BIP39-style recovery phrase at onboarding. The architecture supports it (D-07 mentions it) but the full onboarding flow change is deferred. Implementation agent may add a minimal version if time permits.
- **ElevenLabs EULA review → policy decision** — Whether ElevenLabs qualifies for strict privacy mode or is always disabled in strict mode. Needs EULA/DPA review. Deferred to implementation agent to verify and decide.
- **OpenRouter no-retention header verification** — Whether `X-Data-Policy: no-store` is a real OpenRouter header or needs a different approach. Implementation agent must check current OpenRouter API docs.
- **Registration confirmation email** — Out of scope for this phase (noted also in Phase 9 deferred).

</deferred>

---

*Phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention*
*Context gathered: 2026-03-31*
