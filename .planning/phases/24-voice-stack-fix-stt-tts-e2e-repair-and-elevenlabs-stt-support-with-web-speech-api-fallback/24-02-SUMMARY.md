---
plan: "24-02"
title: "E2E + audio fixtures + MediaRecorder regression tests"
status: complete
completed: "2026-04-10"
commit: 1be2e3cc
---

# Summary: Plan 24-02

## What was built

All 4 tasks completed:

1. **Audio fixtures** — `ffmpeg -f lavfi -i anullsrc` generated `silence-1s.mp3` (1304 bytes) and `speech-sample.webm` (996 bytes) in both `senso/e2e/fixtures/audio/` and `api/tests/fixtures/audio/`. Independent copies (no symlinks).

2. **`mockCoachingSTT` + `mockCoachingTTS`** — Appended to `senso/e2e/support/api-mocks.ts`. STT mock returns `{ text: transcript }` JSON; TTS mock returns minimal ID3v2 bytes as `audio/mpeg`. Both accept `Page` + optional override params.

3. **`voice-mode.spec.ts`** — 7 Playwright tests across 3 describe blocks:
   - Toggle group (3 tests): button visible, shows VoiceModeBar, exit restores textarea + D-11 regression re-entry
   - sttError display group (2 tests): no-speech soft error inline in VoiceModeBar; not-allowed hard error NOT inline
   - State transitions group (2 tests): idle status text on activation; mic button animate-pulse while held

4. **MediaRecorder regression tests** — 3 tests appended to `useVoiceInput.test.ts`:
   - `isAvailable` true when Web Speech absent but MediaRecorder present
   - POST `/coaching/stt` called on stop (stt-server-side-whisper.md regression)
   - `track.stop()` called after recording — no live stream held (stt-hold-to-speak-chromium regression)

## Key files

- `senso/e2e/fixtures/audio/silence-1s.mp3` + `speech-sample.webm` (new)
- `api/tests/fixtures/audio/silence-1s.mp3` + `speech-sample.webm` (new)
- `senso/e2e/support/api-mocks.ts` — +44 lines
- `senso/e2e/voice-mode.spec.ts` (new, 273 lines)
- `senso/src/features/coaching/useVoiceInput.test.ts` — +152 lines

## Self-Check: PASSED
