---
plan: 28-07
status: complete
commit: 183ad8f4
---
# Summary: Plan 28-07 — Consumer wiring — auth layer, routing, settings
Wired onUnauthorized into 7 files: useAuth.ts (pollMessages), ChatRoutes.tsx, RootResolver.tsx, AppShell.tsx, OnboardingRoutes.tsx (removes raw apiRequest import), SettingsScreen.tsx, AdminHandleGateModal.tsx. All dynamic import patterns eliminated.
## Self-Check: PASSED
