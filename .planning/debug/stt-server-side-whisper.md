---
status: awaiting_human_verify
trigger: "Implement server-side STT using OpenAI Whisper as a fallback for browsers that block Web Speech API (e.g. LibreWolf/Firefox)"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — LibreWolf blocks Web Speech API; MediaRecorder is universally available. Implemented full server-side Whisper STT fallback.
test: Backend tests (6/6 pass), frontend build (clean)
expecting: Voice input works on LibreWolf via Whisper transcription
next_action: Human verification in browser (LibreWolf or Firefox)

## Symptoms

expected: Voice input works on all browsers including LibreWolf (Firefox-based, blocks Web Speech API for privacy)
actual: On LibreWolf, isSttAvailable=false because window.SpeechRecognition is undefined (disabled by browser policy). Voice mode enters but mic button is disabled.
errors: "Riconoscimento vocale non disponibile in questo browser" shown in VoiceModeBar
reproduction: Open chat on LibreWolf, click voice mode toggle, see disabled mic button
started: Always (by design - LibreWolf blocks Web Speech API)

## Eliminated

- hypothesis: Problem could be fixed by browser flags
  evidence: LibreWolf intentionally disables Web Speech API; can't rely on flags
  timestamp: 2026-04-02T00:30:00Z

## Evidence

- timestamp: 2026-04-02T00:00:00Z
  checked: symptoms analysis
  found: window.SpeechRecognition is undefined in LibreWolf; MediaRecorder is available in all modern browsers
  implication: Need server-side transcription via Whisper as fallback path

- timestamp: 2026-04-02T00:30:00Z
  checked: api/app/api/coaching.py, api/app/core/llm_config.py
  found: LLM config uses LLM_OPENAI_API_KEY env var for OpenAI; openai SDK already in pyproject.toml; TTS uses ElevenLabs SDK directly in endpoint — same pattern acceptable for STT
  implication: Can instantiate OpenAI client directly in /coaching/stt endpoint using api_key from llm_config

- timestamp: 2026-04-02T00:45:00Z
  checked: senso/src/features/coaching/useVoiceInput.ts, useVoiceMode.ts, VoiceModeBar.tsx
  found: isAvailable propagates up cleanly; VoiceModeBar disables mic when !isSttAvailable
  implication: Only need to change useVoiceInput.ts to add MediaRecorder backend — all consumers update automatically

- timestamp: 2026-04-02T01:00:00Z
  checked: docker compose run --rm api uv run pytest tests/test_stt_endpoint.py -v
  found: 6/6 tests pass
  implication: Backend implementation correct

- timestamp: 2026-04-02T01:00:00Z
  checked: docker compose run --rm frontend pnpm build
  found: Build succeeds cleanly (tsc + vite)
  implication: TypeScript changes are type-safe

## Resolution

root_cause: Web Speech API is disabled by LibreWolf (privacy browser policy); useVoiceInput.ts only supported Web Speech API backend; no fallback existed
fix: Added POST /coaching/stt endpoint using OpenAI Whisper; rewrote useVoiceInput.ts with dual-backend architecture (Web Speech API preferred, MediaRecorder+Whisper fallback); isAvailable now returns true when MediaRecorder is available; added i18n strings for new error states
verification: Backend 6/6 tests pass; frontend builds clean
files_changed:
  - api/app/api/coaching.py
  - api/tests/test_stt_endpoint.py
  - senso/src/features/coaching/useVoiceInput.ts
  - senso/src/i18n/locales/it.json
  - senso/src/i18n/locales/en.json

---

## CHECKPOINT REACHED

**Type:** human-verify
**Debug Session:** .planning/debug/stt-server-side-whisper.md
**Progress:** 5 evidence entries, 1 hypothesis eliminated

### Investigation State

**Root Cause Confirmed:** LibreWolf disables `window.SpeechRecognition` for privacy. The hook only supported that single backend, so `isAvailable=false` on those browsers.

**Fix Summary:**
- Backend: Added `POST /coaching/stt` endpoint in `api/app/api/coaching.py` (lines 487–551) — accepts multipart audio, calls Whisper `whisper-1`, returns `{ text }`. Requires `LLM_OPENAI_API_KEY` in env; returns 503 if absent, 400 for empty audio, 502 for Whisper failure.
- Frontend: Rewrote `senso/src/features/coaching/useVoiceInput.ts` (all 270 lines) with dual-backend architecture:
  - Detects backend at mount: `web-speech` → `media-recorder` → `none`
  - `isAvailable` is `true` for either Web Speech API OR MediaRecorder (blocks only if neither)
  - MediaRecorder path records audio, sends multipart POST to `/coaching/stt`, returns final transcript
- i18n: Added 5 new keys (`voiceModeHintWhisper`, `sttTranscribing`, `sttErrorUnavailable`, `sttErrorEmpty`, `sttErrorFailed`) in both `it.json` and `en.json`

**Self-verified checks:**
- ✅ `docker compose run --rm api uv run pytest tests/test_stt_endpoint.py -v` → 6/6 passed
- ✅ `docker compose run --rm frontend pnpm build` → clean build (tsc + vite)
- ✅ All 23 existing coaching endpoint tests still pass

### How to verify in the browser

1. **On LibreWolf (or Firefox with `media.webspeech.recognition.enable=false`):**
   - Open the app and log in
   - Open a coaching chat session
   - Click the voice mode toggle (headset icon) — it should open without error (permission dialog appears)
   - **Expected:** Mic button is now ENABLED (was disabled before)
   - Hold the mic button and say something
   - Release the mic button
   - **Expected:** After ~1–2 seconds (Whisper transcription), the text appears in the chat input and is sent
   - The hint text below the mic should say "Tieni premuto il microfono per parlare" (not the "non disponibile" message)

2. **On Chrome/Edge (Web Speech API available) — regression check:**
   - Same flow — should still work with real-time interim transcripts (no change in behavior)
   - The `isAvailable` flag is still `true` and the preferred Web Speech API backend is used

3. **Backend requires `LLM_OPENAI_API_KEY`:**
   - If `LLM_OPENAI_API_KEY` is not set in `.env`, the `/coaching/stt` endpoint returns 503
   - The frontend will show the error "Servizio di trascrizione non disponibile."
   - Set `LLM_OPENAI_API_KEY=sk-...` in `.env` and restart to enable Whisper transcription

**Tell me:** "confirmed fixed" OR describe what's still failing
