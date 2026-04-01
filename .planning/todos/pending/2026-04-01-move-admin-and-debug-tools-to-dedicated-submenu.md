---
created: "2026-04-01T18:59:18.910Z"
title: Move admin and debug tools to dedicated submenu
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

Admin and debug tools (reset, redigest, admin actions) are buried deep in the Settings page. They are hard to find and unintuitive to access. These tools should be immediately discoverable for admins/testers, not hidden behind unrelated user settings.

## Solution

- Create a dedicated admin/tools submenu or navigation entry (visible only to admin/tester roles).
- Group all non-standard tools and debug pages together.
- The submenu should be accessible from the main navigation, not nested inside Settings.
- Keep the Settings page clean with only actual user preferences.
