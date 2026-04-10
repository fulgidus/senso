---
phase: "25"
plan: "25-01"
subsystem: frontend
tags: [mobile-ux, hooks, input, accessibility]
requires: []
provides: [useIsMobile-hook, mobile-enter-submit-removed-chatscreen]
affects: [senso/src/features/coaching/ChatScreen.tsx]
tech-stack:
  added: []
  patterns: [useSyncExternalStore media query hook]
key-files:
  created:
    - senso/src/hooks/useIsMobile.ts
  modified:
    - senso/src/features/coaching/ChatScreen.tsx
key-decisions:
  - useMediaQuery("(pointer: coarse)") for mobile detection — reliable across iOS/Android/desktop; iPads with Bluetooth mouse correctly report fine pointer
  - isMobile const placed near top of ChatScreen hooks (after useHapticFeedback) — co-located with other device-context hooks
requirements-completed: [D-01, D-02, D-03, D-04]
duration: "1 min"
completed: "2026-04-10T21:45:44Z"
---

# Phase 25 Plan 01: useIsMobile hook + ChatScreen + session rename Enter-submit removal Summary

**One-liner:** Added `useIsMobile()` hook using `(pointer: coarse)` media query and removed Enter-to-submit from ChatScreen textarea and session rename input on mobile devices.

**Duration:** 1 min | **Start:** 2026-04-10T21:44:12Z | **End:** 2026-04-10T21:45:44Z | **Tasks:** 3 | **Files:** 2

## Tasks Completed

| # | Task | Commit |
|---|------|--------|
| 1 | Create useIsMobile hook | 3e2fdb68 |
| 2 | Fix ChatScreen textarea handleKeyDown | a49b353c |
| 3 | Fix session rename input onKeyDown | dbae3f74 |

## What Was Built

- **`senso/src/hooks/useIsMobile.ts`** — new hook wrapping `useMediaQuery("(pointer: coarse)")`. Server-side snapshot defaults to `false` (desktop fallback). Follows `useReducedMotion` pattern.
- **`ChatScreen.tsx` — `handleKeyDown`** — added `!isMobile &&` guard so Enter submits only on desktop; on mobile the send button is the only submission path. Shift+Enter newline behavior unchanged.
- **`ChatScreen.tsx` — session rename `onKeyDown`** — added `!isMobile &&` guard on Enter-to-commit; on mobile users blur/tap away to commit. Escape cancel unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Next

Ready for Plan 25-02: ProfileSetupScreen + TagInput comma/Add button + i18n + build.

## Self-Check: PASSED
- `senso/src/hooks/useIsMobile.ts` exists ✓
- `useIsMobile` ≥2 matches in ChatScreen ✓
- `isMobile` used in `handleKeyDown` and session rename `onKeyDown` ✓
- All 3 commits present in git log ✓
