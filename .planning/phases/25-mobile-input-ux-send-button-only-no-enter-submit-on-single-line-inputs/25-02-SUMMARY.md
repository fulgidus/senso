---
phase: "25"
plan: "25-02"
subsystem: frontend
tags: [mobile-ux, i18n, input, profile, settings, accessibility]
requires: [useIsMobile-hook]
provides: [mobile-enter-submit-removed-profile, tagInput-comma-trigger, tagInput-mobile-add-button]
affects:
  - senso/src/features/profile/ProfileSetupScreen.tsx
  - senso/src/features/settings/SettingsScreen.tsx
  - senso/src/i18n/locales/it.json
  - senso/src/i18n/locales/en.json
tech-stack:
  added: []
  patterns: [conditional render by pointer type, comma key chip trigger]
key-files:
  created: []
  modified:
    - senso/src/features/profile/ProfileSetupScreen.tsx
    - senso/src/features/settings/SettingsScreen.tsx
    - senso/src/i18n/locales/it.json
    - senso/src/i18n/locales/en.json
key-decisions:
  - addChip() helper extracted to single source of truth for chip-add logic — avoids duplication between onKeyDown and button onClick
  - comma key triggers addChip on both desktop AND mobile (e.key === ",") — comma never appears in tag names; UX benefit on mobile physical keyboards
  - addButtonLabel is a required prop — forces all call sites to provide localised label; no silent fallback
  - addHint updated for both locales to mention comma — aligns hint text with actual keyboard behavior
requirements-completed: [D-01, D-02, D-06, D-07]
duration: "2 min"
completed: "2026-04-10T21:48:33Z"
---

# Phase 25 Plan 02: ProfileSetupScreen + TagInput comma/Add button + i18n + build Summary

**One-liner:** Completed mobile Enter-submit sweep for ProfileSetupScreen name inputs and SettingsScreen TagInput; added comma chip trigger, mobile Add button, and i18n keys; TypeScript build clean.

**Duration:** 2 min | **Start:** 2026-04-10T21:46:17Z | **End:** 2026-04-10T21:48:33Z | **Tasks:** 3 | **Files:** 4

## Tasks Completed

| # | Task | Commit |
|---|------|--------|
| 1 | Fix ProfileSetupScreen name input onKeyDown handlers | c7f9813e |
| 2 | Refactor TagInput in SettingsScreen (comma + mobile Add button) | 52324239 |
| 3 | Add i18n keys for new strings | 54a8b9e1 |

## What Was Built

- **`ProfileSetupScreen.tsx`** — imported `useIsMobile`, added `const isMobile = useIsMobile()`, guarded both firstName and lastName `onKeyDown` handlers with `!isMobile && e.key === "Enter"`.
- **`SettingsScreen.tsx` — `TagInput`** — added `addButtonLabel` required prop; `useIsMobile` import + call inside component; `addChip()` helper; `onKeyDown` now triggers on `","` OR `(!isMobile && "Enter")`; mobile Add button conditionally rendered below input.
- **`it.json`** — `preferences.addButton = "Aggiungi"`, `preferences.addHint` updated to mention virgola.
- **`en.json`** — `preferences.addButton = "Add"`, `preferences.addHint` updated to mention comma.
- **TypeScript build** — `npx tsc --noEmit` exits 0 across all Phase 25 changes.

## Deviations from Plan

None — plan executed exactly as written.

## Next

Phase 25 complete. All plans have summaries.

## Self-Check: PASSED
- `isMobile` used in both ProfileSetupScreen name input handlers ✓
- `useIsMobile` imported and used in SettingsScreen TagInput ✓
- comma key handler present in TagInput ✓
- `preferences.addButton` key in both locales ✓
- `addHint` updated in both locales ✓
- `npx tsc --noEmit` exits 0 ✓
