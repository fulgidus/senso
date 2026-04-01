# Phase 12: UX, Accessibility & Mobile Polish - Research

**Researched:** 2026-04-01
**Domain:** Frontend UX/accessibility/mobile interaction quality (React 19, Tailwind CSS 4, Vite SPA)
**Confidence:** HIGH

## Summary

Phase 12 adds 11 UX/accessibility/mobile features to the existing S.E.N.S.O. Vite + React 19 SPA: ripple feedback, pull-to-refresh, dynamic micro-copy, offline detection, menu animation, haptic feedback, privacy toggle for balances, `prefers-reduced-motion`/`prefers-contrast`/`prefers-color-scheme` media query support, page transition animations, i18n centralization of hardcoded locale strings, and optimistic UI patterns.

The codebase already has strong foundations: i18next with dual locales, a custom ThemeProvider that handles `prefers-color-scheme` via `matchMedia`, `tw-animate-css` for Tailwind animation utilities, and a working optimistic UI pattern in SettingsScreen. The main gaps are: (1) 14 hardcoded `"it-IT"` locale strings that bypass i18n, (2) no reduced-motion or high-contrast media query handling, (3) no offline detection, (4) no haptic/ripple feedback, and (5) no page transition animations.

**Primary recommendation:** Implement all 11 features as pure CSS + lightweight React hooks/utilities with zero new npm dependencies. The existing stack (Tailwind CSS 4.2, tw-animate-css, React 19, i18next) provides everything needed. No libraries to add.

## Project Constraints (from AGENTS.md)

### Enforced Conventions
- **Docker Compose only:** Never run `pnpm`, `uv run`, or `python` directly on host. Use `docker compose run --rm frontend pnpm build` for build checks, `docker compose run --rm frontend pnpm test` for tests.
- **i18n rules:** Italian (`it`) is primary. Never hardcode Italian strings in source code. All user-facing strings go in `senso/src/i18n/locales/{it,en}.json` with dot notation keys.
- **erasableSyntaxOnly: true** in tsconfig — no parameter decorators, no `@property`. Use manual property patterns.
- **No Alembic, no Qdrant** — backend conventions unchanged; this phase is frontend-only.
- **Card conventions:** `affordability_verdict` is a typed schema field. A2UI `details_a2ui` is supplementary.

### Stack Constraints
- **React 19.2.4** with Vite 7.3.1 (NOT Next.js App Router — despite AGENTS.md mention, actual build is Vite SPA)
- **react-router-dom 7.13.2** for routing (no App Router, no View Transitions API integration via framework)
- **Tailwind CSS 4.2** with `tw-animate-css` already installed
- **shadcn components** with Radix UI primitives
- **TypeScript ~5.9.3** with `erasableSyntaxOnly: true`

## Standard Stack

### Core (Already Installed — No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|-------------|
| tailwindcss | 4.2.1 | Utility-first CSS, media queries, transitions | Already installed; `@media (prefers-reduced-motion)` and `@media (prefers-contrast)` handled via custom variants |
| tw-animate-css | 1.4.0 | Animation utility classes | Already installed; provides `animate-in`, `fade-in`, `slide-in-from-*` classes |
| react | 19.2.4 | UI framework | Already installed; hooks for all custom behavior |
| i18next + react-i18next | 26.0.1 / 17.0.1 | Internationalization | Already installed; locale-aware number/date formatting via `i18n.language` |
| react-router-dom | 7.13.2 | Client-side routing | Already installed; `useLocation` for page transition triggers |

### Supporting (No New Dependencies Needed)
| Utility | Type | Purpose | When to Use |
|---------|------|---------|------------|
| `useLocaleFormat` hook | Custom hook | Wraps `Intl.NumberFormat`/`Intl.DateTimeFormat` with `i18n.language` | Every `toLocaleString("it-IT")` replacement |
| `useOnlineStatus` hook | Custom hook | `navigator.onLine` + `online`/`offline` events | Offline banner component |
| `useReducedMotion` hook | Custom hook | `matchMedia("(prefers-reduced-motion: reduce)")` | All animation conditionals |
| `useRipple` hook | Custom hook | Pointer-event-driven CSS ripple | Interactive buttons/cards |
| `usePullToRefresh` hook | Custom hook | Touch event tracking + pull gesture | Mobile scroll containers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|-----------|----------|---------|
| Custom CSS ripple | `react-ripples` package | Adds dependency for something achievable in ~30 lines of CSS + hook |
| Custom pull-to-refresh | `react-pull-to-refresh` | Adds dependency; our implementation only needs to work in the chat/profile scroll containers |
| View Transitions API | `react-router` `viewTransition` prop | Not available — requires `startViewTransition` which has limited browser support and no react-router-dom integration in v7 |
| framer-motion | CSS transitions + tw-animate-css | Framer-motion is 30KB+ gzipped; our transitions are simple fades/slides already covered by tw-animate-css |

**Installation:** None — no new packages required.

## Architecture Patterns

### Recommended File Structure
```
senso/src/
├── hooks/
│   ├── useLocaleFormat.ts       # Intl formatting with i18n.language
│   ├── useOnlineStatus.ts       # navigator.onLine + events
│   ├── useReducedMotion.ts      # prefers-reduced-motion detection
│   ├── useHighContrast.ts       # prefers-contrast detection
│   └── useHapticFeedback.ts     # Vibration API with feature detection
├── components/
│   ├── RippleButton.tsx         # Ripple effect wrapper (or inline in existing button)
│   ├── OfflineBanner.tsx        # Sticky offline indicator
│   ├── PullToRefresh.tsx        # Pull gesture container
│   ├── BalanceMask.tsx          # Privacy toggle for balances
│   └── PageTransition.tsx       # Route-level fade/slide wrapper
├── index.css                    # Add @media reduced-motion, high-contrast rules
└── i18n/locales/
    ├── it.json                  # Add offline/microcopy/accessibility keys
    └── en.json                  # Mirror
```

### Pattern 1: Custom Media Query Hook (Reusable Foundation)
**What:** Single pattern for all `prefers-*` media queries — create once, reuse for `reduced-motion`, `contrast`, `color-scheme`.
**When to use:** Every time a component needs to branch on a user's OS-level accessibility preference.
**Example:**
```typescript
// hooks/useMediaQuery.ts
import { useSyncExternalStore } from "react"

function subscribe(query: string) {
  return (callback: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener("change", callback)
    return () => mql.removeEventListener("change", callback)
  }
}

function getSnapshot(query: string) {
  return () => window.matchMedia(query).matches
}

function getServerSnapshot() {
  return false // SSR-safe fallback (Vite SPA won't hit this)
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    getSnapshot(query),
    getServerSnapshot
  )
}

// hooks/useReducedMotion.ts
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}

// hooks/useHighContrast.ts
export function useHighContrast(): boolean {
  return useMediaQuery("(prefers-contrast: more)")
}
```

### Pattern 2: Locale-Aware Formatting Hook (i18n Fix)
**What:** Centralised `Intl.NumberFormat` / `Intl.DateTimeFormat` that reads `i18n.language` instead of hardcoded `"it-IT"`.
**When to use:** Replace every `toLocaleString("it-IT")` and `new Intl.NumberFormat("it-IT")` call.
**Example:**
```typescript
// hooks/useLocaleFormat.ts
import { useTranslation } from "react-i18next"
import { useMemo } from "react"

export function useLocaleFormat() {
  const { i18n } = useTranslation()
  const locale = i18n.language // "it" or "en"

  return useMemo(() => ({
    currency: (value: number, opts?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
        ...opts,
      }).format(value),

    number: (value: number, opts?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, opts).format(value),

    date: (value: string | Date, opts?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, opts).format(
        typeof value === "string" ? new Date(value) : value
      ),
  }), [locale])
}
```

### Pattern 3: Optimistic UI (Already Established)
**What:** Immediately update local state, fire API call, revert on error.
**When to use:** Any user toggle or preference change.
**Example:** Already in `SettingsScreen.tsx` lines 94-115 (`handlePrivacyToggle`). Follow this exact pattern for the balance privacy mask toggle.

### Pattern 4: CSS-Only Ripple Effect
**What:** Pseudo-element ripple triggered by pointer events, no JS animation library.
**When to use:** Primary action buttons, nav items, interactive cards.
**Example:**
```css
/* index.css */
.ripple-target {
  position: relative;
  overflow: hidden;
}

.ripple-target::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at var(--ripple-x, 50%) var(--ripple-y, 50%),
    currentColor 0%, transparent 60%);
  opacity: 0;
  transform: scale(0);
  transition: transform 0.4s ease-out, opacity 0.4s ease-out;
  pointer-events: none;
}

.ripple-target:active::after {
  opacity: 0.12;
  transform: scale(2.5);
  transition: transform 0s, opacity 0s;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .ripple-target::after {
    transition: none;
    transform: none;
  }
  .ripple-target:active::after {
    opacity: 0.12;
    transform: none;
  }
}
```

### Pattern 5: Page Transition with CSS + Route Key
**What:** Fade + slight slide on route changes using CSS transitions keyed to `location.pathname`.
**When to use:** Wrap the main content outlet in `AppShell`.
**Example:**
```tsx
// components/PageTransition.tsx
import { useLocation } from "react-router-dom"
import { useReducedMotion } from "@/hooks/useReducedMotion"
import { useRef, useEffect, useState, type ReactNode } from "react"

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const [isVisible, setIsVisible] = useState(true)
  const prevPathRef = useRef(location.pathname)

  useEffect(() => {
    if (reducedMotion || prevPathRef.current === location.pathname) return
    prevPathRef.current = location.pathname
    setIsVisible(false)
    // Short fade-out, then show new content
    const timer = setTimeout(() => setIsVisible(true), 80)
    return () => clearTimeout(timer)
  }, [location.pathname, reducedMotion])

  if (reducedMotion) return <>{children}</>

  return (
    <div
      className={[
        "transition-opacity duration-150 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      {children}
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Adding framer-motion or react-spring:** Overkill for simple fade/slide transitions. The existing `tw-animate-css` + CSS transitions cover all needs. Adding 30KB+ for 5 animations is a bad trade.
- **Global event listeners without cleanup:** Every `addEventListener` in a hook must return a cleanup function. This is already done correctly in `theme-provider.tsx` — follow that pattern.
- **Polling navigator.onLine:** Don't poll. Use the `online`/`offline` event listeners. `navigator.onLine` is a snapshot, not a reliable state machine.
- **Blocking on Vibration API absence:** The Vibration API is not available on iOS Safari. Always feature-detect with `if ('vibrate' in navigator)` and silently skip.
- **Using `toLocaleString()` without locale argument:** Calling `.toLocaleString()` with no argument uses browser default, which may differ from the user's i18n choice. Always pass the i18n locale.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|------------|------------|-----|
| Number/date locale formatting | Custom format functions per component | `useLocaleFormat` hook wrapping `Intl.NumberFormat`/`Intl.DateTimeFormat` with `i18n.language` | `Intl` is built into every browser, locale-correct, handles thousands separators and currency symbols |
| Reduced motion detection | Manual `window.matchMedia` in every component | `useReducedMotion()` hook via `useSyncExternalStore` | Centralized, SSR-safe, auto-updates on OS preference change |
| Online/offline detection | Custom polling or manual state | `useOnlineStatus()` hook with `online`/`offline` events | Event-driven, no wasted cycles, handles edge cases |
| Animation library | framer-motion, react-spring, GSAP | `tw-animate-css` + CSS `transition-*` classes already in project | Zero new bundle cost, sufficient for fades/slides/scales |
| Ripple feedback | `react-ripples` npm package | CSS pseudo-element `::after` with `radial-gradient` | 0 bytes JS, works on all interactive elements via class name |

**Key insight:** Every feature in this phase can be implemented with zero new npm dependencies. The browser platform APIs (`Intl`, `matchMedia`, `navigator.onLine`, `navigator.vibrate`, CSS media queries) plus the already-installed Tailwind/tw-animate-css stack cover everything.

## Common Pitfalls

### Pitfall 1: Vibration API Silent Failure on iOS
**What goes wrong:** Code calls `navigator.vibrate(50)` assuming it works everywhere. iOS Safari has never supported it and will throw or silently fail depending on context.
**Why it happens:** MDN marks Vibration API as "limited availability" — it works on Chrome/Android but not on Safari/iOS.
**How to avoid:** Always feature-detect: `if ('vibrate' in navigator) { navigator.vibrate(pattern) }`. Never make haptic feedback the only user feedback — it must supplement visual/audio feedback.
**Warning signs:** Testing only on desktop Chrome during development.

### Pitfall 2: Pull-to-Refresh Conflicts with Browser Default
**What goes wrong:** Custom pull-to-refresh fights with Chrome's built-in pull-to-refresh (the refresh circle on mobile Chrome).
**Why it happens:** Chrome on Android has a native pull-to-refresh gesture that fires before JS touch handlers.
**How to avoid:** Add `overscroll-behavior-y: contain` on the scroll container to disable browser's pull-to-refresh. Only add this CSS on elements where custom pull-to-refresh is active.
**Warning signs:** Double-refresh, or custom pull gesture never triggers on Android Chrome.

### Pitfall 3: Reduced Motion Means ALL Motion, Not Just Decorative
**What goes wrong:** Developers disable decorative animations but leave functional transitions (like page transitions or loading spinners) running, which still causes issues for vestibular disorder users.
**Why it happens:** Misunderstanding that `prefers-reduced-motion: reduce` means "reduce" not "remove decorative only."
**How to avoid:** When `prefers-reduced-motion: reduce` is active: (1) disable all transition/animation CSS, (2) replace slide transitions with instant cuts, (3) keep loading spinners but reduce their speed significantly or replace with progress bars.
**Warning signs:** User with motion sensitivity still reports discomfort.

### Pitfall 4: Hardcoded Locale in Intl Formatters
**What goes wrong:** `toLocaleString("it-IT")` works perfectly for Italian users but shows Italian number formatting (1.234,56) to English users who expect (1,234.56).
**Why it happens:** During initial development, Italian was the only locale and devs hardcoded it for speed.
**How to avoid:** Always read from `i18n.language`. The `useLocaleFormat` hook makes this automatic. Search for `"it-IT"` regex across the codebase — there are exactly 14 instances to fix.
**Warning signs:** Switch language to English and check if numbers still format Italian-style.

### Pitfall 5: Offline Banner Z-Index War
**What goes wrong:** Offline banner renders under the header, or behind modals/drawers.
**Why it happens:** Existing z-index layers: header `z-30`, sidebar overlay `z-40`, sidebar drawer `z-50`. New offline banner must sit above header but below modals.
**How to avoid:** Use `z-35` or `z-[35]` for the offline banner. Position it as `fixed top-14` (below the 56px header) so it doesn't overlap the header.
**Warning signs:** Banner invisible on mobile when header is sticky.

### Pitfall 6: Privacy Balance Mask Must Be Consistent
**What goes wrong:** Some balance numbers are masked but others leak through in different screens (profile summary, chart tooltips, questionnaire recap).
**Why it happens:** Balance values appear in multiple components across multiple features: ProfileScreen, ChatScreen, QuestionnaireScreen, UncategorizedScreen. Easy to miss one.
**How to avoid:** Create a single `<BalanceMask>` component or `useMaskedAmount` hook that reads a shared privacy preference from context/localStorage. Audit every component that renders currency amounts.
**Warning signs:** Toggle privacy mode and navigate to every screen — any unmasked number is a bug.

## Code Examples

Verified patterns from the existing codebase and browser APIs:

### Online/Offline Detection Hook
```typescript
// hooks/useOnlineStatus.ts
import { useSyncExternalStore } from "react"

function subscribe(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

function getSnapshot() {
  return navigator.onLine
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
```

### Offline Banner Component
```tsx
// components/OfflineBanner.tsx
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useTranslation } from "react-i18next"
import { WifiOff } from "lucide-react"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const { t } = useTranslation()

  if (isOnline) return null

  return (
    <div
      role="alert"
      className="fixed top-14 left-0 right-0 z-[35] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4" />
      {t("app.offlineBanner")}
    </div>
  )
}
```

### Haptic Feedback Utility
```typescript
// hooks/useHapticFeedback.ts
export function useHapticFeedback() {
  return {
    tap: () => {
      if ("vibrate" in navigator) {
        navigator.vibrate(10)
      }
    },
    success: () => {
      if ("vibrate" in navigator) {
        navigator.vibrate([10, 50, 10])
      }
    },
    error: () => {
      if ("vibrate" in navigator) {
        navigator.vibrate([50, 30, 50, 30, 50])
      }
    },
  }
}
```

### Menu Animation Enhancement (Sidebar Drawer)
```tsx
// In AppShell.tsx — enhance existing drawer transition
// Current: "transition-transform duration-200"
// Enhanced:
const drawerClasses = [
  "fixed left-0 top-0 z-50 flex h-full w-72 flex-col",
  "bg-background border-r border-border shadow-xl",
  "transition-transform duration-200 ease-out",
  drawerOpen ? "translate-x-0" : "-translate-x-full",
].join(" ")

// Overlay enhancement: add transition
const overlayClasses = [
  "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm",
  "transition-opacity duration-200",
  drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none",
].join(" ")
```

### Pull-to-Refresh Pattern
```typescript
// hooks/usePullToRefresh.ts
import { useRef, useCallback, useEffect } from "react"
import { useReducedMotion } from "./useReducedMotion"

type PullToRefreshOptions = {
  onRefresh: () => Promise<void>
  threshold?: number // px to pull before triggering (default 80)
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: PullToRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const pulling = useRef(false)
  const reducedMotion = useReducedMotion()

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current
    if (!el || el.scrollTop > 0) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }, [])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!pulling.current) return
    pulling.current = false
    const deltaY = e.changedTouches[0].clientY - startY.current
    if (deltaY >= threshold) {
      void onRefresh()
    }
  }, [onRefresh, threshold])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchEnd])

  return { containerRef, reducedMotion }
}
```

### prefers-reduced-motion CSS Integration
```css
/* Add to index.css */

/* Global reduced-motion override */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* High contrast mode — increase border visibility */
@media (prefers-contrast: more) {
  :root {
    --border: oklch(0.5 0 0);
    --ring: oklch(0.3 0 0);
  }
  .dark {
    --border: oklch(0.7 0 0);
    --ring: oklch(0.8 0 0);
  }
}
```

### Balance Privacy Mask
```tsx
// components/BalanceMask.tsx
import { useTranslation } from "react-i18next"

type BalanceMaskProps = {
  value: string | number
  masked: boolean
  className?: string
}

export function BalanceMask({ value, masked, className }: BalanceMaskProps) {
  const { t } = useTranslation()

  if (masked) {
    return (
      <span className={className} aria-label={t("accessibility.balanceHidden")}>
        ****
      </span>
    )
  }

  return <span className={className}>{value}</span>
}
```

## i18n Hardcoded Locale Audit

**14 instances of hardcoded `"it-IT"` found — all must be replaced with `i18n.language`:**

| File | Line(s) | Pattern | Fix |
|------|---------|---------|-----|
| `ChatScreen.tsx` | 130 | `amount.toLocaleString("it-IT")` | Use `useLocaleFormat().number(amount)` |
| `ProfileScreen.tsx` | 39 | `new Intl.NumberFormat("it-IT", ...)` | Use `useLocaleFormat().currency(value)` |
| `ProfileScreen.tsx` | 204 | `new Date(...).toLocaleDateString("it-IT")` | Use `useLocaleFormat().date(value)` |
| `ProfileScreen.tsx` | 392, 423, 464 | `value.toLocaleString("it-IT")` | Use `useLocaleFormat().number(value)` |
| `UncategorizedScreen.tsx` | 301 | `group.netAmount.toLocaleString("it-IT", ...)` | Use `useLocaleFormat().currency(amount)` |
| `QuestionnaireScreen.tsx` | 602, 612, 618, 622, 626, 962, 1022 | 7 instances of `toLocaleString("it-IT", ...)` | Use `useLocaleFormat().number(value)` or `.currency(value)` |

**Additionally, 3 hardcoded Italian strings (`/anno`) in QuestionnaireScreen.tsx lines 618, 622, 626** — must be replaced with `t("questionnaire.perYear")` or equivalent i18n key.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|-------------|-----------------|--------------|--------|
| `window.matchMedia` manual subscribe | `useSyncExternalStore` with `matchMedia` | React 18+ (2022) | Tear-free reads, concurrent-safe, SSR-compatible |
| `navigator.onLine` polling | Event-driven `online`/`offline` listeners | Baseline since 2015 | Zero wasted CPU cycles, instant detection |
| JS animation libraries for simple transitions | CSS `transition` + `@starting-style` + `tw-animate-css` | Tailwind 4 (2025) | Zero JS bundle cost for common animations |
| `requestAnimationFrame` ripple | CSS `::after` pseudo-element ripple | Modern CSS (2023+) | Pure CSS, GPU-accelerated, no JS event loop blocking |
| View Transitions API (experimental) | CSS transitions with route key | Ongoing (2025-2026) | View Transitions lacks react-router-dom v7 integration; CSS transitions are reliable now |

**Deprecated/outdated:**
- `addListener` on `MediaQueryList`: Use `addEventListener("change", ...)` instead (deprecated since 2020).
- `window.onLine` property alone: Unreliable — can return `true` when behind a captive portal. Always pair with `fetch` probe for critical offline detection.

## Open Questions

1. **Pull-to-refresh visual indicator**
   - What we know: The gesture detection is straightforward with touch events. `overscroll-behavior-y: contain` prevents browser default.
   - What's unclear: What visual indicator to show during the pull — spinner? Progress bar? The design hasn't been specified.
   - Recommendation: Use a simple rotating spinner icon that appears above the content area during pull. Match the existing loading pattern from `LoadingScreen`.

2. **Dynamic micro-copy scope**
   - What we know: Phase description mentions "dynamic micro-copy" but doesn't specify which micro-copy to make dynamic.
   - What's unclear: Which specific micro-copy should change based on context (time of day greetings? Contextual hints? Random motivational messages?).
   - Recommendation: Implement time-of-day greeting in the chat welcome screen (morning/afternoon/evening) and contextual empty-state messages. Keep it to 3-5 micro-copy variations, all in i18n files.

3. **Privacy balance mask storage**
   - What we know: `strictPrivacyMode` already exists on the user model (from Phase 10). The toggle already exists in Settings.
   - What's unclear: Should balance masking be tied to `strictPrivacyMode` or be a separate quick-toggle?
   - Recommendation: Add a quick-toggle eye icon on ProfileScreen that reads/writes a localStorage flag `senso:balanceMask`. Separate from `strictPrivacyMode` which controls LLM data retention.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.8 + @testing-library/react 16.3.2 |
| Config file | `senso/vitest.config.ts` |
| Quick run command | `docker compose run --rm frontend pnpm test` |
| Full suite command | `docker compose run --rm frontend pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Ripple effect renders on tap | unit | `docker compose run --rm frontend pnpm vitest run src/hooks/useRipple.test.ts` | Wave 0 |
| UX-02 | Pull-to-refresh triggers callback | unit | `docker compose run --rm frontend pnpm vitest run src/hooks/usePullToRefresh.test.ts` | Wave 0 |
| UX-03 | Offline banner shows when offline | unit | `docker compose run --rm frontend pnpm vitest run src/components/OfflineBanner.test.tsx` | Wave 0 |
| UX-04 | useReducedMotion returns correct value | unit | `docker compose run --rm frontend pnpm vitest run src/hooks/useReducedMotion.test.ts` | Wave 0 |
| UX-05 | useLocaleFormat formats with current locale | unit | `docker compose run --rm frontend pnpm vitest run src/hooks/useLocaleFormat.test.ts` | Wave 0 |
| UX-06 | Haptic feedback feature-detects safely | unit | `docker compose run --rm frontend pnpm vitest run src/hooks/useHapticFeedback.test.ts` | Wave 0 |
| UX-07 | Balance mask toggles visibility | unit | `docker compose run --rm frontend pnpm vitest run src/components/BalanceMask.test.tsx` | Wave 0 |
| UX-08 | No hardcoded "it-IT" in source | unit | `docker compose run --rm frontend pnpm vitest run src/test/no-hardcoded-locale.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `docker compose run --rm frontend pnpm test`
- **Per wave merge:** `docker compose run --rm frontend pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/useLocaleFormat.test.ts` — covers UX-05
- [ ] `src/hooks/useReducedMotion.test.ts` — covers UX-04
- [ ] `src/hooks/useOnlineStatus.test.ts` — covers UX-03
- [ ] `src/hooks/useHapticFeedback.test.ts` — covers UX-06
- [ ] `src/components/OfflineBanner.test.tsx` — covers UX-03
- [ ] `src/components/BalanceMask.test.tsx` — covers UX-07
- [ ] `src/test/no-hardcoded-locale.test.ts` — grep-based test for UX-08

## Environment Availability

Step 2.6: SKIPPED — this phase is purely frontend code/CSS changes with no external dependencies beyond the already-installed npm packages and Docker Compose stack.

## Sources

### Primary (HIGH confidence)
- **Existing codebase:** `theme-provider.tsx` (prefers-color-scheme pattern), `SettingsScreen.tsx` (optimistic UI pattern), `AppShell.tsx` (drawer animation pattern), `index.css` (Tailwind theme setup)
- **MDN Web Docs — Vibration API:** https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API — Confirmed "limited availability" status, Safari/iOS unsupported
- **MDN Web Docs — Navigator.onLine:** https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine — Baseline widely available since July 2015
- **MDN Web Docs — prefers-reduced-motion:** https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — Baseline widely available
- **MDN Web Docs — prefers-contrast:** https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast — Baseline widely available since 2024
- **React docs — useSyncExternalStore:** https://react.dev/reference/react/useSyncExternalStore — Official hook for subscribing to external stores

### Secondary (MEDIUM confidence)
- **Tailwind CSS docs — @media queries:** Custom variants for media queries work via `@custom-variant` in Tailwind 4
- **tw-animate-css:** Already in project `package.json` v1.4.0 — provides animation utilities used by shadcn

### Tertiary (LOW confidence)
- **View Transitions API + react-router-dom v7:** No confirmed integration available. The API exists but react-router-dom v7 does not expose `viewTransition` prop or `startViewTransition` helpers. Using CSS transitions instead.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything already installed, no new dependencies, browser APIs are baseline
- Architecture: HIGH — patterns derived from existing codebase conventions and React 19 best practices
- Pitfalls: HIGH — Vibration API limitation confirmed via MDN, reduced-motion best practices well-documented
- i18n audit: HIGH — exact line numbers confirmed via grep, 14 instances + 3 hardcoded Italian strings

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable — browser APIs and installed packages won't change)
