---
created: "2026-04-01T18:59:18.910Z"
title: Replace locale and actions column headers with icons
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The "Locale" and "Actions" column headers in the content management table take up too much horizontal space as text labels. On mobile/narrow screens this makes the table even harder to use.

## Solution

- Replace `admin.content.colLocale` header with a globe/language icon.
- Replace `admin.content.colActions` header with a gear/ellipsis icon.
- Use tooltips on hover to show the full column name if needed.
