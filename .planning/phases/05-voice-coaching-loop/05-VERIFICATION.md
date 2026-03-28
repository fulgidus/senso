---
phase: 05-voice-coaching-loop
verified: 2026-03-28T17:00:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Click mic button in Chrome/Safari, speak a financial question, confirm transcript submits as coaching message"
    expected: "Transcript text appears in input, automatically submits as coaching request, AI response renders"
    why_human: "Web Speech API requires browser microphone interaction — cannot automate with grep/build checks"
  - test: "Click play button on an assistant response bubble with ElevenLabs key configured"
    expected: "MP3 audio plays aloud; button shows Square icon while playing; clicking again stops playback"
    why_human: "Audio playback requires live browser context and ElevenLabs API key in environment"
  - test: "Click play button with ElevenLabs key absent (503 from backend)"
    expected: "Browser speechSynthesis fallback triggers silently; message is spoken via browser TTS"
    why_human: "Fallback behavior depends on actual network calls to /coaching/tts; needs real runtime"
  - test: "Receive a coaching response with details_a2ui populated by LLM"
    expected: "Structured card panel (textField rows showing exact figures) renders below the spoken message in AssistantBubble"
    why_human: "Requires a real LLM response that emits A2UI JSONL — cannot be verified without live LLM call"
---

# Phase 5: Voice Coaching Loop — Verification Report

**Phase Goal:** Users can complete the same coaching interaction via voice with resilient text fallback — mic button for STT input, per-bubble TTS playback via ElevenLabs with speechSynthesis fallback, and dual-channel LLM responses (voice-optimised message + A2UI rich detail panel).
**Verified:** 2026-03-28T17:00:00Z
**Status:** ✅ PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | POST /coaching/tts returns MP3 audio bytes when ELEVENLABS_API_KEY is set | ✓ VERIFIED | `test_tts_returns_audio_when_key_set` passes; endpoint returns `audio/mpeg` with `b"fake-mp3"` |
| 2  | POST /coaching/tts returns 503 JSON error when API key absent or ElevenLabs fails | ✓ VERIFIED | `test_tts_endpoint_returns_503_when_no_key` passes; response `detail.code == "tts_unavailable"` |
| 3  | TTS endpoint is auth-guarded — unauthenticated requests return 401 | ✓ VERIFIED | `test_tts_endpoint_returns_401_when_unauthenticated` passes; 31/31 tests green |
| 4  | Input text is truncated server-side at 2500 chars at nearest sentence boundary | ✓ VERIFIED | `_truncate_at_sentence` tested with 4 cases; `TTSService` applies truncation before ElevenLabs call |
| 5  | LLM receives voice-optimised instructions (no decimals, no acronyms, 3-4 sentences, prose only) | ✓ VERIFIED | `response_format.j2` line 12-18: `VOICE-OPTIMISED`, `NO exact decimal numbers`, `NO acronyms`, `NO bullet lists` |
| 6  | LLM receives A2UI component reference and can emit structured details_a2ui JSONL | ✓ VERIFIED | `a2ui_reference.j2` contains `surfaceUpdate`/`dataModelUpdate`/`beginRendering`; injected via `{{ a2ui_reference }}` in `response_format.j2` |
| 7  | CoachingResponseDTO serialises with details_a2ui field (None when absent) | ✓ VERIFIED | `coaching.py` line 72: `details_a2ui: Optional[str] = None`; `_BLOCKED_RESPONSE_TEMPLATE` has `"details_a2ui": None` |
| 8  | CoachingResponse TypeScript interface includes details_a2ui field | ✓ VERIFIED | `coachingApi.ts` line 66: `details_a2ui?: string \| null` |
| 9  | Backend schema validates details_a2ui as optional string-or-null | ✓ VERIFIED | `coaching_response.schema.json` lines 86-89: `"type": ["string", "null"]`; not in `required` array |
| 10 | A2UI JSONL content renders visibly inside assistant response bubbles when details_a2ui is non-null | ✓ VERIFIED | `ChatScreen.tsx` line 241-244: `{resp.details_a2ui && <A2UISurface jsonl={resp.details_a2ui} />}` |
| 11 | Null or absent details_a2ui renders nothing (no error, no empty box) | ✓ VERIFIED | `A2UISurface.tsx` line 19: `if (!jsonl) return null`; `a2ui-element.ts` line 113: `if (!this._jsonl) return html\`\`` |
| 12 | Custom element `<a2ui-surface>` is registered once at app boot | ✓ VERIFIED | `a2ui-element.ts` line 135-136: `if (!customElements.get("a2ui-surface")) customElements.define(...)` |
| 13 | details_a2ui preserved through parseStoredMessage round-trip | ✓ VERIFIED | `ChatScreen.tsx` line 440: `response: parsed as CoachingResponse` — `CoachingResponse` now has `details_a2ui?: string \| null` |
| 14 | Microphone button appears in ChatScreen input area on browsers with Web Speech API support | ✓ VERIFIED | `ChatScreen.tsx` line 764: `{isSttAvailable && (<Button ...>` with `Mic` icon |
| 15 | Microphone button is hidden (not rendered) when Web Speech API is unavailable (VOIC-02) | ✓ VERIFIED | Conditional render `{isSttAvailable && ...}` — button is absent, not disabled, when `isAvailable=false` |
| 16 | Each non-welcome assistant bubble has a speaker play button | ✓ VERIFIED | `ChatScreen.tsx` line 213: `AssistantBubble` accepts `locale` prop; line 729: `<AssistantBubble msg={msg} locale={locale} />`; `VoicePlayButton` rendered for every message with `content` |
| 17 | On 503 from backend, TTS playback silently falls back to window.speechSynthesis | ✓ VERIFIED | `useTTS.ts` lines 65-68: catch block calls `_fallbackSpeak(text, locale, ...)` on any `fetchTTSAudio` throw; `_fallbackSpeak` checks `speechSynthesis` availability |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/app/coaching/tts.py` | TTSService with speak(), lazy ElevenLabs import, sentence-boundary truncation | ✓ VERIFIED | 53 lines; `TTSService`, `TTSUnavailableError`, `_truncate_at_sentence`; lazy `from elevenlabs import ElevenLabs` inside `speak()` |
| `api/tests/test_tts.py` | Unit tests for 200/503 behavior, text truncation, auth guard | ✓ VERIFIED | 187 lines; `test_tts_returns_audio_when_key_set`, `test_tts_endpoint_returns_503_when_no_key`, `test_tts_endpoint_returns_401_when_unauthenticated`, 4 truncation tests; 11/11 pass |
| `api/app/coaching/schemas/coaching_response.schema.json` | Updated JSON schema with details_a2ui optional field | ✓ VERIFIED | Lines 86-89: `"details_a2ui": {"type": ["string", "null"]}` in properties, absent from required |
| `api/app/coaching/prompts/response_format.j2` | Voice-optimised message instructions + A2UI injection | ✓ VERIFIED | Contains `VOICE-OPTIMISED`, `NO exact decimal numbers`, `{{ a2ui_reference }}` variable injection |
| `api/app/coaching/prompts/a2ui_reference.j2` | A2UI component reference for LLM | ✓ VERIFIED | Contains `surfaceUpdate`, `dataModelUpdate`, `beginRendering`, financial breakdown example |
| `api/app/schemas/coaching.py` | CoachingResponseDTO with details_a2ui field | ✓ VERIFIED | Line 72: `details_a2ui: Optional[str] = None` |
| `senso/src/components/a2ui-element.ts` | Lit custom element `<a2ui-surface>` with card/textField/text/timeline/button rendering | ✓ VERIFIED | 137 lines; manual getter/setter pattern (erasableSyntaxOnly compatible); `customElements.define` guard |
| `senso/src/components/A2UISurface.tsx` | React wrapper with useRef/useEffect property assignment; null-safe | ✓ VERIFIED | 22 lines; `useRef`, `useEffect`, `ref.current.jsonl = jsonl ?? null`; `if (!jsonl) return null` |
| `senso/src/features/coaching/useVoiceInput.ts` | useVoiceInput hook — feature detection, recording control, live transcript, error handling | ✓ VERIFIED | 161 lines; `window.SpeechRecognition ?? window.webkitSpeechRecognition`; exports `isAvailable`, `isRecording`, `transcript`, `error`, `startRecording`, `stopRecording` |
| `senso/src/features/coaching/useTTS.ts` | useTTS hook — ElevenLabs primary + speechSynthesis fallback, ObjectURL lifecycle | ✓ VERIFIED | 94 lines; `fetchTTSAudio` primary, `_fallbackSpeak` on catch; `URL.revokeObjectURL` on stop/onended/onerror/unmount |
| `senso/src/features/coaching/coachingApi.ts` | fetchTTSAudio(text, locale) using native fetch returning Blob | ✓ VERIFIED | Line 232: `async function fetchTTSAudio(text, locale)` using native `fetch()` (not `apiRequest`); returns `resp.blob()`; throws `CoachingApiError("tts_unavailable", ..., 503)` |
| `senso/src/features/coaching/ChatScreen.tsx` | VoicePlayButton, useTTS, useVoiceInput, A2UISurface all wired | ✓ VERIFIED | Imports: `A2UISurface`, `useVoiceInput`, `useTTS`; `VoicePlayButton` component; `AssistantBubble` with `locale` prop; conditional mic button render |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/app/api/coaching.py` | `api/app/coaching/tts.py` | `TTSService` instantiation in POST /coaching/tts | ✓ WIRED | Line 26: `from app.coaching.tts import TTSService, TTSUnavailableError`; line 340: `svc = TTSService(...)` |
| `api/app/api/coaching.py` | `get_current_user` | `Depends(get_current_user)` auth guard | ✓ WIRED | Line 24: `from app.api.ingestion import get_current_user`; line 336: `current_user: UserDTO = Depends(get_current_user)` |
| `api/app/coaching/prompts/response_format.j2` | `api/app/coaching/prompts/a2ui_reference.j2` | Jinja2 variable injection in CoachingService | ✓ WIRED | `response_format.j2` line 30: `{{ a2ui_reference }}`; `service.py` lines 80-81: loads `a2ui_reference.j2`; line 358: `a2ui_reference=self._a2ui_reference` |
| `api/app/coaching/service.py` | `api/app/coaching/prompts/a2ui_reference.j2` | Template variable injection at render time | ✓ WIRED | `service.py` line 80: `self._jinja_env.get_template("a2ui_reference.j2").render()`; injected at line 358 |
| `senso/src/components/A2UISurface.tsx` | `<a2ui-surface>` custom element | `useRef` + `useEffect` property assignment | ✓ WIRED | `A2UISurface.tsx` line 2: `import "./a2ui-element"`; line 15: `ref.current.jsonl = jsonl ?? null` |
| `senso/src/features/coaching/ChatScreen.tsx` | `senso/src/components/A2UISurface.tsx` | `import A2UISurface`; render in AssistantBubble | ✓ WIRED | `ChatScreen.tsx` line 4: `import { A2UISurface } from "@/components/A2UISurface"`; line 243: `<A2UISurface jsonl={resp.details_a2ui} />` |
| `senso/src/features/coaching/ChatScreen.tsx` | `senso/src/features/coaching/useVoiceInput.ts` | `useVoiceInput({ locale, onFinalTranscript: handleSend })` | ✓ WIRED | `ChatScreen.tsx` line 26: `import { useVoiceInput }`; line 657: `useVoiceInput({ locale, onFinalTranscript: handleSend })` |
| `useVoiceInput.ts` | SpeechRecognition API | `window.SpeechRecognition ?? window.webkitSpeechRecognition` | ✓ WIRED | Lines 87-88: `const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition; setIsAvailable(!!SR)` |
| `senso/src/features/coaching/ChatScreen.tsx` | `senso/src/features/coaching/useTTS.ts` | `useTTS()` in VoicePlayButton | ✓ WIRED | `ChatScreen.tsx` line 27: `import { useTTS }`; line 196: `const { canPlay, isPlaying, play, stop } = useTTS()` |
| `senso/src/features/coaching/useTTS.ts` | `senso/src/features/coaching/coachingApi.ts` | `fetchTTSAudio(text, locale)` | ✓ WIRED | `useTTS.ts` line 8: `import { fetchTTSAudio } from "./coachingApi"`; line 46: `const blob = await fetchTTSAudio(text, locale)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `A2UISurface` / `AssistantBubble` | `resp.details_a2ui` | LLM response via `CoachingService.chat()` → `CoachingResponseDTO.details_a2ui` | Real LLM output (opaque string passthrough) | ✓ FLOWING — backend schema + DTO both carry the field; frontend renders when non-null |
| `ChatScreen` textarea | `transcript` (STT) | `useVoiceInput` → `SpeechRecognition.onresult` | Browser mic input | ✓ FLOWING — `setTranscript(finalTranscriptRef.current + interim)` on each result event |
| `VoicePlayButton` audio | Audio `Blob` | `fetchTTSAudio` → `POST /coaching/tts` → `TTSService.speak()` → ElevenLabs | MP3 bytes from ElevenLabs (or speechSynthesis fallback) | ✓ FLOWING — returns `StreamingResponse(audio_bytes, media_type="audio/mpeg")` |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TTS unit tests (11 total) | `uv run pytest tests/test_tts.py -x -q` | `11 passed in 3.60s` | ✓ PASS |
| TTS + coaching integration (31 total) | `uv run pytest tests/test_tts.py tests/test_coaching_endpoints.py -q` | `31 passed, 1 warning in 17.01s` | ✓ PASS |
| Frontend TypeScript build | `pnpm build` | `✓ built in 5.16s` — zero TS errors | ✓ PASS |
| Lazy ElevenLabs import | Grep for `from elevenlabs import` inside `speak()` body | Found at `tts.py:38` inside method, not module top | ✓ PASS |
| Sentence-boundary truncation | 4 unit tests covering all cases | All pass | ✓ PASS |
| VOIC-02 compliance | `{isSttAvailable &&` conditional render (not disabled) | `ChatScreen.tsx:764` | ✓ PASS |
| ObjectURL revocation on stop | `URL.revokeObjectURL` in `stop()`, `audio.onended`, `audio.onerror`, unmount | All 4 paths present in `useTTS.ts` | ✓ PASS |
| VoicePlayButton hidden when canPlay=false | `if (!canPlay) return null` | `ChatScreen.tsx:197` | ✓ PASS |
| `<a2ui-surface>` registration guard | `if (!customElements.get("a2ui-surface"))` | `a2ui-element.ts:135` | ✓ PASS |
| All phase 5 commits exist | git log grep for 9 commit hashes | All 9 found: `57fae50 e5c445c 2194719 282641f 2a9c0d9 b17d6b4 dad0a6c 573603b de66ebd` | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VOIC-01 | 05-01, 05-04, 05-05 | AI can return spoken output for each coaching response | ✓ SATISFIED | `POST /coaching/tts` endpoint; `useTTS` hook with ElevenLabs + speechSynthesis; `VoicePlayButton` in every `AssistantBubble` |
| VOIC-02 | 05-04, 05-05 | If browser speech recognition fails or is unavailable, user can continue with typed input | ✓ SATISFIED | `useVoiceInput.isAvailable` controls conditional render of mic button (`{isSttAvailable && ...}`); text input never disabled by STT availability; `VoicePlayButton` returns null when `!canPlay` |
| COCH-02 | 05-02, 05-03 | User can ask a purchase/decision question by voice input | ✓ SATISFIED | Dual-channel response shape with voice-optimised `message` + `details_a2ui`; `A2UISurface` Lit renderer wired into `AssistantBubble`; LLM prompt updated with A2UI reference and voice-optimised instructions |

**All 3 required requirements satisfied. No orphaned requirements detected.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `a2ui-element.ts` | n/a | `renders, not yet wired` comment on button action (by design — Phase 6 deferred) | ℹ️ Info | Buttons render but action is a no-op. Explicitly deferred to Phase 6 per CONTEXT.md. Not a stub — the rendering itself is functional. |
| `useTTS.ts` | 23 | `canPlay` computed at render time (not in `useState`) | ℹ️ Info | Not a bug — `speechSynthesis` availability doesn't change during a session. Correct pattern. |

**No blockers. No warnings. All stub patterns checked and confirmed non-stubs.**

---

### Human Verification Required

#### 1. Voice Input (STT) End-to-End

**Test:** In Chrome or Safari, open ChatScreen with a confirmed financial profile. Click the mic button (left of textarea), speak "Posso comprare un iPhone?" and stop speaking.
**Expected:** Live transcript appears in the textarea; after silence/stop, the text is submitted as a coaching question; an AI response appears within a few seconds.
**Why human:** Web Speech API requires browser microphone access; no way to simulate actual audio capture in automated checks.

#### 2. ElevenLabs TTS Playback

**Test:** With `ELEVENLABS_API_KEY` set in `.env`, receive an AI coaching response and click the Volume2 play button on the AssistantBubble.
**Expected:** Spoken MP3 audio plays aloud; button icon switches to Square; clicking Stop immediately halts playback; ObjectURL is cleaned up.
**Why human:** Requires live browser audio context, real ElevenLabs API key, and audible output verification.

#### 3. speechSynthesis Fallback

**Test:** With `ELEVENLABS_API_KEY` absent (or set to empty), receive a coaching response and click the play button.
**Expected:** Browser's built-in voice (Italian `it-IT`) speaks the message text silently falling back; no error message shown to user; play button still behaves normally.
**Why human:** Requires runtime 503 response from /coaching/tts and browser audio output to verify.

#### 4. A2UI Detail Panel Render

**Test:** Ask a financial question that should trigger a structured breakdown (e.g., "Quanto posso spendere ogni mese?"). Inspect the AssistantBubble.
**Expected:** Below the spoken message text, a card panel appears with labelled financial fields (e.g., "Reddito mensile netto", "Margine disponibile") if the LLM emits `details_a2ui`. If LLM emits null, no panel appears (no error).
**Why human:** Depends on LLM compliance with A2UI prompt instructions; requires live Gemini/OpenAI API call to verify actual JSONL emission.

---

### Gaps Summary

**No gaps.** All 17 observable truths are verified. All 12 artifacts exist, are substantive, and are wired. All 10 key links are confirmed active. All 3 phase requirements (COCH-02, VOIC-01, VOIC-02) are satisfied.

The only outstanding items are 4 human verification items requiring live browser/API interaction that cannot be verified programmatically. These do not block the phase — they are confirmation steps for already-wired functionality.

---

### Configuration Notes

The following environment variables are required for full runtime functionality (not needed for automated test pass):

- `ELEVENLABS_API_KEY` — required for ElevenLabs TTS. If absent, POST /coaching/tts returns 503 and frontend falls back to `speechSynthesis` (by design).
- `ELEVENLABS_VOICE_ID` — optional; defaults to `pNInz6obpgDQGcFmaJgB` (Adam/English). Recommend replacing with an Italian voice ID for production.

---

_Verified: 2026-03-28T17:00:00Z_
_Verifier: the agent (gsd-verifier)_
