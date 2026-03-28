---
phase: 05-voice-coaching-loop
plan: 01
subsystem: api
tags: [elevenlabs, tts, fastapi, python, audio, voice]

# Dependency graph
requires:
  - phase: 04-coaching-pipeline
    provides: coaching router with auth guard, CoachingService, get_current_user pattern
provides:
  - TTSService with speak() and sentence-boundary truncation at 2500 chars
  - POST /coaching/tts endpoint returning audio/mpeg bytes (auth-guarded, 503 fallback)
  - Settings fields: elevenlabs_api_key, elevenlabs_voice_id, tts_enabled property
affects:
  - 05-05-frontend-voice-output

# Tech tracking
tech-stack:
  added: [elevenlabs>=2.40.0]
  patterns:
    - Lazy SDK import inside method body to avoid import-time failures when key absent
    - Sentence-boundary truncation at 2500 chars with rfind(". ") → rfind(".")
    - TTSUnavailableError wrapping all ElevenLabs exceptions for clean HTTP 503 mapping
    - patch.object(TTSService, "speak") pattern for integration tests avoiding Settings override

key-files:
  created:
    - api/app/coaching/tts.py
    - api/tests/test_tts.py
  modified:
    - api/pyproject.toml
    - api/app/core/config.py
    - api/app/api/coaching.py

key-decisions:
  - "Used patch.object(TTSService, 'speak') for integration tests instead of dependency_overrides for Settings — avoids SQLite DB isolation issues with conftest reset_db fixture"
  - "Lazy elevenlabs import inside speak() method — tests run without elevenlabs installed; no import failures when key absent"
  - "Default ElevenLabs voice ID: pNInz6obpgDQGcFmaJgB — to be replaced with Italian voice in production config"

patterns-established:
  - "TTSService pattern: __init__ accepts api_key + voice_id; speak() does truncation + lazy import + error wrapping"
  - "503 error shape: {code: 'tts_unavailable', message: str(exc)} — consistent with existing API error conventions"

requirements-completed: [VOIC-01]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 05 Plan 01: Backend TTS Endpoint Summary

**ElevenLabs TTS backend with lazy SDK import, sentence-boundary truncation, and auth-guarded POST /coaching/tts returning MP3 bytes with graceful 503 fallback**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T15:01:48Z
- **Completed:** 2026-03-28T15:08:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `TTSService.speak()` converts text to MP3 bytes via ElevenLabs SDK with lazy import, raises `TTSUnavailableError` when key absent or call fails
- `_truncate_at_sentence()` truncates text ≤2500 chars at nearest sentence boundary (`". "` → `"."` → hard-truncate)
- `POST /coaching/tts` endpoint auth-guarded, returns `audio/mpeg` StreamingResponse on success, 503 with `tts_unavailable` code on failure
- `Settings` dataclass extended with `elevenlabs_api_key`, `elevenlabs_voice_id`, `tts_enabled` property
- 11 tests covering truncation logic, TTSService unit behaviors, and 401/503/200 endpoint integration tests

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: TTSService + Settings + endpoint** - `57fae50` (feat)

**Plan metadata:** See docs commit below

## Files Created/Modified
- `api/app/coaching/tts.py` - TTSService, TTSUnavailableError, _truncate_at_sentence
- `api/tests/test_tts.py` - 11 unit + integration tests
- `api/pyproject.toml` - Added elevenlabs>=2.40.0 dependency
- `api/app/core/config.py` - Added elevenlabs_api_key, elevenlabs_voice_id, tts_enabled to Settings
- `api/app/api/coaching.py` - Added TTSRequest model and POST /coaching/tts endpoint

## Decisions Made
- Used `patch.object(TTSService, "speak")` for integration tests instead of `dependency_overrides[get_settings]` — the Settings override pattern caused SQLite DB isolation issues with the `reset_db` conftest fixture, resulting in "no such table" errors in subsequent tests
- Kept lazy `elevenlabs` import inside `speak()` method body — ensures tests can run without the SDK installed and avoids import-time failures when `ELEVENLABS_API_KEY` is absent
- Default voice ID `pNInz6obpgDQGcFmaJgB` (Adam) used as placeholder — to be replaced with Italian voice ID in production `.env`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced Settings dependency_overrides with patch.object for TTS integration tests**
- **Found during:** Task 2 (integration test authoring)
- **Issue:** Using `dependency_overrides[get_settings]` to test the 503 path caused SQLite `no such table: refresh_sessions` errors in subsequent tests — the conftest `reset_db` fixture drops/recreates tables while the overridden Settings mock kept a stale DB connection
- **Fix:** Used `patch.object(TTSService, "speak", side_effect=TTSUnavailableError(...))` to test the 503 path, and `patch.object(TTSService, "speak", return_value=b"fake-mp3")` for the 200 path — cleaner, faster, no DB contamination
- **Files modified:** api/tests/test_tts.py
- **Verification:** All 11 tests pass in isolation and combined with test_coaching_endpoints.py (31 total)
- **Committed in:** 57fae50 (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Test pattern change only — production code unchanged. All specified behaviors still verified. No scope creep.

## Issues Encountered
None - production code executed exactly as planned.

## User Setup Required
**Environment variable needed:** `ELEVENLABS_API_KEY` must be set in `.env` for TTS to work. Without it, `POST /coaching/tts` returns 503 gracefully (by design). Optional: `ELEVENLABS_VOICE_ID` (defaults to `pNInz6obpgDQGcFmaJgB` — recommend replacing with Italian voice ID for production use).

## Next Phase Readiness
- Backend TTS endpoint ready for 05-05 frontend voice output hook consumption
- `fetchTTSAudio(text, locale)` in `coachingApi.ts` can call `POST /coaching/tts` with Bearer token
- Graceful 503 fallback already implemented server-side; frontend `useTTS` can fall back to `speechSynthesis` on 503

---
*Phase: 05-voice-coaching-loop*
*Completed: 2026-03-28*
