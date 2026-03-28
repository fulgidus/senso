---
id: SEED-002
status: dormant
planted: 2026-03-28
planted_during: v1.0 / Phase 4 complete (between Phase 5 and 6 planning)
trigger_when: any milestone touching production readiness, compliance, security hardening, admin tooling, or a second major release
scope: Large
---

# SEED-002: Encryption at rest, Zero Data Retention policy enforcement, and pre-flight deployment checks

## Why This Matters

Users upload sensitive financial documents (payslips, bank statements, invoices). At rest these
are stored in MinIO object storage and Postgres. If a storage breach occurs, unencrypted data is
immediately readable. Encryption at rest (AES-256 or Fernet for DB fields, server-side encryption
on MinIO) limits blast radius.

Zero Data Retention (ZDR) is a feature offered by some LLM providers (currently OpenAI, in some
API tiers) where the provider contractually does not retain prompt/completion data for training or
logging. For a financial product handling personal spending data, this is a trust signal and may
become a legal requirement in regulated markets (GDPR Art. 28, Italian AGID guidelines). If a user
or deployment operator has enabled `enforce_zero_data_retention: true` in config but the configured
model does NOT support ZDR, any LLM call should fail fast with a structured error
(`LLMCallCanceled: unable to enforce Zero Data Retention policy`) rather than silently sending data
through a non-ZDR path. Failing closed is safer than failing open.

Pre-flight checks are the safety net for deployment. Currently there is no automated check that:
- all required API keys are present and valid (test call)
- all configured LLM models are reachable (smoke call)
- all Jinja2 templates render without errors
- all ingestion modules load cleanly (no broken imports)
- all soul files / persona configs are coherent
- MinIO and Postgres connectivity is healthy
- ZDR contracts are satisfied for the active model set

Without pre-flight, a misconfigured deployment can reach production silently, only failing during a
live demo or user interaction. Pre-flight should block deployment (non-zero exit code) and expose a
structured report accessible in the admin backoffice.

## When to Surface

**Trigger:** Any of the following:
- A milestone introduces a production deployment workflow, CI/CD pipeline, or `docker compose up` hardening
- A milestone introduces user data privacy controls, GDPR features, or compliance requirements
- A milestone introduces admin backoffice expansion (new admin-only pages or system health dashboards)
- A second major version milestone is started (post-hackathon productionization)
- A security audit or pen-test is planned

This seed should be presented during `/gsd-new-milestone` when the milestone scope matches any of
these conditions:
- Milestone goal mentions "production", "deploy", "CI/CD", "security", "compliance", "GDPR", "privacy", or "hardening"
- Milestone adds new admin-only routes or backoffice pages
- Milestone is the first after the hackathon demo (i.e., a productionization milestone)

## Scope Estimate

**Large** — This is a full milestone of significant effort, likely 3–5 phases:
- **Phase A**: Encryption at rest — Fernet/AES column-level encryption for sensitive DB fields
  (questionnaire_answers, income_sources, extracted payload_json); MinIO SSE-S3 or SSE-C enabled
  in Docker Compose and cloud config; migration strategy for existing plaintext data.
- **Phase B**: ZDR policy enforcement — `enforce_zero_data_retention: bool` in
  `api/app/core/llm_config.py` (`LLMConfig`/`ProviderConfig`); ZDR capability registry per
  provider+model; `LLMCallCanceledError` raised before any non-ZDR call when policy is active;
  unit tests covering all combinations (ZDR required + ZDR model ✓, ZDR required + non-ZDR model
  → error, ZDR not required → pass through).
- **Phase C**: Pre-flight check service — `api/app/services/preflight.py`; checks: API key
  presence + validity (live smoke call), LLM model reachability, Jinja2 template render, ingestion
  module registry load, soul/persona config coherence, MinIO + Postgres connectivity, ZDR contract
  satisfaction; structured `PreflightReport` with per-check results (name, status, duration_ms,
  input_summary, output_summary, error); non-zero exit on any FAIL; invokable via
  `python -m app.preflight` or as a FastAPI startup hook.
- **Phase D**: Admin backoffice page — `GET /admin/preflight-report` endpoint returning the latest
  `PreflightReport`; frontend admin-only page showing check list with status badges, timing,
  in/out, and error details; only visible to `is_admin=True` users.

## Breadcrumbs

Related code and decisions in the current codebase:

- `api/app/core/config.py` — `Settings` dataclass (all env vars, secrets); natural home for
  `enforce_zero_data_retention: bool` and `encryption_key: str | None`
- `api/app/core/llm_config.py` — `LLMConfig`, `ProviderConfig`, `ModelRoute`; ZDR capability flag
  belongs on `ProviderConfig`; pre-flight smoke call lives in `LLMClient.probe()`
- `api/app/ingestion/llm.py` — `LLMClient` and `get_llm_client()`; wraps Google + OpenAI calls;
  ZDR enforcement check must run here before any provider call
- `api/app/ingestion/adaptive.py` — ingestion module registry load; pre-flight checks all modules
  import cleanly here
- `api/app/coaching/prompts/` — Jinja2 templates (`system_base.j2`, `context_block.j2`,
  `response_format.j2`); pre-flight renders all templates with fixture data
- `api/app/api/admin.py` — `require_admin` Depends(); pre-flight report endpoint goes here with
  same guard
- `api/app/db/models.py` — `UserProfile.questionnaire_answers`, `ExtractedDocument.payload_json`
  (both JSON columns); encryption wrapper targets these columns
- `api/app/db/session.py` — `create_tables()` startup hook; pre-flight can be wired here as a
  startup check
- `api/app/main.py` — FastAPI app startup; pre-flight invocation on `lifespan` startup event
- `docker-compose.yml` — MinIO service config; SSE settings added here for at-rest encryption
- `.planning/seeds/SEED-001-llm-crowdsourced-category-corrections.md` — sibling seed for context

## Notes

- The "fail closed" principle for ZDR must be explicit in the design: if `enforce_zero_data_retention`
  is `true` and no configured provider supports ZDR, the service must not start (pre-flight blocks)
  rather than degrading silently.
- The pre-flight report exposed in the admin backoffice is useful beyond security: it doubles as a
  deployment health dashboard. Consider persisting the last N reports in the DB for trend visibility.
- For the hackathon demo, ZDR enforcement should default to `false` (no-op) to avoid breaking the
  current setup. The flag is additive and non-breaking.
- Fernet (symmetric, key rotation friendly) is preferred over raw AES for DB-level encryption in
  Python — the `cryptography` package is already likely available via FastAPI deps.
- OpenAI ZDR is available through the Zero Data Retention API agreement (enterprise); standard API
  keys do NOT guarantee ZDR even if OpenAI's privacy policy implies it. The capability flag must
  default to `false` for all providers unless explicitly documented.
