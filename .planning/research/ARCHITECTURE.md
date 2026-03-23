# Architecture Research

**Domain:** Voice-first financial coaching assistant (document-grounded AI)
**Researched:** 2026-03-23
**Confidence:** HIGH (platform capabilities), MEDIUM (scaling path beyond MVP)

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Experience Layer (ReactJS)                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  Web UI (chat + cards)  │  Voice Input Adapter (Web Speech STT)            │
│  Auth UI (email+OAuth)  │  Voice Output Player (ElevenLabs audio stream)   │
└───────────────┬───────────────────────────────────────────────┬──────────────┘
                │ HTTPS (REST)                                 │ Audio stream
                ▼                                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      Application Layer (FastAPI Monolith)                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ API Routers                                                                  │
│  - /auth, /profile, /ingestion, /conversation, /actions                     │
│                                                                              │
│ Bounded Modules (same deploy unit, strict interfaces)                       │
│  1) Identity & Session                                                       │
│  2) Document Ingestion Pipeline                                              │
│  3) Financial Profile Service                                                │
│  4) Conversation Orchestrator                                                │
│  5) Retrieval Service (docs + KB)                                            │
│  6) Action-Card Matcher (bank/partner offers)                                │
│  7) Persona + Safety Guardrail Engine                                        │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Data / Integration                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ PostgreSQL: users, sessions, profile, conversations, partner catalog, jobs   │
│ Qdrant: embeddings for uploaded docs + educational knowledge base            │
│ Object storage (local/S3): raw files, OCR artifacts                          │
│ External APIs: LLM provider(s), ElevenLabs TTS, OAuth providers              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Next.js App | UX, upload/chat screens, action cards, auth flows | App Router + client components for voice/chat |
| Voice Input Adapter | Capture microphone audio and produce text transcript | Web Speech API with graceful text-input fallback |
| Voice Output Adapter | Convert response text to speech and stream playback | ElevenLabs TTS API client + browser audio player |
| Conversation Orchestrator | Build grounded prompt context, call LLM, format answer + citations + cards | FastAPI service module with typed request/response contracts |
| Ingestion Pipeline | Parse uploaded docs, extract entities, create chunks/embeddings, update profile | FastAPI endpoints + background jobs (task table + worker loop) |
| Retrieval Service | Hybrid retrieval from user docs + educational KB | Qdrant query API (prefetch/fusion where useful) |
| Financial Profile Service | Canonical user financial state and derived signals | Postgres schema + deterministic calculators |
| Action-Card Matcher | Map current context to partner/bank actions | Rules-first matcher over Postgres catalog |
| Persona/Safety Engine | Apply ethos, tone, hard boundaries, response filtering | Prompt assembly + post-generation policy checks |

## Recommended Project Structure

```text
senso/
├── apps/
│   ├── web/                        # Next.js UI (voice/chat, upload, cards)
│   │   ├── app/
│   │   │   ├── (public)/
│   │   │   ├── (authed)/
│   │   │   └── api/               # thin BFF endpoints only if needed
│   │   ├── components/
│   │   │   ├── voice/
│   │   │   ├── chat/
│   │   │   └── cards/
│   │   └── lib/
│   │       ├── api-client.ts
│   │       └── auth.ts
│   └── api/                        # FastAPI app
│       ├── app/main.py
│       ├── app/api/                # routers only
│       ├── app/modules/
│       │   ├── identity/
│       │   ├── ingestion/
│       │   ├── profile/
│       │   ├── conversation/
│       │   ├── retrieval/
│       │   ├── actions/
│       │   └── safety/
│       ├── app/adapters/           # external integrations (LLM, ElevenLabs, OAuth)
│       ├── app/repositories/       # Postgres/Qdrant/data access
│       └── app/workers/            # async ingestion workers
├── personas/                       # already present: ethos, boundaries, souls
├── infra/
│   ├── docker-compose.yml
│   └── migrations/
└── .planning/
```

### Structure Rationale

- **apps/api as modular monolith:** fastest hackathon delivery while preserving clear seams for later service extraction.
- **modules/* by business capability (not technical layer):** keeps ownership and tests aligned with product behavior.
- **adapters/** isolates vendor lock-in (LLM, TTS, OAuth) and enables provider swaps with minimal blast radius.
- **repositories/** enforces a single data-access path so schema and index changes are manageable.

## Architectural Patterns

### Pattern 1: Modular Monolith with Explicit Module Contracts (Recommended)

**What:** One deployable FastAPI app, but each domain module exposes a narrow service interface and DTOs.
**When to use:** Hackathon MVP with high integration pressure and low ops budget.
**Trade-offs:** Maximum build speed now; requires discipline to avoid cross-module imports.

**Example:**
```python
# modules/conversation/service.py
class ConversationService:
    async def answer(self, user_id: str, utterance: str) -> ConversationReply:
        profile = await self.profile_service.get_snapshot(user_id)
        retrieval = await self.retrieval_service.fetch_context(user_id, utterance)
        draft = await self.llm_adapter.generate(profile, retrieval, utterance)
        safe = self.safety_service.apply(draft)
        cards = self.action_service.match(user_id, safe)
        return ConversationReply(text=safe.text, cards=cards, citations=safe.citations)
```

### Pattern 2: Async Ingestion via Job Table + Worker

**What:** Upload endpoint creates a job and returns immediately; worker processes parsing/chunking/embedding.
**When to use:** Any OCR/parsing flow that may exceed demo latency budgets.
**Trade-offs:** Slightly more plumbing, dramatically better UX reliability.

**Example:**
```python
# POST /ingestion/upload
job_id = await ingestion_jobs.create(user_id, file_ref, status="queued")
return {"job_id": job_id, "status": "queued"}

# worker loop
job = await ingestion_jobs.claim_next()
parsed = await parser.extract(job.file_ref)
await profile_service.merge(job.user_id, parsed.profile_delta)
await retrieval_indexer.upsert(job.user_id, parsed.chunks)
await ingestion_jobs.complete(job.id)
```

### Pattern 3: Retrieval + Reasoning Split

**What:** Retrieval service returns compact, scored context; conversation service reasons over that context.
**When to use:** Grounded financial advice with transparent citations.
**Trade-offs:** Slightly more architecture than “single giant prompt”, but prevents prompt bloat and hallucination drift.

## Data Flow

### Request Flow (Voice Conversation)

```text
[User taps Parla]
    ↓
[Browser STT (Web Speech API)]
    ↓ transcript
[Next.js Client]
    ↓ POST /conversation
[FastAPI Conversation Orchestrator]
    ├─→ [Profile Service → Postgres]
    ├─→ [Retrieval Service → Qdrant (user docs + KB)]
    ├─→ [Safety/Persona Engine → personas/* + hard boundaries]
    └─→ [Action Matcher → Postgres catalog]
    ↓
[Response DTO: verdict + rationale + citations + cards]
    ↓
[Next.js renders cards + text]
    ↓
[ElevenLabs TTS stream playback]
```

### Ingestion Flow (Upload to Grounded Profile)

```text
[User uploads CSV/PDF/image]
    ↓
[FastAPI /ingestion/upload]
    ↓ write raw file + create job
[Object storage + Postgres ingestion_job]
    ↓
[Worker: parse/OCR -> normalize -> profile merge]
    ├─→ [Postgres financial_profile]
    └─→ [Qdrant doc embeddings]
    ↓
[Job status = completed]
    ↓
[UI poll/subscription updates profile summary]
```

### Key Data Flows

1. **Grounding flow:** user docs → normalized facts (Postgres) + chunks (Qdrant) → cited answers.
2. **Action flow:** conversation intent + profile risk signals → partner matching → actionable cards.
3. **Voice loop:** STT transcript → orchestrated response → TTS audio, with text fallback at every step.

## Suggested Build Order (Roadmap Implications)

1. **Foundation & Contracts (Day start)**
   - Define module interfaces and DTOs (`ConversationReply`, `ProfileSnapshot`, `ActionCard`).
   - Set up Postgres schema + Qdrant collections + Docker Compose.
   - Why first: avoids rewriting payload contracts during integration rush.

2. **Ingestion Vertical Slice**
   - Upload endpoint, one parser path (CSV first), profile merge, basic retrieval indexing.
   - Why second: all personalization depends on grounded data.

3. **Conversation Core (Text-first)**
   - `/conversation` orchestrator with retrieval + safety + card matching; return JSON only.
   - Why third: prove “AI centrality” before adding voice complexity.

4. **Voice Integration**
   - Browser STT + ElevenLabs TTS streaming + fallbacks to text input/output.
   - Why fourth: isolates variable latency/reliability issues from core logic.

5. **Demo Hardening & Guardrails**
   - Seed deterministic demo data, timeout handling, retries, safe defaults, observability logs.
   - Why fifth: hackathon scoring rewards reliability under live demo conditions.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Keep modular monolith; DB-backed job queue; single Qdrant node; aggressive caching of profile snapshots |
| 1k–100k users | External queue (Redis/RabbitMQ), separate ingestion worker deployment, read replicas for Postgres, dedicated vector cluster |
| 100k+ users | Split into services: conversation, ingestion, profile, retrieval; event bus for profile updates; strict SLOs and autoscaling policies |

### Scaling Priorities

1. **First bottleneck: ingestion latency spikes** → isolate worker pool + queue + rate limit uploads.
2. **Second bottleneck: LLM/TTS latency and cost** → add response caching, model tiering, and circuit breakers.

## Anti-Patterns

### Anti-Pattern 1: “Everything in One Prompt Endpoint”

**What people do:** Parse docs, retrieve context, reason, enforce safety, and produce cards in one huge function/prompt.
**Why it's wrong:** Impossible to debug, poor citation quality, and fragile under prompt drift.
**Do this instead:** Keep retrieval, safety, and action matching as separate modules called by the orchestrator.

### Anti-Pattern 2: Synchronous Upload Processing in Request Path

**What people do:** Block HTTP request while OCR/chunking/embedding runs.
**Why it's wrong:** Demo timeouts, poor UX, and brittle error handling.
**Do this instead:** Accept upload quickly, enqueue job, stream/poll status.

### Anti-Pattern 3: Voice as Single Point of Failure

**What people do:** Assume STT/TTS always succeeds and hide text fallback.
**Why it's wrong:** Browser/device/network variance will break live demos.
**Do this instead:** Always keep text input/output fallback and surface degraded-mode UI states.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| LLM Provider (Gemini/GPT/etc.) | Adapter interface (`generate_answer`, `extract_profile`) | Keep provider-swappable; enforce timeout + fallback model |
| ElevenLabs TTS | Streaming audio generation from finalized response text | Preconfigure persona voice IDs; handle quota/rate limit gracefully |
| Browser Web Speech API (STT) | Client-side transcript capture | Browser support varies; include typed input fallback |
| Google OAuth | OIDC through auth module | Keep auth state in HttpOnly cookies/session store |
| Partner/Bank Services | Outbound HTTP via action-card links and optional callback webhooks | Start with link-out cards for MVP, defer deep transactional APIs |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web UI ↔ API | REST JSON over HTTPS | Single typed API client in web app |
| Conversation ↔ Retrieval | In-process service call | Return top-k snippets + scores + source refs |
| Conversation ↔ Safety | In-process policy gate | Enforce `personas/boundaries` + hard-boundary checks before response |
| Ingestion ↔ Profile | In-process service + DB transaction | Profile merge must be idempotent |
| Action Matcher ↔ Partner Catalog | Repository query | Rules-first matching for deterministic demo behavior |

## Sources

- FastAPI docs (BackgroundTasks, WebSockets): https://fastapi.tiangolo.com/tutorial/background-tasks/ , https://fastapi.tiangolo.com/advanced/websockets/  
  (official docs; current as fetched)
- Next.js docs (BFF pattern, authentication, caveats): https://nextjs.org/docs/app/guides/backend-for-frontend , https://nextjs.org/docs/app/guides/authentication  
  (v16.2.1, lastUpdated 2026-03-20)
- Qdrant docs (hybrid/multi-stage query, snapshots): https://qdrant.tech/documentation/search/hybrid-queries/ , https://qdrant.tech/documentation/operations/snapshots/
- PostgreSQL current docs index: https://www.postgresql.org/docs/
- ElevenLabs docs index (TTS/streaming/latency/security references): https://elevenlabs.io/docs
- MDN Web Speech API (browser behavior and security): https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API (last modified 2025-09-30)

---
*Architecture research for: S.E.N.S.O. (voice-first AI financial assistant)*
*Researched: 2026-03-23*
