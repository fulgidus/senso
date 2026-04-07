---
created: "2026-04-01T18:59:18.910Z"
resolved: "2026-04-02"
commit: db6e06a
title: Fix financial profile figures never show ranges
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files:
  - senso/src/lib/profile-api.ts
  - senso/src/features/profile/ProfileScreen.tsx
  - senso/src/i18n/locales/en.json
  - senso/src/i18n/locales/it.json
---

## Problem

The final figures at the bottom of the main financial profile are always displayed as single values, never as ranges. The user specifically introduced ranges for both income and expenses (e.g., "between 1500 and 2000"), but the UI flattens them to a single number.

## Solution

- Check how the profile summary computes/displays income and expense figures.
- If the backend stores min/max or range data, the frontend must render it as a range (e.g., "€1,500 - €2,000").
- If the backend is collapsing ranges to a single value during aggregation, fix the aggregation logic.

## Resolution

Root cause: `profile-api.ts` types were missing `incomeMin`, `incomeMax`, `expenseMin`, `expenseMax` fields so the frontend couldn't read range data even when the backend returned it.

Fix:
- Added `incomeMin/Max` and `expenseMin/Max` fields to both the `IncomeSource` entry type and the top-level `UserProfile` type in `profile-api.ts`
- `ProfileScreen.tsx` now renders a `BalanceMask`-wrapped range line (e.g. "Fascia: €1.500 - €2.000") below the main figure when both min and max are non-null
- Added `profile.incomeRange` and `profile.expenseRange` i18n keys in `en.json` and `it.json`

Note: The save-button confirmation, edit/override controls, and "auto-calculated vs user annotation" UX remain as a separate todo (`add-visual-confirmation-for-profile-save-and-edit-reset-controls`).
