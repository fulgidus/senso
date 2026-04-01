---
created: "2026-04-01T18:59:18.910Z"
title: Add merchant vs private individual check in manual categorization
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

When manually categorizing transactions, the system doesn't ask whether the counterpart is a merchant/shop/company or a private individual. This is a privacy concern: we must NOT save private individuals' PII from transaction recipients into the common knowledge / crowdsourced merchant map.

## Solution

- Add a "Is this a business or a person?" prompt before saving manual categorizations.
- If "person/private individual" is selected, do NOT contribute to the shared merchant map.
- Private categorizations should be saved locally to the user's profile only.
- This is a privacy-critical fix that should be prioritized.
