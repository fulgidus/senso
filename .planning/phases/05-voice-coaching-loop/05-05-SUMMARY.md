---
phase: 05-voice-coaching-loop
plan: "05"
subsystem: ui
tags: [tts, elevenlabs, speech-synthesis, voice, react-hook, object-url]

requires:
  - phase: 05-01
    provides: POST /coaching/tts backend endpoint returning audio/mpeg
  - phase: 05-02
    provides: dual-channel response shape with voice-optimised message field

provides:
  - fetchTTSAudio() in coachingApi.ts using native fetch returning Blob
  - useTTS hook with canPlay/isPlaying/play/stop and ElevenLabs + speechSynthesis fallback
  - VoicePlayButton component in ChatScreen.tsx wired to every AssistantBubble
  - Memory-safe ObjectURL lifecycle (revoke on stop/unmount)

affects:
  - 06-persona-ui (voice output extends to persona-specific voices in Phase 6)
  - demo hardening

tech-stack:
  added: []
  patterns:
    - "useTTS hook: ElevenLabs primary via fetchTTSAudio, speechSynthesis fallback on 503/error"
    - "ObjectURL lifecycle: create on play, revoke on stop, cleanup on unmount"
    - "VoicePlayButton: locale-aware, hidden when canPlay=false, Volume2/Square icons for idle/playing states"

key-files:
  created:
    - senso/src/features/coaching/useTTS.ts
  modified:
    - senso/src/features/coaching/coachingApi.ts
    - senso/src/features/coaching/ChatScreen.tsx
    - senso/src/components/AppShell.tsx
    - senso/src/lib/profile-api.ts

key-decisions:
  - "fetchTTSAudio uses native fetch (not apiRequest) because response is binary audio/mpeg, not JSON"
  - "canPlay = true when speechSynthesis exists - ElevenLabs is optional, browser fallback ensures demo resilience"
  - "VoicePlayButton placed below message text with flex justify-end - non-intrusive placement"
  - "Fixed pre-existing unused variable errors in AppShell.tsx and profile-api.ts that blocked pnpm build"

requirements-completed: [VOIC-01, VOIC-02]

duration: 3min
completed: 2026-03-28
---

# Phase 05 Plan 05: Frontend Voice Output (TTS) Summary

**`useTTS` hook with ElevenLabs primary path + `speechSynthesis` fallback, `VoicePlayButton` in every `AssistantBubble`, and memory-safe `ObjectURL` lifecycle completing the full voice coaching loop**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T15:15:10Z
- **Completed:** 2026-03-28T15:18:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `fetchTTSAudio(text, locale)` added to `coachingApi.ts` - native `fetch()` returning `Blob`, throws `CoachingApiError("tts_unavailable", ..., 503)` on non-ok
- `useTTS.ts` created with `canPlay/isPlaying/play/stop` interface; ElevenLabs primary, `speechSynthesis` fallback on 503/network error; ObjectURL revoked on stop and unmount
- `VoicePlayButton` component wired into every `AssistantBubble` - `Volume2` icon when idle, `Square` when playing, hidden when `canPlay=false`
- `AssistantBubble` updated to accept `locale` prop, passed down from `ChatScreen` for TTS language selection
- Both `pnpm build` (frontend) and backend TTS tests (31 passed) verified clean

## Task Commits

Each task was committed atomically:

1. **Task 1: fetchTTSAudio + useTTS hook** - `573603b` (feat)
2. **Task 2: VoicePlayButton in AssistantBubble** - `de66ebd` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `senso/src/features/coaching/useTTS.ts` - New: useTTS hook with ElevenLabs primary + speechSynthesis fallback, ObjectURL lifecycle
- `senso/src/features/coaching/coachingApi.ts` - Added: `fetchTTSAudio()` using native fetch for binary audio response
- `senso/src/features/coaching/ChatScreen.tsx` - Added: `VoicePlayButton` component, `Volume2` import, `useTTS` import; `AssistantBubble` now accepts `locale` prop
- `senso/src/components/AppShell.tsx` - Fixed: removed unused `navigate`/`useNavigate` (pre-existing build error)
- `senso/src/lib/profile-api.ts` - Fixed: renamed unused `extraMonths` to `_extraMonths` parameter (pre-existing build error)

## Decisions Made

- Used native `fetch()` (not `apiRequest`) for `fetchTTSAudio` - `apiRequest<T>()` is JSON-typed; binary audio/mpeg requires `.blob()` call
- `canPlay` tied to `speechSynthesis` availability - ElevenLabs backend is optional; as long as browser synthesis exists, play button is shown (demo-resilient per D-V6)
- `VoicePlayButton` placed in a `flex justify-end mt-1` div below the message text for non-intrusive placement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing unused variable errors blocking pnpm build**
- **Found during:** Task 1 (first pnpm build after fetchTTSAudio/useTTS creation)
- **Issue:** Two pre-existing TypeScript errors: `navigate` declared but never used in `AppShell.tsx`; `extraMonths` parameter declared but unused in `profile-api.ts`
- **Fix:** Removed `navigate`/`useNavigate` from AppShell.tsx; renamed `extraMonths` → `_extraMonths` in profile-api.ts to signal intentional non-use
- **Files modified:** `senso/src/components/AppShell.tsx`, `senso/src/lib/profile-api.ts`
- **Verification:** `pnpm build` completed with zero errors
- **Committed in:** `573603b` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Pre-existing build errors had to be fixed to verify the new code. No scope creep - both fixes were minimal and mechanical.

## Issues Encountered

None - both tasks executed cleanly once pre-existing build errors were resolved.

## User Setup Required

None - no external service configuration required for the frontend changes. ElevenLabs key configuration is handled by the backend (05-01) and covered in that plan's setup.

## Next Phase Readiness

- Phase 5 voice coaching loop is now complete: voice input (05-04) + voice output (05-05) both delivered
- Full voice loop verified: mic button for STT input, play button for TTS output on each response
- Backend TTS endpoint (05-01) + dual-channel response shape (05-02) + A2UI renderer (05-03) all in place
- Ready for Phase 6 (persona UI) or demo hardening

---
*Phase: 05-voice-coaching-loop*
*Completed: 2026-03-28*

## Self-Check: PASSED

- `senso/src/features/coaching/useTTS.ts` - FOUND
- `senso/src/features/coaching/coachingApi.ts` - FOUND
- `senso/src/features/coaching/ChatScreen.tsx` - FOUND
- Commit `573603b` - FOUND
- Commit `de66ebd` - FOUND
