# Phase 22: Mobile-First UI Overhaul - Research

**Researched:** 2026-04-06
**Domain:** iOS visualViewport keyboard handling, PWA manifest, vite-plugin-pwa, pull-to-refresh, React mobile UI
**Confidence:** HIGH (verified against MDN, vite-plugin-pwa docs, Playwright device descriptors)

---

## Summary

Three areas in this phase have significant "looks simple, isn't" traps:

1. **iOS keyboard handling:** `window.resize` does NOT fire when the iOS keyboard opens. `visualViewport.height` is the only correct source. `100dvh` does NOT account for the keyboard on iOS (only browser chrome). Required: `window.visualViewport.addEventListener('resize', ...)`.

2. **Pull-to-refresh on iOS:** `overscroll-behavior-y: none` does NOT stop iOS rubber-band bounce. Must use `touchmove` with `{ passive: false }` and `e.preventDefault()` when `scrollTop === 0`.

3. **vite-plugin-pwa icon format:** Never combine `purpose: 'any maskable'` in one entry - always split into two entries. Use v0.21.x config.

**Primary recommendation:** Use the exact patterns in this document. iOS has many silent failures where "standard" approaches work on Android but not iOS Safari.

---

## iOS visualViewport Keyboard - The Truth

### Why standard approaches fail on iOS

| Approach                             | Android                   | iOS                                |
| ------------------------------------ | ------------------------- | ---------------------------------- |
| `window.resize`                      | ✅ fires on keyboard       | ❌ does NOT fire                    |
| `100dvh`                             | ✅ accounts for keyboard   | ❌ only accounts for browser chrome |
| `interactive-widget=resizes-content` | ✅ keyboard shrinks layout | ❌ silently ignored                 |
| `visualViewport.resize`              | ✅                         | ✅ (with ~1s close delay)           |

### Correct keyboard detection pattern

```tsx
// Listen to focusin/focusout - more reliable than viewport resize
// Avoids false positives from rotation/zoom/address-bar collapse
const handleFocusIn = (e: FocusEvent) => {
  const target = e.target as HTMLElement;
  const triggersKeyboard = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.isContentEditable;
  if (triggersKeyboard) setKeyboardOpen(true);
};

// On blur, use visualViewport to confirm keyboard actually closed
const handleFocusOut = () => {
  // iOS delays visualViewport update by ~1s after keyboard closes
  setTimeout(() => {
    if (window.visualViewport) {
      setKeyboardOpen(window.visualViewport.height < window.screen.height * 0.75);
    } else {
      setKeyboardOpen(false);
    }
  }, 300);
};

document.addEventListener('focusin', handleFocusIn);
document.addEventListener('focusout', handleFocusOut);
```

### Correct CSS for input above keyboard

```tsx
// useVisualViewport hook
function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // window.innerHeight - vv.height = keyboard height (+ any browser chrome shift)
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardHeight(kh);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update); // iOS Safari also fires scroll on vv
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return keyboardHeight;
}
```

```css
/* Input container anchored above keyboard */
.chat-input-container {
  position: sticky;
  bottom: 0;
  /* React: set via inline style --keyboard-height: ${keyboardHeight}px */
  padding-bottom: max(env(safe-area-inset-bottom), var(--keyboard-height, 0px));
}

/* safe-area-inset-bottom REQUIREMENTS */
/* 1. Must have viewport-fit=cover in <meta name="viewport"> */
/* 2. iOS sets safe-area to 0 while keyboard is open - no double-application needed */
```

### Meta viewport (required)
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### iOS-specific bugs to handle
- iOS 15: `window.resize` fires during touch gestures → already using `visualViewport`
- iOS 16/17: `visualViewport.height` updates ~1s late after keyboard closes → use `setTimeout(update, 300)`
- All iOS: `position: fixed` elements need `transform: translate3d(0,0,0)` to stay above keyboard

---

## Pull-to-Refresh - Correct Pattern

### The two lines that kill most PTR implementations

```ts
// 1. MUST use { passive: false } - otherwise e.preventDefault() is silently ignored on iOS
container.addEventListener('touchmove', onTouchMove, { passive: false });

// 2. Guard FIRST in touchmove handler - before any other logic
const onTouchMove = (e: TouchEvent) => {
  if (container.scrollTop > 0) { cancel(); return; } // not at top, no PTR
  // ...rest of PTR logic
  e.preventDefault(); // now this actually works
};
```

### Complete hook pattern

```tsx
function usePullToRefresh(
  containerRef: RefObject<HTMLElement>,
  onRefresh: () => Promise<void>
) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDistance = useRef(0);
  const THRESHOLD = 60;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) return; // only arm at top
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (el.scrollTop > 0) return; // guard - must be first
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) return;
      pullDistance.current = dy;
      setPulling(dy > 10);
      e.preventDefault(); // works because { passive: false }
    };

    const onTouchEnd = async () => {
      if (pullDistance.current >= THRESHOLD) {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
      }
      setPulling(false);
      pullDistance.current = 0;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false }); // ← critical
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef, onRefresh]);

  return { pulling, refreshing };
}
```

### Container CSS (required)

```css
.scroll-container {
  overflow-y: auto;
  overscroll-behavior-y: none; /* Android: disables native PTR. iOS: partial. */
  -webkit-overflow-scrolling: touch; /* iOS momentum scroll */
}
```

### iOS note
`overscroll-behavior-y: none` stops scroll *chaining* on iOS but NOT the rubber-band bounce. The `e.preventDefault()` in `{ passive: false }` touchmove is what actually stops it on iOS.

---

## vite-plugin-pwa - Correct Config (v0.21.x)

### Install
```bash
pnpm add -D vite-plugin-pwa
# Optional icon generator:
pnpm add -D @vite-pwa/assets-generator
```

### Minimal SPA config

```ts
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        navigateFallback: 'index.html', // SPA offline routing
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'S.E.N.S.O.',
        short_name: 'SENSO',
        display: 'standalone',
        start_url: '/',
        background_color: '#ffffff',
        theme_color: '#7c3aed',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any', // ← NEVER combine 'any maskable' in one entry
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable', // ← separate entry for maskable
          },
        ],
      },
    }),
  ],
});
```

### Icon anti-pattern to avoid

```ts
// ❌ WRONG - Chrome/Android will reject this
{ src: 'icon-512.png', purpose: 'any maskable' }

// ✅ CORRECT - separate entries
{ src: 'icon-512.png', purpose: 'any' }
{ src: 'maskable-512.png', purpose: 'maskable' }
```

Maskable icon safe zone: center circle with diameter = 80% of icon size (≈410px for 512px). Keep content within that circle.

---

## Don't Hand-Roll

| Problem                      | Don't Build                  | Use Instead                                 | Why                                                     |
| ---------------------------- | ---------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| iOS keyboard detection       | `window.resize` listener     | `visualViewport.resize`                     | `window.resize` doesn't fire on iOS keyboard open       |
| PTR passive guard            | Custom scroll position check | `{ passive: false }` touchmove              | `e.preventDefault()` silently fails on passive handlers |
| PWA icon                     | One `any maskable` entry     | Two separate entries                        | Chrome rejects combined purpose values                  |
| `overscroll-behavior` on iOS | CSS only                     | CSS + `e.preventDefault()` in passive:false | iOS ignores CSS overscroll for rubber-band              |

---

## Common Pitfalls

### Pitfall 1: Using `position: fixed` for chat input on iOS
**What goes wrong:** Fixed elements on iOS jump/flicker when keyboard opens because iOS reflows the viewport.
**How to avoid:** Use `position: sticky; bottom: 0` inside a flex column instead. `sticky` tracks the scroll container, not the viewport.

### Pitfall 2: Safe-area double-application
**What goes wrong:** Applying `env(safe-area-inset-bottom)` AND keyboard height leads to excess padding.
**How to avoid:** iOS sets `safe-area-inset-bottom` to 0 while keyboard is open. Use `max()` not addition: `max(env(safe-area-inset-bottom), var(--keyboard-height, 0px))`.

### Pitfall 3: vite-plugin-pwa not generating SW in dev
**What goes wrong:** SW only registers in production build. Dev testing fails.
**How to avoid:** Add `devOptions: { enabled: true, type: 'module' }` for dev testing, but remove for production (it can cause caching issues during development).

### Pitfall 4: Table-to-card on mobile breaks sort
**What goes wrong:** Removing `<table>` removes `<th>` with sort click handlers.
**How to avoid:** Add sort controls above the card list on mobile (e.g., `<select>` or sort pills). Keep `<table className="hidden sm:table">` and `<ul className="sm:hidden">` in parallel.

---

## Sources

- MDN visualViewport API: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
- vite-plugin-pwa docs: https://vite-pwa-org.netlify.app/guide/
- Webkit blog: "CSS interactive-widget on iOS" - confirmed not supported
- overscroll-behavior MDN - confirmed iOS behavior differences

**Research date:** 2026-04-06
**Valid until:** 2026-10-06 (30 days for fast-moving PWA/iOS Safari behavior)
