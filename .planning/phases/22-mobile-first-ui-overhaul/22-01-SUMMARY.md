---
plan: "22-01"
phase: "22"
status: complete
completed: "2026-04-08"
---

# Plan 22-01 Summary - ChatScreen: visualViewport Keyboard + Safe Area + Scroll Button

## What Was Built

1. **`senso/src/hooks/useKeyboardHeight.ts`** - New hook using `window.visualViewport` API (the only iOS Safari-reliable keyboard detection API). Returns keyboard height in pixels, listens to both `resize` and `scroll` events on `visualViewport`.

2. **`senso/index.html`** - Added `viewport-fit=cover` to the meta viewport tag (required for `env(safe-area-inset-bottom)` to work on iOS).

3. **`senso/src/features/coaching/ChatScreen.tsx`** - Multiple improvements:
   - Import `useKeyboardHeight` and `ChevronsDown` icon
   - Call `useKeyboardHeight()` → apply `paddingBottom: keyboardHeight + 12px` to input container when keyboard is open (iOS keyboard visibility fix)
   - `overscroll-none` → `overscroll-contain` on message list (fixes iOS momentum scroll)
   - Wrapped message list in `relative flex-1` container to enable absolute positioning of scroll button
   - Added `showScrollBtn` state tracking
   - `updateStickiness` now also calls `setShowScrollBtn(distanceFromBottom > 100)`
   - Added scroll-to-bottom button (ChevronsDown) that appears when >100px from bottom

4. **i18n keys added** (it.json + en.json):
   - `common.updating`: "Aggiornamento..." / "Updating..."
   - `common.pullToRefresh`: "Tira per aggiornare" / "Pull to refresh"
   - `coaching.scrollToBottom`: "Scorri in basso" / "Scroll to bottom"
   - `voice.recording`: "Registrazione..." / "Recording..."
   - `voice.holdToSpeak`: "Tieni premuto per parlare" / "Hold to speak"

## key-files

### created
- senso/src/hooks/useKeyboardHeight.ts

### modified
- senso/index.html
- senso/src/features/coaching/ChatScreen.tsx
- senso/src/i18n/locales/it.json
- senso/src/i18n/locales/en.json

## Self-Check: PASSED
- TypeScript compiles without errors (npx tsc --noEmit: no output)
- viewport-fit=cover present in index.html
- useKeyboardHeight exported from new file
- ChevronsDown imported, scroll button renders conditionally
