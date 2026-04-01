---
created: "2026-04-01T18:59:18.910Z"
title: Fix financial profile figures never show ranges
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The final figures at the bottom of the main financial profile are always displayed as single values, never as ranges. The user specifically introduced ranges for both income and expenses (e.g., "between 1500 and 2000"), but the UI flattens them to a single number.

## Solution

- Check how the profile summary computes/displays income and expense figures.
- If the backend stores min/max or range data, the frontend must render it as a range (e.g., "€1,500 - €2,000").
- If the backend is collapsing ranges to a single value during aggregation, fix the aggregation logic.
