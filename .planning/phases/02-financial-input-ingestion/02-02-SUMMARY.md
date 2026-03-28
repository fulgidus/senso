---
phase: 02-financial-input-ingestion
plan: 02
subsystem: ingestion
tags: [pydantic, llm, gemini, openai, ocr, pytesseract, registry, adaptive-pipeline, guardrail]

# Dependency graph
requires:
  - phase: 02-01
    provides: Settings with gemini_api_key/openai_api_key fields, Upload ORM model with extraction_status/extraction_method/module_source

provides:
  - ExtractionResult, ExtractedDocument, Transaction, LineItem, UploadStatusDTO, RetryRequest, ReportRequest, ModuleInfo Pydantic schemas
  - LLMClient with Gemini Flash primary + OpenAI fallback (complete() + vision())
  - check_hint_safety() guardrail with 2s timeout, defaults safe=False
  - Three-tier OCR pipeline (pytesseract → LLM text → LLM vision) with tier_used field
  - ModuleRegistry with startup discovery of builtin/generated/promoted, fault-tolerant loading, fingerprint scoring match()
  - run_adaptive_pipeline() for LLM extraction + sandboxed module generation

affects: [02-03, 02-04, 03-coaching, 04-voice]

# Tech tracking
tech-stack:
  added: [google-genai (import), openai (import), pytesseract (import), pdf2image (import), Pillow (import)]
  patterns:
    - LLMClient thin provider wrapper with Gemini→OpenAI fallback chain
    - ModuleRegistry with importlib.util dynamic loading and fingerprint scoring
    - Guardrail preflight via threading.Thread with join(timeout) for hard timeout enforcement
    - Adaptive pipeline with subprocess sandbox for generated module validation

key-files:
  created:
    - api/app/schemas/ingestion.py
    - api/app/ingestion/__init__.py
    - api/app/ingestion/llm.py
    - api/app/ingestion/guardrail.py
    - api/app/ingestion/ocr.py
    - api/app/ingestion/registry.py
    - api/app/ingestion/adaptive.py
  modified: []

key-decisions:
  - "LLMClient uses lazy imports (google.genai, openai) inside methods so the module loads without SDK installed"
  - "Guardrail uses threading.Thread with join(timeout) to enforce 2s wall-clock limit regardless of LLM call latency"
  - "Registry singleton (get_registry()) initialized at first call - avoids import-time side effects in tests"
  - "ModuleEntry stores file_path.stem for GenericCSV score-floor check per D-27"
  - "Adaptive pipeline raises LLMError on invalid JSON or schema validation failure - caller sets extraction_status=adaptive_failed"

patterns-established:
  - "Ingestion module interface: FINGERPRINT: list[str], MODULE_VERSION: str, extract(file_path) -> ExtractionResult"
  - "All LLM calls route through LLMClient.complete() / .vision() - never call providers directly from business logic"
  - "GuardrailResult TypedDict: {safe: bool, reason: str} - standard shape for all safety preflight results"

requirements-completed:
  - INGT-01
  - INGT-02

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 02 Plan 02: Ingestion Engine - Schemas, LLM Wrapper, Guardrail, OCR, Registry, Adaptive Pipeline

**Pydantic ingestion schemas (ExtractionResult/ExtractedDocument/Transaction) plus LLMClient (Gemini→OpenAI), three-tier OCR pipeline, fault-tolerant module registry, guardrail preflight, and adaptive LLM extraction with sandboxed module generation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T22:18:07Z
- **Completed:** 2026-03-24T22:20:59Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Complete Pydantic v2 ingestion schema layer with Decimal monetary fields and camelCase DTO aliases
- LLMClient thin wrapper with Gemini Flash primary and OpenAI fallback for both text (complete()) and vision (vision()) calls
- ModuleRegistry with importlib-based discovery of builtin/generated/promoted modules, fault-tolerant loading (bad modules skipped), fingerprint scoring match(), and get_registry() singleton
- check_hint_safety() guardrail with threading-enforced 2-second timeout, returns safe=False on any error or timeout
- Three-tier OCR pipeline: pytesseract → LLM text (≥50 chars) → LLM vision (fallback), with tier_used field
- run_adaptive_pipeline() for LLM-driven document extraction + sandboxed Python module generation, saves to modules/generated/

## Task Commits

Each task was committed atomically:

1. **Task 1: Pydantic ingestion schemas** - `9376ebe` (feat)
2. **Task 2: LLM provider wrapper, guardrail, OCR pipeline, module registry, adaptive pipeline** - `cc2cbcf` (feat)

**Plan metadata:** (docs commit - see below)

## Files Created/Modified

- `api/app/schemas/ingestion.py` - ExtractionResult, ExtractedDocument, Transaction, LineItem, UploadStatusDTO, RetryRequest, ReportRequest, ModuleInfo
- `api/app/ingestion/__init__.py` - package marker
- `api/app/ingestion/llm.py` - LLMClient with complete()/vision(), Gemini primary → OpenAI fallback, get_llm_client() FastAPI dependency
- `api/app/ingestion/guardrail.py` - check_hint_safety() with threading timeout, GuardrailResult TypedDict
- `api/app/ingestion/ocr.py` - extract_with_ocr_pipeline() three-tier implementation, extract_text_with_tesseract() helper
- `api/app/ingestion/registry.py` - ModuleRegistry class, ModuleEntry dataclass, get_registry() singleton
- `api/app/ingestion/adaptive.py` - run_adaptive_pipeline(), _save_and_validate_module() sandbox helper

## Decisions Made

- Used lazy imports inside LLM provider methods so the llm.py module itself loads without google-genai or openai installed (avoids import-time failure in test environments)
- Used threading.Thread.join(timeout) instead of signal-based alarm for guardrail timeout - works cross-platform and doesn't require SIGALRM (unavailable in some environments)
- Registry singleton initialized lazily on first get_registry() call to avoid import-time file system access during module loading
- Adaptive pipeline raises LLMError (not returns error result) on invalid JSON or schema validation failure - upstream caller is responsible for setting extraction_status="adaptive_failed"
- ModuleEntry preserves file_path for stem-based special-casing (GenericCSV score floor per D-27)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. LLM providers are injected via Settings (GEMINI_API_KEY / OPENAI_API_KEY env vars, already wired in Plan 02-01).

## Next Phase Readiness

- All ingestion engine components are importable and verified
- ModuleRegistry ready for Plan 02-04 (builtin module authoring)
- LLMClient, guardrail, OCR, and adaptive pipeline ready for Plan 02-03 (ingestion service + API endpoints)
- Schema contracts established for downstream Plans 03 and 04
- No blockers

---
*Phase: 02-financial-input-ingestion*
*Completed: 2026-03-24*
