---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
stopped_at: Completed 11-02-PLAN.md
last_updated: "2026-03-31T16:38:08.087Z"
progress:
  total_phases: 11
  completed_phases: 10
  total_plans: 47
  completed_plans: 45
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Help users make better financial decisions in the moment by combining real personal financial data with direct, educational AI guidance and concrete actions.
**Current focus:** Phase 11 - file-management-admin-inspector-connectors-ui-debug-controls

## Current Position

Phase: 11 (file-management-admin-inspector-connectors-ui-debug-controls) - EXECUTING
Plan: 3 of 4

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: 2 min
- Total execution time: 0.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| 01    | 3     | 6 min | 2 min    |

**Recent Trend:**

- Last 5 plans: 01-01, 01-02, 01-03
- Trend: Positive

| Phase 01 P01 | 6 | 3 tasks | 14 files |
| Phase 01 P02 | 0 | 3 tasks | 17 files |
| Phase 01 P03 | 0 | 2 tasks | 8 files |
| Phase 02-financial-input-ingestion P01 | 15min | 2 tasks | 12 files |
| Phase 02-financial-input-ingestion P02 | 2min | 2 tasks | 7 files |
| Phase 02-financial-input-ingestion P04 | 4min | 2 tasks | 10 files |
| Phase 02-financial-input-ingestion P03 | 15 | 2 tasks | 7 files |
| Phase 02-financial-input-ingestion P05 | 3min | 2 tasks | 9 files |
| Phase 02-financial-input-ingestion P05 | 525587min | 3 tasks | 9 files |
| Phase 03-financial-profile-clarity P01 | 3min | 4 tasks | 8 files |
| Phase 03-financial-profile-clarity P02 | 1min | 2 tasks | 3 files |
| Phase 04 P01 | 7min | 6 tasks | 14 files |
| Phase 04 P02 | 4min | 3 tasks | 4 files |
| Phase 04 P04 | 22min | 2 tasks | 5 files |
| Phase 04 P03 | 3min | 4 tasks | 4 files |
| Phase 05-voice-coaching-loop P02 | 6min | 2 tasks | 6 files |
| Phase 05-voice-coaching-loop P01 | 6min | 2 tasks | 5 files |
| Phase 05-voice-coaching-loop P03 | 8min | 2 tasks | 5 files |
| Phase 05-voice-coaching-loop P04 | 6min | 2 tasks | 3 files |
| Phase 05-voice-coaching-loop P05 | 3min | 2 tasks | 5 files |
| Phase 06-learn-act-cards-demo-hardening P01 | 11 | 2 tasks | 6 files |
| Phase 06-learn-act-cards-demo-hardening P02 | 15 | 2 tasks | 4 files |
| Phase 06-learn-act-cards-demo-hardening P03 | 2 | 2 tasks | 2 files |
| Phase 06-learn-act-cards-demo-hardening P04 | 12 | 2 tasks | 4 files |
| Phase 07-streaming-nice-to-have-polish P02 | 4 | 2 tasks | 5 files |
| Phase 07-streaming-nice-to-have-polish P04 | 2min | 3 tasks | 0 files |
| Phase 08-content-platform P01 | 15min | 2 tasks | 7 files |
| Phase 08-content-platform P02 | 8min | 2 tasks | 6 files |
| Phase 08-content-platform P03 | 5min | 2 tasks | 6 files |
| Phase 09-llm-financial-intelligence P01 | 11min | 2 tasks | 2 files |
| Phase 09-llm-financial-intelligence P02 | 15 | 2 tasks | 4 files |
| Phase 09-llm-financial-intelligence P03 | 12 | 2 tasks | 4 files |
| Phase 09-llm-financial-intelligence P04 | 15 | 2 tasks | 3 files |
| Phase 09-llm-financial-intelligence P05 | 10 | 1 tasks | 1 files |
| Phase 09-llm-financial-intelligence P06 | 420 | 2 tasks | 7 files |
| Phase 09 P07 | 15 | 2 tasks | 9 files |
| Phase 10 P01 | 9 | 3 tasks | 8 files |
| Phase 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention P03 | 8min | 2 tasks | 2 files |
| Phase 10 P04 | 6min | 2 tasks | 8 files |
| Phase 11-file-management-admin-inspector-connectors-ui-debug-controls P01 | 3min | 2 tasks | 7 files |
| Phase 11 P02 | 45 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap Init]: Sequence optimized for one-day demo reliability: foundation -> ingestion -> profile -> safe text coaching -> voice -> demo hardening.
- [Roadmap Init]: Safety constraints merged into coaching phase to ensure no unsafe coaching path exists before voice rollout.
- [Phase 01]: FastAPI owns auth/session with 15m access JWT plus rotating 7-day refresh tokens for persistent login.
- [Phase 01]: Google OAuth endpoints return deterministic email_password fallback payload when provider config/exchange is unavailable.
- [Phase 01]: Frontend auth shell now gates views by bootstrap session and preserves login with localStorage + refresh retry.
- [Phase 01]: Phase runtime is standardized on docker-compose frontend/api/postgres with scripted smoke checks for judge setup.
- [Phase 02-financial-input-ingestion]: SQLite for tests + repository-as-functions pattern for DB layer - File-based SQLite allows cross-request session reuse in tests; functional repository avoids over-engineering
- [Phase 02-financial-input-ingestion]: LLMClient uses lazy provider imports inside methods to avoid import-time failures when SDKs are not installed - Enables clean test environments without requiring google-genai/openai packages installed at module load time
- [Phase 02-financial-input-ingestion]: Used FastAPI dependency_overrides (not patch()) to mock get_minio_client in tests - only correct approach for Depends()-injected deps
- [Phase 02-financial-input-ingestion]: require_admin written as clean Depends() function with DB is_admin lookup - avoids __import__ hack in plan sample
- [Phase 02-financial-input-ingestion]: IngestionError mirrors AuthError pattern (code, message, status_code) for consistent HTTP error shape across all services
- [Phase 02-financial-input-ingestion]: ExtractedDocument TypeScript interface uses snake_case field names to match FastAPI model_dump output - API get_extracted returns raw payload_json dict with snake_case keys; using camelCase causes runtime failures
- [Phase 02-financial-input-ingestion]: ExtractedDocument TypeScript interface uses snake_case - API model_dump returns snake_case keys, not camelCase
- [Phase 02-financial-input-ingestion]: Ingestion UI uses readAccessToken() from storage module - getStoredTokens() does not exist
- [Phase 03-financial-profile-clarity]: confirm-all always triggers categorization regardless of confirmed_count - Unconditional categorization trigger matches D-10 and D-02; user may have already confirmed uploads previously
- [Phase 04]: CoachingService uses messages:list[dict] (stateless) for chat() - DB session persistence wired at API layer in 04-02
- [Phase 04]: SafetyScanner skips pattern-less groups (own_pii_unsolicited in Phase 4) gracefully - full cross-check deferred to Phase 7
- [Phase 04]: API layer wires session persistence: load prior messages from DB, call CoachingService.chat(messages=list[dict]), persist user+assistant messages after response
- [Phase 04]: Supplemental injection patterns merged at SafetyScanner init time into prompt_injection group - YAML stays as source of truth, Python covers Phase 4 corpus gaps
- [Phase 04]: own_pii_unsolicited given Phase 4 pattern-only regex in hard-boundaries.yml - enables all 4 groups to load for test coverage; Phase 7 adds live profile cross-check
- [Phase 04]: coachingApi.ts uses 3-arg apiRequest(API_BASE, path, options) matching existing api-client.ts signature
- [Phase 04]: CoachingApiError uses explicit property assignment (not constructor shorthand) for erasableSyntaxOnly tsconfig compliance
- [Phase 05-voice-coaching-loop]: Dual-channel LLM response shape: voice-optimised message + nullable details_a2ui A2UI JSONL established as foundational data contract for Phase 5 - Separation of voice layer (message) and visual/detail layer (details_a2ui) enables TTS to speak optimised text while UI renders precise structured data
- [Phase 05-voice-coaching-loop]: Used patch.object(TTSService, 'speak') for integration tests instead of dependency_overrides - avoids SQLite DB isolation issues - Settings override caused 'no such table' errors in subsequent tests due to conftest reset_db fixture interaction
- [Phase 05-voice-coaching-loop]: Lit LitElement without decorators - erasableSyntaxOnly tsconfig requires manual property getter/setter and customElements.define() instead of @property and @customElement
- [Phase 05-voice-coaching-loop]: Custom Web Speech API type declarations in useVoiceInput.ts - TypeScript tsconfig.app.json lib does not include SpeechRecognition globals; explicit interface declarations are portable and don't require tsconfig changes
- [Phase 05-voice-coaching-loop]: fetchTTSAudio uses native fetch (not apiRequest) because response is binary audio/mpeg, not JSON - Enables binary Blob response handling; apiRequest<T> is JSON-typed
- [Phase 05-voice-coaching-loop]: canPlay tied to speechSynthesis availability - ElevenLabs backend is optional; play button shown when browser synthesis exists - Demo-resilient per D-V6: voice output works even without ElevenLabs key via browser speechSynthesis fallback
- [Phase 06-learn-act-cards-demo-hardening]: Fallback injection trigger uses affordability_verdict is None — skip for conversational responses, inject for financial decisions regardless of message length
- [Phase 06-learn-act-cards-demo-hardening]: _repair_response() made unconditional in CoachingService.chat() — ensures arrays always exist before fallback injection runs
- [Phase 06-learn-act-cards-demo-hardening]: Docker test setup: uv sync without --no-dev + COPY tests enables pytest inside container — required for CI and all Phase 6 test verification
- [Phase 06-learn-act-cards-demo-hardening]: MARP slide separator regex uses /\n[ \t]*---[ \t]*\n/ to handle actual \n\n---\n\n pattern in .md files
- [Phase 06-learn-act-cards-demo-hardening]: STT mute implemented via isPlaying rising-edge useEffect (wasPlayingRef pattern) - cleaner than inside onAssistantMessage
- [Phase 06-learn-act-cards-demo-hardening]: AuthResponseDTO flat token shape: access_token is top-level key, not nested under tokens — plan template assumption was wrong
- [Phase 06-learn-act-cards-demo-hardening]: FK CASCADE delete from users is sufficient for full reset — all 12 child tables cascade automatically per models.py
- [Phase 06-learn-act-cards-demo-hardening]: Table names in reset script: uploads (not ingestion_uploads), chat_sessions (not coaching_sessions), chat_messages (not coaching_messages)
- [Phase 06-learn-act-cards-demo-hardening]: 35s client-side timeout: below backend 60s LLM timeout so backend 502 fires first on LLM failure; 35s catches connection hangs during demo
- [Phase 06-learn-act-cards-demo-hardening]: setErrorWithAutoDismiss wrapper pattern — profile_required errors persistent; all other transient error codes auto-dismiss after 8s
- [Phase 07-streaming-nice-to-have-polish]: Persisted default persona at the user level via users.default_persona_id so new conversations inherit a durable saved coach preference.
- [Phase 07-streaming-nice-to-have-polish]: Persona theme tokens now flow from api/app/personas/config.json through PersonaDTO so frontend theming stays config-driven.
- [Phase 07-streaming-nice-to-have-polish]: Streaming backend reuses the existing validated chat flow and emits only message deltas plus a final structured SSE payload.
- [Phase 07-streaming-nice-to-have-polish]: own_pii_unsolicited is now enforced through a live-profile rewrite pass that trims unsolicited facts without hard-blocking normal coaching answers.
- [Phase 07-streaming-nice-to-have-polish]: All persona UX work pre-completed in prior plans (07-01/02/03); 07-04 verified acceptance criteria and auto-approved visual checkpoint.
- [Phase 08-content-platform]: ContentItemDTO uses serialization_alias='metadata' instead of alias='metadata' to avoid SQLAlchemy MetaData conflict when from_attributes=True.
- [Phase 08-content-platform]: BM25 index loads from DB first, falls back to static JSON if empty/unavailable — ensures search works during migration.
- [Phase 08-content-platform]: Public content API has no auth dependency — fully open for content sharing and SEO.
- [Phase 08-content-platform]: BrowserRouter moved to root level; AppRoutes checks pathname for /learn prefix to render public routes before auth gate.
- [Phase 08-content-platform]: MarpSlideViewer reused directly from coaching feature for slide_deck detail rendering.
- [Phase 09]: date imported from datetime for FinancialTimeline.event_date (was missing from models.py imports)
- [Phase 09]: LLMType already included classification in llm_config.py — no change needed to llm.py for classification routing
- [Phase 09]: 3-tier escalation uses per-tier confidence thresholds: sm≥0.6, md≥0.5, lg≥0.4 — lower threshold for stronger models
- [Phase 09]: _run_timeline_inference() implements 4 of 6 D-13 event types — relocation and debt_change deferred (insufficient transaction fields for reliable detection)
- [Phase 09]: upsert_timeline_event matches on (user_id, event_type, event_date) to prevent duplicate events on re-runs
- [Phase 09]: get_schema() lives in app.ingestion.prompts.loader not app.ingestion.schemas.loader — plan had wrong import path
- [Phase 09]: TOS check defaults to clean=True on LLM error (fail open) — avoids blocking users when LLM unavailable
- [Phase 09]: BackgroundTasks used for async TOS+distillation in POST /profile/timeline/{id}/context — 202 Accepted returns immediately
- [Phase 09]: Contributing user in admin merchant map shown as obfuscated email u****@domain.com
- [Phase 09-llm-financial-intelligence]: Plan 09-06: API functions added to lib/profile-api.ts (not a new src/api/profileApi.ts) — existing token-based apiRequest pattern followed
- [Phase 09]: notificationsApi.ts placed in senso/src/api/ (new dir); adminMerchantApi.ts co-located with features/admin/ following adminContentApi.ts pattern
- [Phase 09]: onUnreadCountChange callback added to NotificationPanel so bell badge updates immediately on mark-read without waiting for next 30s poll
- [Phase 10]: violation_count and banned_until already in Round 12 — Round 13 adds only 3 new Phase 10 columns to avoid duplicate column errors
- [Phase 10]: server_wrap_user_key() uses lazy import of get_settings() to prevent circular import at module load time
- [Phase 10]: Privacy section inserted before App info in Settings — keeps transparency/privacy features grouped logically before meta-info
- [Phase 10]: ttsNoticeDismissed persisted to sessionStorage — resets per browser session so user is reminded after each login
- [Phase 10]: Public /about uses same PublicShell + State 1b pattern as /learn — no new infrastructure needed
- [Phase 11]: role column added alongside is_admin Boolean (not replacing it) for backward compat — existing code using is_admin=True continues to work
- [Phase 11]: require_admin uses role=='admin' OR is_admin check — both signals count until full migration
- [Phase 11]: require_tester: role in (tester, admin) OR is_admin — admins can access tester features
- [Phase 11]: IngestionTrace model/migration completed by parallel 11-01 agent; 11-02 instrumented service + exposed admin trace endpoint

### Pending Todos

None yet.

### Blockers/Concerns

- Docker CLI unavailable in executor environment; compose verification deferred to Docker-enabled host.

### Roadmap Evolution

- Phase 8 added: Content platform management, indexing & public serving (articles, MARPs, curated links)
- Phase 9 added: LLM financial intelligence with categorization, tagging, timeline inference & crowdsourced merchant mapping
- Phase 10 added: Transparency & security with about page, encryption at rest & LLM no-data-retention

## Session Continuity

Last session: 2026-03-31T16:38:08.084Z
Stopped at: Completed 11-02-PLAN.md
Resume file: None
