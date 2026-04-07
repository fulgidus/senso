---
phase: 11
plan: "04"
subsystem: "frontend/debug-ui, frontend/profile, backend/debug-api"
tags: [debug, connectors, profile-tabs, settings, admin, tester, i18n]
dependency_graph:
  requires: [11-03]
  provides: [connectors-tab, debug-screen, debug-api-endpoints]
  affects: [ProfileScreen, App, SettingsScreen]
tech_stack:
  added: []
  patterns:
    - "Role-gated routes: (user.isAdmin || user.role === 'tester' || user.role === 'admin')"
    - "Placeholder/coming-soon tab with 'Prossimamente' badge"
    - "callDebug helper pattern for debug API actions with confirmation gate"
key_files:
  created:
    - api/app/api/debug.py
    - senso/src/features/debug/DebugScreen.tsx
    - senso/src/features/profile/ConnectorsTab.tsx
  modified:
    - api/app/main.py
    - senso/src/App.tsx
    - senso/src/features/profile/ProfileScreen.tsx
    - senso/src/features/settings/SettingsScreen.tsx
    - senso/src/i18n/locales/it.json
    - senso/src/i18n/locales/en.json
decisions:
  - "ConnectorsTab is a placeholder (6 static bank cards, 'Prossimamente') - no live bank API integration yet"
  - "/debug route gated by isAdmin OR role==='tester' OR role==='admin' to match SettingsScreen visibility logic"
  - "Nuke action requires explicit window.confirm() before calling endpoint - destructive action guard"
metrics:
  duration: "~30min (continuation agent)"
  completed: "2026-04-01T11:15:45Z"
  tasks_completed: 2
  files_changed: 10
---

# Phase 11 Plan 04: Connectors UI, Debug Screen & Backend Debug Endpoints Summary

**One-liner:** Debug API (restart-ingestion, purge-coaching, nuke) + Connectors tab + /debug screen + Settings dev-tools link for tester/admin roles.

## What Was Built

### Task 1 - Backend debug API (commit `36dc39b`, prior session)
- `api/app/api/debug.py`: three endpoints all gated by `require_tester`:
  - `POST /debug/restart-ingestion` - re-queues categorization for all user uploads
  - `POST /debug/purge-coaching` - clears `coaching_insights` on user profile
  - `POST /debug/nuke` - deletes all user data (uploads, profile, coaching insights)
- `api/app/main.py`: registers `debug_router` with prefix `/debug`

### Task 2 - Frontend (commit `18777dc`)
- **`ConnectorsTab.tsx`**: 6 placeholder bank/fintech cards (Intesa Sanpaolo, Fineco, UniCredit, ING, Revolut, N26) each showing a "Prossimamente" badge. Uses `Building2` icon from lucide-react.
- **`DebugScreen.tsx`**: Three action sections with `callDebug` helper. Nuke requires `window.confirm()`. Displays success/error feedback inline. Auth via `readAccessToken()`.
- **`App.tsx`**: Imports `DebugScreen`, adds `/debug` route inside authenticated routes, gated to `user.isAdmin || user.role === "tester" || user.role === "admin"`.
- **`ProfileScreen.tsx`**: Adds "Connectors" tab button after "Files", renders `<ConnectorsTab />`. Tab type union updated to include `"connectors"`. Summary/Charts guard updated to exclude `"connectors"`.
- **`SettingsScreen.tsx`**: Developer tools block after About section - link to `/debug` visible only to tester/admin users.
- **i18n** (`it.json` + `en.json`): Added `connectors.*`, `debug.*` namespaces and `settings.devToolsTitle`, `settings.devToolsHint`, `settings.devToolsCta` keys.

## Deviations from Plan

### Auto-fixed Issues

None.

### Discovery: Plan 03 already complete
- When this agent resumed, `ProfileScreen.tsx` already had the `files` tab fully wired (FilesTab import, tab button, tab render). This was done by the plan-03 agent. The connectors tab was therefore added cleanly after `files` without any ordering conflict.

## Known Stubs

**1. ConnectorsTab - all 6 bank cards are static placeholders**
- File: `senso/src/features/profile/ConnectorsTab.tsx`
- Reason: No live open-banking / PSD2 API integration exists yet. Cards show "Prossimamente" (coming soon).
- Future plan: A dedicated connectors/integrations plan will wire real bank connection flows.

## Self-Check: PASSED

| Item                                           | Result  |
| ---------------------------------------------- | ------- |
| `api/app/api/debug.py`                         | ✅ FOUND |
| `senso/src/features/debug/DebugScreen.tsx`     | ✅ FOUND |
| `senso/src/features/profile/ConnectorsTab.tsx` | ✅ FOUND |
| Commit `36dc39b` (backend debug API)           | ✅ FOUND |
| Commit `18777dc` (frontend debug/connectors)   | ✅ FOUND |
