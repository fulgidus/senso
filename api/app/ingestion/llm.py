"""
LLM provider wrapper: Gemini Flash primary, OpenAI fallback.
Public API: LLMClient with complete() and vision() methods.
Inject via get_llm_client() FastAPI dependency.
"""

import json
from typing import Any


class LLMError(Exception):
    """Raised when all LLM providers fail."""


class LLMClient:
    def __init__(self, gemini_api_key: str | None, openai_api_key: str | None) -> None:
        self.gemini_api_key = gemini_api_key
        self.openai_api_key = openai_api_key

    def complete(
        self,
        prompt: str,
        system: str = "",
        json_mode: bool = False,
        timeout: float = 30.0,
    ) -> str:
        """Call Gemini Flash; fall back to OpenAI gpt-4o-mini on failure."""
        errors = []
        if self.gemini_api_key:
            try:
                return self._gemini_complete(prompt, system, json_mode, timeout)
            except Exception as e:
                errors.append(f"gemini: {e}")
        if self.openai_api_key:
            try:
                return self._openai_complete(prompt, system, json_mode, timeout)
            except Exception as e:
                errors.append(f"openai: {e}")
        raise LLMError(f"All providers failed: {'; '.join(errors)}")

    def vision(
        self,
        prompt: str,
        system: str = "",
        image_bytes: bytes = b"",
        json_mode: bool = False,
        timeout: float = 60.0,
    ) -> str:
        """Call Gemini Flash multimodal; fall back to GPT-4o vision on failure."""
        errors = []
        if self.gemini_api_key:
            try:
                return self._gemini_vision(
                    prompt, system, image_bytes, json_mode, timeout
                )
            except Exception as e:
                errors.append(f"gemini_vision: {e}")
        if self.openai_api_key:
            try:
                return self._openai_vision(
                    prompt, system, image_bytes, json_mode, timeout
                )
            except Exception as e:
                errors.append(f"openai_vision: {e}")
        raise LLMError(f"All vision providers failed: {'; '.join(errors)}")

    def _gemini_complete(
        self, prompt: str, system: str, json_mode: bool, timeout: float
    ) -> str:
        from google import genai

        client = genai.Client(api_key=self.gemini_api_key)
        config = {}
        if json_mode:
            config["response_mime_type"] = "application/json"
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=full_prompt,
            config=config if config else None,
        )
        return response.text

    def _openai_complete(
        self, prompt: str, system: str, json_mode: bool, timeout: float
    ) -> str:
        from openai import OpenAI

        client = OpenAI(api_key=self.openai_api_key)
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        kwargs: dict[str, Any] = {"model": "gpt-4o-mini", "messages": messages}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""

    def _gemini_vision(
        self,
        prompt: str,
        system: str,
        image_bytes: bytes,
        json_mode: bool,
        timeout: float,
    ) -> str:
        import base64
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.gemini_api_key)
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        config = {}
        if json_mode:
            config["response_mime_type"] = "application/json"
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                full_prompt,
            ],
            config=config if config else None,
        )
        return response.text

    def _openai_vision(
        self,
        prompt: str,
        system: str,
        image_bytes: bytes,
        json_mode: bool,
        timeout: float,
    ) -> str:
        import base64
        from openai import OpenAI

        client = OpenAI(api_key=self.openai_api_key)
        b64 = base64.b64encode(image_bytes).decode()
        messages = []
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
        resp = client.chat.completions.create(model="gpt-4o", messages=messages)
        return resp.choices[0].message.content or ""


def get_llm_client() -> LLMClient:
    """FastAPI dependency for LLMClient."""
    from app.core.config import get_settings

    s = get_settings()
    return LLMClient(gemini_api_key=s.gemini_api_key, openai_api_key=s.openai_api_key)
