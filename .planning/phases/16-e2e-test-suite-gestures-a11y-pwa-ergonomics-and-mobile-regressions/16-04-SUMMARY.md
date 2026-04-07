---
plan: "16-04"
phase: "16"
status: complete
completed_at: "2026-04-05"
---

# Summary: 16-04 - Accessibility Tests (axe-core + keyboard + aria-live)

## What was built

Created `senso/e2e/a11y.spec.ts` with comprehensive accessibility test coverage:

**axe-core scans** (4 pages): login, chat, profile, settings
- Fail on critical + serious violations; warn on moderate; skip minor
- Exclude Radix third-party popup false-positives

**Keyboard navigation** (3 tests):
- Tab reaches chat textarea within 15 presses
- Tab reaches send button after textarea focus
- Tab reaches at least one nav element in top bar

**aria-live** (2 tests):
- Chat screen has ≥1 polite/assertive live region
- Live region persists after message send

**Focus trap** (1 test): compose modal keeps Tab within dialog

**Skip-to-content** (advisory): warns if missing, skips rather than fails

## Key files
- `senso/e2e/a11y.spec.ts`

## Self-Check: PASSED
