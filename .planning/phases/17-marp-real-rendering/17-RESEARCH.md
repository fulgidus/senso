# Phase 17 — MARP Real Rendering: Research

**Researched:** 2026-04-06
**Sources:** marp-core README, marpit.marp.app docs (theme-css, usage), live library inspection

---

## Executive Summary

`@marp-team/marp-core` provides a clean `render(markdown) → { html, css }` API. The library handles CSS scoping automatically via its container element. CSS custom properties (`var(--x)`) survive PostCSS and resolve at browser render time, making the single `senso` theme + Tailwind dark class approach fully viable. The inline SVG output scales natively to any container size via `viewBox`.

---

## 1. Core API — `marp.render()`

```typescript
import { Marp } from '@marp-team/marp-core'

const marp = new Marp({ script: false, emoji: false, math: false })
const { html, css } = marp.render(rawMarkdown)
```

**Returns:**
- `html` — a complete string with all slides rendered, wrapped in the container element (default: `<div class="marpit">`)
- `css` — scoped CSS for all slides; selectors are automatically prefixed with the container selector
- `comments` — slide presenter notes (unused for this phase)

**Slide structure in `html`:** Each slide is a `<section>` element. With default inline SVG mode, each `<section>` is wrapped in an `<svg viewBox="0 0 1280 720">`, enabling automatic aspect-ratio scaling.

**Key constructor options to set:**
```typescript
const marp = new Marp({
  script: false,        // Don't inject browser helper script into HTML
  emoji: { shortcode: false, unicode: false }, // Disable twemoji (CDN dep, unnecessary)
  math: false,          // Disable MathJax/KaTeX (not needed)
})
```

---

## 2. Theme Registration

```typescript
marp.themeSet.add(`
/* @theme senso */

section {
  width: 1280px;   /* Defines slide canvas size */
  height: 720px;   /* Must be static absolute values */
  background: var(--background);
  color: var(--foreground);
  font-family: 'Geist Variable', sans-serif;
  padding: 3rem;
}

h1 { font-size: 2rem; font-weight: 700; }
h2 { font-size: 1.5rem; font-weight: 600; }
`)
```

**Rules:**
- `/* @theme name */` comment is required at the top
- `:root` in theme CSS maps to each `<section>` element (not `<html>`)
- `section { width, height }` defines the canvas — must be static px values (CSS vars NOT allowed here)
- All other declarations CAN use CSS custom properties
- Slide size defaults to 1280×720 (16:9) — keep this, it matches the `size: 16:9` implied by slides

**Theme must be added before calling `render()`.**

---

## 3. CSS Isolation — Container Scoping (Built-in)

MARP's container mechanism is the correct isolation approach (D-08 decision confirmed):

- Default container: `<div class="marpit">`
- All generated CSS is automatically scoped: `div.marpit section { ... }`, `div.marpit h1 { ... }` etc.
- **Zero additional work required** — MARP handles selector prefixing internally via PostCSS

The generated `css` will NOT leak outside `<div class="marpit">`. No shadow DOM, no manual scoping, no style injection into `<head>` needed beyond normal CSS handling.

**Recommended: inject `css` into a `<style>` tag with a cleanup ref:**
```typescript
useEffect(() => {
  const style = document.createElement('style')
  style.setAttribute('data-marp-viewer', slideId)
  style.textContent = css
  document.head.appendChild(style)
  return () => document.head.removeChild(style)
}, [css, slideId])
```

**Singleton pattern recommended:** Create one Marp instance with the theme registered once (module-level or lazy singleton), reuse it across renders. `render()` is synchronous and stateless per call.

---

## 4. CSS Custom Properties — Dark Mode

**Confirmed: CSS vars survive PostCSS and resolve at browser render time.**

PostCSS (used internally by Marp/Marpit) does NOT resolve CSS custom properties — it's a browser feature, not a build-time feature. So `background: var(--background)` in the theme CSS will appear verbatim in the generated `css` string, and the browser will resolve it using the current document's CSS custom property values.

**This means:**
- `var(--background)` resolves to `#fff` in light mode (Tailwind default)
- `var(--background)` resolves to `#112D4E` when `html.dark` class is present
- **No JS dark mode detection needed** — remove the `MutationObserver` from the component

**EXCEPTION:** `section { width: 1280px; height: 720px; }` must use literal px values — CSS vars cannot be used for slide canvas dimensions.

**App token mapping for the `senso` theme (from `senso/src/index.css` lines 53–100):**

| MARP property | App token | Light value | Dark value |
|---|---|---|---|
| `background` | `var(--background)` | `oklch(1 0 0)` | `#112D4E` |
| `color` | `var(--foreground)` | `oklch(0.153...)` | `#F9F7F7` |
| `--primary` | `var(--primary)` | `#3F72AF` | `#5B9BD5` |
| `--card` bg | `var(--card)` | `#DBE2EF` | `#1a3a5c` |
| `--muted` | `var(--muted)` | *(check index.css)* | *(check index.css)* |

---

## 5. Inline SVG and 16:9 Scaling

MARP-core enables `inlineSVG: true` by default. Each rendered slide is:
```html
<svg viewBox="0 0 1280 720" ...>
  <foreignObject width="1280" height="720">
    <section>...content...</section>
  </foreignObject>
</svg>
```

The `viewBox` makes the SVG **scale automatically** to any container width while preserving 16:9 proportions. This is the key: **no `transform: scale()` needed**.

**For inline display (D-05):**
```css
.marp-inline-container {
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16 / 9;  /* browser constrains height */
}
/* The SVG inside fills 100% width and scales height automatically */
```

**For fullscreen (D-07):**
```css
.marp-fullscreen-canvas {
  max-width: 90vw;
  max-height: 90vh;
  aspect-ratio: 16 / 9;
  /* Centered in 100vw × 100vh overlay */
}
```

The `<div class="marpit">` wrapper from `marp.render()` contains all slides. For the viewer, we:
1. Parse `html` to extract individual slides (or render all and show one at a time via CSS/display)
2. OR: use `render(markdown, { htmlAsArray: true })` to get individual slide HTML strings

**Recommendation: use `htmlAsArray: true` env option:**
```typescript
const { html: slideHtmlArray, css } = marp.render(markdown, { htmlAsArray: true })
// slideHtmlArray is string[] — one HTML string per slide
// Each string is a <section>...</section> (without outer container)
// Must wrap in <div class="marpit"> for CSS scoping
```

This lets the component show one slide at a time without additional DOM parsing.

---

## 6. Removing Obsolete Code

The current `MarpSlideViewer.tsx` has:
- `parseSlides(raw: string): string[]` — **DELETE**: MARP handles slide splitting
- `renderSlide(md: string): string` — **DELETE**: replaced by `marp.render()`
- `marked` import and `marked.setOptions()` — **DELETE**
- `MutationObserver` for dark mode — **DELETE**: CSS vars handle this
- `isDark` state — **DELETE**: no longer needed
- `themeClass` (`senso-light`/`senso-dark`) — **DELETE**: single `senso` theme

**Keep:**
- `current` state (slide index)
- `fullscreen` state
- `handleKeyDown` (arrow keys, Escape, F)
- Navigation bar UI
- The `SLIDE_INDEX` lookup for raw markdown

---

## 7. SSR / Client-Only

`@marp-team/marp-core` uses DOM APIs only in the browser helper script (which we disable with `script: false`). The `render()` method itself is pure text processing and runs fine in any JS environment.

**However:** Calling `marp.render()` during Vite's SSR pass would fail if the bundle isn't marked client-only. Since `MarpSlideViewer.tsx` already uses `useState`/`useEffect`/`useRef`, it's implicitly client-only in React. **No additional `use client` or dynamic import needed** — existing component structure is sufficient.

---

## 8. Bundle Size

`@marp-team/marp-core` is ~281KB unpacked. Dependencies include:
- `highlight.js` (~heavy)
- `katex` and `mathjax-full` (~very heavy)

**Mitigation:** Set `math: false` in the Marp constructor — this prevents the MathJax/KaTeX bundles from being included in the render path. Emoji is similar: set `emoji: { shortcode: false, unicode: false }`.

Vite will likely tree-shake unused modules but explicit `false` options are safer.

**Lazy loading:** Consider dynamic import of the Marp singleton to defer the ~280KB until first slide render:
```typescript
const marpPromise = import('@marp-team/marp-core').then(({ Marp }) => {
  const marp = new Marp({ script: false, math: false, emoji: false })
  marp.themeSet.add(SENSO_THEME_CSS)
  return marp
})
```

This is especially useful since slides only appear in the coaching chat, not on page load.

---

## 9. Validation Architecture

### Unit Tests (vitest)

**What to test:**
1. `marp.render(slideMarkdown)` returns correct slide count when `htmlAsArray: true`
2. Theme is recognized: rendered `css` contains `marpit` scoping class
3. No visible `<!--` comment text in rendered HTML

**Test file:** `senso/src/features/coaching/MarpSlideViewer.test.ts`

```typescript
import { SLIDE_INDEX } from '@/content/slideIndex'

describe('MARP slide rendering', () => {
  it.each(Object.entries(SLIDE_INDEX))('renders %s with correct slide count', (id, raw) => {
    const { Marp } = await import('@marp-team/marp-core')
    const marp = new Marp({ script: false, math: false })
    marp.themeSet.add(SENSO_THEME_CSS)
    const { html } = marp.render(raw, { htmlAsArray: true })
    const expectedCount = (raw.match(/^---$/gm) ?? []).length  // separators = slide count - 1
    expect(html.length).toBe(expectedCount + 1)
  })

  it('CSS is scoped to marpit container', () => {
    // ...
    expect(css).toContain('marpit')
  })

  it('no raw HTML comment text in rendered output', () => {
    // ...
    expect(html.join('')).not.toContain('&lt;!--')
  })
})
```

### Manual Verification

| Check | How |
|---|---|
| Slides render with MARP theme (not plain HTML) | Open `/learn`, click any slide card |
| Dark mode works | Toggle app dark mode, verify slide background/text changes |
| No CSS bleed | Inspect page outside `.marpit` — no unexpected style overrides |
| Fullscreen letterboxed | Open fullscreen, resize window |
| All 6 decks render | Verify each in SLIDE_INDEX |

### Build Gate

```bash
docker compose run --rm frontend pnpm build    # TS + bundle clean
docker compose run --rm frontend pnpm test     # unit tests
```

---

## 10. Implementation Plan Guidance

**Wave 0 (17-01):** Install + theme CSS + renderer rewrite + CSS injection
- Single task complexity: moderate (one component, clean rewrite)
- Key risk: CSS var resolution for `section { width, height }` — must use px literals

**Wave 1 (17-02):** Fullscreen portal + keyboard nav + unit tests
- `createPortal` is straightforward — portal into `document.body`
- Tests need `jsdom` vitest environment (check existing test config)
