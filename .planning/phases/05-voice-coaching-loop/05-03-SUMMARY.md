---
phase: 05-voice-coaching-loop
plan: 03
subsystem: ui
tags: [a2ui, lit, web-components, coaching, frontend]

# Dependency graph
requires:
  - phase: 05-voice-coaching-loop
    plan: 02
    provides: details_a2ui field in CoachingResponse TypeScript interface

provides:
  - A2UISurfaceElement Lit custom element (<a2ui-surface>) with card/textField/text/timeline/button rendering
  - A2UISurface React wrapper component with useRef/useEffect property assignment
  - custom-elements.d.ts global JSX type augmentation for <a2ui-surface> element
  - AssistantBubble renders A2UI panel when details_a2ui is non-null

affects:
  - All future coaching responses with details_a2ui content will render visually in AssistantBubble

# Tech tracking
tech-stack:
  added:
    - "lit 3.3.2 (dependency)"
  patterns:
    - "Lit LitElement without decorators — manual property getter/setter + customElements.define() for erasableSyntaxOnly tsconfig compatibility"
    - "React wrapper with useRef + useEffect property assignment for Lit custom element reactivity"
    - "global declare namespace React.JSX.IntrinsicElements augmentation in .d.ts file for hyphenated custom element JSX typing"

key-files:
  created:
    - senso/src/components/a2ui-element.ts
    - senso/src/components/A2UISurface.tsx
    - senso/src/custom-elements.d.ts
  modified:
    - senso/src/features/coaching/ChatScreen.tsx
    - senso/package.json
    - senso/pnpm-lock.yaml

key-decisions:
  - "Used Lit without decorators (@property, @customElement) — erasableSyntaxOnly tsconfig forbids legacy decorators; used manual getter/setter and customElements.define() instead"
  - "JSX type augmentation via declare global { namespace React.JSX } in .d.ts — module augmentation approach breaks React types with verbatimModuleSyntax; global namespace augmentation is correct pattern"
  - "Custom element registered only if not already defined (customElements.get guard) — prevents duplicate registration errors during HMR"

requirements-completed: [COCH-02]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 5 Plan 03: A2UI Surface Component Summary

**Self-contained `<a2ui-surface>` Lit custom element registered in the browser and wired into AssistantBubble to render structured `details_a2ui` JSONL panels alongside coaching messages**

## Performance

- **Duration:** 8 min
- **Completed:** 2026-03-28
- **Tasks:** 2
- **Files modified:** 5 (created 3, modified 2 + lockfile)

## Accomplishments

- `a2ui-element.ts`: Lit `LitElement` subclass with manual reactive property (no decorators) rendering card/textField/text/timeline/button component types from JSONL `surfaceUpdate` protocol messages
- `A2UISurface.tsx`: React wrapper that imports and registers `<a2ui-surface>`, uses `useRef` + `useEffect` to set `.jsonl` property directly on the DOM element (Lit-compatible), returns `null` when `jsonl` is null/undefined
- `custom-elements.d.ts`: Global `React.JSX.IntrinsicElements` augmentation so TypeScript accepts `<a2ui-surface>` in `.tsx` files
- `ChatScreen.tsx`: AssistantBubble now renders `<A2UISurface jsonl={resp.details_a2ui} />` when `details_a2ui` is non-null — zero render when null
- `lit` 3.3.2 added as production dependency

## Task Commits

1. **Task 1: Lit element + React wrapper** — `282641f` (feat)
2. **Task 2: Wire into AssistantBubble** — `2a9c0d9` (feat)

## Files Created/Modified

- `senso/src/components/a2ui-element.ts` — Lit custom element definition
- `senso/src/components/A2UISurface.tsx` — React wrapper for the element
- `senso/src/custom-elements.d.ts` — JSX type declarations for `<a2ui-surface>`
- `senso/src/features/coaching/ChatScreen.tsx` — A2UISurface import + AssistantBubble render
- `senso/package.json` — lit 3.3.2 added

## Decisions Made

- **No Lit decorators** — `erasableSyntaxOnly: true` in tsconfig forbids them. Used manual `get jsonl()`/`set jsonl()` with `requestUpdate()` and explicit `customElements.define()`.
- **JSX type via `declare global { namespace React.JSX }`** — Tried `declare module "react"` which breaks the React module entirely under `verbatimModuleSyntax`. Global namespace augmentation is correct for co-existing with React's built-in types.
- **Property assignment (not attribute)** — Lit reactive properties work via DOM property setter, not HTML attribute; `ref.current.jsonl = value` is the correct Lit integration pattern from React.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Avoided Lit decorators incompatible with erasableSyntaxOnly**
- **Found during:** Task 1 (pnpm build TypeScript compile)
- **Issue:** `@customElement` and `@property` decorators from Lit are not erasable syntax — TS1240 decorator resolution errors
- **Fix:** Manual `customElements.define()` registration + `get`/`set` property accessors with `requestUpdate()` call
- **Files modified:** senso/src/components/a2ui-element.ts

**2. [Rule 1 - Bug] JSX namespace augmentation approach required 3 iterations**
- **Found during:** Task 1 (pnpm build TypeScript compile)
- **Issue:** `import type React` in `.d.ts` makes it a module scope breaking global augmentation; `declare module "react"` breaks React exports; needed `declare global { namespace React.JSX }` pattern
- **Fix:** Used `declare global { namespace React.JSX { interface IntrinsicElements } }` with `export {}` to force module scope
- **Files modified:** senso/src/custom-elements.d.ts

---

**Total deviations:** 2 auto-fixed (both TypeScript/Lit compatibility)
**Impact on plan:** Required approach adjustments but no scope change. All success criteria met.

## Pre-existing Issues (Out of Scope)

- `AppShell.tsx(92)`: `navigate` declared but never read — TS6133 pre-existing
- `profile-api.ts(197)`: `extraMonths` declared but never read — TS6133 pre-existing
- Both cause `pnpm build` to fail TS check but are unrelated to this plan's work

## Next Phase Readiness

- A2UI rendering wired: LLM `details_a2ui` JSONL will render structured panels in chat
- ChatScreen ready for 05-05 TTS integration (play button in AssistantBubble)

---
*Phase: 05-voice-coaching-loop*
*Completed: 2026-03-28*
