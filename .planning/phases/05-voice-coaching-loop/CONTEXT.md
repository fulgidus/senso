# Phase 5: Voice Coaching Loop - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can complete the same coaching interaction via voice with resilient text fallback. Phase 5 introduces two capabilities running on top of the fully-wired Phase 4 coaching pipeline:

1. **Voice input (STT)**: A microphone button in `ChatScreen` records the user's question via Web Speech API, shows a live transcript, then submits it as a coaching message on stop. If the browser does not support Web Speech API, the mic button is hidden and the user continues with typed input seamlessly (VOIC-02).

2. **Voice output (TTS)**: Each assistant coaching response bubble gains a per-bubble play button. Clicking it fetches spoken audio from a new `POST /coaching/tts` backend endpoint (ElevenLabs API), creates an `ObjectURL`, and plays it. If ElevenLabs is unavailable (503/no key), the frontend silently falls back to `window.speechSynthesis`. The play button is only shown when TTS is functionally available (either path works).

Phase 5 also introduces a **dual-channel response shape** - the most architecturally significant change. The LLM now emits two complementary outputs in a single response:

- `message` (string): Short, conversational, **voice-optimised**. Spoken flow matters - no long lists, no exact decimal numbers (say "poco più di mille euro" not "€1023.44"), no acronyms, suitable for TTS audio. This is what the TTS endpoint speaks.
- `details_a2ui` (string | null): **A2UI JSONL string** - a sequence of Google A2UI protocol messages (`surfaceUpdate`, `dataModelUpdate`, `beginRendering`) that describe a rich, interactive UI component tree. Rendered in the chat bubble's detail panel by an `<a2ui-surface>` Lit web component. Contains the exact numbers, tables, timelines, cards, and structured breakdowns that the spoken message deliberately omits.

A2UI is Google's open-source declarative AI-to-UI protocol (https://github.com/google/A2UI). The LLM generates structured JSON describing UI component trees - no code execution. The Lit-based renderer (`<a2ui-surface>`) renders these declaratively in the browser. The protocol uses Gemini natively, which is already the primary LLM provider in this project.

This phase does NOT include: persona picker UI (Phase 6), streaming responses (Phase 7), full `own_pii_unsolicited` profile cross-check (Phase 7), or fully wired Learn+Act card actions (Phase 6).

Phase 5 ends when a user with a confirmed profile can:
1. Click the mic button, speak a question, and receive an AI coaching response
2. Click the play button on any response and hear the coaching message spoken aloud
3. Optionally read the full structured detail in the A2UI panel rendered below the spoken message
4. Continue seamlessly with typed input if voice is unavailable

</domain>

<decisions>
## Design Decisions

### D-V1: TTS runs on the backend via ElevenLabs
`POST /coaching/tts` is a new FastAPI endpoint in the coaching router. It accepts `{ text, locale, voice_id? }`, calls the ElevenLabs Python SDK, and returns raw audio bytes with `Content-Type: audio/mpeg`. The ElevenLabs API key (`ELEVENLABS_API_KEY`) stays server-side - it is never exposed to the browser.

Voice ID is configured via environment variable `ELEVENLABS_VOICE_ID` (default: the ElevenLabs Italian voice appropriate for `mentore-saggio`). The endpoint uses only the primary persona voice for Phase 5 - no per-user or per-persona selection yet.

The `elevenlabs` Python SDK (`elevenlabs>=2.40.0`) must be added to `api/pyproject.toml`.

### D-V2: Voice output is user-initiated (per-bubble play button)
Each assistant response bubble in `ChatScreen` has a speaker icon button. Clicking it:
1. Fetches audio from `POST /coaching/tts` with `response.message` as the text
2. Creates a browser `ObjectURL` from the returned audio blob
3. Plays via `HTMLAudioElement`
4. While playing, button shows a stop/pause icon; clicking again stops playback

Auto-play is intentionally deferred - the demo presenter needs control over when audio fires. An auto-play toggle is a Phase 6 concern.

### D-V3: STT augments ChatScreen (no new screen)
The mic button sits in the `ChatScreen` input area to the left of the textarea. No new route, no new screen. `ChatScreen` gains a `useVoiceInput` hook. While recording:
- Textarea is replaced with a live transcript display (interim + final results)
- A pulsing red mic indicator is shown
- Pressing stop (or after silence threshold) commits the final transcript and submits it as a coaching message

### D-V4: Web Speech API - feature-detect and hide on unavailable
Feature detection runs at hook init time using `'webkitSpeechRecognition' in window || 'SpeechRecognition' in window`. If unavailable, the mic button is hidden (not rendered) - not disabled - so there is no confusing broken UI. The text input area works normally as the sole input path (VOIC-02 compliance).

On runtime errors (permission denied, network, no-speech timeout): a small inline toast appears below the input area. The text input remains active throughout.

### D-V5: POST /coaching/tts returns raw audio bytes
```
POST /coaching/tts
Authorization: Bearer <jwt>
Body: { "text": string, "locale": "it" | "en" }
Response: Content-Type: audio/mpeg  (raw MP3 bytes)
```

On error (no key, ElevenLabs failure): returns HTTP 503 with `{ "code": "tts_unavailable", "message": "..." }`. The frontend catches 503 and falls back to `speechSynthesis`.

The endpoint is auth-guarded (same `Depends(get_current_user)` pattern). Input text is truncated server-side at 2500 chars at the nearest sentence boundary before sending to ElevenLabs (to stay within API limits). Only the `message` field (voice-optimised short text) is ever sent to TTS - never `details_a2ui` or reasoning steps.

### D-V6: ElevenLabs unavailability → silent fallback to browser speechSynthesis
If `POST /coaching/tts` returns 503 (or if the API key is absent), the frontend `useTTS` hook silently falls back to `window.speechSynthesis`. The play button is always shown when either TTS path is available:
- ElevenLabs available → plays HD audio from backend
- ElevenLabs 503 → plays via `speechSynthesis` (lower quality but functional)
- Both unavailable (e.g., `speechSynthesis` not present) → play button is hidden

This ensures demo resilience: even if the ElevenLabs key is not configured, voice output still works via browser synthesis for live demos.

### D-V7 (CRITICAL): Dual-channel response shape - voice-optimised message + A2UI rich detail

The LLM now produces two complementary outputs in every coaching response:

**Channel 1 - `message` (voice-optimised, short, conversational):**
- Written for spoken delivery, not reading
- No exact decimal numbers (use natural language approximations: "poco più di mille euro" not "€1,023.44")
- No acronyms or financial jargon (say "il tuo margine mensile" not "il tuo MMM")
- No bullet lists or markdown - flowing prose only
- Maximum 3-4 sentences
- Answers the core question directly, refers to details ("trovi i dettagli qui sotto")
- This is the text sent to TTS

**Channel 2 - `details_a2ui` (A2UI JSONL string, nullable):**
- A string containing newline-separated A2UI protocol messages
- Protocol messages: `surfaceUpdate` (component tree declaration), `dataModelUpdate` (data bindings), `beginRendering` (trigger)
- Components available: `text`, `button`, `card`, `timeline`, `dateTimeInput`, `textField`, and others per A2UI spec
- Contains exact numbers, structured breakdowns, tables, timelines
- Can be null/absent when the response is simple and a text message is sufficient

**Why dual-channel:**
The spoken message must be voice-optimised for TTS quality (no "one thousand and twenty-three euros and forty-four cents"). The UI detail panel must be precise and rich. Trying to serve both with one text field produces bad voice output or thin visual detail. The separation is clean: the `message` field is the voice layer, `details_a2ui` is the visual/detail layer.

**A2UI integration approach:**
- Backend: `details_a2ui` is a raw JSONL string in the LLM response. `CoachingService` passes it through without parsing (it's opaque to the backend - just a string field). No backend A2UI dependency.
- Frontend: `<a2ui-surface>` Lit web component from `@google/a2ui` (or `renderers/web_core/`) receives the JSONL string as a prop and renders it declaratively. React wraps the web component via a thin `A2UISurface` adapter component.
- Safety: A2UI is declarative JSON - no code execution. The same output safety scanner already in place covers the JSONL string content.

### D-V8: Coaching JSON schema change for dual-channel

`api/app/coaching/schemas/coaching_response.schema.json` gains a new optional field:
```json
"details_a2ui": {
  "type": ["string", "null"],
  "description": "A2UI JSONL string with surfaceUpdate/dataModelUpdate/beginRendering messages for rich detail UI rendering. Null if no structured detail is needed."
}
```

`CoachingResponseDTO` (Pydantic, `api/app/schemas/coaching.py`) gains:
```python
details_a2ui: Optional[str] = None
```

`CoachingResponse` TypeScript interface (`coachingApi.ts`) gains:
```typescript
details_a2ui?: string | null
```

The existing `action_cards`, `resource_cards`, and `learn_cards` arrays remain in the schema for backwards compatibility and as a fallback rendering path - but the primary rich detail path in Phase 5+ is `details_a2ui`.

### D-V9: Prompt update - voice-optimised `message` instruction

`api/app/coaching/prompts/response_format.j2` gains explicit voice-optimised instructions for the `message` field:

```
- **message**: SHORT (3-4 sentences), CONVERSATIONAL, VOICE-OPTIMISED reply. 
  Written for spoken delivery. Rules:
  - NO exact decimal numbers - use natural approximations ("poco più di mille euro", "circa tremila euro")
  - NO acronyms or abbreviations
  - NO bullet lists or markdown
  - NO exact monetary totals unless rounding to the nearest ten/hundred
  - Answer the core question first, then reference the detail panel ("trovi i dettagli qui sotto")
  - Plain prose only. Required.
```

And a new section for `details_a2ui`:
```
- **details_a2ui**: A2UI JSONL string OR null. When the answer benefits from structured 
  display (numbers, breakdowns, timelines), emit A2UI protocol messages. When the answer 
  is simple enough for text alone, emit null. See A2UI component reference below.
```

The `response_format.j2` template gains a new Jinja2 variable `a2ui_components_reference` that is injected from a new file `api/app/coaching/prompts/a2ui_reference.j2` (or a static JSON/MD snippet) describing available A2UI component types and a short example. This is loaded by `CoachingService` at init time alongside the existing schema and capabilities files.

</decisions>

<architecture>
## Architecture Overview

```
Voice Input (STT)
──────────────────
ChatScreen
  └─ useVoiceInput hook
      ├─ SpeechRecognition (Web Speech API)
      ├─ Feature detect on mount → hide mic if unavailable
      ├─ Interim transcript → live textarea display
      └─ Final transcript → handleSend() (same as typed input)

Voice Output (TTS)
──────────────────
ChatScreen (AssistantBubble)
  └─ VoicePlayButton component
      └─ useTTS hook
          ├─ Primary: POST /coaching/tts → MP3 bytes → ObjectURL → HTMLAudioElement
          └─ Fallback: window.speechSynthesis.speak(utterance) on 503

POST /coaching/tts
  ├─ Auth guard (Depends get_current_user)
  ├─ TTSService.speak(text, locale, voice_id)
  │   ├─ Truncate text at 2500 chars (nearest sentence boundary)
  │   └─ ElevenLabsClient.text_to_speech(text, voice_id) → bytes
  └─ Response: StreamingResponse(content=audio_bytes, media_type="audio/mpeg")

Dual-Channel Response (A2UI)
──────────────────────────────
LLM → { message: "short voice text", details_a2ui: "JSONL...", reasoning_used: [...], ... }
  │
  ├─ message → AssistantBubble text + useTTS play button
  └─ details_a2ui → A2UISurface React wrapper → <a2ui-surface> Lit web component → rendered UI
```

**Data flow additions in Phase 5:**

| Step                            | What changes                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `response_format.j2`            | New voice-optimised `message` rules + `details_a2ui` A2UI instructions + component reference                       |
| `coaching_response.schema.json` | New optional `details_a2ui: string\|null` field                                                                    |
| `CoachingService.chat()`        | No new logic - `details_a2ui` passes through as-is in the response dict                                            |
| `CoachingResponseDTO`           | New `details_a2ui: Optional[str]` field                                                                            |
| `api/app/api/coaching.py`       | New `POST /coaching/tts` endpoint                                                                                  |
| `api/app/coaching/tts.py`       | New `TTSService` wrapping ElevenLabs SDK                                                                           |
| `coachingApi.ts`                | New `details_a2ui?: string                                                                                         | null` on `CoachingResponse`; new `fetchTTSAudio(text, locale)` function |
| `ChatScreen.tsx`                | `useVoiceInput` hook + mic button; `useTTS` hook + play button in `AssistantBubble`; `A2UISurface` in detail panel |
| New files                       | `useVoiceInput.ts`, `useTTS.ts`, `A2UISurface.tsx`                                                                 |

</architecture>

<existing_assets>
## Existing Assets to Reuse

| Asset                                 | Location                                           | How Used                                                                      |
| ------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `CoachingService.chat()`              | `api/app/coaching/service.py:149`                  | Passes `details_a2ui` through unchanged - no service-layer changes            |
| `ChatRequest` / `CoachingResponseDTO` | `api/app/schemas/coaching.py`                      | Add `details_a2ui: Optional[str]` to `CoachingResponseDTO`                    |
| `coaching_response.schema.json`       | `api/app/coaching/schemas/`                        | Add `details_a2ui` optional string field                                      |
| `response_format.j2`                  | `api/app/coaching/prompts/`                        | Major update: voice-optimised `message` rules + `details_a2ui` instructions   |
| `system_base.j2`                      | `api/app/coaching/prompts/`                        | No change needed                                                              |
| `context_block.j2`                    | `api/app/coaching/prompts/`                        | No change needed                                                              |
| `get_current_user`                    | `api/app/api/ingestion.py`                         | Auth dependency reused in TTS endpoint                                        |
| `LLMClient`                           | `api/app/ingestion/llm.py`                         | NOT used for TTS - ElevenLabs SDK is separate                                 |
| `SafetyScanner.scan_output()`         | `api/app/coaching/safety.py`                       | TTS endpoint should run output scan on text before sending to ElevenLabs      |
| `coachingApi.ts`                      | `senso/src/features/coaching/coachingApi.ts`       | Add `details_a2ui` to `CoachingResponse`; add `fetchTTSAudio()`               |
| `ChatScreen.tsx`                      | `senso/src/features/coaching/ChatScreen.tsx:1-757` | Wire mic button + play button + A2UISurface in detail panel                   |
| `AssistantBubble` component           | `ChatScreen.tsx:193-224`                           | Add `VoicePlayButton` and `A2UISurface` to the bubble's detail section        |
| `apiRequest<T>()`                     | `senso/src/lib/api-client.ts`                      | Used by `fetchTTSAudio` (returns Blob, not JSON - may need raw fetch instead) |
| `readAccessToken()`                   | `senso/src/features/auth/storage.ts`               | Auth token for TTS API call                                                   |

**Note on `fetchTTSAudio`:** The TTS endpoint returns raw binary (audio/mpeg), not JSON. `apiRequest<T>()` is JSON-typed. `fetchTTSAudio` should use the native `fetch()` directly with the Bearer token header, and call `.blob()` on the response - similar to how file download endpoints are handled.

</existing_assets>

<a2ui_research>
## A2UI Integration Notes

**Source:** https://github.com/google/A2UI

**What it is:** An open-source protocol from Google for LLM-generated declarative UI. The LLM emits JSONL messages that a Lit-based renderer interprets into native DOM components. No code execution - pure JSON declaration.

**Protocol messages:**
- `surfaceUpdate`: Declares the component tree (what to render and how it's structured)
- `dataModelUpdate`: Binds data to component slots
- `beginRendering`: Triggers the render pass

**Available components (subset relevant to coaching):**
- `text` - plain/rich text block
- `card` - titled content card
- `button` - action button (for Phase 6 wired CTAs)
- `timeline` - ordered timeline of events/steps
- `textField` - labelled data field (for showing exact figures)
- `dateTimeInput` - date display

**Renderer options:**
- `@google/a2ui` npm package (if published) - preferred
- `renderers/web_core/` from the GitHub repo - Lit-based standalone custom elements

**React integration:**
A2UI uses Lit custom elements (`<a2ui-surface>`). In React, Lit web components require:
1. No `@lit/react` needed for simple attribute passing
2. The JSONL string is passed as a property (not attribute) to the element
3. React wraps it in a thin `A2UISurface.tsx` component that uses `useRef` + `useEffect` to set the `.jsonl` property on the DOM element directly

**Install approach:** Check if `@google/a2ui` is on npm; if not, install from the GitHub repo's `renderers/web_core/` dist. This needs to be confirmed during plan 05-03 execution - add a research step.

**Safety:** A2UI is declarative JSON. No `eval`, no script injection. The existing `SafetyScanner.scan_output()` runs over the full response JSON string (which includes `details_a2ui`) so the JSONL is already covered by output safety scanning.

**Prompt engineering for A2UI:**
The LLM needs a concise reference of available A2UI components and an example. A new file `api/app/coaching/prompts/a2ui_reference.j2` (or a static snippet embedded in `response_format.j2`) provides:
- Component type names
- Required/optional fields per component
- A 1-2 component example showing `surfaceUpdate` + `dataModelUpdate` + `beginRendering`

This is injected into the response format prompt alongside the existing schema and capabilities JSON.

</a2ui_research>

<plan_breakdown>
## Plan Breakdown

| Plan  | Title                                | Wave | Depends On       |
| ----- | ------------------------------------ | ---- | ---------------- |
| 05-01 | Backend TTS endpoint                 | 1    | Phase 4 complete |
| 05-02 | Dual-channel LLM response shape      | 1    | Phase 4 complete |
| 05-03 | A2UI renderer integration (frontend) | 2    | 05-02            |
| 05-04 | Frontend voice input (STT)           | 2    | Phase 4 complete |
| 05-05 | Frontend voice output (TTS)          | 2    | 05-01, 05-02     |

**05-01: Backend TTS endpoint**
- Add `elevenlabs>=2.40.0` to `api/pyproject.toml`
- Add `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` to `api/app/core/config.py` `Settings`
- Create `api/app/coaching/tts.py`: `TTSService` class with `speak(text, locale) -> bytes`. Truncates text server-side at 2500 chars (nearest sentence boundary). Lazy-imports `elevenlabs` SDK to avoid import failure when key absent.
- Add `POST /coaching/tts` to `api/app/api/coaching.py`: auth guard, input validation (text: str, locale: Literal["it","en"]), calls `TTSService.speak()`, returns `StreamingResponse(audio_bytes, media_type="audio/mpeg")`. Returns 503 `{"code":"tts_unavailable"}` if `ELEVENLABS_API_KEY` not set or ElevenLabs call fails.
- Unit tests in `api/tests/test_tts.py`: mock ElevenLabs SDK, test 200 with valid key, test 503 without key, test text truncation at sentence boundary, test auth guard.

**05-02: Dual-channel LLM response shape**
- Update `api/app/coaching/schemas/coaching_response.schema.json`: add optional `details_a2ui: { type: ["string", "null"] }` field. Remove `additionalProperties: false` lock on the top-level (or add the new field within it).
- Update `api/app/coaching/prompts/response_format.j2`: rewrite `message` field instructions for voice-optimisation (no decimals, no acronyms, no lists, 3-4 sentences); add `details_a2ui` field instructions; inject A2UI component reference.
- Create `api/app/coaching/prompts/a2ui_reference.j2` (or embed as static block in `response_format.j2`): short A2UI component reference with `surfaceUpdate`/`dataModelUpdate`/`beginRendering` structure + coached example for financial data display.
- Update `api/app/schemas/coaching.py`: add `details_a2ui: Optional[str] = None` to `CoachingResponseDTO`.
- Update `api/app/coaching/service.py` `_BLOCKED_RESPONSE_TEMPLATE`: add `"details_a2ui": None` to keep shape consistent.
- Update `senso/src/features/coaching/coachingApi.ts`: add `details_a2ui?: string | null` to `CoachingResponse` interface.
- Tests: add test asserting `CoachingResponseDTO` serialises with `details_a2ui` field; add test for schema validation accepting null and valid JSONL string; add snapshot test confirming `response_format.j2` renders with A2UI reference injected.

**05-03: A2UI renderer integration (frontend)**
- Research step: check if `@google/a2ui` is published on npm; if not, determine installation path from `renderers/web_core/` in the GitHub repo.
- Install A2UI renderer in `senso/` frontend.
- Create `senso/src/components/A2UISurface.tsx`: React wrapper around `<a2ui-surface>` Lit custom element. Uses `useRef` + `useEffect` to set `.jsonl` property on the DOM node. Renders nothing if `jsonl` is null/undefined. Handles custom element not-yet-defined gracefully (lazy import).
- Register the A2UI custom element once at app boot (in `main.tsx` or a lazy import in `A2UISurface.tsx`).
- Update `AssistantBubble` in `ChatScreen.tsx`: after `ReasoningCard`, add `{resp.details_a2ui && <A2UISurface jsonl={resp.details_a2ui} />}`.
- Update `parseStoredMessage` in `ChatScreen.tsx`: ensure `details_a2ui` is preserved when deserialising stored assistant messages.
- Smoke test: render `A2UISurface` with a hardcoded minimal A2UI JSONL string and verify the web component mounts without error.

**05-04: Frontend voice input (STT)**
- Create `senso/src/features/coaching/useVoiceInput.ts`: custom hook encapsulating `SpeechRecognition` / `webkitSpeechRecognition`. API:
  ```typescript
  const { isAvailable, isRecording, transcript, startRecording, stopRecording, error } = useVoiceInput({ locale, onFinalTranscript })
  ```
  - `isAvailable`: boolean - false if Web Speech API absent (mic button hidden in parent)
  - `isRecording`: boolean - pulsing indicator in UI
  - `transcript`: string - live interim + committed final text
  - `startRecording` / `stopRecording`: control functions
  - `error`: string | null - shown as inline toast in ChatScreen
  - On `onFinalTranscript(text)`: parent calls `handleSend(text)` directly
  - Handles: `permission denied`, `network`, `no-speech` (auto-stop + error message), `aborted`
- Update `ChatScreen.tsx`:
  - Import and wire `useVoiceInput`
  - Mic button in input area (left of textarea): hidden when `!isAvailable`, shows pulsing red dot when `isRecording`
  - While recording: textarea is disabled and shows live `transcript`
  - STT error toast: small text below input area, auto-dismisses after 4s
  - `onFinalTranscript` callback wired to `handleSend`
- VOIC-02 compliance: mic button hidden (not rendered) when `isAvailable === false`; text input unaffected

**05-05: Frontend voice output (TTS)**
- Add `fetchTTSAudio(text: string, locale: "it" | "en") => Promise<Blob>` to `coachingApi.ts`: uses native `fetch()` with Bearer token, calls `POST /coaching/tts`, returns `.blob()`. Throws `CoachingApiError("tts_unavailable", ..., 503)` on non-ok responses.
- Create `senso/src/features/coaching/useTTS.ts`: custom hook encapsulating TTS playback. API:
  ```typescript
  const { canPlay, isPlaying, play, stop } = useTTS()
  ```
  - `canPlay`: true if `speechSynthesis` or ElevenLabs is available (always true in modern browsers)
  - `isPlaying`: boolean
  - `play(text, locale)`: tries ElevenLabs first; on 503/failure, falls back to `speechSynthesis`
  - `stop`: stops current playback
  - Manages `ObjectURL` lifecycle (revoke on stop/component unmount)
- Create `VoicePlayButton` component (inline in `ChatScreen.tsx` or separate file): receives `{text, locale}` props, renders speaker icon, calls `useTTS().play()`. Shows animated "playing" icon while audio is active. Hidden when `!canPlay`.
- Update `AssistantBubble` in `ChatScreen.tsx`:
  - Add `<VoicePlayButton text={msg.content} locale={locale} />` to the bubble action area
  - Only rendered for non-welcome assistant messages with actual `response` data
  - Welcome message (`msg.isWelcome`) also gets a play button since it has `content`

</plan_breakdown>

<deferred>
## Deferred to Later Phases

- **Auto-play toggle** (play TTS automatically on each response) - Phase 6
- **Persona-specific TTS voice selection** (different ElevenLabs voice per persona) - Phase 6
- **Managed STT API** (Deepgram/Google STT for production cross-browser reliability) - Post-hackathon
- **Persona picker UI** - Phase 6
- **Learn+Act cards fully wired** (action/resource cards with real URLs and CTAs) - Phase 6
- **Streaming responses (SSE/EventSource)** - Phase 7
- **Full `own_pii_unsolicited` profile cross-check** - Phase 7
- **A2UI button CTAs wired to real actions** - Phase 6 (buttons render in Phase 5 but are non-functional)

</deferred>

<open_questions>
## Open Questions for Planning Execution

1. **A2UI npm availability**: Is `@google/a2ui` published on npm, or must we install from the GitHub `renderers/web_core/` source? This determines 05-03's install step. Research step is explicitly included in 05-03.

2. **ElevenLabs voice ID for Italian**: What is the correct ElevenLabs voice ID for the `mentore-saggio` persona (Italian, warm, educational)? This should be documented in `.env.example` and the `Settings` class default. Suggested default: `pNInz6obpgDQGcFmaJgB` (Adam, English) - to be replaced with an Italian voice ID during 05-01 execution.

3. **A2UI JSONL in stored messages**: When a coaching message with `details_a2ui` is persisted to `chat_messages.content` as a JSON string, the JSONL is double-escaped. `parseStoredMessage` in `ChatScreen.tsx` already deserialises the stored JSON; `details_a2ui` will be a string field within it. No structural change needed - just confirm the round-trip in 05-03 testing.

</open_questions>

---

*Phase: 05-voice-coaching-loop*
*Context gathered: 2026-03-28*
