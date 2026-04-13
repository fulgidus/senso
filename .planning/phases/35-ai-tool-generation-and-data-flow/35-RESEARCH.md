# Phase 35 Research — AI Tool Generation & Data Flow

**Phase:** 35 (AI Tool Generation & Data Flow)
**Date:** 2026-04-13
**Requirements:** CORE-04, DATA-05, DATA-07, DATA-04
**Purpose:** Auto-generate LLM tool definitions from Chest metadata; route ingestion to domain Chests; domain-aware adaptive extraction; webhook connector.

---

## Inputs Reviewed

- `be/app/coaching/service.py` — 7 hardcoded OpenAI tool dicts; `_tool_executor()` closure; `tools_called` set tracking
- `be/app/services/ingestion_service.py` — `TransactionModel` hardcoded inserts on confirm; finance-specific `_NON_LEDGER_TYPES`
- `be/app/ingestion/adaptive.py` — `_classify_document()` uses `classify_response.schema.json`; `document_type` strings are finance-assumed
- `be/app/domain/manifest.py` — `ChestDef.access`, `ChestDef.tool_spec` override field
- `be/app/data/factory.py` — `DomainModelFactory` (Phase 34) provides Table per chest

---

## CORE-04: LLM Tool Auto-Generation

### Existing tool structure
Each hardcoded tool dict follows OpenAI function-calling format:
```json
{
  "type": "function",
  "function": {
    "name": "get_user_profile",
    "description": "...",
    "parameters": { "type": "object", "properties": {...}, "required": [...], "additionalProperties": false }
  }
}
```

### Generation strategy per access mode

**`tool_callable` chests** → generate two tools:
1. `get_{chest_id}` — read all rows for current user (no params)
2. `update_{chest_id}` — write/merge fields (params = writable schema fields)

**`searchable` chests** → generate one tool:
1. `search_{chest_id}` — BM25 search (params: `query: str`, `locale: str`, `top_k: int`)

**`ChestDef.tool_spec` override** — if set, use it verbatim instead of generated definition.

### ToolGenerator output
```python
class ToolGenerator:
    def generate(self, chest: ChestDef, schema: dict, locale_default: str) -> list[dict]:
        """Returns 1-2 OpenAI tool dicts for this chest."""

class ToolRegistry:
    """Holds all generated + manually registered tools for a domain session."""
    def get_all(self) -> list[dict]: ...
    def get_executor(self, name: str) -> Callable | None: ...
    def register_executor(self, name: str, fn: Callable) -> None: ...
```

### CoachingService integration
`CoachingService` currently builds its tool list inline.
Phase 35: inject `ToolRegistry` into `CoachingService.__init__` instead.
`_tool_executor()` delegates unknown tool names to `ToolRegistry.get_executor(name)`.

---

## DATA-05: File Upload → Domain Chests

### Current flow (finance-hardcoded)
```
upload → extract → confirm → TransactionModel.insert() [HARDCODED]
                           → UserProfile.update() [HARDCODED]
```

### v2.0 flow
```
upload → extract → confirm → ChestRouter.route(doc_type, extracted) → ChestAccessor.create()
```

**`ChestRouter`**: maps `document_type` (from classify_response) to target `chest_id` using manifest extractor definitions.

```python
class ChestRouter:
    """Routes an extracted document to the correct Chest based on manifest extractors."""
    def __init__(self, manifest: DomainManifest, manager: DomainManager) -> None: ...
    def route(self, doc_type: str, extracted: ExtractedDocument, identity_id: str, db: Session) -> list[str]: ...
    # Returns list of created row IDs
```

The manifest `extractors` section declares `document_types` and `target_chests`.
`ChestRouter` looks up which extractor handles this `doc_type` → writes to `target_chests`.

---

## DATA-07: Adaptive Extraction — Domain-Aware

### Current hardcoding
`adaptive.py` uses `_classify_document()` → returns finance document types (`bank_statement`, `payslip`, `receipt`, etc.) hardcoded in `classify_response.schema.json`.

### v2.0 fix
`classify_response.schema.json` must not enumerate finance types. Instead:
- The `enum` in `classify_response.schema.json` is replaced with a free `string` type
- Domain manifest `extractors` list provides the valid document types
- Adaptive pipeline receives `allowed_document_types: list[str]` from manifest and validates against it

The adaptive pipeline renders `render_classify_prompt()` with a `document_types` variable derived from manifest extractors, not a hardcoded list.

---

## DATA-04: Webhook Connector

### No existing webhook code
Build fresh. Pattern: HTTP POST endpoint, HMAC-SHA256 signature validation, payload routing.

### HMAC validation
Standard `X-Webhook-Signature: sha256=<hex>` header.
```python
import hashlib, hmac

def verify_hmac(payload: bytes, secret: str, signature: str) -> bool:
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    received = signature.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)
```

Secret per domain, configured in manifest `behavior` or a new `webhooks` section.

### Routing
Inbound payload has a `chest_id` field (or inferred from endpoint path `/webhook/{domain_id}/{chest_id}`).
Validated payload → `ChestAccessor.create()`.

---

## Phase 35 Package Layout

New:
```
be/app/tools/
├── __init__.py
├── generator.py   # ToolGenerator: ChestDef → OpenAI tool dict
└── registry.py    # ToolRegistry: holds all tools + executor dispatch
be/app/api/webhook.py   # Webhook endpoint + HMAC validation
```

Modified:
- `be/app/services/ingestion_service.py` — replace hardcoded inserts with ChestRouter
- `be/app/ingestion/adaptive.py` — replace hardcoded doc types with manifest-derived list
- `be/app/coaching/service.py` — inject ToolRegistry; delegate to it in _tool_executor
- `be/app/main.py` — build ToolRegistry at startup, store in app.state

---

## Confidence

| Decision | Confidence | Notes |
|----------|-----------|-------|
| Generate get_/search_/update_ per access mode | HIGH | Clean mapping from ChestDef.access |
| ChestRouter for ingestion routing | HIGH | Decouples doc_type → chest from service layer |
| Adaptive free-string classify_response | HIGH | Removes the only finance enum from platform |
| HMAC-SHA256 standard header | HIGH | Industry standard, `cryptography` already installed |
| `tool_spec` override on ChestDef | HIGH | Escape hatch for complex domain tools |

*Research complete: 2026-04-13*
