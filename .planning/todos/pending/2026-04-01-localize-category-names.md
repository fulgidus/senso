---
created: "2026-04-01T18:59:18.910Z"
title: Localize category names
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

Transaction category names are displayed as raw identifiers (likely English or system keys) instead of localized strings. This violates the i18n convention that all user-facing strings must go through the locale system.

## Solution

- Create i18n keys for all transaction categories in `it.json` and `en.json`.
- Update the category display logic to use `t('categories.<key>')` instead of raw values.
- Ensure new categories added via LLM categorization also get mapped to localized keys.
