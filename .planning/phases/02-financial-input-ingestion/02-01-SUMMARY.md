---
phase: 02-financial-input-ingestion
plan: "01"
subsystem: database
tags: [sqlalchemy, postgres, sqlite, minio, orm, repository-pattern, docker-compose]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: FastAPI auth service with InMemoryDB, Settings dataclass, JWT auth endpoints
provides:
  - SQLAlchemy ORM models for all 6 entities (User, RefreshSession, Upload, ExtractedDocument, Transaction, ExtractionReport)
  - SQLAlchemy session factory (SessionLocal, get_db, create_tables) replacing InMemoryDB
  - Repository pattern functions for auth and ingestion services
  - Extended Settings with MinIO + LLM provider fields
  - MinIO service + bucket init in Docker Compose with named volumes
  - All Phase 2 Python dependencies in Dockerfile (sqlalchemy, psycopg2-binary, boto3, pytesseract, etc.)
affects: [02-02, 02-03, 02-04, 02-05, 03-profile-builder, 04-coaching]

# Tech tracking
tech-stack:
  added:
    - sqlalchemy==2.0.41 (ORM + session management)
    - psycopg2-binary==2.9.10 (Postgres driver, in Dockerfile)
    - boto3==1.38.18 (MinIO/S3 client, in Dockerfile)
    - pytesseract==0.3.13 (OCR, in Dockerfile)
    - openpyxl==3.1.5 (Excel parsing, in Dockerfile)
    - pdf2image==1.17.0 (PDF to image, in Dockerfile)
    - Pillow==11.2.1 (Image processing, in Dockerfile)
    - google-genai==1.68.0 (Gemini LLM, in Dockerfile)
    - openai==2.29.0 (OpenAI LLM, in Dockerfile)
    - tesseract-ocr (system package in Dockerfile)
    - minio/minio:RELEASE.2024-01-16T16-07-38Z (Docker service)
    - minio/mc (Docker init service)
  patterns:
    - Repository pattern: thin functions in app/db/repository.py wrapping SQLAlchemy queries
    - FastAPI Depends(get_db) for session injection into services
    - SQLite in-memory (via file) for tests, Postgres for production
    - Per-test DB reset via pytest autouse fixture (drop_all + create_all)
    - Lifespan context manager for startup table creation

key-files:
  created:
    - api/app/db/repository.py — repository functions for User + RefreshSession CRUD
    - api/uv.lock — Python dependency lockfile
  modified:
    - api/app/db/models.py — replaced dataclasses with SQLAlchemy ORM models (6 tables)
    - api/app/db/session.py — replaced InMemoryDB with SessionLocal + get_db + create_tables
    - api/app/services/auth_service.py — updated to use Session + repository pattern
    - api/app/api/auth.py — updated get_auth_service to use Depends(get_db)
    - api/app/core/config.py — added minio_*, gemini_api_key, openai_api_key, database_url fields
    - api/app/main.py — added lifespan with create_tables() call
    - api/tests/conftest.py — SQLite test DB with per-test reset fixture
    - api/pyproject.toml — added hatch build target pointing at app/ directory
    - docker-compose.yml — added minio + minio-init services + named volumes + MinIO/LLM env vars
    - api/Dockerfile — added tesseract-ocr + all Phase 2 Python deps
    - .env.example — added MinIO and LLM provider variables
    - .gitignore — added api/test.db exclusion

key-decisions:
  - "SQLite file-based DB for tests (not in-memory) to allow cross-session fixture setup without ENGINE_URL coupling"
  - "datetime.utcnow() fallback for timezone-naive SQLite datetimes in test env — avoids Postgres-only tz constraint"
  - "Repository functions as thin wrappers over SQLAlchemy queries, not a full repo class pattern"
  - "uv.lock committed for reproducible developer + CI dependency resolution"

patterns-established:
  - "Repository pattern: all DB access via app/db/repository.py functions taking (db: Session, ...) args"
  - "Depends(get_db): FastAPI dependency injection for SQLAlchemy Session across all services"
  - "Test isolation: autouse reset_db fixture drops + recreates all tables before each test"
  - "Settings extension: frozen dataclass in config.py using os.getenv with sensible defaults"

requirements-completed:
  - INGT-01

# Metrics
duration: 15min
completed: 2026-03-24
---

# Phase 2 Plan 1: DB Migration + MinIO Infrastructure Summary

**SQLAlchemy ORM replacing InMemoryDB with 6-table schema, repository pattern, MinIO in Docker Compose, and extended Settings — all auth tests green**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-24T22:00:00Z
- **Completed:** 2026-03-24T22:14:53Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Replaced Python dataclass `InMemoryDB` with full SQLAlchemy ORM: 6 models (User with is_admin, RefreshSession, Upload, ExtractedDocument, Transaction, ExtractionReport)
- Created `api/app/db/repository.py` with 6 repository functions; updated AuthService + auth router to use `Depends(get_db)`
- Extended `Settings` frozen dataclass with MinIO endpoint/credentials, bucket name, Gemini/OpenAI API keys, and database_url fields
- Added `minio` + `minio-init` services with healthcheck + bucket creation to `docker-compose.yml` with named volumes for modules
- Updated Dockerfile to install tesseract-ocr + all Phase 2 Python dependencies
- All 11 auth endpoint tests remain green with SQLite test isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate DB layer — SQLAlchemy ORM models + session factory + repository** - `ce8e8d9` (feat)
2. **Task 2: Extend Settings with MinIO + LLM fields; add MinIO to Docker Compose** - `45c8185` (feat)
3. **Housekeeping: uv.lock + gitignore** - `3b4a9a5` (chore)

## Files Created/Modified

- `api/app/db/models.py` — SQLAlchemy ORM: User, RefreshSession, Upload, ExtractedDocument, Transaction, ExtractionReport
- `api/app/db/session.py` — SessionLocal + get_db() + create_tables() (no InMemoryDB)
- `api/app/db/repository.py` — 6 repository functions for auth CRUD (NEW)
- `api/app/services/auth_service.py` — Uses Session + repository pattern
- `api/app/api/auth.py` — get_auth_service() uses Depends(get_db)
- `api/app/core/config.py` — Extended Settings with MinIO + LLM + database_url fields
- `api/app/main.py` — lifespan context manager calling create_tables()
- `api/tests/conftest.py` — SQLite test DB with per-test autouse reset fixture
- `api/pyproject.toml` — Added hatch build target for wheel packaging
- `docker-compose.yml` — minio + minio-init services, modules_generated/promoted volumes
- `api/Dockerfile` — tesseract-ocr apt pkg + all Phase 2 Python deps
- `.env.example` — MinIO and LLM provider env vars added

## Decisions Made

- **SQLite for tests**: Used `sqlite:///./test.db` (file-based) for test env since SQLAlchemy's in-memory SQLite doesn't persist across `get_db()` generator calls within the same test
- **Timezone workaround**: SQLite stores datetimes as timezone-naive; added UTC comparison fallback for `expires_at` check in `refresh()` — uses `datetime.utcnow()` when `tzinfo is None`. This only affects test env; Postgres stores timezone-aware datetimes properly
- **Repository as functions (not class)**: Plan specified functional style `repository.get_user_by_email(db, ...)` which is simpler and avoids over-engineering for this codebase size
- **uv.lock committed**: Lock file committed for reproducible builds across developer machines and CI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed timezone-naive datetime comparison in SQLite test environment**
- **Found during:** Task 1 (auth endpoint tests)
- **Issue:** `session.expires_at <= datetime.now(UTC)` raised `TypeError: can't compare offset-naive and offset-aware datetimes` because SQLite stores datetimes without timezone info
- **Fix:** Added conditional in `refresh()`: if `expires_at.tzinfo is None`, fall back to comparing with `datetime.utcnow()` (deprecated but necessary for SQLite compat in tests)
- **Files modified:** `api/app/services/auth_service.py`
- **Verification:** All 11 tests pass including `test_refresh_rotation_revokes_previous_token`
- **Committed in:** `ce8e8d9` (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed pyproject.toml hatch build target**
- **Found during:** Task 1 setup (`uv run` failed to build the package)
- **Issue:** `hatchling` couldn't determine which files to ship — `senso_api` directory didn't exist matching the project name
- **Fix:** Added `[tool.hatch.build.targets.wheel] packages = ["app"]` to pyproject.toml
- **Files modified:** `api/pyproject.toml`
- **Verification:** `uv run python3 -c "import sqlalchemy"` succeeds
- **Committed in:** `ce8e8d9` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for test environment compatibility. No scope creep. Production Postgres will handle timezone-aware datetimes correctly.

## Issues Encountered

None — both deviations were resolved automatically.

## User Setup Required

None - no external service configuration required for local development (MinIO and Postgres run via Docker Compose).

## Next Phase Readiness

- ORM foundation ready for Plan 02-02 (MinIO upload endpoints)
- All 6 models defined and table-creation tested
- Settings has all MinIO + LLM fields needed by Plans 02-02 through 02-05
- Docker Compose has MinIO service with bucket auto-creation
- Auth endpoints remain fully functional throughout migration

---
*Phase: 02-financial-input-ingestion*
*Completed: 2026-03-24*
