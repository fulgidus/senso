# Roadmap: S.E.N.S.O. v2.0 Platform Architecture

## Overview
**Phases:** 8 | **Requirements:** 39 | **Coverage:** 100%

Build order: Foundation → Data → AI → Frontend → Domain → Validation.

**Platform core identity:** `platform_identities(id, domain_id, created_at)` — nothing else. All user shape, auth, and PII is domain-owned.

## Phase 33: Foundation Platform
**Goal:** Establish Domain Manifest parser and Chest registry as core platform foundation.
**Requirements:** CORE-01, CORE-02, CORE-03, CORE-05
**Success Criteria:**
1. Platform loads YAML Domain Manifest at startup and configures all subsystems
2. Chest Registry discovers and validates typed knowledge containers from manifest
3. Each Chest has properly defined schema, scope, access mode, and storage config
4. Domain Manifest declaratively defines extractors, personas, behavior, filters, enrichment, auth strategy, and UI components
5. Empty personal_finance domain manifest loads successfully without errors

## Phase 34: Data Architecture
**Goal:** Provision platform identity primitive and dynamic typed-table data layer from Chest schemas.
**Requirements:** DATA-01, DATA-02, DATA-03, DATA-06, CORE-08
**Success Criteria:**
1. `platform_identities(id, domain_id, created_at)` is the only platform-level identity table — no `users` table with domain fields
2. DomainModelFactory generates fully typed SQLAlchemy tables from Chest JSON Schemas at startup (`personal_finance__transactions`, `personal_finance__user_profile`, etc.)
3. All columns are scalar-typed from JSON Schema; no JSONB fallback — schema must be flat or produce a schema error
4. B-tree indexes on FK columns and declared hot-path columns; PII encryption per-chest via `StorageConfig.encrypted`
5. DomainManager routing flag enables/disables domain without DDL
6. BM25 search engine indexes all `searchable` Chests at startup, scoped by locale and domain_id

## Phase 35: AI Tool Generation & Data Flow
**Goal:** Auto-generate LLM tools from Chest metadata and establish data ingestion pipelines.
**Requirements:** CORE-04, DATA-05, DATA-07, DATA-04
**Success Criteria:**
1. LLM tool definitions auto-generated from Chest metadata — zero hardcoded tool dicts
2. File upload pipeline routes extracted data into domain-specific Chests
3. Adaptive extraction generates domain-aware modules using domain schema
4. Webhook connector receives, validates HMAC, and routes inbound data to appropriate Chests
5. Generated tools callable by LLM with proper schema validation

## Phase 36: AI Engine & Filter Pipelines
**Goal:** Implement configurable AI behavior, filter pipelines, auth hookspec, and plugin system.
**Requirements:** AI-01, AI-02, AI-03, AI-05, AI-07, CORE-07, CORE-09
**Success Criteria:**
1. Input filter pipeline processes user messages through ordered, domain-configurable filters
2. Output filter pipeline processes AI responses with safety scan, PII scrub, domain compliance
3. Behavior layer loads ethos, boundaries, and allowlist from Domain Manifest — not hardcoded files
4. Response enrichment (schemas, gates, caps) configurable via manifest
5. Safety scanner rules loaded from domain manifest
6. Plugin system (pluggy) provides hookspecs for: extraction, categorization, enrichment, **authentication**
7. Platform middleware calls `authenticate_request(token) → identity_id | None` on every request — domain plugin resolves it; platform never inspects token contents

## Phase 37: Personas & Coaching
**Goal:** Domain-configurable persona engine and coaching service with templated prompts.
**Requirements:** AI-04, AI-06
**Success Criteria:**
1. Persona engine loads soul files, dialectic register, style, and voice config from Domain Manifest
2. Coaching service assembles prompts from domain-specific Jinja2 templates
3. All persona configurations apply correctly without hardcoded behavior
4. Coaching responses maintain quality parity with v1.0 (measured via evaluation suite)

## Phase 38: Frontend SDUI Platform
**Goal:** Domain-driven UI rendering via SDUI with configurable theming and voice I/O.
**Requirements:** FE-01, FE-02, FE-03, FE-04, FE-05, FE-06
**Success Criteria:**
1. SDUI renderer (json-render or validated alternative) renders UI from domain-defined catalogs
2. Domain Manifest defines card types, profile views, and dashboard components via UI descriptors
3. Coaching response cards render via SDUI with domain-defined card types — no hardcoded React
4. Admin panel renders domain-relevant management views driven by manifest
5. Voice I/O (TTS/STT) providers configurable per domain via manifest
6. Persona theming (colors, avatars, labels) loads from domain manifest

## Phase 39: personal_finance Domain Implementation
**Goal:** Recreate all v1.0 capabilities as the personal_finance Domain Manifest, proving the architecture end-to-end.
**Requirements:** FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06, FIN-07, FIN-08, FIN-09, FIN-10
**Success Criteria:**
1. personal_finance Domain Manifest packages all v1.0 capabilities (ingestion, profiling, coaching, cards)
2. personal_finance Chests: user_profile, transactions, content, regional_knowledge, coaching_insights, timeline_events, user_prefs
3. Finance categorization, income detection, merchant mapping run as domain plugins
4. Italian payroll extraction runs as personal_finance domain service
5. Finance safety rules load from personal_finance manifest
6. Finance UI renders via SDUI from personal_finance catalog (affordability verdict, transaction evidence, charts)
7. All 4 personas work through new persona engine
8. Finance content catalog loads as domain Chests
9. personal_finance auth plugin delivers full v1.0 auth parity: email/password + Google OAuth + JWT access/refresh rotation — implemented as domain plugin, zero platform auth code
10. personal_finance `user_prefs` chest owns first_name, last_name, voice_gender, default_persona_id, voice_auto_listen — not platform fields

## Phase 40: Platform Validation & Domain Agnosticism
**Goal:** Verify platform core has zero domain-specific code and all v1.0 capabilities intact.
**Requirements:** CORE-06
**Success Criteria:**
1. Platform core has zero references to: email, password, persona_id, voice_gender, finance, transaction, income — any domain concept
2. `platform_identities` is the only identity table in platform migrations
3. All v1.0 E2E test scenarios pass through new architecture
4. Performance benchmarks show ≤20% regression from v1.0 baseline
5. Swap personal_finance manifest for a minimal test domain — platform boots and serves requests without code changes

## Dependencies

- **Phase 34** depends on **Phase 33** (Chest definitions drive table generation)
- **Phase 35** depends on **Phase 34** (typed tables needed for data flow)
- **Phase 36** depends on **Phase 35** (filter pipelines + auth hookspec need tool gen working)
- **Phase 37** depends on **Phase 36** (personas need behavior layer and filters)
- **Phase 38** depends on **Phase 33** (SDUI needs Domain Manifest UI descriptors)
- **Phase 39** depends on **Phases 34-38** (personal_finance domain needs all platform capabilities)
- **Phase 40** depends on **Phase 39** (validation needs the full domain working)

## Risk Mitigation

- **Second System Effect:** Keep v1.0 running in parallel; personal_finance domain must match v1.0 feature-for-feature
- **Auth-as-domain parity:** personal_finance auth plugin must replicate v1.0 JWT/OAuth behavior exactly — no silent regressions
- **Typed table schema enforcement:** DomainModelFactory must reject non-flat schemas with clear errors, not silently fall back to JSONB
- **Prompt Quality:** Preserve domain-specific .j2 templates; evaluation suite per domain
- **SDUI Complexity:** Start with simple cards/banners; aggressive caching; offline fallbacks
- **Plugin Hell:** Curated first-party domains; minimal hookspec surface; no plugin-of-plugins

---
*Created: 2026-04-12*
*Updated: 2026-04-13 — auth-as-domain, platform identity primitive, personal_finance rename, typed tables*
*Phases 33-40 | Requirements: 39 | Dependencies: 7*
