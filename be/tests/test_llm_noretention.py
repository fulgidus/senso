"""Tests for LLM no-retention header/body injection. Uses unittest.mock - no live API calls."""

from unittest.mock import MagicMock, patch

import pytest


def _make_mock_response(content="{}"):
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    resp.choices[0].message.tool_calls = None
    resp.usage = None
    return resp


def test_openai_direct_gets_nostore_header():
    """_openai_compat_complete with base_url=None injects openai-beta: no-store."""
    from app.ingestion.llm import LLMClient

    captured_init_kwargs = {}

    def fake_openai_class(**kwargs):
        captured_init_kwargs.update(kwargs)
        client = MagicMock()
        client.chat.completions.create.return_value = _make_mock_response()
        return client

    with patch("openai.OpenAI", side_effect=fake_openai_class):
        LLMClient._openai_compat_complete(
            api_key="test-key",
            base_url=None,
            model="gpt-4o-mini",
            prompt="test",
            system="",
            json_mode=False,
            response_schema=None,
            timeout=10.0,
            strict_mode=False,
        )

    assert "default_headers" in captured_init_kwargs, "default_headers not set"
    assert captured_init_kwargs["default_headers"].get("openai-beta") == "no-store"


def test_openrouter_standard_mode_no_zdr():
    """_openai_compat_complete with openrouter base_url and strict_mode=False: no extra_body."""
    from app.ingestion.llm import LLMClient

    captured_call_kwargs = {}

    def fake_openai_class(**kwargs):
        client = MagicMock()

        def capture_create(**ckw):
            captured_call_kwargs.update(ckw)
            return _make_mock_response()

        client.chat.completions.create.side_effect = capture_create
        return client

    with patch("openai.OpenAI", side_effect=fake_openai_class):
        LLMClient._openai_compat_complete(
            api_key="test-key",
            base_url="https://openrouter.ai/api/v1",
            model="mistralai/mistral-small",
            prompt="test",
            system="",
            json_mode=False,
            response_schema=None,
            timeout=10.0,
            strict_mode=False,
        )

    assert "extra_body" not in captured_call_kwargs, (
        "extra_body should NOT be set in standard mode"
    )


def test_openrouter_strict_mode_injects_zdr():
    """_openai_compat_complete with openrouter base_url and strict_mode=True injects ZDR body."""
    from app.ingestion.llm import LLMClient

    captured_call_kwargs = {}

    def fake_openai_class(**kwargs):
        client = MagicMock()

        def capture_create(**ckw):
            captured_call_kwargs.update(ckw)
            return _make_mock_response()

        client.chat.completions.create.side_effect = capture_create
        return client

    with patch("openai.OpenAI", side_effect=fake_openai_class):
        LLMClient._openai_compat_complete(
            api_key="test-key",
            base_url="https://openrouter.ai/api/v1",
            model="mistralai/mistral-small",
            prompt="test",
            system="",
            json_mode=False,
            response_schema=None,
            timeout=10.0,
            strict_mode=True,
        )

    assert "extra_body" in captured_call_kwargs, "extra_body must be set in strict mode"
    assert captured_call_kwargs["extra_body"] == {"provider": {"zdr": True}}
