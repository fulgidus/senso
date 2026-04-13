---
phase: 33
name: Foundation Platform
goal: Establish Domain Manifest parser and Chest registry as core platform foundation.
requirements: CORE-01, CORE-02, CORE-03, CORE-05
success_criteria:
  - "Platform loads YAML Domain Manifest at startup and configures all subsystems"
  - "Chest Registry discovers and validates typed knowledge containers from manifest"
  - "Each Chest has properly defined schema, scope, access mode, and storage config"
  - "Domain Manifest declaratively defines extractors, personas, behavior, filters, enrichment, auth strategy, and UI components"
  - "Empty personal_finance domain manifest loads successfully without errors"
---

# Phase 33: Foundation Platform

## Summary

In this phase, we established the Domain Manifest parser and Chest registry as the core platform foundation for S.E.N.S.O. v2.0. This provides the groundwork for the fully configurable, domain-agnostic platform architecture where all domain-specific behavior is defined declaratively in a YAML manifest rather than hardcoded.

The implementation follows the plan outlined in the three key tasks:

1. **Domain Manifest - Pydantic Models**: We created a comprehensive set of Pydantic v2 models that represent all aspects of a Domain Manifest. These models define the contract for domain configuration.

2. **YAML Loader + Chest Registry**: We implemented a YAML manifest loader with robust validation and a Chest Registry that manages all knowledge containers defined in the manifest.

3. **FastAPI Integration + Finance Stub Manifest**: We wired the Domain Manifest loading and Chest Registry initialization into FastAPI's lifespan and created the personal_finance stub manifest with the 7 required chests.

## Implementation Details

### 1. Domain Manifest Models

We created a rich set of Pydantic v2 models in `be/app/domain/manifest.py` that define:

- `ChestDef` - The core primitive for typed knowledge containers
- `StorageConfig` - Per-chest storage behavior (encryption, localization, TTL)
- `ExtractorDef` - Ingestion pipeline definitions
- `PersonasConfig` - Domain-specific persona configurations
- `BehaviorConfig` - Coaching behavior and boundary definitions
- `FilterDef` and `FilterPipelineConfig` - Input/output filter pipeline configurations
- `EnrichmentConfig` and `EnrichmentCaps` - Response enrichment schema and limits
- `UIComponent` and `UIConfig` - SDUI component descriptors
- `AuthConfig` - Domain authentication strategy
- `DomainMeta` - Top-level domain metadata
- `DomainManifest` - The root model tying everything together

All models use `ConfigDict(frozen=True)` to ensure immutability after startup.

### 2. YAML Loader and Chest Registry

We implemented:

- `be/app/domain/loader.py` with `load_manifest()` that safely loads and validates YAML files against the Pydantic models
- `be/app/domain/registry.py` with `ChestRegistry` that provides indexed access to all chests and validates their references
- `be/app/domain/deps.py` with FastAPI dependency functions for manifest and registry access

The registry provides typed accessor methods (e.g., `tool_callable()`, `searchable()`) for different platform subsystems to use, while the validation ensures all referenced files exist.

### 3. FastAPI Integration and personal_finance Manifest

We integrated the manifest loading process into the FastAPI lifespan:

- Added `domain_manifest_path` to `Settings` in `be/app/core/config.py`
- Wired manifest loading in `be/app/main.py` to make it available via `app.state`
- Created `be/domains/personal-finance/manifest.yaml` with all 7 required chests: `user_profile`, `transactions`, `coaching_insights`, `timeline_events`, `user_prefs`, `content`, and `regional_knowledge`
- Configured the manifest to point to existing v1.0 persona files to ensure compatibility

## Verification

All success criteria have been met:

1. ✅ **Platform loads YAML Domain Manifest at startup**: Implemented in `be/app/main.py` lifespan.
2. ✅ **Chest Registry discovers and validates typed knowledge containers**: `ChestRegistry` class properly indexes chests by ID and validates their references.
3. ✅ **Each Chest has properly defined schema, scope, access mode, and storage config**: The `ChestDef` model includes all required attributes.
4. ✅ **Domain Manifest declaratively defines extractors, personas, behavior, filters, enrichment, auth strategy, and UI components**: All these sections are included in the `DomainManifest` model.
5. ✅ **Empty personal_finance domain manifest loads successfully without errors**: Created and verified the personal_finance manifest with 7 chests and all necessary sections.

## Next Steps

The following phases build upon this foundation:

- **Phase 34**: Implement the data layer that generates typed tables from Chest schemas
- **Phase 35**: Auto-generate LLM tools from Chest metadata
- **Phase 36**: Implement the AI engine and filter pipelines
- **Phase 37**: Build the persona engine and coaching service
- **Phase 38**: Implement the SDUI platform
- **Phase 39**: Complete the personal_finance domain implementation
- **Phase 40**: Validate the platform's domain-agnosticism

These phases will leverage the Domain Manifest and Chest registry to deliver a fully configurable platform that can support any domain through configuration rather than code changes.