---
created: "2026-04-01T18:59:18.910Z"
title: Rationalize coach renderable content surfaces
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

The mentor/coach can render different and weird content surfaces beyond text that are being misused. The set of renderable content types needs to be rationalized — there are too many different surfaces, and the LLM sometimes generates content for surfaces that don't render well or aren't appropriate for the context.

## Solution

- Audit all content surface types the coach currently supports (text, A2UI panels, resource cards, slide decks, video embeds, calculator, funnel, etc.).
- Define a clear, documented list of supported surface types with when each should be used.
- Update the LLM prompt to constrain which surfaces it can use.
- Remove or consolidate redundant/misused surface types.
