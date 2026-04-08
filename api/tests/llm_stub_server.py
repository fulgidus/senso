"""
LLM stub server for E2E real-stack tests.

Implements OpenAI-compatible /v1/chat/completions so the FastAPI backend's
openrouter provider (which uses OpenAI SDK with base_url override) hits this
instead of the real OpenRouter during Playwright tests.

Fixture responses are matched by substring in the serialised request body.
Named triggers: "search_italy_rules", "get_user_profile", "__SLOW_RESPONSE_TEST__".
Default: valid coaching_response with message + reasoning_used, all optional fields null.

Tool-call flow (plan 23-03):
  Round 1: if trigger found in request → return tool_calls response
  Round 2: request contains "tool" role messages → return final coaching JSON

"__SLOW_RESPONSE_TEST__" trigger: sleeps 90s to simulate LLM timeout (plan 23-04).

Usage:
    uvicorn llm_stub_server:app --host 0.0.0.0 --port 4010
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
app = FastAPI(title="LLM Stub Server")

# ---------------------------------------------------------------------------
# Shared coaching response payloads
# ---------------------------------------------------------------------------

_DEFAULT_COACHING = {
    "message": "Risposta stub: tutto sembra in ordine.",
    "reasoning_used": [
        {"step": "Analisi base", "detail": "Risposta generata dallo stub di test."},
    ],
    "content_cards": [],
    "interactive_cards": [],
    "transaction_evidence": None,
    "goal_progress": None,
    "details_a2ui": None,
    "affordability_verdict": None,
    "new_insight": None,
}

_ITALY_RULES_COACHING = {
    "message": (
        "L'IRPEF 2025 ha 3 scaglioni: 23% fino a 28.000€, "
        "35% da 28.001€ a 50.000€, 43% oltre 50.000€."
    ),
    "reasoning_used": [
        {
            "step": "Ricerca regole italiane",
            "detail": "Ho recuperato le aliquote IRPEF 2025 dal knowledge base.",
        },
    ],
    "content_cards": [],
    "interactive_cards": [],
    "transaction_evidence": None,
    "goal_progress": None,
    "details_a2ui": None,
    "affordability_verdict": None,
    "new_insight": None,
}

_PROFILE_COACHING = {
    "message": "Il tuo profilo finanziario è stato analizzato: hai un buon margine mensile.",
    "reasoning_used": [
        {
            "step": "Analisi profilo",
            "detail": "Ho recuperato il tuo profilo reale dal database.",
        },
    ],
    "content_cards": [],
    "interactive_cards": [],
    "transaction_evidence": None,
    "goal_progress": None,
    "details_a2ui": None,
    "affordability_verdict": None,
    "new_insight": None,
}

# ---------------------------------------------------------------------------
# Tool call payloads (used in two-round tool flow - plan 23-03)
# ---------------------------------------------------------------------------

_SEARCH_ITALY_RULES_TOOL_CALL = {
    "id": "call_search_italy_001",
    "type": "function",
    "function": {
        "name": "search_italy_rules",
        "arguments": json.dumps({"query": "aliquote IRPEF 2025"}),
    },
}

_GET_USER_PROFILE_TOOL_CALL = {
    "id": "call_get_profile_001",
    "type": "function",
    "function": {
        "name": "get_user_profile",
        "arguments": json.dumps({}),
    },
}


def _make_chat_response(content: str | dict) -> dict:
    """Wrap content in an OpenAI-compat chat completions response."""
    text = content if isinstance(content, str) else json.dumps(content)
    return {
        "id": "stub-chatcmpl-0001",
        "object": "chat.completion",
        "created": 1700000000,
        "model": "stub-model",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 10, "completion_tokens": 50, "total_tokens": 60},
    }


def _make_tool_call_response(tool_call: dict) -> dict:
    """Return an OpenAI-compat response requesting a tool call."""
    return {
        "id": "stub-chatcmpl-tool-0001",
        "object": "chat.completion",
        "created": 1700000000,
        "model": "stub-model",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [tool_call],
                },
                "finish_reason": "tool_calls",
            }
        ],
        "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/v1/chat/completions")
async def chat_completions(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        body = {}

    body_str = json.dumps(body)
    logger.debug("LLM stub received: %s", body_str[:500])

    # Slow response trigger: 90s sleep to simulate LLM timeout (plan 23-04)
    if "__SLOW_RESPONSE_TEST__" in body_str:
        await asyncio.sleep(90)
        return JSONResponse(_make_chat_response(_DEFAULT_COACHING))

    # Detect second round of a tool-call flow: messages contain a "tool" role
    messages = body.get("messages", [])
    has_tool_role = any(m.get("role") == "tool" for m in messages)

    if has_tool_role:
        # Round 2: resolve tool results → produce final coaching response
        if "search_italy_rules" in body_str or "aliquote" in body_str:
            return JSONResponse(_make_chat_response(_ITALY_RULES_COACHING))
        if "get_user_profile" in body_str:
            return JSONResponse(_make_chat_response(_PROFILE_COACHING))
        return JSONResponse(_make_chat_response(_DEFAULT_COACHING))

    # Round 1 (or single-shot): match trigger in body
    if "search_italy_rules" in body_str:
        return JSONResponse(_make_tool_call_response(_SEARCH_ITALY_RULES_TOOL_CALL))

    if "get_user_profile" in body_str:
        return JSONResponse(_make_tool_call_response(_GET_USER_PROFILE_TOOL_CALL))

    # Default: simple coaching response
    return JSONResponse(_make_chat_response(_DEFAULT_COACHING))
