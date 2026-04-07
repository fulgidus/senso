---
phase: "21"
slug: coach-output-rationalization
created: "2026-04-06"
status: ready-to-execute
---

# Phase 21 Context - Coach Output Rationalization

## Why This Phase Exists

The coach currently emits 5 output surfaces on almost every response:
`affordability_verdict`, `resource_cards`, `action_cards`, `details_a2ui`, `new_insight`.

Problems:
- **Unconditional fallback injection**: if `resource_cards` is empty, `_inject_fallback_cards()`
  fires and forcibly adds content regardless of whether it's relevant.
- **Affordability verdict on non-purchase questions**: "Cos'è l'IRPEF?" returns
  `affordability_verdict: "no"` because the LLM defaults to null but the schema repair
  fills it in.
- **Action cards appear for informational answers**: "Spiega il TFR" shouldn't generate
  an action card telling the user to "open a pension fund" without context.
- **details_a2ui rendered as decorative noise**: panels with 1-2 numbers that add no
  comparison value.
- **resource_cards cap missing**: 4-5 cards dumped per response, overwhelming the UI.

The result: every response looks the same - a wall of cards regardless of intent.

## Trigger Matrix (desired state)

| Surface                 | Fires when                                                                              | Hard cap         |
| ----------------------- | --------------------------------------------------------------------------------------- | ---------------- |
| `affordability_verdict` | Message contains purchase intent ("posso comprare", "mi conviene", "ho abbastanza per") | 1                |
| `resource_cards`        | LLM called `search_content` AND got score ≥ 0.3 results                                 | 2                |
| `action_cards`          | LLM emits card with specific executable step (not generic advice)                       | 3                |
| `details_a2ui`          | Response compares ≥2 specific numbers side-by-side                                      | 1 panel, ≥2 rows |
| `new_insight`           | LLM identifies a new user-specific fact not in `recall_past_insights`                   | 1                |

## What This Phase Does

### 21-01: Purchase intent classifier
- `_detect_purchase_intent(message: str) -> bool`: lightweight regex + keyword classifier
  (no LLM call). Patterns: "posso comprare", "mi conviene acquistare", "ho i soldi per",
  "budget per", "afford", "conviene", "costo di"
- If intent = False, strip `affordability_verdict` from schema before calling LLM
  (send `coaching_simple_response.schema.json` instead of full schema)
- Test: 20 labeled messages → classification accuracy ≥90%

### 21-02: Remove unconditional fallback injection
- Delete `_inject_fallback_cards()` or gate it behind `purchase_intent = True` only
- Gate resource_cards: only populate if LLM called `search_content` tool (track in executor)
- Cap resource_cards at 2, action_cards at 3
- Cap details_a2ui: only rendered if panel has ≥2 data rows

### 21-03: details_a2ui quality gate
- Add `_validate_a2ui(panel) -> bool`: returns False if fewer than 2 rows, or if all
  values are null/zero, or if row labels are generic ("valore1", "valore2")
- If validation fails, set `details_a2ui = null` before returning response
- Update schema: `details_a2ui` rows `minimum: 2`

### 21-04: Chat UI rendering - visual hierarchy
- Chat messages: verdict → key message → cards (resource then action) → details panel
- Cards use a horizontal scroll strip on mobile (not vertical stack)
- `details_a2ui` collapsed by default with "Mostra dettagli ▾" toggle
- resource_cards: max 2 shown, "+N altri" if more exist (unused after cap)
- action_cards: distinct visual from resource_cards (icon + CTA, not thumbnail)
- Empty surfaces: never render empty card containers (currently renders empty `<div>`)

## Scope

**In scope:**
- `api/app/coaching/service.py` - intent classifier, fallback removal, surface caps
- `api/app/coaching/schemas/coaching_response.schema.json` - details_a2ui min rows
- `senso/src/features/coaching/ChatScreen.tsx` - card rendering hierarchy
- `senso/src/features/coaching/` - new card sub-components if needed
- `api/tests/` - intent classifier tests, response shape tests

**Not in scope:**
- Redesigning card visual style (just hierarchy/rendering logic)
- Voice output changes
- Streaming changes
