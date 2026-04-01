---
created: "2026-04-01T18:59:18.910Z"
title: Add pagination to content management table
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The content management table has no pagination. As the content catalog grows, all items are rendered at once, which will cause performance issues and makes the table difficult to navigate.

## Solution

- Add pagination controls (previous/next, page numbers, items per page selector).
- Default to a reasonable page size (e.g., 20 items).
- Persist page size preference in local storage or user preferences.
