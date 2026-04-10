---
plan_id: "27-02"
phase: 27
status: complete
completed: "2026-04-10"
---

# Plan 27-02 Summary: Frontend admin handle gate

## What was built

Four frontend changes that implement the blocking admin handle gate:

1. **D-08 — i18n keys** (`it.json` + `en.json`): Added 12-key `adminHandleGate` block to both locales: `dialogLabel`, `title`, `description`, `inputLabel`, `inputPlaceholder`, `formatHint`, `cta`, `saving`, `errorReserved`, `errorTaken`, `errorFallback`, `charCount`. Both files validated as JSON. Italian is primary locale.

2. **D-03, D-04 — AdminHandleGateModal** (`AdminHandleGateModal.tsx`): New non-dismissable blocking modal. Key behaviors:
   - `Escape` suppressed (`preventDefault` + `stopPropagation`)
   - Backdrop click suppressed (no close button)
   - Input strips invalid chars live to `[a-z0-9-]` only
   - `!` prefix shown as visual prefix in input group; user types without it
   - Error discrimination: 409 → `errorTaken`, 422 → `errorReserved`, else `errorFallback`
   - `aria-modal="true"`, `role="dialog"`, `aria-live="polite"` on error paragraph, `autoFocus` on input
   - All 13 text strings from i18n keys (zero hardcoded Italian)

3. **D-01, D-02, D-05 — AppShell gate** (`AppShell.tsx`): Added gate before main return. Condition: `user && user.isAdmin && !user.adminHandle`. On save, calls `updateUser({ adminHandle: handle })` to dismiss without page reload. `updateUser` destructured from `useAuthContext()`.

4. **Bug fix — SettingsScreen** (`SettingsScreen.tsx`): Three fixes in `handleClaimHandle`:
   - `t("settings.handleError")` → `t("settings.adminHandleError")` (correct i18n key)
   - `apiRequest<{ admin_handle: string }>` → `apiRequest<{ adminHandle: string }>` (matches backend alias)
   - `res.admin_handle` → `res.adminHandle` (backend serializes via `Field(alias="adminHandle")`)

## key-files

### created
- senso/src/components/AdminHandleGateModal.tsx

### modified
- senso/src/i18n/locales/it.json
- senso/src/i18n/locales/en.json
- senso/src/components/AppShell.tsx
- senso/src/features/settings/SettingsScreen.tsx

## Verification

- TypeScript compiler (`pnpm tsc --noEmit`) exits 0 with no errors
- JSON files validated with `node -e "JSON.parse(...)"` — both locales valid

## Manual verification checklist (from VALIDATION.md)

- [ ] Log in as admin with no `admin_handle` → full-screen modal appears, nav not accessible
- [ ] Escape key and backdrop click → modal does NOT dismiss
- [ ] Type valid handle (e.g. `test-handle`), submit → modal dismisses, app shell renders
- [ ] Log in as admin with `admin_handle` already set → no modal, app renders normally
- [ ] SettingsScreen: handle save error → correct error message shown

## Self-Check

- [x] AdminHandleGateModal has `role="dialog"`, `aria-modal="true"`, `aria-live="polite"`
- [x] Escape suppressed in `handleKeyDown`
- [x] All text from `adminHandleGate.*` i18n keys
- [x] AppShell imports AdminHandleGateModal and checks gate condition
- [x] `updateUser` destructured from `useAuthContext` in AppShell
- [x] SettingsScreen uses `settings.adminHandleError` (not `settings.handleError`)
- [x] TypeScript compiles cleanly
