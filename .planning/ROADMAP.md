# Roadmap: S.E.N.S.O.

## Overview

This roadmap delivers a reliable one-day hackathon demo by sequencing work from runnable foundation to data grounding to safe coaching, then layering voice and final demo hardening. Each phase closes a complete user-visible capability so the product can be tested end-to-end at every step.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Runtime & Account Foundation** - Reproducible local run and persistent user access.
- [x] **Phase 2: Financial Input Ingestion** - Users upload core files and confirm extracted facts. (completed 2026-03-24)
- [x] **Phase 3: Financial Profile Clarity** - Users see understandable affordability baseline from their data. (completed 2026-03-25)
- [x] **Phase 4: Safe Grounded Text Coaching** - Users get personalized, transparent coaching with safety enforcement. (completed 2026-03-28)
- [x] **Phase 5: Voice Coaching Loop** - Users can ask by voice and hear spoken recommendations with fallback safety. (completed 2026-03-29)
- [x] **Phase 6: Learn+Act Cards & Demo Hardening** - Full 75-90s demo flow is complete, fast, and repeatable. (completed 2026-03-29)
- [x] **Phase 7: Streaming & Nice-to-Have Polish** - Streaming responses, persona choice, persistent history, and PII safety cross-check. (completed 2026-03-29)

## Phase Details

### Phase 1: Runtime & Account Foundation

**Goal**: Users can reliably access the app with persistent sessions on a reproducible local setup.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, DEMO-03
**Success Criteria** (what must be TRUE):

1. User can create an account with email/password and immediately access the product.
2. User can sign in with Google OAuth and reach the same authenticated experience.
3. User stays signed in after browser refresh without re-authenticating.
4. A fresh machine can run the product locally via documented reproducible setup for judging.
   **Plans**: 3 plans
   Plans:

- [x] 01-01-PLAN.md - Build FastAPI-owned auth/session APIs with JWT refresh rotation and tests.
- [x] 01-02-PLAN.md - Build Vite React auth UX with localStorage session persistence and Google fallback.
- [x] 01-03-PLAN.md - Deliver one-command Docker Compose runtime, smoke checks, and judge runbook.
      **UI hint**: yes

### Phase 2: Financial Input Ingestion

**Goal**: Users can upload financial documents and verify extracted data before coaching uses it.
**Depends on**: Phase 1
**Requirements**: INGT-01, INGT-02, INGT-03
**Success Criteria** (what must be TRUE):

1. User can upload a bank CSV and see structured transactions extracted from that file.
2. User can upload a payslip/receipt image or PDF and see key financial fields extracted.
3. User can review extracted values and confirm/correct them before recommendations are generated.
   **Plans**: 5 plans
   Plans:

- [x] 02-01-PLAN.md - Migrate InMemoryDB to SQLAlchemy ORM + add MinIO infra and Docker services.
- [x] 02-02-PLAN.md - Build ingestion engine core: schemas, LLM/OCR pipeline, module registry, adaptive pipeline.
- [x] 02-03-PLAN.md - API endpoints (ingestion + admin routers) + IngestionService + AdminService + tests.
- [x] 02-04-PLAN.md - Implement builtin extraction modules for all sample financial document types.
- [x] 02-05-PLAN.md - Build frontend ingestion review UI (upload zone, file list, inspect modal, confirm flow).
      **UI hint**: yes

### Phase 3: Financial Profile Clarity

**Goal**: Users can understand their current affordability baseline from uploaded data.
**Depends on**: Phase 2
**Requirements**: PROF-01, PROF-02, PROF-03
**Success Criteria** (what must be TRUE):

1. User can view a profile summary showing income, recurring expenses, and monthly margin.
2. User can see transactions organized into clear spending categories.
3. User can see at least one highlighted high-impact spending pattern derived from their own data.
   **Plans**: 4 plans
   Plans:

- [x] 03-01-PLAN.md - Backend models, categorization service, profile endpoints, and tests.
- [x] 03-02-PLAN.md - Confirm-all endpoint wired to categorization trigger.
- [x] 03-03-PLAN.md - Frontend processing flow: profile API client, useProfileStatus hook, ProcessingScreen, AuthedHome routing.
- [x] 03-04-PLAN.md - Full profile UI: ProfileScreen, OnboardingChoiceScreen, QuestionnaireScreen, AuthedHome 5-screen routing.
      **UI hint**: yes

### Phase 4: Safe Grounded Text Coaching

**Goal**: Users can ask decision questions by text and receive personalized, transparent, safe coaching.
**Depends on**: Phase 3
**Requirements**: COCH-01, COCH-03, COCH-04, COCH-05, SAFE-01, SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):

1. User can ask a purchase/decision question by text and receive a profile-grounded recommendation.
2. Response explicitly shows user-specific numbers and reasoning used to reach the recommendation.
3. User can ask follow-up clarifications and receive coherent context-aware answers.
4. Unsafe or injection-style inputs are sanitized/rejected, and outputs remain within educational safety boundaries.
   **Plans**: 4 plans
   Plans:

- [x] 04-01-PLAN.md - Coaching service backend core: JSONSchema output shapes, Jinja2 composable prompts, CoachingService, SafetyScanner, guardrail extension, unit tests.
- [x] 04-02-PLAN.md - Coaching API endpoints: POST /coaching/chat, GET /coaching/personas, auth guard, profile gate, locale validation, integration tests.
- [x] 04-03-PLAN.md - Frontend coaching screen: ChatScreen, coachingApi.ts, structured response rendering, AuthedHome routing, ProfileScreen CTA.
- [x] 04-04-PLAN.md - Safety hardening and boundary tests: injection corpus (10+ patterns), output boundary verification, schema validation tests, prompt composability tests.
      **UI hint**: yes

### Phase 5: Voice Coaching Loop

**Goal**: Users can complete the same coaching interaction via voice with resilient text fallback.
**Depends on**: Phase 4
**Requirements**: COCH-02, VOIC-01, VOIC-02
**Success Criteria** (what must be TRUE):

1. User can ask a coaching question by voice and the system converts it into a valid coaching request.
2. Each coaching response can be returned as audible spoken output.
3. If speech recognition fails or is unavailable, user can continue seamlessly with typed input.
   **Plans**: 5 plans
   Plans:

- [x] 05-01-PLAN.md - Backend TTS endpoint: TTSService, ElevenLabs SDK, POST /coaching/tts, 503 fallback, tests.
- [x] 05-02-PLAN.md - Dual-channel LLM response shape: details_a2ui schema, voice-optimised message prompt, A2UI reference, DTO + TS type updates.
- [x] 05-03-PLAN.md - A2UI frontend renderer: Lit custom element, A2UISurface React wrapper, AssistantBubble integration.
- [x] 05-04-PLAN.md - Frontend voice input (STT): useVoiceInput hook, mic button in ChatScreen, live transcript, VOIC-02 feature detection.
- [x] 05-05-PLAN.md - Frontend voice output (TTS): fetchTTSAudio, useTTS hook, VoicePlayButton in AssistantBubble, ElevenLabs + speechSynthesis fallback.
      **UI hint**: yes

### Phase 6: Learn+Act Cards & Demo Hardening

**Goal**: Users can complete the full demo journey from upload to grounded spoken recommendation and immediate next actions.
**Depends on**: Phase 5
**Requirements**: ACTN-01, ACTN-02, ACTN-03, DEMO-01, DEMO-02
**Success Criteria** (what must be TRUE):

1. Each coaching response includes at least one relevant educational resource card.
2. Each coaching response includes at least one relevant service/action card tied to user context.
3. User can open both education and action cards directly from the same response context.
4. The scripted flow (upload -> profile summary -> voice question -> grounded spoken recommendation -> cards) runs end-to-end in under 90 seconds.
   **Plans**: 4 plans
   Plans:

- [x] 06-01-PLAN.md - Card reliability: prompt hardening + server-side fallback injection + backend integration tests
- [x] 06-02-PLAN.md - MARP visual QA + speech-to-speech end-to-end fix
- [x] 06-03-PLAN.md - Demo seed script + reset script
- [x] 06-04-PLAN.md - Loading states + error recovery polish
      **UI hint**: yes

### Phase 7: Streaming & Nice-to-Have Polish

**Goal**: Improve coaching UX and production-readiness with streaming responses, persona choice, persistent history, and full PII safety cross-check.
**Depends on**: Phase 6
**Requirements**: COCH-05, SAFE-01
**Success Criteria** (what must be TRUE):

1. Coaching responses stream token-by-token via Server-Sent Events (EventSource) with graceful full-response fallback.
2. User can select a coaching persona from the picker UI; selected persona is persisted across sessions.
3. Conversation history is persisted in the database and loaded on returning to the chat screen.
4. own_pii_unsolicited safety check performs full profile cross-check against live session userProfile fields (not pattern-only).
   **Plans**: 4 plans
   Plans:

- [x] 07-01-PLAN.md - Persist default persona preference and expose config-driven persona theme metadata.
- [x] 07-02-PLAN.md - Add SSE coaching delivery and rewrite-first own-profile safety protection.
- [x] 07-03-PLAN.md - Wire streaming chat UI, restore toast, and final-only voice playback timing.
- [x] 07-04-PLAN.md - Add persona switcher/settings UI with subtle per-message theming and visual verification.
      **UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 12.1 -> 13 -> 14 -> 15 -> 16

| Phase                                                                | Plans Complete | Status   | Completed  |
| -------------------------------------------------------------------- | -------------- | -------- | ---------- |
| 1. Runtime & Account Foundation                                      | 3/3            | Complete | 2026-03-23 |
| 2. Financial Input Ingestion                                         | 5/5            | Complete | 2026-03-24 |
| 3. Financial Profile Clarity                                         | 4/4            | Complete | 2026-03-25 |
| 4. Safe Grounded Text Coaching                                       | 4/4            | Complete | 2026-03-28 |
| 5. Voice Coaching Loop                                               | 5/5            | Complete | 2026-03-29 |
| 6. Learn+Act Cards & Demo Hardening                                  | 4/4            | Complete | 2026-03-29 |
| 7. Streaming & Nice-to-Have Polish                                   | 4/4            | Complete | 2026-03-29 |
| 8. Content Platform & Public Serving                                 | 3/3            | Complete | 2026-03-30 |
| 9. LLM Financial Intelligence                                        | 7/7            | Complete | 2026-03-30 |
| 10. Transparency & Security                                          | 4/4            | Complete | 2026-03-31 |
| 11. File Management, Admin Inspector, Connectors UI & Debug Controls | 4/4            | Complete | 2026-04-01 |
| 12. UX, Accessibility & Mobile Polish                                | 5/5            | Complete | 2026-04-01 |
| 12.1. Usability TODO Sweep (INSERTED)                                | 8/8            | Complete | 2026-04-02 |
| 13. Crypto Identity Foundation                                       | 3/3            | Complete | 2026-04-03 |
| 14. E2E Messaging Backend                                            | 0/0            | Skipped  | -          |
| 15. E2E Messaging Frontend                                           | 6/6            | Complete | 2026-04-05 |
| 16. E2E Test Suite & Mobile Regressions                              | 5/5            | Complete | 2026-04-05 |

### Phase 8: Content Platform Management, Indexing & Public Serving

**Goal:** Articles, MARP decks, and curated links are managed through an admin/editorial flow, indexed for search, and publicly servable for sharing outside the app.
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06
**Depends on:** Phase 7
**Success Criteria** (what must be TRUE):

1. Admin user can manage content items (create, read, update, delete) via API endpoints.
2. Static JSON catalogs are migrated into the database and the BM25 search index loads from DB.
3. Content changes via admin API immediately reflect in search results after index rebuild.
4. Unauthenticated users can browse and search published content at /learn.
5. Individual content items are viewable at /learn/:id with type-specific rendering (article link, video player, slide viewer, partner CTA).
6. Direct URLs to /learn/:id are shareable outside the app without requiring login.
   **Plans:** 3 plans

Plans:

- [x] 08-01-PLAN.md - ContentItem DB model, admin CRUD API, and JSON catalog seed migration.
- [x] 08-02-PLAN.md - DB-backed BM25 search index with rebuild + public content API endpoints.
- [x] 08-03-PLAN.md - Public content browse and detail pages with type-specific rendering.
      **UI hint**: yes

### Phase 9: LLM Financial Intelligence with Categorization, Tagging, Timeline Inference & Crowdsourced Merchant Mapping

**Goal:** Transactions are automatically categorized and tagged by LLM, complex documents get structured metadata extraction, a financial timeline infers life events from data, and users can crowdsource merchant categorization to improve accuracy for all users.
**Requirements**: Defined in phase context (09-CONTEXT.md) - no formal REQUIREMENTS.md IDs assigned
**Depends on:** Phase 8
**Plans:** 7/7 plans complete

Plans:

- [x] 09-01-PLAN.md - DB models (4 new SQLAlchemy models) + LLM client classification route support. (completed 2026-03-30)
- [x] 09-02-PLAN.md - Merchant map pre-check, 3-tier LLM classification escalation, financial timeline inference in categorization pipeline. (completed 2026-03-30)
- [x] 09-03-PLAN.md - TOS moderation service + notification service for user context moderation and in-app alerts. (completed 2026-03-30)
- [x] 09-04-PLAN.md - Timeline, uncategorized, and notification API endpoints. (completed 2026-03-30)
- [x] 09-05-PLAN.md - Admin endpoints for merchant map management and moderation queue. (completed 2026-03-30)
- [x] 09-06-PLAN.md - Timeline tab for ProfileScreen + uncategorized review screen. (completed 2026-03-30)
- [x] 09-07-PLAN.md - Notification bell + panel and admin merchant map / moderation queue pages. (completed 2026-03-30)

### Phase 10: Transparency & Security with About Page, Encryption at Rest & LLM No-Data-Retention

**Goal:** Users see a clear About page explaining inner workings and disclaimers, sensitive financial data is encrypted at rest, and LLM calls enforce no-data-retention policies for user privacy.
**Requirements**: Defined in phase context (10-CONTEXT.md) - no formal REQUIREMENTS.md IDs assigned
**Depends on:** Phase 9
**Plans:** 4/4 plans complete

Plans:

- [x] 10-01-PLAN.md - Crypto foundations: sqlalchemy-utils/cryptography deps, Settings.encryption_key, PBKDF2 helpers, DB columns, schema updates.
- [x] 10-02-PLAN.md - LLM no-data-retention: openai-beta no-store header, OpenRouter ZDR strict mode, gemini passthrough, tests.
- [x] 10-03-PLAN.md - T2 column encryption: StringEncryptedType on 6 ORM columns, encryption roundtrip tests.
- [x] 10-04-PLAN.md - Frontend: AboutPage, /about route, Settings Privacy section + toggle, ChatScreen privacy badge + TTS notice, i18n strings.

### Phase 11: File Management, Admin Inspector, Connectors UI & Debug Controls

**Goal:** Users can manage their uploaded files (retry/delete) from their profile; admins can inspect the full ingestion pipeline state for any upload; a Connectors tab shows upcoming bank integrations; tester/admin users have a /debug screen with ingestion restart, coaching purge, and full data reset controls.
**Requirements**: FILE-01, FILE-02, RBAC-01, CONN-01, DEBUG-01
**Depends on:** Phase 10
**Plans:** 4/4 plans complete

Plans:

- [x] 11-01-PLAN.md - RBAC role column: add role VARCHAR(16) to users, Round 15 migration, require_tester dep, UserDTO + frontend User type with role.
- [x] 11-02-PLAN.md - Pipeline trace infrastructure: IngestionTrace ORM model, Round 16 migration, ingestion_service instrumentation, admin trace endpoint.
- [x] 11-03-PLAN.md - "Your Files" tab + Admin Inspector: ingestionFilesApi, FilesTab, AdminInspectorDrawer, wired into ProfileScreen.
- [x] 11-04-PLAN.md - Connectors UI tab, debug backend endpoints (require_tester), DebugScreen at /debug, SettingsScreen developer link.

### Phase 12: UX, Accessibility & Mobile Polish

**Goal:** Improve user experience, accessibility compliance, and mobile interaction quality with prioritized low-cost/high-impact features: ripple feedback, pull-to-refresh, dynamic micro-copy, offline detection, menu animation, haptic feedback, privacy toggle for balances, prefers-reduced-motion/contrast/color-scheme support, page transition animations, i18n centralization, and optimistic UI patterns.
**Requirements**: Defined in phase context (12-CONTEXT.md) - no formal REQUIREMENTS.md IDs assigned
**Depends on:** Phase 10
**Plans:** 5/5 plans complete

Plans:

- [x] 12-01-PLAN.md - Foundation hooks (useMediaQuery, useReducedMotion, useHighContrast, useOnlineStatus, useHapticFeedback, useLocaleFormat) + CSS accessibility rules + i18n keys.
- [x] 12-02-PLAN.md - i18n hardcoded locale fix: replace all 14 "it-IT" instances + 3 hardcoded Italian strings with useLocaleFormat hook and i18n keys.
- [x] 12-03-PLAN.md - OfflineBanner, BalanceMask components + AppShell integration + ripple feedback on nav buttons.
- [x] 12-04-PLAN.md - PageTransition component, enhanced drawer animation, usePullToRefresh hook + integration into ChatScreen and ProfileScreen.
- [x] 12-05-PLAN.md - Dynamic micro-copy (time-of-day greetings), haptic feedback on actions, optimistic UI consistency audit, full test suite validation.

### Phase 12.1: Add a phase for all the todos, we need to prioritize them because they impact current usability (INSERTED)

**Goal:** Fix all 27 actionable TODOs that impact current usability - covering auth reliability, UX polish, i18n completeness, admin tooling, responsive layout, and voice output degradation handling.
**Requirements**: TODO-2 through TODO-28 (27 items; TODO-1 deferred to phases 13-15)
**Depends on:** Phase 12
**Plans:** 8/8 plans complete

Plans:

- [x] 12.1-01-PLAN.md - Auth fixes: 401-intercept in api-client + token renewal + redirect to login on expiry (#26, #27)
- [x] 12.1-02-PLAN.md - Coach picker fixes: dark theme rendering + persona persistence across new conversation (#24, #25)
- [x] 12.1-03-PLAN.md - shadcn Dialog component + replace all window.confirm() / window.alert() calls (#28)
- [x] 12.1-04-PLAN.md - ErrorBoundary on profile pages + pull-to-refresh touchAction fix + nuke button auth fix (#3, #4, #15)
- [x] 12.1-05-PLAN.md - Admin/debug submenu in AppShell + restart-ingestion navigation fix + PWA manifest (#2, #13, #14)
- [x] 12.1-06-PLAN.md - Profile i18n: estimated source label + category localization + hash navigation + merchant check (#5, #6, #10, #11)
- [x] 12.1-07-PLAN.md - Admin table UX: sort affordance + icon headers + pagination + localized category picker + settings save confirmation (#8, #9, #17, #18, #19, #20, #21)
- [x] 12.1-08-PLAN.md - UI polish: pie chart, responsive table card layouts, TTS fallback indicator, dark-mode coaching cards (#12, #16, #22, #23)

### Phase 12.1.1: fix remaining Complete todos - coach picker bug, TTS voice output, manual categorization, content management polish, and 22 other UX fixes (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 12.1
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 12.1.1 to break down)

### Phase 13: Crypto Identity Foundation - asymmetric key pairs at signup, username generation, and PII encryption replacing obfuscated email

**Goal:** Every new user receives a pseudonymous `$adjective-noun-NNNN` username and an NaCl (libsodium) X25519+Ed25519 key pair at signup; public keys are stored on the user row; the one remaining obfuscated-email exposure (admin merchant map) is replaced with the username; and the frontend User type exposes all new identity fields.
**Requirements**: Defined in phase context (13-CONTEXT.md) - crypto identity, username generation, PII replacement
**Depends on:** Phase 12
**Plans:** 3/3 plans complete

Plans:

- [x] 13-01-PLAN.md - PyNaCl dependency + nacl_crypto.py helpers + username_generator service + Round 17 DB migration (username, public_key_b64, signing_key_b64 columns) (completed 2026-04-03)
- [x] 13-02-PLAN.md - Wire signup() to generate username and key pairs; update UserDTO with 3 new fields; add \_to_user_dto() helper; repository.get_user_by_username; integration tests (completed 2026-04-03)
- [x] 13-03-PLAN.md - Replace obfuscated email with username in admin merchant map API; extend frontend User type; update user-avatar display utilities; AppShell username display (completed 2026-04-03)

### Phase 14: E2E Messaging Backend - undelivered_messages routing table, pull-on-login delivery, TTL purge, and zero-knowledge recipient hashing

**Goal:** Build server-side E2E message routing: undelivered_messages + delivered_messages tables, pull-on-login delivery, APScheduler TTL purge, BIP-39 recovery envelope (backend only), and admin !handle claim endpoint.
**Requirements**: Defined in phase discussion (14-DISCUSSION-LOG.md) - message routing, TTL purge, recovery envelope, admin handle
**Depends on:** Phase 13
**Plans:** 0/3 plans - skipped as separate phase; all backend work absorbed into Phase 15 plans (15-01 through 15-03)

All Phase 14 deliverables were implemented during Phase 15 execution:
- `undelivered_messages` + `delivered_messages` tables → Round 18 migration in `session.py`, models in `models.py:815-860`
- `POST /messages/send` + `POST /messages/poll` → `api/messages.py` with zero-knowledge recipient hashing
- APScheduler hourly TTL purge → `main.py:86-110`, `Settings.message_ttl_days`
- BIP-39 recovery envelope → `nacl_crypto.py:255+`, `auth_service.py:126+`
- Admin `!handle` claim → `admin.py:353`, `POST /claim-handle`

Plans (not executed as standalone - absorbed into Phase 15):

- [ ] 14-01-PLAN.md - DB schema (Round 18: admin_handle + recovery envelope cols + 2 messaging tables + GIN indexes), Settings.message_ttl_days, APScheduler hourly TTL purge in lifespan.
- [ ] 14-02-PLAN.md - BIP-39 recovery envelope: mnemonic package, nacl_crypto.py helpers, signup() extension, AuthResponseDTO.recovery_phrase (one-time), UserDTO.admin_handle.
- [ ] 14-03-PLAN.md - Messaging API: POST /messages/send + POST /messages/poll, POST /admin/claim-handle, repository helpers, mount router, tests.

### Phase 15: E2E Messaging Frontend - client-side libsodium encrypt/decrypt, compose and inbox UI, attachment handling, and admin signed-message verification

**Goal:** Client-side libsodium encryption/decryption, compose and inbox UI, poll-at-login message delivery, recovery phrase interstitial, attachment handling, and admin signed-message verification.
**Requirements**: Defined in phase context (15-CONTEXT.md) - client crypto, inbox/compose UI, attachment handling, admin verification
**Depends on:** Phase 14
**Plans:** 6/6 plans complete

Plans:

- [x] 15-01-PLAN.md - libsodium-wrappers + argon2-browser packages, Wave-0 crypto/KDF test scaffolding, public-keys endpoint, attachment upload endpoint. (completed 2026-04-04)
- [x] 15-02-PLAN.md - libsodium init + Argon2id KDF + AuthContext key lifecycle. (completed 2026-04-05)
- [x] 15-03-PLAN.md - Envelope migration (backend NaCl sealed-box + frontend decrypt). (completed 2026-04-05)
- [x] 15-04-PLAN.md - /messages route + InboxTab + ContactsTab + poll-at-login integration. (completed 2026-04-05)
- [x] 15-05-PLAN.md - Compose UI + client-side encrypt + send. (completed 2026-04-05)
- [x] 15-06-PLAN.md - Recovery phrase interstitial + attachment handling + admin verification + i18n. (completed 2026-04-05)

### Phase 16: E2E Test Suite - Gestures, A11y, PWA Ergonomics & Mobile Regressions

**Goal:** Comprehensive Playwright E2E test coverage for gesture interactions, accessibility (axe-core), PWA manifest, mobile nav drawer, and coach picker regressions.
**Requirements**: Defined in phase context (16-CONTEXT.md) - Playwright E2E coverage for gestures, a11y, PWA, mobile regressions
**Depends on:** Phase 15
**Plans:** 5/5 plans complete

Plans:

- [x] 16-01-PLAN.md - Dependencies + Playwright config + shared fixtures (authedPage, touch-helpers, api-mocks). (completed 2026-04-05)
- [x] 16-02-PLAN.md - Gesture & scroll regression tests (swipe, pull-to-refresh, body-leak). (completed 2026-04-05)
- [x] 16-03-PLAN.md - Mobile nav drawer tests (open/close/Escape/overlay/focus-trap/aria-modal). (completed 2026-04-05)
- [x] 16-04-PLAN.md - Accessibility tests (axe-core + keyboard navigation + aria-live). (completed 2026-04-05)
- [x] 16-05-PLAN.md - PWA, ergonomics & coach picker regression tests. (completed 2026-04-05)

---

## Milestone 2: Quality, Intelligence & Real Testing

*Added 2026-04-06 - 7 phases to fix broken features, improve coach intelligence, and build real E2E coverage.*

### Phase 17: MARP Real Rendering

**Goal:** Replace `marked`-based slide renderer with `@marp-team/marp-core`. MARP directives, themes (`senso-light`/`senso-dark`), fullscreen portal.
**Requirements**: Defined in 17-CONTEXT.md
**Depends on:** Phase 16
**Plans:** 0/2 plans complete

Plans:

- [ ] 17-01-PLAN.md - Install marp-core, rewrite renderer, register themes
- [ ] 17-02-PLAN.md - Fullscreen portal, keyboard nav, vitest unit tests

### Phase 18: Ingestion Reliability + Non-Ledger Document Support

**Goal:** Fix fingerprinting (MIME-first, binary XLSX fix, content-hash dedup), add payslip/utility/invoice/receipt extractors that enrich the user profile.
**Requirements**: Defined in 18-CONTEXT.md
**Depends on:** Phase 16
**Plans:** 5/5 plans written (ready to execute)

Plans:

- [ ] 18-01-PLAN.md - Content-hash dedup + MIME-first routing + XLSX text extraction
- [ ] 18-02-PLAN.md - Payslip builtin module + profile income enrichment
- [ ] 18-03-PLAN.md - Utility bill + invoice builtin modules
- [ ] 18-04-PLAN.md - Receipt module + unified enrich_from_extraction() dispatcher
- [ ] 18-05-PLAN.md - Pipeline success condition fix + full test suite

### Phase 19: Financial Timeline - Real Inference + Visibility

**Goal:** Complete 6/6 event types, trigger timeline from non-ledger docs, inject timeline into coach prompt, improve TimelineTab visual.
**Requirements**: Defined in 19-CONTEXT.md
**Depends on:** Phase 18
**Plans:** 4/4 plans written (ready to execute)

Plans:

- [ ] 19-01-PLAN.md - Complete relocation + debt_change event types
- [ ] 19-02-PLAN.md - Non-ledger timeline triggers (payslip → income_shift, utility → subscription)
- [ ] 19-03-PLAN.md - Coach system prompt timeline block + get_timeline_events tool
- [ ] 19-04-PLAN.md - TimelineTab visual: date axis, Complete state CTA, notification badge

### Phase 20: Coach Intelligence - Tool Suite + Structured Memory

**Goal:** Italy rules knowledge base, 7-tool LLM suite (transactions, profile, preferences, memory, timeline, rules, content), lean prompt architecture.
**Requirements**: Defined in 20-CONTEXT.md
**Depends on:** Phase 19
**Plans:** 6/6 plans written (ready to execute) · RESEARCH.md added (2025 Italian tax rules)

Plans:

- [ ] 20-01-PLAN.md - Italy rules JSON (2025 data) + BM25 index + search_italy_rules tool
- [ ] 20-02-PLAN.md - get_user_profile + search_user_transactions tools
- [ ] 20-03-PLAN.md - User preferences (goals/dos/donts) + get_user_preferences tool + frontend editor
- [ ] 20-04-PLAN.md - Structured coaching memory + recall_past_insights tool
- [ ] 20-05-PLAN.md - Prompt refactor: remove static profile blob, wire all 7 tools
- [ ] 20-06-PLAN.md - Integration tests + tool call verification + Italy rules coverage

### Phase 21: Coach Output Rationalization ✓ Complete (2026-04-08)

**Goal:** Unified enrichment system: content_cards/interactive_cards, conditional gating, tool-usage SSE bubbles, transaction_evidence, goal_progress, admin-tunable caps, intent classifier.
**Requirements**: Defined in 21-CONTEXT.md
**Depends on:** Phase 20
**Plans:** 5/5 plans complete

Plans:

- [x] 21-01-PLAN.md - Response schema redesign + admin config + intent classifier
- [x] 21-02-PLAN.md - Tool-usage SSE streaming infrastructure
- [x] 21-03-PLAN.md - Service enrichment pipeline rewrite + prompt updates
- [x] 21-04-PLAN.md - Frontend types + rendering hierarchy + new components + i18n
- [x] 21-05-PLAN.md - Integration tests + build verification + seeding

### Phase 22: Mobile-First UI Overhaul

**Goal:** Fix ChatScreen keyboard/safe area, pull-to-refresh, all tables → cards on mobile, profile tab layout, PWA standalone, coach picker dark mode + session bug, TTS fix.
**Requirements**: Defined in 22-CONTEXT.md
**Depends on:** Phase 21
**Plans:** 6/6 plans complete

Plans:

- [ ] 22-01-PLAN.md - ChatScreen: visualViewport keyboard + safe area + scroll button
- [ ] 22-02-PLAN.md - Pull-to-refresh hook: extract, guard (passive:false), visual indicator
- [ ] 22-03-PLAN.md - All tables → card layouts on mobile (systemic, 6 tables)
- [ ] 22-04-PLAN.md - Profile tabs grid layout + admin route + nav tap targets (44px)
- [ ] 22-05-PLAN.md - PWA standalone (vite-plugin-pwa) + coach picker dark mode + session fix
- [ ] 22-06-PLAN.md - TTS fix (blob URL lifecycle) + voice UX + STT Chromium

### Phase 23: E2E Real Stack Test Suite

**Goal:** Playwright tests against real Docker Compose stack (no mocks). Full user journey, tool call verification, error paths, mobile viewport.
**Requirements**: Defined in 23-CONTEXT.md
**RESEARCH.md added** (Project Dependencies pattern, Docker Compose healthchecks, FastAPI LLM stub, real account fixture)
**Depends on:** Phase 22
**Plans:** 5/5 plans written (ready to execute)

Plans:

- [ ] 23-01-PLAN.md - Real stack infrastructure: LLM stub + docker-compose.test.yml + fixtures
- [ ] 23-02-PLAN.md - Full user journey E2E: register → upload → profile → coach
- [ ] 23-03-PLAN.md - Coach tool call E2E: real DB data through tool executor
- [ ] 23-04-PLAN.md - Error path E2E: token expiry, bad file, LLM timeout, offline
- [ ] 23-05-PLAN.md - Mobile E2E: full journey on iPhone 14 viewport
