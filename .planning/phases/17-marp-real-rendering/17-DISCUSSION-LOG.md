# Phase 17: MARP Real Rendering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 17-marp-real-rendering
**Areas discussed:** Slide visual style, Theme naming, Inline dimensions, CSS isolation

---

## Slide Visual Style

| Option              | Description                                                                                                  | Selected |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| App-integrated      | Use app color tokens (primary #3F72AF, card bg, Geist font) so slides feel like a native part of the chat UI |          |
| Minimal/educational | Very light styling, typography-first, content breathes; no heavy brand colors                                | ✓        |
| Clean presentation  | White/dark bg, prominent heading typography, 16:9 feel; could reference Marp default/gaia theme style        |          |

**User's choice:** Minimal/educational
**Notes:** Keep Geist Variable font (already loaded) for consistency with the app.

---

## Theme Naming

| Option                                         | Description                                                                                                                                          | Selected |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| One `senso` theme with CSS vars                | Register a single `senso` theme, use CSS vars for colors that automatically respond to the app's Tailwind dark class. No changes to slide .md files. | ✓        |
| Two themes + patch front-matter at render time | Register `senso-light` and `senso-dark`, swap `theme:` in the markdown string before passing to Marp(). Slide .md files stay as `theme: senso`.      |          |
| Update slide .md files                         | Change front-matter to `theme: senso-light` + swap dynamically in JS when dark mode is active                                                        |          |

**User's choice:** One `senso` theme with CSS custom properties
**Notes:** All 6 slide decks already declare `theme: senso` - no file changes needed. Dark/light handled purely via CSS vars tied to the app's `html.dark` class.

---

## Inline Dimensions

| Option                | Description                                                               | Selected |
| --------------------- | ------------------------------------------------------------------------- | -------- |
| Fixed 16:9            | max-width ~640px, height = width × 9/16 - proper presentation proportions | ✓        |
| Content-height / auto | Keep current behaviour where slide height adapts to content               |          |
| Compact fixed height  | e.g. 240px, scroll within the slide panel                                 |          |

**User's choice:** Fixed 16:9 aspect ratio
**Notes:** Slide content must scale to fit (no internal scroll). Fullscreen: 100vw × 100vh with 16:9 letterbox centered.

---

## CSS Isolation

| Option                          | Description                                                                      | Selected |
| ------------------------------- | -------------------------------------------------------------------------------- | -------- |
| MARP `container` option         | Pass a CSS class prefix to Marp(); all generated CSS scoped to `.marp-container` |          |
| `<head>` injection with cleanup | Unique `data-marp-deck-id` attribute, remove on unmount                          |          |
| Shadow DOM                      | Fully isolated but requires extra React wrapper                                  |          |
| Agent's discretion              | Pick the safest approach                                                         | ✓        |

**User's choice:** Agent's discretion
**Notes:** Agent should prefer the lowest-complexity safe option; MARP's built-in `container` prefix is the likely best candidate.

---

## Agent's Discretion

- CSS isolation mechanism (recommended: MARP container prefix option)
- Exact CSS custom property mapping from MARP theme vars to app tokens
- Portal z-index strategy (must not conflict with existing modals/drawers)
- Keyboard navigation implementation
- Unit test assertion strategy

## Deferred Ideas

None - discussion stayed within phase scope.
