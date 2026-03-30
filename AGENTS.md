<!-- GSD:project-start source:PROJECT.md -->
## Project

**S.E.N.S.O. - Sistema Educativo per Numeri, Spese e Obiettivi**

S.E.N.S.O. is a voice-first AI financial education assistant for young adults (18-30) that turns real spending decisions into personalized learning moments. Users upload real financial documents, then ask "Can I buy this?" and receive grounded answers based on their own numbers, with clear reasoning, educational resources, and actionable next steps. It is designed as a working, demo-ready product for a hackathon where AI must be central and non-decorative.

**Core Value:** Help users make better financial decisions in the moment by combining their real financial data with direct, educational AI guidance and concrete actions.

### Constraints

- **Timeline**: The hackathon is approximately two weeks away. We are building ahead of time with a full two-week runway — do not treat this as a one-day sprint. Design decisions should be sustainable, not throw-away.
- **Product**: Must be concretely demoable, not conceptual — every core interaction must run end-to-end during demo.
- **AI Centrality**: AI must drive the core experience (ingestion reasoning + conversational guidance), not decorative add-ons.
- **Audience**: Young adults 18-30 with low financial literacy — language and UX must be simple, direct, and jargon-light.
- **Voice**: Voice interaction is a primary differentiator in this challenge context — spoken I/O quality must be reliable.
- **Data/Safety**: Financial guidance must avoid unsafe advice patterns and enforce persona boundaries consistently.
- **i18n**: The app is Italian-first (`it` locale is primary). Every user-facing string, every content item (articles, videos, MARP decks, partner offers), every LLM-generated card, and every catalog entry must carry a `locale` field. The coaching LLM always replies in the locale of the request. Content search must filter by locale. Never hardcode Italian strings in source code.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology                           | Version                               | Purpose                                                                     | Why Recommended                                                                                                                                                    |
| ------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js (App Router) + React         | Next.js 16.2.1, React 19.2            | Web app + voice-first UI + SSR/route handlers                               | Fastest path to polished demo in 1 day, excellent DX, and clean path to production scaling on Vercel/self-host.                                                    |
| Tailwind CSS                         | 4.2.2                                 | Rapid UI implementation                                                     | Best speed/quality ratio for hackathon UI; no design-system overhead and easy iteration during live demo prep.                                                     |
| FastAPI + Pydantic                   | FastAPI 0.135.2, Pydantic 2.12.x      | AI orchestration API, document ingestion, retrieval, scoring, safety checks | Very fast to build typed APIs, excellent for Python AI ecosystem, production-ready. FastAPI 0.135.2 explicitly requires modern Pydantic (>=2.9).                   |
| Supabase (Postgres + Auth + Storage) | Managed service (supabase-js 2.100.0) | Users, sessions, profile data, partner catalog, file uploads                | Best “ship today” backend foundation: email/password + Google OAuth + storage + Postgres without infra tax. Easy migration to stricter enterprise infra later.     |
| Qdrant                               | Server 1.17.x, qdrant-client 1.17.1   | Vector retrieval for user docs + educational KB                             | Purpose-built vector DB with strong filtering/hybrid search and mature scaling features; cleaner than bolting everything onto app DB on day 1.                     |
| LLM provider layer (dual-provider)   | google-genai 1.68.0 + openai 2.29.0   | Structured extraction + recommendation generation                           | Keep provider swappable for reliability/cost. Use Gemini Flash for fast extraction/retrieval tasks and stronger model tier for final coached response when needed. |
| Voice stack                          | ElevenLabs API + Web Speech API       | TTS + browser STT                                                           | ElevenLabs gives demo-grade voice quality (critical for judges). Web Speech API gives zero-setup STT for hackathon speed.                                          |
### Supporting Libraries
| Library                               | Version         | Purpose                                                       | When to Use                                                                                                     |
| ------------------------------------- | --------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ai (Vercel AI SDK)                    | 6.0.137         | Unified model interface + streaming + tool calling in TS apps | Use in frontend/server route handlers if you want rapid multi-provider experimentation without custom adapters. |
| @supabase/supabase-js + @supabase/ssr | 2.100.0 / 0.9.0 | Auth/session/database/storage client                          | Use for all auth flows and user-session handling in Next.js App Router.                                         |
| zod                                   | 4.3.6           | Runtime schema validation                                     | Use for typed request/response contracts and safe action-card payloads from LLM output.                         |
| @tanstack/react-query                 | 5.95.2          | Async server-state orchestration                              | Use when chat state + ingestion jobs + profile refresh need resilient caching/retries.                          |
| react-hook-form                       | 7.72.0          | Fast forms with low re-render cost                            | Use for onboarding/upload/profile preferences and auth screens.                                                 |
| elevenlabs (Python SDK)               | 2.40.0          | Server-side TTS generation                                    | Use when you need deterministic audio generation + stored clips for replay/demo consistency.                    |
| qdrant-client (Python)                | 1.17.1          | Vector indexing/retrieval from FastAPI                        | Use in ingestion pipeline and retrieval stage with metadata filters (user_id, doc_type, locale).                |
### Development Tools
| Tool           | Purpose                                 | Notes                                                                                    |
| -------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Docker Compose | Run FE + BE + Postgres + Qdrant locally | Best demo reliability in hackathon; one command startup and reproducible teammate setup. |
| uv             | Python dependency/project manager       | Much faster than classic pip workflows; great for hackathon iteration speed.             |
| pnpm           | JS package manager                      | Faster installs + deterministic lockfile; helps when resetting env under time pressure.  |
## Installation
# Frontend core
# Frontend supporting
# Python backend (uv recommended)
## Alternatives Considered
| Recommended                   | Alternative                                 | When to Use Alternative                                                                                                                           |
| ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth + DB + Storage  | Auth.js + separate Postgres/S3 stack        | Use only if you already run mature custom auth infra and need deep bespoke auth internals. Not ideal for 1-day MVP.                               |
| Qdrant                        | pgvector-only in Postgres                   | Use pgvector-only if retrieval is tiny/simple and you want one datastore. Move to Qdrant as soon as filtering/hybrid recall quality matters.      |
| FastAPI orchestration backend | Next.js-only backend routes                 | Use Next-only if your AI pipeline is very light. For document ingestion + retrieval + safety layers, Python backend is cleaner and more scalable. |
| Web Speech API STT (MVP)      | Managed STT API (e.g., Deepgram/Google STT) | Use managed STT once you need cross-browser consistency, better punctuation, and production-grade transcription quality/SLA.                      |
## What NOT to Use
| Avoid                                                 | Why                                                                                                                         | Use Instead                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Auth.js-first for this MVP                            | Docs now push migration path (“Auth.js is part of Better Auth”); avoid extra auth migration uncertainty in a one-day build. | Supabase Auth (email/password + Google OAuth built-in).                       |
| Self-hosting Postgres/Qdrant during hackathon         | Infra setup and ops debugging will consume build/demo time.                                                                 | Managed Supabase + managed/free-tier Qdrant Cloud (or local Docker for demo). |
| Over-engineered LLM orchestration frameworks on day 1 | Adds abstraction/debug complexity before product value is proven.                                                           | Thin provider adapters + typed prompts + strict output schemas.               |
| Browser STT as sole production plan                   | Browser compatibility/accuracy varies; can hurt real users.                                                                 | Keep browser STT for MVP demo, then move to managed STT for production.       |
## Stack Patterns by Variant
- Use Supabase managed services + Qdrant Cloud + Web Speech API STT + ElevenLabs TTS.
- Because this minimizes infra risk and maximizes polished end-to-end flow.
- Keep API contracts and data model; replace STT with managed API, add background jobs, and enforce stronger observability/secrets controls.
- Because architecture remains compatible while reliability/security increase.
## Version Compatibility
| Package A                     | Compatible With                    | Notes                                                                  |
| ----------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| next@16.2.1                   | react@19.2.4                       | Official current pairing from npm latest versions.                     |
| tailwindcss@4.2.2             | next@16.2.1                        | Official Next.js install guide supports current Tailwind generation.   |
| fastapi@0.135.2               | pydantic>=2.9.0 (recommend 2.12.5) | FastAPI release notes explicitly raised lower bound to Pydantic >=2.9. |
| @supabase/supabase-js@2.100.0 | @supabase/ssr@0.9.0                | Current recommended path for App Router session handling.              |
| qdrant-client@1.17.1          | qdrant server 1.17.x               | Keep client/server minor versions aligned to reduce API mismatch risk. |
## Confidence by Major Choice
| Choice                                | Confidence  | Why                                                                                                                |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Next.js + Tailwind frontend           | HIGH        | Official docs current; ecosystem standard and proven for fast MVP delivery.                                        |
| FastAPI orchestration backend         | HIGH        | Official FastAPI docs/releases + current package data validate maturity and active evolution.                      |
| Supabase for auth/data/storage in MVP | HIGH        | Official docs confirm email/password + Google OAuth + storage integration suitable for rapid shipping.             |
| Qdrant for vector layer               | MEDIUM-HIGH | Official docs/releases show strong capability and momentum; exact fit vs pgvector depends on retrieval complexity. |
| Web Speech API for MVP STT            | MEDIUM      | Official MDN confirms capability, but cross-browser behavior variability remains a practical risk.                 |
| Dual-provider LLM strategy            | MEDIUM      | Technically straightforward and robust, but exact model selection should be tuned with live latency/cost tests.    |
## Sources
- Next.js docs (v16.2.1 shown): https://nextjs.org/docs  
- FastAPI docs + releases: https://fastapi.tiangolo.com/ , https://github.com/fastapi/fastapi/releases  
- Supabase docs (Auth/Google/password/AI/Storage):  
- Qdrant docs + releases: https://qdrant.tech/documentation/ , https://github.com/qdrant/qdrant/releases  
- ElevenLabs docs: https://elevenlabs.io/docs/overview  
- Web Speech API (MDN, last modified 2025-09-30): https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API  
- Vercel AI SDK docs: https://vercel.com/docs/ai-sdk  
- Tailwind Next.js install docs: https://tailwindcss.com/docs/installation/framework-guides/nextjs  
- Auth.js getting started (migration context): https://authjs.dev/getting-started  
- Version verification via package registries: npm and PyPI (`npm view ...`, `python3 -m pip index versions ...`) on 2026-03-23.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

### Running Services / Tests

**Always use Docker Compose to run the stack.** Never invoke `uv run`, `python`, or `pnpm` directly on the host for server startup, test execution, or build verification. Use the Docker Compose constellation instead.

```bash
# Run backend tests
docker compose run --rm api uv run pytest

# Run frontend build check
docker compose run --rm frontend pnpm build

# Smoke test (must use /app/.venv/bin/python, NOT system python)
docker compose run --rm api /app/.venv/bin/python -c "import app; print('ok')"
```

### i18n Rules

- Italian (`it`) is the primary locale. English (`en`) mirrors it.
- Every content item — articles, videos, MARP decks, partner offers, insight cards, learn cards — **must carry a `locale` field**.
- The coaching LLM always replies in the locale sent in the request body.
- Content search and catalog injection **must filter by locale** before injecting into the prompt.
- Never hardcode Italian (or any language) strings in source code. All user-facing strings go in `senso/src/locales/it.json` and `en.json`.
- i18n keys use dot notation: `coaching.verdictYes`, `content.readingMinutes`, etc.

### LLM and Prompt Conventions

- All LLM calls go through `llm_client.complete(route=...)` or `llm_client.vision(route=...)` — never call provider SDKs directly.
- Prompt templates use `.j2` files loaded via `jinja2.Environment` + `FileSystemLoader` — never inline multiline strings in Python.
- Schema contracts use dedicated `.schema.json` files. LLM response conformance enforced via `response_format` structured output parameter (`{"type": "json_schema", ...}`), NOT via prose in the system prompt. `jsonschema.validate()` is post-hoc safety net only.
- `additionalProperties: false` must be set in all schemas used for structured output.
- `loader.py` exposes `get_schema(name)` — use it; do not re-read schema files ad hoc.

### Database Conventions

- No Alembic. Schema changes via `_add_missing_columns()` in `session.py`.
- **No mixed ORM + raw connections.** Migrations/backfills use raw SQL (`engine.connect()` + `sa.text()`). App CRUD uses ORM sessions. Never hold an ORM session open while running DDL via a raw connection on the same table — it deadlocks.
- Profile-level insights live in `user_profiles.insight_cards` (generated during document ingestion).
- Chat-time insights generated by the coach live in `user_profiles.coaching_insights` (separate column, appended not overwritten).
- No Qdrant or vector store in the current implementation. Content search uses BM25 in-process (Python `rank_bm25`) exposed as an LLM tool call.

### Content Catalog Conventions

- All content catalogs (articles, videos, MARP decks, partner offers) are static JSON files co-located with the backend at `api/app/content/`.
- Each catalog item **must have**: `id`, `locale`, `type`, `title`, `topics: string[]`, and type-specific fields.
- The BM25 index is built at FastAPI startup from these catalogs and is locale-aware — queries always filter by locale first.
- The LLM receives search results (id, type, title, summary, score) via tool call, never the full catalog inline.

### Frontend Content Conventions

- Video catalog: `senso/src/content/videos.json` — items have `id`, `locale`, `video_id` (YouTube), `title`, `topics[]`.
- MARP slide decks: `senso/src/content/slides/` — one `.md` file per deck, filename matches `id`. Rendered with `@marp-team/marp-core` in the browser. Two themes: `senso-light` and `senso-dark`, toggled with the app's light/dark mode.
- Slides display inline in chat as a swipeable deck with a fullscreen button.
- YouTube videos display as inline iframe players inside chat bubbles.

### Card and Component Conventions

- `action_type: "calculator"` — frontend reads `payload.type` and renders the appropriate interactive miniapp (e.g. loan calculator with sliders).
- `action_type: "funnel"` — renders a partner offer card. Partner catalog lives at `api/app/content/partners.json`.
- `affordability_verdict` is a typed schema field, not an A2UI component. Guaranteed rendering. Verdict values: `"yes"`, `"no"`, `"conditional"`, `null`.
- A2UI `details_a2ui` is supplementary — for number comparison panels. Emit when 2+ numbers need side-by-side display. Null for qualitative answers.
- A2UI button component emits a custom DOM event `a2ui-action` with `detail: { action: string }`. ChatScreen listens for it.
- `resource_cards.url` must always be a real, verified URL from the catalog — never LLM-invented. Prompt instructs `url: null` if not from catalog.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
