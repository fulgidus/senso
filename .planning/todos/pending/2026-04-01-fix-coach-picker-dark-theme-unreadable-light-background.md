---
created: "2026-04-01T18:59:18.910Z"
title: Fix coach picker dark theme unreadable light background
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The settings coach picker has a light background when the dark theme is active, making the text unreadable. This is a dark mode CSS issue.

## Solution

- Fix the coach picker component's background color to use the correct theme token (e.g., `bg-background` or `bg-card` from the dark theme palette).
- Verify all text colors in the picker also adapt to dark mode.
