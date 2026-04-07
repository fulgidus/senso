---
phase: 12-ux-accessibility-mobile-polish
plan: "03"
subsystem: frontend-components
tags: [offline-banner, balance-mask, privacy, accessibility, ripple, i18n]
dependency_graph:
  requires:
    - 12-01 (ripple-target CSS class in index.css)
    - useOnlineStatus hook (senso/src/hooks/useOnlineStatus.ts)
    - useLocaleFormat hook (senso/src/hooks/useLocaleFormat.ts)
  provides:
    - OfflineBanner component (fixed offline indicator bar)
    - BalanceMask component (balance privacy toggle)
  affects:
    - AppShell layout (OfflineBanner rendered, nav ripple)
    - ProfileScreen summary tab (balance masking + eye toggle)
tech_stack:
  added: []
  patterns:
    - useSyncExternalStore-backed online status hook
    - localStorage persistence for UI preference (senso:balanceMask)
    - role=alert for screen reader offline notification
key_files:
  created:
    - senso/src/components/OfflineBanner.tsx
    - senso/src/components/BalanceMask.tsx
    - senso/src/components/OfflineBanner.test.tsx
    - senso/src/components/BalanceMask.test.tsx
  modified:
    - senso/src/components/AppShell.tsx
    - senso/src/features/profile/ProfileScreen.tsx
decisions:
  - Used fmt.currency() from useLocaleFormat hook (not local formatCurrency) for BalanceMask values, consistent with plan 12-02 migration
  - BalanceMask wraps only actual euro amounts (income, expenses, margin) - not percentages, counts, or dates
  - Eye toggle placed in profile heading row alongside title/date for immediate discoverability
metrics:
  duration: "5 min"
  completed_date: "2026-04-01"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
---

# Phase 12 Plan 03: OfflineBanner, BalanceMask, and Ripple Nav Summary

**One-liner:** OfflineBanner (role=alert, z-[35]) and BalanceMask (localStorage-persisted eye toggle) added to AppShell and ProfileScreen, with ripple-target on nav links.

## Tasks Completed

| #   | Task                                              | Commit    | Files                                                           |
| --- | ------------------------------------------------- | --------- | --------------------------------------------------------------- |
| 1   | OfflineBanner component + AppShell integration    | `c90c946` | OfflineBanner.tsx, AppShell.tsx                                 |
| 2   | BalanceMask component + ProfileScreen integration | `3e9967e` | BalanceMask.tsx, ProfileScreen.tsx                              |
| 3   | Component unit tests + formatCurrency fix         | `a51705b` | OfflineBanner.test.tsx, BalanceMask.test.tsx, ProfileScreen.tsx |

## What Was Built

### OfflineBanner (`senso/src/components/OfflineBanner.tsx`)
- Fixed bar at `top-14 left-0 right-0 z-[35]` - above header (z-30), below sidebar overlay (z-40)
- Uses `useOnlineStatus()` hook - renders `null` when online, shows alert when offline
- `role="alert"` for screen reader announcement
- `WifiOff` icon + `t("app.offlineBanner")` i18n message
- Rendered in `AppShell` immediately after `</header>`

### BalanceMask (`senso/src/components/BalanceMask.tsx`)
- Props: `value: string | number`, `masked: boolean`, `className?: string`
- Shows `****` with `aria-label={t("accessibility.balanceHidden")}` when masked
- Shows actual value in `<span>` when unmasked
- No internal state - caller controls masking

### AppShell Changes
- Import + render `<OfflineBanner />` after header
- `ripple-target` class added to `NavItemLink` and `TopBarNavLink` NavLink elements

### ProfileScreen Changes
- Imports: `Eye`, `EyeOff` from lucide-react + `BalanceMask`
- State: `balanceMasked` initialized from `localStorage.getItem("senso:balanceMask") === "true"`
- `toggleBalanceMask()` handler flips state and persists to localStorage
- Eye/EyeOff toggle button in profile heading row (right side, `aria-label={t("accessibility.toggleBalanceVisibility")}`)
- Income, expenses, and margin amounts wrapped with `<BalanceMask value={fmt.currency(...)} masked={balanceMasked} />`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced removed `formatCurrency()` with `fmt.currency()` in BalanceMask values**
- **Found during:** Task 3 (TypeScript errors surfaced)
- **Issue:** Plan 12-02 had already replaced the local `formatCurrency()` function with `fmt.currency()` from `useLocaleFormat`. My initial Task 2 implementation used `formatCurrency()` which no longer existed.
- **Fix:** Updated all 3 BalanceMask `value=` props to use `fmt.currency()` with null-coalescing to `"-"` for null values
- **Files modified:** `senso/src/features/profile/ProfileScreen.tsx`
- **Commit:** `a51705b`

**2. [Observation] i18n keys already present**
- `app.offlineBanner`, `accessibility.balanceHidden`, `accessibility.toggleBalanceVisibility` were already added to both `it.json` and `en.json` by a prior plan execution - no changes needed.

## Known Stubs

None - all components render real data.

## Self-Check: PASSED

- `senso/src/components/OfflineBanner.tsx` ✅
- `senso/src/components/BalanceMask.tsx` ✅
- `senso/src/components/OfflineBanner.test.tsx` ✅
- `senso/src/components/BalanceMask.test.tsx` ✅
- Commits: `c90c946`, `3e9967e`, `a51705b` ✅
