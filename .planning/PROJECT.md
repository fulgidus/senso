# S.E.N.S.O. - Sistema Educativo per Numeri, Spese e Obiettivi

## What This Is

Domain-agnostic AI coaching platform. Domains (finance, health, legal, etc.) are pluggable configurations — not hardcoded code. Users upload documents, receive structured profiles, and get personalized coaching via voice or text, all driven by a Domain Manifest that defines the knowledge model, AI behavior, and UI rendering.

Finance is the first domain, proving the architecture end-to-end.

## Core Value

Provide a pluggable AI coaching engine where any document-heavy advisory domain can be deployed by configuring a Domain Manifest — without code changes to the platform core.

## Current Milestone: v2.0 Platform Architecture

**Goal:** Rebuild SENSO as a domain-agnostic platform where domains are pluggable configurations. Finance is the first domain manifest.

**Target features:**
- Chest Registry — unified knowledge containers with schema, scope, access, storage metadata
- Domain Manifest — declarative config defining chests, personas, behavior, tools, filters, enrichment, extractors, UI
- Tool Auto-Generation — LLM tools derived from Chest definitions
- Filter Pipelines — ordered input/output filter chains (rule-based + LLM-based)
- Behavior Layer — domain-configurable ethos, boundaries, allowlist
- Persona Engine — soul, dialectic register, style, voices per domain
- Response Enrichment — domain-configurable schemas, gates, caps
- DB schema redesigned for domain-pluggable profiles
- PII encryption as feature flag
- Webhook data connector
- Domain-driven frontend (evaluate json-render / SDUI)
- Finance domain recreated as first Domain Manifest
- Categorization, extraction, payroll as domain plugins

## Requirements

### Validated

- ✓ Document ingestion (bank CSV, payslip, receipts, utility bills) → structured financial profile — v1.0
- ✓ Income, recurring expenses, monthly margin, spending breakdown by category — v1.0
- ✓ Voice and text coaching grounded in user's real data — v1.0
- ✓ Transparent reasoning + educational framing — v1.0
- ✓ Actionable cards: learning resources, partner offers, calculators — v1.0
- ✓ Configurable mentor personas with shared safety boundaries — v1.0
- ✓ Multi-locale support (Italian primary, English secondary) — v1.0
- ✓ E2E encrypted PII (sealed profile, X25519/AES-GCM) — v1.0
- ✓ Timeline event detection — v1.0
- ✓ Adaptive document extraction (module generation for unknown formats) — v1.0

### Active

See `.planning/REQUIREMENTS.md` for detailed v2.0 requirements with REQ-IDs.

### Out of Scope

- Native mobile app — web-first PWA
- Open-banking account connectors (PSD2) — webhook + file upload only for v2.0
- Portfolio/investing suite — spending-decision coaching only
- Analytics dashboards — conversation and decision support over passive tracking
- Database connectors — defer to v2.1+
- Multiple simultaneous domains per deployment — single domain per instance for v2.0

## Context

v1.0 shipped a fully functional AI financial education platform (32 phases, 132 plans, 31 requirements). The architecture works but is finance-hardwired: DB columns, coaching tools, safety rules, categorization logic, and UI components all assume financial data.

v2.0 is a clean-room rebuild on domain-agnostic abstractions. No production users or data — scorched earth is safe. The key insight: all data (user profiles, transactions, content, regional knowledge, coaching insights) can be unified as "Chests" — typed knowledge containers with metadata that drives storage, access, and tool generation.

**Key architectural concept: Chest**
A Chest is a typed, self-contained knowledge container with:
- `schema` — domain-specific structure (JSON Schema)
- `scope` — user (private), domain (shared), platform (global)
- `access` — searchable, tool_callable, direct
- `storage` — encrypted, localized, ttl
- `tool_spec` — auto-generates LLM tool definition

A Domain Manifest is a collection of Chests + behavior config + personas + filters + enrichment + UI descriptors.

## Constraints

- **Domain Agnosticism**: Platform core must have zero domain-specific code. All domain logic lives in the Domain Manifest and its plugins.
- **AI Centrality**: AI drives core experience (ingestion + profiling + coaching), not decorative.
- **Data/Safety**: Safety boundaries are domain-configurable but the filter pipeline is platform-enforced.
- **i18n**: Locale support is platform-level. All strings, content, LLM output carry `locale`. Never hardcode language strings.
- **Pluggability**: New domains, document types, languages, AI providers, or UI components = config changes, not code rewrites.
- **PII Flexibility**: E2E encryption is a feature flag — some domains/clients need it, others don't.

## Key Decisions

| Decision | Rationale | Outcome |
| --- | --- | --- |
| "Chest" as unified knowledge abstraction | All data types (profiles, transactions, content, insights) follow the same pattern: typed container with schema, scope, access, storage rules. Unifying them makes tools auto-generatable and domains pluggable. | - Pending |
| Scorched earth for v2.0 | No production users or data. Clean redesign avoids migration complexity and legacy patterns. | - Pending |
| json-render (Vercel) for domain-driven UI | Schema-agnostic, already supports A2UI (which SENSO uses), catalog/spec pattern maps to Domain Manifest. Needs deeper evaluation during research. | - Pending |
| Finance as first domain | Proves the architecture end-to-end with a domain that's already fully implemented. Validates that the abstraction doesn't lose functionality. | - Pending |
| Single domain per deployment (v2.0) | Multi-domain is future scope. Simplifies auth, storage, and UI rendering. | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after v2.0 milestone initialization*
