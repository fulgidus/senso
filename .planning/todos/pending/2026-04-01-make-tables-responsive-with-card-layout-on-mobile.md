---
created: "2026-04-01T18:59:18.910Z"
title: Make tables responsive with card layout on mobile
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The merchant map page (and other tables throughout the app) are unusable on mobile. Wide table rows with many columns don't fit on small screens. This is a systemic issue - ALL tables in the app need a responsive strategy.

## Solution

- Implement a responsive table pattern: on mobile viewports, table rows should mutate into card layouts.
- At minimum, use multi-line rows where needed to prevent horizontal overflow.
- Create a reusable `ResponsiveTable` component or a CSS strategy that all tables can adopt.
- Priority targets: merchant map, content management, admin tables.
