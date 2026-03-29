# Phase 7 Research: Streaming & Nice-to-Have Polish

**Date:** 2026-03-29
**Scope:** Planning guidance for streaming coaching UX, persona persistence, history restoration polish, and live-profile unsolicited-PII protection.

## What already exists

- `api/app/api/coaching.py` already owns chat session creation, session restoration, welcome generation, persona listing, rename/delete flows, and TTS.
- `api/app/coaching/service.py` already returns a final validated structured response and already repairs/fallback-injects structured arrays.
- `api/app/db/models.py` already persists `ChatSession.persona_id` and `ChatMessage.persona_id`, so per-message persona history is already available.
- `senso/src/features/coaching/ChatScreen.tsx` already auto-restores the newest session, loads full history, renders cards/A2UI, and gates TTS autoplay through `useVoiceMode`.
- `senso/src/features/settings/SettingsScreen.tsx` plus `senso/src/features/auth/session.ts` already persist user settings through `PATCH /auth/me`.

## Recommended implementation choices

### 1. Streaming transport

Use **SSE framing (`text/event-stream`) over an authenticated `fetch()` request**, not the native `EventSource` browser object.

Why:
- Native `EventSource` cannot send a POST body.
- Native `EventSource` cannot attach the existing Bearer token header used by `/coaching/chat`.
- A fetch-based SSE reader keeps the current auth/session contract and still satisfies the roadmap's SSE requirement.

### 2. Streaming backend scope

Do **not** re-architect `LLMClient` into provider-native incremental token streaming in this phase.

Instead:
- Keep the current `CoachingService.chat()` tool-calling + schema-validation path.
- Add a new streaming endpoint that reuses the same request/session flow, then emits:
  - `meta` event: `{ session_id, persona_id }`
  - repeated `delta` events for the final `message` field only
  - one `final` event with the complete validated `CoachingResponseDTO`
  - `error` / `done` terminal events
- Chunk only the already-validated `message` field. This preserves D-02 (structured payloads do not stream) and minimizes risk.

### 3. Fallback path

Keep `POST /coaching/chat` as the silent full-response fallback path.

Frontend behavior:
- Try streaming first.
- If the stream handshake fails or the stream errors before `final`, call the existing full-response client and complete the same bubble.
- Never require a manual retry just because streaming failed.

### 4. Persona persistence

Persist the default persona as a **new `users.default_persona_id` column** and extend the existing `/auth/me` PATCH path.

Why:
- Settings already saves voice preferences at the user level.
- The default coach is a user preference, not a per-session artifact.
- This cleanly satisfies D-06/D-08 without overloading `ChatSession.persona_id`.

### 5. Persona UI data contract

Extend `api/app/personas/config.json` with lightweight theme metadata for each persona and expose it through `GET /coaching/personas`.

Recommended metadata shape:
- `theme.light.avatar_bg`
- `theme.light.bubble_border`
- `theme.light.bubble_bg`
- `theme.dark.avatar_bg`
- `theme.dark.bubble_border`
- `theme.dark.bubble_bg`
- `theme.label_tone`

This keeps persona styling config-driven per D-10 and the UI-SPEC.

### 6. History restoration

Do not rebuild session storage. Storage already exists.

Phase 7 work is UX polish:
- keep newest-session auto-restore
- surface an auto-dismiss restore toast
- ensure the full message list is loaded before the composer is treated as ready
- preserve scroll position rules during live streaming

### 7. own_pii_unsolicited safety pass

Implement a **rewrite-first post-processing pass** in `SafetyScanner`, not a hard blocker.

Recommended rule:
- Build a candidate list from the live session user/profile snapshot (email, names, monthly margin, income amounts, expense totals, questionnaire-derived values, insight headlines, category totals).
- If the final assistant payload includes profile facts that were *not asked for* in the last user question, sanitize those facts from:
  - `message`
  - `reasoning_used[].detail`
  - `affordability_verdict.key_figures[]`
  - `details_a2ui` when present
- If sanitizing empties the main answer, fall back to the existing substitute message.
- Treat this as `warn`/rewrite, not `block`, to honor D-15/D-16/D-17.

## Risks and mitigation

| Risk | Why it matters | Mitigation |
| ---- | -------------- | ---------- |
| Native EventSource auth/body limits | breaks current chat auth contract | use fetch-based SSE reader |
| Over-scoping into provider streaming | high-risk refactor for a polish phase | stream the validated final `message` only |
| Persona UI becoming visually loud | conflicts with D-09 and UI-SPEC | tint only avatar, 1px border, first-message cue after switch |
| Safety rewrite over-blocks grounded coaching | degrades usefulness | rewrite only matched facts; preserve remainder of response |

## Recommended plan split

1. **Backend preferences + persona metadata**
2. **Backend SSE endpoint + live-profile rewrite safety**
3. **Frontend streaming + restore UX**
4. **Frontend persona settings/switcher + subtle theming + visual verification**

## Validation Architecture

### Fast feedback
- Backend targeted: `docker compose run --rm api uv run pytest tests/test_auth_endpoints.py tests/test_coaching_endpoints.py tests/test_safety_hardening.py -q`
- Frontend targeted: `docker compose run --rm frontend pnpm vitest run src/features/auth/__tests__/auth-session.test.ts`
- Frontend build gate: `docker compose run --rm frontend pnpm build`

### Required new automated coverage
- Backend tests for `/coaching/chat/stream` SSE event order and fallback-safe persistence
- Backend tests for `default_persona_id` auth PATCH/GET round-trip
- Backend tests for own-profile rewrite behavior vs allowed grounded answers
- Frontend tests for updated auth session parsing of `default_persona_id`
- Frontend build verification after ChatScreen/SettingsScreen changes

### Manual-only checks
- Streaming bubble polish and motion feel
- Restore toast timing/placement
- Persona tint subtlety in light/dark mode

---

**Research conclusion:** Phase 7 can be implemented as a low-risk polish phase by preserving the existing full-response coaching pipeline, layering SSE delivery on top of it, storing default persona at the user level, and extending the safety scanner with rewrite-first live-profile checks.
