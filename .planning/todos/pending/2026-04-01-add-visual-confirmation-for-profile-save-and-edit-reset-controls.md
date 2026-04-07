---
created: "2026-04-01T18:59:18.910Z"
title: Add visual confirmation for profile save and edit/reset controls
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

Three related issues with the profile save/edit flow:
1. The "Save" button on profile figures never changes state - no visual confirmation that the values have been saved/confirmed by the system.
2. There is no button to edit or reset figures back to the auto-calculated value.
3. The auto-calculated value should always be visible as a reference point (showing the margin of error between user opinion and system evaluation).
4. "Save profile" is misleading phrasing - it should be something like "Override", "Annotate", "Set my figures", etc.

## Solution

- Add success state to the save button (e.g., checkmark, "Saved!" text, disabled state after save).
- Add an "Edit" / "Reset to auto-calculated" control next to each figure.
- Always display the system-calculated value alongside the user override.
- Rename the button label to something more accurate (e.g., "Conferma i tuoi dati" / "Imposta i tuoi valori").
