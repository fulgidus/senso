"""
LLM non-sensitive configuration loader.

Reads api/app/config.json → llm section and exposes typed dataclasses.
API keys are NOT stored here - they are read from env vars named:
    LLM_{PROVIDER_NAME_UPPER}_API_KEY
e.g.  LLM_OPENROUTER_API_KEY, LLM_GEMINI_API_KEY, LLM_OPENAI_API_KEY

Call `get_llm_config()` to obtain a cached LLMConfig instance.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Literal

# Allowed routing axes
LLMClass = Literal["text", "vision", "multi"]
LLMType = Literal["generation", "ocr", "classification"]
LLMSize = Literal["sm", "md", "lg"]

_CONFIG_PATH = Path(__file__).parent.parent / "config.json"


@dataclass
class LLMCallTrace:
    """
    Debug trace for a single LLM call. Populated after complete()/vision().
    Attached to the response when LLM_DEBUG=true.
    """

    provider_attempted: list[str] = field(default_factory=list)
    provider_errors: list[str] = field(default_factory=list)
    provider_used: str = "none"
    model_used: str = "none"
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    latency_ms: float | None = None

    def to_dict(self) -> dict:
        return {
            "provider_attempted": self.provider_attempted,
            "provider_errors": self.provider_errors,
            "provider_used": self.provider_used,
            "model_used": self.model_used,
            "tokens": {
                "prompt": self.prompt_tokens,
                "completion": self.completion_tokens,
                "total": self.total_tokens,
            },
            "latency_ms": round(self.latency_ms, 1) if self.latency_ms else None,
        }


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    base_url: str | None
    env_key: str  # name of the env var that holds the API key
    priority: int  # lower = higher priority in fallback chain


@dataclass(frozen=True)
class ModelRoute:
    """Resolved model route for a class:type:size triple."""

    provider: str  # must match a ProviderConfig.name
    model: str
    timeout: float  # seconds


@dataclass(frozen=True)
class LLMConfig:
    """
    Immutable LLM configuration loaded from config.json.

    Usage:
        cfg = get_llm_config()
        route = cfg.route("text", "generation", "sm")   # → ModelRoute
        api_key = cfg.api_key_for(route.provider)       # reads env var
    """

    providers: tuple[ProviderConfig, ...]
    _routing: dict  # raw routing dict from JSON; use .route() for typed access

    def route(
        self,
        cls: LLMClass,
        type_: LLMType,
        size: LLMSize = "sm",
    ) -> ModelRoute:
        """
        Resolve a ModelRoute for the given (class, type, size) triple.
        Falls back to 'sm' if the requested size is missing.
        Raises KeyError if the class/type pair doesn't exist at all.
        """
        try:
            entry = self._routing[cls][type_]
        except KeyError:
            raise KeyError(
                f"No LLM route defined for class={cls!r} type={type_!r} in config.json"
            )
        # size fallback: sm → md → lg
        for s in (size, "sm", "md", "lg"):
            if s in entry:
                r = entry[s]
                return ModelRoute(
                    provider=r["provider"],
                    model=r["model"],
                    timeout=float(r.get("timeout", 30)),
                )
        raise KeyError(
            f"No suitable size found for class={cls!r} type={type_!r} in config.json"
        )

    def api_key_for(self, provider_name: str) -> str | None:
        """Read the API key for `provider_name` from the corresponding env var."""
        for p in self.providers:
            if p.name == provider_name:
                return os.getenv(p.env_key) or None
        return None

    def provider_by_name(self, name: str) -> ProviderConfig | None:
        for p in self.providers:
            if p.name == name:
                return p
        return None

    @property
    def providers_by_priority(self) -> tuple[ProviderConfig, ...]:
        return tuple(sorted(self.providers, key=lambda p: p.priority))


def _load() -> LLMConfig:
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        raw = json.load(f)

    llm = raw.get("llm", {})

    providers = tuple(
        ProviderConfig(
            name=p["name"],
            # Allow env var override: LLM_{PROVIDER_NAME_UPPER}_BASE_URL
            # e.g. LLM_OPENROUTER_BASE_URL=http://llm-stub:4010/v1 in test env
            base_url=os.getenv(
                f"LLM_{p['name'].upper()}_BASE_URL", p.get("base_url")
            ),
            env_key=p["env_key"],
            priority=int(p.get("priority", 99)),
        )
        for p in llm.get("providers", [])
    )

    return LLMConfig(
        providers=providers,
        _routing=llm.get("routing", {}),
    )


@lru_cache(maxsize=1)
def get_llm_config() -> LLMConfig:
    """Return a cached singleton LLMConfig. Re-load by clearing lru_cache."""
    return _load()
