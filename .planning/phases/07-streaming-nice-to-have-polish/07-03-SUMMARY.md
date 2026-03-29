---
phase: 07-streaming-nice-to-have-polish
plan: "03"
subsystem: ui
tags: [react, vite, sse, coaching, streaming, i18n]
requires:
  - phase: 07-streaming-nice-to-have-polish
    provides: streaming SSE endpoint and validated final payload delivery from 07-02
provides:
  - fetch-based frontend SSE client for coaching chat
  - progressive in-bubble assistant streaming with silent full-response fallback
  - restored-session toast and near-bottom-only streaming autoscroll behavior
affects: [07-04 persona polish, final chat demo verification]
tech-stack:
  added: []
  patterns:
    - stream deltas into a real assistant bubble while waiting for final structured payload sections
    - silently recover from streaming failure by completing the same reply through the existing blocking chat path
key-files:
  created: []
  modified:
    - senso/src/features/coaching/coachingApi.ts
    - senso/src/features/coaching/ChatScreen.tsx
    - senso/src/i18n/locales/it.json
    - senso/src/i18n/locales/en.json
    - senso/Dockerfile
key-decisions:
  - "Frontend streaming uses authenticated fetch plus manual SSE parsing so chat keeps POST body and Bearer auth support without native EventSource limitations."
  - "Structured extras remain hidden until the final payload lands, while voice autoplay stays tied to the completed final message only."
patterns-established:
  - "Streaming UI pattern: append user message immediately, mount one assistant bubble shell, stream only message text, then attach cards/verdict/details when final arrives."
  - "Restore UX pattern: auto-open the newest conversation, show full history, then display one subtle auto-dismissing continuity toast."
requirements-completed: [COCH-05]
duration: 14min
completed: 2026-03-29
---

# Phase 7 Plan 03: Streaming chat UI and restore polish Summary

**Real-time assistant bubble streaming with silent fallback, restored-session continuity toast, and final-only voice playback timing**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-29T18:54:40Z
- **Completed:** 2026-03-29T19:09:45Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added a typed frontend SSE client for `/coaching/chat/stream` while preserving the existing blocking `sendMessage()` path as a silent fallback.
- Replaced the loading skeleton with a real assistant bubble that streams message text progressively and only reveals structured cards/details after the final payload arrives.
- Added restored-session continuity polish with a subtle auto-dismissing toast and near-bottom-only autoscroll during active streams.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a frontend SSE client with silent full-response fallback** - `f17675e` (feat)
2. **Task 2: Replace the loading skeleton with a real streaming bubble and restore toast UX** - `a088e61` (feat)

## Files Created/Modified
- `senso/src/features/coaching/coachingApi.ts` - added fetch-based SSE parsing and stream callback contract.
- `senso/src/features/coaching/ChatScreen.tsx` - streamed assistant text in a live bubble, restored session toast, and near-bottom autoscroll behavior.
- `senso/src/i18n/locales/it.json` - added streaming/restore chat copy in Italian.
- `senso/src/i18n/locales/en.json` - added streaming/restore chat copy in English.
- `senso/Dockerfile` - made the frontend runtime image usable for required Docker build verification commands.

## Decisions Made
- The streaming bubble keeps the current assistant message as the single visible focal point; cards, verdicts, and `details_a2ui` stay final-only to avoid noisy partial UI.
- Streaming fallback is silent and in-place: if SSE breaks before `final`, the same pending assistant bubble is completed by the existing blocking request path instead of surfacing a separate stream-specific error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworked ChatScreen streaming updates to avoid unsupported `findLastIndex()` usage**
- **Found during:** Task 2 verification
- **Issue:** The rebuilt Docker frontend image surfaced a TypeScript target mismatch because `findLastIndex()` is unavailable in the configured build target.
- **Fix:** Replaced `findLastIndex()` calls with a local helper that scans backward for the active streaming assistant bubble.
- **Files modified:** senso/src/features/coaching/ChatScreen.tsx
- **Verification:** `docker compose build frontend && docker compose run --rm frontend pnpm build`
- **Committed in:** `a088e61` (part of task implementation before commit)

**2. [Rule 3 - Blocking] Updated the frontend runtime image so Docker-based `pnpm build` verification could run inside the service container**
- **Found during:** Task 1 verification
- **Issue:** The `frontend` service image only contained nginx runtime assets, so mandated Docker verification commands had no `pnpm` binary or source tree available.
- **Fix:** Installed Node/npm + global pnpm in the runtime stage and copied `/app` from the builder image.
- **Files modified:** senso/Dockerfile
- **Verification:** `docker compose build frontend` and `docker compose run --rm frontend pnpm build`
- **Committed in:** `f17675e`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to complete Docker-based verification and keep the streaming UI changes shippable. No scope creep.

## Issues Encountered
- A large first-pass patch for `ChatScreen.tsx` failed to apply cleanly, so the streaming UI work was redone in smaller patches to keep the task atomic and verifiable.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Persona quick-switching and subtle per-message theming can now build directly on the streaming bubble and restored-history behavior.
- The remaining work is visual/persona polish plus manual UI verification of the full Phase 7 experience.

## Self-Check: PASSED

- Found summary file: `.planning/phases/07-streaming-nice-to-have-polish/07-03-SUMMARY.md`
- Found task commit: `f17675e`
- Found task commit: `a088e61`
