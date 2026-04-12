# Requirements: S.E.N.S.O.

**Defined:** 2026-03-23
**Core Value:** Help users make better financial decisions in the moment by combining real personal financial data with direct, educational AI guidance and concrete actions.

## v1 Requirements

Requirements for initial release. Scope is aligned to Punkathon rules: concrete, accessible, desirable, demoable in one day, with AI as the core of the experience.

### Authentication

- [x] **AUTH-01**: User can create an account with email and password.
- [x] **AUTH-02**: User can sign in with Google OAuth.
- [x] **AUTH-03**: User session persists across browser refresh.

### Ingestion

- [x] **INGT-01**: User can upload a bank statement CSV and the system extracts structured transactions.
- [x] **INGT-02**: User can upload a payslip or receipt image/PDF and the system extracts key financial fields.
- [x] **INGT-03**: User can review extracted data before it is used for recommendations.

### Financial Profile

- [x] **PROF-01**: User can view a post-upload summary of income, recurring expenses, and available monthly margin.
- [x] **PROF-02**: System categorizes transactions into understandable spending categories.
- [x] **PROF-03**: System highlights at least one high-impact spending pattern from user data.

### Coaching

- [x] **COCH-01**: User can ask a purchase/decision question by text input.
- [x] **COCH-02**: User can ask a purchase/decision question by voice input.
- [x] **COCH-03**: AI response is personalized using the user financial profile and relevant retrieved context.
- [x] **COCH-04**: AI response includes explicit reasoning with user-specific numbers used in the recommendation.
- [x] **COCH-05**: User can ask follow-up clarification questions and receive coherent contextual responses.

### Voice Experience

- [x] **VOIC-01**: AI can return spoken output for each coaching response.
- [x] **VOIC-02**: If browser speech recognition fails or is unavailable, user can continue with typed input.

### Learn and Act

- [x] **ACTN-01**: Each coaching response can include at least one educational resource card (article or video) relevant to the question.
- [x] **ACTN-02**: Each coaching response can include at least one actionable service card (bank or partner) relevant to user context.
- [x] **ACTN-03**: User can open educational and action cards from the same response context.

### Content Platform

- [x] **CONT-01**: Admin user can manage content items (create, read, update, delete) via API endpoints.
- [x] **CONT-02**: Static JSON catalogs are migrated into the database and seeded on first startup.
- [x] **CONT-03**: BM25 search index loads from the database and rebuilds when content is mutated.
- [x] **CONT-04**: Unauthenticated users can browse and search published content via public API.
- [x] **CONT-05**: Users can browse published content at /learn without authentication.
- [x] **CONT-06**: Individual content items are viewable at /learn/:id with type-specific rendering and shareable URLs.

### Safety and Boundaries

- [x] **SAFE-01**: System enforces persona-independent safety boundaries defined by project policies.
- [x] **SAFE-02**: System rejects or sanitizes prompt-injection attempts from uploaded/user-provided text before response generation.
- [x] **SAFE-03**: Responses avoid regulated investment-picking language and maintain educational/coaching framing.

### Demo Readiness

- [x] **DEMO-01**: Team can complete an end-to-end scripted demo flow in under 90 seconds.
- [x] **DEMO-02**: Demo flow includes upload -> profile summary -> voice question -> grounded spoken recommendation -> learning/action cards.
- [x] **DEMO-03**: Product can run locally through a reproducible setup suitable for hackathon judging.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Product Expansion

- **NEXT-01**: System detects recurring subscriptions and recommends cancellation or plan changes.
- **NEXT-02**: User can set savings goals and receive periodic progress nudges.
- **NEXT-03**: User can opt into weekly habit/coaching challenges.
- **NEXT-04**: System supports secure direct bank connector ingestion in addition to file upload.
- **NEXT-05**: User can browse conversation history and improvement trajectory over time.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full dashboard-first analytics suite | Conflicts with core voice-first decision-coaching value and hackathon time budget |
| Autonomous money movement/execution | Trust, safety, and compliance risk too high for MVP |
| Investment picking and market timing guidance | Misaligned with educational scope and increases regulatory risk |
| Native mobile apps | Web-first delivery is faster and sufficient for hackathon demo |
| Deep marketplace optimization and conversion analytics | Premature before validating core coaching usefulness |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| INGT-01 | Phase 2 | Complete |
| INGT-02 | Phase 2 | Complete |
| INGT-03 | Phase 2 | Complete |
| PROF-01 | Phase 3 | Complete |
| PROF-02 | Phase 3 | Complete |
| PROF-03 | Phase 3 | Complete |
| COCH-01 | Phase 4 | Complete |
| COCH-02 | Phase 5 | Complete |
| COCH-03 | Phase 4 | Complete |
| COCH-04 | Phase 4 | Complete |
| COCH-05 | Phase 4 | Complete |
| VOIC-01 | Phase 5 | Complete |
| VOIC-02 | Phase 5 | Complete |
| ACTN-01 | Phase 6 | Complete |
| ACTN-02 | Phase 6 | Complete |
| ACTN-03 | Phase 6 | Complete |
| SAFE-01 | Phase 4 | Complete |
| SAFE-02 | Phase 4 | Complete |
| SAFE-03 | Phase 4 | Complete |
| DEMO-01 | Phase 6 | Complete |
| DEMO-02 | Phase 6 | Complete |
| DEMO-03 | Phase 1 | Complete |
| CONT-01 | Phase 8 | Complete |
| CONT-02 | Phase 8 | Complete |
| CONT-03 | Phase 8 | Complete |
| CONT-04 | Phase 8 | Complete |
| CONT-05 | Phase 8 | Complete |
| CONT-06 | Phase 8 | Complete |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after auto-mode initial definition from concept + hackathon rules*
