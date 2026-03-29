"""
TTSService: ElevenLabs text-to-speech with MinIO caching.

Normalization modes (controlled per-persona via config.json elevenlabs.normalization):
  "elevenlabs" (default) - send text verbatim; let ElevenLabs normalize numbers,
                           punctuation, and prosody server-side.
  "internal"             - apply _truncate_at_sentence() before sending (legacy fallback).

Lazy SDK import so tests can run without elevenlabs installed.
"""

from __future__ import annotations

import hashlib
import io
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_MAX_CHARS = 2500
_TTS_CACHE_PREFIX = "tts-cache"


class TTSUnavailableError(Exception):
    """Raised when ElevenLabs is not configured or call fails."""


@dataclass
class ElevenLabsVoiceSettings:
    stability: float = 0.75
    similarity_boost: float = 0.8
    style: float = 0.0
    use_speaker_boost: bool = True


def _truncate_at_sentence(text: str, max_chars: int = _MAX_CHARS) -> str:
    """Truncate text at nearest sentence boundary ≤ max_chars (internal normalization only)."""
    if len(text) <= max_chars:
        return text
    window = text[:max_chars]
    idx = window.rfind(". ")
    if idx == -1:
        idx = window.rfind(".")
    return window[: idx + 1] if idx > 0 else window


def _cache_key(voice_id: str, text: str) -> str:
    """Return the MinIO object name for the given voice+text pair."""
    digest = hashlib.sha256(f"{voice_id}:{text}".encode()).hexdigest()
    return f"{_TTS_CACHE_PREFIX}/{digest}.mp3"


class TTSService:
    def __init__(
        self,
        api_key: str | None,
        minio_client=None,
        bucket: str | None = None,
    ) -> None:
        self._api_key = api_key
        self._minio = minio_client
        self._bucket = bucket

    def speak(
        self,
        text: str,
        voice_id: str,
        locale: str = "it",
        normalization: str = "elevenlabs",
        voice_settings: ElevenLabsVoiceSettings | None = None,
        db: "Session | None" = None,
        message_id: str | None = None,
    ) -> bytes:
        """Convert text to MP3 bytes via ElevenLabs, with MinIO caching.

        Args:
            text:          The text to synthesize (displayed bubble content).
            voice_id:      ElevenLabs voice ID resolved from persona config.
            locale:        Language hint (unused by ElevenLabs directly, kept for logging).
            normalization: "elevenlabs" - send verbatim (recommended);
                           "internal" - truncate at sentence boundary first.
            voice_settings: ElevenLabs VoiceSettings parameters. Defaults used if None.
            db:            Optional SQLAlchemy session. If provided alongside message_id,
                           an AudioCache row is written after a successful cache-store.
            message_id:    FK to chat_messages.id for AudioCache tracking.

        Raises TTSUnavailableError on configuration or API failure.
        """
        if not self._api_key:
            raise TTSUnavailableError("ELEVENLABS_API_KEY not configured")
        if not voice_id:
            raise TTSUnavailableError("No voice ID configured for this persona/locale")

        if voice_settings is None:
            voice_settings = ElevenLabsVoiceSettings()

        # Apply normalization
        if normalization == "internal":
            prepared = _truncate_at_sentence(text)
        else:
            prepared = text  # let ElevenLabs handle it

        object_name = _cache_key(voice_id, prepared)

        # ── Cache read ────────────────────────────────────────────────────────
        if self._minio and self._bucket:
            try:
                response = self._minio.get_object(self._bucket, object_name)
                cached = response.read()
                response.close()
                response.release_conn()
                if cached:
                    logger.debug("TTS cache hit: %s", object_name)
                    return cached
            except Exception as exc:
                logger.debug("TTS cache miss (%s): %s", object_name, exc)

        # ── ElevenLabs call ──────────────────────────────────────────────────
        try:
            from elevenlabs import ElevenLabs  # lazy import
            from elevenlabs.types import VoiceSettings

            client = ElevenLabs(api_key=self._api_key)
            audio = client.text_to_speech.convert(
                voice_id=voice_id,
                text=prepared,
                model_id="eleven_multilingual_v2",
                voice_settings=VoiceSettings(
                    stability=voice_settings.stability,
                    similarity_boost=voice_settings.similarity_boost,
                    style=voice_settings.style,
                    use_speaker_boost=voice_settings.use_speaker_boost,
                ),
            )
            if isinstance(audio, (bytes, bytearray)):
                audio_bytes = bytes(audio)
            else:
                audio_bytes = b"".join(audio)
        except TTSUnavailableError:
            raise
        except Exception as exc:
            raise TTSUnavailableError(f"ElevenLabs call failed: {exc}") from exc

        # ── Cache write ───────────────────────────────────────────────────────
        if self._minio and self._bucket and audio_bytes:
            stored = False
            try:
                self._minio.put_object(
                    self._bucket,
                    object_name,
                    io.BytesIO(audio_bytes),
                    length=len(audio_bytes),
                    content_type="audio/mpeg",
                )
                logger.debug("TTS cached: %s (%d bytes)", object_name, len(audio_bytes))
                stored = True
            except Exception as exc:
                logger.warning("TTS cache write failed (%s): %s", object_name, exc)

            # ── AudioCache DB row ─────────────────────────────────────────────
            if stored and db is not None and message_id is not None:
                try:
                    from app.db.models import (
                        AudioCache,
                    )  # avoid circular at module level

                    entry = AudioCache(
                        message_id=message_id,
                        minio_bucket=self._bucket,
                        minio_key=object_name,
                    )
                    db.add(entry)
                    db.commit()
                    logger.debug(
                        "AudioCache row written for message %s → %s",
                        message_id,
                        object_name,
                    )
                except Exception as exc:
                    logger.warning(
                        "AudioCache DB write failed for message %s: %s", message_id, exc
                    )
                    db.rollback()

        return audio_bytes
