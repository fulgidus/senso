---
phase: "16"
slug: e2e-test-suite-gestures-a11y-pwa-ergonomics-and-mobile-regressions
status: draft
nyquist_compliant: false
created: 2026-04-05
---

# Phase 16 — Validation Strategy

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | `@playwright/test` ^1.59.1 |
| **A11y** | `@axe-core/playwright` |
| **Quick run** | `cd senso && npx playwright test --project=chromium` |
| **Mobile run** | `cd senso && npx playwright test --grep @mobile` |
| **Full suite** | `cd senso && npx playwright test` |
| **Estimated runtime** | ~90–120s full, ~30s chromium-only |

## Per-Plan Test Map

| Plan | Spec file | Projects | What it guards |
|---|---|---|---|
| 16-01 | (infrastructure) | all | deps, config, fixtures compile |
| 16-02 | `gestures.spec.ts` | mobile-chrome, mobile-safari | swipe-up scroll, PTR zone, overscroll-none, mixed-direction lock |
| 16-03 | `nav-drawer.spec.ts` | chromium + @mobile | open/close, Escape, overlay click, focus trap, aria-modal |
| 16-04 | `a11y.spec.ts` | chromium | axe critical/serious, keyboard Tab, aria-live, focus traps |
| 16-05 | `pwa.spec.ts` | chromium | manifest fields, SW (documents gap with test.fail) |
| 16-05 | `ergonomics.spec.ts` | @mobile | tap targets, chat input visible, no h-scroll, send reachable |
| 16-05 | `coach-picker.spec.ts` | chromium | persona switch, session creation, chat continues |

## Known Gaps Documented as test.fail()

| Gap | test.fail() location | Fix path |
|---|---|---|
| No service worker | `pwa.spec.ts` — "service worker is registered" | Add `vite-plugin-pwa` |
| No offline caching | `pwa.spec.ts` — "app shell loads when offline" | Add `vite-plugin-pwa` with precache |
| No skip-to-content link | `a11y.spec.ts` — "skip-to-content link exists" | Add skip link to AppShell |

## Wave Structure

| Wave | Plans | What it enables |
|---|---|---|
| 0 | 16-01 | Deps + config for all waves |
| 1 | 16-02, 16-03 | Critical gesture + drawer tests (parallel) |
| 2 | 16-04, 16-05 | A11y + PWA + ergonomics + coach (parallel) |

## Acceptance Gate

- All chromium tests pass (except documented `test.fail()` known gaps)
- All `@mobile` tests pass on `mobile-chrome`
- Zero critical/serious axe violations on login, chat, profile, settings
- `nyquist_compliant: true` set after wave 2 completes
