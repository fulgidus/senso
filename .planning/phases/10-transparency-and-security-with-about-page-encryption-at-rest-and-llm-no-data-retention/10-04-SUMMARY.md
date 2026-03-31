---
phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention
plan: "04"
subsystem: ui
tags: [react, i18n, privacy, settings, about-page, react-router]

# Dependency graph
requires:
  - phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention
    plan: "01"
    provides: "strict_privacy_mode column in users table and PATCH /auth/me backend support"
provides:
  - "Public /about route with 6 content sections in PublicShell"
  - "Privacy section in Settings with strictPrivacyMode toggle wired to PATCH /auth/me"
  - "About link card in Settings pointing to /about"
  - "Privacy badge in ChatScreen header when strict mode active"
  - "TTS disabled notice in ChatScreen with dismiss when strict mode active"
  - "All about.* and new settings.privacy* i18n keys in both it.json and en.json"
affects: [settings, coaching, auth, about]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public route block pattern (State 1b) in AppRoutes for unauthenticated access — mirrors existing /learn pattern"
    - "Optimistic toggle + revert on error pattern in SettingsScreen for privacy toggle (mirrors voiceAutoListen pattern)"
    - "sessionStorage-backed dismiss state for inline notice banners (ttsNoticeDismissed)"

key-files:
  created:
    - senso/src/features/about/AboutPage.tsx
  modified:
    - senso/src/App.tsx
    - senso/src/features/settings/SettingsScreen.tsx
    - senso/src/features/coaching/ChatScreen.tsx
    - senso/src/features/auth/types.ts
    - senso/src/features/auth/session.ts
    - senso/src/i18n/locales/it.json
    - senso/src/i18n/locales/en.json

key-decisions:
  - "Privacy section inserted before App info section in Settings — keeps transparency/privacy features grouped before meta-info"
  - "ttsNoticeDismissed persisted to sessionStorage — resets per browser session so user is reminded after each login session"
  - "Public /about route uses same PublicShell + State 1b pattern as /learn — no new infrastructure needed"

patterns-established:
  - "State 1b: Public route block in AppRoutes — copy this block to add future public pages without authentication"
  - "Optimistic update + error revert pattern for single-field PATCH calls in Settings"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-03-31
---

# Phase 10 Plan 04: Frontend Transparency & Privacy UI Summary

**Public /about page with 6 content sections, Privacy mode toggle in Settings wired to PATCH /auth/me, and privacy badge + TTS disabled notice in ChatScreen**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T14:02:09Z
- **Completed:** 2026-03-31T14:08:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created `AboutPage.tsx` with 6 static sections (What, How, Data, AI, Safety, Legal) all using `t("about.*")` keys — no hardcoded strings
- Added public `/about` route in `App.tsx` using the existing `PublicShell` + State 1b pattern so it renders without authentication
- Added Privacy section in `SettingsScreen` with `strictPrivacyMode` toggle that calls `updateMe` with optimistic update + error revert
- Added About link card in Privacy section pointing to `/about`
- Added privacy badge (`ShieldCheck` icon + `coaching.privacyBadge` label) in `ChatScreen` header when `user.strictPrivacyMode` is true
- Added inline TTS disabled notice with `ShieldOff` icon and dismiss button (sessionStorage-persisted) in `ChatScreen` above the input bar
- Added 83 new i18n keys across `it.json` and `en.json`: `nav.about`, 9 `settings.privacy*/about*` keys, 16 `about.*` keys, 2 `coaching.privacy*` keys
- Extended `User` type with `strictPrivacyMode?: boolean`, extended `RawUser`, `parseUser`, and `updateMe` in `session.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: i18n strings, auth types, session wiring** - `27f0290` (feat)
2. **Task 2: AboutPage, /about route, Privacy section, privacy badge** - `3faa538` (feat)

## Files Created/Modified
- `senso/src/features/about/AboutPage.tsx` — New public About page component with 6 sections
- `senso/src/App.tsx` — Added `AboutPage` import, `isAboutRoute`, State 1b block, and authenticated `/about` route
- `senso/src/features/settings/SettingsScreen.tsx` — Added `Shield`, `Link` imports; `strictPrivacyMode` state, `handlePrivacyToggle` handler, Privacy section JSX with toggle and About link card
- `senso/src/features/coaching/ChatScreen.tsx` — Added `ShieldCheck`, `ShieldOff` imports; `ttsNoticeDismissed` state; privacy badge in header; TTS disabled notice before input area
- `senso/src/features/auth/types.ts` — Added `strictPrivacyMode?: boolean` to `User` type
- `senso/src/features/auth/session.ts` — Extended `RawUser`, `parseUser`, and `updateMe` with `strict_privacy_mode`
- `senso/src/i18n/locales/it.json` — Added `nav.about`, `settings.privacy*`, `settings.about*`, top-level `about.*` block, `coaching.privacyBadge/ttsDisabledStrict`
- `senso/src/i18n/locales/en.json` — Mirrored all new keys from it.json in English

## Decisions Made
- Privacy section inserted before "App info" section in Settings — keeps transparency features grouped logically before meta-info
- `ttsNoticeDismissed` persisted to `sessionStorage` — resets on each browser session so users are reminded after each login
- Public `/about` route uses the same `PublicShell` + State 1b pattern as `/learn` — no new infrastructure needed

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
- JSX structural error during ChatScreen edit: inserting the TTS notice block consumed the `{isVoiceMode ? (` ternary opener, leaving the `VoiceModeBar` orphaned. Fixed immediately by re-inserting the ternary opener after the notice block. No separate commit needed (caught before commit).

## Known Stubs
None — all new UI is wired to real data:
- `strictPrivacyMode` toggle reads from `user.strictPrivacyMode` and writes via `updateMe` → `PATCH /auth/me`
- Privacy badge reads `user.strictPrivacyMode` from `AuthContext`
- `AboutPage` is intentionally static (no API calls — it's an informational page)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All frontend deliverables for Phase 10 are complete (Plans 01-04 done)
- Backend changes (Plans 01-03) and frontend changes (Plan 04) are all committed
- Phase 10 is fully ready for final verification

---
*Phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention*
*Completed: 2026-03-31*
