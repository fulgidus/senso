---
status: passed
phase: "16"
verified_at: "2026-04-05"
---

# Phase 16 Verification — E2E Test Suite: Gestures, A11y, PWA, Ergonomics, Mobile Regressions

## Must-Haves

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | `@axe-core/playwright` installed | ✓ | `package.json` has `"@axe-core/playwright": "^4.11.1"` |
| 2 | Mobile projects in playwright.config.ts | ✓ | `mobile-chrome` (Pixel 5) + `mobile-safari` (iPhone 14) with `grep: /@mobile/` |
| 3 | Shared `fixtures.ts` with `authedPage` | ✓ | `senso/e2e/support/fixtures.ts` exports `authedPage` fixture |
| 4 | Shared `touch-helpers.ts` | ✓ | `swipe`, `swipeUp`, `swipeDown`, `getScrollTop`, `hasHorizontalScroll`, `getTapTargetSize` |
| 5 | `api-mocks.ts` extended | ✓ | `mockMessages`, `mockMultiPersonas`, `mockCoachSwitch` added |
| 6 | `gestures.spec.ts` with @mobile tests | ✓ | 5 tests, 7 @mobile occurrences, swipe-up/PTR/body-leak/mixed-direction |
| 7 | `nav-drawer.spec.ts` | ✓ | 7 tests — open/close/Escape/overlay/nav-link/focus-trap/aria-modal |
| 8 | `pwa.spec.ts` | ✓ | manifest fields, SW/offline as `test.fail()` documenting gaps |
| 9 | `ergonomics.spec.ts` | ✓ | tap targets ≥44px, chat input viewport, horizontal overflow, thumb reach |
| 10 | `coach-picker.spec.ts` | ✓ | persona switch regression, session creation, post-switch chat |
| 11 | `a11y.spec.ts` with axe-core | ✓ | 4 page scans, keyboard nav, aria-live, focus trap, skip-to-content |
| 12 | All tests list successfully | ✓ | `playwright test --list` shows 40+ tests across chromium/mobile-chrome/mobile-safari |

## Spot-checks

- `find senso/e2e -name "*.spec.ts"` → 6 new files (+ 3 existing smoke tests = 9 total) ✓
- `grep "@mobile" senso/e2e/gestures.spec.ts` → 7 occurrences ✓
- `grep "AxeBuilder" senso/e2e/a11y.spec.ts` → import present ✓
- `grep "test.fail" senso/e2e/pwa.spec.ts` → 3 occurrences (SW + offline + inline call) ✓
- Mobile projects listing → 14 mobile-chrome tests + 14 mobile-safari tests confirmed ✓

## Notes

- PWA SW/offline tests intentionally fail (`test.fail()`) — no service worker registered yet. This documents the gap without blocking CI.
- Skip-to-content test uses `test.skip()` if link not implemented — advisory only.
- axe-core version 4.11.1 installed (WCAG 2.1 AA rule support).
