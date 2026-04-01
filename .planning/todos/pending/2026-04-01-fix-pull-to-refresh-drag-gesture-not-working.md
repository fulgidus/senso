---
created: "2026-04-01T18:59:18.910Z"
title: Fix pull-to-refresh drag gesture not working
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The pull-to-refresh (drag to update) gesture is not working well. Phase 12 added pull-to-refresh to ChatScreen with a merged callback ref pattern, but it may have regressions or may not be working on all surfaces/browsers.

## Solution

- Debug the touch event handler in ChatScreen's pull-to-refresh implementation.
- Test on mobile browsers (Chrome Android, Safari iOS).
- Verify the `pullToRefresh.containerRef` merged ref pattern is correctly attaching to the scroll container.
