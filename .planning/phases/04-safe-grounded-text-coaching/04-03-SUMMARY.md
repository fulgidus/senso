---
phase: 04-safe-grounded-text-coaching
plan: 03
subsystem: ui
tags: [react, typescript, tailwind, chat, coaching, nextjs]

# Dependency graph
requires:
  - phase: 04-02
    provides: POST /coaching/chat, GET /coaching/personas, GET /coaching/sessions endpoints
  - phase: 03-financial-profile-clarity
    provides: ProfileScreen + AuthedHome navigation shell
provides:
  - coachingApi.ts with sendMessage() and getPersonas() typed API functions
  - ChatScreen.tsx with full chat UI, structured response rendering, and error states
  - AuthedHome routing to chat screen (screen === "chat")
  - ProfileScreen "Chiedi al coach" CTA navigation to ChatScreen
affects:
  - phase-05-voice-coaching
  - phase-06-persona-picker-and-card-rendering

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CoachingApiError: typed error class with code/statusCode (erasableSyntaxOnly compatible - no constructor parameter properties)"
    - "apiRequest(API_BASE, path, options) - 3-arg signature pattern matches existing api-client.ts"
    - "Chat state: stateless client sends full message history on each POST; session_id managed by backend (D-09)"
    - "AssistantBubble with sub-components: ReasoningCard (collapsible), ActionCardStub, ResourceCardStub, LearnCardStub"

key-files:
  created:
    - senso/src/features/coaching/coachingApi.ts
    - senso/src/features/coaching/ChatScreen.tsx
  modified:
    - senso/src/features/auth/AuthedHome.tsx
    - senso/src/features/profile/ProfileScreen.tsx

key-decisions:
  - "Used 3-arg apiRequest(API_BASE, path, options) matching existing api-client.ts signature"
  - "CoachingApiError uses explicit property assignment (not constructor shorthand) due to erasableSyntaxOnly tsconfig constraint"
  - "ChatScreen sends full DisplayMessage history as ChatMessage[] on each request (stateless client per D-09)"
  - "Hardcoded persona mentore-saggio per D-01 (no picker in Phase 4)"

patterns-established:
  - "Feature API module pattern: const API_BASE at top, typed error class, typed functions using apiRequest"
  - "Collapsible ReasoningCard as transparent reasoning UX pattern"

requirements-completed: [COCH-01, COCH-03]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 4 Plan 03: Frontend Coaching Screen Summary

**React chat UI with coaching API client, structured response rendering (reasoning cards + stub action/resource/learn cards), and full navigation wiring from ProfileScreen CTA through ChatScreen and back**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-28T00:18:29Z
- **Completed:** 2026-03-28T00:21:09Z
- **Tasks:** 4 (Task 1: read patterns, Task 2: coachingApi.ts, Task 3: ChatScreen.tsx, Task 4: navigation wiring)
- **Files modified:** 4

## Accomplishments
- `coachingApi.ts`: typed API client with `sendMessage()` and `getPersonas()`, mapping HTTP errors to typed `CoachingApiError` codes
- `ChatScreen.tsx`: full chat UI with user/assistant bubbles, collapsible reasoning card, stub action/resource/learn card rows, all error states, Enter-to-send, auto-scroll
- `AuthedHome.tsx`: extended Screen type with `"chat"`, renders `<ChatScreen>` when active
- `ProfileScreen.tsx`: added `onNavigateToChat` prop and prominently placed `🦉 Chiedi al coach` CTA

## Task Commits

1. **Task 1: Read existing patterns** - no commit (analysis only)
2. **Task 2: coachingApi.ts** - `2909aef` (feat)
3. **Task 3: ChatScreen.tsx** - `c6f6b5f` (feat)
4. **Task 4: Navigation wiring** - `bc3d14d` (feat)

## Files Created/Modified
- `senso/src/features/coaching/coachingApi.ts` - API client: sendMessage(), getPersonas(), CoachingApiError, all types
- `senso/src/features/coaching/ChatScreen.tsx` - Chat UI with structured response rendering and error states
- `senso/src/features/auth/AuthedHome.tsx` - Added "chat" to Screen type, ChatScreen import and render branch
- `senso/src/features/profile/ProfileScreen.tsx` - Added onNavigateToChat prop and "Chiedi al coach" CTA

## Decisions Made
- Used `apiRequest(API_BASE, path, options)` 3-arg signature to match existing `api-client.ts` - plan's template showed 2-arg which would have been a type error
- `CoachingApiError` uses explicit property assignment instead of constructor parameter properties to comply with `erasableSyntaxOnly: true` in tsconfig (auto-fixed before first build attempt)
- Locale hardcoded to `"it"` in AuthedHome → ChatScreen per D-05 and Italian-first UI requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed apiRequest call signature mismatch**
- **Found during:** Task 2 (reading api-client.ts before writing coachingApi.ts)
- **Issue:** Plan template showed `apiRequest<T>(path, options)` 2-arg call, but actual `api-client.ts` requires `apiRequest<T>(baseUrl, path, options)` 3-arg signature
- **Fix:** Added `const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"` and used correct 3-arg call
- **Files modified:** senso/src/features/coaching/coachingApi.ts
- **Verification:** `pnpm build` succeeds, tsc --noEmit clean
- **Committed in:** `2909aef` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed CoachingApiError constructor for erasableSyntaxOnly**
- **Found during:** Task 2 build verification
- **Issue:** TypeScript `erasableSyntaxOnly: true` in tsconfig.app.json forbids constructor parameter properties (`public readonly` shorthand). Build error: `TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled`
- **Fix:** Rewrote class to use explicit property declaration + manual assignment in constructor body
- **Files modified:** senso/src/features/coaching/coachingApi.ts
- **Verification:** `pnpm build` succeeds after fix
- **Committed in:** `2909aef` (Task 2 commit, included in same file)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- `tsc --noEmit` (used in plan's verify steps) doesn't invoke `tsc -b` composite project mode - `pnpm build` was used instead to catch all errors including `erasableSyntaxOnly` violations

## Known Stubs
- `ActionCardStub`, `ResourceCardStub`, `LearnCardStub` in ChatScreen.tsx are intentional stubs (title + description only, no deep interaction). These will be fully wired in Phase 6 (persona picker + card rendering).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend chat experience fully wired end-to-end: user can navigate ProfileScreen → ChatScreen → type a question → receive structured AI coaching response → tap back to ProfileScreen
- Phase 5 (voice) can add a microphone button to ChatScreen's input area and wire ElevenLabs TTS to the assistant bubble
- Phase 6 can replace stub card components with fully interactive versions

---
*Phase: 04-safe-grounded-text-coaching*
*Completed: 2026-03-28*
