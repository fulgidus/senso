# Phase 2: Financial Input Ingestion — Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Users upload financial documents (bank statements, payslips, receipts, utility bills — as CSV, XLSX, PDF, or image files) and see structured data extracted from those documents. Extraction is powered by a **conversion module system**: a registry of format-specific Python parsers, backed by an LLM-assisted adaptive pipeline that auto-generates new modules when no existing module matches.

All extracted data is reviewed in a summary-level UI and confirmed by the user before being made available to Phase 3 and 4. Phase 2 also writes a flat normalized `transactions` table that Phase 3 queries directly.

This phase does NOT include spending analysis, categorization scoring, or coaching — those belong to Phase 3 and 4. The output of Phase 2 is:
- Uploaded files stored in MinIO (S3-compatible).
- Structured extraction results stored in Postgres (`extracted_documents` JSONB + flat `transactions` table).
- User-confirmed records (`uploads.confirmed = true`) that downstream phases can safely consume.

</domain>

<decisions>
## Implementation Decisions

### File Storage
- **D-01:** File uploads are stored in **MinIO** (self-hosted, S3-compatible), added as a Docker Compose service (`minio`). Use the `minio` Python SDK (or `boto3`) from FastAPI. A second init service (`minio-init`) creates the `senso-uploads` bucket on first startup and exits.
- **D-02:** MinIO bucket name is `senso-uploads`. Files are keyed as `{user_id}/{upload_id}/{original_filename}`.
- **D-03:** File references (bucket, key, content-type, size_bytes) are persisted to Postgres after a successful MinIO put. Files in MinIO without a Postgres row are considered orphaned and not accessible via the API.
- **D-04:** All MinIO env vars (`MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_ENDPOINT_URL`) are added to `.env.example` and wired through `docker-compose.yml`.

### LLM Provider for Extraction
- **D-05:** **Gemini Flash** is the primary LLM provider for all extraction and guardrail tasks. **OpenAI** (GPT-4o for vision, GPT-4o-mini for text/guardrail) is the automatic fallback.
- **D-06:** Provider selection is configuration-driven (`GEMINI_API_KEY`, `OPENAI_API_KEY` env vars). If primary provider fails, the system falls through to the fallback automatically and transparently.
- **D-07:** If ALL LLM providers are unavailable after auto-retry, the upload is flagged `extraction_status = "provider_outage"` and the user is shown a **"System Major Outage"** error with a Retry button. No silent failures — every non-success state is surfaced.

### Conversion Module Architecture

#### Module Interface Contract
- **D-08:** A conversion module is a Python `.py` file that implements a specific extractor for one financial document format. Every module MUST export:
  - `FINGERPRINT: list[str]` — ordered list of keyword/header patterns used by the registry to identify matching files (checked against file content, header rows, and detected text).
  - `MODULE_VERSION: str` — semver string (e.g. `"1.0.0"`).
  - `extract(file_path: str | Path) -> ExtractionResult` — the main extraction function; receives the local file path, returns a typed `ExtractionResult`.
- **D-09:** `ExtractionResult` is a Pydantic model (defined in `api/app/schemas/ingestion.py`) that wraps an `ExtractedDocument` payload plus metadata fields (`confidence: float`, `raw_text: str | None`, `warnings: list[str]`).

#### Module Directory Layout
- **D-10:** Modules live under `api/app/ingestion/modules/` with three subdirectories:
  - `builtin/` — hand-authored modules shipped with the codebase (versioned in git).
  - `generated/` — LLM-auto-generated modules, persisted via Docker volume mount at `api/app/ingestion/modules/generated/` so they survive container restarts.
  - `promoted/` — modules promoted from `generated/` to production via the admin panel; also persisted via Docker volume.
- **D-11:** The Docker volume for persistent modules covers `api/app/ingestion/modules/generated/` and `api/app/ingestion/modules/promoted/`. `builtin/` is baked into the image.

#### Registry
- **D-12:** The module registry (`api/app/ingestion/registry.py`) discovers all `.py` files in all three subdirectories at startup, validates each one, and builds a typed manifest.
- **D-13:** Registry validation per module: (1) `FINGERPRINT`, `MODULE_VERSION`, and `extract` are present and correctly typed; (2) `extract` is callable with the expected signature. Modules failing validation are **skipped with a logged warning** — they do not crash startup.
- **D-14:** Module match is a two-step process: (1) MIME type / file extension pre-filter; (2) content fingerprint scoring — each keyword in `FINGERPRINT` is searched in the file's first 4 KB (or full text for small files); the module with the highest match score above a threshold wins. Registry returns the best match or `None`.
- **D-15:** If a persisted module (in `generated/` or `promoted/`) fails to load at startup, the registry logs the failure, skips that module, and falls back to the adaptive LLM pipeline for any file that would have matched it. No crash.

#### Adaptive Pipeline (no-match path)
- **D-16:** When `registry.match()` returns `None`, the **adaptive pipeline** (`api/app/ingestion/adaptive.py`) is triggered. It runs in two sub-steps:
  1. **LLM extraction**: the LLM receives the file's extracted text (or raw bytes for vision), the `ExtractedDocument` JSON Schema, and a structured prompt requesting both the extracted data AND a valid Python module that could handle this format in future. Output is parsed as `{ "extraction": ExtractedDocument, "module_code": str }`.
  2. **Module validation**: the generated `module_code` string is validated (import check, signature check, sandbox execution against the same file with a 10-second subprocess timeout). If it passes, it is saved to `modules/generated/{safe_name}.py` and immediately registered.
- **D-17:** The adaptive pipeline prompt includes: file text/bytes, the target `ExtractedDocument` schema as JSON Schema, the module interface contract (required exports and their types), and a **strict import whitelist**: `csv`, `io`, `re`, `datetime`, `decimal`, `json`, `base64`, `openpyxl`, `typing`, `pathlib`. No `os`, no `subprocess`, no `requests`, no file I/O outside the provided `file_path` argument.
- **D-18:** Auto-generated modules are marked `source = "generated"` in the registry manifest and display a `{NEW}` badge in the UI. If the adaptive pipeline itself fails (LLM error or code validation failure), the upload is marked `extraction_status = "adaptive_failed"` and Retry is surfaced.

#### Admin Panel — Module Promotion
- **D-19:** An admin panel at `/admin` (frontend protected route) exposes module management. Access is gated by `is_admin = true` on the `users` Postgres record.
- **D-20:** The admin panel lists all modules in `generated/` and `promoted/`. For each `generated/` module, a **"Promote"** action is available. Promotion copies the module file from `generated/` to `promoted/`, removes it from `generated/`, and updates the registry manifest in-process (no restart needed for promotion itself; a full rebuild+restart is only needed to bake a module into `builtin/`).
- **D-21:** The admin panel also shows a **"Copy to codebase"** action (dev/local only) that outputs the module content with instructions for the developer to manually copy it to `builtin/` and commit. This is the safe path for graduating a generated module to a builtin.
- **D-22:** Admin routes in FastAPI are prefixed `/admin` and gated by a `require_admin` dependency that checks `is_admin` on the JWT-authenticated user.

### Image/PDF Extraction Pipeline (Tiered)
- **D-23:** Image and PDF extraction uses a **three-tier pipeline** in `api/app/ingestion/ocr.py`:
  1. **Tier 1 — pytesseract OCR**: always attempted first (fast, cheap, no API call). Extracts raw text from the file.
  2. **Tier 2 — LLM text extraction**: if pytesseract yields `> 50` characters of usable text, that text is sent to Gemini Flash (or OpenAI fallback) for structured field extraction. This is significantly cheaper than vision tokens.
  3. **Tier 3 — LLM vision extraction**: if pytesseract yields `≤ 50` characters (photo, skewed scan, low-quality scan), the raw image/PDF bytes are sent to the LLM vision endpoint (Gemini Flash multimodal or GPT-4o vision fallback).
- **D-24:** Each tier result is returned with a `tier_used: "ocr_text" | "llm_text" | "llm_vision"` field for audit. The `extraction_method` stored in Postgres reflects the actual tier used.
- **D-25:** If Tier 3 fails (all LLM providers unavailable), `extraction_status = "provider_outage"` and **"System Major Outage"** is shown to the user with a Retry button. No silent failures.

### Builtin Conversion Modules
- **D-26:** Phase 2 ships the following builtin modules in `api/app/ingestion/modules/builtin/`. Sample files for each format will be provided by the developer in `api/app/ingestion/samples/` (one subfolder per institution — e.g. `samples/fineco_it/`, `samples/revolut_it/`, etc.) before implementation begins. Implementing agents MUST read sample files before writing FINGERPRINT patterns or extract logic.

  | Module file | Name | Format | Document type |
  |-------------|------|--------|---------------|
  | `fineco_it.py` | `FinecoIT` | XLSX | Bank statement (FinecoBank Italy) |
  | `revolut_it.py` | `RevolutIT` | PDF, CSV | Bank statement (Revolut Italy) |
  | `satispay_it.py` | `SatispayIT` | PDF, CSV | Payment history (Satispay Italy) |
  | `paypal_it.py` | `PaypalIT` | PDF, CSV | Transaction history (PayPal Italy) |
  | `edison_energia_it.py` | `EdisonEnergiaIT` | PDF | Utility bill (Edison Energia — electricity + methane) |
  | `generic_invoice_it.py` | `GenericInvoiceIT` | PDF | Generic Italian invoice |
  | `generic_csv.py` | `GenericCSV` | CSV | Fallback heuristic for any CSV with date/amount/description columns |

- **D-27:** `GenericCSV` is the lowest-priority match (score floor = 0.1) and is used only when no other module matches a CSV file. It attempts best-effort column mapping by searching for common Italian and English column name variants for date, amount, description, and balance.

### Target Data Schema

All document types extract into a common `ExtractedDocument` envelope with type-specific sub-payloads. All Pydantic models live in `api/app/schemas/ingestion.py`.

```
ExtractionResult:                        # wrapper returned by every module's extract()
  document: ExtractedDocument
  confidence: float                      # 0.0–1.0, module-assigned
  raw_text: str | None                   # OCR/LLM full text for audit and retry
  tier_used: "module" | "ocr_text" | "llm_text" | "llm_vision" | "adaptive"
  warnings: list[str]                    # non-fatal issues noted during extraction

ExtractedDocument:
  document_type: "bank_statement" | "payslip" | "receipt" | "utility_bill" | "unknown"
  module_name: str | None                # e.g. "FinecoIT", "generated_abc123"
  module_source: "builtin" | "generated" | "promoted" | None
  module_version: str | None

  # bank_statement fields:
  transactions: list[Transaction]
  account_holder: str | None
  account_iban: str | None
  statement_period_start: date | None
  statement_period_end: date | None

  Transaction:
    date: date
    description: str
    amount: Decimal                      # negative = debit, positive = credit
    currency: str                        # ISO 4217, e.g. "EUR"
    category_hint: str | None           # module-provided pre-label, Phase 3 may override
    balance_after: Decimal | None

  # payslip fields:
  employer: str | None
  employee_name: str | None
  pay_period_start: date | None
  pay_period_end: date | None
  gross_income: Decimal | None
  net_income: Decimal | None
  currency: str
  deductions: list[LineItem]

  # receipt fields:
  merchant: str | None
  purchase_date: date | None
  total_amount: Decimal | None
  currency: str
  line_items: list[LineItem]

  # utility_bill fields:
  provider: str | None
  service_type: str | None             # "gas" | "electricity" | "water" | "internet" | ...
  billing_period_start: date | None
  billing_period_end: date | None
  total_due: Decimal | None
  currency: str
  account_number: str | None

  LineItem:
    label: str
    amount: Decimal
```

### DB Schema

Phase 2 adds the following Postgres tables via SQLAlchemy ORM. Phase 1 uses `InMemoryDB`; Phase 2 introduces real SQLAlchemy+Postgres persistence and migrates User and RefreshSession to the ORM alongside these new tables. Add `is_admin: bool = False` column to the `users` table.

```
users (extended):
  + is_admin: bool DEFAULT false

uploads:
  id: UUID PK
  user_id: UUID FK -> users.id
  original_filename: str
  minio_bucket: str
  minio_key: str
  content_type: str
  size_bytes: int
  uploaded_at: timestamp
  extraction_status: str        # "pending" | "success" | "failed" | "adaptive_failed" | "provider_outage"
  extraction_method: str | None # e.g. "module:FinecoIT" | "adaptive:generated_abc" | "ocr_text" | "llm_vision"
  module_source: str | None     # "builtin" | "generated" | "promoted"
  confirmed: bool DEFAULT false
  report_flagged: bool DEFAULT false

extracted_documents:
  id: UUID PK
  upload_id: UUID FK -> uploads.id UNIQUE
  document_type: str
  module_name: str | None
  module_version: str | None
  confidence: float
  raw_text: text | None
  payload_json: JSONB           # full ExtractedDocument serialized
  extracted_at: timestamp

transactions:                   # flat normalized table for Phase 3 queries
  id: UUID PK
  user_id: UUID FK -> users.id
  upload_id: UUID FK -> uploads.id
  date: date
  amount: Decimal(12,4)
  currency: str(3)              # ISO 4217
  description: str
  category: str | NULL          # Phase 3 fills this; NULL until categorized
  type: str                     # "income" | "expense" | "transfer"
  source_module: str | NULL     # module name that produced this row
  created_at: timestamp

extraction_reports:
  id: UUID PK
  upload_id: UUID FK -> uploads.id
  reported_at: timestamp
  user_note: str | None
```

- **D-28:** `transactions` rows are written atomically with `extracted_documents` inside the same DB transaction when a `bank_statement` is successfully extracted. For non-bank documents (payslip, utility bill, receipt), `transactions` rows are NOT written — those document types do not produce transaction lists.
- **D-29:** Phase 3 queries: `SELECT * FROM transactions WHERE user_id = ? AND upload_id IN (SELECT id FROM uploads WHERE user_id = ? AND confirmed = true)`.

### Guardrail Preflight (Retry Flow)
- **D-30:** The Retry dialog allows the user to add a free-text hint to guide re-extraction (e.g. "This is a BancoBPM statement, columns are in Italian").
- **D-31:** All user-supplied text MUST pass a **guardrail preflight LLM call** (`api/app/ingestion/guardrail.py`) before being used in an LLM prompt. The guardrail call uses a strict system prompt, JSON-mode output, and a 2-second timeout (default `safe: false` on timeout). Response schema: `{ "safe": true | false, "reason": str }`.
- **D-32:** If guardrail returns `safe: false`, the user sees a non-blocking warning banner with the reason and their hint is silently dropped. The retry proceeds using only the original file content — this may reproduce the same result, which the user can then Report.
- **D-33:** Guardrail calls use the same Gemini Flash → OpenAI fallback chain as all other LLM calls.

### Review UX (File List)
- **D-34:** The ingestion screen shows a file list table with columns: **File**, **Type**, **Extraction Method**, **Actions**. No row-level transaction editing in Phase 2.
- **D-35:** Extraction Method cell format:
  - Builtin module: `Conversion module (FinecoIT)`
  - Generated module: `{NEW} Conversion module (generated_abc123)`
  - Promoted module: `Conversion module (promoted: FinecoIT-v2)`
  - OCR+LLM text: `OCR → LLM text`
  - LLM vision: `LLM vision`
  - Failed: `Failed` (red, with Retry button)
  - Provider outage: `System outage` (red, with Retry button)
- **D-36:** Action buttons per row:
  - **Inspect** — always shown; opens extracted data summary modal (transactions table for bank statements; key-value pairs for payslips/bills; clean formatted view, not raw JSON).
  - **Retry** — shown when `extraction_status` is `"failed"`, `"adaptive_failed"`, `"provider_outage"`, OR `module_source = "generated"`. Opens hint dialog → guardrail preflight → re-extraction.
  - **Remove** — always shown; deletes Postgres rows (upload, extracted_document, transactions) and MinIO object.
  - **Report** — always shown when `extraction_status = "success"`; stores `extraction_reports` row with optional user note.
- **D-37:** A **"Confirm all"** button at the bottom of the file list marks all successfully extracted uploads as `confirmed = true`. Individual per-file confirm is also supported. Uploads with `extraction_status != "success"` cannot be confirmed.
- **D-38:** A file with `confirmed = true` shows a green checkmark in the row. The "Confirm all" button becomes "All confirmed" once all eligible files are confirmed.

### API Endpoints (Phase 2)
```
POST   /ingestion/upload              multipart/form-data, file field "file"
                                      → 202 { upload_id, status: "pending" }
GET    /ingestion/uploads             → list of UploadStatusDTO for current user
GET    /ingestion/uploads/{upload_id} → single UploadStatusDTO
GET    /ingestion/uploads/{upload_id}/extracted
                                      → ExtractedDocument payload (for Inspect modal)
POST   /ingestion/uploads/{upload_id}/confirm
                                      → 200 { confirmed: true }
POST   /ingestion/uploads/{upload_id}/retry
                                      body: { hint?: str }
                                      → 202 { status: "retrying" }
POST   /ingestion/uploads/{upload_id}/report
                                      body: { note?: str }
                                      → 201 { reported: true }
DELETE /ingestion/uploads/{upload_id} → 204

GET    /admin/modules                 → list of all modules with source, status, version
POST   /admin/modules/{module_name}/promote
                                      moves generated → promoted
                                      → 200 { promoted: true }
GET    /admin/modules/{module_name}/source
                                      → module source code (for review)
```
All `/ingestion/*` endpoints require `Authorization: Bearer <accessToken>`.
All `/admin/*` endpoints additionally require `is_admin = true`.

### Runtime and Delivery Scope
- **D-39:** `docker-compose.yml` gains two new services:
  - `minio` — `minio/minio:RELEASE.2024-01-16T16-07-38Z` (or latest stable), port 9000 (API) + 9001 (console).
  - `minio-init` — `minio/mc` one-shot container that waits for MinIO health, runs `mc mb senso-uploads`, and exits.
- **D-40:** A named Docker volume `modules_generated` is mounted at `api/app/ingestion/modules/generated/` and `modules_promoted` at `api/app/ingestion/modules/promoted/` in the `api` service, ensuring auto-generated and promoted modules persist across `docker compose down/up` (but not `docker compose down -v`).
- **D-41:** `pytesseract` and `tesseract-ocr` system package are added to `api/Dockerfile` (via `apt-get install tesseract-ocr` before the Python layer). `openpyxl` is added to `pyproject.toml` dependencies for XLSX support.

### Agent's Discretion
- Exact confidence score weights for FINGERPRINT keyword matching (as long as registry match semantics from D-13/D-14 are respected).
- Precise `pytesseract` character threshold value (default 50 chars; can tune based on sample file quality).
- Exact guardrail system prompt wording (must block prompt injection and return `{ safe, reason }` JSON).
- Upload file size limit (recommend 20 MB max per file; enforce in FastAPI with `UploadFile` size check).
- Exact sandbox subprocess timeout (recommend 10 seconds).
- Column name variants used by `GenericCSV` heuristics.
- Inspect modal layout details (table vs key-value card format per document type).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Acceptance
- `.planning/ROADMAP.md` — Phase 2 boundary, requirements list, and success criteria.
- `.planning/REQUIREMENTS.md` — `INGT-01`, `INGT-02`, `INGT-03` acceptance targets.
- `.planning/PROJECT.md` — non-negotiables (one-day demo reliability, AI-central product constraints).

### Existing Code to Extend
- `api/app/db/models.py` — existing `User` and `RefreshSession` dataclasses; Phase 2 migrates these to SQLAlchemy ORM and adds new models.
- `api/app/db/session.py` — current `InMemoryDB`; Phase 2 replaces with SQLAlchemy `AsyncSession`/`Session` and real Postgres connection pool.
- `api/app/core/config.py` — extend `Settings` with MinIO fields (`minio_endpoint`, `minio_access_key`, `minio_secret_key`, `minio_bucket`) and LLM provider fields (`gemini_api_key`, `openai_api_key`).
- `api/app/main.py` — register new `/ingestion` and `/admin` routers here.
- `api/app/api/auth.py` + `api/app/services/auth_service.py` — `get_current_user` is reused as a FastAPI dependency for all ingestion endpoints; `require_admin` is a new dependency wrapping it.
- `docker-compose.yml` — add `minio`, `minio-init` services and `modules_generated`, `modules_promoted` volumes.
- `.env.example` — add MinIO and LLM provider env vars.

### Sample Files Reference
- `api/app/ingestion/samples/` — developer places sample files here before implementation (one subfolder per institution: `fineco_it/`, `revolut_it/`, `satispay_it/`, `paypal_it/`, `edison_energia_it/`, `generic_invoice_it/`). Implementing agents MUST inspect these files before writing FINGERPRINT patterns or extract logic for any builtin module.

### Prior Context
- `.planning/research/STACK.md` — LLM provider rationale (Gemini Flash primary, OpenAI fallback).
- `.planning/phases/01-runtime-account-foundation/01-CONTEXT.md` — established patterns: Docker-first, FastAPI-owned logic, config-first env wiring, Pydantic schemas, service-layer separation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Established Patterns (must continue)
- **Service layer**: business logic in `api/app/services/`; routers in `api/app/api/`; schemas in `api/app/schemas/`. Phase 2 adds `ingestion_service.py`, `api/ingestion.py`, `api/admin.py`, `schemas/ingestion.py`.
- **Settings**: `get_settings()` in `api/app/core/config.py` reads from env vars via `os.getenv`. Phase 2 adds MinIO and LLM API key fields following the same frozen dataclass pattern.
- **Pydantic schemas**: all API input/output uses Pydantic v2 `BaseModel` with `Field(alias=...)` for camelCase JSON. Phase 2 schemas follow the same convention.
- **Tests**: `api/tests/`, `httpx` TestClient, pytest. Phase 2 adds `api/tests/test_ingestion_endpoints.py` and `api/tests/test_module_registry.py`.

### Critical Migration: InMemoryDB → SQLAlchemy + Postgres
Phase 1 auth uses `InMemoryDB` (in-memory dict store). Phase 2 MUST migrate this to real Postgres persistence using SQLAlchemy ORM. This migration is the first task of Plan 02-01. The `AuthService` depends on `InMemoryDB` — it must be updated to use the new session-based repository pattern. All existing auth tests must remain green after migration.

### New Code Structure for Phase 2
```
api/app/
  api/
    ingestion.py              # upload, status, confirm, retry, report, delete endpoints
    admin.py                  # module list, promote, source-view endpoints
  ingestion/
    __init__.py
    registry.py               # startup discovery, match, manifest, fault-tolerant load
    adaptive.py               # LLM adaptive pipeline: extract + generate module code
    guardrail.py              # injection preflight LLM call (2s timeout, JSON mode)
    ocr.py                    # tiered pipeline: pytesseract → llm_text → llm_vision
    llm.py                    # thin provider wrapper: Gemini Flash primary, OpenAI fallback
    modules/
      builtin/
        fineco_it.py
        revolut_it.py
        satispay_it.py
        paypal_it.py
        edison_energia_it.py
        generic_invoice_it.py
        generic_csv.py
      generated/              # Docker volume mount; survives container restarts
      promoted/               # Docker volume mount; admin-promoted modules
    samples/                  # developer reference files (not shipped in image)
      fineco_it/
      revolut_it/
      satispay_it/
      paypal_it/
      edison_energia_it/
      generic_invoice_it/
  schemas/
    ingestion.py              # ExtractionResult, ExtractedDocument, Transaction, LineItem,
                              # UploadStatusDTO, UploadListDTO, RetryRequest, ReportRequest
  services/
    ingestion_service.py      # orchestrates: upload → registry match → extract → store → transactions
    admin_service.py          # module listing, promotion, source retrieval
  db/
    models.py                 # SQLAlchemy ORM: User (+ is_admin), RefreshSession,
                              # Upload, ExtractedDocument, Transaction, ExtractionReport
    session.py                # SQLAlchemy engine + SessionLocal factory (replaces InMemoryDB)
    repository.py             # thin repository functions used by services
```

### Integration Points
- All `/ingestion/*` endpoints require a valid access token; reuse `get_current_user` from `api/app/api/auth.py` as a FastAPI `Depends`.
- All `/admin/*` endpoints add a `require_admin` dependency that checks `user.is_admin`.
- MinIO client is initialized at app lifespan startup and stored on `app.state.minio_client`; injected via `Depends(get_minio_client)`.
- LLM provider wrapper (`llm.py`) is injected via `Depends(get_llm_client)` and is stateless — no client state held between requests.
- Extraction runs synchronously in a background task (`BackgroundTasks`) after the upload endpoint returns `202`. Status is polled by the frontend via `GET /ingestion/uploads/{upload_id}`.
- The adaptive module generator writes files to `modules/generated/` which is volume-mounted — writes persist across restarts. Fault tolerance: if a generated module fails to load at next startup, it is skipped (D-15).

</code_context>

<specifics>
## Specific Ideas

- The Inspect modal renders differently per document type: transactions → sortable table with date/description/amount/type columns; payslip → two-column key-value card (gross, net, deductions list); utility bill → key-value card (provider, service, period, amount due); receipt → line items table + total.
- The guardrail system prompt should be ≤ 150 tokens, return only valid JSON `{ "safe": bool, "reason": str }`, and classify as unsafe: attempts to override system instructions, requests to ignore previous context, SQL/code injection patterns, and hints entirely unrelated to financial document parsing.
- `llm.py` should be a minimal provider wrapper: `complete(prompt, system, json_mode, timeout)` and `vision(prompt, system, image_bytes, json_mode, timeout)` — not a full LLM framework. Keep it thin.
- Each builtin module should include a docstring with: the institution name, supported export formats, the specific UI path to generate the export (e.g. "Fineco → Portafoglio → Esporta → CSV"), and 2-3 example FINGERPRINT keywords found in actual exports. This helps future module authors.
- The `{NEW}` badge in the file list should be styled distinctly (e.g. amber/yellow pill) to indicate LLM-generated provenance and invite the user to verify via Inspect before confirming.
- MinIO console (port 9001) should be accessible during local development for direct bucket inspection during debugging.

</specifics>

<deferred>
## Deferred Ideas

- Module versioning and rollback — track version history of generated modules, allow reverting a promotion. Beyond MVP scope.
- Bulk upload (multiple files in one request) — single file per request is sufficient for demo flow.
- Open-banking direct API connectors — explicitly out of scope per PROJECT.md.
- Row-level transaction editing in the ingestion review UI — deferred to Phase 3 (user may correct categories/amounts as part of profile building).
- Automatic spending categorization during ingestion — Phase 3's responsibility; Phase 2 only writes `category = NULL`.
- VPS deployment and cloud object storage migration — post-hackathon hardening only.
- Module marketplace / community sharing — far future.

</deferred>

---

*Phase: 02-financial-input-ingestion*
*Context finalized: 2026-03-24*
