# Phase 24: Voice stack fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 24-voice-stack-fix-stt-tts-e2e-repair-and-elevenlabs-stt-support-with-web-speech-api-fallback
**Areas discussed:** STT error observability, E2E test strategy, ElevenLabs STT as default, Verification scope

---

## STT Error Observability

| Option | Description | Selected |
|--------|-------------|----------|
| Inline text in VoiceModeBar | Below mic button in existing status label area | |
| Toast notification | Non-blocking, disappears after a few seconds | |
| Both: inline for transient, toast for hard errors | `no-speech`/network → inline; `not-allowed`/`stt_unavailable` → toast | ✓ |
| Suppress entirely | Voice mode is best-effort, silent failure OK | |

**User's choice:** Both: inline for transient errors (`no-speech`), toast for hard errors (`not-allowed`/mic denied, `stt_unavailable`).

---

**Follow-up: Error wiring mechanism**

| Option | Description | Selected |
|--------|-------------|----------|
| Prop drilling (existing pattern) | `useVoiceMode → ChatScreen → VoiceModeBar` | ✓ |
| Custom event to toast system | Decoupled from VoiceModeBar prop | |
| Both: prop for inline + event for toast | Hybrid approach | |

**User's choice:** Both: VoiceModeBar for inline + emit toast event for hard errors. Final interpretation: `sttError` prop restored in VoiceModeBar for inline display; ChatScreen also fires toast for hard error codes.

---

## E2E Test Strategy for Voice

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright UI tests with mocked endpoints | `page.route()` mocks STT/TTS, tests button states + transitions | |
| Backend integration tests only | `/coaching/stt` and `/coaching/tts` API contracts | |
| Both: Playwright + backend | Full stack coverage without real mic | ✓ |

**User's choice:** Both, with a couple of real audio mp3 files stored in a fixtures folder.

---

**Follow-up: Fixture file location**

| Option | Description | Selected |
|--------|-------------|----------|
| `senso/e2e/fixtures/audio/` only | Co-located with Playwright tests | |
| `api/tests/fixtures/audio/` only | Co-located with backend tests | |
| Both locations, each owns its copy | Self-contained test suites, no cross-directory deps | ✓ |

**User's choice:** Both locations, each test suite owns its fixture copy.

---

## ElevenLabs STT as Default Provider

| Option | Description | Selected |
|--------|-------------|----------|
| ElevenLabs Scribe stays default | Consistent with TTS provider, one key for both | ✓ |
| OpenAI Whisper as default | Lower latency, cheaper per-minute | |
| Keep env-based switch, just document | No change to defaults, update `.env.example` | |

**User's choice:** ElevenLabs Scribe stays default (`STT_PROVIDER=elevenlabs`).

---

**Follow-up: OpenAI Whisper fate**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both providers tested (no change) | Already tested | |
| Add test verifying elevenlabs is the default | Explicit default-provider assertion | ✓ |
| Remove OpenAI Whisper support entirely | Simplify to one provider | |

**User's choice:** Add a test verifying `STT_PROVIDER=elevenlabs` is the default. Keep Whisper as a fallback.

---

## Verification Scope — What "E2E Repair" Means

| Option | Description | Selected |
|--------|-------------|----------|
| Automated tests pass | If Playwright + backend tests all pass, that's sufficient | ✓ |
| Tests pass + manual browser smoke checklist | Chrome + Firefox manual verify | |
| Tests pass + Playwright regression tests for broken scenarios | Explicit regression coverage | |

**User's choice:** Automated tests pass — no manual verify step required.

---

**Follow-up: Open debug sessions**

| Option | Description | Selected |
|--------|-------------|----------|
| Close both as resolved | Fixes are in code, tests will confirm | |
| Keep chromium session open until regression test added | Wait for green test | |
| Write regression test per session, close when passing | One regression test per open debug session | ✓ |

**User's choice:** Write a regression test for each open debug session (`stt-hold-to-speak-chromium-no-audio.md` and `stt-server-side-whisper.md`), then close them when the tests pass.

---

## Agent's Discretion

- Exact toast component/duration for hard errors
- Specific wording of inline error messages in VoiceModeBar
- Whether regression tests are Playwright or backend-only, as appropriate
- Audio fixture file format (mp3 vs webm)

## Deferred Ideas

None.
