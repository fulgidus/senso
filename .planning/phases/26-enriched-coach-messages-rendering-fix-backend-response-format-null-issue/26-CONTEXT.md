# Phase 26: Enriched coach messages rendering fix - Context

**Gathered:** 2026-04-10
**Updated:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the two-part bug preventing enriched coach messages (`content_cards`, `interactive_cards`, `reasoning_used`) from rendering:

1. **Backend null coercion gap**: `_repair_response()` uses `dict.setdefault()` which skips keys that exist but are `null`. When the LLM returns `"content_cards": null` (valid in the current schema where these are optional), the null passes through to the API response. The frontend then crashes on `resp.content_cards.length` (null dereference).

2. **Schema: required fields**: `content_cards` and `interactive_cards` are not in the `required` array in `coaching_response.schema.json`. For OpenAI structured outputs, this means they can be omitted or returned as `null`. Adding them to `required` with strict `type: "array"` (no null) forces the LLM to always return them as arrays.

3. **Frontend defensive null-guards**: Even after the backend fix, harden the frontend rendering to not crash on null/missing fields from the API (belt + suspenders).

4. **Regression test**: A backend pytest that sends a mock LLM response with `"content_cards": null` and verifies `_repair_response()` normalizes it to `[]`.

</domain>

<decisions>
## Implementation Decisions

### Backend: null coercion in _repair_response()
- **D-01:** Replace `data.setdefault("content_cards", [])` with explicit `is None` check:
  ```python
  if data.get("content_cards") is None:
      data["content_cards"] = []
  if data.get("interactive_cards") is None:
      data["interactive_cards"] = []
  ```
  This is precise — only coerces actual `null`, never overwrites a valid empty array `[]`.
- **D-02:** Apply to: `content_cards`, `interactive_cards` only. Keep `transaction_evidence` and `goal_progress` as `None` (genuinely nullable per schema intent; rendered via `&&` guards on frontend).

### Schema: required fields + strict type
- **D-03:** Add `"content_cards"` and `"interactive_cards"` to the `required` array in `api/app/coaching/schemas/coaching_response.schema.json`.
- **D-04:** Also change their type from `["array", "null"]` to strict `"array"` (remove null from type union). This forces the LLM to always return an array — most reliable approach for OpenAI structured outputs. `additionalProperties: false` stays. No other schema changes.

### Frontend: defensive null guards
- **D-05:** In `AssistantBubble` render (ChatScreen.tsx ~line 710), replace `resp.content_cards.length > 0` with `(resp.content_cards ?? []).length > 0`.
- **D-06:** Same for `resp.interactive_cards` at ~line 715: `(resp.interactive_cards ?? []).length > 0`.
- **D-07:** In `parseStoredMessage`, after `JSON.parse(m.content)`, normalize **all array fields** to prevent future `.length` crashes from history messages:
  ```tsx
  parsed.content_cards ??= []
  parsed.interactive_cards ??= []
  ```
  Note: `details_a2ui`, `affordability_verdict`, `transaction_evidence`, `goal_progress` are already null-safe via `&&` guards in `AssistantBubble` and do not need normalization.

### Regression test (required)
- **D-08:** Add a backend pytest in `api/tests/` (co-locate with existing coaching tests) that:
  1. Calls `_repair_response()` directly with `{"content_cards": null, "interactive_cards": null, ...}` as input
  2. Asserts output has `content_cards == []` and `interactive_cards == []`
  3. Also tests the schema fix: valid mock LLM call with strict array type does not return null
  This is a **required plan task**, not agent discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Root cause files
- `api/app/coaching/service.py` — `_repair_response()` (~line 973): uses `setdefault` (BROKEN for null values); `_gate_enrichments()` (~line 1007): D-09 gating (do not modify)
- `api/app/coaching/schemas/coaching_response.schema.json` — line 7: `"required": ["message", "reasoning_used"]` — missing `content_cards`, `interactive_cards`; type is currently `["array", "null"]`
- `senso/src/features/coaching/ChatScreen.tsx` — line 710: `resp.content_cards.length > 0` (null crash site); line 715: `resp.interactive_cards.length > 0` (null crash site); line 918: `parseStoredMessage` (history parsing normalization)

### Existing tests to preserve
- `api/tests/test_coaching_*.py` — existing coaching service tests; do not break any currently green tests

</canonical_refs>

<code_context>
## Existing Code Insights

### _repair_response() — current broken pattern (lines 973–985)
```python
# Current (BROKEN for null values):
data.setdefault("content_cards", [])
data.setdefault("interactive_cards", [])

# Fixed (D-01):
if data.get("content_cards") is None:
    data["content_cards"] = []
if data.get("interactive_cards") is None:
    data["interactive_cards"] = []
```

### Frontend null crash (lines 710, 715)
```tsx
# Current (CRASHES if content_cards is null):
{resp.content_cards.length > 0 && (

# Fixed (D-05/06):
{(resp.content_cards ?? []).length > 0 && (
```

### Other frontend fields — already null-safe via &&
```tsx
{resp.affordability_verdict && <AffordabilityVerdictCard ... />}   // safe
{resp.details_a2ui && <DetailsToggle ... />}                       // safe
{resp.transaction_evidence && resp.transaction_evidence.transactions.length > 0 && ...} // safe
```
No changes needed for these — `&&` short-circuits on null.

### parseStoredMessage — history normalization (line 918)
```tsx
// After JSON.parse, before returning (D-07):
parsed.content_cards ??= []
parsed.interactive_cards ??= []
```

### Schema fix — add to required + strict type (D-03/04)
```json
"required": ["message", "reasoning_used", "content_cards", "interactive_cards"],
// AND change type for content_cards + interactive_cards from:
"type": ["array", "null"]
// to:
"type": "array"
```

</code_context>

<specifics>
## Specific Ideas

- The entire fix is ~10 lines of code across 3 files + one schema JSON change + one new pytest.
- The `is None` check is intentionally precise — `if not data.get("content_cards")` would also trigger on `[]` (falsy), overwriting a valid empty array. Use `is None` only.
- TypeScript 5.9 — `??=` assignment operator is fully supported.

</specifics>

<deferred>
## Deferred Ideas

- **History cards not restoring from full response_payload**: Full `response_payload` column for lossless message history restore is deferred.
- **D-09 gating tuning**: Whether `search_content` must be called to show cards is a separate product decision; the D-09 logic is correct and not in scope here.

</deferred>

---

*Phase: 26-enriched-coach-messages-rendering-fix-backend-response-format-null-issue*
*Context gathered: 2026-04-10*
*Context updated: 2026-04-10*
