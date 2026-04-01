---
created: "2026-04-01T18:59:18.910Z"
title: Fix estimated_from_transactions nugget label missing i18n
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

A nugget/badge in the profile shows the raw string "estimated_from_transactions" instead of a localized human-readable label. Additionally, the tag is inaccurate — the user also completed the questionnaire, so the data source label should reflect combined sources, not just transactions.

## Solution

- Add i18n key for estimation source labels (e.g., `profile.source.estimated_from_transactions`, `profile.source.combined`).
- Fix the logic that determines the data source tag — should check if questionnaire data also contributed.
- Ensure all such system-generated labels go through the i18n pipeline.
