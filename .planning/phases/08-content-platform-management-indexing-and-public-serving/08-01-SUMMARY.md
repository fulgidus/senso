---
phase: 08-content-platform-management-indexing-and-public-serving
plan: "01"
subsystem: api, database
tags: [sqlalchemy, pydantic, fastapi, content-management, json-seed]

requires:
  - phase: 07-streaming-nice-to-have-polish
    provides: "Working API with auth, coaching, and content search modules"
provides:
  - "ContentItem DB model with locale, type, topics, and metadata JSONB"
  - "Pydantic schemas for content CRUD (Create, Update, DTO)"
  - "ContentService with CRUD operations"
  - "Admin CRUD API at /admin/content with require_admin guard"
  - "Idempotent JSON catalog seed migration into content_items table"
affects: [08-02, 08-03]

tech-stack:
  added: []
  patterns:
    - "ContentItem uses metadata_ Column('metadata') to avoid SQLAlchemy Base.metadata clash"
    - "ContentItemDTO uses serialization_alias='metadata' (not alias) for from_attributes ORM compatibility"
    - "JSON catalog seed runs once idempotently in create_tables() — checks row count before inserting"

key-files:
  created:
    - api/app/db/models.py (ContentItem class added)
    - api/app/schemas/content.py
    - api/app/services/content_service.py
    - api/app/api/content_admin.py
    - api/tests/test_content_admin.py
  modified:
    - api/app/db/session.py (_seed_content_from_json added)
    - api/app/main.py (content_admin_router registered)

key-decisions:
  - "ContentItemDTO uses serialization_alias='metadata' instead of alias='metadata' to avoid SQLAlchemy MetaData conflict when from_attributes=True"
  - "metadata_ stores all type-specific fields as a JSONB dict — no separate columns per content type"
  - "JSON catalog seed checks existing row count for idempotency instead of per-item upsert"

patterns-established:
  - "Content model metadata pattern: Column('metadata', JSON) accessed via metadata_ attribute, serialized as 'metadata' in API responses"
  - "Admin content API pattern: ContentService(db) instantiated inline in endpoint handlers"

requirements-completed: [CONT-01, CONT-02]

duration: 15min
completed: 2026-03-29
---

# Phase 8 Plan 01: Content DB Model + Admin CRUD API Summary

**ContentItem DB model with JSONB metadata, admin CRUD at /admin/content, and idempotent JSON catalog seed into content_items table**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-29T22:00:00Z
- **Completed:** 2026-03-29T22:15:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ContentItem DB model stores articles, videos, slide decks, and partner offers with locale/type/topics and type-specific metadata JSONB
- Static JSON catalogs (articles, videos, slides, partners) are seeded into content_items table on first startup
- Admin CRUD API (list/get/create/update/delete) with require_admin guard and proper HTTP status codes
- 11 integration tests passing for all admin endpoints including auth guards

## Task Commits

1. **Task 1: ContentItem DB model + Pydantic schemas + seed migration** - `7f41b54` (feat)
2. **Task 2: Admin content CRUD API + integration tests** - `c8a9493` (feat)

## Files Created/Modified
- `api/app/db/models.py` - Added ContentItem model with locale, type, topics, metadata JSONB
- `api/app/db/session.py` - Added _seed_content_from_json() called from create_tables()
- `api/app/schemas/content.py` - ContentItemCreate, ContentItemUpdate, ContentItemDTO schemas
- `api/app/services/content_service.py` - ContentService with list/get/create/update/delete
- `api/app/api/content_admin.py` - Admin CRUD router at /admin/content
- `api/app/main.py` - Registered content_admin_router
- `api/tests/test_content_admin.py` - 11 integration tests

## Decisions Made
- ContentItemDTO uses `serialization_alias="metadata"` instead of `alias="metadata"` to avoid SQLAlchemy Base.metadata conflict when `from_attributes=True`
- All type-specific fields stored in single `metadata_` JSONB column rather than separate columns per content type
- JSON catalog seed checks row count for idempotency (skip if >0 rows exist)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ContentItemDTO metadata_ alias clash with SQLAlchemy**
- **Found during:** Task 1 (schema creation)
- **Issue:** Using `alias="metadata"` with `from_attributes=True` causes Pydantic to resolve to SQLAlchemy's `Base.metadata` (MetaData object) instead of the column value
- **Fix:** Used `serialization_alias="metadata"` on the DTO field; kept `alias="metadata"` on Create/Update schemas which don't use from_attributes
- **Files modified:** api/app/schemas/content.py
- **Verification:** Admin tests confirm correct metadata serialization in responses
- **Committed in:** 7f41b54

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correct ORM-to-Pydantic serialization. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ContentItem table seeded and ready for Plan 08-02 (DB-backed search) and Plan 08-03 (frontend pages)
- Admin CRUD API operational for content management

---
*Phase: 08-content-platform-management-indexing-and-public-serving*
*Completed: 2026-03-29*
