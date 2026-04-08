# Phase 21: Coach Output Rationalization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 21-coach-output-rationalization
**Areas discussed:** enrichment types, caps/configurability, tool-usage bubbles, test seeding

---

## Enrichment Type Inventory

User reviewed all 8 existing response surfaces and proposed new ones.

### Decisions per surface:

| Surface | User Decision | Notes |
| --- | --- | --- |
| resource_cards + learn_cards | **Unify → `content_cards`** | "resource_cards is just learn_cards done early" |
| action_cards | **Rename → `interactive_cards`**, keep only `reminder` | Kill calculator ("ugly and debatable utility"), funnel, comparison, external_link. Partner offers → content_cards |
| new_insight | **Kill as visible card** | Becomes part of tool-usage bubble stream. Persistence continues silently |
| details_a2ui | **Keep, STS-only** | "Intended exclusively for STS to allow ultra-concise spoken part with complex visual complement" |
| affordability_verdict | **Keep, situational only** | "Should surface only when a direct affordability question is asked" |
| tool_usage bubbles | **NEW** | "Make an intermediate special message bubble showing tools usage — reassurance coach isn't hanging" (Honcho-style) |
| transaction_evidence | **NEW** | "Good idea, as long as it scales well on mobile (tables must have rows as cards)" |
| goal_progress | **NEW** | "Enticing, as long as we can detect/lift/process goal-defining signals" — accepted as LLM-estimated |
| comparison_table | **Rejected** | "Very situational, doesn't have great appeal to me" |

---

## Unified Card Naming

| Option | Description | Selected |
| --- | --- | --- |
| knowledge_cards | Emphasis on learning | |
| learn_cards | Repurpose existing name | |
| content_cards | Matches "content catalog" naming | ✓ |
| insight_cards | Already used for profile insights | |

**User's choice:** content_cards

---

## Enrichment Caps Mechanism

| Option | Description | Selected |
| --- | --- | --- |
| Hardcoded sensible defaults | Ship fast, tune later | |
| System settings in backend config | Admin-tunable, no user control | ✓ |
| User settings | Let users choose enrichment visibility | |

**User's choice:** System settings in backend config (admin-tunable, no user control)

---

## Tool-Usage Bubble Granularity

| Option | Description | Selected |
| --- | --- | --- |
| One bubble per tool call | Granular: "🔍 Searching transactions...", "📊 Loading profile..." | |
| Grouped single bubble | "Checking profile, transactions, and catalog..." | |
| Agent's discretion | | |

**User's choice:** Admin system setting: `"granular"` | `"grouped"` | `"hidden"` (not a single choice — configurable)

---

## Test Seeding

| Option | Description | Selected |
| --- | --- | --- |
| Use existing catalog only | Verify render as content_cards | |
| Seed new test content | Designed to trigger each enrichment type | |
| Both | Existing + targeted items for edge cases | ✓ |

**User's choice:** Both — use existing + add targeted items for goal progress and transaction evidence

---

## Deferred Ideas

- Comparison table enrichment (user lukewarm)
- User-configurable enrichment visibility (potential future phase)
- Precise goal tracking with savings balance (needs new data model)
