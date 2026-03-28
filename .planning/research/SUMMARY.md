# Project Research Summary

**Project:** S.E.N.S.O.
**Domain:** Voice-first AI financial education and decision-coaching assistant (hackathon MVP → production)
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH

## Executive Summary

S.E.N.S.O. is best positioned as a **grounded, voice-first financial coaching product** for ages 18-30, not as a general budgeting dashboard clone. The strongest expert pattern across research is: start from real user financial data (uploads first), normalize it into a canonical profile, and force every coaching response to show explicit numeric reasoning. Voice is a top-level differentiator for demo impact, but it must be layered on top of a text-first core so the product remains reliable under browser/device variance.

The recommended build strategy is a **modular monolith**: Next.js + Tailwind for experience, FastAPI for orchestration/ingestion/safety, Supabase for auth/data/storage, and Qdrant for retrieval. This stack is optimized for one-day shipping speed while preserving clean seams for production hardening (provider swaps, background jobs, stricter observability/privacy controls). Feature scope should stay narrow: upload-to-profile ingestion, “Can I buy this?” coaching, mandatory reasoning transparency, and Learn+Act action cards.

The primary risks are not raw model quality-they are **demo reliability, weak grounding, unsafe persona drift, and privacy narrative gaps**. Mitigation is clear: define a demo browser contract on day zero, enforce strict response schemas with required user numbers, isolate safety policy above persona style, separate trusted vs untrusted document content, and implement explicit short retention/deletion behavior. If these controls are in place, S.E.N.S.O. can present as both compelling and trustworthy.

## Key Findings

### Recommended Stack

Research converges on a pragmatic stack that maximizes hackathon velocity without painting the team into a corner. Next.js App Router and Tailwind provide fast UI iteration for voice/chat/action-card experiences. FastAPI + Pydantic handle typed AI orchestration, ingestion, and policy services cleanly. Supabase reduces backend infrastructure overhead for auth/session/storage, while Qdrant provides stronger retrieval quality and filtering than a minimal pgvector-only setup once document grounding matters.

**Core technologies:**
- **Next.js 16.2.1 + React 19.2.4:** voice/chat web UX + SSR/route handling - fastest polished demo path with production-ready deployment model.
- **Tailwind CSS 4.2.2:** rapid UI implementation - high speed-to-quality for hackathon iteration.
- **FastAPI 0.135.2 + Pydantic 2.12.x:** orchestration, ingestion, retrieval, safety APIs - typed contracts and strong Python AI ecosystem fit.
- **Supabase (supabase-js 2.100.0 / @supabase/ssr 0.9.0):** auth, Postgres, storage - minimal infra tax for MVP with easy scaling options.
- **Qdrant server/client 1.17.x:** vector storage/retrieval - better hybrid search and metadata filters for grounded responses.
- **Dual LLM adapter (google-genai 1.68.0 + openai 2.29.0):** extraction + recommendation generation - provider resilience/cost-performance tuning.
- **Voice stack (Web Speech API STT + ElevenLabs TTS):** conversational UX - strongest demo differentiation with fallback-required reliability strategy.

Critical compatibility constraints: FastAPI 0.135.2 requires modern Pydantic (>=2.9), and Qdrant client/server minor versions should stay aligned (1.17.x).

### Expected Features

The feature research is explicit: MVP success depends on proving trustworthy decision coaching, not broad fintech surface area.

**Must have (table stakes):**
- Upload-based financial data ingestion with profile extraction (CSV + basic document parsing).
- Automatic categorization/spending visibility sufficient for affordability reasoning.
- Personalized “Can I buy this?” responses grounded in user numbers.
- Mandatory reasoning transparency block in each answer (inputs, tradeoffs, assumptions).
- Safety/compliance guardrails (disclaimers, refusal boundaries, non-advisory framing).
- Lightweight account/session persistence.

**Should have (competitive):**
- Voice-first coaching loop with text fallback.
- Learn + Act action cards attached to every recommendation.
- Recurring/subscription detection and basic goal tracking in v1.x.
- Persona delivery styles that preserve a single safety core.

**Defer (v2+):**
- Autonomous money movement/auto-execution.
- Investment-picking style guidance.
- Heavy dashboard analytics expansion.
- Deep partner marketplace optimization and advanced gamification loops.

### Architecture Approach

Architecture research recommends a **FastAPI modular monolith** with explicit module contracts and async ingestion jobs. Core modules: identity/session, ingestion pipeline, financial profile service, conversation orchestrator, retrieval service, action-card matcher, and persona/safety engine. Retrieval and reasoning should be split (no giant prompt endpoint), and all voice interactions must preserve typed text fallbacks. Data plane: Postgres for canonical state, Qdrant for grounding context, object storage for raw uploads/OCR artifacts, plus swappable LLM/TTS adapters.

**Major components:**
1. **Experience layer (Next.js + voice adapters)** - chat/voice UI, auth screens, card rendering, fallback states.
2. **Application layer (FastAPI modular monolith)** - orchestrates ingestion, profile, retrieval, safety, and response assembly.
3. **Data/integration layer (Postgres + Qdrant + storage + external AI APIs)** - stores canonical facts, vector context, and external provider interactions.

### Critical Pitfalls

1. **STT portability + mic permission failures** - lock demo browser/device contract early; add explicit permission UX and typed fallback parity.
2. **End-to-end latency blow-up** - track STT/LLM/retrieval/TTS budgets, stream aggressively, and optimize for time-to-first-audio (<6s response start target).
3. **Generic “personalized” advice** - enforce schema requiring numeric grounding and reject/regenerate ungrounded outputs.
4. **Persona safety drift + prompt injection** - policy hierarchy above tone, post-generation safety checks, and strict trusted/untrusted prompt segmentation.
5. **Privacy/retention ambiguity** - define short TTLs for raw artifacts, minimize retained fields, and support one-click deletion for demo accounts.

## Implications for Roadmap

Based on combined research, suggested phase structure:

### Phase 0: Demo Reliability Contract
**Rationale:** Voice-first is the differentiator but also the most failure-prone surface; reliability must be locked before feature expansion.
**Delivers:** Browser/device contract, HTTPS permission flow, mic state UX, typed fallback with identical downstream path, deterministic demo mode toggle.
**Addresses:** Voice-first coaching viability from FEATURES; fallback requirements from ARCHITECTURE.
**Avoids:** Pitfalls 1, 2, and 10 (non-portable STT, permission surprises, no live-demo recovery).

### Phase 1: Grounded Data Foundation (Ingestion + Profile)
**Rationale:** Personalized coaching credibility depends on clean, canonical user financial state.
**Delivers:** Upload pipeline (CSV-first), async job processing, profile normalization, validation/confirmation UI, initial Qdrant indexing.
**Uses:** FastAPI + Pydantic, Supabase/Postgres, object storage, Qdrant.
**Implements:** Ingestion Pipeline + Financial Profile Service architecture modules.
**Avoids:** Pitfall 9 (silent extraction corruption) and profile drift from ad hoc parsing.

### Phase 2: Decision Core (Text-First Conversation + Safety)
**Rationale:** Prove the core product moment (“Can I buy this?” with reasoning) before adding voice complexity.
**Delivers:** Conversation orchestrator, retrieval-reasoning split, mandatory reasoning schema, citations, safety/policy enforcement, Learn+Act action-card baseline.
**Addresses:** P1 features (grounded coaching, transparency, guardrails, action cards).
**Avoids:** Pitfalls 4, 5, 6 (generic advice, unsafe persona outputs, prompt injection).

### Phase 3: Voice Experience + Performance Hardening
**Rationale:** Once text decision quality is stable, add voice loop and latency optimization to make the demo emotionally compelling.
**Delivers:** Web Speech STT integration, ElevenLabs streaming TTS, latency instrumentation/SLOs, degraded-mode UX handling.
**Uses:** Voice stack + provider adapters + observability logs.
**Implements:** Voice input/output adapters and end-to-end response streaming.
**Avoids:** Pitfall 3 (latency budget blow-up) and operational fragility during live use.

### Phase 4: Trust, Ethics, and v1.x Expansion
**Rationale:** After core loop works, layer trust narrative and retention mechanics before broader growth features.
**Delivers:** Retention/deletion controls, action-card ranking ethics, recurring/subscription detection, goal nudges, expanded personas.
**Addresses:** v1.x features and trust/compliance narrative for real-user transition.
**Avoids:** Pitfalls 7 and 8 (privacy failures, manipulative/irrelevant partner cards).

### Phase Ordering Rationale

- Dependencies force this order: ingestion/profile correctness precedes grounded coaching; grounded coaching precedes voice polish.
- Architecture naturally groups by bounded modules: ingestion/profile first, then conversation/retrieval/safety, then voice adapters and hardening.
- Pitfall prevention is front-loaded: the highest demo-kill risks (voice reliability, latency, grounding integrity) are addressed before optional enhancements.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 0:** Browser STT fallback strategy across target demo hardware and optional managed STT contingency.
- **Phase 3:** Latency tuning choices (model tiering, streaming strategy, TTFA optimization under real network conditions).
- **Phase 4:** Privacy/retention policy details and partner-card ranking governance (if monetization pressure grows).

Phases with standard patterns (can likely skip `/gsd-research-phase`):
- **Phase 1:** Async ingestion with job table + worker and schema validation are well-documented implementation patterns.
- **Phase 2:** Modular orchestrator + typed response contracts + retrieval split are mature, repeatable architecture patterns.

## Confidence Assessment

| Area         | Confidence  | Notes                                                                                                                                  |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH        | Backed by current official docs/releases and clear compatibility constraints.                                                          |
| Features     | MEDIUM-HIGH | Strong competitive pattern evidence, but some assumptions rely on market positioning and benchmark product marketing.                  |
| Architecture | HIGH        | Well-supported by established patterns (modular monolith, async jobs, retrieval split); scale path beyond MVP is somewhat inferential. |
| Pitfalls     | MEDIUM-HIGH | Risks are realistic and operationally grounded; exact mitigation thresholds need local validation in demo environment.                 |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Managed STT fallback decision:** Validate whether Web Speech reliability is sufficient on final demo hardware; pre-select fallback provider and cutover trigger.
- **Grounding quality thresholds:** Define measurable pass/fail criteria (e.g., % answers with correct numeric citations) before roadmap sign-off.
- **Safety policy test suite depth:** Expand red-team scenarios for prompt injection and persona drift beyond basic rule checks.
- **Retention/deletion implementation details:** Confirm actual TTL enforcement jobs and audit logging behavior in chosen storage layers.
- **Partner-card governance:** Specify ranking weights and conflict-of-interest disclosure before monetized recommendations are introduced.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` - technology recommendations, versions, compatibility, alternatives.
- `.planning/research/FEATURES.md` - table stakes, differentiators, anti-features, dependency graph.
- `.planning/research/ARCHITECTURE.md` - module boundaries, data flow, anti-patterns, build order.
- `.planning/research/PITFALLS.md` - critical risk taxonomy, warning signs, prevention phases.
- Official platform docs referenced within research files: Next.js, FastAPI, Supabase, Qdrant, ElevenLabs, MDN Web APIs.

### Secondary (MEDIUM confidence)
- Competitor/market references used in feature framing (Cleo, Rocket Money, Monarch, Copilot, NerdWallet comparative overview).
- OWASP GenAI LLM Top 10 and GDPR checklist framing for non-legal risk guidance.

### Tertiary (LOW confidence)
- None explicitly relied on for core recommendations.

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
