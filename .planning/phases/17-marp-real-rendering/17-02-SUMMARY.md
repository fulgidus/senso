---
plan: "17-02"
phase: "17"
status: complete
completed: "2026-04-07"
---

# Summary: 17-02 - Fullscreen Portal + Keyboard Nav + Unit Tests

## What was built

Added fullscreen portal via `ReactDOM.createPortal` and vitest unit tests for all 6 slide decks.

## Key files created/modified

- `senso/src/features/coaching/MarpSlideViewer.tsx` — added `createPortal` into `document.body`, `.marp-portal-overlay` + `.marp-portal-canvas` structure, body scroll lock (`document.body.style.overflow = "hidden"`), `role="dialog"` + `aria-modal="true"`, `useMemo` for render optimization, `portalRef` focus on open
- `senso/src/index.css` — added `.marp-portal-overlay { position: fixed; z-index: 9999 }`, `.marp-portal-canvas { width: min(90vw, calc(90vh * 16 / 9)); aspect-ratio: 16/9 }`, `.marp-portal-marpit` SVG fill
- `senso/src/features/coaching/MarpSlideViewer.test.ts` — new vitest unit tests: senso theme registration, slide count for all 6 decks (it.each), no visible HTML comment text, CSS scoped to `.marpit`, no `senso-light`/`senso-dark` in generated CSS

## Decisions made

- Inline viewer stays rendered while fullscreen portal is open — prevents teardown/mount flicker on toggle
- Portal uses `onClick` overlay dismiss + `e.stopPropagation()` on canvas
- Keyboard nav: ArrowRight/Down → next, ArrowLeft/Up → prev, Escape → close, F → toggle fullscreen

## Issues

- Pre-existing vitest runner bug: `src/test/setup.ts` imports `beforeEach` from `vite-plus/test` which is broken — all 17 test suites fail with same error, not caused by Phase 17. Marp rendering validated via direct Node.js (`node -e "..."`) — all 6 decks render correct slide counts, CSS scoped to `.marpit`, no `senso-light`/`senso-dark`.

## Self-Check: PASSED

- `MarpSlideViewer.tsx` imports `createPortal` from `react-dom` ✓
- `createPortal(... document.body)` present ✓
- `document.body.style.overflow = "hidden"` + cleanup ✓
- `role="dialog"` + `aria-modal="true"` ✓
- `index.css` contains `.marp-portal-overlay { position: fixed; z-index: 9999 }` ✓
- `index.css` contains `.marp-portal-canvas` with `aspect-ratio: 16/9` ✓
- `index.css` contains `width: min(90vw, calc(90vh * 16 / 9))` ✓
- `MarpSlideViewer.test.ts` exists with `it.each(deckEntries)` tests ✓
- `pnpm build` exits 0 ✓
