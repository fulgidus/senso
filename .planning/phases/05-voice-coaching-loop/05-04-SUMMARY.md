---
phase: 05-voice-coaching-loop
plan: 04
subsystem: ui
tags: [voice, stt, web-speech-api, react-hook, coaching]

# Dependency graph
requires:
  - phase: 04-coaching-pipeline
    provides: ChatScreen with handleSend and coaching API integration

provides:
  - useVoiceInput hook with Web Speech API feature detection and recording control
  - Mic button in ChatScreen input area (hidden when STT unavailable, VOIC-02)
  - Live transcript display in textarea while recording
  - STT error toast with 4s auto-dismiss
  - onFinalTranscript wiring to handleSend for seamless voice-to-coaching flow

affects:
  - 05-05-TTS (uses ChatScreen input area layout established here)
  - 05-03-A2UI (ChatScreen now imports from useVoiceInput - may need to coordinate imports)

# Tech tracking
tech-stack:
  added:
    - "@testing-library/react ^16.3.2 (devDependency)"
    - "@testing-library/user-event ^14.6.1 (devDependency)"
  patterns:
    - "Web Speech API feature detection at hook mount time via window.SpeechRecognition ?? window.webkitSpeechRecognition"
    - "Callback ref pattern (onFinalRef) to avoid stale closure issues in async recognition handlers"
    - "Conditional render (not disabled) for unavailable features - VOIC-02 compliance pattern"

key-files:
  created:
    - senso/src/features/coaching/useVoiceInput.ts
    - senso/src/features/coaching/useVoiceInput.test.ts
  modified:
    - senso/src/features/coaching/ChatScreen.tsx

key-decisions:
  - "Custom Web Speech API type declarations instead of relying on TypeScript DOM lib (not present in all TS versions)"
  - "handleSend refactored to useCallback with optional text param - enables direct voice transcript submission"
  - "Mic button uses conditional render (not disabled) per VOIC-02 - no broken UI when STT unavailable"
  - "Callback ref pattern (onFinalRef.current) in useVoiceInput keeps onFinalTranscript fresh without re-creating recognition handlers"

patterns-established:
  - "VOIC-02 pattern: feature buttons are hidden (not rendered) when browser API unavailable - use {isAvailable && <Button/>}"
  - "useVoiceInput hook: standard hook interface for browser media APIs (detect, record, callback)"

requirements-completed: [VOIC-01, VOIC-02]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 5 Plan 04: Frontend Voice Input (STT) Summary

**`useVoiceInput` hook wrapping Web Speech API with mic button in ChatScreen input area - feature-detects SpeechRecognition on mount and hides button when unavailable (VOIC-02)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T15:01:45Z
- **Completed:** 2026-03-28T15:07:53Z
- **Tasks:** 2
- **Files modified:** 3 (created 2, modified 1)

## Accomplishments
- `useVoiceInput.ts` hook: feature detection, recording control, live transcript, error handling, cleanup on unmount
- 11 vitest tests covering feature detection (3 cases) and recording state (5 cases) - all passing
- ChatScreen: mic button to left of textarea, pulsing red when recording, Square stop icon, live transcript in disabled textarea
- STT error toast (inline below input) auto-dismisses after 4s - text input stays active throughout
- `handleSend` refactored to `useCallback` with optional `text` param for voice transcript submission
- VOIC-02: mic button not rendered at all when `isSttAvailable === false`

## Task Commits

Each task was committed atomically:

1. **Task 1: useVoiceInput hook** - `b17d6b4` (feat)
2. **[Rule 3 - Blocking] Install @testing-library/react** - `11d280d` (chore)
3. **Task 2: Wire mic button into ChatScreen** - `dad0a6c` (feat)

## Files Created/Modified
- `senso/src/features/coaching/useVoiceInput.ts` - Web Speech API hook with custom type declarations
- `senso/src/features/coaching/useVoiceInput.test.ts` - 11 vitest tests for feature detection and recording state
- `senso/src/features/coaching/ChatScreen.tsx` - Added mic button, STT error toast, live transcript display

## Decisions Made
- Used custom Web Speech API interface declarations (`ISpeechRecognition`, `ISpeechRecognitionConstructor`) instead of relying on TS DOM lib types — more explicit, TypeScript 5.x compatible.
- `handleSend` refactored from plain `async` function to `useCallback` with optional `text` param — required for `onFinalTranscript` callback pattern.
- Mic button uses conditional render `{isSttAvailable && <Button>}` not `disabled` — VOIC-02 compliance, no confusing broken UI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @testing-library/react for hook tests**
- **Found during:** Task 1 (useVoiceInput test file)
- **Issue:** `@testing-library/react` not in devDependencies; test import failed with "Failed to resolve import"
- **Fix:** `pnpm add -D @testing-library/react @testing-library/user-event`
- **Files modified:** senso/package.json, senso/pnpm-lock.yaml
- **Verification:** Tests pass after install
- **Committed in:** `11d280d`

**2. [Rule 1 - Bug] Custom Web Speech API type declarations**
- **Found during:** Task 1 (pnpm build TypeScript compile)
- **Issue:** TypeScript tsconfig.app.json `lib: ["ES2022", "DOM", "DOM.Iterable"]` doesn't include `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent` globals — TS errors TS2304/TS2552
- **Fix:** Added explicit interface declarations (`ISpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`, etc.) directly in `useVoiceInput.ts`
- **Files modified:** senso/src/features/coaching/useVoiceInput.ts
- **Verification:** `tsc --noEmit` on coaching files shows zero errors
- **Committed in:** `b17d6b4`

**3. [Rule 1 - Bug] Removed pre-existing unused `LLMCallTrace` import in ChatScreen**
- **Found during:** Task 2 (modifying ChatScreen.tsx)
- **Issue:** `type LLMCallTrace` was imported but never used — pre-existing TS6133 error
- **Fix:** Removed the unused import during Task 2 edit
- **Files modified:** senso/src/features/coaching/ChatScreen.tsx
- **Committed in:** `dad0a6c`

---

**Total deviations:** 3 auto-fixed (1 blocking dependency, 1 bug, 1 bug/cleanup)
**Impact on plan:** All necessary for compilation and correctness. No scope creep.

## Issues Encountered
- `vi.fn()` is not a valid constructor for mocking Web Speech API — needed to use a real `function` constructor pattern with `function MockSpeechRecognition(this: ...)` to satisfy `new SR()` call in hook.
- `SpeechRecognitionResultList` mock had to be array-like (`Object.assign([result], {length: 1})`) for the `for` loop `event.results[i]` access pattern to work.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Voice input complete: user can click mic, speak, and have the transcript submitted as a coaching message
- ChatScreen ready for 05-05 TTS integration (play button in AssistantBubble)
- Pre-existing TypeScript errors in AppShell.tsx and profile-api.ts (unused variables) not addressed — out of scope per plan deviation rules

---
*Phase: 05-voice-coaching-loop*
*Completed: 2026-03-28*
