"""
Tests for POST /coaching/stt endpoint (server-side STT).

Covers both providers:
  - ElevenLabs Scribe (default, STT_PROVIDER=elevenlabs)
  - OpenAI Whisper   (fallback, STT_PROVIDER=openai)

Real API calls are never made; providers are mocked at the SDK boundary.
FastAPI dependency overrides are used to inject custom Settings objects.
"""

import dataclasses
import io
from unittest.mock import MagicMock, patch

from app.core.config import get_settings
from app.main import app


# ── Helpers ──────────────────────────────────────────────────────────────────


def _register_and_login(client, email="stt@example.com"):
    client.post("/auth/signup", json={"email": email, "password": "Test1234!"})
    resp = client.post("/auth/login", json={"email": email, "password": "Test1234!"})
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    return resp.json()["accessToken"]


def _settings_with(**kwargs):
    """Return a Settings instance with specific fields overridden (frozen dataclass)."""
    base = get_settings()
    return dataclasses.replace(base, **kwargs)


def _dep_override(settings_obj):
    """Return a FastAPI dependency override that returns a fixed Settings object."""

    def _override():
        return settings_obj

    return _override


# ── Auth guard ────────────────────────────────────────────────────────────────


def test_stt_endpoint_returns_401_unauthenticated(client):
    """POST /coaching/stt without auth token returns 401."""
    resp = client.post(
        "/coaching/stt",
        files={"audio": ("audio.webm", io.BytesIO(b"data"), "audio/webm")},
    )
    assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# ElevenLabs Scribe provider (default)
# ═══════════════════════════════════════════════════════════════════════════════


def test_elevenlabs_stt_returns_503_no_key(client):
    """ElevenLabs provider returns 503 when ELEVENLABS_API_KEY is absent."""
    token = _register_and_login(client, "stt-el-503@example.com")

    settings_obj = _settings_with(stt_provider="elevenlabs", elevenlabs_api_key=None)
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        resp = client.post(
            "/coaching/stt",
            files={"audio": ("audio.webm", io.BytesIO(b"data"), "audio/webm")},
            headers={"Authorization": f"Bearer {token}"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 503
    assert resp.json()["detail"]["code"] == "stt_unavailable"


def test_elevenlabs_stt_returns_400_empty_audio(client):
    """ElevenLabs provider returns 400 when the uploaded file is empty."""
    token = _register_and_login(client, "stt-el-400@example.com")

    settings_obj = _settings_with(
        stt_provider="elevenlabs", elevenlabs_api_key="el-key"
    )
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        resp = client.post(
            "/coaching/stt",
            files={"audio": ("audio.webm", io.BytesIO(b""), "audio/webm")},
            headers={"Authorization": f"Bearer {token}"},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "stt_empty_audio"


def test_elevenlabs_stt_returns_transcript_on_success(client):
    """ElevenLabs provider returns 200 + stripped text on success."""
    token = _register_and_login(client, "stt-el-ok@example.com")

    mock_result = MagicMock()
    mock_result.text = "  Ciao, come stai?  "

    settings_obj = _settings_with(
        stt_provider="elevenlabs", elevenlabs_api_key="el-key"
    )
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with patch("elevenlabs.ElevenLabs") as mock_el_cls:
            mock_el_client = MagicMock()
            mock_el_client.speech_to_text.convert.return_value = mock_result
            mock_el_cls.return_value = mock_el_client

            resp = client.post(
                "/coaching/stt",
                files={
                    "audio": ("audio.webm", io.BytesIO(b"fake-audio"), "audio/webm")
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 200
    assert resp.json()["text"] == "Ciao, come stai?"  # stripped


def test_elevenlabs_stt_passes_locale_to_scribe(client):
    """ElevenLabs provider forwards language_code='en' when locale=en."""
    token = _register_and_login(client, "stt-el-locale@example.com")

    mock_result = MagicMock()
    mock_result.text = "Hello world"

    settings_obj = _settings_with(
        stt_provider="elevenlabs", elevenlabs_api_key="el-key"
    )
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with patch("elevenlabs.ElevenLabs") as mock_el_cls:
            mock_el_client = MagicMock()
            mock_el_client.speech_to_text.convert.return_value = mock_result
            mock_el_cls.return_value = mock_el_client

            resp = client.post(
                "/coaching/stt?locale=en",
                files={
                    "audio": ("audio.webm", io.BytesIO(b"fake-audio"), "audio/webm")
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            call_kwargs = mock_el_client.speech_to_text.convert.call_args.kwargs
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 200
    assert call_kwargs.get("language_code") == "en"


def test_elevenlabs_stt_returns_502_on_api_failure(client):
    """ElevenLabs provider returns 502 stt_failed when the SDK raises."""
    token = _register_and_login(client, "stt-el-502@example.com")

    settings_obj = _settings_with(
        stt_provider="elevenlabs", elevenlabs_api_key="el-key"
    )
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with patch("elevenlabs.ElevenLabs") as mock_el_cls:
            mock_el_client = MagicMock()
            mock_el_client.speech_to_text.convert.side_effect = RuntimeError(
                "Scribe error"
            )
            mock_el_cls.return_value = mock_el_client

            resp = client.post(
                "/coaching/stt",
                files={
                    "audio": ("audio.webm", io.BytesIO(b"fake-audio"), "audio/webm")
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 502
    assert resp.json()["detail"]["code"] == "stt_failed"


# ═══════════════════════════════════════════════════════════════════════════════
# OpenAI Whisper provider (STT_PROVIDER=openai)
# ═══════════════════════════════════════════════════════════════════════════════


def test_whisper_stt_returns_503_no_key(client):
    """Whisper provider returns 503 when LLM_OPENAI_API_KEY is absent."""
    token = _register_and_login(client, "stt-oai-503@example.com")

    settings_obj = _settings_with(stt_provider="openai")
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with patch("app.core.llm_config.LLMConfig.api_key_for", return_value=None):
            resp = client.post(
                "/coaching/stt",
                files={"audio": ("audio.webm", io.BytesIO(b"data"), "audio/webm")},
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 503
    assert resp.json()["detail"]["code"] == "stt_unavailable"


def test_whisper_stt_returns_400_empty_audio(client):
    """Whisper provider returns 400 when the uploaded file is empty."""
    token = _register_and_login(client, "stt-oai-400@example.com")

    settings_obj = _settings_with(stt_provider="openai")
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with patch(
            "app.core.llm_config.LLMConfig.api_key_for", return_value="test-key"
        ):
            resp = client.post(
                "/coaching/stt",
                files={"audio": ("audio.webm", io.BytesIO(b""), "audio/webm")},
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "stt_empty_audio"


def test_whisper_stt_returns_transcript_on_success(client):
    """Whisper provider returns 200 + stripped text on success."""
    token = _register_and_login(client, "stt-oai-ok@example.com")

    mock_transcript = MagicMock()
    mock_transcript.text = "  Ciao, come stai?  "

    settings_obj = _settings_with(stt_provider="openai")
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with (
            patch("app.core.llm_config.LLMConfig.api_key_for", return_value="test-key"),
            patch("openai.OpenAI") as mock_openai_cls,
        ):
            mock_oai_client = MagicMock()
            mock_oai_client.audio.transcriptions.create.return_value = mock_transcript
            mock_openai_cls.return_value = mock_oai_client

            resp = client.post(
                "/coaching/stt",
                files={
                    "audio": ("audio.webm", io.BytesIO(b"fake-audio"), "audio/webm")
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 200
    assert resp.json()["text"] == "Ciao, come stai?"  # stripped


def test_whisper_stt_passes_locale_to_whisper(client):
    """Whisper provider forwards language='en' when locale=en."""
    token = _register_and_login(client, "stt-oai-locale@example.com")

    mock_transcript = MagicMock()
    mock_transcript.text = "Hello world"

    settings_obj = _settings_with(stt_provider="openai")
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with (
            patch("app.core.llm_config.LLMConfig.api_key_for", return_value="test-key"),
            patch("openai.OpenAI") as mock_openai_cls,
        ):
            mock_oai_client = MagicMock()
            mock_oai_client.audio.transcriptions.create.return_value = mock_transcript
            mock_openai_cls.return_value = mock_oai_client

            resp = client.post(
                "/coaching/stt?locale=en",
                files={
                    "audio": ("audio.webm", io.BytesIO(b"fake-audio"), "audio/webm")
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            call_kwargs = mock_oai_client.audio.transcriptions.create.call_args.kwargs
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 200
    assert call_kwargs.get("language") == "en"


def test_whisper_stt_returns_502_on_api_failure(client):
    """Whisper provider returns 502 stt_failed when the OpenAI SDK raises."""
    token = _register_and_login(client, "stt-oai-502@example.com")

    settings_obj = _settings_with(stt_provider="openai")
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with (
            patch("app.core.llm_config.LLMConfig.api_key_for", return_value="test-key"),
            patch("openai.OpenAI") as mock_openai_cls,
        ):
            mock_oai_client = MagicMock()
            mock_oai_client.audio.transcriptions.create.side_effect = RuntimeError(
                "API error"
            )
            mock_openai_cls.return_value = mock_oai_client

            resp = client.post(
                "/coaching/stt",
                files={
                    "audio": ("audio.webm", io.BytesIO(b"fake-audio"), "audio/webm")
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 502
    assert resp.json()["detail"]["code"] == "stt_failed"


# ── D-09: stt_provider default ────────────────────────────────────────────────


def test_stt_provider_default_is_elevenlabs(monkeypatch):
    """get_settings().stt_provider == 'elevenlabs' when STT_PROVIDER env var is absent.

    Regression guard: ensures the default is never silently changed to "openai"
    which would require LLM_OPENAI_API_KEY instead of the shared ELEVENLABS_API_KEY.
    """
    monkeypatch.delenv("STT_PROVIDER", raising=False)
    from app.core.config import get_settings  # re-import to call get_settings fresh

    settings = get_settings()
    assert settings.stt_provider == "elevenlabs"


# ── D-11 regressions ──────────────────────────────────────────────────────────


def test_chromium_audio_contention_regression_webm_accepted(client):
    """Regression: POST /coaching/stt accepts audio/webm (Chrome MediaRecorder format).

    Context: The Chromium hold-to-speak bug was caused by the frontend holding a live
    MediaStream while SpeechRecognition was active (audio device contention). After that
    fix, the frontend sends MediaRecorder audio (webm) to the server-side STT endpoint.
    This test guards that the backend never regresses to rejecting webm MIME type.
    See: .planning/debug/stt-hold-to-speak-chromium-no-audio.md
    """
    token = _register_and_login(client, "stt-webm-regression@example.com")

    mock_result = MagicMock()
    mock_result.text = "Quanto posso spendere?"

    settings_obj = _settings_with(
        stt_provider="elevenlabs", elevenlabs_api_key="el-key"
    )
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with patch("elevenlabs.ElevenLabs") as mock_el_cls:
            mock_el_client = MagicMock()
            mock_el_client.speech_to_text.convert.return_value = mock_result
            mock_el_cls.return_value = mock_el_client

            resp = client.post(
                "/coaching/stt",
                files={
                    "audio": ("audio.webm", io.BytesIO(b"fake-webm-audio"), "audio/webm")
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 200
    assert resp.json()["text"] == "Quanto posso spendere?"


def test_media_recorder_server_side_stt_path_ogg(client):
    """Regression: POST /coaching/stt accepts audio/ogg (Firefox/LibreWolf MediaRecorder format).

    Context: The server-side Whisper/ElevenLabs STT fallback was added for browsers
    (LibreWolf, Firefox) that block Web Speech API. MediaRecorder in Firefox produces
    audio/ogg. This test guards that the backend STT endpoint handles both webm (Chrome)
    and ogg (Firefox) without format-based 400 errors.
    See: .planning/debug/stt-server-side-whisper.md
    """
    token = _register_and_login(client, "stt-ogg-regression@example.com")

    mock_result = MagicMock()
    mock_result.text = "Voglio comprare una macchina"

    settings_obj = _settings_with(
        stt_provider="elevenlabs", elevenlabs_api_key="el-key"
    )
    app.dependency_overrides[get_settings] = _dep_override(settings_obj)
    try:
        with patch("elevenlabs.ElevenLabs") as mock_el_cls:
            mock_el_client = MagicMock()
            mock_el_client.speech_to_text.convert.return_value = mock_result
            mock_el_cls.return_value = mock_el_client

            resp = client.post(
                "/coaching/stt",
                files={
                    "audio": ("audio.ogg", io.BytesIO(b"fake-ogg-audio"), "audio/ogg")
                },
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert resp.status_code == 200
    assert resp.json()["text"] == "Voglio comprare una macchina"
