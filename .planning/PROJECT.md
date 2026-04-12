# S.E.N.S.O. - Sistema Educativo per Numeri, Spese e Obiettivi

## What This Is

Modular AI financial education platform. Users upload financial documents, receive structured profiles, and get personalized coaching via voice or text — grounded in their real data.

Built for extensibility: ingestion modules, LLM providers, content catalogs, and coaching personas are all pluggable.

## Core Value

Help users make better financial decisions by combining their real financial data with AI guidance and actionable education.

## Capabilities (Shipped)

- Document ingestion (bank CSV, payslip, receipts, utility bills) → structured financial profile
- Income, recurring expenses, monthly margin, spending breakdown by category
- Voice and text coaching grounded in user's real data
- Transparent reasoning (what data drove the advice) + educational framing
- Actionable cards: learning resources, partner offers, calculators
- Configurable mentor personas with shared safety boundaries
- Multi-locale support (Italian primary, English secondary)
- E2E encrypted PII (sealed profile, X25519/AES-GCM)
- Timeline event detection (job changes, major purchases, subscription drift)
- Adaptive document extraction (module generation for unknown formats)

## Out of Scope (Current)

- Native mobile app — web-first PWA
- Open-banking account connectors — file upload only
- Portfolio/investing suite — spending-decision coaching only
- Analytics dashboards — conversation and decision support over passive tracking

## Constraints

- **Audience**: Young adults with low financial literacy — simple, direct, jargon-light.
- **AI Centrality**: AI drives core experience (ingestion + profiling + coaching), not decorative.
- **Data/Safety**: Financial guidance avoids unsafe advice patterns; persona boundaries enforced.
- **i18n**: Italian-first. All strings, content, LLM output carry `locale`. Never hardcode language strings.
- **Modularity**: New document types, languages, or AI providers = config changes, not rewrites.
