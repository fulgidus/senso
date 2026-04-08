---
phase: "22"
slug: mobile-first-ui-overhaul
status: complete
nyquist_compliant: true
created: "2026-04-06"
---

# Phase 22 - Validation Strategy

## Test Commands

```bash
docker compose run --rm frontend pnpm build
cd senso && npx playwright test --project=mobile-chrome
cd senso && npx playwright test --project=mobile-safari
```

## Per-Plan Test Map

| Plan  | Test                                                  | What it guards                                            |
| ----- | ----------------------------------------------------- | --------------------------------------------------------- |
| 22-01 | Playwright `ergonomics.spec.ts` - chat input visible  | Input not hidden under keyboard (via viewport simulation) |
| 22-02 | Playwright `gestures.spec.ts` - PTR fires at top only | PTR does not fire mid-scroll                              |
| 22-03 | Playwright mobile: all table pages                    | No horizontal overflow, card layout renders               |
| 22-04 | Manual: profile on 390px screen                       | Tabs all accessible, no overflow                          |
| 22-05 | Playwright `pwa.spec.ts` - SW + standalone            | SW registered, manifest display=standalone                |
| 22-06 | Manual: TTS plays audio + STT captures voice          | Voice flow works end-to-end                               |

## Acceptance Gate

- `pnpm build` clean
- All existing Playwright chromium tests still pass
- `mobile-chrome` project: 0 new failures (existing `test.fail()` gaps may persist)
- PWA `display: standalone` in manifest
- TTS plays on user interaction (no autoplay error)
- Coach picker non-default persona → chat works correctly
- No horizontal scroll on any mobile page (`hasHorizontalScroll` helper returns false)
