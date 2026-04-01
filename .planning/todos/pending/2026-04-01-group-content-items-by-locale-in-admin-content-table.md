---
created: "2026-04-01T18:59:18.910Z"
title: Group content items by locale in admin content table
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

In content management, content items for the same piece of content (different locales) get separated when sorting is applied. If sorted by title, the locale variant with the alphabetically first title ends up at the "helm" of the group based on the current locale's title. Items should remain grouped by content ID regardless of sort order.

## Solution

- Implement grouped rendering: content items that represent the same content in different locales should always stay together.
- Sorting should apply to the group (using the current locale's title as the sort key), not to individual rows.
- Visually indicate locale variants within a group (e.g., sub-rows, tabs, or locale badges within a single row).
