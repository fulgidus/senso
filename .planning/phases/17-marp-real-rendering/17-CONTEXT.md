---
phase: "17"
slug: marp-real-rendering
created: "2026-04-06"
status: ready-to-execute
---

# Phase 17 Context — MARP Real Rendering

## Why This Phase Exists

`MarpSlideViewer` currently uses `marked` (a plain Markdown→HTML converter) instead of
`@marp-team/marp-core`. This means:
- MARP front-matter directives (`theme:`, `paginate:`, `backgroundImage:`, `size:`) are
  silently ignored.
- Slide-level `<!-- _class: ... -->` and `<!-- _backgroundColor: ... -->` comments are
  rendered as visible HTML comment text.
- The `senso-light` / `senso-dark` theme classes are CSS-only overrides on a plain `<div>`,
  not actual MARP themes — so font choices, slide proportions, and layout rules don't apply.
- Fullscreen mode uses a CSS overlay, not a portal — it can be clipped by parent overflow.

The result is slides that look like unstyled HTML, not a presentation deck.

## Root Cause

The original implementation chose `marked` because `@marp-team/marp-core` requires a build
step to isolate its generated CSS (scoped per-slide). The fast path was taken during Phase 6
and was never revisited.

## What This Phase Does

1. Install `@marp-team/marp-core` in the frontend.
2. Replace `marked.parse()` with `new Marp().render(fullMarkdown)` — render the whole deck
   at once and use MARP's own slide splitter, not the regex-based manual parser.
3. Inject MARP's generated CSS into a `<style>` tag scoped to the viewer shadow root (or a
   `<style data-marp-slide-id>` tag in document head that is cleaned up on unmount).
4. Register two custom MARP themes: `senso-light` and `senso-dark` that match the app's
   color tokens from `index.css`.
5. Move fullscreen rendering to a React portal (`ReactDOM.createPortal`) to escape any
   parent `overflow: hidden` clipping.
6. Verify all existing slide decks in `senso/src/content/slides/` render correctly.

## Scope

**In scope:**
- `senso/src/features/coaching/MarpSlideViewer.tsx` — full rewrite of rendering logic
- `senso/src/content/slides/*.md` — verify all decks render (no new content)
- Two MARP theme CSS files: `senso/src/styles/marp-senso-light.css` and `marp-senso-dark.css`
- Fullscreen portal via `ReactDOM.createPortal`
- Unit test: render each slide deck, assert slide count matches `---` separators

**Not in scope:**
- New slide deck content
- MARP export to PDF
- Animations / transitions (MARP `transition:` directive)
- Speaker notes view
