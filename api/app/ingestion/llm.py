"""
LLM provider wrapper.

Model routing is driven by api/app/config.json → llm section.
API keys are read from env vars per-provider (see LLMConfig.api_key_for).

Public API:
    LLMClient.complete(prompt, system, json_mode, response_schema, timeout, route, strict_mode)
    LLMClient.vision(prompt, system, image_bytes, json_mode, response_schema, timeout, route, strict_mode)
    LLMClient.complete_with_tools(prompt, system, tools, tool_executor,
                                  response_schema, timeout, route, strict_mode)

`route` is a "class:type:size" string e.g. "text:generation:md".
Defaults:
    complete()             → "text:generation:sm"
    vision()               → "vision:ocr:sm"
    complete_with_tools()  → "text:generation:md"

`response_schema`: when provided (a JSON Schema dict), triggers OpenAI structured
outputs (`response_format={"type":"json_schema",...}`) instead of the loose
`json_object` mode.  Gemini providers fall back to `json_object` equivalent.

`strict_mode`: when True, enforces LLM no-data-retention:
    - Excludes OpenAI from the provider chain entirely (no ZDR guarantee)
    - Injects `openai-beta: no-store` header on direct OpenAI calls (standard mode)
    - Injects ZDR body `{"provider": {"zdr": True}}` for OpenRouter calls
    - Gemini needs no extra header (excluded from training by API ToS)

`complete_with_tools`: performs at most ONE tool-call round-trip.
  1. First call with tools registered; if the model requests a tool call,
     the `tool_executor(name, arguments) -> Any` callable is invoked.
  2. Tool result is injected back and a second call with `response_schema`
     produces the final structured output.
  Gemini provider does not support this flow - falls back to a single
  `complete()` call with no tools.

Inject via get_llm_client() FastAPI dependency.
"""

from __future__ import annotations

import json
import time
from typing import Any, Callable

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
        response_schema: dict | None = None,
        timeout: float | None = None,
        route: str = "text:generation:sm",
        strict_mode: bool = False,
    ) -> str:
        """
        Text completion. Falls back through providers in priority order.

        `route` selects the model: "class:type:size" e.g. "text:generation:md".
        `response_schema`: when provided, uses OpenAI structured outputs instead of
        json_object mode. `json_mode` is ignored when response_schema is set.
        `strict_mode`: when True, excludes OpenAI from the provider chain and
        enables ZDR (zero data retention) on OpenRouter calls.
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
        if strict_mode:
            ordered = [p for p in ordered if p != "openai"]

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
                    response_schema=response_schema,
                    timeout=effective_timeout,
                    strict_mode=strict_mode,
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
        response_schema: dict | None = None,
        timeout: float | None = None,
        route: str = "vision:ocr:sm",
        strict_mode: bool = False,
    ) -> str:
        """
        Vision completion. Falls back through providers in priority order.

        `route` selects the model: "class:type:size" e.g. "vision:ocr:md".
        `response_schema`: when provided, uses OpenAI structured outputs instead of
        json_object mode. `json_mode` is ignored when response_schema is set.
        `strict_mode`: when True, excludes OpenAI from the provider chain and
        enables ZDR (zero data retention) on OpenRouter calls.
        """
        cls, typ, size = _parse_route(route)
        model_route = self._cfg.route(cls, typ, size)
        effective_timeout = timeout if timeout is not None else model_route.timeout

        trace = LLMCallTrace()
        t0 = time.monotonic()

        ordered = self._provider_chain(model_route.provider)
        if strict_mode:
            ordered = [p for p in ordered if p != "openai"]

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
                    response_schema=response_schema,
                    timeout=effective_timeout,
                    strict_mode=strict_mode,
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

    def complete_with_tools(
        self,
        prompt: str,
        system: str = "",
        tools: list[dict] | None = None,
        tool_executor: Callable[[str, dict], Any] | None = None,
        tool_call_callback: Callable[[str, dict], None] | None = None,
        response_schema: dict | None = None,
        timeout: float | None = None,
        route: str = "text:generation:md",
        strict_mode: bool = False,
    ) -> str:
        """
        Text completion with at most one tool-call round-trip.

        Flow (OpenAI / OpenRouter):
          1. First call: tools registered, response_format NOT set (tool calls
             and structured output cannot be requested simultaneously).
          2. If model requests a tool call: invoke tool_executor(name, args),
             inject the result, then call again WITH response_schema to get
             the final structured output.
          3. If model returns a plain text/JSON answer in step 1 (no tool call
             requested): return that directly.

        Gemini path: tool calling differs from OpenAI API - falls back to a
        plain complete() with response_schema (no tool enrichment).

        Args:
            prompt: User/conversation prompt.
            system: System prompt.
            tools: List of OpenAI-format function schemas
                   ({"type":"function","function":{"name":...,"description":...,"parameters":...}}).
            tool_executor: Callable(name: str, arguments: dict) -> Any.
                           Return value is JSON-serialised and injected as
                           the tool result.
            response_schema: JSON Schema for the final structured output.
            timeout: Per-provider timeout in seconds.
            route: Model routing key.
            strict_mode: when True, excludes OpenAI from the provider chain and
                         enables ZDR (zero data retention) on OpenRouter calls.
        """
        cls, typ, size = _parse_route(route)
        model_route = self._cfg.route(cls, typ, size)
        effective_timeout = timeout if timeout is not None else model_route.timeout

        trace = LLMCallTrace()
        t0 = time.monotonic()

        ordered = self._provider_chain(model_route.provider)
        if strict_mode:
            ordered = [p for p in ordered if p != "openai"]

        for pname in ordered:
            api_key = self._cfg.api_key_for(pname)
            if not api_key:
                continue
            pcfg = self._cfg.provider_by_name(pname)

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

            # Gemini does not support the OpenAI tool-calling API.
            # Fall back to a single structured-output call without tools.
            if pname == "gemini":
                try:
                    result, usage = self._gemini_complete(
                        api_key=api_key,
                        model=model,
                        prompt=prompt,
                        system=system,
                        json_mode=(response_schema is not None),
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
                    continue

            # OpenAI-compatible path (openai + openrouter)
            base_url = (
                pcfg.base_url
                if pcfg and pname == "openrouter"
                else (
                    pcfg.base_url
                    if pcfg and pcfg.base_url
                    else (
                        "https://openrouter.ai/api/v1"
                        if pname == "openrouter"
                        else None
                    )
                )
            )
            try:
                result, usage = self._openai_compat_complete_with_tools(
                    api_key=api_key,
                    base_url=base_url,
                    model=model,
                    prompt=prompt,
                    system=system,
                    tools=tools or [],
                    tool_executor=tool_executor,
                    tool_call_callback=tool_call_callback,
                    response_schema=response_schema,
                    timeout=effective_timeout,
                    strict_mode=strict_mode,
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
        response_schema: dict | None,
        timeout: float,
        strict_mode: bool = False,
    ) -> tuple[str, dict | None]:
        if provider == "openrouter":
            return self._openai_compat_complete(
                api_key=api_key,
                base_url=base_url or "https://openrouter.ai/api/v1",
                model=model,
                prompt=prompt,
                system=system,
                json_mode=json_mode,
                response_schema=response_schema,
                timeout=timeout,
                strict_mode=strict_mode,
            )
        if provider == "gemini":
            return self._gemini_complete(
                api_key=api_key,
                model=model,
                prompt=prompt,
                system=system,
                json_mode=json_mode or (response_schema is not None),
                timeout=timeout,
            )
        if provider == "openai":
            return self._openai_compat_complete(
                api_key=api_key,
                base_url=None,
                model=model,
                prompt=prompt,
                system=system,
                json_mode=json_mode,
                response_schema=response_schema,
                timeout=timeout,
                strict_mode=strict_mode,
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
        response_schema: dict | None,
        timeout: float,
        strict_mode: bool = False,
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
                response_schema=response_schema,
                timeout=timeout,
                strict_mode=strict_mode,
            )
        if provider == "gemini":
            return self._gemini_vision(
                api_key=api_key,
                model=model,
                prompt=prompt,
                system=system,
                image_bytes=image_bytes,
                json_mode=json_mode or (response_schema is not None),
                timeout=timeout,
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
                response_schema=response_schema,
                timeout=timeout,
                strict_mode=strict_mode,
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
        response_schema: dict | None,
        timeout: float,
        strict_mode: bool = False,
    ) -> tuple[str, dict | None]:
        from openai import OpenAI

        kwargs_init: dict[str, Any] = {"api_key": api_key, "timeout": timeout}
        if base_url:
            kwargs_init["base_url"] = base_url
        # Inject no-retention header for direct OpenAI calls (not OpenRouter)
        if base_url is None:
            kwargs_init["default_headers"] = {"openai-beta": "no-store"}
        client = OpenAI(**kwargs_init)

        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        call_kwargs: dict[str, Any] = {"model": model, "messages": messages}
        # Strict privacy mode: inject ZDR body param for OpenRouter
        if strict_mode and base_url and "openrouter" in base_url:
            call_kwargs["extra_body"] = {"provider": {"zdr": True}}
        if response_schema is not None:
            # Structured outputs - schema travels in the API call, not in the prompt
            schema_name = (
                response_schema.get("$id") or response_schema.get("title") or "response"
            )
            call_kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": response_schema,
                    "strict": True,
                },
            }
        elif json_mode:
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
    def _openai_compat_complete_with_tools(
        api_key: str,
        base_url: str | None,
        model: str,
        prompt: str,
        system: str,
        tools: list[dict],
        tool_executor: Callable[[str, dict], Any] | None,
        tool_call_callback: Callable[[str, dict], None] | None,
        response_schema: dict | None,
        timeout: float,
        strict_mode: bool = False,
    ) -> tuple[str, dict | None]:
        """
        OpenAI tool-call round-trip (one hop max).

        Step 1: call with tools, no response_format.
        Step 2: if tool_calls returned, execute tool, inject result,
                call again with response_schema and no tools.
        Step 3: if no tool_call in step 1, call again with response_schema only.
        """
        from openai import OpenAI

        kwargs_init: dict[str, Any] = {"api_key": api_key, "timeout": timeout}
        if base_url:
            kwargs_init["base_url"] = base_url
        # Inject no-retention header for direct OpenAI calls (not OpenRouter)
        if base_url is None:
            kwargs_init["default_headers"] = {"openai-beta": "no-store"}
        client = OpenAI(**kwargs_init)

        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        # ── Step 1: tool-discovery call ───────────────────────────────────────
        call_kwargs_1: dict[str, Any] = {"model": model, "messages": messages}
        if tools:
            call_kwargs_1["tools"] = tools
            call_kwargs_1["tool_choice"] = "auto"
        # Strict privacy mode: inject ZDR body param for OpenRouter
        if strict_mode and base_url and "openrouter" in base_url:
            call_kwargs_1["extra_body"] = {"provider": {"zdr": True}}

        resp1 = client.chat.completions.create(**call_kwargs_1)
        choice1 = resp1.choices[0]
        usage: dict | None = None
        if resp1.usage:
            usage = {
                "prompt_tokens": resp1.usage.prompt_tokens,
                "completion_tokens": resp1.usage.completion_tokens,
                "total_tokens": resp1.usage.total_tokens,
            }

        # If no tool calls were made, proceed directly to final call
        tool_calls = getattr(choice1.message, "tool_calls", None) or []
        if not tool_calls:
            # Model answered directly - re-call with response_schema to get
            # the structured output (the first answer may be prose).
            # If no schema required, return the content directly.
            if response_schema is None:
                return choice1.message.content or "", usage

            # Append assistant's answer as context, ask for structured output
            messages.append(
                {"role": "assistant", "content": choice1.message.content or ""}
            )
            messages.append(
                {
                    "role": "user",
                    "content": "Ora fornisci la risposta nel formato JSON strutturato richiesto.",
                }
            )
        else:
            # ── Step 2: execute tool calls ─────────────────────────────────────
            # Append the assistant message with tool_calls
            messages.append(choice1.message)  # type: ignore[arg-type]
            for tc in tool_calls:
                fn_name = tc.function.name
                try:
                    fn_args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    fn_args = {}

                # Notify callback before execution (Phase 21 D-06)
                if tool_call_callback is not None:
                    try:
                        tool_call_callback(fn_name, fn_args)
                    except Exception:
                        pass  # Never let callback errors break LLM flow

                tool_result: Any = {}
                if tool_executor is not None:
                    try:
                        tool_result = tool_executor(fn_name, fn_args)
                    except Exception as exc:
                        tool_result = {"error": str(exc)}

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(tool_result, ensure_ascii=False),
                    }
                )

        # ── Step 3: final structured-output call ──────────────────────────────
        call_kwargs_2: dict[str, Any] = {"model": model, "messages": messages}
        if response_schema is not None:
            schema_name = (
                response_schema.get("$id") or response_schema.get("title") or "response"
            )
            call_kwargs_2["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": response_schema,
                    "strict": True,
                },
            }
        # Strict privacy mode: inject ZDR body param for OpenRouter in Step 3 as well
        if strict_mode and base_url and "openrouter" in base_url:
            call_kwargs_2["extra_body"] = {"provider": {"zdr": True}}

        resp2 = client.chat.completions.create(**call_kwargs_2)
        if resp2.usage:
            # Accumulate token counts across both calls
            prior = usage or {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            }
            usage = {
                "prompt_tokens": prior["prompt_tokens"] + resp2.usage.prompt_tokens,
                "completion_tokens": prior["completion_tokens"]
                + resp2.usage.completion_tokens,
                "total_tokens": prior["total_tokens"] + resp2.usage.total_tokens,
            }

        return resp2.choices[0].message.content or "", usage

    @staticmethod
    def _openai_compat_vision(
        api_key: str,
        base_url: str | None,
        model: str,
        prompt: str,
        system: str,
        image_bytes: bytes,
        json_mode: bool,
        response_schema: dict | None,
        timeout: float,
        strict_mode: bool = False,
    ) -> str:
        import base64

        from openai import OpenAI

        kwargs_init: dict[str, Any] = {"api_key": api_key, "timeout": timeout}
        if base_url:
            kwargs_init["base_url"] = base_url
        # Inject no-retention header for direct OpenAI calls (not OpenRouter)
        if base_url is None:
            kwargs_init["default_headers"] = {"openai-beta": "no-store"}
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
        # Strict privacy mode: inject ZDR body param for OpenRouter
        if strict_mode and base_url and "openrouter" in base_url:
            call_kwargs["extra_body"] = {"provider": {"zdr": True}}
        if response_schema is not None:
            schema_name = (
                response_schema.get("$id") or response_schema.get("title") or "response"
            )
            call_kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": response_schema,
                    "strict": True,
                },
            }
        elif json_mode:
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
        timeout: float | None = None,
    ) -> tuple[str, dict | None]:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        cfg: dict[str, Any] = {}
        if json_mode:
            cfg["response_mime_type"] = "application/json"
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        request_options = (
            types.RequestOptions(timeout=int(timeout * 1000)) if timeout else None
        )
        response = client.models.generate_content(
            model=model,
            contents=full_prompt,
            config=cfg if cfg else None,
            request_options=request_options,
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
        timeout: float | None = None,
    ) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        cfg: dict[str, Any] = {}
        if json_mode:
            cfg["response_mime_type"] = "application/json"
        request_options = (
            types.RequestOptions(timeout=int(timeout * 1000)) if timeout else None
        )
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                full_prompt,
            ],
            config=cfg if cfg else None,
            request_options=request_options,
        )
        return response.text


def get_llm_client() -> LLMClient:
    """FastAPI dependency for LLMClient. Reads config.json for routing, env for API keys."""
    return LLMClient(cfg=get_llm_config())
