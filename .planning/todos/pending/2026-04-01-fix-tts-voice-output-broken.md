---
created: "2026-04-01T18:59:18.910Z"
title: Fix TTS voice output broken
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

TTS (text-to-speech) is broken. Voice output does not work. This is critical — voice is a primary differentiator for the hackathon demo.

## Solution

- Debug the TTS pipeline: check ElevenLabs API connectivity, API key validity, and the browser speechSynthesis fallback.
- Phase 5 established a dual-channel approach (ElevenLabs backend + browser fallback). Verify both paths.
- Check the `fetchTTSAudio` function (uses native fetch for binary audio/mpeg).
- Test the `canPlay` logic tied to speechSynthesis availability.
