---
created: "2026-04-01T18:59:18.910Z"
title: Fix restart ingestion should navigate to monitoring section
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

When triggering "restart ingestion pipeline" from the admin tools, the user stays on the same page. They should be automatically navigated to the correct section where they can monitor the ingestion progress.

## Solution

- After triggering a pipeline restart, auto-navigate to the ingestion monitoring view (e.g., the files tab or an admin ingestion status panel).
- Show a toast/notification confirming the action was triggered.
