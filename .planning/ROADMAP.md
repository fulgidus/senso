# Roadmap: S.E.N.S.O. v2.0 Platform Architecture

## Overview
**Phases:** 8 | **Requirements:** 35 | **Coverage:** 100%

Build order follows research recommendation: Foundation → Data → AI → Frontend → Domain → Validation.

## Phase 33: Foundation Platform
**Goal:** Establish Domain Manifest parser and Chest registry as core platform foundation.
**Requirements:** CORE-01, CORE-02, CORE-03, CORE-05
**Success Criteria:**
1. Platform loads YAML Domain Manifest at startup and configures all subsystems
2. Chest Registry discovers and validates typed knowledge containers from manifest  
3. Each Chest has properly defined schema, scope, access mode, and storage config
4. Domain Manifest declaratively defines extractors, personas, behavior, filters, enrichment, and UI components
5. Empty finance domain manifest loads successfully without errors

## Phase 34: Data Architecture
**Goal:** Implement JSONB-based data layer with typed accessors and search capabilities.
**Requirements:** DATA-01, DATA-02, DATA-03, DATA-06
**Success Criteria:**
1. DB schema migrated to JSONB chest_items table with typed accessor classes
2. GIN indexes and expression indexes enable performant domain-specific queries
3. PII encryption feature flag works on/off per deployment via manifest config
4. BM25 search engine indexes Chest content at startup, scoped by locale and domain
5. Performance benchmarks show JSONB queries within 2x of original SQL performance

## Phase 35: AI Tool Generation & Data Flow
**Goal:** Auto-generate LLM tools from Chest metadata and establish data ingestion pipelines.
**Requirements:** CORE-04, DATA-05, DATA-07, DATA-04
**Success Criteria:**
1. LLM tool definitions auto-generated from Chest metadata without hardcoded tool dicts
2. File upload pipeline routes extracted data into domain-specific Chests (not hardcoded tables)
3. Adaptive extraction generates domain-aware modules using domain schema (not finance-assumed)
4. Webhook connector receives, validates HMAC, and routes inbound data to appropriate Chests
5. Generated tools accessible and callable by LLM with proper schema validation

## Phase 36: AI Engine & Filter Pipelines  
**Goal:** Implement configurable AI behavior with ordered filter pipelines and safety boundaries.
**Requirements:** AI-01, AI-02, AI-03, AI-05, AI-07, CORE-07
**Success Criteria:**
1. Input filter pipeline processes user messages through ordered, domain-configurable filters
2. Output filter pipeline processes AI responses with safety scan, PII scrub, domain compliance
3. Behavior layer loads ethos, boundaries, and allowlist from Domain Manifest (not hardcoded files)
4. Response enrichment (schemas, gates, caps) configurable via manifest
5. Safety scanner rules loaded from domain manifest (hard-boundaries.yml equivalent per domain)
6. Plugin system (pluggy) provides hook interfaces for domain-specific processing

## Phase 37: Personas & Coaching
**Goal:** Domain-configurable persona engine and coaching service with templated prompts.
**Requirements:** AI-04, AI-06
**Success Criteria:**
1. Persona engine loads soul files, dialectic register, style, and voice config from Domain Manifest
2. Coaching service assembles prompts from domain-specific Jinja2 templates (not auto-generated)
3. All persona configurations apply correctly without hardcoded behavior
4. Coaching responses maintain quality parity with v1.0 (measured via evaluation suite)

## Phase 38: Frontend SDUI Platform
**Goal:** Domain-driven UI rendering via SDUI with configurable theming and voice I/O.
**Requirements:** FE-01, FE-02, FE-03, FE-04, FE-05, FE-06
**Success Criteria:**
1. SDUI renderer (json-render or validated alternative) renders UI from domain-defined catalogs
2. Domain Manifest defines card types, profile views, and dashboard components via UI descriptors
3. Coaching response cards render via SDUI with domain-defined card types (not hardcoded React)
4. Admin panel renders domain-relevant management views driven by manifest
5. Voice I/O (TTS/STT) providers configurable per domain via manifest
6. Persona theming (colors, avatars, labels) loads from domain manifest

## Phase 39: Finance Domain Implementation
**Goal:** Recreate all v1.0 finance capabilities as first Domain Manifest to prove architecture.
**Requirements:** FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06, FIN-07, FIN-08
**Success Criteria:**
1. Finance Domain Manifest packages all v1.0 capabilities (ingestion, profiling, coaching, cards)
2. Finance Chests properly configured: user_profile, transactions, content, regional_knowledge, coaching_insights, timeline_events
3. Finance categorization runs as domain plugin (transaction categories, income detection, merchant mapping)
4. Italian payroll extraction runs as finance domain service, not core import
5. Finance safety rules load from finance manifest (hard-boundaries, ethos, allowlist)
6. Finance UI renders via SDUI from finance catalog (affordability verdict, transaction evidence, charts)
7. All 4 personas work through new persona engine (Mentore Saggio, Amico Sarcastico, Hartman, Cheerleader)
8. Finance content catalog loads as domain Chests (articles, videos, slides, partners, regional knowledge)

## Phase 40: Platform Validation & Domain Agnosticism
**Goal:** Verify platform core has zero domain-specific code and all v1.0 capabilities intact.
**Requirements:** CORE-06
**Success Criteria:**
1. Platform core source code contains zero finance-specific references or hardcoded logic
2. All v1.0 E2E test scenarios pass through new architecture
3. Performance benchmarks show ≤20% regression from v1.0 baseline
4. Domain Manifest can be swapped without code changes (demonstrated with minimal test domain)
5. Code audit confirms all domain logic lives in manifest + plugins, not platform core

## Dependencies

- **Phase 34** depends on **Phase 33** (Chest definitions needed for DB schema)
- **Phase 35** depends on **Phase 34** (requires JSONB storage for data flow)
- **Phase 36** depends on **Phase 35** (filter pipelines need tool generation working)
- **Phase 37** depends on **Phase 36** (personas need behavior layer and filters)
- **Phase 38** depends on **Phase 33** (SDUI needs Domain Manifest UI descriptors)
- **Phase 39** depends on **Phases 34-38** (finance domain needs all platform capabilities)
- **Phase 40** depends on **Phase 39** (validation needs finance domain working)

## Risk Mitigation

- **Second System Effect:** Keep original v1.0 running, limit initial scope to MVP platform
- **JSONB Performance:** Expression indexes on hot paths, EXPLAIN ANALYZE before migration  
- **Prompt Quality:** Preserve domain-specific .j2 templates, evaluation suites per domain
- **SDUI Complexity:** Start with simple cards/banners, aggressive caching, offline fallbacks
- **Plugin Hell:** Curated first-party domains, clear hook interfaces, minimal plugin surface

---
*Created: 2026-04-12*  
*Phases 33-40 | Requirements: 35 | Dependencies: 7*