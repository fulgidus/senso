---
created: "2026-04-01T18:59:18.910Z"
title: Add hash navigation to profile sections
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

Refreshing the profile page always resets to the first section. There is no hash-based navigation, so the browser cannot restore the user's position after a refresh. URLs should be like `profile#files`, `profile#connectors`, `profile#timeline`, etc.

## Solution

- Add hash-based navigation to profile tabs/sections.
- On page load, read `window.location.hash` and navigate to the matching section.
- Update the hash when the user switches tabs.
- This also enables direct linking to specific profile sections.
