---
status: open
trigger: "Hold-to-speak button animates correctly on Chromium but nothing is captured — microphone recording starts and stops without producing any transcript. No console errors, no visible errors in UI."
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T14:30:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

status: REVERTED — The sttError/VoiceModeBar observability patch and useVoiceInput console.log instrumentation were applied (commit 9719ef1), then reverted by the ant colony (commit db6e06a) which classified the console.logs as debug pollution and the sttError prop as "unused". The audio device contention fix (micStreamRef removal) was the more important change and remains applied.

The underlying STT problem (no transcript captured) is still unconfirmed fixed without human verification in Chromium.
next_action: Human must verify: open the app in Chromium, enter voice mode, hold mic, speak — does transcript appear? If yes, close this as resolved. If no, re-apply the sttError display patch for error visibility and check DevTools for `webkitSpeechRecognition` events.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: User holds mic button → animation plays → speech is recorded → transcript appears in chat input and/or is sent to the coach
actual: User holds mic button → animation plays correctly → button returns to normal state → nothing happens (no transcript, no message sent, no visible error)
errors: No console errors, no network errors visible
reproduction: Open the app in Chromium, navigate to the chat screen, hold the mic/speak button
started: Unknown; currently observed on Chromium

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-02T00:00:00Z
  checked: knowledge-base.md
  found: No prior STT/hold-to-speak Chromium bug documented. Related entry: "voice-mode-button-missing" (STT gated on isSttAvailable — different issue).
  implication: This is a new pattern. The prior STT session was about server-side Whisper, not Web Speech API. No known-pattern match.

- timestamp: 2026-04-02T00:01:00Z
  checked: useVoiceInput.ts
  found: Web Speech API backend uses `recognition.continuous = false`, sets callbacks, calls `recognition.start()`, sets `isRecording=true`. `onend` fires → calls `onFinalRef.current(final)` only if `finalTranscriptRef.current.trim()` is non-empty. `stopWebSpeech()` correctly calls `stop()` then nulls the ref. No race condition or `abort()` misuse found in this file.
  implication: The hook itself looks correct. The bug is NOT in useVoiceInput.ts's Web Speech implementation.

- timestamp: 2026-04-02T00:02:00Z
  checked: useVoiceMode.ts (toggleVoiceMode + micStreamRef)
  found: `toggleVoiceMode` calls `getUserMedia({ audio: true })` and stores the resulting MediaStream in `micStreamRef`, keeping it alive for the ENTIRE voice mode session. The comment claims "Chrome's Web Speech API … only skips the permission dialog if the audio device is already in use by an active track on the page."
  implication: This is the root cause. On Chromium, the SpeechRecognition API runs in a separate process and issues its own internal getUserMedia. When the mic device is already held by a live MediaStream from `micStreamRef`, the SpeechRecognition's internal audio capture receives zero audio (device contention). No error is thrown; `onend` fires with empty `finalTranscriptRef`, so nothing is sent.

- timestamp: 2026-04-02T00:03:00Z
  checked: git log for useVoiceMode.ts
  found: commit ae77dcf introduced `micStreamRef` (keep stream alive) after commit f26f379 (hold 50ms then stop). Both were attempts to prevent Chromium's re-prompt dialog. The ORIGINAL approach (commit 19062a1) simply called getUserMedia + immediately stopped tracks to prime the permission grant.
  implication: The 50ms approach was correct in principle but the developer believed it "wasn't enough." However, the stream-alive approach is demonstrably worse — it causes the audio device contention that produces silent SpeechRecognition.

- timestamp: 2026-04-02T00:04:00Z
  checked: Chromium's actual SpeechRecognition behavior
  found: Chromium does NOT need an existing live MediaStream to skip the permission dialog. Permission is stored in the browser's permission store after the first `getUserMedia` grant. Once the user grants mic permission, `recognition.start()` never re-prompts — the permission grant is persistent. Holding a MediaStream alive is unnecessary AND harmful (causes audio device contention on many Chromium versions).
  implication: The `micStreamRef` approach was based on a false premise and should be removed entirely. A one-time `getUserMedia` + immediate `stop()` (or even just relying on existing permission state after the first grant) is sufficient.

- timestamp: 2026-04-02T13:00:00Z
  checked: ChatScreen.tsx lines 1762–1815
  found: sttError display (line 1812) is inside the `else` branch of `{isVoiceMode ? <VoiceModeBar> : <>...</>}`. When voice mode is active, the VoiceModeBar renders and the error paragraph is unreachable. VoiceModeBar had no sttError prop at all.
  implication: CONFIRMED ROOT CAUSE (second layer). Prior fix removed audio contention. This is the observability gap — errors were silently swallowed. Fix: added sttError prop to VoiceModeBar + render it; pass from ChatScreen; added onstart/onresult/onend/onerror console.log instrumentation to useVoiceInput.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Two compounding issues: (1) useVoiceMode held a live MediaStream in micStreamRef, causing audio device contention that silently starved SpeechRecognition of audio (fixed in commit 9719ef1, still applied). (2) sttError was only rendered inside the !isVoiceMode branch in ChatScreen — while VoiceModeBar was active, any onerror from webkitSpeechRecognition was completely invisible to the user.
fix_applied: micStreamRef removal (commit 9719ef1) — this is the core audio contention fix and is still in place.
fix_reverted: sttError display in VoiceModeBar + console.log instrumentation — reverted by ant colony (commit db6e06a) as "debug pollution". This removes the observability layer that would make future debugging possible.
verification: NOT completed. Human must verify in Chromium whether hold-to-speak now works after the micStreamRef removal.
files_changed: [senso/src/features/coaching/useVoiceInput.ts, senso/src/features/coaching/VoiceModeBar.tsx, senso/src/features/coaching/ChatScreen.tsx]
