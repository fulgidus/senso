# Research: PWA Mobile Patterns 2024–2025

> Covers: iOS visualViewport keyboard handling · vite-plugin-pwa v0.21.x · Pull-to-refresh in React

---

## Part 1 — iOS visualViewport API & Keyboard Handling

### Summary

iOS Safari does **not** resize the viewport when the on-screen keyboard (OSK) opens. It instead
**pushes the entire viewport upward** while keeping its internal height unchanged, making every
standard height measurement (`100vh`, `window.innerHeight`, `document.clientHeight`) useless
when the keyboard is present. The only reliable API is `window.visualViewport`. Dynamic viewport
units (`dvh`) help with browser-chrome collapse but **do not react to the keyboard on iOS**.

---

### 1.1 How iOS Safari behaves (vs. Android / native)

| Behavior | iOS Safari | Android Chrome | iOS Native App |
|---|---|---|---|
| Keyboard opens | Viewport pushed up, not shrunk | Layout viewport shrinks | Content shrinks smoothly |
| `window.innerHeight` | **Stale** (pre-keyboard value) | Updated | — |
| `visualViewport.height` | ✅ **Updated** | Updated | — |
| `resize` event on `window` | **Not fired** on keyboard open | Fired | — |
| `visualViewport` `resize` event | ✅ **Fired** | Fired | — |

Source: [Martijn Hols — How to detect the OSK in iOS Safari](https://martijnhols.nl/blog/how-to-detect-the-on-screen-keyboard-in-ios-safari) (April 2024)

---

### 1.2 Detecting keyboard open/close — recommended React hook

**Strategy:** Monitor `focusin`/`focusout` on keyboard-triggering elements (more reliable than
viewport resize monitoring, which also fires on rotation, zoom, and address-bar collapse).

```tsx
// hooks/useIsKeyboardOpen.ts
import { useEffect, useState } from 'react'

const KEYBOARD_INPUTS = new Set(['text', 'email', 'tel', 'number', 'password', 'search', 'url'])

const triggersKeyboard = (el: HTMLElement): boolean =>
  (el.tagName === 'INPUT' && KEYBOARD_INPUTS.has((el as HTMLInputElement).type)) ||
  el.tagName === 'TEXTAREA' ||
  el.hasAttribute('contenteditable')

export const useIsKeyboardOpen = (): boolean => {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onFocusIn  = (e: FocusEvent) => e.target && triggersKeyboard(e.target as HTMLElement) && setOpen(true)
    const onFocusOut = (e: FocusEvent) => e.target && triggersKeyboard(e.target as HTMLElement) && setOpen(false)

    document.addEventListener('focusin',  onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin',  onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return open
}
```

> **Caveat:** Returns `true` when an external physical keyboard is used too. If you need to
> distinguish, add a check that `visualViewport.height` decreased after the `focusin` event.

---

### 1.3 Getting the real viewport size (for sticky footer / chat input above keyboard)

```tsx
// hooks/useViewportHeight.ts
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

const useBrowserLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : () => {}

export const useViewportHeight = (): number => {
  const [height, setHeight] = useState<number>(
    () => window.visualViewport?.height ?? window.innerHeight
  )

  const update = useCallback(() => {
    const next = window.visualViewport?.height ?? window.innerHeight
    setHeight(h => (h === next ? h : next))
  }, [])

  useBrowserLayoutEffect(update, [update])

  useEffect(() => {
    // iOS: closing the OSK does NOT immediately update visualViewport.
    // The 1 s delay is a known workaround for that bug.
    const handler = () => {
      update()
      setTimeout(update, 1000) // ← iOS timing bug workaround
    }

    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    // This event fires on iOS when the keyboard opens; window.resize does NOT.
    window.visualViewport?.addEventListener('resize', handler)

    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
      window.visualViewport?.removeEventListener('resize', handler)
    }
  }, [update])

  return height
}
```

**Usage — chat layout that stays above keyboard:**

```tsx
// components/ChatLayout.tsx
export function ChatLayout({ children }: { children: React.ReactNode }) {
  const vh = useViewportHeight()

  return (
    // Use the measured height as a CSS custom property so the whole layout adapts
    <div style={{ height: vh, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {children}
    </div>
  )
}
```

Source: [Martijn Hols — How to get document height when OSK is open](https://martijnhols.nl/blog/how-to-get-document-height-ios-safari-osk) (April 2024)

---

### 1.4 CSS pattern — `dvh` + `interactive-widget`

For simpler cases (no complex JS needed), use CSS dynamic viewport units:

```css
/* index.css — full-height shell */
.app-shell {
  height: 100dvh;          /* dvh = dynamic viewport height, accounts for browser chrome */
  display: flex;
  flex-direction: column;
}
```

```html
<!-- index.html — viewport meta -->
<!-- interactive-widget=resizes-content makes Android Chrome shrink the layout viewport when keyboard opens -->
<!-- iOS Safari ignores this attribute but does NOT break with it -->
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0,
           viewport-fit=cover,
           interactive-widget=resizes-content"
/>
```

**Verdict by platform:**

| CSS approach | Android Chrome | iOS Safari |
|---|---|---|
| `100vh` | ❌ Ignores keyboard | ❌ Ignores keyboard |
| `100dvh` | ✅ Accounts for browser chrome | ✅ Accounts for browser chrome, **NOT** keyboard |
| `interactive-widget=resizes-content` | ✅ Shrinks layout with keyboard | ❌ Ignored (silently) |
| `visualViewport` JS hook | ✅ Works | ✅ Works (with 1 s delay patch) |

Source: [Stop Using dvh — loke.dev](https://loke.dev/blog/stop-using-dvh-interactive-widget-mobile-keyboard) (March 2026); [Fix keyboard overlap — dev.to](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a) (updated 2025)

---

### 1.5 Known bugs — iOS 15 / 16 / 17

| iOS Version | Bug | Workaround |
|---|---|---|
| iOS 15 | `window.resize` fires during touch gestures, interrupting drag | Listen on `visualViewport` instead of `window` |
| iOS 16/17 | `visualViewport.height` updates **late** after keyboard closes | `setTimeout(update, 1000)` after `resize` event |
| iOS 17 | Keyboard triggers `visualViewport.resize` but **not** `window.resize` | Always listen to both |
| iOS 26 (beta) | `visualViewport` change fires *after* keyboard dismiss animation, causing layout jump | No clean fix yet; see [SO #79758083](https://stackoverflow.com/questions/79758083) |
| WebKit #265578 | Visual viewport height updated late when Safari UI expands | Same 1 s setTimeout workaround |

---

### 1.6 `overscroll-behavior` — iOS vs. Android

```css
/* Recommended global reset for PWA apps that implement custom pull-to-refresh */
html, body {
  overscroll-behavior-y: none;   /* Android Chrome: disables native PTR AND elastic scroll */
}

.scrollable-list {
  overscroll-behavior-y: contain; /* Contain scroll chaining to this element */
}
```

**Critical difference:**

- **Android Chrome:** `overscroll-behavior: none` fully prevents pull-to-refresh AND scroll chaining. `contain` prevents chaining but keeps elastic bounce within the element. Works as documented.
- **iOS Safari:** `overscroll-behavior` is supported since **iOS 16** but behaves differently:
  - `none` / `contain` prevent **scroll chaining** between nested elements ✅
  - They do **NOT** prevent the native rubber-band "bounce" effect ❌
  - To suppress bounce on iOS, you must call `event.preventDefault()` in a `{ passive: false }` `touchmove` handler (see Part 3)
  - `overscroll-behavior` has no effect on iOS 15 and earlier

Source: [interop issue #788 — web-platform-tests](https://github.com/web-platform-tests/interop/issues/788); [MDN overscroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)

---

### 1.7 `safe-area-inset-bottom` — correct pattern

Required when running as a PWA in `display: standalone` mode on iPhone X+ (home indicator).

**Step 1 — enable in viewport meta** (required, otherwise `env()` returns 0):
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

**Step 2 — use `env()` in CSS:**
```css
.bottom-nav,
.chat-input-bar {
  /* Solid fallback for browsers without env() support */
  padding-bottom: 16px;
  /* Safe area override — only applies in standalone PWA or fullscreen */
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

/* When combining with keyboard height via CSS variable */
.chat-input-bar {
  padding-bottom: max(env(safe-area-inset-bottom), 8px);
  /* The keyboard push is handled by the parent container height */
}
```

**Step 3 — do NOT double-apply** when keyboard is open. The keyboard takes over the bottom
area, so `safe-area-inset-bottom` becomes 0 while the keyboard is visible. No special handling needed.

> **iOS PWA white-bar bug (2026):** A white gap sometimes appears below fixed bottom navs in
> standalone mode on recent iOS. Fix: add `background-color` to `body` and ensure the nav
> covers the full `safe-area-inset-bottom`. See [SO #79902310](https://stackoverflow.com/questions/79902310).

---

## Part 2 — vite-plugin-pwa (v0.21.x, 2024–2025)

### Summary

Latest stable: **v0.21.2** (released March 21, 2025). The `generateSW` strategy with
`registerType: 'autoUpdate'` is the correct choice for a hackathon SPA — zero custom service
worker code needed. The plugin uses Workbox under the hood.

---

### 2.1 Install

```bash
pnpm add -D vite-plugin-pwa
# Optional icon generator (generates all sizes from one SVG)
pnpm add -D @vite-pwa/assets-generator
```

---

### 2.2 Complete `vite.config.ts` for a React SPA

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ── Registration ─────────────────────────────────────────────────────
      registerType: 'autoUpdate',   // SW auto-activates on new deploy
      injectRegister: 'auto',       // Injects registration script automatically

      // ── Dev testing ──────────────────────────────────────────────────────
      devOptions: {
        enabled: true,              // Test SW in `vite dev` (use http, not https locally)
        type: 'module',
      },

      // ── App Shell precaching ─────────────────────────────────────────────
      workbox: {
        // Precache all build outputs — MUST include html or you get:
        // "WorkboxError non-precached-url index.html"
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],

        // SPA offline support: route all navigations through index.html
        navigateFallback: 'index.html',
        // Exclude API routes from the fallback
        navigateFallbackDenylist: [/^\/api\//],

        // Optional: runtime caching for API responses
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 }, // 5 min
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Increase if your JS chunks exceed 2 MB (common with AI libs)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        skipWaiting: true,          // Default: true — activate immediately
        clientsClaim: true,         // Default: true — take control immediately
        cleanupOutdatedCaches: true,
      },

      // ── Web App Manifest ─────────────────────────────────────────────────
      manifest: {
        name: 'S.E.N.S.O.',
        short_name: 'SENSO',
        description: 'Il tuo assistente finanziario personale',
        lang: 'it',
        dir: 'ltr',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',         // ← hides browser chrome, shows as native app
        orientation: 'portrait',
        start_url: '/',
        scope: '/',

        icons: [
          // 64 px — Windows taskbar / small displays
          {
            src: '/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          // 192 px — Android home screen (required)
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          // 512 px any — splash screen, high-DPI Android
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',            // ← separate entry from maskable
          },
          // 512 px maskable — adaptive icon for circular/squircle masks on Android
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',       // ← NEVER combine 'any maskable' — not spec-compliant
          },
        ],
      },

      // ── Static assets to include in precache beyond globPatterns ─────────
      includeAssets: ['apple-touch-icon-180x180.png', 'favicon.ico', 'favicon.svg'],
      includeManifestIcons: true,    // Default: true
    }),
  ],
})
```

---

### 2.3 `display: 'standalone'` — what it does

```
"display": "standalone"
```

- Removes the browser address bar and navigation buttons
- App appears in the OS app switcher as a native app
- `window.matchMedia('(display-mode: standalone)').matches` returns `true`
- On iOS, requires the user to "Add to Home Screen" (no install prompt API)
- `safe-area-inset-*` env vars become critical in this mode

---

### 2.4 Icon requirements — Preset Minimal 2023

| File | Size | Purpose | Where |
|---|---|---|---|
| `favicon.ico` | 48×48 | — | `<link rel="icon" href="/favicon.ico" sizes="48x48">` |
| `favicon.svg` | scalable | — | `<link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml">` |
| `apple-touch-icon-180x180.png` | 180×180 | — | `<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">` |
| `pwa-64x64.png` | 64×64 | manifest | Manifest `icons[]` |
| `pwa-192x192.png` | 192×192 | manifest | Manifest `icons[]` — **required** |
| `pwa-512x512.png` | 512×512 | `"any"` | Manifest `icons[]` — **required** |
| `maskable-icon-512x512.png` | 512×512 | `"maskable"` | Manifest `icons[]` — safe zone = 80% diameter circle |

**DO NOT** use `purpose: 'any maskable'` in the same entry — Chrome and Lighthouse treat it
as maskable only, which looks wrong for generic contexts.

**Maskable safe zone rule:** the important content of the icon must fit within a circle whose
diameter is **80% of the icon's smallest dimension**. For 512×512 that is a ≈410 px circle
centered in the image. Everything outside may be cropped.

**Generate all sizes from one SVG:**
```bash
# pwa-assets.config.ts
npx @vite-pwa/assets-generator --config pwa-assets.config.ts
```
```ts
// pwa-assets.config.ts
import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: 'minimal-2023',
  images: ['public/logo.svg'],        // ← your source SVG
})
```

Sources: [vite-pwa assets-generator docs](https://vite-pwa-org.netlify.app/assets-generator/);
[MDN — Define app icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons);
[GitHub release v0.21.2](https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v0.21.2)

---

### 2.5 Service worker registration pattern (React entry point)

The `registerType: 'autoUpdate'` + `injectRegister: 'auto'` handles everything automatically.
If you want a manual "new version available" toast:

```tsx
// main.tsx
import { registerSW } from 'virtual:pwa-register'

// Shows a toast with "Reload to update" when a new SW is waiting
const updateSW = registerSW({
  onNeedRefresh() {
    // show update prompt to user
    if (window.confirm('New version available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})
```

For `autoUpdate` (hackathon default), you don't need `registerSW` at all — the plugin script
handles it. Just verify in DevTools → Application → Service Workers.

---

## Part 3 — Pull-to-Refresh in React (Touch Events)

### Summary

The correct pattern attaches `touchstart`/`touchmove`/`touchend` to the **scrollable container
ref** (not `window`), guards with `scrollTop === 0`, uses `{ passive: false }` to call
`preventDefault()` on iOS (which does not respect `overscroll-behavior: none` for the bounce),
and relies on `overscroll-behavior-y: none` on Android to suppress the native PTR.

---

### 3.1 Complete hook implementation

```tsx
// hooks/usePullToRefresh.ts
import { useRef, useCallback, RefObject } from 'react'

interface Options {
  onRefresh: () => Promise<void>
  threshold?: number          // px of pull needed to trigger (default: 80)
  resistance?: number         // drag-to-move ratio (default: 2.5 — slower than finger)
}

interface PTRState {
  /** Attach this ref to your scrollable container */
  scrollRef: RefObject<HTMLDivElement>
  /** Current pull distance (0..threshold) — bind to CSS translateY or marginTop */
  pullDistance: number
  /** True while the refresh callback is running */
  isRefreshing: boolean
}

export function usePullToRefresh({ onRefresh, threshold = 80, resistance = 2.5 }: Options) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Use refs for touch state — no re-renders during the gesture
  const startY   = useRef(0)
  const pulling  = useRef(false)

  const [pullDistance, setPullDistance] = React.useState(0)
  const [isRefreshing, setRefreshing]   = React.useState(false)

  const onTouchStart = useCallback((e: TouchEvent) => {
    const el = scrollRef.current
    // ── Guard: only allow PTR when already at the top ──────────────────────
    if (!el || el.scrollTop > 0) return

    startY.current  = e.touches[0].clientY
    pulling.current = true
  }, [])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return

    const el = scrollRef.current
    if (!el) return

    // Re-check: user may have scrolled down since touchstart
    if (el.scrollTop > 0) {
      pulling.current = false
      setPullDistance(0)
      return
    }

    const deltaY = e.touches[0].clientY - startY.current
    if (deltaY <= 0) return  // pulling up — ignore

    // ── iOS: prevent native rubber-band / scroll chaining ──────────────────
    // This only works with { passive: false } on the event listener
    e.preventDefault()

    // Apply resistance so the indicator moves slower than the finger
    const capped = Math.min(deltaY / resistance, threshold * 1.5)
    setPullDistance(capped)
  }, [resistance, threshold])

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return
    pulling.current = false

    if (pullDistance >= threshold) {
      setRefreshing(true)
      setPullDistance(0)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    } else {
      // Snap back
      setPullDistance(0)
    }
  }, [pullDistance, threshold, onRefresh])

  // Attach to the DOM element imperatively so we can pass { passive: false }
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    // passive: false is required to call e.preventDefault() inside touchmove
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  return { scrollRef, pullDistance, isRefreshing }
}
```

---

### 3.2 Using the hook in a component

```tsx
// components/ChatFeed.tsx
import { usePullToRefresh } from '../hooks/usePullToRefresh'

export function ChatFeed({ messages, onRefresh }: Props) {
  const { scrollRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh,
    threshold: 72,
  })

  return (
    // overscroll-behavior-y: none → disables native PTR on Android Chrome
    // on iOS it has no effect (bounce is blocked by preventDefault in the hook)
    <div
      ref={scrollRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        overscrollBehaviorY: 'none',
        WebkitOverflowScrolling: 'touch',  // smooth momentum scroll on iOS
      }}
    >
      {/* Pull indicator */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? 'transform 0.2s ease' : 'none',
          display: 'flex',
          justifyContent: 'center',
          height: 0,                    // zero height — the translateY reveals it
          overflow: 'visible',
        }}
      >
        {(pullDistance > 0 || isRefreshing) && (
          <span
            style={{
              transform: `rotate(${(pullDistance / 72) * 360}deg)`,
              display: 'block',
              transition: isRefreshing ? 'none' : undefined,
            }}
          >
            {isRefreshing ? '⏳' : '↓'}
          </span>
        )}
      </div>

      {/* Content */}
      {messages.map(m => <MessageBubble key={m.id} message={m} />)}
    </div>
  )
}
```

---

### 3.3 Key guards and iOS-specific notes

```
scrollTop === 0  check
```

| Check | Why it matters |
|---|---|
| `el.scrollTop > 0` in `touchstart` | Don't start a PTR gesture mid-scroll |
| `el.scrollTop > 0` in `touchmove` | Cancel if user scrolls down after long press |
| `deltaY <= 0` in `touchmove` | Don't trigger on upward swipes |
| `e.preventDefault()` in `touchmove` | **Prevents iOS rubber-band** — only works with `passive: false` |
| `overscrollBehaviorY: 'none'` on container | **Prevents Android native PTR** |

**Why `passive: false` on `touchmove` matters on iOS:**

iOS Safari registers scroll-event listeners as passive by default since iOS 13. Calling
`e.preventDefault()` on a passive listener has no effect and throws a console warning.
You **must** explicitly set `{ passive: false }` when adding the listener or the iOS bounce
will coexist with your custom PTR, causing a jarring double-animation.

**Android `overscroll-behavior` note (2025 update):**

As of Chrome 131, `overscroll-behavior` was extended to also respect keyboard scroll events.
The property continues to work correctly for touch scroll overscroll prevention. Use `none` on
`html`/`body` or the specific container element — not both, to avoid unexpected behaviour with
nested scrollers.

---

### 3.4 Combining with a keyboard-aware layout

```tsx
// Full chat page integrating all three patterns
export function ChatPage() {
  const vh = useViewportHeight()          // Part 1: real height on iOS

  const { scrollRef, pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: async () => { /* fetch older messages */ },
  })

  return (
    <div
      style={{
        height: vh,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable message list with PTR */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overscrollBehaviorY: 'none' }}>
        {/* pull indicator + messages */}
      </div>

      {/* Input pinned above keyboard — height collapses when keyboard opens
          because the parent `height: vh` shrinks via visualViewport  */}
      <div
        style={{
          flexShrink: 0,
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        }}
      >
        <input type="text" placeholder="Scrivi un messaggio…" />
      </div>
    </div>
  )
}
```

---

## Sources

### Kept
- **Martijn Hols blog — OSK detection** (martijnhols.nl, Apr 2024) — primary source for iOS keyboard detection pattern; original hook code with production-tested workarounds
- **Martijn Hols blog — document height with OSK** (martijnhols.nl, Apr 2024) — `useViewportSize` implementation, `setTimeout(update, 1000)` iOS bug workaround
- **loke.dev — interactive-widget vs dvh** (Mar 2026) — clearest explanation of why `dvh` fails for keyboard and what `interactive-widget=resizes-content` actually does
- **dev.to / Francisco Moretti — keyboard overlap** (updated Aug 2025) — real-world `h-dvh` pattern and `interactiveWidget` Next.js config
- **MDN — Define app icons** (Jun 2025) — authoritative maskable icon spec, safe zone diagram
- **vite-pwa assets-generator docs** (netlify, 2024) — `purpose: 'any'` vs `'maskable'` split, preset-minimal-2023 canonical icon list
- **deepwiki vite-plugin-pwa** — GenerateSW strategy internals, globPatterns, navigateFallback, runtimeCaching tables
- **LogRocket — pull-to-refresh in React** (Nov 2022, still accurate) — baseline touch event pattern
- **GitHub interop #788** — overscroll-behavior iOS vs Android compatibility notes

### Dropped
- somethingsblog.com PTR article — thin content, omits the `passive: false` critical detail
- timsanteford.com PWA article — good intro but dated icon config (`any maskable` combined)
- Stack Overflow #78669293 — question without useful answer
- easydiffusion GitHub issue — CSS-only PTR disable, not React-specific

---

## Gaps

1. **iOS `visualViewport` + external keyboard:** no reliable way to distinguish physical keyboard from touch keyboard via the viewport APIs alone; document if this matters for SENSO.
2. **`interactive-widget` Safari timeline:** Apple has not committed to shipping `interactive-widget=resizes-content`. Track [WebKit Feature Status](https://webkit.org/status/) for updates.
3. **vite-plugin-pwa + Vite 7:** v0.21.2 targets Vite 5/6; verify peer dep compatibility before upgrading.
4. **PTR + IntersectionObserver alternative:** could replace the scroll-top guard with an IO sentinel at the top of the list for more robust detection.
