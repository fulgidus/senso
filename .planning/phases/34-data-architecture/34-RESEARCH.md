# Phase 34 Research — Data Architecture

**Phase:** 34 (Data Architecture)
**Date:** 2026-04-13
**Requirements:** DATA-01, DATA-02, DATA-03, DATA-06, CORE-08
**Purpose:** Dynamic typed SQLAlchemy table generation from Chest JSON Schemas; platform identity primitive; BM25 chest search.

---

## Inputs Reviewed

- `.planning/ROADMAP.md` — Phase 34 success criteria (revised: typed tables, no JSONB fallback)
- `.planning/REQUIREMENTS.md` — CORE-08, DATA-01–03, DATA-06
- `be/app/db/models.py` — existing model patterns (User, Transaction, EncryptedJSON, _uuid7)
- `be/app/db/session.py` — `_add_missing_columns()`, `create_tables()` patterns
- `be/app/content/search.py` — ContentIndex BM25 pattern (locale-partitioned, singleton)
- `be/app/domain/manifest.py` — ChestDef, StorageConfig (just created Phase 33)
- `be/pyproject.toml` — sqlalchemy>=2.0, sqlalchemy-utils, psycopg2, rank-bm25 all present

---

## Architecture Decision: Typed Flat Tables

Each Chest → one typed table. Table name: `{domain_id}__{chest_id}`.

**Rule: JSON Schema must be flat.** Top-level properties must all be scalar types.
Arrays and nested objects are rejected at startup with a `SchemaFlattenError`.
This is a domain manifest authoring constraint, not a platform limitation.

**Why flat is correct:** each row is one atomic entity (one transaction, one content item).
If you need an array, you need a second chest (junction). This enforces normalization at the schema layer.

---

## Standard Platform Columns (always present, regardless of domain schema)

```
id              VARCHAR(36) PK          uuid7, platform-generated
identity_id     VARCHAR(36) FK→platform_identities.id ON DELETE CASCADE  (NULL for scope=domain)
domain_id       VARCHAR(64) NOT NULL    index
locale          VARCHAR(10)             nullable; only populated when StorageConfig.localized=True
created_at      TIMESTAMPTZ NOT NULL    default NOW()
updated_at      TIMESTAMPTZ NOT NULL    default NOW()
expires_at      TIMESTAMPTZ             nullable; TTL chests only
```

Domain schema columns appended after standard columns.

---

## JSON Schema → SQLAlchemy Column Type Mapping

```python
# (json_type, format) → SQLAlchemy type
TYPE_MAP = {
    ("string",  None):        Text,
    ("string",  "date"):      Date,
    ("string",  "date-time"): DateTime(timezone=True),
    ("string",  "uuid"):      String(36),
    ("string",  "email"):     String(255),
    ("number",  None):        Numeric,
    ("integer", None):        Integer,
    ("boolean", None):        Boolean,
}
```

If `(type, format)` not in TYPE_MAP → `SchemaTypeError` (not JSONB fallback).
If property type is `"object"` or `"array"` → `SchemaFlattenError`.

---

## PII Encryption

`StorageConfig.encrypted = True` → all domain-schema columns use
`StringEncryptedType(Text, key_fn, AesGcmEngine)` instead of their native type.
Standard platform columns are never encrypted (identity_id, domain_id, locale, timestamps).

Rationale: chest-level encryption is all-or-nothing per column. Field-level
granularity is v2.1+ concern. For v2.0: if a chest is encrypted, all its domain
data is encrypted. Querying by encrypted field is not supported (and not needed
given typed platform columns handle all structural queries).

---

## platform_identities Table

```python
class PlatformIdentity(Base):
    __tablename__ = "platform_identities"
    id: str = Column(String(36), primary_key=True, default=_uuid7)
    domain_id: str = Column(String(64), nullable=False, index=True)
    created_at: datetime = Column(DateTime(timezone=True), nullable=False, default=...)
```

No email. No name. No password. No preferences. Platform knows nothing about the user.

`users` table is deprecated — v1.0 code references it, but v2.0 platform code never touches it.
personal_finance domain (Phase 39) will own its own auth table as a domain chest.

---

## DomainModelFactory Pattern

```python
class DomainModelFactory:
    def __init__(self, metadata: MetaData) -> None: ...

    def build_tables(
        self,
        manifest: DomainManifest,
        manifest_dir: Path,
        encryption_key_fn: Callable[[], str],
    ) -> dict[str, Table]:
        """
        Build one Table per ChestDef in manifest.
        Returns {chest_id: Table}.
        Raises SchemaTypeError / SchemaFlattenError on invalid schema.
        """

    def provision(self, engine: Engine, tables: dict[str, Table]) -> None:
        """CREATE TABLE IF NOT EXISTS for all tables. Idempotent."""
```

---

## DomainManager

Routing flag only. No DDL.

```python
class DomainManager:
    def __init__(self) -> None:
        self._active: set[str] = set()
        self._tables: dict[str, dict[str, Table]] = {}   # domain_id → chest_id → Table

    def register_domain(self, domain_id: str, tables: dict[str, Table]) -> None: ...
    def activate(self, domain_id: str) -> None: ...
    def deactivate(self, domain_id: str) -> None: ...
    def is_active(self, domain_id: str) -> bool: ...
    def get_table(self, domain_id: str, chest_id: str) -> Table: ...  # raises if inactive
```

---

## ChestAccessor

Generic CRUD over a dynamic Table. Not an ORM model — uses SQLAlchemy Core API.

```python
class ChestAccessor:
    def __init__(self, table: Table, chest_def: ChestDef) -> None: ...
    def get(self, db: Session, identity_id: str, id: str) -> dict | None: ...
    def list(self, db: Session, identity_id: str, locale: str | None = None) -> list[dict]: ...
    def list_domain(self, db: Session, locale: str | None = None) -> list[dict]: ...  # scope=domain
    def create(self, db: Session, identity_id: str | None, data: dict) -> str: ...   # returns id
    def update(self, db: Session, id: str, data: dict) -> bool: ...
    def delete(self, db: Session, id: str) -> bool: ...
    def count(self, db: Session, identity_id: str) -> int: ...
```

Uses `db.execute(table.select().where(...))` — Core API, not ORM session.add().
Returns plain `dict` (row._mapping). No Pydantic models at this layer.

---

## BM25 ChestSearchEngine

Generalizes existing `ContentIndex` pattern to cover all `searchable` chests.

```python
class ChestSearchEngine:
    def __init__(self) -> None:
        # {(chest_id, locale): (items: list[dict], bm25: BM25Okapi)}
        self._indexes: dict[tuple[str, str], tuple[list[dict], BM25Okapi]] = {}

    def build(self, chest_id: str, items: list[dict], locale: str, text_fields: list[str]) -> None:
        """Build BM25 index for one chest+locale partition."""

    def search(self, chest_id: str, query: str, locale: str, top_k: int = 5) -> list[dict]: ...
    def rebuild_chest(self, chest_id: str, accessor: ChestAccessor, db: Session) -> None: ...
```

`text_fields` derived from ChestDef: any schema field of type `string` that is not `id`, `locale`, or a timestamp.

---

## Startup Integration Order

```
1. create_tables()               ← existing platform tables (platform_identities added here)
2. DomainModelFactory.build_tables(manifest) ← generate Table objects
3. DomainModelFactory.provision(engine, tables) ← CREATE TABLE IF NOT EXISTS
4. DomainManager.register_domain + activate ← routing enabled
5. ChestSearchEngine.build for each searchable chest ← BM25 warm-up
6. app.state.domain_manager = manager
7. app.state.chest_search = search_engine
```

---

## Package Layout

New files:
```
be/app/data/
├── __init__.py
├── factory.py      # DomainModelFactory, SchemaTypeError, SchemaFlattenError
├── manager.py      # DomainManager
├── accessor.py     # ChestAccessor
├── search.py       # ChestSearchEngine
└── deps.py         # FastAPI dependency functions
```

Modified:
- `be/app/db/models.py` — add `PlatformIdentity`
- `be/app/db/session.py` — add `platform_identities` to `create_tables()`
- `be/app/main.py` — add steps 2–7 to lifespan

---

## Confidence Assessment

| Decision | Confidence | Notes |
|----------|-----------|-------|
| SQLAlchemy Core Table() for dynamic models | HIGH | Well-supported in SA 2.x; avoids ORM metaclass issues |
| Flat schema enforcement (reject arrays/objects) | HIGH | Correct normalization; domain must split chests |
| StringEncryptedType for encrypted chests | HIGH | Already proven in v1.0 EncryptedJSON |
| ContentIndex BM25 pattern reuse | HIGH | Identical pattern, just generalized |
| platform_identities as sole identity table | HIGH | Clean break; v1.0 users table untouched (used by v1.0 code still running) |
| ChestAccessor returning plain dict | HIGH | Avoids Pydantic coupling at storage layer; domain shapes data |

*Research complete: 2026-04-13*
