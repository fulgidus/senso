"""
Tests for TTSService, _truncate_at_sentence, and POST /coaching/tts endpoint.
"""

import pytest
from unittest.mock import MagicMock, patch


# ── Unit tests: _truncate_at_sentence ─────────────────────────────────────────


def test_truncate_short_text_unchanged():
    from app.coaching.tts import _truncate_at_sentence

    text = "Hello world."
    assert _truncate_at_sentence(text) == text


def test_truncate_at_sentence_boundary():
    """2600-char text truncated to ≤2500 at nearest preceding '. ' boundary."""
    from app.coaching.tts import _truncate_at_sentence

    # Build a text with a sentence boundary well before 2500 chars
    sentence_a = "Prima frase con punto. "  # 23 chars
    # Fill up to ~2400 chars with repeated content (so sentence boundary exists within window)
    filler = "x" * (2400 - len(sentence_a))
    # Add '. ' at position 2450 (within first 2500 chars)
    sentence_b = ". Seconda frase."
    # Total > 2500
    long_suffix = "y" * 200
    text = sentence_a + filler + sentence_b + long_suffix

    result = _truncate_at_sentence(text)
    assert len(result) <= 2500
    # Should end with a period (sentence boundary)
    assert result.endswith(".")


def test_truncate_hard_truncation_when_no_sentence_boundary():
    """Text without '. ' in first 2500 chars is hard-truncated at 2500."""
    from app.coaching.tts import _truncate_at_sentence

    text = "a" * 2600  # no sentence boundary
    result = _truncate_at_sentence(text)
    assert len(result) <= 2500


def test_truncate_exactly_2500_chars_unchanged():
    """Text of exactly 2500 chars is returned unchanged."""
    from app.coaching.tts import _truncate_at_sentence

    text = "a" * 2500
    assert _truncate_at_sentence(text) == text


# ── Unit tests: TTSService ─────────────────────────────────────────────────────


def test_tts_service_raises_when_no_key():
    """TTSService.speak raises TTSUnavailableError when api_key is None."""
    from app.coaching.tts import TTSService, TTSUnavailableError

    svc = TTSService(api_key=None, voice_id="voice123")
    with pytest.raises(TTSUnavailableError, match="not configured"):
        svc.speak("Hello world", "it")


def test_tts_service_returns_bytes_when_key_set():
    """TTSService.speak returns bytes when ElevenLabs mock returns b'fake-mp3'."""
    from app.coaching.tts import TTSService

    mock_client = MagicMock()
    mock_client.text_to_speech.convert.return_value = b"fake-mp3"

    # Patch the ElevenLabs class inside the module
    with patch.dict("sys.modules", {"elevenlabs": MagicMock()}):
        import sys

        mock_elevenlabs_module = sys.modules["elevenlabs"]
        mock_elevenlabs_module.ElevenLabs.return_value = mock_client

        svc = TTSService(api_key="test-key", voice_id="voice123")
        result = svc.speak("Hello world", "it")

    assert isinstance(result, bytes)
    assert result == b"fake-mp3"


def test_tts_service_raises_on_elevenlabs_failure():
    """TTSService.speak raises TTSUnavailableError when ElevenLabs raises an exception."""
    from app.coaching.tts import TTSService, TTSUnavailableError

    with patch.dict("sys.modules", {"elevenlabs": MagicMock()}):
        import sys

        mock_elevenlabs_module = sys.modules["elevenlabs"]
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.side_effect = RuntimeError("API error")
        mock_elevenlabs_module.ElevenLabs.return_value = mock_client

        svc = TTSService(api_key="test-key", voice_id="voice123")
        with pytest.raises(TTSUnavailableError, match="ElevenLabs call failed"):
            svc.speak("Hello world", "it")


def test_tts_service_truncates_long_text():
    """TTSService.speak truncates text > 2500 chars before calling ElevenLabs."""
    from app.coaching.tts import TTSService

    with patch.dict("sys.modules", {"elevenlabs": MagicMock()}):
        import sys

        mock_elevenlabs_module = sys.modules["elevenlabs"]
        mock_client = MagicMock()
        mock_client.text_to_speech.convert.return_value = b"audio"
        mock_elevenlabs_module.ElevenLabs.return_value = mock_client

        svc = TTSService(api_key="test-key", voice_id="voice123")
        long_text = "x" * 3000
        svc.speak(long_text, "it")

        # Check that the text passed to ElevenLabs is ≤ 2500 chars
        call_kwargs = mock_client.text_to_speech.convert.call_args.kwargs
        sent_text = call_kwargs.get("text", "")
        assert len(sent_text) <= 2500


# ── Integration tests: POST /coaching/tts endpoint ────────────────────────────


def _register_and_login(client, email="tts@example.com"):
    client.post("/auth/signup", json={"email": email, "password": "Test1234!"})
    resp = client.post("/auth/login", json={"email": email, "password": "Test1234!"})
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    return resp.json()["accessToken"]


def test_tts_endpoint_returns_401_when_unauthenticated(client):
    """POST /coaching/tts without auth token returns 401."""
    resp = client.post("/coaching/tts", json={"text": "Hello world", "locale": "it"})
    assert resp.status_code == 401


def test_tts_endpoint_returns_503_when_no_key(client):
    """POST /coaching/tts with valid token but no ElevenLabs key returns 503.

    Uses TTSService.speak mock that raises TTSUnavailableError to simulate absent key,
    without needing to override Settings dependency (avoids DB isolation issues).
    """
    from app.coaching.tts import TTSService, TTSUnavailableError

    token = _register_and_login(client, "tts503@example.com")

    # Patch TTSService.speak to raise TTSUnavailableError (simulates absent key)
    with patch.object(
        TTSService,
        "speak",
        side_effect=TTSUnavailableError("ELEVENLABS_API_KEY not configured"),
    ):
        resp = client.post(
            "/coaching/tts",
            json={"text": "Hello world", "locale": "it"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 503
    data = resp.json()
    assert data["detail"]["code"] == "tts_unavailable"


def test_tts_returns_audio_when_key_set(client):
    """POST /coaching/tts with valid token and mocked TTSService returns 200 + audio/mpeg."""
    from app.coaching.tts import TTSService

    token = _register_and_login(client, "ttsaudio@example.com")

    # Patch TTSService.speak to return fake audio bytes (avoids real ElevenLabs call)
    with patch.object(TTSService, "speak", return_value=b"fake-mp3"):
        resp = client.post(
            "/coaching/tts",
            json={"text": "Hello world", "locale": "it"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("audio/mpeg")
    assert resp.content == b"fake-mp3"
