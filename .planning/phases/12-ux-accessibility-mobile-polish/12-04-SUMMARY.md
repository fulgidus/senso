---
phase: 12-ux-accessibility-mobile-polish
plan: "04"
subsystem: ui
tags: [react, animation, gestures, mobile, pull-to-refresh, page-transition, hooks]

# Dependency graph
requires:
  - phase: 12-ux-accessibility-mobile-polish
    provides: useReducedMotion hook, useHapticFeedback hook, AppShell component, ChatScreen, ProfileScreen

provides:
  - PageTransition component with route-level fade (80ms out / 150ms in)
  - usePullToRefresh hook (80px threshold, haptic, reduced-motion guard)
  - Pull-to-refresh integration in ChatScreen and ProfileScreen
  - Smoother AppShell drawer (ease-out + overlay opacity transitions)

affects:
  - any plan adding new routes (PageTransition applies automatically via AppShell)
  - any plan modifying ChatScreen or ProfileScreen scroll containers

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PageTransition: wraps children in AppShell with opacity fade using useLocation to detect route changes"
    - "usePullToRefresh: touch-event hook returning RefCallback to merge with existing element refs"
    - "Merged ref pattern: combine useRef<T> with RefCallback<T> via explicit callback ref"

key-files:
  created:
    - senso/src/components/PageTransition.tsx
    - senso/src/hooks/usePullToRefresh.ts
  modified:
    - senso/src/components/AppShell.tsx
    - senso/src/features/coaching/ChatScreen.tsx
    - senso/src/features/profile/ProfileScreen.tsx

key-decisions:
  - "PageTransition keeps a displayChildren state and swaps content mid-fade to avoid transparent-during-navigate flash"
  - "Overlay changed from conditional render to always-rendered with opacity classes to enable CSS transition"
  - "ChatScreen uses a mergedListRef callback ref to combine scroll-tracking listRef with pullToRefresh.containerRef"
  - "ProfileScreen onRefresh re-fetches both getProfile and getProfileStatus, updating isStale accordingly"

patterns-established:
  - "Pull-to-refresh pattern: attach usePullToRefresh.containerRef via RefCallback, render Loader2 when isPulling || isRefreshing"
  - "Reduced-motion guard pattern: hooks check useReducedMotion and skip animation state while still triggering refresh"

requirements-completed: []

# Metrics
duration: ~30min
completed: 2026-04-01
---

# Phase 12 Plan 04: Animations & Pull-to-Refresh Summary

**Route-level fade transitions via PageTransition component and touch pull-to-refresh gesture in ChatScreen and ProfileScreen, with smoother AppShell drawer animations**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-01T13:30:00Z
- **Completed:** 2026-04-01T14:04:09Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Created `PageTransition` component wrapping AppShell's children with 80ms out / 150ms in opacity fade on route change; respects `prefers-reduced-motion`
- Created `usePullToRefresh` hook with 80px threshold, haptic feedback on trigger, and touch event management via RefCallback pattern
- Integrated pull-to-refresh into ChatScreen (reloads current session) and ProfileScreen (reloads profile + stale status)
- AppShell overlay now uses CSS opacity transition instead of conditional rendering, enabling smooth fade-in/out
- AppShell drawer gains `ease-out` easing for a more native-feeling slide

## Task Commits

Each task was committed atomically:

1. **Task 1: PageTransition + AppShell drawer enhancement** - `cf0dc7c` (feat)
2. **Task 2: usePullToRefresh + ChatScreen + ProfileScreen integration** - `166101d` (feat)

## Files Created/Modified
- `senso/src/components/PageTransition.tsx` - Route-level fade transition component using useLocation + useReducedMotion
- `senso/src/hooks/usePullToRefresh.ts` - Pull-to-refresh hook with touch events, threshold 80px, haptic feedback
- `senso/src/components/AppShell.tsx` - Added PageTransition wrapper, ease-out drawer, opacity-based overlay
- `senso/src/features/coaching/ChatScreen.tsx` - Merged ref pattern to attach pull-to-refresh, added pull indicator
- `senso/src/features/profile/ProfileScreen.tsx` - Pull-to-refresh on main container with profile+status reload

## Decisions Made
- **PageTransition displayChildren swap**: Component keeps a separate `displayChildren` state and swaps content at the 80ms mid-fade point, so new page content doesn't flash through a transparent layer.
- **Overlay as always-rendered**: Changing from `{drawerOpen && <div/>}` to always-rendered with `opacity-0 pointer-events-none` / `opacity-100` was necessary to allow CSS transitions (CSS can't transition elements that don't exist in DOM).
- **Merged ref pattern for ChatScreen**: `listRef.current = el; pullToRefresh.containerRef(el)` inside a `useCallback` — cleanest way to attach both the scroll-tracking ref and the touch-event hook to the same element.
- **ProfileScreen containerRef cast**: `usePullToRefresh.containerRef` is typed as `React.RefCallback<HTMLElement>` while `<main ref={...}>` expects `React.Ref<HTMLMainElement>`; cast via `as React.RefCallback<HTMLElement>` is safe since HTMLMainElement extends HTMLElement.

## Deviations from Plan

None - plan executed exactly as written. The noted discovery about `listRef` being a plain `useRef<HTMLDivElement>` (not a callback ref) was anticipated and handled with the merged callback ref pattern as suggested in the plan instructions.

## Issues Encountered

- **parseStoredMessage helper**: Initial implementation inline-mapped session messages to DisplayMessage with a `response` field that didn't exist on `SessionMessage`. Fixed immediately by using the existing `parseStoredMessage(m)` helper, which correctly handles JSON-stringified assistant responses. No deviation tracked (immediate resolution during implementation).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All animation and gesture polish from plan 12-04 is complete
- Phase 12 has one remaining plan (12-05) which can build on these patterns
- `usePullToRefresh` is reusable — other list screens can adopt the same RefCallback merge pattern

---
*Phase: 12-ux-accessibility-mobile-polish*
*Completed: 2026-04-01*

## Self-Check: PASSED
- `senso/src/components/PageTransition.tsx` ✓
- `senso/src/hooks/usePullToRefresh.ts` ✓
- `.planning/phases/12-ux-accessibility-mobile-polish/12-04-SUMMARY.md` ✓
- Commit `cf0dc7c` ✓
- Commit `166101d` ✓
