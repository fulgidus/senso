---
phase: 06-learn-act-cards-demo-hardening
plan: "02"
subsystem: ui
tags: [marp, slides, tts, stt, voice, coaching, feedback-loop]

requires:
  - phase: 05-voice-coaching-loop
    provides: STT hook (useVoiceInput), TTS hook (useTTS), voice mode orchestration (useVoiceMode), ElevenLabs TTS with browser fallback
  - phase: 06-01
    provides: coaching response schema with resource_cards/action_cards, content catalog BM25 search, response_format.j2 with search_content tool

provides:
  - LLM prompt field mapping rules for slide_deck → resource_type=slide_deck + slide_id=<catalog id>
  - Correct MARP slide separator regex handling \n\n---\n\n separators
  - MarpSlideViewer slideId reset on deck change (useEffect)
  - STT muted during TTS playback via isPlaying rising-edge detection
  - ElevenLabs failure console.warn for developer debugging

affects:
  - 06-03 demo-seed-data: voice loop reliability confirmed
  - 06-04 demo-polish: MARP slide rendering confirmed working

tech-stack:
  added: []
  patterns:
    - "Rising/falling edge detection in useEffect via wasPlayingRef for TTS-STT coordination"
    - "MARP slide separator regex: /\\n[ \\t]*---[ \\t]*\\n/ handles both tight and loose separators"
    - "marked.setOptions({ breaks: true }) set at module level for consistent line break rendering"

key-files:
  created: []
  modified:
    - api/app/coaching/prompts/response_format.j2
    - senso/src/features/coaching/MarpSlideViewer.tsx
    - senso/src/features/coaching/useVoiceMode.ts
    - senso/src/features/coaching/useTTS.ts

key-decisions:
  - "MARP slide separator regex uses /\\n[ \\t]*---[ \\t]*\\n/ instead of /\\n---\\n/ to handle the actual \\n\\n---\\n\\n pattern in the .md files"
  - "STT mute implemented via isPlaying rising-edge in useEffect (wasPlayingRef pattern) rather than inside onAssistantMessage - cleaner separation of concerns and handles all code paths that set isPlaying=true"
  - "TTS fallback warn uses console.warn (not console.error) since fallback is intentional degradation not an unexpected failure"

requirements-completed: []

duration: 15min
completed: "2026-03-29"
---

# Phase 06 Plan 02: MARP Visual QA + Speech-to-Speech End-to-End Fix Summary

**MARP slide parser fixed to handle real `.md` separator format; LLM prompt updated with slide_id field mapping; STT muted during TTS playback via rising-edge detection to prevent speaker feedback loop**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-29T07:45:00Z
- **Completed:** 2026-03-29T08:00:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed critical MARP slide parsing bug: `.split(/\n---\n/)` did not match the actual `\n\n---\n\n` separators used in all 6 slide `.md` files — all slides appeared as one giant block
- Added explicit `slide_id` field mapping rules to `response_format.j2` so the LLM correctly sets `slide_id = <catalog id>` for slide deck resource cards (previously the LLM had no instructions for this field, causing `ResourceCardRouter` to fall through to `ArticleCard`)
- Implemented STT-TTS feedback loop prevention: when TTS starts playing (`isPlaying` rising edge), `stopRecording()` is called immediately so the microphone cannot pick up and re-transcribe the assistant's audio; STT re-enables after TTS ends
- Added `useEffect` to reset slide index to 0 when `slideId` prop changes (prevents showing page N of a new deck on reuse)
- Added `console.warn` log when ElevenLabs fails and browser speechSynthesis fallback activates

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix slide_id prompt + MARP slide parser** - `c62c942` (feat)
2. **Task 2: STT mute during TTS + ElevenLabs fallback logging** - `a71b2bc` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `api/app/coaching/prompts/response_format.j2` — added 5-line field mapping block for resource_type routing (slide_deck→slide_id, video→video_id, article→url, partner_offer→action_cards)
- `senso/src/features/coaching/MarpSlideViewer.tsx` — fixed slide separator regex, added `marked.setOptions({ breaks: true })`, added `useEffect` for slideId reset, updated comments
- `senso/src/features/coaching/useVoiceMode.ts` — merged STT mute (rising edge) + auto-listen restart (falling edge) into single `useEffect` with wasPlayingRef; added stopRecording to deps; updated file header comment
- `senso/src/features/coaching/useTTS.ts` — changed `catch` to `catch (err)`, added `console.warn("[useTTS] ElevenLabs failed...")` before fallback

## Decisions Made
- Used `wasPlayingRef` pattern for rising/falling edge detection rather than adding `isTTSPlaying` boolean state — avoids an extra re-render and keeps the transition logic co-located
- Used `/\n[ \t]*---[ \t]*\n/` regex to handle both compact (`\n---\n`) and spaced (`\n\n---\n\n`) separator forms without two separate split passes
- `console.warn` (not `console.error`) for ElevenLabs fallback — fallback is intentional graceful degradation, not an unexpected error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MARP slide separator regex did not match actual slide files**
- **Found during:** Task 1 (verifying slide ID alignment)
- **Issue:** `parseSlides()` split on `/\n---\n/` but all 6 `.md` slide files use `\n\n---\n\n` (blank lines around the separator). This caused all slides to render as a single unsplit block — navigation would show "1 / 1" for every deck.
- **Fix:** Changed regex to `/\n[ \t]*---[ \t]*\n/` which matches `---` on its own line regardless of surrounding blank lines
- **Files modified:** `senso/src/features/coaching/MarpSlideViewer.tsx`
- **Verification:** Build passes; regex matches the separator pattern verified by reading `it-slide-budget-base.md`
- **Committed in:** `c62c942` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix is essential for MARP slide navigation to work at all. No scope creep.

## Issues Encountered
- Both locale files (`it.json`, `en.json`) already had all 6 required TTS keys (`ttsGenerating`, `ttsGeneratingShort`, `ttsPlaying`, `ttsPlayingShort`, `ttsPlay`, `ttsPlayShort`) — no changes to locale files required
- `isPlayingRef` in original `useVoiceMode.ts` was a dead variable (set but never read) — removed during the useEffect consolidation

## Known Stubs
None — no stubs or hardcoded empty values introduced in this plan.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- MARP slide rendering fully wired: LLM prompt sets `slide_id`, `ResourceCardRouter` routes to `MarpSlideViewer`, parser handles actual slide separator format
- Voice feedback loop prevention confirmed implemented at the hook level — no risk of STT picking up TTS audio during speaker-based demo
- `docker compose run --rm frontend pnpm build` passes with zero TypeScript errors
- Ready for Phase 06 Plans 03 (demo seed data) and 04 (demo polish)

## Self-Check: PASSED

---
*Phase: 06-learn-act-cards-demo-hardening*
*Completed: 2026-03-29*
