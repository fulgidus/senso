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
- [ ] **Phase 5: Voice Coaching Loop** - Users can ask by voice and hear spoken recommendations with fallback safety.
- [ ] **Phase 6: Learn+Act Cards & Demo Hardening** - Full 75-90s demo flow is complete, fast, and repeatable.

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
- [x] 01-01-PLAN.md — Build FastAPI-owned auth/session APIs with JWT refresh rotation and tests.
- [x] 01-02-PLAN.md — Build Vite React auth UX with localStorage session persistence and Google fallback.
- [x] 01-03-PLAN.md — Deliver one-command Docker Compose runtime, smoke checks, and judge runbook.
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
- [x] 02-01-PLAN.md — Migrate InMemoryDB to SQLAlchemy ORM + add MinIO infra and Docker services.
- [x] 02-02-PLAN.md — Build ingestion engine core: schemas, LLM/OCR pipeline, module registry, adaptive pipeline.
- [x] 02-03-PLAN.md — API endpoints (ingestion + admin routers) + IngestionService + AdminService + tests.
- [x] 02-04-PLAN.md — Implement builtin extraction modules for all sample financial document types.
- [x] 02-05-PLAN.md — Build frontend ingestion review UI (upload zone, file list, inspect modal, confirm flow).
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
- [x] 03-01-PLAN.md — Backend models, categorization service, profile endpoints, and tests.
- [x] 03-02-PLAN.md — Confirm-all endpoint wired to categorization trigger.
- [x] 03-03-PLAN.md — Frontend processing flow: profile API client, useProfileStatus hook, ProcessingScreen, AuthedHome routing.
- [x] 03-04-PLAN.md — Full profile UI: ProfileScreen, OnboardingChoiceScreen, QuestionnaireScreen, AuthedHome 5-screen routing.
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
- [x] 04-01-PLAN.md — Coaching service backend core: JSONSchema output shapes, Jinja2 composable prompts, CoachingService, SafetyScanner, guardrail extension, unit tests.
- [x] 04-02-PLAN.md — Coaching API endpoints: POST /coaching/chat, GET /coaching/personas, auth guard, profile gate, locale validation, integration tests.
- [x] 04-03-PLAN.md — Frontend coaching screen: ChatScreen, coachingApi.ts, structured response rendering, AuthedHome routing, ProfileScreen CTA.
- [x] 04-04-PLAN.md — Safety hardening and boundary tests: injection corpus (10+ patterns), output boundary verification, schema validation tests, prompt composability tests.
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
- [x] 05-01-PLAN.md — Backend TTS endpoint: TTSService, ElevenLabs SDK, POST /coaching/tts, 503 fallback, tests.
- [x] 05-02-PLAN.md — Dual-channel LLM response shape: details_a2ui schema, voice-optimised message prompt, A2UI reference, DTO + TS type updates.
- [ ] 05-03-PLAN.md — A2UI frontend renderer: Lit custom element, A2UISurface React wrapper, AssistantBubble integration.
- [x] 05-04-PLAN.md — Frontend voice input (STT): useVoiceInput hook, mic button in ChatScreen, live transcript, VOIC-02 feature detection.
- [ ] 05-05-PLAN.md — Frontend voice output (TTS): fetchTTSAudio, useTTS hook, VoicePlayButton in AssistantBubble, ElevenLabs + speechSynthesis fallback.
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
**Plans**: TBD
**UI hint**: yes

### Phase 7: Streaming & Nice-to-Have Polish
**Goal**: Improve coaching UX and production-readiness with streaming responses, persona choice, persistent history, and full PII safety cross-check.
**Depends on**: Phase 6
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. Coaching responses stream token-by-token via Server-Sent Events (EventSource) with graceful full-response fallback.
  2. User can select a coaching persona from the picker UI; selected persona is persisted across sessions.
  3. Conversation history is persisted in the database and loaded on returning to the chat screen.
  4. own_pii_unsolicited safety check performs full profile cross-check against live session userProfile fields (not pattern-only).
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Runtime & Account Foundation | 3/3 | Complete | 2026-03-23 |
| 2. Financial Input Ingestion | 5/5 | Complete   | 2026-03-24 |
| 3. Financial Profile Clarity | 4/4 | Complete   | 2026-03-25 |
| 4. Safe Grounded Text Coaching | 4/4 | Complete   | 2026-03-28 |
| 5. Voice Coaching Loop | 0/5 | Not started | - |
| 6. Learn+Act Cards & Demo Hardening | 0/TBD | Not started | - |
| 7. Streaming & Nice-to-Have Polish | 0/TBD | Not started | - |
