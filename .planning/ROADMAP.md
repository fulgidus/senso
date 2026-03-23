# Roadmap: S.E.N.S.O.

## Overview

This roadmap delivers a reliable one-day hackathon demo by sequencing work from runnable foundation to data grounding to safe coaching, then layering voice and final demo hardening. Each phase closes a complete user-visible capability so the product can be tested end-to-end at every step.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Runtime & Account Foundation** - Reproducible local run and persistent user access.
- [ ] **Phase 2: Financial Input Ingestion** - Users upload core files and confirm extracted facts.
- [ ] **Phase 3: Financial Profile Clarity** - Users see understandable affordability baseline from their data.
- [ ] **Phase 4: Safe Grounded Text Coaching** - Users get personalized, transparent coaching with safety enforcement.
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
- [ ] 01-01-PLAN.md — Build FastAPI-owned auth/session APIs with JWT refresh rotation and tests.
- [ ] 01-02-PLAN.md — Build Vite React auth UX with localStorage session persistence and Google fallback.
- [ ] 01-03-PLAN.md — Deliver one-command Docker Compose runtime, smoke checks, and judge runbook.
**UI hint**: yes

### Phase 2: Financial Input Ingestion
**Goal**: Users can upload financial documents and verify extracted data before coaching uses it.
**Depends on**: Phase 1
**Requirements**: INGT-01, INGT-02, INGT-03
**Success Criteria** (what must be TRUE):
  1. User can upload a bank CSV and see structured transactions extracted from that file.
  2. User can upload a payslip/receipt image or PDF and see key financial fields extracted.
  3. User can review extracted values and confirm/correct them before recommendations are generated.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Financial Profile Clarity
**Goal**: Users can understand their current affordability baseline from uploaded data.
**Depends on**: Phase 2
**Requirements**: PROF-01, PROF-02, PROF-03
**Success Criteria** (what must be TRUE):
  1. User can view a profile summary showing income, recurring expenses, and monthly margin.
  2. User can see transactions organized into clear spending categories.
  3. User can see at least one highlighted high-impact spending pattern derived from their own data.
**Plans**: TBD
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
**Plans**: TBD

### Phase 5: Voice Coaching Loop
**Goal**: Users can complete the same coaching interaction via voice with resilient text fallback.
**Depends on**: Phase 4
**Requirements**: COCH-02, VOIC-01, VOIC-02
**Success Criteria** (what must be TRUE):
  1. User can ask a coaching question by voice and the system converts it into a valid coaching request.
  2. Each coaching response can be returned as audible spoken output.
  3. If speech recognition fails or is unavailable, user can continue seamlessly with typed input.
**Plans**: TBD
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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Runtime & Account Foundation | 0/TBD | Not started | - |
| 2. Financial Input Ingestion | 0/TBD | Not started | - |
| 3. Financial Profile Clarity | 0/TBD | Not started | - |
| 4. Safe Grounded Text Coaching | 0/TBD | Not started | - |
| 5. Voice Coaching Loop | 0/TBD | Not started | - |
| 6. Learn+Act Cards & Demo Hardening | 0/TBD | Not started | - |
