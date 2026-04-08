---
plan: "23-02"
phase: "23"
status: complete
completed: 2026-04-08
---

# Summary: Plan 23-02 - Full User Journey E2E (Real Stack)

## What Was Built

Full happy-path E2E test file covering auth, upload, profile, and coaching flows against the real Docker Compose stack.

## Key Files Created

- `senso/e2e/real-stack/user-journey.spec.ts` - 4 tests covering login, XLSX upload, profile, coach response
- `api/tests/fixtures/fineco_sample.xlsx` - Synthetic Fineco XLSX fixture matching module fingerprint
- Updated `senso/e2e/real-stack/fixtures.ts` - Added PATCH /auth/me to set first_name, added `loginAs` helper

## Decisions Made

- Added `loginAs` helper to fixtures.ts (shared by all wave-2 specs)
- PATCH /auth/me called in fixture setup so users skip /setup route (no firstName redirect)
- Used `__dirname` equivalent via `fileURLToPath(import.meta.url)` for ESM compatibility
- Poll ingestion by checking for status text rather than API polling (more realistic)
- Used `.flex.justify-start` CSS selector for assistant bubbles (no testids in codebase)

## Self-Check: PASSED

- [x] No page.route() mocks in spec file
- [x] Fixture path resolved with ESM-compatible import.meta.url
- [x] TypeScript compiles without errors
- [x] All 4 tests discovered by Playwright (--list output verified)
- [x] XLSX fixture created with valid Fineco structure
