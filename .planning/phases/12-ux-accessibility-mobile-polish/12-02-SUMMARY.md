---
phase: 12-ux-accessibility-mobile-polish
plan: "02"
subsystem: i18n / frontend formatting
tags: [i18n, locale, formatting, regression-test]
dependency_graph:
  requires: [12-01]
  provides: [locale-aware-formatting-all-screens]
  affects: [ChatScreen, ProfileScreen, UncategorizedScreen, QuestionnaireScreen, AdminInspectorDrawer, FilesTab]
tech_stack:
  added: []
  patterns: [useLocaleFormat hook, import.meta.glob for test file scanning]
key_files:
  created:
    - senso/src/test/no-hardcoded-locale.test.ts
  modified:
    - senso/src/features/coaching/ChatScreen.tsx
    - senso/src/features/profile/ProfileScreen.tsx
    - senso/src/features/profile/UncategorizedScreen.tsx
    - senso/src/features/profile/QuestionnaireScreen.tsx
    - senso/src/features/profile/AdminInspectorDrawer.tsx
    - senso/src/features/profile/FilesTab.tsx
decisions:
  - "Used import.meta.glob with { as: 'raw', eager: true } for regression test instead of Node fs/path (jsdom environment)"
  - "Excluded useVoiceInput.ts and useTTS.ts from it-IT check — they use it-IT as a dynamic locale tag for browser Speech API, not hardcoded formatting"
  - "Extended scope to AdminInspectorDrawer and FilesTab (Rule 1 auto-fix) to make regression test pass cleanly"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-01T13:55:54Z"
  tasks_completed: 2
  files_changed: 6
  files_created: 1
---

# Phase 12 Plan 02: i18n Locale Centralization Summary

**One-liner:** Replaced all 14 hardcoded `"it-IT"` locale strings and 3 `"/anno"` strings with `useLocaleFormat` hook + `t("profile.perYear")`, with a `import.meta.glob` regression test guarding against future regressions.

## What Was Built

All number/date/currency formatting in screen files now routes through the `useLocaleFormat` hook (from Plan 12-01), which reads `i18n.language` at runtime. This means switching the app locale from `it` → `en` will correctly flip number separators, currency display, and date format across all UI surfaces.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix ChatScreen + ProfileScreen | `bef8bc9` | ChatScreen.tsx, ProfileScreen.tsx |
| 2 | Fix remaining screens + regression test | `72a51e2` | UncategorizedScreen.tsx, QuestionnaireScreen.tsx, AdminInspectorDrawer.tsx, FilesTab.tsx, no-hardcoded-locale.test.ts |

## Verification

- `docker compose run --rm frontend pnpm build` → **✓ built in 3.06s**
- `docker compose run --rm frontend pnpm vitest run` → **✓ 9 test files, 29 tests pass**
- `grep -rn "it-IT" senso/src/ --include="*.tsx" --include="*.ts" | grep -v test | grep -v useLocaleFormat | grep -v useVoiceInput | grep -v useTTS` → **0 results**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended scope to AdminInspectorDrawer.tsx and FilesTab.tsx**
- **Found during:** Task 2 (regression test caught violations)
- **Issue:** Two files outside the plan's explicit scope (`AdminInspectorDrawer.tsx` lines 239/275, `FilesTab.tsx` line 127) had hardcoded `"it-IT"` that caused the regression test to fail
- **Fix:** Added `useLocaleFormat` hook to both files and replaced `toLocaleString("it-IT")` / `toLocaleDateString("it-IT")` with `fmt.date()` calls
- **Files modified:** `AdminInspectorDrawer.tsx`, `FilesTab.tsx`
- **Commit:** `72a51e2`

**2. [Rule 3 - Blocking] Used `import.meta.glob` instead of Node `fs`/`path` in regression test**
- **Found during:** Task 2
- **Issue:** The plan's test template used Node.js `fs`/`path` + `__dirname`, which don't exist in Vite's jsdom test environment
- **Fix:** Rewrote test to use `import.meta.glob([..., { as: "raw", eager: true }])` — standard Vite pattern for scanning source files at test time
- **Files modified:** `no-hardcoded-locale.test.ts`
- **Commit:** `72a51e2`

## Known Stubs

None — all locale-sensitive formatting paths are now wired to `useLocaleFormat`.

## Self-Check: PASSED

- [x] `bef8bc9` exists in git log
- [x] `72a51e2` exists in git log
- [x] `senso/src/test/no-hardcoded-locale.test.ts` created
- [x] All 4 plan target files + 2 auto-fixed files contain zero `"it-IT"` strings
- [x] All tests pass (29/29)
