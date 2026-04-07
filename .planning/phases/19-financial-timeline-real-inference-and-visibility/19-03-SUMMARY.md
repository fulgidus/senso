---
plan: "19-03"
phase: "19"
status: complete
completed: "2026-04-07"
---

# Summary: 19-03 - Coach System Prompt + get_timeline_events Tool

## What was built

- `api/app/coaching/prompts/timeline_block.j2`: Jinja2 template that renders most recent 3 non-dismissed timeline events
- `_render_context()` accepts `user_id` and injects the timeline block when events exist (best-effort, never crashes coaching)
- `_GET_TIMELINE_TOOL`: LLM tool registered alongside `search_content` and `search_regional_knowledge`; filters by event type array; returns event list
- `_tool_executor` updated to handle `get_timeline_events` tool calls with user_id closure
- `complete_with_tools()` now receives 3 tools

## Key files created/modified
- `api/app/coaching/prompts/timeline_block.j2` — new
- `api/app/coaching/service.py`

## Self-Check: PASSED
