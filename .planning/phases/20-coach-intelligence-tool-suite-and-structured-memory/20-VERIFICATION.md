---
status: pending
phase: "20"
---

# Phase 20 Verification — Coach Intelligence

## Must-Haves

| # | Requirement | Status | Evidence |
|---|-------------|--------|---------|
| 1 | `italy_rules.json` with IRPEF, INPS, bonus cultura, 730, TFR entries | ⏳ | |
| 2 | `search_italy_rules` LLM tool registered and callable | ⏳ | |
| 3 | `get_user_profile` LLM tool returns income/expense snapshot | ⏳ | |
| 4 | `search_user_transactions` LLM tool with BM25 over personal ledger | ⏳ | |
| 5 | `get_user_preferences` tool returns goals, dos, don'ts | ⏳ | |
| 6 | `recall_past_insights` tool with BM25 over coaching_insights | ⏳ | |
| 7 | `goals`, `dos`, `donts` columns on user_profiles | ⏳ | |
| 8 | coaching_insights items have `topic`, `value`, `created_at` structure | ⏳ | |
| 9 | Insight deduplication prevents near-duplicate entries | ⏳ | |
| 10 | System prompt no longer contains static full profile blob | ⏳ | |
| 11 | All pytest tests pass, no regressions | ⏳ | |
| 12 | `pnpm build` clean | ⏳ | |
