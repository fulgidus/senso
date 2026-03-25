---
phase: 02-financial-input-ingestion
verified: 2026-03-24T10:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 02: Financial Input & Ingestion — Verification Report

**Phase Goal:** Users can upload financial documents and verify extracted data before coaching uses it.
**Verified:** 2026-03-24
**Status:** ✅ PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can upload a bank CSV and see structured transactions extracted | ✓ VERIFIED | FinecoIT extracts 737 txns; RevolutIT extracts 117 txns from real sample files; `POST /ingestion/upload` returns 202 with `upload_id` |
| 2 | User can upload a payslip/receipt image or PDF and see key financial fields extracted | ✓ VERIFIED | Three-tier OCR pipeline in `ocr.py`; `EdisonEnergiaIT` and `GenericInvoiceIT` PDF extractors; `InspectModal` renders key-value cards for payslip/utility_bill/receipt |
| 3 | User can review extracted values and confirm/correct them before recommendations are generated | ✓ VERIFIED | `POST /ingestion/uploads/{id}/confirm` gates on `extraction_status == "success"`, sets `confirmed=True`; coaching contract (D-29) enforces `upload.confirmed=True` |
| 4 | All endpoints are auth-guarded | ✓ VERIFIED | `Depends(get_current_user)` on all `/ingestion/*` routes; 36/36 tests pass including auth tests |
| 5 | Frontend ingestion UI is fully wired to backend | ✓ VERIFIED | `IngestionScreen` mounts `UploadZone`, `FileList`, `InspectModal`, `RetryDialog`; `useIngestion` hook wires all API calls |

**Score: 5/5 truths verified**

---

## Required Artifacts

### Plan 01 — Database & Infrastructure

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/app/db/models.py` | 6 SQLAlchemy ORM models | ✓ VERIFIED | `User` (+`is_admin`), `RefreshSession`, `Upload`, `ExtractedDocument`, `Transaction`, `ExtractionReport` all present |
| `api/app/db/session.py` | SQLAlchemy engine + `SessionLocal` | ✓ VERIFIED | `SessionLocal`, `get_db()`, `create_tables()` present; no `InMemoryDB` |
| `api/app/db/repository.py` | Repository functions for auth + ingestion | ✓ VERIFIED | `get_user_by_email` and 5 other repo functions present |
| `api/app/core/config.py` | Settings with MinIO + LLM env vars | ✓ VERIFIED | `minio_endpoint`, `minio_access_key`, `minio_secret_key`, `minio_bucket`, `gemini_api_key`, `openai_api_key` fields present |
| `docker-compose.yml` | `minio` + `minio-init` services | ✓ VERIFIED | Both services declared with named volumes |

### Plan 02 — Ingestion Engine

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/app/schemas/ingestion.py` | `ExtractionResult`, `ExtractedDocument`, `Transaction`, `LineItem`, etc. | ✓ VERIFIED | All 7 Pydantic classes present |
| `api/app/ingestion/registry.py` | `ModuleRegistry` with discovery, validation, `match()` | ✓ VERIFIED | `class ModuleRegistry`, `get_registry()` singleton, loads all 7 builtins at startup |
| `api/app/ingestion/llm.py` | `LLMClient` (Gemini primary → OpenAI fallback) | ✓ VERIFIED | `class LLMClient` with `complete()` and `vision()` methods |
| `api/app/ingestion/ocr.py` | Three-tier OCR pipeline | ✓ VERIFIED | Tier 1 = pytesseract, Tier 2 = LLM text, Tier 3 = LLM vision; `extract_with_ocr_pipeline()` present |
| `api/app/ingestion/adaptive.py` | Adaptive pipeline with sandboxed module generation | ✓ VERIFIED | `run_adaptive_pipeline()` present |
| `api/app/ingestion/guardrail.py` | `check_hint_safety()` with 2s timeout | ✓ VERIFIED | Present; returns `{safe: bool, reason: str}` |

### Plan 03 — API Endpoints

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/app/services/ingestion_service.py` | `IngestionService` with all 8 methods | ✓ VERIFIED | `class IngestionService` with upload, list, get, confirm, retry, report, delete |
| `api/app/services/admin_service.py` | `AdminService` with list/promote/source | ✓ VERIFIED | `class AdminService` present |
| `api/app/api/ingestion.py` | FastAPI router `/ingestion` prefix, 8 endpoints | ✓ VERIFIED | `router = APIRouter(prefix="/ingestion"...)`; confirm at line 136, retry at line 148 |
| `api/app/api/admin.py` | FastAPI router `/admin` prefix, 3 endpoints | ✓ VERIFIED | Present |
| `api/app/main.py` | Lifespan + both routers registered | ✓ VERIFIED | `include_router` calls for both ingestion and admin routers |

### Plan 04 — Builtin Modules

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/app/ingestion/modules/builtin/fineco_it.py` | FinecoIT XLSX extractor with `FINGERPRINT` | ✓ VERIFIED | Present; extracts 737 transactions from real sample |
| `api/app/ingestion/modules/builtin/revolut_it.py` | RevolutIT CSV/PDF extractor with `FINGERPRINT` | ✓ VERIFIED | Present; extracts 117 transactions from real sample |
| `api/app/ingestion/modules/builtin/satispay_it.py` | SatispayIT extractor with `FINGERPRINT` | ✓ VERIFIED | Present |
| `api/app/ingestion/modules/builtin/paypal_it.py` | PaypalIT extractor with `FINGERPRINT` | ✓ VERIFIED | Present |
| `api/app/ingestion/modules/builtin/edison_energia_it.py` | EdisonEnergiaIT PDF extractor | ✓ VERIFIED | Present |
| `api/app/ingestion/modules/builtin/generic_invoice_it.py` | GenericInvoiceIT PDF extractor | ✓ VERIFIED | Present |
| `api/app/ingestion/modules/builtin/generic_csv.py` | Generic CSV fallback (lowest priority) | ✓ VERIFIED | Present with `FINGERPRINT` |

### Plan 05 — Frontend UI

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `senso/src/features/ingestion/types.ts` | `UploadStatus`, `ExtractedDocument` (snake_case), `Transaction`, `LineItem` | ✓ VERIFIED | All interfaces present; snake_case preserved from `model_dump(mode='json')` |
| `senso/src/features/ingestion/api.ts` | 8 API functions with Bearer token auth | ✓ VERIFIED | All functions present; `Authorization: Bearer ${token}` header on every call |
| `senso/src/features/ingestion/useIngestion.ts` | Polling hook for status + all mutations | ✓ VERIFIED | Present; polls `GET /ingestion/uploads/{id}` until non-pending |
| `senso/src/features/ingestion/IngestionScreen.tsx` | Main screen wiring UploadZone + FileList + modals | ✓ VERIFIED | Imports and renders all 4 sub-components; wires `confirmOne`, `confirmAll`, `retry` |
| `senso/src/features/ingestion/UploadZone.tsx` | Drag-drop + file picker | ✓ VERIFIED | Present |
| `senso/src/features/ingestion/FileList.tsx` | 4-column table with action buttons + Confirm all | ✓ VERIFIED | File, Type, Extraction Method, Actions columns; `{NEW}` badge for generated modules; green checkmark for confirmed |
| `senso/src/features/ingestion/InspectModal.tsx` | Type-aware modal (transactions table vs key-value cards) | ✓ VERIFIED | Renders transaction table for `bank_statement`; key-value cards for `payslip`/`utility_bill`/`receipt`; `return null` when `uploadId` is null (intentional, not a stub) |
| `senso/src/features/ingestion/RetryDialog.tsx` | Hint textarea with guardrail note | ✓ VERIFIED | Present |
| `senso/src/features/auth/AuthedHome.tsx` | Renders `IngestionScreen` after login | ✓ VERIFIED | `import { IngestionScreen }` and renders it |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth_service.py` | `repository.py` | `from app.db.repository import` | ✓ WIRED | Import verified; `InMemoryDB` fully removed |
| `session.py` | Postgres | `DATABASE_URL` → SQLAlchemy engine | ✓ WIRED | `create_engine` present in `session.py` |
| `registry.py` | `modules/builtin/` | `importlib.util.spec_from_file_location` | ✓ WIRED | All 7 builtins discovered at startup |
| `adaptive.py` | `llm.py` | `llm_client.complete(` | ✓ WIRED | Present |
| `ocr.py` | `llm.py` | `LLMClient` for Tier 2 + Tier 3 | ✓ WIRED | `from app.ingestion.llm import LLMClient` confirmed |
| `ingestion.py` (API) | `ingestion_service.py` | `Depends(get_ingestion_service)` | ✓ WIRED | Present on all endpoints |
| `ingestion_service.py` | `registry.py` | `get_registry()` | ✓ WIRED | Present |
| `ingestion.py` (API) | `auth.py` | `Depends(get_current_user)` | ✓ WIRED | All 8 endpoints guarded |
| `main.py` | `ingestion.py` (API) | `app.include_router(ingestion_router)` | ✓ WIRED | Both routers registered in `main.py` |
| `useIngestion.ts` | `api.ts` | `uploadFile`, `listUploads`, `confirmUpload` | ✓ WIRED | All API functions imported and called |
| `AuthedHome.tsx` | `IngestionScreen.tsx` | `<IngestionScreen />` render | ✓ WIRED | Import + render confirmed |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FileList.tsx` | `uploads: UploadStatus[]` | `useIngestion` → `listUploads()` → `GET /ingestion/uploads` → DB query | Yes — queries Postgres `Upload` table per user | ✓ FLOWING |
| `InspectModal.tsx` | `extracted: ExtractedDocument` | `getExtracted()` → `GET /ingestion/uploads/{id}/extracted` → DB `ExtractedDocument` row | Yes — returns stored `payload_json` from DB | ✓ FLOWING |
| `ingestion.py` confirm endpoint | `upload.confirmed` | `confirm_upload()` → sets `confirmed=True` in Postgres | Yes — persists to DB; coaching contract gates on this field | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 36 backend tests pass | `python -m pytest api/tests/ -q --tb=no` (via venv) | `36 passed, 2 warnings in 6.17s` | ✓ PASS |
| TypeScript compiles without errors | `npx tsc --noEmit` in `senso/` | Exit 0, no output | ✓ PASS |
| 7 builtin modules present on disk | `ls api/app/ingestion/modules/builtin/` | 7 `.py` files + `__init__.py` | ✓ PASS |
| All 8 frontend ingestion files exist | `ls senso/src/features/ingestion/` | 8 files present | ✓ PASS |
| INGT-01/02/03 marked complete in requirements | `grep INGT .planning/REQUIREMENTS.md` | `[x]` on all three; Phase 2 in traceability table | ✓ PASS |

> **Note:** Live API spot-checks (actual HTTP requests to running server) are deferred to human verification — the app requires Docker Compose with MinIO + Postgres + API containers running.

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INGT-01 | 02-01, 02-02, 02-03, 02-04, 02-05 | User can upload a bank statement CSV and the system extracts structured transactions | ✓ SATISFIED | `POST /ingestion/upload` → MinIO storage → FinecoIT/RevolutIT module extraction → `Transaction[]` in DB → `FileList` renders them |
| INGT-02 | 02-02, 02-03, 02-04, 02-05 | User can upload a payslip or receipt image/PDF and the system extracts key financial fields | ✓ SATISFIED | Three-tier OCR pipeline → `EdisonEnergiaIT`/`GenericInvoiceIT`/LLM adaptive → `ExtractedDocument.payload_json` → `InspectModal` key-value rendering |
| INGT-03 | 02-03, 02-05 | User can review extracted data before it is used for recommendations | ✓ SATISFIED | `GET .../extracted` → `InspectModal` review → `POST .../confirm` → `confirmed=True` gate enforced for coaching |

**All 3 requirements: ✓ SATISFIED**

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `api/app/services/auth_service.py:71` | `datetime.utcnow()` (deprecated) | ℹ️ Info | Python deprecation warning only; no functional impact in current Python version |
| `senso/src/features/ingestion/InspectModal.tsx` | `return null` when `uploadId` is null | ℹ️ Info | **Not a stub** — correct guard pattern; modal only renders when an upload is selected for inspection |

> No blockers or functional warnings found.

---

## Human Verification Required

### 1. End-to-End Upload Flow

**Test:** Start `docker compose up`, open the app, log in, drag-drop a bank CSV (e.g. Fineco XLSX), wait for extraction, click Inspect, verify transaction list renders.
**Expected:** File appears in list with `extracted` status; Inspect modal shows transaction table with populated rows.
**Why human:** Requires running containers (MinIO + Postgres + API + Next.js dev server) and a real file upload.

### 2. PDF/Image OCR Flow

**Test:** Upload a PDF payslip or utility bill image; wait for extraction; click Inspect.
**Expected:** Inspect modal shows key-value card view with field names and extracted values.
**Why human:** OCR Tier 1 requires `tesseract` installed on the host; Tier 2/3 require live LLM API keys.

### 3. Confirm → Coaching Gate

**Test:** Confirm a successfully extracted upload; verify the coaching endpoint (Phase 3) only sees confirmed uploads.
**Expected:** Un-confirmed uploads do not appear in coaching context.
**Why human:** Coaching endpoint not yet built (Phase 3); contract (D-29) is in place but full E2E test deferred.

### 4. {NEW} Badge Visual

**Test:** Upload a file that triggers the adaptive pipeline (no builtin module match); inspect the Extraction Method cell.
**Expected:** Amber/yellow `{NEW}` pill badge visible in the row.
**Why human:** Requires adaptive pipeline execution with a real unsupported file format and live LLM keys.

---

## Gaps Summary

**No gaps.** All 5 PLAN must_haves are fully satisfied:

- **Plan 01 (DB & Infra):** SQLAlchemy ORM models in place, `InMemoryDB` gone, MinIO in Docker Compose, Settings extended.
- **Plan 02 (Engine):** LLMClient, three-tier OCR, ModuleRegistry, adaptive pipeline, guardrail all implemented.
- **Plan 03 (API):** All 8 ingestion endpoints + 3 admin endpoints wired, auth-guarded, tested (36/36 pass).
- **Plan 04 (Modules):** All 7 builtin modules present, validated by test suite with real sample file extraction.
- **Plan 05 (Frontend):** All 8 UI files present, TypeScript compiles clean, all components wired end-to-end.

The two deprecation notices (Python `utcnow()` and intentional `return null` guard) are non-issues. The only items deferred to human verification require live infrastructure (Docker + real API keys) which is out of scope for automated verification.

**Phase 02 goal is achieved.**

---

_Verified: 2026-03-24_
_Verifier: gsd-verifier (claude-sonnet-4.6)_
