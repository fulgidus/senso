---
phase: "17"
slug: marp-real-rendering
status: ready
nyquist_compliant: true
created: "2026-04-06"
updated: "2026-04-06"
---

# Phase 17 - Validation Strategy

## Test Commands

| Command                                       | What it checks                                                 |
| --------------------------------------------- | -------------------------------------------------------------- |
| `docker compose run --rm frontend pnpm test`  | Unit tests: slide count per deck, CSS scoping, no comment text |
| `docker compose run --rm frontend pnpm build` | TypeScript + bundle clean (no TS errors)                       |
| Manual: open `/learn` → click any slide deck  | Slide renders with real MARP layout (not plain HTML)           |
| Manual: toggle dark mode                      | Slide background/text updates automatically (CSS vars)         |
| Manual: fullscreen toggle                     | Portal renders above all content (no clipping)                 |
| Manual: Escape / arrow keys                   | Keyboard nav works in both inline and fullscreen               |

## Per-Plan Test Map

| Plan     | Files changed             | Acceptance gate                                                                 |
| -------- | ------------------------- | ------------------------------------------------------------------------------- |
| 17-01-01 | `package.json`            | `@marp-team/marp-core` in deps; `pnpm build` passes                             |
| 17-01-02 | `marp-senso-theme.css`    | File starts with `/* @theme senso */`; uses CSS vars for colors                 |
| 17-01-03 | `MarpSlideViewer.tsx`     | No `marked` import; uses `Marp().render()`; CSS injected with cleanup           |
| 17-01-04 | `index.css`               | `.marp-inline .marp-slide-canvas` has `aspect-ratio: 16/9`; no `.marp-slide h1` |
| 17-02-01 | `MarpSlideViewer.tsx`     | `createPortal` to `document.body`; body scroll locked                           |
| 17-02-02 | `index.css`               | `.marp-portal-overlay` with `z-index: 9999`; canvas with `aspect-ratio: 16/9`   |
| 17-02-03 | `MarpSlideViewer.test.ts` | All 6 decks: correct slide count + no comment text; CSS scoped to `.marpit`     |

## Acceptance Gate (from VERIFICATION.md)

- [ ] `@marp-team/marp-core` installed in frontend
- [ ] `MarpSlideViewer` uses `Marp().render()` not `marked`
- [ ] MARP-generated CSS injected and scoped (no app bleed - scoped to `.marpit` container)
- [ ] Single `senso` MARP theme registered; slides using `theme: senso` in front-matter render correctly
- [ ] Light/dark mode works via CSS custom properties (no JS theme swap)
- [ ] Inline slides use fixed 16:9 aspect ratio (max-width 640px)
- [ ] Fullscreen via React portal into `document.body` (100vw×100vh, 16:9 letterboxed)
- [ ] All existing slide decks render with correct slide count
- [ ] No visible `<!--` comment text in rendered slides
- [ ] `pnpm build` clean
- [ ] Unit tests pass (all 6 decks × 2 assertions + CSS scoping tests)

## Known Risks

- **`htmlAsArray` TypeScript type**: Marpit's `render()` second argument type may not include `htmlAsArray` - use `as never` cast or check if types export an `env` option. Plan 17-01-03 uses `{ htmlAsArray: true } as never` as the workaround.
- **KaTeX CDN fonts**: `math: 'katex'` by default fetches KaTeX fonts from jsDelivr. For offline/strict-CSP demo, consider `katexFontPath: false` or bundling fonts locally. Not blocking for hackathon demo (online connectivity expected).
- **MARP CSS reset**: MARP's `section` CSS includes a reset. Since it's scoped to `.marpit`, it should not affect the app. Verify with DOM inspector that no heading or table styles leak outside `.marpit`.
