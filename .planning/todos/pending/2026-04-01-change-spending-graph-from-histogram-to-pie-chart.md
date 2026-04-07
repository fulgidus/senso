---
created: "2026-04-01T18:59:18.910Z"
title: Change spending graph from histogram to pie chart
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The first spending breakdown graph is displayed as a histogram (bar chart), but it should be a pie chart. A pie chart is far more appropriate for showing spending category proportions - it visually communicates "parts of a whole" which is exactly what spending breakdown represents.

## Solution

- Replace the histogram/bar chart component with a pie/donut chart for the spending breakdown.
- Use a library already in the project or a lightweight chart library compatible with React.
- Keep the same data source; only the visual representation changes.
