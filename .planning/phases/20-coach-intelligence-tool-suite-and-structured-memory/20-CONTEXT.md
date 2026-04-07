---
phase: "20"
slug: coach-intelligence-tool-suite-and-structured-memory
created: "2026-04-06"
status: ready-to-execute
---

# Phase 20 Context - Coach Intelligence: Tool Suite + Structured Memory

## Why This Phase Exists

The coach currently operates with one tool (`search_content` BM25 catalog) and a
prompt stuffed with static profile data. This causes:
- **Prompt bloat**: all profile data injected every request regardless of relevance
- **No personal transaction knowledge**: coach cannot answer "what did I spend on food
  last month?" without transactions being summarized in the profile blob
- **No Italy-specific rules**: coach gives generic European advice, not IRPEF/INPS/
  bonus cultura/730 specifics
- **No user goals/preferences**: user cannot say "I'm saving for a house" and have the
  coach remember and reference it across sessions
- **Coaching insights are decorative**: `coaching_insights` list grows unboundedly,
  never queried, never deduplicated, coach never references past insights

## Knowledge Buckets

| Bucket                       | Storage            | Access    | Tool                                  |
| ---------------------------- | ------------------ | --------- | ------------------------------------- |
| 🌍 Global educational catalog | BM25 (existing)    | Tool call | `search_content` (existing)           |
| 🇮🇹 Italy financial rules      | Static JSON + BM25 | Tool call | `search_italy_rules` (new)            |
| 👤 User profile snapshot      | DB                 | Tool call | `get_user_profile` (new)              |
| 💳 User transaction search    | DB + BM25          | Tool call | `search_user_transactions` (new)      |
| 📅 User timeline              | DB                 | Tool call | `get_timeline_events` (from Phase 19) |
| ⚙️ User preferences           | DB (new columns)   | Tool call | `get_user_preferences` (new)          |
| 🧠 Coaching memory            | DB (structured)    | Tool call | `recall_past_insights` (new)          |

## What This Phase Does

### 20-01: Italy rules knowledge base
- `api/app/content/italy_rules.json` - static JSON with IRPEF brackets, INPS thresholds,
  bonus cultura, 730 filing dates, ISEE thresholds, TFR rules, pension contribution rates
- BM25 index built at startup alongside content catalog
- `search_italy_rules(topic, locale)` tool

### 20-02: User profile + transaction tools
- `get_user_profile()` tool: returns condensed profile snapshot (income range, savings
  rate, top spending categories, net worth estimate)
- `search_user_transactions(query, date_from, date_to, category, limit)` tool:
  BM25 over user's own transaction descriptions + counterparts
- Profile snapshot replaces static profile block in system prompt (lazy-loaded only when
  coach needs it via tool)

### 20-03: User preferences (goals, dos, don'ts)
- New DB columns: `user_profiles.goals JSONB`, `user_profiles.dos JSONB`,
  `user_profiles.donts JSONB`
- `get_user_preferences()` tool: returns goals, dos, don'ts
- Frontend: preferences section in Settings or Profile (simple list editor)
- Coach system prompt preamble mentions that preferences exist and can be fetched

### 20-04: Structured coaching memory + recall_past_insights tool
- Redesign `coaching_insights`: each insight gets `topic`, `value`, `created_at`,
  `expires_at` (optional), `source_session_id` - migrate from free-form list
- `recall_past_insights(topic)` tool: BM25 search over insight `topic`+`value` fields
- Deduplication: before writing a new insight, check if near-identical insight exists
  (topic match + value similarity) → update `updated_at` instead of appending
- Prune insights older than 180 days automatically

### 20-05: Prompt architecture refactor - tool-first, prompt-lean
- Remove static profile block from system prompt
- System prompt becomes: persona soul + tool inventory + response schema + safety rules
- Coach calls tools to fetch what it needs per request (lazy, relevant, not bloated)
- Measure: system prompt token count should drop ≥40% vs current

### 20-06: Tests + integration verification
- Unit tests for each new tool function
- Integration test: coach response for "quanto ho speso in cibo a marzo?" requires
  `search_user_transactions` tool call (assert tool was called with correct params)
- Integration test: coach mentions Italy-specific rule → `search_italy_rules` was called

## Scope

**In scope:**
- `api/app/content/italy_rules.json` - new knowledge base
- `api/app/content/search.py` - Italy rules index
- `api/app/coaching/service.py` - new tools, tool executor, prompt refactor
- `api/app/db/models.py` + `session.py` - goals/dos/donts/insight migration
- `api/app/services/profile_service.py` - insight dedup
- Frontend: minimal preferences UI in Settings
- `api/tests/` - tool tests + integration

**Not in scope:**
- Vector embeddings / Qdrant (BM25 is sufficient for MVP)
- Multi-turn memory beyond session (conversation history already persisted in DB)
- LLM fine-tuning
