# S.E.N.S.O. - Sistema Educativo per Numeri, Spese e Obiettivi

## What This Is

S.E.N.S.O. is a voice-first AI financial education assistant for young adults (18-30) that turns real spending decisions into personalized learning moments. Users upload real financial documents, then ask "Can I buy this?" and receive grounded answers based on their own numbers, with clear reasoning, educational resources, and actionable next steps. It is designed as a working, demo-ready product for a one-day hackathon where AI must be central and non-decorative.

## Core Value

Help users make better financial decisions in the moment by combining their real financial data with direct, educational AI guidance and concrete actions.

## Requirements

### Validated

- [x] Users can upload core financial inputs (bank CSV, payslip, receipts/screens) and receive a structured financial profile. *(Validated in Phase 2: Financial Input Ingestion)*
- [x] Users receive a financial profile showing income, recurring expenses, monthly margin, and spending breakdown by category. *(Validated in Phase 3: Financial Profile Clarity)*
- [x] Users can ask voice or text questions about purchases/choices and get personalized answers grounded in their real data. *(Validated in Phase 4: Safe Grounded Text Coaching + Phase 5: Voice Coaching Loop)*
- [x] AI responses include transparent reasoning (what data drove the advice) and an educational explanation, not just a verdict. *(Validated in Phase 4: Safe Grounded Text Coaching)*
- [x] Responses surface actionable cards for learning resources and relevant financial services/partner actions. *(Validated in Phase 6: Learn+Act Cards & Demo Hardening)*
- [x] Persona-based mentor tone is configurable while preserving safety boundaries and non-harmful guidance. *(Validated in Phase 7: Streaming & Nice-to-Have Polish)*
- [x] MVP supports a fast live demo flow (~75 seconds) from upload to spoken recommendation. *(Validated in Phase 6: Demo Hardening)*
- [x] Users can authenticate (email/password + Google OAuth) to preserve sessions and progress. *(Validated in Phase 1: Runtime & Account Foundation)*

### Active

None - all v1.0 requirements validated.

### Out of Scope

- Full native mobile app in MVP - web-first experience is faster for hackathon delivery and demo reliability.
- Deep open-banking account connectors in MVP - mocked/partial ingestion via uploaded documents is sufficient for first validation.
- Advanced portfolio/investing suite - not core to immediate spending-decision coaching value.
- Generic analytics dashboards and heavy charting - product positioning prioritizes conversation and decision support over passive tracking.

## Context

- Primary context is Punkathon 2026 challenge: build a concrete, accessible, desirable AI solution for youth financial education in one day.
- Existing concept defines strong voice-first UX, mentor personas, and a funnel from education to real actions (bank/partner services).
- The repository already includes persona governance assets in `personas/` (`ethos.md`, `boundaries.md`, `hard-boundaries.yml`, per-persona soul files).
- Proposed stack direction from concept: Next.js + Tailwind frontend, FastAPI backend, Postgres + Qdrant, LLM-based parsing and response orchestration, ElevenLabs TTS, browser STT.
- Success in judging depends on demonstrability, clear AI centrality, practical utility, and execution quality under tight time constraints.

## Constraints

- **Timeline**: One-day hackathon build and same-day demo - requires strict MVP slicing and rapid integration choices.
- **Product**: Must be concretely demoable, not conceptual - every core interaction must run end-to-end during demo.
- **AI Centrality**: AI must drive the core experience (ingestion reasoning + conversational guidance), not decorative add-ons.
- **Audience**: Young adults 18-30 with low financial literacy - language and UX must be simple, direct, and jargon-light.
- **Voice**: Voice interaction is a primary differentiator in this challenge context - spoken I/O quality must be reliable.
- **Data/Safety**: Financial guidance must avoid unsafe advice patterns and enforce persona boundaries consistently.

## Key Decisions

| Decision                                                                 | Rationale                                                                                         | Outcome   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------- |
| Build voice-first coaching instead of dashboard-first budgeting          | Better aligns with target users and challenge requirement for desirable, concrete behavior change | - Pending |
| Ground all answers in uploaded user data + RAG context                   | Creates trust and personalization; avoids generic financial tips                                  | - Pending |
| Include educational + action cards on every recommendation               | Converts insight into learning and immediate next action                                          | - Pending |
| Use configurable mentor personas with shared ethos and safety boundaries | Enables tone differentiation without compromising guidance quality/safety                         | - Pending |
| Prioritize demo reliability over feature breadth                         | Hackathon judging rewards working end-to-end experience under time constraints                    | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -> still the right priority?
3. Audit Out of Scope -> reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-29 after Phase 7 completion - all v1.0 milestone phases complete. Streaming, persona UX, PII safety cross-check, and demo polish shipped.*
