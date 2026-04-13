# Requirements: S.E.N.S.O. v2.0 Platform Architecture

**Defined:** 2026-04-12
**Updated:** 2026-04-13 — auth-as-domain, platform identity primitive, personal_finance rename
**Core Value:** Pluggable AI coaching engine — any document-heavy advisory domain via Domain Manifest config.

## v2.0 Requirements

### Core Platform

- [ ] **CORE-01**: Platform loads a Domain Manifest (YAML + Python package) at startup and configures all subsystems from it
- [ ] **CORE-02**: Chest Registry discovers, validates, and manages typed knowledge containers defined in the Domain Manifest
- [ ] **CORE-03**: Each Chest has schema (JSON Schema), scope (user/domain/platform), access mode (searchable/tool_callable/direct), and storage config (encrypted/localized/ttl)
- [ ] **CORE-04**: LLM tool definitions are auto-generated from Chest metadata — no hardcoded tool dicts
- [ ] **CORE-05**: Domain Manifest defines extractors, personas, behavior, filters, enrichment, auth strategy, and UI components declaratively
- [ ] **CORE-06**: Platform core has zero domain-specific code — all domain logic lives in manifest + plugins
- [ ] **CORE-07**: Plugin system (pluggy) provides hook interfaces for domain-specific processing (extraction, categorization, enrichment, **authentication**)
- [ ] **CORE-08**: Platform identity primitive — `platform_identities(id UUID, domain_id VARCHAR, created_at TIMESTAMPTZ)` is the only platform-level identity table; all user shape (attributes, preferences, auth credentials) lives in domain-owned Chests; platform has zero knowledge of email, name, password, or any user attribute
- [ ] **CORE-09**: Domain Manifest declares auth strategy (auth type, OAuth providers, JWT config, session TTL); platform routes incoming requests to domain auth plugin via pluggy hookspec `authenticate_request(token) → identity_id | None`; domain plugin owns all auth logic

### AI Engine

- [ ] **AI-01**: Input filter pipeline processes user messages through ordered, domain-configurable filters (rule-based + LLM-based)
- [ ] **AI-02**: Output filter pipeline processes AI responses through ordered, domain-configurable filters (safety scan, PII scrub, domain compliance)
- [ ] **AI-03**: Behavior layer loads ethos, boundaries, and allowlist from Domain Manifest — not hardcoded files
- [ ] **AI-04**: Persona engine loads soul files, dialectic register, style, and voice config from Domain Manifest
- [ ] **AI-05**: Response enrichment (schemas, gates, caps) is domain-configurable via manifest
- [ ] **AI-06**: Coaching service assembles prompts from domain-specific Jinja2 templates (not auto-generated from schema)
- [ ] **AI-07**: Safety scanner rules are loaded from domain manifest (hard-boundaries.yml equivalent per domain)

### Data Layer

- [ ] **DATA-01**: Domain Manifest JSON Schema fields drive dynamic SQLAlchemy model generation — each Chest gets a typed table (`{domain_id}__{chest_id}`) with top-level scalar fields as typed columns and nested objects as JSONB; tables created via `CREATE TABLE IF NOT EXISTS` at startup; DomainManager routing flag enables/disables domains without DDL
- [ ] **DATA-02**: Typed columns on hot query paths get conventional B-tree indexes; residual JSONB columns (nested objects/arrays) get GIN indexes; index definitions declared in ChestDef or derived from JSON Schema annotations
- [ ] **DATA-03**: PII encryption is a per-chest feature flag — `StorageConfig.encrypted=true` in manifest causes that chest's typed table to use `EncryptedType` columns; unencrypted chests use plain typed columns
- [ ] **DATA-04**: Webhook connector receives, validates (HMAC), and routes inbound data to appropriate Chests
- [ ] **DATA-05**: File upload pipeline routes extracted data into domain-specific Chests (not hardcoded tables)
- [ ] **DATA-06**: BM25 search engine indexes Chest content at startup, scoped by locale and domain
- [ ] **DATA-07**: Adaptive extraction generates domain-aware modules using domain schema (not finance-assumed)

### Frontend

- [ ] **FE-01**: SDUI renderer (json-render or validated alternative) renders UI from domain-defined catalog + server specs
- [ ] **FE-02**: Domain Manifest defines card types, profile views, and dashboard components via UI descriptors
- [ ] **FE-03**: Coaching response cards render via SDUI — card types are domain-defined, not hardcoded React components
- [ ] **FE-04**: Admin panel renders domain-relevant management views driven by manifest
- [ ] **FE-05**: Voice I/O (TTS/STT) providers are configurable per domain via manifest
- [ ] **FE-06**: Persona theming (colors, avatars, labels) loads from domain manifest

### personal_finance Domain

> Formerly "finance". Renamed to reflect individual-only scope — no company/B2B support in v2.0.

- [ ] **FIN-01**: personal_finance Domain Manifest packages all v1.0 capabilities (ingestion, profiling, coaching, cards)
- [ ] **FIN-02**: personal_finance Chests: user_profile, transactions, content, regional_knowledge, coaching_insights, timeline_events, user_prefs
- [ ] **FIN-03**: Finance categorization (transaction categories, income detection, merchant mapping) runs as domain plugin
- [ ] **FIN-04**: Italian payroll extraction runs as personal_finance domain service, not core import
- [ ] **FIN-05**: Finance safety rules (hard-boundaries, ethos, allowlist) load from personal_finance manifest
- [ ] **FIN-06**: Finance UI (affordability verdict, transaction evidence, spending charts) renders via SDUI from personal_finance catalog
- [ ] **FIN-07**: All 4 personas (Mentore Saggio, Amico Sarcastico, Hartman, Cheerleader) work through new persona engine
- [ ] **FIN-08**: Finance content catalog (articles, videos, slides, partners, regional knowledge) loads as domain Chests
- [ ] **FIN-09**: personal_finance auth plugin implements email/password signup + login + Google OAuth + JWT access/refresh token rotation — full v1.0 auth parity via domain plugin (not platform code)
- [ ] **FIN-10**: personal_finance `user_prefs` chest owns first_name, last_name, voice_gender, default_persona_id, voice_auto_listen — all fields previously on platform `users` table

## v2.1 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multi-Domain

- **MULTI-01**: Multiple Domain Manifests can coexist in a single deployment
- **MULTI-02**: Identities can span multiple domains with cross-domain auth

### Data Connectors

- **CONN-01**: PSD2/Open Banking connector interface
- **CONN-02**: Database connector (pull data from external DBs into Chests)
- **CONN-03**: Connector marketplace for third-party data integrations

### Advanced

- **ADV-01**: Schema evolution with zero-downtime migration
- **ADV-02**: Domain Manifest hot-reload without restart (install new domain in running instance)
- **ADV-03**: Multi-tenant deployment with PostgreSQL RLS

## Out of Scope

| Feature | Reason |
| --- | --- |
| Native mobile app | Web-first PWA — SDUI handles responsive |
| Multi-domain per instance | Single domain per deployment for v2.0 |
| PSD2/Open Banking | Webhook + file upload sufficient |
| Analytics dashboards | Coaching and decision support, not passive tracking |
| Domain marketplace | First-party domains only for v2.0 |
| Auto-generated prompts | 10-13% quality loss. Domain-specific .j2 files only. |
| Vector search / RAG | BM25 sufficient for current scale |
| RBAC | Domain concern — not needed until a domain requires it |
| Messaging | Domain concern — defer to dedicated domain |
| Hot domain install (running instance) | ADV-02 — v2.1+ |

## Traceability

| Requirement | Phase | Status |
| --- | --- | --- |
| CORE-01 | 33 | Pending |
| CORE-02 | 33 | Pending |
| CORE-03 | 33 | Pending |
| CORE-04 | 35 | Pending |
| CORE-05 | 33 | Pending |
| CORE-06 | 40 | Pending |
| CORE-07 | 36 | Pending |
| CORE-08 | 34 | Pending |
| CORE-09 | 36 | Pending |
| AI-01 | 36 | Pending |
| AI-02 | 36 | Pending |
| AI-03 | 36 | Pending |
| AI-04 | 37 | Pending |
| AI-05 | 36 | Pending |
| AI-06 | 37 | Pending |
| AI-07 | 36 | Pending |
| DATA-01 | 34 | Pending |
| DATA-02 | 34 | Pending |
| DATA-03 | 34 | Pending |
| DATA-04 | 35 | Pending |
| DATA-05 | 35 | Pending |
| DATA-06 | 34 | Pending |
| DATA-07 | 35 | Pending |
| FE-01 | 38 | Pending |
| FE-02 | 38 | Pending |
| FE-03 | 38 | Pending |
| FE-04 | 38 | Pending |
| FE-05 | 38 | Pending |
| FE-06 | 38 | Pending |
| FIN-01 | 39 | Pending |
| FIN-02 | 39 | Pending |
| FIN-03 | 39 | Pending |
| FIN-04 | 39 | Pending |
| FIN-05 | 39 | Pending |
| FIN-06 | 39 | Pending |
| FIN-07 | 39 | Pending |
| FIN-08 | 39 | Pending |
| FIN-09 | 39 | Pending |
| FIN-10 | 39 | Pending |

**Coverage:**
- v2.0 requirements: 39 total (+4 from auth-as-domain revision)
- Mapped to phases: 39
- Unmapped: 0 ✅

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-13 — CORE-08/09 added (platform identity + auth-as-domain); FIN-09/10 added; finance→personal_finance rename; DATA-01/02 revised (typed tables, no pure JSONB)*
