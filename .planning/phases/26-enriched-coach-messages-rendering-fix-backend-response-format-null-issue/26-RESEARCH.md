# Phase 26: Research — Enriched Coach Messages Rendering Fix

**Researched:** 2026-04-10
**Status:** RESEARCH COMPLETE

---

## Root Cause Confirmation

### 1. Backend: `_repair_response()` null coercion gap (CONFIRMED)

**File:** `api/app/coaching/service.py` lines 980–981

```python
# CURRENT (BROKEN for null values):
data.setdefault("content_cards", [])
data.setdefault("interactive_cards", [])
```

`dict.setdefault(key, default)` only inserts the default **if the key is absent**. When the LLM returns `"content_cards": null`, the key **exists** with value `None`, so `setdefault` is a no-op. The null passes through untouched.

**Fix:** Use explicit `is None` check (D-01):
```python
if data.get("content_cards") is None:
    data["content_cards"] = []
if data.get("interactive_cards") is None:
    data["interactive_cards"] = []
```

### 2. Schema: `required` array incomplete (CONFIRMED)

**File:** `api/app/coaching/schemas/coaching_response.schema.json` line 7

```json
"required": ["message", "reasoning_used"]
```

`content_cards` and `interactive_cards` are **not required** → OpenAI structured outputs may omit or return null for them. The schema type is already strict `"array"` (not `["array", "null"]`), so only the `required` entry is missing.

**Fix (D-03):** Add both to required:
```json
"required": ["message", "reasoning_used", "content_cards", "interactive_cards"]
```

No type change needed (already `"array"` without null).

### 3. Frontend: null crash sites (CONFIRMED)

**File:** `senso/src/features/coaching/ChatScreen.tsx`

Line 710: `{resp.content_cards.length > 0 && (` — crashes if null  
Line 715: `{resp.interactive_cards.length > 0 && (` — crashes if null

TypeScript interface in `coachingApi.ts` declares both as `ContentCard[]` / `InteractiveCard[]` (non-nullable) but runtime API may still return null when backend fails to coerce.

**Fix (D-05/D-06):**
```tsx
{(resp.content_cards ?? []).length > 0 && (
{(resp.interactive_cards ?? []).length > 0 && (
```

### 4. `parseStoredMessage` — history normalization (CONFIRMED)

**File:** `senso/src/features/coaching/ChatScreen.tsx` lines 918–934

After `JSON.parse(m.content)`, the parsed object is cast to `CoachingResponse` but never normalized. If history messages stored null for these arrays, they'll crash on replay.

**Fix (D-07):**
```tsx
parsed.content_cards ??= []
parsed.interactive_cards ??= []
```

---

## Existing Test Infrastructure

**Key finding:** `api/tests/test_safety_hardening.py` already contains `test_repair_response_fills_missing_fields()` at line 349 which tests that `_repair_response` fills **absent** keys. It does NOT test the null coercion case.

The new regression test (D-08) should be added **to `test_safety_hardening.py`** (colocation with existing repair tests), not in a separate file.

Pattern to follow:
```python
def test_repair_response_coerces_null_arrays(self):
    """_repair_response must coerce null content_cards/interactive_cards to []."""
    from app.coaching.service import CoachingService
    svc = CoachingService.__new__(CoachingService)
    repaired = svc._repair_response({
        "message": "test",
        "content_cards": None,
        "interactive_cards": None,
    })
    assert repaired["content_cards"] == []
    assert repaired["interactive_cards"] == []
```

---

## _gate_enrichments() — Interaction Check

`_gate_enrichments()` (line 1007) runs **after** `_repair_response()`. It does:
- `data["content_cards"] = []` when `search_content` not called
- Uses `data.get("content_cards", [])` for length checks (safe)

**No changes needed here** — already safe. D-09 gating is out of scope.

---

## Scope Boundary

| Component | Change | Risk |
|-----------|--------|------|
| `service.py` `_repair_response()` | 4 lines | Minimal — only affects null path |
| `coaching_response.schema.json` | Add 2 fields to `required` | Low — forces arrays (already typed as array) |
| `ChatScreen.tsx` | 2 null-coalescing operators + 2 ??= lines | Minimal — purely defensive |
| `test_safety_hardening.py` | 1 new test method | None |

Total: ~12 lines of code change.

---

## Validation Architecture

### Unit Tests
- **New:** `test_repair_response_coerces_null_arrays` in `test_safety_hardening.py` — direct call to `_repair_response` with null inputs
- **Existing:** `test_repair_response_fills_missing_fields` must remain green

### Integration Checks
- Frontend null guards: TypeScript compilation with `strict: true` will catch any type errors from the `??` operators
- Schema validation: existing schema tests should pass; the required field addition forces structured output compliance

### Run Tests
```bash
docker compose run --rm api uv run pytest api/tests/test_safety_hardening.py -v
docker compose run --rm frontend pnpm build
```

## RESEARCH COMPLETE
