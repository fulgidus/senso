---
created: "2026-04-01T18:59:18.910Z"
partially_resolved: "2026-04-02"
commit: db6e06a
title: Fix missing translations in content management
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files:
  - senso/src/i18n/locales/en.json
  - senso/src/i18n/locales/it.json
---

## Problem

Content management admin page has missing translations everywhere. Raw i18n keys are showing instead of translated strings.

## Solution

- Audit all i18n keys used in the content management admin UI.
- Add missing translations to both `it.json` and `en.json`.
- Specifically noted: `admin.content.colLocale` and `admin.content.colActions` keys are missing.

## Partial Resolution (2026-04-02, commit db6e06a)

Root cause found: **duplicate JSON keys** in both locale files. `content.admin.merchantMap` and `content.admin.moderation` were defined twice in each file (once near the top of the `content` object, and once again at the bottom - plus a separate top-level `admin` block). JSON parsers silently keep only the last definition, causing the first occurrence (which the UI components reference) to be shadowed and effectively invisible.

Fix: Deduplicated all three redundant occurrences - the single correct block now lives at `content.admin.merchantMap` / `content.admin.moderation`. Also fixed Unicode escapes (`\u2026` → `…`) and missing trailing newline.

Remaining work:
- `admin.content.colLocale` and `admin.content.colActions` key audit (replace with icon-only columns per original note)
- Full audit for any other missing keys in the admin content table UI
