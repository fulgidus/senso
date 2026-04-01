---
created: "2026-04-01T18:59:18.910Z"
title: Fix missing translations in content management
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

Content management admin page has missing translations everywhere. Raw i18n keys are showing instead of translated strings.

## Solution

- Audit all i18n keys used in the content management admin UI.
- Add missing translations to both `it.json` and `en.json`.
- Specifically noted: `admin.content.colLocale` and `admin.content.colActions` keys are missing.
