# Phase 24: Voice stack fix - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning (existing plans need review/replan against these decisions)

<domain>
## Phase Boundary

Fix the voice pipeline end-to-end: STT (Web Speech API primary, ElevenLabs Scribe server-side default, OpenAI Whisper server-side fallback), TTS (ElevenLabs primary, browser speechSynthesis fallback), and add reliable automated test coverage that confirms previously-broken scenarios are now fixed. Manual browser verification is NOT required — passing automated tests are the done criteria.

</domain>

<decisions>
## Implementation Decisions

### STT Error Observability
- **D-01:** `sttError` was reverted from `VoiceModeBar` by the ant colony as "debug pollution." It must be restored.
- **D-02:** Classification: **inline text in VoiceModeBar** for transient/soft errors (`no-speech`, transient network), **toast notification** for hard/blocking errors (`not-allowed`/mic denied, `stt_unavailable`/service not configured).
- **D-03:** Wiring: `sttError` passes through `useVoiceMode → ChatScreen → VoiceModeBar` (existing prop-drill pattern). ChatScreen decides inline-vs-toast based on error code, then passes the inline portion to VoiceModeBar.

### E2E Test Strategy
- **D-04:** Both Playwright UI tests (with mocked STT/TTS endpoints via `page.route()`) AND backend integration tests.
- **D-05:** A couple of real audio fixture files (mp3/webm) must be generated and stored in **both** locations:
  - `senso/e2e/fixtures/audio/` — for Playwright tests
  - `api/tests/fixtures/audio/` — for backend integration tests
  - Each test suite owns its own copy (no symlinks or cross-directory deps).
- **D-06:** Playwright tests cover UI behavior: button states, error display in VoiceModeBar, voice mode transitions (idle → recording → generating → playing). Not real microphone, mocked backend.

### ElevenLabs STT as Default
- **D-07:** `STT_PROVIDER=elevenlabs` stays as the default. ElevenLabs Scribe is preferred because it shares the `ELEVENLABS_API_KEY` with TTS — one key for both voice features.
- **D-08:** OpenAI Whisper (`STT_PROVIDER=openai`) is kept as a documented fallback option. Do NOT remove it.
- **D-09:** Add a test that explicitly verifies `STT_PROVIDER=elevenlabs` is the configured default (i.e., `get_settings().stt_provider == "elevenlabs"` when env var is absent).

### Verification / Done Criteria
- **D-10:** "Done" = all automated tests pass (Playwright + backend). No manual browser smoke test required.
- **D-11:** Write a regression test for each open debug session before closing it:
  - `stt-hold-to-speak-chromium-no-audio.md` → regression test confirming `micStreamRef` removal (no audio contention on Web Speech API)
  - `stt-server-side-whisper.md` → regression test confirming MediaRecorder + server-side STT path works
  - Tests passing = debug sessions closed as resolved.

### Agent's Discretion
- Exact toast component/duration for hard errors
- Specific wording of inline error messages in VoiceModeBar (i18n keys should be added for any new strings)
- Whether the regression tests use Playwright or backend-only, as appropriate per bug
- Audio fixture file format (mp3 vs webm) — use whatever Playwright and the backend accept most reliably

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Open debug sessions (read to understand what's broken and what fixes were applied)
- `.planning/debug/stt-hold-to-speak-chromium-no-audio.md` — Chromium hold-to-speak silent bug; core fix (micStreamRef removal) applied but observability patch reverted; unverified
- `.planning/debug/stt-server-side-whisper.md` — Server-side STT (ElevenLabs Scribe + Whisper); implemented and tested but awaiting human browser verify
- `.planning/debug/resolved/tts-422-voice-broken.md` — TTS 422 fix (message_id optional); confirmed resolved
- `.planning/debug/resolved/voice-mode-button-missing.md` — Voice mode button gating fix (canPlay not isSttAvailable); confirmed resolved

### Bug dump (original list of voice issues)
- `.planning/notes/2026-04-01-pwa-ux-bug-dump.md` — "tts is broken" entry + surrounding context

### Voice stack source files
- `senso/src/features/coaching/useVoiceInput.ts` — dual-backend STT hook (Web Speech API + MediaRecorder/Whisper)
- `senso/src/features/coaching/useTTS.ts` — TTS hook with ElevenLabs primary + speechSynthesis fallback
- `senso/src/features/coaching/useVoiceMode.ts` — orchestration hook (hold-to-talk, feedback loop prevention)
- `senso/src/features/coaching/VoiceModeBar.tsx` — voice mode UI bar (needs sttError prop restored)
- `api/app/api/coaching.py` — `/coaching/stt` and `/coaching/tts` endpoints
- `api/app/core/config.py` — `stt_provider` and `elevenlabs_api_key` config fields

### Existing tests (green baseline to preserve)
- `api/tests/test_stt_endpoint.py` — 11 tests covering both ElevenLabs and Whisper providers
- `api/tests/test_tts.py` — TTS unit + integration tests (some failing in 24-01 plans)
- `senso/src/features/coaching/useVoiceInput.test.ts` — frontend STT hook tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useVoiceInput.ts`: Already has `error: string | null` in its return type — the error string is computed, just not passed to VoiceModeBar. Restore the prop-drill, don't rewrite.
- `VoiceModeBar.tsx`: Has a status label area (`statusText` rendered as `<p>`) — inline error can slot into this existing pattern.
- `ChatScreen.tsx`: Already imports and renders `VoiceModeBar`. The `sttError` from `useVoiceMode` is already computed but not passed down. Minimal wiring needed.
- Existing toast system (check for shadcn `useToast` or similar in the codebase) — use for hard error toasts.

### Established Patterns
- Error classification: error code strings like `"not-allowed"`, `"network"`, `"stt_unavailable"`, `"no-speech"` are already defined in `useVoiceInput.ts` error message maps.
- i18n: All user-visible strings go in `senso/src/locales/it.json` and `en.json` — new error strings need keys there.
- Backend tests: `_register_and_login(client)` helper pattern is established in both `test_tts.py` and `test_stt_endpoint.py`.
- Playwright mocks: `page.route("**/coaching/stt", ...)` follows existing `api-mocks.ts` patterns.

### Integration Points
- `useVoiceMode.ts` returns `sttError` from `useVoiceInput` — it's already in the return type (`sttError: string | null`). ChatScreen just needs to consume it.
- Audio fixtures: Playwright's `page.route()` can return a `body: Buffer` from a real audio file to simulate STT upload responses.

</code_context>

<specifics>
## Specific Ideas

- "Generate a couple of audio mp3 files to store inside a fixtures folder" — small real audio clips (a few seconds of Italian speech or even silence with a word) for use as test fixtures.
- Both fixture locations own their copy (no cross-directory symlinks).
- The regression tests for the two open debug sessions should be specifically named so it's obvious what bug they guard against (e.g., `test_chromium_stt_no_audio_contention`, `test_media_recorder_whisper_fallback`).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 24-voice-stack-fix-stt-tts-e2e-repair-and-elevenlabs-stt-support-with-web-speech-api-fallback*
*Context gathered: 2026-04-10*
