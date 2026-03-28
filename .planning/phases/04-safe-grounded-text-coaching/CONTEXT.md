# Phase 4: Safe Grounded Text Coaching — Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can ask purchase and financial decision questions by text and receive personalized, transparent coaching grounded in their own financial data. Each response shows the user's actual numbers, the reasoning used to reach the answer, and optional learn/act resources (stub cards for now — fully wired in Phase 6).

Phase 4 introduces the full coaching backend: a composable prompt system, structured JSON output from the LLM, and a 3-layer safety pipeline. The frontend adds a `ChatScreen` accessible from `ProfileScreen`.

This phase does NOT include: voice input/output (Phase 5), persona picker UI (Phase 6), DB-persisted conversation history (Phase 7), streaming responses (Phase 7), or full own_pii_unsolicited profile cross-check (Phase 7).

Phase 4 ends when a user with a confirmed profile can type a question, receive a structured coaching response with reasoning + optional cards, and all unsafe inputs/outputs are caught and blocked.

</domain>

<decisions>
## Design Decisions

### D-01: Persona selector
Default persona only (`mentore-saggio`) for Phase 4. The persona picker UI is deferred to Phase 6 where full card rendering and demo hardening happen. The backend must accept `persona_id` in the request body to be forward-compatible, but Phase 4 hardcodes validation to accept only `mentore-saggio` or default to it.

### D-02: LLM output format — JSONSchema structured output
The LLM output is always a complex structured shape (not free-form text). Two schemas exist:

- **`coaching_response.schema.json`** — colloquial mode: contains `message` (main text reply), `reasoning_used` (array of reasoning steps), `action_cards` (array), `resource_cards` (array), `learn_cards` (array).
- **`coaching_simple_response.schema.json`** — non-colloquial mode: structured data fields only (for machine/API consumers).

The LLM also receives "tool-like" capability schemas describing what it can reference when constructing its response (memory, db-queries, RAG hints, funnels, tutorials, articles, related-services). These are injected into the system prompt as JSONSchema descriptions so the LLM knows what capabilities it has.

All JSONSchema files are stored at `api/app/coaching/schemas/` as standalone `.json` files — not inline strings in Python code. They are loaded at startup and injected into prompt templates.

### D-03: Composable prompt templates
Prompts are Jinja2 templates stored in `api/app/coaching/prompts/`. No prompt strings are hardcoded in endpoint handlers or service methods. Template files:

- `system_base.j2` — injects ethos + boundaries + allowlist text + soul file content + locale instruction
- `context_block.j2` — structures user profile numbers (income, margin, category_totals, insight_cards) into a readable block for the LLM
- `response_format.j2` — injects the JSONSchema shape the LLM must produce, including capability schemas

The `CoachingService.chat()` method assembles the final prompt by rendering templates in order, then passes the result to `LLMClient.complete()`.

### D-04: Full response (no streaming) for Phase 4
Responses are returned as complete JSON objects. Streaming (EventSource/SSE) is deferred to Phase 7 (Streaming & Nice-to-Have Polish).

### D-05: User-controlled locale
The `/coaching/chat` endpoint accepts a `locale` field. Supported values: `it` (default), `en`. The `system_base.j2` template receives the locale and instructs the LLM to respond in that language. The frontend reads locale from user profile preferences and passes it on every request.

### D-06: Safety — `own_pii_unsolicited` match mode
Phase 4 uses pattern-only matching for `own_pii_unsolicited` (no cross-check against live session userProfile fields). Full profile cross-check is deferred to Phase 7. The regex patterns in `hard-boundaries.yml` are used directly.

### D-07: 3-Layer safety pipeline
Safety is enforced at three distinct layers:

1. **Input guard** (`check_coaching_input()`): extends `check_hint_safety()` from guardrail.py. Checks for prompt injection, credential leakage patterns, and coaching-specific jailbreak attempts. Returns `(safe: bool, reason: str)`.
2. **Persona boundary enforcement** (system prompt layer): the `mentore-saggio` soul + ethos + boundaries files are injected into every system prompt. The LLM is instructed to refuse regulated investment advice.
3. **Output scanner** (`SafetyScanner`): scans the LLM's raw response text against all 4 `hard-boundaries.yml` groups before returning to the client. On a `block`/`temp_ban`/`hard_ban` hit, returns the `substituteMessage` instead. On `warn`, logs and passes the response through (Phase 4 pattern-only for `own_pii_unsolicited`).

### D-08: Profile requirement gate
`POST /coaching/chat` returns HTTP 422 with code `profile_required` if the user has no confirmed profile. The frontend must redirect to the profile flow if this error is received.

### D-09: Stateful chat — DB-persisted conversation history
Conversation history IS persisted to Postgres in Phase 4. The project already ships a full Postgres container, so there is no justification to defer this.

Two new tables: `chat_sessions` and `chat_messages`.

- `chat_sessions`: `id` (UUID), `user_id` (FK → users), `persona_id` (str), `locale` (str), `created_at`, `updated_at`
- `chat_messages`: `id` (UUID), `session_id` (FK → chat_sessions), `role` (enum: user/assistant), `content` (text), `created_at`

API contract change: `POST /coaching/chat` accepts an optional `session_id` field in the request body.
- If `session_id` is provided: load prior messages from DB, append new user message, call LLM with full history, persist assistant response.
- If `session_id` is omitted: create a new `ChatSession`, persist the user message, call LLM, persist assistant response, return `session_id` in the response so the client can continue the session.

`GET /coaching/sessions` returns the user's session list (id, created_at, message_count, last_message_preview).
`GET /coaching/sessions/{session_id}/messages` returns the full message history for a session.

The client no longer needs to manage message history client-side — the backend owns the canonical history.

### D-10: JSONSchema output validation
Before returning a coaching response to the client, the service validates the LLM output against `coaching_response.schema.json` using `jsonschema`. If validation fails, a fallback error response is returned rather than an invalid payload.

</decisions>

<architecture>
## Architecture Overview

```
POST /coaching/chat
  │
  ├─ Auth guard (Depends get_current_user)
  ├─ Profile requirement check (ProfileService.get_profile)
  │
  ├─ Layer 1: Input safety
  │   └─ guardrail.check_coaching_input(message)
  │       → 400 on injection/block
  │
  ├─ CoachingService.chat(user_id, messages, locale, persona_id)
  │   ├─ Load persona soul (personas/config.json + soul/*.md)
  │   ├─ Load system prompt components (ethos.md, boundaries.md, allowlist.md)
  │   ├─ Load JSONSchema capabilities (schemas/*.json)
  │   ├─ Render Jinja2 templates
  │   │   ├─ system_base.j2  → system prompt
  │   │   ├─ context_block.j2 → user profile numbers
  │   │   └─ response_format.j2 → output shape instruction
  │   ├─ LLMClient.complete(prompt, system, json_mode=True)
  │   └─ jsonschema.validate(response, coaching_response.schema.json)
  │
  └─ Layer 3: Output safety
      └─ SafetyScanner.scan(response_text)
          → substituteMessage on block/temp_ban/hard_ban
          → warn + pass-through on own_pii_unsolicited
```

**Data flow (stateful):**
- Client sends a new user message + optional `session_id`
- Backend loads prior messages from DB (if session exists) or creates a new session
- Backend fetches user profile from DB once per request
- Full history sent to LLM; assistant response persisted to DB
- Response includes `session_id` so client can continue the session

</architecture>

<existing_assets>
## Existing Assets to Reuse

| Asset | Location | How Used |
|-------|----------|----------|
| `LLMClient` | `api/app/ingestion/llm.py` | `complete()` with `json_mode=True` for all coaching LLM calls |
| `check_hint_safety()` | `api/app/ingestion/guardrail.py` | Extended/wrapped into `check_coaching_input()` |
| `hard-boundaries.yml` | `api/app/personas/hard-boundaries.yml` | Loaded by `SafetyScanner` for all 4 groups |
| `ethos.md` | `api/app/personas/ethos.md` | Injected into `system_base.j2` |
| `boundaries.md` | `api/app/personas/boundaries.md` | Injected into `system_base.j2` |
| `allowlist.md` | `api/app/personas/allowlist.md` | Injected into `system_base.j2` |
| `soul/mentore-saggio.md` | `api/app/personas/soul/` | Soul file injected into `system_base.j2` |
| `config.json` | `api/app/personas/config.json` | Persona registry loaded by `CoachingService` |
| `ProfileService.get_profile()` | `api/app/services/profile_service.py` | Fetch user profile for context block |
| `UserProfile` model | `api/app/db/models.py` | DB model read for coaching context |
| `get_current_user` | `api/app/api/ingestion.py` | Auth dependency reused in coaching router |
| `apiRequest<T>()` | `senso/src/lib/api-client.ts` | Used by `coachingApi.ts` |
| `readAccessToken()` | `senso/src/features/auth/storage.ts` | Auth token for coaching API calls |

</existing_assets>

<plan_breakdown>
## Plan Breakdown

| Plan | Title | Wave | Depends On |
|------|-------|------|------------|
| 04-01 | Coaching service backend core | 1 | 03-01 (profile service) |
| 04-02 | Coaching API endpoints | 2 | 04-01 |
| 04-03 | Frontend coaching screen | 3 | 04-02 |
| 04-04 | Safety hardening + boundary tests | 2 | 04-01 |

**04-01: Coaching service backend core**
JSONSchema files for all output shapes, Jinja2 composable prompt templates, `CoachingService` with `chat()` method, `SafetyScanner` implementing hard-boundaries.yml, extension of guardrail for coaching input. Unit tests for all components.

**04-02: Coaching API endpoints**
`POST /coaching/chat` and `GET /coaching/personas` endpoints, auth guard, profile gate, locale validation, integration tests.

**04-03: Frontend coaching screen**
`ChatScreen.tsx` with message bubbles, structured response rendering (reasoning cards, action/resource card stubs), routing from `ProfileScreen`, `coachingApi.ts`, error states.

**04-04: Safety hardening + boundary tests**
Full hard-boundaries.yml regression corpus (10+ injection patterns), output boundary verification (regulated investment language triggers block), JSONSchema output validation tests, prompt composability tests across all locales and personas.

</plan_breakdown>

<deferred>
## Deferred to Later Phases

- **Persona picker UI** — Phase 6
- **Voice input/output** — Phase 5
- **Streaming responses (SSE/EventSource)** — Phase 7
- **DB-persisted conversation history** — ~~Phase 7~~ **shipped in Phase 4** (Postgres already running)
- **Full `own_pii_unsolicited` profile cross-check** (matching live session fields) — Phase 7
- **Learn+Act cards fully wired** (action/resource cards rendered with real data) — Phase 6
- **ElevenLabs TTS per coaching response** — Phase 5

</deferred>

---

*Phase: 04-safe-grounded-text-coaching*
*Context gathered: 2026-03-28*
