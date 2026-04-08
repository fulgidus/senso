---
plan: "22-02"
phase: "22"
status: complete
completed: "2026-04-08"
---

# Plan 22-02 Summary - Pull-to-Refresh: Extract Hook, Guard, Visual Indicator

## What Was Built

The `usePullToRefresh` hook already existed in `senso/src/hooks/usePullToRefresh.ts` with the correct iOS pattern: `{ passive: false }` on touchmove, `scrollTop > 0` guard, haptic feedback, and `useReducedMotion` support.

**Changes made:**

1. **`senso/src/features/coaching/ChatScreen.tsx`**:
   - Added `import { usePullToRefresh }` 
   - Added `handleChatRefresh` callback (reloads session messages via `getSessionMessages`)
   - Wired `usePullToRefresh({ onRefresh: handleChatRefresh, disabled: isLoading || loadingHistory })`
   - Merged PTR `containerRef` with `listRef` in `mergedListRef` callback
   - Added PTR visual indicator above messages: shows "Tira per aggiornare" while pulling, Loader2 + "Aggiornamento..." while refreshing

**ProfileScreen** already had PTR wired with visual indicator (verified, no changes needed).

## key-files

### modified
- senso/src/features/coaching/ChatScreen.tsx

## Self-Check: PASSED
- TypeScript compiles without errors
- usePullToRefresh already has { passive: false } (grep confirmed)
- scrollTop > 0 guard is first check in touchmove (verified in existing hook)
- Visual indicator added and conditional on ptr.isPulling || ptr.isRefreshing
