---
phase: "20"
slug: coach-intelligence-tool-suite-and-structured-memory
status: draft
nyquist_compliant: false
created: "2026-04-06"
---

# Phase 20 — Validation Strategy

## Test Commands

```bash
docker compose run --rm api uv run pytest api/tests/test_coaching_service.py -v
docker compose run --rm api uv run pytest api/tests/test_italy_rules.py -v
docker compose run --rm api uv run pytest api/tests/test_coaching_tools.py -v
docker compose run --rm frontend pnpm test && docker compose run --rm frontend pnpm build
```

## Per-Plan Test Map

| Plan | Test | What it guards |
|---|---|---|
| 20-01 | `test_italy_rules.py` | BM25 search returns correct IRPEF/INPS entries |
| 20-02 | `test_coaching_tools.py::test_get_user_profile` | Returns correct income snapshot |
| 20-02 | `test_coaching_tools.py::test_search_user_transactions` | BM25 over user txns returns relevant results |
| 20-03 | `test_coaching_tools.py::test_get_user_preferences` | Returns goals/dos/donts from DB |
| 20-04 | `test_coaching_service.py::test_insight_dedup` | Near-identical insight → update not append |
| 20-05 | `test_coaching_service.py::test_prompt_token_count` | System prompt tokens ≤ current - 40% |
| 20-06 | `test_coaching_service.py::test_food_spend_question_calls_transaction_tool` | Tool call verified |

## Acceptance Gate

- All new tests pass
- Italy rules BM25 index returns relevant entry for "IRPEF", "bonus cultura", "INPS"
- Coach for "quanto ho speso in cibo?" → `search_user_transactions` called (assert in test)
- System prompt token count reduced (measure before/after with tiktoken or character count)
- `pnpm build` clean
- No regressions in `test_coaching_endpoints.py`
