# Phase 7: Streaming & Nice-to-Have Polish - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 improves the coaching experience and production readiness of the existing chat flow.
It adds token-by-token streaming for the main assistant message, persona choice with persisted
defaults, a stronger return-to-chat restoration experience on top of already-persisted session
history, and a live-profile `own_pii_unsolicited` safety cross-check.

This phase does not add new core capabilities beyond the roadmap goal. Conversation storage
already exists; the open work is streaming UX, persona UX + persistence, restoration behavior,
and the final safety pass for unsolicited profile disclosure.

</domain>

<decisions>
## Implementation Decisions

### Streaming UX
- **D-01:** Stream the main assistant text in a single live typing bubble. The reply should feel polished and progressive, with token-by-token or character-style animated appearance rather than a late full swap.
- **D-02:** Streaming applies only to the normal text / spoken message layer. Structured payloads such as cards, verdict UI, and `details_a2ui` do not stream shape-by-shape.
- **D-03:** If streaming is unavailable or breaks mid-reply, silently fall back to the current full-response behavior so the user still receives the answer without manual recovery.
- **D-04:** In voice mode, visual text may stream first, but TTS playback begins only after the final spoken text is complete.
- **D-05:** Structured UI inserts only when its final payload is ready. Do not reserve per-section skeleton slots in advance. When structured UI appears, soften layout shift with tasteful animation so it feels intentional rather than jarring.

### Persona Selection & Persistence
- **D-06:** Persona selection exists in two places: a quick switcher in chat and a persistent default selection in Settings.
- **D-07:** Switching persona inside chat affects only future assistant replies. Existing messages keep the persona they were originally sent with.
- **D-08:** A brand-new conversation starts with the user's saved default persona from Settings, not simply the last ad hoc in-chat switch and not always `mentore-saggio`.

### Persona Presence in History
- **D-09:** Keep persona visibility subtle on assistant messages. Per-message persona cues should remain lightweight rather than turning every bubble into a loud character card.
- **D-10:** Persona styling should be driven from persona config with light/dark visual identity tokens (colors or restrained gradients) so each persona slightly changes assistant bubble treatment and avatar background without overwhelming the chat.

### Conversation Restoration UX
- **D-11:** When the user returns to the chat screen, automatically reopen the most recent conversation.
- **D-12:** When a conversation is restored, load the full visible history into the main chat view immediately rather than truncating to recent turns or replacing older content with a summary.
- **D-13:** Keep the existing history button/modal pattern as the way to access older conversations. The product should not switch to a permanent sidebar or dropdown-only model in this phase.
- **D-14:** Auto-restoring the last session should show a subtle, tasteful animated toast that disappears on its own. The cue confirms continuity without interrupting the user.

### PII Safety Cross-Check
- **D-15:** Implement the Phase 7 live-profile `own_pii_unsolicited` cross-check, but keep enforcement soft. The goal is to reduce awkward unsolicited disclosure without making coaching brittle.
- **D-16:** Preferred behavior is warn-and-rewrite: when the assistant appears to surface user-profile details the user did not actually ask for, trim or rewrite the risky part while preserving the useful answer when possible.
- **D-17:** Do not make this an aggressive blocker for normal grounded coaching. The system should err toward preserving helpful responses unless the unsolicited disclosure is clearly inappropriate.

### the agent's Discretion
- Exact streaming transport and event framing, as long as the UX matches the decisions above and graceful fallback exists.
- Exact animation timing/easing for typing, layout insertions, and restore toast.
- Exact shape of the in-chat persona switcher and Settings control, provided chat switching is quick and Settings owns the saved default.
- Exact heuristics for deciding when a profile detail counts as unsolicited, provided the behavior stays rewrite-first rather than block-first.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and scope
- `.planning/ROADMAP.md` - Phase 7 goal, success criteria, and milestone ordering.
- `.planning/PROJECT.md` - product vision, constraints, and Italian-first/i18n guardrails.
- `.planning/REQUIREMENTS.md` - demo and future-history requirements context, especially `DEMO-02` and `NEXT-05`.
- `.planning/STATE.md` - current project memory, including prior notes that history already shipped in Phase 4 and full own-profile cross-check was deferred to Phase 7.

### Prior phase decisions to carry forward
- `.planning/phases/04-safe-grounded-text-coaching/CONTEXT.md` - locked decisions for structured coaching responses, DB-backed chat persistence, locale behavior, and Phase 4 safety boundaries.
- `.planning/phases/05-voice-coaching-loop/CONTEXT.md` - dual-channel response design (`message` + `details_a2ui`), TTS/STT behavior, and voice loop constraints that streaming must respect.
- `.planning/phases/06-learn-act-cards-demo-hardening/CONTEXT.md` - inline card rendering, demo reliability priorities, and polished-in-chat delivery expectations.

### Existing coaching implementation
- `api/app/api/coaching.py` - current chat/session endpoints, message persistence behavior, welcome flow, persona listing, and likely integration point for streaming.
- `api/app/coaching/service.py` - current response generation path, persona loading, prompt/schema flow, and output safety scan placement.
- `api/app/coaching/safety.py` - current regex-based scanner and the exact Phase 4 limitation where `own_pii_unsolicited` is pattern-only.
- `api/app/db/models.py` - `ChatSession` / `ChatMessage` schema and per-message `persona_id` persistence already available for history rendering.
- `api/app/db/session.py` - migration pattern and existing chat/persona-related columns.
- `api/app/personas/config.json` - current persona registry and the right place to extend persona metadata for visual theming.
- `api/app/schemas/coaching.py` - request/response DTOs for chat, session history, personas, and the current message payload contract.

### Frontend coaching surfaces
- `senso/src/features/coaching/ChatScreen.tsx` - current chat lifecycle, restore-last-session behavior, loading skeleton, history modal, and voice-mode wiring.
- `senso/src/features/coaching/coachingApi.ts` - current full-response client contract and persona/session fetch helpers.
- `senso/src/features/coaching/useVoiceMode.ts` - current voice-mode loop and auto-listen timing that streaming must fit around.
- `senso/src/features/coaching/useTTS.ts` - current TTS playback behavior and fallback semantics.
- `senso/src/features/settings/SettingsScreen.tsx` - existing user-settings surface where persistent persona default should live alongside voice preferences.
- `senso/src/features/auth/session.ts` - existing `updateMe()` user-preference persistence path that likely needs extension for saved default persona.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/app/api/coaching.py`: already owns session creation, session restoration, session listing, persona list delivery, and message persistence; likely the best integration point for any streamed chat endpoint.
- `api/app/coaching/service.py`: already centralizes prompt assembly, persona loading, schema validation, and output safety scanning; planners should build streaming around this service rather than bypassing it.
- `api/app/db/models.py`: `ChatSession.persona_id` and `ChatMessage.persona_id` already exist, so persona-aware history does not require inventing new message-level storage.
- `senso/src/features/coaching/ChatScreen.tsx`: already auto-restores the newest session, renders full history, and contains the loading / history / assistant bubble UX that Phase 7 will refine.
- `senso/src/features/coaching/coachingApi.ts`: already has the typed coaching/session/persona API layer; streaming can extend this module rather than introducing an unrelated client path.
- `senso/src/features/coaching/useVoiceMode.ts` and `senso/src/features/coaching/useTTS.ts`: existing voice-turn infrastructure can be reused so streaming only changes timing, not the whole voice architecture.
- `senso/src/features/settings/SettingsScreen.tsx` + `senso/src/features/auth/session.ts`: existing saved-preference pipeline already persists user settings and can be extended for default persona selection.
- `api/app/personas/config.json`: existing persona registry is the right place to add lightweight per-persona visual theme metadata.

### Established Patterns
- API-layer statefulness: session/message persistence happens in the FastAPI router layer, while generation logic stays in `CoachingService`.
- Structured coaching payloads: the chat contract already separates human-facing `message` from structured extras like cards and `details_a2ui`; streaming must preserve that split.
- Demo-first resilience: prior phases favor graceful fallback and low-friction recovery over strict failure behavior.
- Settings persistence: user-level preferences already flow through `/auth/me` PATCH and the auth session parser, so new durable persona defaults should follow that same path.
- Safety architecture: input guard -> prompt boundaries -> output scanner is already the standard pattern; Phase 7 should extend the scanner rather than bolt on a separate ad hoc privacy filter.

### Integration Points
- Backend streaming endpoint in `api/app/api/coaching.py`, likely adjacent to `POST /coaching/chat`, reusing the same auth/session/profile flow.
- Response generation changes in `api/app/coaching/service.py` to support incremental main-text delivery while preserving final structured payload assembly.
- User preference schema/service updates in `api/app/schemas/auth.py`, `api/app/services/auth_service.py`, and the corresponding user model/migration path if a saved default persona becomes a persisted user field.
- Persona theming read path from `api/app/personas/config.json` through `/coaching/personas` into `coachingApi.ts` and `ChatScreen.tsx`.
- Frontend restore/history UX changes in `senso/src/features/coaching/ChatScreen.tsx`, especially mount-time session restore, assistant bubble styling, and restore cue handling.

</code_context>

<specifics>
## Specific Ideas

- Streaming should feel polished and expressive, with the main reply typing into a real assistant bubble rather than hiding behind a generic loader.
- In speech-to-speech mode, only the spoken/main text should stream live; structured sections should wait for a stable final payload.
- Persona differences should be visible mostly through restrained color/gradient identity and subtle per-message cues, not loud visual chrome.
- Restored-session acknowledgment should feel like a tasteful animated toast, not a blocking banner.

</specifics>

<deferred>
## Deferred Ideas

- LLM-side no-retention/privacy guarantees - important, but treated as separate privacy/infrastructure work rather than a requirement of this Phase 7 UX/polish slice.
- Encryption at rest / stronger cryptographic privacy posture - important follow-up, but beyond the boundary of this phase's chat UX, persona UX, and scanner-behavior work.
- Any new analytics, trajectory dashboards, or broader history/insight browsing experience beyond reopening the last session and accessing older sessions via the existing history UI.

</deferred>

---

*Phase: 07-streaming-nice-to-have-polish*
*Context gathered: 2026-03-29*
