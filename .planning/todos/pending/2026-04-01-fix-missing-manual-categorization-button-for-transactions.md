---
created: "2026-04-01T18:59:18.910Z"
title: Fix missing manual categorization button for transactions
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The button to manually categorize transactions has disappeared. Users can no longer correct or override automatic categorization of their transactions.

## Solution

- Investigate why the manual categorization button was removed or hidden (check recent Phase 11/12 changes).
- Restore the categorization affordance in the transaction list/detail view.
- Ensure it integrates with the existing merchant map and category correction flow.
