---
plan: "21-02"
phase: "21"
status: complete
completed: "2026-04-08"
commit: 662233a
---

# Plan 21-02 SUMMARY: Tool-Usage SSE Streaming Infrastructure

## What Was Built

Refactored the `/chat/stream` endpoint to use `threading.Thread` + `queue.Queue` to interleave real-time tool-usage SSE events with the final response stream. Added `tool_call_callback` parameter throughout the LLM call chain.

## Key Files Modified

- `api/app/api/coaching.py` — Refactored `/chat/stream` with threading/queue, `_prepare_chat_result` accepts `tool_call_callback`, emits `tool_use` + `tools_complete` SSE events
- `api/app/ingestion/llm.py` — `complete_with_tools()` and `_openai_compat_complete_with_tools()` accept `tool_call_callback`
- `api/app/coaching/service.py` — `chat()` accepts and passes `tool_call_callback`, `_tool_executor()` returns `(executor_fn, tools_called_set)` tuple

## Must-Have Verification

- ✓ `/chat/stream` uses `threading.Thread` and `queue.Queue`
- ✓ `tool_use` SSE events emitted per tool (granularity=granular)
- ✓ `tools_complete` event emitted with full tools list
- ✓ `CoachingService.chat()` has `tool_call_callback` parameter
- ✓ `_tool_executor()` returns `tuple[Callable, set[str]]`
- ✓ Non-streaming `/chat` endpoint unchanged (no callback passed)
- ✓ `granularity="hidden"` produces zero tool_use events
- ✓ All coaching endpoint tests pass (13/13)

## Self-Check: PASSED
