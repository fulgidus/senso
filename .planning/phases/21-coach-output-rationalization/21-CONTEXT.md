---
phase: "21"
slug: coach-output-rationalization
created: "2026-04-06"
updated: "2026-04-07"
status: needs-replan
---

# Phase 21: Coach Output Rationalization - Context

**Gathered:** 2026-04-07
**Status:** Needs replan (context rewritten from user discussion)

<domain>
## Phase Boundary

Redesign the coaching response enrichment system. Unify redundant card types, add new
enrichment surfaces (tool-usage bubbles, transaction evidence, goal progress), make
enrichments situational instead of unconditional, and add admin-tunable caps. Produce
seeded content to verify behavior end-to-end.

**In scope:**
- Unify `resource_cards` + `learn_cards` → `content_cards`
- Rename `action_cards` → `interactive_cards` (keep only `reminder`; kill `calculator`, `funnel`, `comparison`, `external_link`)
- Add tool-usage intermediate bubbles (granular/grouped/hidden, admin setting)
- Add `transaction_evidence` enrichment surface
- Add `goal_progress` enrichment surface (LLM-estimated, not precise accounting)
- Make `affordability_verdict` fire only on direct affordability questions
- Restrict `details_a2ui` to STS (speech-to-speech) mode only
- Kill `new_insight` as a visible card — tool usage is shown via bubbles, insight persistence continues silently
- Kill unconditional fallback card injection
- Admin-tunable caps via backend config (not user settings)
- Seed test content for edge cases
- Chat UI rendering hierarchy update

**Not in scope:**
- Card visual redesign (just type/hierarchy/logic changes)
- Voice/streaming changes
- New interactive card types beyond `reminder` (future expansion)

</domain>

<decisions>
## Implementation Decisions

### Enrichment Types (final set)
- **D-01:** `content_cards` — unified card type replacing both `resource_cards` and `learn_cards`. Carries articles, videos, MARP slides, partner offers, AND inline microlearning snippets. Single array in response schema.
- **D-02:** `interactive_cards` — renamed from `action_cards`. Only `reminder` type survives. `calculator`, `funnel`, `comparison`, `external_link` all killed. Partner offers move to `content_cards`. Future interactive types (polls, quizzes, etc.) will be added here later.
- **D-03:** `affordability_verdict` — kept, but fires ONLY on direct affordability questions ("posso comprare", "mi conviene", "ho abbastanza per"). Must NOT fire on informational questions. Needs intent classifier.
- **D-04:** `details_a2ui` — kept, but fires ONLY when STS (speech-to-speech) mode is active. Allows concise spoken output with rich visual complement. Hidden in text-only coaching mode.
- **D-05:** `new_insight` — killed as visible card. The LLM still persists insights silently via `_persist_coaching_insight()`, but no card is rendered. Tool usage shown via bubbles instead.
- **D-06:** Tool-usage bubbles (NEW) — intermediate message bubbles showing LLM tool activity in real time. Gives user reassurance the coach isn't hanging. Prettified per tool type (e.g. 🔍 "Searching your transactions…", 📊 "Loading your profile…"). Admin system setting controls granularity: `"granular"` (one bubble per tool), `"grouped"` (single summary bubble), `"hidden"` (no bubbles).
- **D-07:** `transaction_evidence` (NEW) — mini-table of actual transactions backing the coach's advice. Tables render as row-cards on mobile (consistent with Phase 22 table→card pattern). Fires when the LLM cites specific transactions from `search_user_transactions` tool results.
- **D-08:** `goal_progress` (NEW) — progress indicator toward user's stated goals. LLM-estimated (not precise accounting): coach uses `get_user_preferences` (goals) + `get_user_profile` (income/expenses/margin) + `search_user_transactions` to infer progress. Shows as a simple progress bar + label. Fires when conversation context is relevant to a stated goal.

### Fallback Injection
- **D-09:** Delete `_inject_fallback_cards()` entirely. No unconditional card injection. If the LLM doesn't call `search_content`, no content_cards appear. If it doesn't emit a reminder, no interactive_cards appear. Silence is fine.

### Enrichment Caps
- **D-10:** Caps are admin-tunable via backend config (`Settings` or a dedicated config JSON), NOT hardcoded and NOT user-facing settings. Default caps:
  - `content_cards`: 2
  - `interactive_cards`: 1
  - `transaction_evidence` rows: 5
  - `goal_progress`: 1
  - `affordability_verdict`: 1
  - `details_a2ui`: 1 panel (STS only)

### Tool-Usage Bubble Granularity
- **D-11:** Admin system setting with three modes: `"granular"` | `"grouped"` | `"hidden"`. Default: `"granular"`. Setting stored in backend config (same mechanism as caps). Frontend reads the setting and renders accordingly.

### Test Seeding
- **D-12:** Use existing catalog content (articles, videos, slides, partners) for `content_cards` verification. Add targeted seed items for: goal progress (a user with stated goals + enough transaction history to estimate progress), transaction evidence (a user question that triggers transaction search and citation).

### Agent's Discretion
- Intent classifier implementation (regex vs lightweight model)
- Exact tool-usage bubble copy and icons per tool type
- How `goal_progress` maps free-text goals to measurable targets (LLM inference acceptable)
- Exact admin config key names and structure
- Schema migration strategy (rename fields, add new fields, deprecate old)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current coaching response schema
- `api/app/coaching/schemas/coaching_response.schema.json` — full response schema with all current fields; must be updated to reflect new enrichment types

### Coaching service (enrichment generation)
- `api/app/coaching/service.py` — `_repair_response()`, `_inject_fallback_cards()`, `_persist_coaching_insight()`, `_tool_executor()`, tool definitions
- `api/app/coaching/prompts/system_base.j2` — system prompt with tool-use guide (Phase 20)

### Frontend rendering
- `senso/src/features/coaching/ChatScreen.tsx` — `AssistantBubble` rendering, `LearnCardStub`, `AffordabilityVerdictCard`, card layout
- `senso/src/components/A2UISurface.tsx` — A2UI renderer (details_a2ui)

### Content catalog
- `api/app/content/search.py` — `search_content()` BM25 search used by `search_content` tool
- `api/app/content/articles.json`, `videos.json`, `slides.json`, `partners.json` — existing seeded content

### Backend config pattern
- `api/app/core/config.py` — `Settings` class (Pydantic BaseSettings) — where admin-tunable caps should live

### Existing enrichment components
- `senso/src/features/coaching/coachingApi.ts` — TypeScript types for response surfaces

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LearnCardStub` component: renders concept + explanation + example — can be the base for `content_cards` microlearning subtype
- `AffordabilityVerdictCard` component: already handles yes/no/conditional rendering — keep as-is, just gate on intent
- `A2UISurface` component: renders A2UI JSONL — keep for STS, hide otherwise
- `search_content` tool: already returns scored results from catalog — `content_cards` should be populated from tool results only
- `_tool_executor` closure: already has `user_id` and `db` — can track which tools were called during a request

### Established Patterns
- Backend `Settings` (Pydantic BaseSettings): env-var driven config — add cap settings here
- Streaming SSE: tool-usage bubbles need to integrate with the existing SSE streaming path (emit intermediate events)
- `_repair_response()`: currently forces empty arrays — will need updating for new schema

### Integration Points
- `coaching_response.schema.json` is the single source of truth — LLM structured output enforced via `response_format`
- Frontend `CoachingResponse` TypeScript type mirrors the schema — must be updated in sync
- SSE streaming endpoint emits delta events — tool-usage bubbles would be a new event type in the stream

</code_context>

<specifics>
## Specific Ideas

- Tool-usage bubbles inspired by Honcho-style intermediate feedback — user sees the coach "thinking" with specific actions, not just a spinner
- `interactive_cards` is explicitly designed as an expansion point — `reminder` is the MVP type, with future types (polls, quizzes, mini-calculators V2) coming later
- `transaction_evidence` must use the mobile card-layout pattern (tables → cards on small screens) being built in Phase 22
- `goal_progress` uses LLM inference, not precise accounting — "approximately 40% toward your emergency fund based on your current margin" is fine; "exactly €1,432.17 of €3,600.00" requires savings tracking we don't have

</specifics>

<deferred>
## Deferred Ideas

- Comparison table enrichment — user expressed lukewarm interest; revisit if A2UI proves insufficient for comparisons
- User-configurable enrichment visibility (let users toggle card types on/off) — potential Phase 24+ feature
- Precise goal tracking with savings balance column — requires new data model, not just LLM estimation

</deferred>

---

*Phase: 21-coach-output-rationalization*
*Context gathered: 2026-04-07*
