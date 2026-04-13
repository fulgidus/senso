# Phase 33 Research — Foundation Platform

**Phase:** 33 (Foundation Platform)
**Date:** 2026-04-13
**Requirements:** CORE-01, CORE-02, CORE-03, CORE-05
**Purpose:** Determine concrete implementation approach for Domain Manifest parser and Chest Registry.

---

## Inputs Reviewed

- `.planning/ROADMAP.md` — Phase 33 success criteria
- `.planning/REQUIREMENTS.md` — CORE-01–05 definitions
- `.planning/MILESTONE-CONTEXT.md` — v2.0 scope and constraints
- `be/pyproject.toml` — existing deps (PyYAML, Pydantic v2, FastAPI, jsonschema all present)
- `be/app/ingestion/registry.py` — existing ModuleRegistry singleton pattern
- `be/app/coaching/safety.py` — existing YAML loading with `yaml.safe_load()`
- `be/app/personas/loader.py` — existing JSON config singleton loader pattern
- `be/app/core/config.py` — existing Settings dataclass pattern
- `be/app/main.py` — existing FastAPI lifespan and app.state usage
- `be/app/personas/hard-boundaries.yml` — YAML structure reference

---

## Existing Patterns to Follow

### 1. Singleton registry (from `ingestion/registry.py`)
`ModuleRegistry` is the canonical pattern: init at module import time, `get_registry()` singleton accessor. **Adopt this exact pattern** for `ChestRegistry`.

### 2. YAML loading (from `coaching/safety.py`)
```python
with open(path, encoding="utf-8") as f:
    data = yaml.safe_load(f)
```
Always `yaml.safe_load` (never `yaml.load`). **Use this pattern**.

### 3. Persona config loader (from `personas/loader.py`)
JSON config loaded once, cached in module-level dict. Same caching strategy applies to DomainManifest. **Use module-level `_manifest_cache`**.

### 4. FastAPI app.state
`main.py` already uses `app.state` for lifespan-owned objects. Manifest + ChestRegistry should be stored as `app.state.manifest` and `app.state.chest_registry`.

### 5. Pydantic v2 models
Already in use throughout `be/app/schemas/`. All manifest models should use Pydantic v2 with `model_config = ConfigDict(frozen=True)` for immutability since manifests are read-only after startup.

---

## Domain Manifest YAML Schema Design

### Top-level structure
```yaml
domain:
  id: finance
  name: "SENSO Finance"
  version: "1.0.0"
  locale_default: it

chests:
  - id: user_profile
    type: user_profile
    scope: user
    access: [searchable, tool_callable]
    storage:
      encrypted: true        # PII feature flag
      localized: true
      ttl_days: null
    schema_ref: chests/user_profile.schema.json

extractors:
  - id: revolut_csv
    type: module
    module_ref: app.ingestion.modules.builtin.revolut_it
    document_types: [bank_csv]

personas:
  config_ref: personas/config.json

behavior:
  ethos_ref: personas/ethos.md
  boundaries_ref: personas/boundaries.md
  allowlist_ref: personas/allowlist.md
  hard_boundaries_ref: personas/hard-boundaries.yml

filters:
  input:
    - type: safety_scan
      config: {}
    - type: pii_scrub
      config: {}
  output:
    - type: safety_scan
      config: {}
    - type: pii_scrub
      config: {}
    - type: domain_compliance
      config: {}

enrichment:
  schema_ref: coaching/schemas/response.schema.json
  caps:
    content_cards: 3
    interactive_cards: 2
    evidence_rows: 5
    goal_progress: 2

ui:
  sdui_catalog_ref: null
  components: []
```

### Chest scopes
- `user` — per-user data (transactions, profile, coaching insights, timeline events)
- `domain` — shared across users for this domain (content catalog, regional knowledge)
- `platform` — global across all domains (never used in v2.0)

### Chest access modes
- `searchable` — indexed in BM25 at startup, included in search tool calls
- `tool_callable` — LLM can call dedicated tool to read/write this chest
- `direct` — accessed programmatically only, not exposed to LLM tools

### Storage flags
- `encrypted` — per-chest PII flag; when true, values stored via `EncryptedJSON` column
- `localized` — content varies by `locale` field
- `ttl_days` — auto-expire entries (null = permanent)

---

## Chest Registry Design

### Class interface
```python
class ChestRegistry:
    def __init__(self, manifest: DomainManifest) -> None: ...
    def get(self, chest_id: str) -> ChestDef: ...  # raises KeyError if not found
    def list(self, scope: str | None = None) -> list[ChestDef]: ...
    def tool_callable(self) -> list[ChestDef]: ...
    def searchable(self) -> list[ChestDef]: ...
    def validate(self) -> list[str]: ...  # returns list of validation errors
```

### Validation at startup
- Each `schema_ref` must resolve to a real file relative to the manifest directory
- Each `module_ref` in extractors must be importable (warn, don't crash)
- Each `config_ref`, `ethos_ref`, `boundaries_ref`, `allowlist_ref`, `hard_boundaries_ref` must exist
- Duplicated chest IDs → fatal error
- Unknown scope values → fatal error

### NOT in Phase 33 scope
- Pluggy plugin interface (Phase 36 — CORE-07)
- Actual tool generation from chests (Phase 35 — CORE-04)
- DB schema changes (Phase 34 — DATA-01)

---

## FastAPI Integration Pattern

### Environment variable
```
DOMAIN_MANIFEST_PATH=domains/finance/manifest.yaml
```
Default: `domains/finance/manifest.yaml` (relative to working directory).

### Lifespan update in `main.py`
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # existing startup ...
    manifest = load_manifest(settings.domain_manifest_path)
    registry = ChestRegistry(manifest)
    errors = registry.validate()
    if errors:
        for e in errors:
            logger.error("ChestRegistry validation: %s", e)
        raise RuntimeError(f"Domain manifest validation failed: {errors[0]}")
    app.state.manifest = manifest
    app.state.chest_registry = registry
    logger.info("Domain manifest loaded: %s v%s (%d chests)",
                manifest.domain.name, manifest.domain.version, len(registry.list()))
    yield
    # existing shutdown ...
```

### Dependency functions (in `domain/deps.py`)
```python
def get_manifest(request: Request) -> DomainManifest:
    return request.app.state.manifest

def get_chest_registry(request: Request) -> ChestRegistry:
    return request.app.state.chest_registry
```

---

## Finance Stub Manifest (for Phase 33 success criterion 5)

A minimal `domains/finance/manifest.yaml` that declares:
- Domain metadata
- All 6 chest types from ROADMAP FIN-02 (user_profile, transactions, content, regional_knowledge, coaching_insights, timeline_events)
- No real file refs that must exist yet (use null or paths to existing files)

This manifest MUST load successfully with the Phase 33 registry to satisfy success criterion 5.

---

## Package Layout

New packages to create in Phase 33:
```
be/app/domain/
├── __init__.py
├── manifest.py      # Pydantic v2 models
├── loader.py        # load_manifest() + YAML parsing
├── registry.py      # ChestRegistry class
└── deps.py          # FastAPI dependency functions

be/domains/
└── finance/
    └── manifest.yaml   # Finance stub manifest
```

Existing files modified:
- `be/app/main.py` — add lifespan manifest loading
- `be/app/core/config.py` — add `domain_manifest_path` setting

---

## Confidence Assessment

| Decision | Confidence | Notes |
|----------|-----------|-------|
| Pydantic v2 for manifest models | HIGH | Already in use, frozen models are ideal |
| PyYAML `safe_load` | HIGH | Already in dep tree, already used |
| Singleton ChestRegistry | HIGH | Follows ModuleRegistry pattern |
| `app.state` for FastAPI injection | HIGH | Already used in codebase |
| YAML manifest schema (above) | MEDIUM | Will evolve in later phases; Phase 33 schema must be forward-compatible |
| Strict validation vs warn-and-continue | MEDIUM | Fail-fast at startup preferred; warn for optional refs |

---

## Phase 33 Does NOT Include
- pluggy hookspec (Phase 36)
- LLM tool auto-generation (Phase 35)
- DB schema changes (Phase 34)
- Actual filter pipeline execution (Phase 36)
- Persona engine loading (Phase 37)
- SDUI renderer (Phase 38)

*Research complete: 2026-04-13*
