"""
LLM provider wrapper.

Model routing is driven by api/app/config.json → llm section.
API keys are read from env vars per-provider (see LLMConfig.api_key_for).

Public API:
    LLMClient.complete(prompt, system, json_mode, timeout, route)
    LLMClient.vision(prompt, system, image_bytes, json_mode, timeout, route)

`route` is a "class:type:size" string e.g. "text:generation:sm".
Defaults:
    complete()  → "text:generation:sm"
    vision()    → "vision:ocr:sm"

Inject via get_llm_client() FastAPI dependency.
"""

from __future__ import annotations

import time
from typing import Any

from app.core.llm_config import (
    LLMCallTrace,
    LLMClass,
    LLMConfig,
    LLMSize,
    LLMType,
    get_llm_config,
)

__all__ = ["LLMClient", "LLMError", "LLMCallTrace", "get_llm_client"]


class LLMError(Exception):
    """Raised when all LLM providers fail."""


def _parse_route(route: str) -> tuple[LLMClass, LLMType, LLMSize]:
    """
    Parse "class:type:size" into typed components.
    Missing parts fall back to defaults.
    """
    parts = route.split(":")
    cls: LLMClass = parts[0] if len(parts) > 0 else "text"  # type: ignore[assignment]
    typ: LLMType = parts[1] if len(parts) > 1 else "generation"  # type: ignore[assignment]
    size: LLMSize = parts[2] if len(parts) > 2 else "sm"  # type: ignore[assignment]
    return cls, typ, size


class LLMClient:
    def __init__(self, cfg: LLMConfig) -> None:
        self._cfg = cfg
        # Set after each complete()/vision() call for backwards-compat
        self.last_provider_used: str = "none"
        self.last_call_trace: LLMCallTrace = LLMCallTrace()

    # ── Public methods ─────────────────────────────────────────────────────────

    def complete(
        self,
        prompt: str,
        system: str = "",
        json_mode: bool = False,
        timeout: float | None = None,
        route: str = "text:generation:sm",
    ) -> str:
        """
        Text completion. Falls back through providers in priority order.

        `route` selects the model: "class:type:size" e.g. "text:generation:md".
        """
        cls, typ, size = _parse_route(route)
        model_route = self._cfg.route(cls, typ, size)
        effective_timeout = timeout if timeout is not None else model_route.timeout

        trace = LLMCallTrace()
        t0 = time.monotonic()

        # Build provider fallback chain:
        # 1. preferred provider from route config
        # 2. remaining providers in priority order
        ordered = self._provider_chain(model_route.provider)

        for pname in ordered:
            api_key = self._cfg.api_key_for(pname)
            if not api_key:
                continue
            pcfg = self._cfg.provider_by_name(pname)

            # For the preferred provider, use the routed model;
            # for fallbacks, pick their default text model from sm routing
            if pname == model_route.provider:
                model = model_route.model
            else:
                try:
                    fb_route = self._cfg.route(cls, typ, "sm")
                    model = (
                        fb_route.model
                        if fb_route.provider == pname
                        else self._default_text_model(pname)
                    )
                except KeyError:
                    model = self._default_text_model(pname)

            trace.provider_attempted.append(f"{pname}/{model}")
            try:
                result, usage = self._call_complete(
                    provider=pname,
                    model=model,
                    api_key=api_key,
                    base_url=pcfg.base_url if pcfg else None,
                    prompt=prompt,
                    system=system,
                    json_mode=json_mode,
                    timeout=effective_timeout,
                )
                trace.provider_used = pname
                trace.model_used = model
                if usage:
                    trace.prompt_tokens = usage.get("prompt_tokens")
                    trace.completion_tokens = usage.get("completion_tokens")
                    trace.total_tokens = usage.get("total_tokens")
                trace.latency_ms = (time.monotonic() - t0) * 1000
                self.last_provider_used = f"{pname}/{model}"
                self.last_call_trace = trace
                return result
            except Exception as e:
                trace.provider_errors.append(f"{pname}: {e}")

        trace.latency_ms = (time.monotonic() - t0) * 1000
        self.last_call_trace = trace
        raise LLMError(f"All providers failed: {'; '.join(trace.provider_errors)}")

    def vision(
        self,
        prompt: str,
        system: str = "",
        image_bytes: bytes = b"",
        json_mode: bool = False,
        timeout: float | None = None,
        route: str = "vision:ocr:sm",
    ) -> str:
        """
        Vision completion. Falls back through providers in priority order.

        `route` selects the model: "class:type:size" e.g. "vision:ocr:md".
        """
        cls, typ, size = _parse_route(route)
        model_route = self._cfg.route(cls, typ, size)
        effective_timeout = timeout if timeout is not None else model_route.timeout

        trace = LLMCallTrace()
        t0 = time.monotonic()

        ordered = self._provider_chain(model_route.provider)

        for pname in ordered:
            api_key = self._cfg.api_key_for(pname)
            if not api_key:
                continue
            pcfg = self._cfg.provider_by_name(pname)

            model = (
                model_route.model
                if pname == model_route.provider
                else self._default_vision_model(pname)
            )

            trace.provider_attempted.append(f"{pname}/{model}")
            try:
                result = self._call_vision(
                    provider=pname,
                    model=model,
                    api_key=api_key,
                    base_url=pcfg.base_url if pcfg else None,
                    prompt=prompt,
                    system=system,
                    image_bytes=image_bytes,
                    json_mode=json_mode,
                    timeout=effective_timeout,
                )
                trace.provider_used = pname
                trace.model_used = model
                trace.latency_ms = (time.monotonic() - t0) * 1000
                self.last_call_trace = trace
                return result
            except Exception as e:
                trace.provider_errors.append(f"{pname}: {e}")

        trace.latency_ms = (time.monotonic() - t0) * 1000
        self.last_call_trace = trace
        raise LLMError(
            f"All vision providers failed: {'; '.join(trace.provider_errors)}"
        )

    # ── Provider ordering ──────────────────────────────────────────────────────

    def _provider_chain(self, preferred: str) -> list[str]:
        """Return providers with `preferred` first, rest in priority order."""
        all_by_priority = [p.name for p in self._cfg.providers_by_priority]
        rest = [n for n in all_by_priority if n != preferred]
        return [preferred, *rest]

    @staticmethod
    def _default_text_model(provider: str) -> str:
        return {
            "openrouter": "mistralai/mistral-small-3.1-24b-instruct",
            "gemini": "gemini-2.0-flash",
            "openai": "gpt-4o-mini",
        }.get(provider, "gpt-4o-mini")

    @staticmethod
    def _default_vision_model(provider: str) -> str:
        return {
            "openrouter": "mistralai/mistral-small-3.1-24b-instruct",
            "gemini": "gemini-2.0-flash",
            "openai": "gpt-4o",
        }.get(provider, "gpt-4o")

    # ── Dispatch ──────────────────────────────────────────────────────────────

    def _call_complete(
        self,
        provider: str,
        model: str,
        api_key: str,
        base_url: str | None,
        prompt: str,
        system: str,
        json_mode: bool,
        timeout: float,
    ) -> tuple[str, dict | None]:
        if provider == "openrouter":
            return self._openai_compat_complete(
                api_key=api_key,
                base_url=base_url or "https://openrouter.ai/api/v1",
                model=model,
                prompt=prompt,
                system=system,
                json_mode=json_mode,
                timeout=timeout,
            )
        if provider == "gemini":
            return self._gemini_complete(
                api_key=api_key,
                model=model,
                prompt=prompt,
                system=system,
                json_mode=json_mode,
            )
        if provider == "openai":
            return self._openai_compat_complete(
                api_key=api_key,
                base_url=None,
                model=model,
                prompt=prompt,
                system=system,
                json_mode=json_mode,
                timeout=timeout,
            )
        raise LLMError(f"Unknown provider: {provider!r}")

    def _call_vision(
        self,
        provider: str,
        model: str,
        api_key: str,
        base_url: str | None,
        prompt: str,
        system: str,
        image_bytes: bytes,
        json_mode: bool,
        timeout: float,
    ) -> str:
        if provider == "openrouter":
            return self._openai_compat_vision(
                api_key=api_key,
                base_url=base_url or "https://openrouter.ai/api/v1",
                model=model,
                prompt=prompt,
                system=system,
                image_bytes=image_bytes,
                json_mode=json_mode,
                timeout=timeout,
            )
        if provider == "gemini":
            return self._gemini_vision(
                api_key=api_key,
                model=model,
                prompt=prompt,
                system=system,
                image_bytes=image_bytes,
                json_mode=json_mode,
            )
        if provider == "openai":
            return self._openai_compat_vision(
                api_key=api_key,
                base_url=None,
                model=model,
                prompt=prompt,
                system=system,
                image_bytes=image_bytes,
                json_mode=json_mode,
                timeout=timeout,
            )
        raise LLMError(f"Unknown provider for vision: {provider!r}")

    # ── OpenAI-compatible (OpenRouter + OpenAI) ───────────────────────────────

    @staticmethod
    def _openai_compat_complete(
        api_key: str,
        base_url: str | None,
        model: str,
        prompt: str,
        system: str,
        json_mode: bool,
        timeout: float,
    ) -> tuple[str, dict | None]:
        from openai import OpenAI

        kwargs_init: dict[str, Any] = {"api_key": api_key, "timeout": timeout}
        if base_url:
            kwargs_init["base_url"] = base_url
        client = OpenAI(**kwargs_init)

        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        call_kwargs: dict[str, Any] = {"model": model, "messages": messages}
        if json_mode:
            call_kwargs["response_format"] = {"type": "json_object"}
        resp = client.chat.completions.create(**call_kwargs)
        usage = None
        if resp.usage:
            usage = {
                "prompt_tokens": resp.usage.prompt_tokens,
                "completion_tokens": resp.usage.completion_tokens,
                "total_tokens": resp.usage.total_tokens,
            }
        return resp.choices[0].message.content or "", usage

    @staticmethod
    def _openai_compat_vision(
        api_key: str,
        base_url: str | None,
        model: str,
        prompt: str,
        system: str,
        image_bytes: bytes,
        json_mode: bool,
        timeout: float,
    ) -> str:
        import base64

        from openai import OpenAI

        kwargs_init: dict[str, Any] = {"api_key": api_key, "timeout": timeout}
        if base_url:
            kwargs_init["base_url"] = base_url
        client = OpenAI(**kwargs_init)

        b64 = base64.b64encode(image_bytes).decode()
        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append(
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        )
        call_kwargs: dict[str, Any] = {"model": model, "messages": messages}
        if json_mode:
            call_kwargs["response_format"] = {"type": "json_object"}
        resp = client.chat.completions.create(**call_kwargs)
        return resp.choices[0].message.content or ""

    # ── Gemini ────────────────────────────────────────────────────────────────

    @staticmethod
    def _gemini_complete(
        api_key: str,
        model: str,
        prompt: str,
        system: str,
        json_mode: bool,
    ) -> tuple[str, dict | None]:
        from google import genai

        client = genai.Client(api_key=api_key)
        cfg: dict[str, Any] = {}
        if json_mode:
            cfg["response_mime_type"] = "application/json"
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        response = client.models.generate_content(
            model=model,
            contents=full_prompt,
            config=cfg if cfg else None,
        )
        usage = None
        try:
            if response.usage_metadata:
                usage = {
                    "prompt_tokens": response.usage_metadata.prompt_token_count,
                    "completion_tokens": response.usage_metadata.candidates_token_count,
                    "total_tokens": response.usage_metadata.total_token_count,
                }
        except Exception:
            pass
        return response.text, usage

    @staticmethod
    def _gemini_vision(
        api_key: str,
        model: str,
        prompt: str,
        system: str,
        image_bytes: bytes,
        json_mode: bool,
    ) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        cfg: dict[str, Any] = {}
        if json_mode:
            cfg["response_mime_type"] = "application/json"
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                full_prompt,
            ],
            config=cfg if cfg else None,
        )
        return response.text


def get_llm_client() -> LLMClient:
    """FastAPI dependency for LLMClient. Reads config.json for routing, env for API keys."""
    return LLMClient(cfg=get_llm_config())
