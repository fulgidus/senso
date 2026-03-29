---
phase: 06-learn-act-cards-demo-hardening
plan: "04"
subsystem: ui
tags: [react, typescript, loading-states, error-recovery, tts, skeleton, timeout, i18n]

# Dependency graph
requires:
  - phase: 05-voice-coaching-loop
    provides: useTTS hook with ElevenLabs + speechSynthesis fallback

provides:
  - Rich skeleton loading bubble with animated dots, skeleton lines, and card placeholder
  - 35-second client-side timeout on coaching API calls with error display
  - Auto-dismissing transient error banners (8s for llm_error/network_error)
  - Retry button in error banner for transient failures
  - useTTS usingFallback/ttsError state exposure for fallback indicator tooltip
  - i18n keys: coaching.retryLastMessage, coaching.ttsFallbackActive

affects:
  - demo-hardening
  - voice-coaching-loop
  - future-error-handling

# Tech tracking
tech-stack:
  added: []
  patterns:
    - setErrorWithAutoDismiss wrapper pattern for auto-clearing transient UI errors
    - Client-side fetch timeout using setTimeout + clearTimeout with explicit isLoading=false reset
    - lastUserMessageRef pattern for retry without state duplication

key-files:
  created: []
  modified:
    - senso/src/features/coaching/ChatScreen.tsx
    - senso/src/features/coaching/useTTS.ts
    - senso/src/i18n/locales/it.json
    - senso/src/i18n/locales/en.json

key-decisions:
  - "35s client-side timeout chosen — below backend 60s LLM timeout so backend 502 fires first on LLM failure, client timeout only triggers on connection hang"
  - "setErrorWithAutoDismiss wrapper preserves profile_required errors indefinitely (navigation CTA); auto-dismisses all other codes after 8s"
  - "useTTS.stop() resets usingFallback so the tooltip clears on manual stop"
  - "VoiceModeBar isGenerating handling already correct — no change needed (ttsGenerating key renders Generazione audio... correctly)"

patterns-established:
  - "Timeout pattern: setTimeout fires setIsLoading(false) + setErrorWithAutoDismiss; cleared via clearTimeout in both success and catch paths"
  - "Auto-dismiss: errorDismissTimerRef tracks active timer, cleared on each new setErrorWithAutoDismiss call to prevent stale dismiss"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-03-29
---

# Phase 06-04: Loading States + Error Recovery Polish Summary

**Rich skeleton loading bubble, 35s fetch timeout, auto-dismissing error banners with Retry button, and TTS fallback state exposure via usingFallback tooltip**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-29T08:00:00Z
- **Completed:** 2026-03-29T08:12:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced the single-line pulsing thinking text with a full skeleton bubble: animated 3-dot indicator, 3 skeleton text lines, and a card placeholder — clear visual weight for the 5-15s LLM wait
- Added a 35-second client-side fetch timeout so the loading state cannot hang indefinitely during a demo (backend fires 502 first at 60s for LLM failures; 35s timeout catches connection hangs)
- `setErrorWithAutoDismiss()` wrapper auto-clears transient errors (llm_error, network_error) after 8 seconds; `profile_required` errors stay persistent with their navigation CTA
- Retry button in error banner re-sends `lastUserMessageRef.current` for llm_error and network_error cases
- Extended `useTTS` interface with `ttsError` and `usingFallback` fields; `VoicePlayButton` title shows `coaching.ttsFallbackActive` tooltip when ElevenLabs has failed and browser synth is active

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance loading skeleton + timeout + auto-dismiss + retry** - `f781830` (feat)
2. **Task 2: Harden TTS error recovery and usingFallback state** - `68c4bee` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `senso/src/features/coaching/ChatScreen.tsx` — skeleton bubble, setErrorWithAutoDismiss, 35s timeout, retry button in error banner, VoicePlayButton usingFallback tooltip
- `senso/src/features/coaching/useTTS.ts` — extend UseTTSResult with ttsError/usingFallback; stop() resets usingFallback; fallbackSpeak onEnd resets usingFallback
- `senso/src/i18n/locales/it.json` — added coaching.retryLastMessage, coaching.ttsFallbackActive
- `senso/src/i18n/locales/en.json` — mirrored coaching.retryLastMessage, coaching.ttsFallbackActive

## Decisions Made
- **35s timeout (not 75s):** Per cross-AI review guidance — 35s sits below backend's 60s LLM timeout and well within the 90s demo target
- **setErrorWithAutoDismiss pattern:** Centralizes auto-dismiss logic; single ref for timer allows proper cleanup when a new error arrives before the previous dismissal fires
- **VoiceModeBar unchanged:** Already had `isGenerating` → `t("coaching.ttsGenerating")` status text wired correctly; no change needed

## Deviations from Plan

None — plan executed exactly as written with one adjustment: timeout value is 35s (per instructions) instead of the 75s reference in the original plan context. The plan itself already specified 35s after the cross-AI review.

## Issues Encountered
None — TypeScript compiled cleanly on first build attempt. The `setIsLoading` inside the timeout callback was initially written using a functional updater with side effects (antipattern); corrected to direct `setIsLoading(false)` + `setErrorWithAutoDismiss()` calls instead.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All plan 06-04 success criteria met:
  - ✅ Skeleton bubble shows during LLM generation
  - ✅ Retry button appears for llm_error/network_error
  - ✅ Transient errors auto-dismiss after 8s; profile_required stays
  - ✅ 35s client-side timeout prevents infinite loading
  - ✅ TTS fallback is silent; usingFallback tooltip signals degraded mode
  - ✅ `docker compose run --rm frontend pnpm build` passes with 0 TypeScript errors
- Phase 06 complete — all 4 plans executed

## Self-Check: PASSED
- `f781830` — verified in git log
- `68c4bee` — verified in git log
- All 4 modified files staged and committed in task commits
- Build output: `✓ built in 5.21s` with no TypeScript errors

---
*Phase: 06-learn-act-cards-demo-hardening*
*Completed: 2026-03-29*
