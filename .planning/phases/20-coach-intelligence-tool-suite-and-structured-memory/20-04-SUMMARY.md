---
plan: "20-04"
phase: "20"
status: complete
completed: "2026-04-07"
---

# Summary: 20-04 - Structured Coaching Memory + recall_past_insights Tool

## What was built

- `coaching_response.schema.json` updated: `new_insight` now requires `topic` + `value` (with backward-compat `headline`/`data_point`/`educational_framing`)
- `_persist_coaching_insight` rewritten with topic-based dedup (upsert by topic, not append-only)
- 180-day auto-pruning on every persist call
- `_RECALL_INSIGHTS_TOOL` LLM tool: keyword search over coaching insights

## Self-Check: PASSED
