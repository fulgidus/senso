---
phase: "16"
created: "2026-04-05"
status: ready-to-execute
---

# Phase 16 Context — E2E Test Suite: Gestures, A11y, PWA & Mobile Regressions

## Why This Phase Exists

The app has no automated coverage for:
- Touch gesture behaviour (pull-to-refresh zone, swipe-up scroll regression)
- Mobile nav drawer (open/close/focus-trap/Escape)
- Accessibility (axe-core, keyboard nav, aria-live, focus traps)
- PWA installability (manifest fields, SW, offline shell)
- UI ergonomics (tap targets, chat input visibility, horizontal overflow)

**Known bugs to catch and prevent regressions on:**
- Swipe-up gesture at scrollTop=0 can accidentally arm the pull-to-refresh handler
  because the `passive: false` touchmove listener calls `e.preventDefault()` on any
  deltaY>0 at the start of a mixed-direction swipe, blocking subsequent upward scroll.
- `overscroll-none` on ChatScreen message list suppresses native rubber-band at
  bottom; feels broken to users on iOS.
- Pull-to-refresh fires mid-content (not guarded to top-of-list only in all paths).
- No service worker — PWA manifest exists but app is not installable as standalone.

## Playwright Setup

- **Framework**: `@playwright/test` ^1.59.1 (already installed)
- **New dependency**: `@axe-core/playwright` for automated a11y scanning
- **Projects**:
  - `chromium` — Desktop Chrome 1280×800 (existing)
  - `mobile-chrome` — Pixel 5 emulation 393×851, touch events enabled (new)
  - `mobile-safari` — iPhone 14 emulation 390×844 (new, webkit)
- **Base URL**: `http://localhost:4173` (Vite preview, same as existing)
- **Mock strategy**: all API calls mocked via `page.route()` (no live backend)
- **Touch simulation**: `page.touchscreen.*` for gesture tests

## Scope

**In scope:**
- Gesture regression: swipe-up scroll, pull-to-refresh zone guard
- Mobile nav drawer: open/close/outside-click/Escape/focus-trap
- A11y: axe-core scans (login, chat, profile, settings), keyboard Tab order, aria-live
  on new messages, focus traps in drawer and compose modal, skip-to-content
- PWA: manifest fields, SW registration, offline cached shell
- Ergonomics: tap targets ≥44px, chat input visibility, no horizontal overflow on
  messages, send button position, modals have close button
- Coach picker regression: switching coach, chat continues correctly

**Not in scope:**
- Visual regression screenshots (deferred)
- Real backend integration tests
- iOS Safari on device (Playwright webkit approximates it)
- Performance benchmarks

## File Layout

```
senso/e2e/
  support/
    api-mocks.ts           (existing — extended with messages + coach mocks)
    fixtures.ts            (new — shared setup helpers)
    touch-helpers.ts       (new — swipe simulation utilities)
  gestures.spec.ts         (new — swipe-up, pull-to-refresh zone)
  nav-drawer.spec.ts       (new — hamburger, drawer, focus trap)
  a11y.spec.ts             (new — axe, keyboard, aria-live, skip link)
  pwa.spec.ts              (new — manifest, SW, offline)
  ergonomics.spec.ts       (new — tap targets, layout, overflow)
  coach-picker.spec.ts     (new — persona switch regression)
```
