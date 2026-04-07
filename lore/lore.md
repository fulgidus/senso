# S.E.N.S.O. — Project Lore

*A flowing history of how S.E.N.S.O. was built, phase by phase.*

---

S.E.N.S.O. — *Sistema Educativo per Numeri, Spese e Obiettivi* — is a voice-first AI financial education assistant for young adults. Its story is fifteen phases of deliberate, incremental construction, each one building exactly on the last.

---

## Phase 1 — Runtime & Account Foundation

S.E.N.S.O. began with the unglamorous but essential work of making the app exist: a Vite + React frontend (Next.js deliberately ruled out), a FastAPI backend owning all auth logic, and Docker Compose as the single-command runtime. Email/password signup and login landed first, followed by Google OAuth with a graceful fallback to email auth when the provider is unavailable. Sessions are JWT-based — short-lived access tokens with 7-day rolling refresh rotation stored in localStorage — giving the app a reliable identity layer that every downstream phase could build on. Three waves of execution established the full auth handshake, wired Supabase-backed Postgres, and validated the session persistence story end-to-end before any financial logic was written.

---

## Phase 2 — Financial Input Ingestion

With accounts established, the project tackled the harder problem: turning messy real-world financial documents into structured data. Users upload bank statements, payslips, receipts, and utility bills in any of CSV, XLSX, PDF, or image formats. Files land in MinIO (a self-hosted S3-compatible store) keyed by `{user_id}/{upload_id}/{filename}`, with Postgres tracking every reference. A conversion module registry of format-specific Python parsers handles known formats; when no module matches, a Gemini Flash — OpenAI fallback adaptive pipeline auto-generates a new module from the document itself. All extracted data flows into a normalized `transactions` table and a JSONB `extracted_documents` record, held behind a user confirmation gate (`uploads.confirmed = true`) before downstream phases can touch it. Five waves built the full pipeline: storage plumbing, parser registry, LLM-adaptive fallback, confirmation UI, and a verification pass that validated end-to-end extraction fidelity.

---

## Phase 3 — Financial Profile Clarity

Phase 3 transformed raw confirmed transactions into a human-readable financial self-portrait. A rules-first, LLM-fallback categorization engine (Gemini Flash, OpenAI fallback) assigned every transaction a primary category and zero-or-more tags from a fixed vocabulary. The results fed an income estimator, a spending breakdown, a monthly margin figure, and 1-3 AI-generated insight cards highlighting high-impact patterns — all persisted as a structured profile record that Phase 4 coaching would later query directly. Navigation shifted: after `confirm-all`, users landed on a `ProcessingScreen` that polled a background categorization job and auto-advanced to `ProfileScreen` on completion, with a "Come back later" escape hatch for slow jobs. A questionnaire onboarding path handled users who skipped uploads entirely. Four waves delivered categorization pipeline, profile persistence, the processing/profile screens, and a UAT-verified end-to-end flow from upload confirmation to displayed profile.

---

## Phase 4 — Safe Grounded Text Coaching

This phase introduced the heart of S.E.N.S.O.: a composable LLM coaching pipeline that answers purchase and financial-decision questions using the user's own numbers. Every coaching response is a structured JSON object — `coaching_response.schema.json` — carrying a plain-language `message`, an array of `reasoning_used` steps, `action_cards`, `resource_cards`, `learn_cards`, and an `affordability_verdict` (`yes` / `no` / `conditional` / `null`). A three-layer safety pipeline guards all inputs and outputs against unsafe patterns. The backend wired a single default persona (`mentore-saggio`) with forward-compatible `persona_id` routing, and a BM25 content search engine (built at FastAPI startup from static JSON catalogs) gave the LLM a `search_content` tool to ground resource suggestions in real, locale-filtered catalog items rather than invented URLs. A `ChatScreen` component brought it all to the frontend. Four waves built the safety stack, the coaching service, the structured output pipeline, and the chat UI.

---

## Phase 5 — Voice Coaching Loop

Phase 5 gave S.E.N.S.O. its voice. A microphone button in `ChatScreen` captured spoken questions via the Web Speech API, showed a live transcript, and submitted on stop — silently hidden on browsers that lack support. A per-bubble play button fetched spoken audio from a new `POST /coaching/tts` endpoint backed by ElevenLabs, falling back gracefully to `window.speechSynthesis` if the API was unavailable. More architecturally significant was the dual-channel response shape introduced here: the LLM now emits a short, voice-optimised `message` (no exact decimals, no long lists — suitable for TTS) alongside a `details_a2ui` field containing A2UI JSONL — Google's open declarative AI-to-UI protocol — rendered by a Lit-based `<a2ui-surface>` web component in the chat bubble's detail panel. This separation of spoken brevity from visual richness became the defining UX pattern of the product. Five waves built STT integration, TTS endpoint, the dual-channel schema migration, the A2UI renderer, and a full voice-loop verification pass.

---

## Phase 6 — Learn+Act Cards & Demo Hardening

Phase 6 closed the loop from coaching insight to concrete action. The stub `action_cards`, `resource_cards`, and `learn_cards` introduced in Phase 4 were fully wired: resource cards now rendered inline YouTube video players and swipeable MARP slide decks inside chat bubbles; action cards with `action_type: "calculator"` launched interactive miniapps (e.g. a loan calculator with sliders); `action_type: "funnel"` rendered partner offer cards from `partners.json` (Fineco, Hype, Moneyfarm, ING, buddybank). A `details_a2ui` number-comparison panel was added for side-by-side financial breakdowns. The A2UI button component emitted a custom `a2ui-action` DOM event that `ChatScreen` handled globally. This phase also hardened the full demo journey end-to-end: persona picker UI, consistent i18n across all card types, and a human-reviewed UAT sign-off. Four waves delivered card rendering, partner funnels, demo polish, and final verification.

---

## Phase 7 — Streaming & Nice-to-Have Polish

Phase 7 upgraded coaching from a "wait then see" experience to a live, progressive one. Token-by-token streaming landed on the main assistant message, with a live-typing bubble effect that made the AI feel present rather than batch-processed — structured payloads (cards, verdict, A2UI) continued arriving as complete units after the stream settled. The persona selector moved from a hardcoded default to a user-facing picker with persisted preferences. Conversation history, already stored in the database, gained a proper restoration UX: returning to `ChatScreen` replayed the last session smoothly. A `own_pii_unsolicited` safety cross-check was added as the final layer of the coaching safety pipeline, detecting when the LLM spontaneously exposed personal profile data it was not asked about. Four waves shipped streaming infrastructure, persona persistence, session restoration, and the PII safety pass.

---

## Phase 8 — Content Platform Management, Indexing & Public Serving

Phase 8 lifted content from static JSON files into a fully admin-managed platform. A new `content` table in Postgres (with JSONB for type-specific fields) became the canonical store for articles, videos, slide decks, and partner offers, replacing the read-only catalog files that had served phases 4–7. An admin REST API (`/content-admin`) exposed CRUD endpoints gated to the `admin` role. The BM25 search engine was updated to hydrate from the database at startup and refresh on admin mutations, preserving the locale-partitioned, query-filtered contract the coaching LLM tool relied on. A public-serving layer gave unauthenticated users read access to published content for a future discover page. Three waves delivered the DB model, the admin API with tests, and the index rebuild plumbing.

---

## Phase 9 — LLM Financial Intelligence: Categorization, Tagging, Timeline & Crowdsourced Merchant Mapping

Phase 9 dramatically sharpened the financial intelligence layer Phase 3 had roughed in. A multi-tier LLM classification pipeline replaced the single-pass rules+LLM fallback: transactions escalated progressively through small, medium, and large model tiers, reducing uncategorized residuals to near zero. A crowdsourced merchant mapping table accumulated category knowledge from LLM decisions and user corrections, with a full audit trail for abuse prevention. A new "Timeline" tab in `ProfileScreen` surfaced detected life events (job change, relocation, major purchase) inferred from spending patterns. Users could annotate timeline insights with free text; the LLM distilled annotations for coaching injection and flagged TOS violations for moderation. An in-app notification system delivered moderation feedback, appeals, and admin actions. Seven waves built merchant mapping, multi-tier classification, timeline inference, annotation moderation, and the notification subsystem.

---

## Phase 10 — Transparency & Security: About Page, Encryption at Rest & LLM No-Data-Retention

Phase 10 was a trust-building phase with three distinct deliverables. A public `/about` page (and mirrored Settings > About section) explained S.E.N.S.O. in plain language for a 20-year-old with no financial background — what data is stored, how AI is used, and the relevant disclaimers. A tiered encryption-at-rest strategy landed: Tier 1 (raw personal content) and Tier 3 (identity fields) received E2E user-key encryption; Tier 2 (behavioral/analytical data) got server-side AES. Best-effort no-retention headers were added to all LLM API calls, alongside a per-user "Strict privacy mode" toggle in Settings that restricted LLM routing to confirmed no-retention providers and disabled ElevenLabs TTS. Four waves delivered the about page, tiered encryption, no-retention routing logic, and a human-verified accessibility UAT.

---

## Phase 11 — File Management, Admin Inspector, Connectors UI & Debug Controls

Phase 11 introduced the operational backbone: role-based access control, admin tooling, and the connector infrastructure that ties external services together. The `users` table gained a `role` column (`user` / `tester` / `moderator` / `admin`) replacing the old boolean `is_admin` flag; FastAPI dependencies were updated accordingly. An admin inspector panel surfaced user file inventories and upload statuses with re-processing triggers. A connectors UI let admins manage MinIO bucket configuration, LLM provider routing overrides, and ElevenLabs API key health checks. Debug controls — feature flags and a log viewer — were scoped to the `tester` role for QA without full admin privileges. Four waves delivered RBAC migration, the admin inspector, connector UI, and debug controls with full verification.

---

## Phase 12 — UX, Accessibility & Mobile Polish

Phase 12 addressed the gap between a working product and a polished one. A suite of React hooks standardised access to OS-level signals: `useMediaQuery` (tear-free via `useSyncExternalStore`), `useReducedMotion`, `useHighContrast`, `useOnlineStatus`, and `useHapticFeedback` (silently no-ops on unsupported browsers). Locale-aware number and currency formatting landed via `useLocaleFormat`. Global CSS received systematic accessibility tokens — focus rings, contrast ratios, motion-safe animation gates — and a mobile layout pass ensured the coaching chat, profile screen, and ingestion flow all worked on small viewports. Five waves delivered the hook library, global CSS tokens, mobile layouts for each major screen, and a human UAT covering keyboard navigation, screen reader behaviour, and touch targets.

---

## Phase 12.1 — Usability TODO Triage & Critical Bug Fixes

Phase 12.1 was an unplanned but necessary interlude: a concentrated pass on accumulated TODOs that had crossed the threshold into usability blockers. The most impactful fix was a 401-intercept layer in `api-client.ts` — when any API call returned 401, the client automatically refreshed the access token and retried; if the refresh token was also expired, it cleared local tokens and redirected to `/auth` without surfacing any crash. Session management tightened throughout, with `refreshAndRetry` extracted into `session.ts` as a reusable primitive. Eight waves worked through the TODO backlog systematically, each closing with a verification truth list to ensure fixes held without regressing Phase 12's polish.

---

## Phase 13 — Crypto Identity Foundation: Asymmetric Key Pairs, Username Generation & PII Encryption

Phase 13 planted a cryptographic identity at the core of every user account. At signup, each user received two key pairs — X25519 for future E2E message encryption, Ed25519 for signing and verification — and a pseudonymous username in `$adjective-noun-NNNN` format, with the `$` prefix marking it as a system identity. Private keys were stored server-side in a multi-envelope master key architecture using libsodium primitives, never in plaintext. The obfuscated email leaking into the admin merchant map was replaced with the username, closing the PII leak. Frontend `User` types and avatar utilities were updated throughout. Three waves delivered key pair generation and storage, username generation with collision handling, and the PII replacement sweep.

---

## Phase 14 — E2E Messaging Backend: Routing Table, Poll-on-Login, TTL Purge & Zero-Knowledge Recipient Hashing

Phase 14 built the server-side infrastructure for end-to-end encrypted messaging — deliberately without touching the client or UI, which were reserved for Phase 15. An `undelivered_messages` routing table stored encrypted blobs addressed to recipient hashes (never plaintext identities). A `delivered_messages` inbox tracked per-recipient delivery events. A `POST /messages/poll` endpoint let clients pull pending messages on login; a `POST /messages/send` endpoint accepted encrypted payloads with minimal server-side validation — the server cannot read what it cannot decrypt. An APScheduler background task ran hourly TTL purges controlled by `MESSAGE_TTL_DAYS`. An admin `!handle` DB column and claim endpoint, and a BIP-39 recovery envelope generator, were both delivered here as backend-only stubs awaiting their UI in Phase 15. Three waves built routing table and endpoints, the TTL purge scheduler, and the admin handle and recovery envelope backend work.

---

## Phase 15 — E2E Messaging Frontend: Client-Side Crypto, Compose & Inbox UI, Attachment Handling & Admin Signed-Message Verification

Phase 15 completed the E2E messaging system by wiring the client-side half. It opened with a KDF migration: all server-side NaCl envelopes moved from AES-GCM + PBKDF2 to libsodium primitives + Argon2id, aligning backend and client on the same cryptographic foundation. At login, the browser derived the user's private keys using `libsodium-wrappers` WASM — keeping private key material exclusively in memory, never at rest in the browser. A standalone `/messages` route introduced an Inbox tab (received messages, decrypt on demand, verified badge for admin Ed25519 signatures) and a Contacts tab. The Compose form addressed recipients by `$username`, encrypted payloads client-side before they left the browser, and embedded per-recipient key wraps in the message frontmatter. Attachments followed a full S3 encrypted path: client encrypts the file, uploads ciphertext to MinIO, and embeds the per-attachment key plus S3 reference in the message. A one-time Recovery Phrase interstitial at signup displayed the BIP-39 24-word phrase on a full-screen grid with copy and download-txt gates. Six waves built KDF migration, client crypto primitives, inbox and compose UI, attachment flow, the recovery phrase interstitial, and a 76/76 test verification pass that signed off the entire phase — and, with it, the project as built.

---

*S.E.N.S.O. grew from a login screen to a zero-knowledge encrypted messaging system with voice coaching, categorized financial profiles, and a full admin platform — fifteen phases, each one leaving the next one something solid to stand on.*
