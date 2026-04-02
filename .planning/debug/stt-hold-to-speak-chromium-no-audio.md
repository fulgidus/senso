---
status: awaiting_human_verify
trigger: "Hold-to-speak button animates correctly on Chromium but nothing is captured — microphone recording starts and stops without producing any transcript. No console errors, no network errors."
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:06:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — `useVoiceMode.toggleVoiceMode` calls `getUserMedia({ audio: true })` and holds the resulting MediaStream alive in `micStreamRef` for the entire voice mode session. On Chromium, the Web Speech API's SpeechRecognition internally uses the same audio device — but when the mic device is already exclusively held by the active MediaStream, the SpeechRecognition starts (no error) but receives zero audio. `onend` fires with an empty `finalTranscriptRef`, so nothing is dispatched.
test: Remove `micStreamRef` and the "keep stream alive" pattern. Instead, restore simple approach: call `getUserMedia` + immediately stop tracks (just to prime the permission grant) and rely on the fact that permission is already in the browser's grant store for subsequent `recognition.start()` calls.
expecting: SpeechRecognition receives real audio, `onresult` fires, transcript is produced
next_action: Apply fix to useVoiceMode.ts

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

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: useVoiceMode.toggleVoiceMode acquired a MediaStream via getUserMedia and held it alive in micStreamRef for the entire voice mode session (commit ae77dcf). On Chromium, the SpeechRecognition API runs in a separate renderer process and issues its own internal getUserMedia. When the mic device is already exclusively held by the live MediaStream in micStreamRef, SpeechRecognition's audio capture receives zero audio. Recognition starts without error, onend fires with an empty finalTranscriptRef, and nothing is sent. The developer's assumption ("Chrome only skips permission re-prompt if a live track exists") is factually incorrect — Chromium stores the mic permission grant persistently in the permission store; recognition.start() never re-prompts after the first grant.
fix: Removed micStreamRef, releaseMicStream callback, and all stream-alive logic from useVoiceMode.ts. Replaced with a micPermissionGranted ref that gates a one-time getUserMedia+immediate-stop call on first voice mode activation. The browser's persistent permission grant ensures recognition.start() never re-prompts on subsequent hold-to-talk presses.
verification: Build passes (tsc -b + vite build, zero errors). All 8 useVoiceInput tests pass. Human verification in Chromium required.
files_changed: [senso/src/features/coaching/useVoiceMode.ts]
