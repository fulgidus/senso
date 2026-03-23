# Stack Research

**Domain:** AI voice-first financial education assistant (hackathon MVP → production)
**Researched:** 2026-03-23
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router) + React | Next.js 16.2.1, React 19.2 | Web app + voice-first UI + SSR/route handlers | Fastest path to polished demo in 1 day, excellent DX, and clean path to production scaling on Vercel/self-host. |
| Tailwind CSS | 4.2.2 | Rapid UI implementation | Best speed/quality ratio for hackathon UI; no design-system overhead and easy iteration during live demo prep. |
| FastAPI + Pydantic | FastAPI 0.135.2, Pydantic 2.12.x | AI orchestration API, document ingestion, retrieval, scoring, safety checks | Very fast to build typed APIs, excellent for Python AI ecosystem, production-ready. FastAPI 0.135.2 explicitly requires modern Pydantic (>=2.9). |
| Supabase (Postgres + Auth + Storage) | Managed service (supabase-js 2.100.0) | Users, sessions, profile data, partner catalog, file uploads | Best “ship today” backend foundation: email/password + Google OAuth + storage + Postgres without infra tax. Easy migration to stricter enterprise infra later. |
| Qdrant | Server 1.17.x, qdrant-client 1.17.1 | Vector retrieval for user docs + educational KB | Purpose-built vector DB with strong filtering/hybrid search and mature scaling features; cleaner than bolting everything onto app DB on day 1. |
| LLM provider layer (dual-provider) | google-genai 1.68.0 + openai 2.29.0 | Structured extraction + recommendation generation | Keep provider swappable for reliability/cost. Use Gemini Flash for fast extraction/retrieval tasks and stronger model tier for final coached response when needed. |
| Voice stack | ElevenLabs API + Web Speech API | TTS + browser STT | ElevenLabs gives demo-grade voice quality (critical for judges). Web Speech API gives zero-setup STT for hackathon speed. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ai (Vercel AI SDK) | 6.0.137 | Unified model interface + streaming + tool calling in TS apps | Use in frontend/server route handlers if you want rapid multi-provider experimentation without custom adapters. |
| @supabase/supabase-js + @supabase/ssr | 2.100.0 / 0.9.0 | Auth/session/database/storage client | Use for all auth flows and user-session handling in Next.js App Router. |
| zod | 4.3.6 | Runtime schema validation | Use for typed request/response contracts and safe action-card payloads from LLM output. |
| @tanstack/react-query | 5.95.2 | Async server-state orchestration | Use when chat state + ingestion jobs + profile refresh need resilient caching/retries. |
| react-hook-form | 7.72.0 | Fast forms with low re-render cost | Use for onboarding/upload/profile preferences and auth screens. |
| elevenlabs (Python SDK) | 2.40.0 | Server-side TTS generation | Use when you need deterministic audio generation + stored clips for replay/demo consistency. |
| qdrant-client (Python) | 1.17.1 | Vector indexing/retrieval from FastAPI | Use in ingestion pipeline and retrieval stage with metadata filters (user_id, doc_type, locale). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker Compose | Run FE + BE + Postgres + Qdrant locally | Best demo reliability in hackathon; one command startup and reproducible teammate setup. |
| uv | Python dependency/project manager | Much faster than classic pip workflows; great for hackathon iteration speed. |
| pnpm | JS package manager | Faster installs + deterministic lockfile; helps when resetting env under time pressure. |

## Installation

```bash
# Frontend core
npm install next@16.2.1 react@19.2.4 react-dom@19.2.4 tailwindcss@4.2.2 @tailwindcss/postcss postcss

# Frontend supporting
npm install ai@6.0.137 @supabase/supabase-js@2.100.0 @supabase/ssr@0.9.0 zod@4.3.6 @tanstack/react-query@5.95.2 react-hook-form@7.72.0

# Python backend (uv recommended)
uv add fastapi==0.135.2 "uvicorn[standard]==0.42.0" pydantic==2.12.5 qdrant-client==1.17.1 google-genai==1.68.0 openai==2.29.0 elevenlabs==2.40.0
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase Auth + DB + Storage | Auth.js + separate Postgres/S3 stack | Use only if you already run mature custom auth infra and need deep bespoke auth internals. Not ideal for 1-day MVP. |
| Qdrant | pgvector-only in Postgres | Use pgvector-only if retrieval is tiny/simple and you want one datastore. Move to Qdrant as soon as filtering/hybrid recall quality matters. |
| FastAPI orchestration backend | Next.js-only backend routes | Use Next-only if your AI pipeline is very light. For document ingestion + retrieval + safety layers, Python backend is cleaner and more scalable. |
| Web Speech API STT (MVP) | Managed STT API (e.g., Deepgram/Google STT) | Use managed STT once you need cross-browser consistency, better punctuation, and production-grade transcription quality/SLA. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Auth.js-first for this MVP | Docs now push migration path (“Auth.js is part of Better Auth”); avoid extra auth migration uncertainty in a one-day build. | Supabase Auth (email/password + Google OAuth built-in). |
| Self-hosting Postgres/Qdrant during hackathon | Infra setup and ops debugging will consume build/demo time. | Managed Supabase + managed/free-tier Qdrant Cloud (or local Docker for demo). |
| Over-engineered LLM orchestration frameworks on day 1 | Adds abstraction/debug complexity before product value is proven. | Thin provider adapters + typed prompts + strict output schemas. |
| Browser STT as sole production plan | Browser compatibility/accuracy varies; can hurt real users. | Keep browser STT for MVP demo, then move to managed STT for production. |

## Stack Patterns by Variant

**If goal is “win the hackathon demo in one day”:**
- Use Supabase managed services + Qdrant Cloud + Web Speech API STT + ElevenLabs TTS.
- Because this minimizes infra risk and maximizes polished end-to-end flow.

**If goal shifts to post-hackathon production hardening:**
- Keep API contracts and data model; replace STT with managed API, add background jobs, and enforce stronger observability/secrets controls.
- Because architecture remains compatible while reliability/security increase.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.2.1 | react@19.2.4 | Official current pairing from npm latest versions. |
| tailwindcss@4.2.2 | next@16.2.1 | Official Next.js install guide supports current Tailwind generation. |
| fastapi@0.135.2 | pydantic>=2.9.0 (recommend 2.12.5) | FastAPI release notes explicitly raised lower bound to Pydantic >=2.9. |
| @supabase/supabase-js@2.100.0 | @supabase/ssr@0.9.0 | Current recommended path for App Router session handling. |
| qdrant-client@1.17.1 | qdrant server 1.17.x | Keep client/server minor versions aligned to reduce API mismatch risk. |

## Confidence by Major Choice

| Choice | Confidence | Why |
|--------|------------|-----|
| Next.js + Tailwind frontend | HIGH | Official docs current; ecosystem standard and proven for fast MVP delivery. |
| FastAPI orchestration backend | HIGH | Official FastAPI docs/releases + current package data validate maturity and active evolution. |
| Supabase for auth/data/storage in MVP | HIGH | Official docs confirm email/password + Google OAuth + storage integration suitable for rapid shipping. |
| Qdrant for vector layer | MEDIUM-HIGH | Official docs/releases show strong capability and momentum; exact fit vs pgvector depends on retrieval complexity. |
| Web Speech API for MVP STT | MEDIUM | Official MDN confirms capability, but cross-browser behavior variability remains a practical risk. |
| Dual-provider LLM strategy | MEDIUM | Technically straightforward and robust, but exact model selection should be tuned with live latency/cost tests. |

## Sources

- Next.js docs (v16.2.1 shown): https://nextjs.org/docs  
- FastAPI docs + releases: https://fastapi.tiangolo.com/ , https://github.com/fastapi/fastapi/releases  
- Supabase docs (Auth/Google/password/AI/Storage):  
  - https://supabase.com/docs/guides/auth  
  - https://supabase.com/docs/guides/auth/social-login/auth-google  
  - https://supabase.com/docs/guides/auth/passwords  
  - https://supabase.com/docs/guides/ai  
  - https://supabase.com/docs/guides/storage  
- Qdrant docs + releases: https://qdrant.tech/documentation/ , https://github.com/qdrant/qdrant/releases  
- ElevenLabs docs: https://elevenlabs.io/docs/overview  
- Web Speech API (MDN, last modified 2025-09-30): https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API  
- Vercel AI SDK docs: https://vercel.com/docs/ai-sdk  
- Tailwind Next.js install docs: https://tailwindcss.com/docs/installation/framework-guides/nextjs  
- Auth.js getting started (migration context): https://authjs.dev/getting-started  
- Version verification via package registries: npm and PyPI (`npm view ...`, `python3 -m pip index versions ...`) on 2026-03-23.

---
*Stack research for: S.E.N.S.O. (AI voice-first financial coaching)*
*Researched: 2026-03-23*
