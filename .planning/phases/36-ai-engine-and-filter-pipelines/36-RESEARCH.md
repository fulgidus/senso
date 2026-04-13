# Phase 36 Research — AI Engine & Filter Pipelines

**Phase:** 36 (AI Engine & Filter Pipelines)
**Date:** 2026-04-13
**Requirements:** AI-01, AI-02, AI-03, AI-05, AI-07, CORE-07, CORE-09
**Purpose:** Domain-configurable filter pipelines, behavior layer from manifest, pluggy plugin system with auth hookspec.

---

## Inputs Reviewed

- `be/app/coaching/service.py` — hardcoded `SafetyScanner()`, `PERSONAS_DIR/ethos.md`, caps from `settings`
- `be/app/coaching/safety.py` — `SafetyScanner.__init__` takes optional `boundaries_path`; `scan_input/scan_output`
- `be/app/personas/` — `ethos.md`, `boundaries.md`, `allowlist.md`, `hard-boundaries.yml` all hardcoded paths
- `be/app/domain/manifest.py` — `BehaviorConfig`, `FilterDef`, `FilterPipelineConfig`, `EnrichmentCaps`, `AuthConfig`

---

## pluggy Architecture (CORE-07, CORE-09)

### Why pluggy
pluggy is pip-installable, mature, used by pytest. Hookspecs are interface contracts.
Domain plugins register as hookimpls. Platform calls `pm.hook.method()`.

### Hookspec surface (minimal — avoid plugin hell)

```python
import pluggy

hookspec = pluggy.HookspecMarker("senso")
hookimpl = pluggy.HookimplMarker("senso")

class SensoPlatformSpec:
    @hookspec
    def authenticate_request(self, token: str) -> str | None:
        """Validate a bearer token. Return identity_id or None."""

    @hookspec
    def process_extraction(self, doc_type: str, raw_data: dict) -> dict:
        """Domain-specific post-processing of extracted document data."""

    @hookspec
    def categorize_transactions(self, transactions: list[dict]) -> list[dict]:
        """Enrich transactions with domain-specific categories."""

    @hookspec
    def enrich_response(self, response: dict, context: dict) -> dict:
        """Domain-specific response enrichment after coaching LLM call."""
```

Four hooks. No more. Platform calls each; personal_finance implements the ones it needs.

### PluginManager wiring

```python
pm = pluggy.PluginManager("senso")
pm.add_hookspecs(SensoPlatformSpec)
# Domain plugin registered at startup from manifest.auth.plugin_ref
pm.register(PersonalFinancePlugin())  # Phase 39
```

`app.state.plugin_manager = pm`

### Auth middleware (CORE-09)

FastAPI middleware calls `pm.hook.authenticate_request(token=...)` on every request.
Returns `identity_id: str | None`. Stores in `request.state.identity_id`.
Routes that require auth raise 401 if `request.state.identity_id is None`.

---

## Filter Pipeline Architecture (AI-01, AI-02)

### Design
Ordered list of `FilterDef` from manifest → `FilterPipeline` executor.

```python
class FilterResult:
    passed: bool
    text: str           # transformed text (censored / scrubbed)
    blocked: bool       # True = block entire response
    reason: str | None

class FilterPipeline:
    def __init__(self, filters: list[FilterDef], scanner: SafetyScanner) -> None: ...
    def run_input(self, text: str, context: dict) -> FilterResult: ...
    def run_output(self, text: str, context: dict) -> FilterResult: ...
```

### Built-in filter types

| type | scope | action |
|------|-------|--------|
| `safety_scan` | input+output | delegates to `SafetyScanner.scan_input/scan_output` |
| `pii_scrub` | output | strips user PII tokens from response (existing `_scrub_profile_pii` logic) |
| `domain_compliance` | output | placeholder for domain-specific rules (Phase 39 adds via plugin hook) |

SafetyScanner is initialized with `boundaries_path` from `manifest.behavior.hard_boundaries_ref`.

---

## Behavior Layer (AI-03, AI-07)

`CoachingService.__init__` currently hardcodes `PERSONAS_DIR / "ethos.md"` etc.

v2.0: load from `manifest.behavior.*_ref` paths relative to manifest directory:

```python
class BehaviorLayer:
    def __init__(self, manifest: DomainManifest, manifest_dir: Path) -> None:
        self._ethos: dict[str, str] = {}
        self._boundaries: dict[str, str] = {}
        self._allowlist: dict[str, str] = {}
        self._scanner: SafetyScanner | None = None
        self._load(manifest, manifest_dir)

    def get_ethos(self, locale: str) -> str: ...
    def get_boundaries(self, locale: str) -> str: ...
    def get_allowlist(self, locale: str) -> str: ...
    def scanner(self) -> SafetyScanner: ...
```

Locale files: if `ethos_ref = "personas/ethos.md"` → also try `personas/ethos.{locale}.md` for non-default locales. Same pattern as existing code.

---

## Response Enrichment (AI-05)

Caps currently read from `settings.coaching_cap_*` (hardcoded config.py).

v2.0: read from `manifest.enrichment.caps`:
```python
caps = manifest.enrichment.caps
data["content_cards"] = data["content_cards"][:caps.content_cards]
```

`CoachingService._apply_caps()` receives `EnrichmentCaps` instead of `Settings`.

---

## Package Layout

New:
```
be/app/platform/
├── __init__.py
├── hookspecs.py    # SensoPlatformSpec + hookspec/hookimpl markers
├── plugins.py      # PluginManager factory
├── filters.py      # FilterPipeline, FilterResult, built-in filter types
└── behavior.py     # BehaviorLayer (loads behavior refs from manifest)
```

Modified:
- `be/app/coaching/service.py` — inject BehaviorLayer, FilterPipeline, EnrichmentCaps
- `be/app/main.py` — build PluginManager + BehaviorLayer + FilterPipeline at startup
- `be/pyproject.toml` — add `pluggy>=1.5.0` to deps

---

## Confidence

| Decision | Confidence | Notes |
|----------|-----------|-------|
| pluggy with 4 hookspecs | HIGH | Minimal surface, well-understood library |
| FilterPipeline wrapping SafetyScanner | HIGH | SafetyScanner already accepts boundaries_path |
| BehaviorLayer locale fallback | HIGH | Mirrors existing pattern exactly |
| Auth middleware → identity_id in request.state | HIGH | FastAPI standard pattern |
| Caps from EnrichmentCaps not Settings | HIGH | Direct manifest field replacement |

*Research complete: 2026-04-13*
