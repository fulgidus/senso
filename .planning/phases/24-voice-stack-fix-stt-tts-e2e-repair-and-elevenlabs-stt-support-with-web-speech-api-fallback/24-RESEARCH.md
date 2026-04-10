All facts verified. The research document is written at:

**`.planning/phases/24-voice-stack-fix-stt-tts-e2e-repair-and-elevenlabs-stt-support-with-web-speech-api-fallback/24-RESEARCH.md`**

---

## Summary of Key Findings

### What's Broken (Evidence-Based)

**TTS Tests — 8/21 failing** (`test_tts.py`)
All 8 failures are identical in cause: `config.json` has old ElevenLabs voice IDs (`ErXwobaYiN019PkySvjV`, `EXAVITQu4vr4xnSDxMaL`, `pNInz6obpgDQGcFmaJgB`) but the tests assert the new target IDs (`o4b57JYAECRMJyCEXyIE`, `8KInRSd4DtD5L5gK7itu`, `9rJyhPcU6dKFmhVRrfA9`). Fix = update config.json in 2 locations (defaultPersonaSettings + mentore-saggio). No test code changes needed.

**sttError prop chain broken in two places:**
1. `VoiceModeBar.tsx` — `sttError` prop is entirely absent from the props interface (confirmed)
2. `ChatScreen.tsx` — error display is in the `!isVoiceMode` branch, unreachable during voice mode

**D-09 test missing** — no test verifying `stt_provider` defaults to `"elevenlabs"` without env var

### What's Already Fixed
- `micStreamRef` removed (confirmed absent) — audio contention fix intact
- ElevenLabs STT in `/coaching/stt` endpoint — implemented with dual-provider support
- `config.py` default: `stt_provider=os.getenv("STT_PROVIDER", "elevenlabs")` ✅
- All 11 `test_stt_endpoint.py` tests pass
- Dual-backend STT hook in `useVoiceInput.ts` ✅

### Plan Scope
- **Plan 1**: Update `config.json` voice IDs + add `sttError` prop to VoiceModeBar + wire ChatScreen + add D-09 test
- **Plan 2**: Create audio fixture directories/files + write `voice-mode.spec.ts` Playwright tests + add `mockCoachingTTS/STT` to `api-mocks.ts` + MediaRecorder regression in `useVoiceInput.test.ts`