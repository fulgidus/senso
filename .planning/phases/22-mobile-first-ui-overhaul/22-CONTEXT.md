---
phase: "22"
slug: mobile-first-ui-overhaul
created: "2026-04-06"
status: ready-to-execute
---

# Phase 22 Context — Mobile-First UI Overhaul

## Why This Phase Exists

The app was built desktop-first with Tailwind responsive classes sprinkled in. On mobile:
- **ChatScreen** input is hidden under the software keyboard on iOS/Android (no `visualViewport` handling)
- **Tables** (admin content, files tab, transactions) have no card layout — horizontally
  scrollable mess on a 390px screen
- **Pull-to-refresh** gesture fires mid-scroll due to `listRef` / touch event contention
- **Profile tabs** are a horizontal scroll strip that overflows on 320px screens
- **PWA** opens in browser (manifest `display` not set to `standalone`)
- **Coach picker** has a light background in dark mode (color token mismatch)
- **Coach picker + non-default coach**: switching persona breaks the chat session

## Known Bugs Being Fixed

From STATE.md pending todos:
- Fix pull-to-refresh drag gesture not working (#3)
- Make tables responsive with card layout on mobile — systemic (#15)
- Fix PWA manifest so app opens standalone (#2)
- Fix coach picker dark theme unreadable light background (#23)
- Fix coach picker breaks chat — only default coach works (#24)
- Fix TTS voice output broken (#21)

## What This Phase Does

### 22-01: ChatScreen keyboard + safe area
- `visualViewport` API listener: on resize, set `--keyboard-height` CSS var → input
  container uses `padding-bottom: max(env(safe-area-inset-bottom), var(--keyboard-height))`
- Input anchored to `position: sticky bottom-0` inside a flex column (not fixed position)
- Scroll-to-bottom button appears when user is not at bottom of list
- `overscroll-behavior: contain` on message list (replaces `overscroll-none` which breaks iOS)

### 22-02: Pull-to-refresh fix
- Extract PTR logic from ChatScreen into a `usePullToRefresh(containerRef, onRefresh)` hook
- Guard: PTR only arms when `scrollTop === 0` AND touch starts within 60px of top
- `listRef` and PTR ref merged via callback ref pattern (already attempted in Phase 12,
  needs correct implementation)
- Add visual PTR indicator (spinner + "Aggiornamento..." text) during refresh

### 22-03: All tables → card layouts on mobile
- Audit: 6 tables identified (admin content, files tab, transactions, admin users,
  notifications, connectors placeholder)
- Pattern: `<table className="hidden sm:table">` + `<ul className="sm:hidden space-y-2">`
  card view for each
- Card shows same data in stacked label+value format
- Sortable columns → sort button above card list on mobile

### 22-04: Profile + nav mobile fixes
- Profile tab bar: replace horizontal scroll with a 2×3 grid of tab buttons on `<sm`
  (or bottom tab bar using sticky footer)
- Admin/debug: move to dedicated `/admin` route with its own nav entry (remove from Settings)
- Nav drawer: ensure 44px tap targets on all items
- Settings sections: reduce padding on mobile to avoid excessive scrolling

### 22-05: PWA standalone + coach picker fixes
- `senso/public/manifest.json`: set `"display": "standalone"`, fix `start_url`, add
  correct icon sizes (192×192, 512×512 maskable)
- Add `vite-plugin-pwa` with minimal precache strategy (app shell only)
- Coach picker dark mode: trace `bg-background` token in coach picker modal — likely
  needs explicit dark: override on the card container
- Coach picker session fix: trace why non-default coach breaks chat (likely persona_id
  not persisted to session on creation, falls back to default on next request)

### 22-06: TTS fix + voice UX
- Trace TTS broken path: ElevenLabs API response → audio blob → `<audio>` element → play
- Common failure: `canplay` event not firing, or blob URL revoked before play
- Fix: await `audio.play()` Promise, catch `NotAllowedError` (autoplay policy), show
  play button for manual trigger
- Fallback: if ElevenLabs unavailable, use `speechSynthesis.speak()` with Italian voice
- Hold-to-speak STT: verify `micStreamRef` contention fix from Phase 12.1 on real device

## Scope

**In scope:**
- `senso/src/features/coaching/ChatScreen.tsx` — keyboard, PTR, scroll
- `senso/src/features/coaching/usePullToRefresh.ts` — extracted hook
- All 6 table components — card layouts
- `senso/src/features/profile/ProfileScreen.tsx` — tab layout on mobile
- `senso/public/manifest.json` + `vite.config.ts` — PWA
- `senso/src/features/coaching/` — coach picker dark mode + session fix
- `api/app/coaching/tts.py` + frontend TTS player — voice fix

**Not in scope:**
- Complete design system overhaul
- Offline mode (beyond PWA shell cache)
- Native app (PWA only)
