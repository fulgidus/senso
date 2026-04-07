---
created: "2026-04-01T18:59:18.910Z"
title: Add error boundaries to profile pages
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The "profile/my-files" page breaks on entering and there are no error boundaries. When a page crashes, the user is stuck with a blank screen and can only recover by manually refreshing the browser. This is unacceptable UX - a crash in one section should not require a full page refresh.

## Solution

- Add React error boundaries around each major profile section (files, connectors, timeline, settings).
- The error boundary should display a friendly "Something went wrong" message with a "Retry" button.
- Wrap each route/tab content with its own boundary so a crash in one section doesn't take down the whole profile.
