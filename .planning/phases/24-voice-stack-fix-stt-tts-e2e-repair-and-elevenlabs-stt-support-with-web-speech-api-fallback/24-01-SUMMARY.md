---
plan: "24-01"
title: "Backend fixes + sttError prop chain repair"
status: complete
completed: "2026-04-10"
commit: 613f1b85
---

# Summary: Plan 24-01

## What was built

All 6 tasks completed:

1. **Voice ID update** — `api/app/personas/config.json`: masculine → `NOpBlnGInO9m6vDvFkFC`, feminine/neutral → `OYTbf65OHHFELVut7v2H` in both `defaultPersonaSettings.any` and `mentore-saggio.it` buckets. Fixes 8 previously failing TTS tests.

2. **`errorCode` in `useVoiceInput`** — Added `errorCode: string | null` to `UseVoiceInputResult`; `setErrorCode` called in all 4 error paths (Web Speech `onerror`, MediaRecorder fetch catch, `getUserMedia` catch, and both reset preambles).

3. **`sttErrorCode` in `useVoiceMode`** — Threaded `errorCode: sttErrorCode` from `useVoiceInput` destructuring through `UseVoiceModeResult` interface and return statement.

4. **`sttError` prop in `VoiceModeBar`** — New optional `sttError` prop; `statusText` shows it as a final `else if` (below all state checks); status `<p>` uses `text-red-400` for soft errors vs `text-red-500` for recording state.

5. **D-02 routing in `ChatScreen`** — Module-level `STT_HARD_ERROR_CODES = Set(["not-allowed", "stt_unavailable"])`; `sttErrorCode` destructured from `useVoiceMode`; useEffect routes hard errors in voice mode to `showRestoreToast`, soft errors to inline `setSttErrorVisible`; `VoiceModeBar` receives `sttError` filtered to soft-only.

6. **D-09 + D-11 regression tests** — 3 new tests appended to `test_stt_endpoint.py`: default provider is `elevenlabs`, webm accepted (Chrome regression), ogg accepted (Firefox/LibreWolf regression).

## Key files

- `api/app/personas/config.json` — voice ID update
- `api/tests/test_tts.py` — aligned assertions
- `api/tests/test_stt_endpoint.py` — +3 regression tests (14 total)
- `senso/src/features/coaching/useVoiceInput.ts` — `errorCode` state
- `senso/src/features/coaching/useVoiceMode.ts` — `sttErrorCode` threaded
- `senso/src/features/coaching/VoiceModeBar.tsx` — `sttError` prop + inline display
- `senso/src/features/coaching/ChatScreen.tsx` — D-02 hard/soft routing

## Deviations

- User overrode planned voice IDs mid-task: `o4b57JYAECRMJyCEXyIE`/`8KInRSd4DtD5L5gK7itu`/`9rJyhPcU6dKFmhVRrfA9` → `NOpBlnGInO9m6vDvFkFC` (male) / `OYTbf65OHHFELVut7v2H` (female + neutral). Applied consistently to config.json and all test_tts.py assertions.

## Self-Check: PASSED
