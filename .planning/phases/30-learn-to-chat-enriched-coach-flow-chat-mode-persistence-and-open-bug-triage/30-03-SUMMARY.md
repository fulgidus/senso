# Plan 30-03 SUMMARY: Settings Coach Picker — Dark Mode Colors + Instant Persistence

## Status: Complete

## What Was Built

Two targeted fixes to the Settings coach picker:

### 1. Theme-aware colors
The picker was using `const theme = persona.theme?.light` — hardcoded to light theme regardless of the user's color scheme. Fixed by:
- Exporting a shared `getPersonaTheme(persona, resolvedTheme)` function from `coachingApi.ts` (alongside the new `PersonaThemeMode` type)
- Deriving `resolvedTheme: "light" | "dark"` from the existing `useTheme()` hook in SettingsScreen
- Replacing `persona.theme?.light` with `getPersonaTheme(persona, resolvedTheme)` in the persona map

### 2. Instant auto-save
Coach selection previously only set local state — user had to hit Save. Fixed with:
- New `handlePersonaSelect(personaId)` callback: immediately calls `updateMe(token, { defaultPersonaId })` + `updateUser(updated)`, shows brief "Salvato" indicator
- `defaultPersonaId` removed from `isDirty` expression and `handleSave` — Save button now only covers voiceGender + voiceAutoListen
- `handleReset` updated to remove defaultPersonaId
- Persona picker buttons: `onClick` now calls `handlePersonaSelect`, cards disabled while `personaSaving`

## Key Files

### Modified
- `senso/src/features/settings/SettingsScreen.tsx` — theme-aware picker colors, handlePersonaSelect, removed defaultPersonaId from save/isDirty/reset
- `senso/src/features/coaching/coachingApi.ts` — exported `getPersonaTheme` + `PersonaThemeMode` type

## Commits

- `03799b77` — feat(phase-30-03): settings coach picker dark mode colors + instant auto-save persona selection

## Self-Check: PASSED

- `getPersonaTheme\|personaTheme` ≥ 4 lines in SettingsScreen: ✓ (5)
- No `persona.theme?.light` in SettingsScreen: ✓
- `resolvedTheme` ≥ 2 lines: ✓
- `handlePersonaSelect\|personaSaving\|personaSaved` ≥ 5 lines: ✓ (6)
- No `defaultPersonaId` in isDirty: ✓
- `defaultPersonaId` in handleSave updateMe: ✓ only in handlePersonaSelect
- `onClick.*handlePersonaSelect` ≥ 1 line: ✓
- `pnpm tsc --noEmit` exits 0: ✓
