---
plan: 29-03
status: complete
wave: 2
completed_at: 2026-04-11
commits:
  - df2637a8
key-files:
  created:
    - senso/src/features/profile/PreferenzaTab.tsx
    - senso/src/i18n/locales/it.json
    - senso/src/i18n/locales/en.json
    - senso/src/features/profile/ProfileScreen.tsx
    - senso/src/features/settings/SettingsScreen.tsx
    - senso/src/features/profile/ProfileSetupScreen.tsx
    - senso/src/routes/SetupPage.tsx
---

# Plan 29-03 Summary: Frontend UI — ProfileScreen Carousel, PreferenzaTab, SettingsScreen Cleanup

## What was built

- **i18n keys** added: `profile.preferences.*` (30+ keys), `profile.tabs.prev/next`, `settings.preferencesMovedBody/Cta/nameMovedBody/Cta` in both `it.json` and `en.json`
- **PreferenzaTab.tsx** created: two sections — "Visibile all'AI" (unsealed demographics grid + goals/dos/donts TagInput) and "Solo per te" (sealed identity card with NaCl crypto). Sealed section shows lock card when cryptoKeys is null
- **ProfileScreen.tsx**: 
  - Mobile tab bar: replaced `grid-cols-2` with carousel (arrow buttons + swipe gesture)
  - Desktop tab bar: replaced `flex-wrap` with `overflow-x-auto` scrollable strip
  - Added "preferences" tab type and render
  - `location.state.tab` navigation for redirect from Settings
- **SettingsScreen.tsx**: removed TagInput/PreferencesSection functions, removed firstName/lastName state and form fields, added redirect cards for both (→ /profile?tab=preferences)
- **ProfileSetupScreen.tsx**: removed name step entirely; starts directly on voice gender selection
- **SetupPage.tsx**: updated onComplete signature and redirect guard

## Self-Check: PASSED
