---
created: "2026-04-01T18:59:18.910Z"
title: Fix total reset button broken
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The total reset button (admin action to reset the user's data) is broken. Clicking it does not perform the reset, likely an API error or frontend handler issue.

## Solution

- Debug the reset button click handler and the API endpoint it calls.
- Phase 6 established that FK CASCADE delete from users is sufficient for full reset — verify the cascade chain is intact.
- Verify the correct table names are used (uploads, chat_sessions, chat_messages per Phase 6 convention).
- Add error handling and feedback if the reset fails.
