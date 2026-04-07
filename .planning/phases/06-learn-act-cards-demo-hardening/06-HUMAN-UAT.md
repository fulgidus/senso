---
status: partial
phase: 06-learn-act-cards-demo-hardening
source: [06-VERIFICATION.md]
started: 2026-03-29T08:06:50Z
updated: 2026-03-29T08:06:50Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Card rendering in live chat
expected: Sending a financial decision question (e.g. "Posso permettermi un abbonamento da 15 euro al mese?") in the Italian coaching chat produces a response with at least one resource card (article, video, or slide) AND at least one action card (calculator or partner offer) rendered inline in the AssistantBubble.
result: [pending]

### 2. MARP slide visual QA
expected: A slide deck card renders with visible slide content, working prev/next navigation arrows, correct slide counter ("1 / N"), no raw YAML front-matter text in the rendered HTML, fullscreen toggle opens/closes, theme matches app light/dark mode.
result: [pending]

### 3. STT-TTS feedback loop prevention
expected: In voice mode with speakers (not headphones), asking a question by voice and receiving a spoken TTS response does NOT trigger a second STT transcript from the assistant's own audio. The mic is silenced during playback and re-enables only after TTS ends.
result: [pending]

### 4. TTS fallback with invalid ElevenLabs API key
expected: With ELEVENLABS_API_KEY=invalid in the running container, clicking the voice play button still produces browser speech synthesis audio. No error is shown to the user. Browser DevTools console shows the `[useTTS] ElevenLabs failed, falling back to speechSynthesis:` warning.
result: [pending]

### 5. Seed + reset round-trip
expected: `bash scripts/seed-demo.sh` completes with "Demo seed complete!" when sample files are present at `api/app/ingestion/samples/`. Logging in at http://localhost:3000 with demo@senso.app / SensoDEMO2026! shows the profile screen immediately. `bash scripts/reset-demo.sh` (with y confirmation) deletes all user data. A second seed run succeeds.
result: [pending]

### 6. Loading skeleton animation during live LLM call
expected: During the 5-15 second window while the coaching API is generating a response, the chat shows a skeleton bubble with three animated bouncing dots, three shimmer skeleton text lines, and a card placeholder rectangle - not a blank space or simple spinner.
result: [pending]

### 7. Error banner auto-dismiss + retry
expected: When the LLM returns an error (simulate by temporarily stopping the API or using an invalid prompt), the error banner appears with a "Riprova" button. Clicking "Riprova" re-sends the last message. The banner auto-dismisses after ~8 seconds if not clicked.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
