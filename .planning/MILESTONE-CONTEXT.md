# Milestone Context

**Gathered:** 2026-04-13
**Status:** Ready for /gsd-new-milestone

<milestone_goal>
## Goal

Rebuild SENSO as a domain-agnostic platform where domains are pluggable configurations, with Finance as the first Domain Manifest proving the architecture end-to-end.

</milestone_goal>

<scope>
## Scope

### In this milestone

- **Domain Manifest + Chest Registry**: Platform loads a YAML manifest at startup; all subsystems (tools, filters, personas, UI) configure from it — zero hardcoded domain logic
- **JSONB Data Layer**: DB schema replaced with typed `chest_items` table; GIN indexes + typed accessors; PII encryption as feature flag; BM25 search scoped by locale + domain
- **AI Tool Auto-Generation**: LLM tool definitions derived from Chest metadata — no hardcoded tool dicts
- **Data Ingestion Pipelines**: File upload + webhook connector route extracted data into domain-specific Chests
- **Filter Pipelines**: Ordered input/output filter chains (rule-based + LLM-based); safety rules loaded from manifest per domain
- **Behavior Layer**: Ethos, boundaries, allowlist loaded from manifest; pluggy hook interfaces for domain-specific processing
- **Persona Engine**: Soul files, dialectic register, style, voice config all from manifest; Jinja2 prompt templates per domain
- **Frontend SDUI Platform**: Domain-driven UI via json-render (or validated alternative); card types, profile views, voice I/O providers all manifest-configurable
- **Finance Domain Manifest**: All v1.0 capabilities (ingestion, profiling, coaching, cards, 4 personas, content catalog, payroll, categorization) repackaged as first Domain Manifest
- **Platform Validation**: Core has zero finance-specific code; all v1.0 E2E tests pass; ≤20% perf regression; manifest swap demonstrated

### Explicitly out of scope

- **Native mobile app**: Web-first PWA only
- **PSD2 / open-banking connectors**: Webhook + file upload only
- **Portfolio / investing suite**: Spending-decision coaching only
- **Analytics dashboards**: Conversation support over passive tracking
- **Database connectors**: Deferred to v2.1+
- **Multi-domain per deployment**: Single domain per instance for v2.0

</scope>

<constraints>
## Constraints

- Platform core must contain zero domain-specific code — all domain logic in manifest + plugins
- Finance domain must achieve full behavioral parity with v1.0 (no capability regression)
- PII encryption is a feature flag — not mandatory for all domains
- Single domain per deployment (multi-domain is future scope)
- i18n is platform-level — all strings, content, LLM output carry `locale`; no hardcoded language strings

</constraints>

<success>
## Success Definition

This milestone is successful when:
- A new domain can be deployed by dropping a Domain Manifest YAML — zero platform code changes required
- All v1.0 finance E2E scenarios pass through the new architecture
- A code audit confirms the platform core contains zero finance-specific references

</success>

<open_questions>
## Open Questions for Planning

- json-render (Vercel) vs alternative SDUI library — needs evaluation in Phase 38 research before committing
- pluggy hook surface: how minimal can the plugin interface be while covering finance domain needs?

</open_questions>

---

*Milestone context gathered: 2026-04-13*
*Run /gsd-new-milestone to start planning*
