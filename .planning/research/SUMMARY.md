# Research Summary — v2.0 Platform Architecture

**Project:** S.E.N.S.O.
**Researched:** 2026-04-12
**Confidence:** HIGH

## Executive Summary

Rebuilding SENSO as domain-agnostic platform is well-supported by established patterns. Core abstractions: **Chest** (typed JSONB knowledge containers) + **Domain Manifest** (hybrid YAML config + Python packages). Key tech: **pluggy** for plugin hooks, **json-render** for SDUI, **hybrid JSONB + typed accessors** for DB, **Svix** for webhooks. Critical risk: prompt quality degradation through abstraction (measured 10-13% drops in studies). Mitigation: domain-specific prompt templates preserved, evaluation suites per domain.

## Stack Additions

| Addition | Library | Size | Risk | Rationale |
|----------|---------|------|------|-----------|
| SDUI Renderer | json-render v0.16+ | 467KB React | LOW | A2UI native, schema-agnostic, Tailwind compat via shadcn |
| Plugin System | pluggy v1.4+ | 45KB | LOW | Pytest-proven, hook-based, FastAPI-compatible |
| Webhooks | Svix v1.29+ | 15KB | LOW | HMAC sig verification, replay protection, async |
| DB Flexibility | PostgreSQL JSONB + GIN | n/a | MEDIUM | Hybrid typed columns + JSONB, expression indexes for hot paths |
| Filter Pipelines | FastAPI DI + middleware | n/a | LOW | Native pattern, no new deps |

## Feature Classification

**Table Stakes:** RAG knowledge retrieval, schema-driven API generation, multi-model support, component-based UI, audit logging.

**Differentiators:** Schema-driven Domain Manifests, auto-generated LLM tools from Chest metadata, dynamic safety policy engine, governance-first architecture.

**Anti-Features:** AI model lock-in, monolithic domain embedding, client-side schema coupling, static safety policies.

## Architecture Pattern

```
Domain Manifest (YAML + Python)
├── Chests (JSONB, typed accessors, auto-tool-gen)
├── Personas (soul + voice + style config)
├── Behavior (ethos, boundaries, allowlist)
├── Filters (ordered input/output pipelines via pluggy hooks)
├── Enrichment (response schema, gates, caps)
├── Extractors (ingestion modules, adaptive gen)
└── UI Components (json-render catalog/spec)
```

**DB Strategy:** Single `chest_items` table with JSONB `data` column + GIN index. Domain-specific typed accessor classes for safety. PostgreSQL RLS for future multi-tenancy.

**Build Order (recommended):**
1. Domain Manifest parser + Chest registry (foundation)
2. DB schema redesign (JSONB + typed accessors)
3. Tool auto-generation from Chests
4. Filter pipelines (input/output)
5. SDUI integration (json-render)
6. Finance domain manifest (prove it works)

## Critical Pitfalls

1. **Second System Effect** — Over-engineering risk. Prevention: MVP platform, keep original running, limit initial scope.
2. **JSONB Performance** — 15-20x slower without GIN indexes. Prevention: expression indexes on hot paths, `EXPLAIN ANALYZE` before migration.
3. **Prompt Degradation** — Generic templates lose 10-13% task accuracy. Prevention: domain-specific prompt files (not generated), evaluation suites per domain.
4. **SDUI Complexity** — Network latency on UI changes, debugging across boundaries. Prevention: start simple (cards/banners), aggressive caching, offline fallbacks.
5. **Plugin Hell** — Configuration overwhelm, version conflicts. Prevention: curated first-party domains, clear hook interfaces, minimal plugin surface.
6. **Type Safety Loss** — Auto-generated tools lose schema fidelity. Prevention: typed accessors wrap JSONB, validation at boundary, not trust.

## Implications for Requirements

- Chest registry must auto-generate LLM tool defs from schema metadata
- Domain Manifest = YAML declarative config + Python package for complex logic
- Filter pipelines use pluggy hooks, registered per-domain
- json-render needs deeper bundle testing before committing (eval during Phase 1)
- Prompts stay as .j2 files per domain — NOT auto-generated from schema
- JSONB needs expression indexes planned per-domain from day one

---
*Research completed: 2026-04-12 for v2.0 Platform Architecture*
*Ready for requirements: yes*
