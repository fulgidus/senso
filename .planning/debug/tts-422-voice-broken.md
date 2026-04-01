---
status: awaiting_human_verify
trigger: "TTS voice output is broken. POST /coaching/tts returns HTTP 422."
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:30:00Z
---

## Current Focus

hypothesis: CONFIRMED — Frontend sends `{text, locale}` but backend requires `message_id: str` (non-optional), causing Pydantic 422
test: Made message_id optional again, rebuilt Docker image, ran endpoint tests
expecting: All 4 TTS endpoint tests pass
next_action: Await human verification that TTS audio plays in browser

## Symptoms

expected: Clicking play button on assistant message triggers ElevenLabs TTS via POST /coaching/tts, audio plays in browser
actual: POST /coaching/tts returns HTTP 422 — no audio at all
errors: Browser console shows XHR POST https://api.senso.fulgid.us/coaching/tts [HTTP/3 422 30ms]
reproduction: Send a message in chat, get assistant response, click the play/speaker button on the assistant message bubble
started: Broke recently (after recent phase changes through phase 12)

## Eliminated

## Evidence

- timestamp: 2026-04-01T00:05:00Z
  checked: Backend TTSRequest Pydantic model (api/app/api/coaching.py:60-66)
  found: TTSRequest requires `message_id: str` (no default = required field)
  implication: Any request without message_id will fail Pydantic validation → HTTP 422

- timestamp: 2026-04-01T00:06:00Z
  checked: Frontend fetchTTSAudio (senso/src/features/coaching/coachingApi.ts:383-402)
  found: Sends `JSON.stringify({ text, locale })` — no message_id field
  implication: Frontend NEVER sends message_id → every TTS request fails with 422

- timestamp: 2026-04-01T00:08:00Z
  checked: Git history for when message_id became required
  found: Commit 02e6adc ("rename creator_id → owner_id") changed `message_id: str | None = None` to `message_id: str` — the frontend was never updated
  implication: This is a backend-only contract break introduced in the DB integrity overhaul phase

- timestamp: 2026-04-01T00:10:00Z
  checked: TTSService.speak() handling of message_id=None (api/app/coaching/tts.py:166)
  found: `if stored and db is not None and message_id is not None:` — already handles None gracefully
  implication: Making message_id optional again is safe; MinIO caching still works, only AudioCache DB row is skipped

- timestamp: 2026-04-01T00:12:00Z
  checked: Frontend message types (DisplayMessage, SessionMessage, ChatMessageDTO)
  found: None of these types include a message `id` field; the frontend has no way to provide message_id
  implication: The larger fix (exposing message IDs end-to-end) would require changes across 6+ files; making message_id optional is the minimal correct fix

- timestamp: 2026-04-01T00:25:00Z
  checked: Docker rebuild + endpoint tests after fix
  found: All 4 TTS endpoint tests pass (were 3 failing with 422 before fix). Confirmed via JSON response: `{"detail":[{"type":"missing","loc":["body","message_id"],"msg":"Field required"}]}`
  implication: Fix is verified at test level

## Resolution

root_cause: In commit 02e6adc, TTSRequest.message_id was changed from `str | None = None` (optional) to `str` (required) during the DB integrity overhaul. The frontend's fetchTTSAudio() was never updated to send message_id — it sends only `{text, locale}`. Since the frontend's message types (DisplayMessage, SessionMessage, ChatMessageDTO) don't include message IDs, there's no way for the frontend to provide one. Every TTS request fails Pydantic validation → HTTP 422.
fix: Reverted TTSRequest.message_id to optional (`str | None = None`) and restored the conditional `db` passthrough (`db=db if req.message_id else None`) in the endpoint. The TTSService already handles `message_id=None` gracefully — MinIO caching still works; only the AudioCache DB cross-reference row is skipped when message_id is absent.
verification: Rebuilt Docker image. All 4 TTS endpoint tests pass (test_tts_endpoint_returns_401_when_unauthenticated, test_tts_endpoint_returns_503_when_no_key, test_tts_returns_audio_when_key_set, test_tts_endpoint_passes_persona_id_and_gender). The 3 that were failing with 422 now pass.
files_changed: [api/app/api/coaching.py]
