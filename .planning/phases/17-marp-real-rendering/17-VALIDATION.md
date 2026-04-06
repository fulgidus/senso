---
phase: "17"
slug: marp-real-rendering
status: draft
nyquist_compliant: false
created: "2026-04-06"
---

# Phase 17 — Validation Strategy

## Test Commands

| Command | What it checks |
|---|---|
| `docker compose run --rm frontend pnpm test` | Unit tests: slide parse, theme injection |
| `docker compose run --rm frontend pnpm build` | TypeScript + bundle clean |
| Manual: open `/learn` → click any slide deck | Slide renders with MARP layout, not raw HTML |
| Manual: fullscreen toggle | Portal renders above all other content |

## Per-Plan Test Map

| Plan | Files changed | Acceptance gate |
|---|---|---|
| 17-01 | `MarpSlideViewer.tsx`, theme CSS files | `@marp-team/marp-core` installed; deck renders with MARP CSS injected; slide count correct |
| 17-02 | `MarpSlideViewer.tsx` (fullscreen), vitest unit | Portal escapes parent overflow; keyboard nav works; unit tests pass |

## Acceptance Gate

- `pnpm build` clean (no TS errors)
- All existing slide decks render without visible `<!--` comment text
- MARP `theme:` front-matter directive is respected (senso-light / senso-dark applied)
- Fullscreen portal renders above drawer/modals (z-index correct)
- No MARP CSS leaking into the surrounding app (heading styles, reset, etc.)
- Unit tests: ≥1 test per plan, all green

## Known Risks

- `@marp-team/marp-core` CSS reset is aggressive — may override Tailwind base styles if
  not properly scoped. Mitigation: inject into shadow DOM or use `all: initial` wrapper.
- SSR incompatibility: `Marp` constructor uses DOM APIs. Must be client-only (`use client`
  or dynamic import with `{ ssr: false }`).
