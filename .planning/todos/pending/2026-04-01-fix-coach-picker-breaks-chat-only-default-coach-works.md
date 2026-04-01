---
created: "2026-04-01T18:59:18.910Z"
title: Fix coach picker breaks chat — only default coach works
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

Selecting a non-default coach persona in the coach picker breaks the chat entirely. Only the default coach works. Phase 7 added persona support with `users.default_persona_id` and `PersonaDTO`, but something regressed.

## Solution

- Debug the persona selection flow: does the selected persona ID correctly propagate to the chat API call?
- Check if the backend's coaching service correctly loads non-default persona configs from `api/app/personas/config.json`.
- Verify the streaming endpoint handles persona switching correctly.
- Test each persona in `config.json` individually.
