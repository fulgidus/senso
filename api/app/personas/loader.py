"""
Persona config loader and voice ID resolver.

Voice ID lookup order:
  1. persona matching persona_id → voiceIds[locale] → voiceIds["any"] → None
  2. defaultPersonaSettings → voiceIds[locale] → voiceIds["any"] → None

Within each voiceIds bucket, gender is resolved as:
  requested gender → "neutral" → first available key → None
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_CONFIG_PATH = Path(__file__).parent / "config.json"
_config_cache: dict[str, Any] | None = None


def _load_config() -> dict[str, Any]:
    global _config_cache
    if _config_cache is None:
        _config_cache = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
    return _config_cache


def _pick_voice_from_bucket(bucket: dict[str, str], gender: str | None) -> str | None:
    """Pick a voice ID from a voiceIds locale bucket {masculine, feminine, neutral, ...}."""
    if not bucket:
        return None
    if gender and gender in bucket:
        return bucket[gender]
    if "neutral" in bucket:
        return bucket["neutral"]
    # fallback to first available
    return next(iter(bucket.values()), None)


def _resolve_from_elevenlabs(
    elevenlabs: dict[str, Any], locale: str | None, gender: str | None
) -> str | None:
    """Resolve a voice ID from an elevenlabs config block."""
    voice_ids: dict[str, Any] = elevenlabs.get("voiceIds", {})
    if not voice_ids:
        return None
    # Try exact locale match first, then "any" fallback
    for key in ([locale] if locale else []) + ["any"]:
        if key and key in voice_ids:
            result = _pick_voice_from_bucket(voice_ids[key], gender)
            if result:
                return result
    return None


def get_voice_id(
    persona_id: str | None,
    locale: str | None = "it",
    gender: str | None = None,
) -> str | None:
    """
    Resolve an ElevenLabs voice ID from persona config.

    Lookup order:
      1. personas[].find(p => p.id == persona_id) → elevenlabs.voiceIds
      2. defaultPersonaSettings → elevenlabs.voiceIds
      3. None (caller must handle — will 503)
    """
    config = _load_config()

    # 1. Named persona
    if persona_id:
        for persona in config.get("personas", []):
            if persona.get("id") == persona_id:
                el = persona.get("elevenlabs", {})
                result = _resolve_from_elevenlabs(el, locale, gender)
                if result:
                    return result
                break  # persona found but no voiceIds — fall through to default

    # 2. defaultPersonaSettings
    default_el = config.get("defaultPersonaSettings", {}).get("elevenlabs", {})
    return _resolve_from_elevenlabs(default_el, locale, gender)


def get_persona_default_gender(persona_id: str | None) -> str:
    """
    Return the defaultGender for a persona as defined in config.json.
    Falls back to defaultPersonaSettings.defaultGender, then "neutral".
    """
    config = _load_config()
    if persona_id:
        for persona in config.get("personas", []):
            if persona.get("id") == persona_id:
                return persona.get("defaultGender", "neutral")
    return config.get("defaultPersonaSettings", {}).get("defaultGender", "neutral")


def resolve_effective_gender(
    user_voice_gender: str | None,
    persona_id: str | None,
) -> str:
    """
    Resolve which voice gender to use for a TTS / article lookup.

    Rules:
      - user_voice_gender == "indifferent" (or None) → use persona's defaultGender
      - anything else ("masculine" | "feminine" | "neutral") → honour the user's choice
    """
    if user_voice_gender and user_voice_gender != "indifferent":
        return user_voice_gender
    return get_persona_default_gender(persona_id)


def get_tts_config(persona_id: str | None) -> dict[str, Any]:
    """
    Return TTS configuration for the given persona.

    Keys returned:
        fallback: "browser" | "none"   — what to do when ElevenLabs fails
        browserFallbackEnabled: bool   — whether browser speechSynthesis is allowed at all
    """
    config = _load_config()
    defaults = config.get("defaultPersonaSettings", {}).get(
        "tts",
        {
            "fallback": "browser",
            "browserFallbackEnabled": True,
        },
    )

    if persona_id:
        for persona in config.get("personas", []):
            if persona.get("id") == persona_id:
                tts = persona.get("tts")
                if tts:
                    return {**defaults, **tts}
                break

    return dict(defaults)


def get_elevenlabs_settings(persona_id: str | None) -> dict[str, Any]:
    """
    Return merged ElevenLabs generation settings for the given persona.

    Keys returned (all optional — caller should use .get() with sensible defaults):
        normalization: "internal" | "elevenlabs"
        stability: float
        similarityBoost: float
        style: float
        useSpeakerBoost: bool

    Lookup order: named persona → defaultPersonaSettings → hardcoded fallback.
    voiceIds is intentionally excluded — use get_voice_id() for that.
    """
    config = _load_config()
    defaults = {
        k: v
        for k, v in config.get("defaultPersonaSettings", {})
        .get("elevenlabs", {})
        .items()
        if k != "voiceIds"
    }

    if persona_id:
        for persona in config.get("personas", []):
            if persona.get("id") == persona_id:
                el = {
                    k: v
                    for k, v in persona.get("elevenlabs", {}).items()
                    if k != "voiceIds"
                }
                return {**defaults, **el}

    return dict(defaults)
