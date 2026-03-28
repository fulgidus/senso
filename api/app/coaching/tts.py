"""
TTSService: ElevenLabs text-to-speech with sentence-boundary truncation.
Lazy SDK import so tests can run without elevenlabs installed.
"""

from __future__ import annotations

_MAX_CHARS = 2500


class TTSUnavailableError(Exception):
    """Raised when ElevenLabs is not configured or call fails."""


def _truncate_at_sentence(text: str, max_chars: int = _MAX_CHARS) -> str:
    """Truncate text at nearest sentence boundary ≤ max_chars."""
    if len(text) <= max_chars:
        return text
    window = text[:max_chars]
    # Find last '. ' or '.' near the end
    idx = window.rfind(". ")
    if idx == -1:
        idx = window.rfind(".")
    return window[: idx + 1] if idx > 0 else window


class TTSService:
    def __init__(self, api_key: str | None, voice_id: str) -> None:
        self._api_key = api_key
        self._voice_id = voice_id

    def speak(self, text: str, locale: str = "it") -> bytes:
        """Convert text to MP3 bytes via ElevenLabs. Raises TTSUnavailableError on failure."""
        if not self._api_key:
            raise TTSUnavailableError("ELEVENLABS_API_KEY not configured")
        truncated = _truncate_at_sentence(text)
        try:
            from elevenlabs import ElevenLabs  # lazy import

            client = ElevenLabs(api_key=self._api_key)
            audio = client.text_to_speech.convert(
                voice_id=self._voice_id,
                text=truncated,
                model_id="eleven_multilingual_v2",
            )
            # convert generator to bytes if needed
            if isinstance(audio, (bytes, bytearray)):
                return bytes(audio)
            return b"".join(audio)
        except TTSUnavailableError:
            raise
        except Exception as exc:
            raise TTSUnavailableError(f"ElevenLabs call failed: {exc}") from exc
