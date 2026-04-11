# Plan 30-02 SUMMARY: STT Firefox Fix + Chat Mode localStorage Persistence + Guard Test

## Status: Complete

## What Was Built

Three targeted fixes to the voice/STT stack:

### 1. Lazy STT backend detection (`useVoiceInput.ts`)
Changed `useState<VoiceBackend>("none")` + `useEffect(() => setBackend(detectBackend()), [])` to `useState<VoiceBackend>(() => detectBackend())`. This ensures the backend is detected synchronously on first render — eliminating the flash where `isSttAvailable=false` before the effect fires. On Firefox/LibreWolf this prevented the mic button from ever appearing enabled.

### 2. OGG content-type normalization (`api/app/api/coaching.py`)
In both ElevenLabs Scribe and OpenAI Whisper STT paths, the raw `content_type` is now normalized:
- Codec params stripped: `"audio/ogg;codecs=opus"` → `"audio/ogg"`
- OGG remapped to WebM for ElevenLabs (ogg not in their supported format list)
Applied consistently to both providers.

### 3. Voice mode localStorage persistence (`useVoiceMode.ts`)
`isVoiceMode` now reads initial state from `localStorage.getItem("senso:chatMode") === "voice"` and writes `"voice"/"text"` on every toggle. Voice/text mode now persists across page navigations.

### 4. STT double-start guard regression test (`useVoiceInput.test.ts`)
Added test confirming that calling `startRecording()` while `isRecording=true` does NOT call `recognition.start()` a second time. Addresses todo #27 (STT hold-to-speak no audio in Chromium — micStreamRef contention).

## Key Files

### Modified
- `senso/src/features/coaching/useVoiceInput.ts` — lazy backend state init, removed useEffect
- `senso/src/features/coaching/useVoiceMode.ts` — localStorage persistence for isVoiceMode
- `senso/src/features/coaching/useVoiceInput.test.ts` — double-start guard regression test
- `api/app/api/coaching.py` — OGG→WebM normalization in ElevenLabs and Whisper STT paths

## Commits

- `3bed8647` — feat(phase-30-02): lazy STT backend detection, OGG normalization, voice mode persistence, guard test

## Self-Check: PASSED

- No `useState.*none\|setBackend\|useEffect.*detectBackend` in useVoiceInput.ts: ✓
- `useState.*detectBackend` ≥ 1 line: ✓
- `CHAT_MODE_KEY\|senso:chatMode` count ≥ 3: ✓ (4)
- `_base_ct\|split.*;\|ogg.*webm` ≥ 2 lines in coaching.py: ✓
- Guard test present in test file: ✓
- `pnpm tsc --noEmit` exits 0: ✓
- Python AST parse ok: ✓
