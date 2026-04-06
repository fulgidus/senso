---
phase: "17"
slug: marp-real-rendering
created: "2026-04-06"
updated: "2026-04-06"
status: ready-to-execute
---

# Phase 17: MARP Real Rendering — Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the `marked`-based slide renderer in `MarpSlideViewer.tsx` with real
`@marp-team/marp-core` rendering. Six existing slide decks must render with correct
MARP layout, themes, and directives. Fullscreen moves to a React portal. Two plan files
(17-01, 17-02) exist and cover this scope — this context update locks visual and
architectural decisions for replanning.

**In scope:**
- `senso/src/features/coaching/MarpSlideViewer.tsx` — full rewrite of rendering logic
- One `senso` MARP theme CSS file (light/dark via CSS custom properties)
- Fullscreen portal via `ReactDOM.createPortal`
- Unit tests: render each deck, assert slide count

**Not in scope:**
- New slide deck content
- MARP PDF export, animations/transitions, speaker notes
- Updating slide `.md` front-matter files

</domain>

<decisions>
## Implementation Decisions

### Slide Visual Style
- **D-01:** Minimal/educational aesthetic — light styling, typography-first, content breathes. No heavy brand colors or decorative elements.
- **D-02:** Geist Variable font (already loaded by the app) must be used in slides for consistency — do not introduce a separate font stack.

### Theme Architecture
- **D-03:** Register a **single `senso` theme** via `marp.addTheme()` — do not create separate `senso-light` / `senso-dark` themes. Slide `.md` files already declare `theme: senso` and must not be changed.
- **D-04:** Light/dark mode is handled via **CSS custom properties** in the theme CSS that reference the app's existing Tailwind tokens (e.g. `var(--background)`, `var(--foreground)`, `var(--primary)`). The `html.dark` class already toggles these variables — no JS theme-swapping required.

### Inline Dimensions
- **D-05:** Inline (in-chat) slides must use a **fixed 16:9 aspect ratio** — approximately `max-width: 640px` with `height = width × (9/16)`. This gives proper presentation proportions rather than content-driven height.
- **D-06:** Slide content must scale to fit within the 16:9 box (CSS `transform: scale()` or MARP's own scaling) — no overflow scrolling within an individual slide.

### Fullscreen
- **D-07:** Fullscreen renders via `ReactDOM.createPortal` into `document.body`. The portal occupies `100vw × 100vh` with a dark overlay. The slide canvas is **letterboxed 16:9 centered** — not stretched to fill.

### CSS Isolation
- **D-08:** Agent's discretion — choose the safest scoping mechanism to prevent MARP-generated CSS from bleeding into the rest of the app. Consider MARP's built-in `container` prefix option as the lowest-complexity solution.

### Agent's Discretion
- Portal DOM target and z-index strategy
- Exact CSS custom property mapping from MARP theme vars to app tokens
- Keyboard navigation implementation (arrow keys, Escape, F key)
- Unit test assertion strategy for slide count

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Implementation (rewrite target)
- `senso/src/features/coaching/MarpSlideViewer.tsx` — full current component; shows existing parseSlides(), renderSlide(), fullscreen overlay, dark mode detection pattern
- `senso/src/content/slideIndex.ts` — static import map; stays unchanged
- `senso/src/index.css` lines 139–230 — existing `.marp-*` CSS that will be replaced or adapted

### Slide Content
- `senso/src/content/slides/it-slide-budget-base.md` — sample `it` deck; all decks declare `theme: senso`
- `senso/src/content/slides/en-slide-budget-basics.md` — sample `en` deck

### App Design Tokens
- `senso/src/index.css` lines 53–100 — light/dark CSS custom property blocks (`--background`, `--foreground`, `--primary`, `--card`, etc.) that the `senso` MARP theme must reference

### Phase Scope Reference
- `.planning/phases/17-marp-real-rendering/17-VERIFICATION.md` — nine must-haves that define done

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SLIDE_INDEX` (`slideIndex.ts`): static record of raw markdown strings keyed by slide ID — no change needed; `MarpSlideViewer` just reads from it
- Geist Variable: already imported in `index.css` via `@fontsource-variable/geist` — reference it directly in the MARP theme CSS
- `MutationObserver` dark mode detection: already implemented in the component — can be kept or removed in favour of CSS-var approach (D-04 means JS detection may no longer be needed)

### Established Patterns
- Dark mode: Tailwind dark class on `html` element (`document.documentElement.classList.contains("dark")`) — the CSS var approach in D-04 means the theme responds automatically without JS
- `dangerouslySetInnerHTML`: already used for rendered slide HTML — continue this pattern with MARP output
- Keyboard events on the viewer `<div>` with `tabIndex={0}` — keep this pattern for nav

### Integration Points
- `MarpSlideViewer` is consumed inside `AssistantBubble` in the coaching chat — the inline 16:9 box must not break the chat bubble layout
- The fullscreen portal renders into `document.body` — must not conflict with existing modals or drawers (check z-index layering)

</code_context>

<specifics>
## Specific Ideas

- "Minimal/educational — let content breathe" → MARP theme should feel like clean lecture slides, not a branded marketing deck. Think: adequate whitespace, readable heading hierarchy, subtle dividers if needed.
- 16:9 inline is the correct call — slides are a presentation format and the boxy proportions reinforce that; irregular heights in chat would look broken.
- One `senso` theme with CSS vars is the clean solution: no need to patch front-matter or maintain two parallel theme files.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-marp-real-rendering*
*Context gathered: 2026-04-06*
