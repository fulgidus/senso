---
plan: "17-01"
phase: "17"
status: complete
completed: "2026-04-07"
---

# Summary: 17-01 - Install Marp Core + Rewrite Renderer + Register Theme

## What was built

Replaced the `marked`-based slide renderer with `@marp-team/marp-core` 4.3.0.

## Key files created/modified

- `senso/package.json` — added `@marp-team/marp-core ^4.3.0`, removed `marked`
- `senso/src/styles/marp-senso-theme.css` — new single `senso` MARP theme using CSS custom properties for automatic light/dark adaptation; `section { width: 1280px; height: 720px }` static dimensions
- `senso/src/features/coaching/MarpSlideViewer.tsx` — full rewrite: module-level Marp singleton, `marp.render(raw, { htmlAsArray: true })` per-slide SVG output, CSS injection via `<style data-marp-viewer>`, `useMemo` for render, removed `parseSlides()`, `renderSlide()`, `MutationObserver`, `isDark` state
- `senso/src/index.css` — replaced 122-line `.marp-slide` CSS block with 16:9 layout rules (`.marp-inline .marp-slide-canvas { aspect-ratio: 16/9; max-width: 640px }`)

## Decisions made

- Single `senso` theme (not senso-light/senso-dark) — slide `.md` files declare `theme: senso` and must not change
- Light/dark via CSS custom properties referencing app tokens (`var(--background)`, `var(--primary)`, etc.)
- `pnpm remove marked` — only used in MarpSlideViewer

## Self-Check: PASSED

- `@marp-team/marp-core` in `senso/package.json` ✓
- `marked` absent from `senso/package.json` ✓
- `senso/src/styles/marp-senso-theme.css` exists, begins with `/* @theme senso */` ✓
- `MarpSlideViewer.tsx` imports `Marp` from `@marp-team/marp-core`, no `marked` import ✓
- `index.css` contains `.marp-inline .marp-slide-canvas { aspect-ratio: 16/9 }`, no `senso-light`/`senso-dark` ✓
- `pnpm build` exits 0 ✓
