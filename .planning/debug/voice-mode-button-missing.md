---
status: awaiting_human_verify
trigger: "After the TTS fix, TTS plays when clicking the play button on individual messages. However, the voice mode toggle button (which should enable auto-play of assistant responses) is missing from the UI entirely."
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED — Voice mode toggle button is gated on `isSttAvailable` (Web Speech API / STT detection), but should be gated on `canPlay` (speechSynthesis / TTS availability). On browsers without Web Speech API for STT (Firefox, Safari), `isSttAvailable=false` hides the button even though TTS works fine. VoiceModeBar already handles `isSttAvailable=false` gracefully.
test: Change condition from `{isSttAvailable && <MicButton>}` to `{canPlay && <MicButton>}` where canPlay mirrors useTTS logic
expecting: Voice mode toggle button visible on all browsers where TTS can play (speechSynthesis exists or ElevenLabs only mode)
next_action: Apply fix in ChatScreen.tsx

## Symptoms

expected: A voice mode toggle button visible in the chat UI that enables automatic TTS playback for all assistant responses (canPlay tied to speechSynthesis availability per project decisions)
actual: The voice mode button is not visible/present in the UI
errors: No known errors — just the button is absent
reproduction: Open chat screen, look for voice mode toggle button (should be in the chat input area, toolbar, or header)
started: Unclear — could have been broken for a while or recently. The TTS per-message play button still works.

## Eliminated

- hypothesis: VoiceModeBar or useVoiceMode hook is missing/broken
  evidence: Both VoiceModeBar.tsx and useVoiceMode.ts exist, are imported correctly in ChatScreen, and are wired properly
  timestamp: 2026-04-01T00:01:00Z
- hypothesis: canPlay logic in useTTS is wrong
  evidence: The canPlay logic `(browserFallbackEnabled ? "speechSynthesis" in window : true)` is logically correct per spec. When fallback enabled, shows when speechSynthesis exists. When fallback disabled (ElevenLabs only), always shows.
  timestamp: 2026-04-01T00:02:00Z
- hypothesis: SSR/hydration issue preventing button from appearing
  evidence: useEffect in useVoiceInput runs on mount and sets isAvailable. This is correct React behavior. Not the root cause.
  timestamp: 2026-04-01T00:03:00Z

## Evidence

- timestamp: 2026-04-01T00:00:00Z
  checked: Frontend file search for voice/TTS related files
  found: VoiceModeBar.tsx, useVoiceMode.ts, useTTS.ts, useVoiceInput.ts all exist in senso/src/features/coaching/
  implication: The voice mode components exist — need to check if they are wired into ChatScreen

- timestamp: 2026-04-01T00:05:00Z
  checked: ChatScreen.tsx lines 1783-1797
  found: Voice mode toggle Mic button is gated on `{isSttAvailable && ...}` where isSttAvailable = window.SpeechRecognition ?? window.webkitSpeechRecognition
  implication: Button is hidden on Firefox/Safari (no Web Speech API for STT) even though TTS works fine

- timestamp: 2026-04-01T00:06:00Z
  checked: useVoiceInput.ts initialization (line 77)
  found: isAvailable starts as false, only set to true in useEffect after mount
  implication: Confirms the button is gated on STT feature detection, not TTS

- timestamp: 2026-04-01T00:07:00Z
  checked: VoiceModeBar.tsx (full file)
  found: VoiceModeBar has `isSttAvailable` prop and handles !isSttAvailable with disabled mic button + "unavailable" hint text
  implication: VoiceModeBar gracefully handles absent STT — voice mode can still be entered and auto-TTS can work; the toggle button should be gated on TTS availability (canPlay) not STT

- timestamp: 2026-04-01T00:08:00Z
  checked: git log -S 'isSttAvailable &&' -- ChatScreen.tsx
  found: Condition was introduced in dad0a6c "feat(05-04): wire mic button and voice input into ChatScreen" with comment "hidden when !isSttAvailable, VOIC-02"
  implication: This was always by design for pure STT mic button, but when voice mode was added (separate commit 36d62fc), the same condition was kept — incorrectly, since voice mode is useful for TTS auto-play even without STT

- timestamp: 2026-04-01T00:09:00Z
  checked: Project spec in bug report
  found: "canPlay tied to speechSynthesis availability — play button shown when browser synthesis exists"
  implication: The spec says voice features (both per-message play and voice mode toggle) should be shown based on speechSynthesis (canPlay), not SpeechRecognition (isSttAvailable)

## Resolution

root_cause: Voice mode toggle button was gated on `isSttAvailable` (Web Speech API / SpeechRecognition detection) instead of `canPlay` (speechSynthesis / TTS availability). On browsers without SpeechRecognition (Firefox, Safari, or any browser where the STT API is absent), `isSttAvailable = false` and the button was completely hidden — even though ElevenLabs TTS + browser synthesis fallback work fine. VoiceModeBar already handles `isSttAvailable=false` gracefully with a disabled mic button and "unavailable" hint text.

fix: Added `canPlay` computation in ChatScreen (mirrors useTTS logic using `ttsConfig` state) and changed the voice mode toggle button condition from `{isSttAvailable && ...}` to `{canPlay && ...}` at ChatScreen.tsx line 1793. `canPlay = typeof window !== "undefined" && (ttsConfig.browserFallbackEnabled ? "speechSynthesis" in window : true)`.

verification: TypeScript (`pnpm tsc --noEmit`) passes with no errors. Voice mode button now shows whenever TTS can play, regardless of STT availability.

files_changed:
  - senso/src/features/coaching/ChatScreen.tsx
