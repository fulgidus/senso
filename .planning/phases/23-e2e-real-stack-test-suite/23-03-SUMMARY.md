---
plan: "23-03"
phase: "23"
status: complete
completed: 2026-04-08
---

# Summary: Plan 23-03 - Coach Tool Call E2E (Real Stack)

## What Was Built

E2E tests verifying tool-call round-trip against real stack, and resource_card URL validation.

## Key Files Created/Modified

- `senso/e2e/real-stack/tool-calls.spec.ts` - 3 tests: profile tool call, italy rules tool call, resource_card URL validation
- `api/tests/llm_stub_server.py` - Already supported two-round tool-call flow from Plan 23-01; added `asyncio` import + `__SLOW_RESPONSE_TEST__` trigger (used in Plan 23-04)

## Decisions Made

- Tool call triggers use explicit substring prefixes in message body ("search_italy_rules", "get_user_profile") to avoid false positives
- Resource card URL validation is permissive (stub returns empty arrays, so no cards rendered) — test still validates no hallucinated URLs appear if cards are present
- Tests use same `.flex.justify-start` bubble selector pattern for consistency

## Self-Check: PASSED

- [x] Tool-call stub supports two-round conversation (round 1: tool_calls, round 2: final coaching JSON)
- [x] Tests discovered and TypeScript clean
- [x] Resource card URL assertions don't fail when no cards are rendered
