---
created: "2026-04-01T18:59:18.910Z"
title: Add visible sort affordance to table column headers
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

Table column sorting is a hidden feature. There is no visual indication that columns are sortable — the only way to discover it is to hover with a mouse and notice the cursor changes. On mobile, this feature is virtually invisible.

## Solution

- Add sort indicator icons (▲/▼ or similar) next to sortable column headers.
- Show the current sort direction when active.
- Make the clickable area large enough for touch targets on mobile.
- Consider adding a "Sort by..." dropdown on mobile as an alternative.
