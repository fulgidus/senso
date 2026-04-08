---
plan: "22-06"
phase: "22"
status: complete
completed: "2026-04-08"
---

# Plan 22-06 Summary - TTS Fix + Voice UX + STT Chromium

## What Was Built

1. **`senso/src/features/coaching/useTTS.ts`** - TTS autoplay policy handling:
   - Added `autoplayBlocked` state (true when `audio.play()` throws `NotAllowedError`)
   - Added `resumeAfterBlock()` callback: retries `audio.play()` after user gesture
   - Separated `audio.play()` into its own try/catch:
     - `NotAllowedError`: sets `autoplayBlocked=true`, keeps audio loaded (no fallback to speechSynthesis - audio is ready, just needs user gesture)
     - Other errors: cleanup blob URL and reset state
   - `audio.onended` and `audio.onerror` now also clear `autoplayBlocked`
   - Both `autoplayBlocked` and `resumeAfterBlock` exposed in return value

2. **`senso/src/features/coaching/ChatScreen.tsx`** - VoicePlayButton enhanced:
   - Destructure `autoplayBlocked` and `resumeAfterBlock` from `useTTS`
   - When `autoplayBlocked=true`: render a manual `▶ Play` button so user can unblock with gesture
   - Layout changed to `gap-1` to accommodate the optional manual play button

3. **`senso/src/features/coaching/useVoiceInput.ts`** - STT guard:
   - Added `if (isRecording) return` at start of `startRecording` callback
   - Prevents duplicate streams when second press occurs while already recording
   - `isRecording` added to dependency array

## Verification Notes
- ElevenLabs TTS pipeline was already correct: blob URL revoked on `onended`, not before play ✓
- `fetchTTSAudio` errors already handled with speechSynthesis fallback ✓
- VoiceModeBar already has `animate-pulse` on the mic button when `isRecording=true` ✓
- `useVoiceInput` already cleans up media tracks on unmount and `stopMediaRecorder` ✓
- Backend `tts.py` returns proper `audio/mpeg` and raises `TTSUnavailableError` on failure ✓

## key-files

### modified
- senso/src/features/coaching/useTTS.ts
- senso/src/features/coaching/ChatScreen.tsx
- senso/src/features/coaching/useVoiceInput.ts

## Self-Check: PASSED
- TypeScript compiles without errors
- autoplayBlocked state wired through useTTS → VoicePlayButton → manual play button
- isRecording guard added to startRecording (prevents duplicate streams)
- Blob URL lifecycle: revoked on onended, not before play
