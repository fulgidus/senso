---
plan: 28-01
status: complete
started: 2026-04-11T09:30:00Z
completed: 2026-04-11T09:35:00Z
commit: 8953f444
---

# Summary: Plan 28-01 — AuthContext extension + session.ts exclusion comments

## What was built
Extended `AuthContextValue` type with `onUnauthorized: () => Promise<string | null>` and wired it through `App.tsx` into the context provider. Added canonical exclusion comments to auth-primitive calls in `session.ts`.

## Tasks completed
- [x] 28-01-01: Extend AuthContextValue and wire through App.tsx
- [x] 28-01-02: Add exclusion comments to session.ts auth-primitive calls

## Key files
### Modified
- `senso/src/features/auth/AuthContext.tsx` — added onUnauthorized field to AuthContextValue type
- `senso/src/App.tsx` — passes auth.onUnauthorized to AuthContext.Provider
- `senso/src/features/auth/session.ts` — 3 exclusion comments added (refresh, getMe, updateMe)

## Verification
- `grep "onUnauthorized: () => Promise"` → 1 match ✓
- `grep "onUnauthorized: auth.onUnauthorized"` → 1 match ✓
- `grep -c "no onUnauthorized"` → 3 ✓

## Self-Check: PASSED
All must_haves satisfied. Wave 2 plans can now proceed.
