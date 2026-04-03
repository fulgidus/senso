import logging
import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
# Use check_same_thread=False only for SQLite (test env)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

logger = logging.getLogger(__name__)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    from app.db.models import Base  # noqa: PLC0415

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
    _backfill_content_slugs()
    _seed_default_users()
    _seed_content_from_json()


def _add_missing_columns() -> None:
    """
    Idempotent column additions for Postgres (ALTER TABLE ... ADD COLUMN IF NOT EXISTS).
    SQLite is used only in tests - skip silently for SQLite.
    """
    if DATABASE_URL.startswith("sqlite"):
        return
    migrations = [
        # ── Round 1: original columns ──────────────────────────────────────────
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS extraordinary_income_total FLOAT",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS months_covered FLOAT",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_module VARCHAR(128)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_gender VARCHAR(16) NOT NULL DEFAULT 'indifferent'",
        # ── Round 2: voice-to-voice mode ──────────────────────────────────────
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_auto_listen BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS default_persona_id VARCHAR(64) NOT NULL DEFAULT 'mentore-saggio'",
        # ── Round 3: chat relational integrity ────────────────────────────────
        # chat_sessions: drop user_id ownership in favour of session_participants
        "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS creator_id VARCHAR(36)",
        # Back-fill creator_id from old user_id before we can drop user_id.
        # Safe to run multiple times (WHERE creator_id IS NULL guard).
        "UPDATE chat_sessions SET creator_id = user_id WHERE creator_id IS NULL AND user_id IS NOT NULL",
        # Add FK constraint only if it doesn't exist (Postgres idempotent pattern)
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'chat_sessions_creator_id_fkey'
          ) THEN
            ALTER TABLE chat_sessions
              ADD CONSTRAINT chat_sessions_creator_id_fkey
              FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;
          END IF;
        END$$
        """,
        # chat_messages: sender_id + persona_id
        "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_id VARCHAR(36)",
        "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS persona_id VARCHAR(64)",
        # Back-fill sender_id for existing user messages via session→user_id
        """
        UPDATE chat_messages cm
        SET sender_id = cs.user_id
        FROM chat_sessions cs
        WHERE cm.session_id = cs.id
          AND cm.role = 'user'
          AND cm.sender_id IS NULL
          AND cs.user_id IS NOT NULL
        """,
        # Add FK for sender_id
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'chat_messages_sender_id_fkey'
          ) THEN
            ALTER TABLE chat_messages
              ADD CONSTRAINT chat_messages_sender_id_fkey
              FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
          END IF;
        END$$
        """,
        # welcome_cache.cache_key was VARCHAR(64) but the value is 69 chars — widen it
        "ALTER TABLE welcome_cache ALTER COLUMN cache_key TYPE VARCHAR(72)",
        # Truncate any existing oversized keys (none should exist, but be safe)
        "DELETE FROM welcome_cache WHERE length(cache_key) > 72",
        # ── Round 5: rename creator_id → owner_id with CASCADE ───────────────
        # Safe to run on both old DBs (has creator_id) and new DBs (already
        # named owner_id — each statement is guarded and will SAVEPOINT-skip).
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'chat_sessions' AND column_name = 'creator_id'
          ) THEN
            ALTER TABLE chat_sessions RENAME COLUMN creator_id TO owner_id;
          END IF;
        END$$
        """,
        # Drop old SET NULL FK (may not exist on fresh DBs — skip via SAVEPOINT)
        "ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_creator_id_fkey",
        # Add new CASCADE FK (idempotent DO$$ guard)
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'chat_sessions_owner_id_fkey'
          ) THEN
            ALTER TABLE chat_sessions
              ADD CONSTRAINT chat_sessions_owner_id_fkey
              FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
          END IF;
        END$$
        """,
        # Drop old index, create new one
        "DROP INDEX IF EXISTS ix_chat_sessions_creator_id",
        "CREATE INDEX IF NOT EXISTS ix_chat_sessions_owner_id ON chat_sessions(owner_id)",
        # ── Round 4: new tables (create_all handles these on fresh DBs) ───────
        # session_participants, audio_cache, orphaned_s3_objects are created by
        # Base.metadata.create_all() — the DO$$ blocks below make them idempotent
        # for environments where create_all already ran without the new models.
        """
        CREATE TABLE IF NOT EXISTS session_participants (
          id VARCHAR(36) PRIMARY KEY,
          session_id VARCHAR(36) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
          participant_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          is_session_admin BOOLEAN NOT NULL DEFAULT FALSE,
          can_talk BOOLEAN NOT NULL DEFAULT TRUE,
          can_invite_participants BOOLEAN NOT NULL DEFAULT FALSE,
          can_share BOOLEAN NOT NULL DEFAULT FALSE,
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_session_participant UNIQUE (session_id, participant_id)
        )
        """,
        # Back-fill session_participants from chat_sessions.user_id for existing rows
        """
        INSERT INTO session_participants (id, session_id, participant_id, is_session_admin, can_talk, can_invite_participants, can_share, joined_at)
        SELECT
          gen_random_uuid()::text,
          cs.id,
          cs.user_id,
          TRUE,
          TRUE,
          TRUE,
          TRUE,
          cs.created_at
        FROM chat_sessions cs
        WHERE cs.user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM session_participants sp
            WHERE sp.session_id = cs.id AND sp.participant_id = cs.user_id
          )
        """,
        """
        CREATE TABLE IF NOT EXISTS audio_cache (
          id VARCHAR(36) PRIMARY KEY,
          message_id VARCHAR(36) NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
          minio_bucket VARCHAR(255) NOT NULL,
          minio_key VARCHAR(1024) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS orphaned_s3_objects (
          id VARCHAR(36) PRIMARY KEY,
          minio_bucket VARCHAR(255) NOT NULL,
          minio_key VARCHAR(1024) NOT NULL,
          reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        # ── Round 6: coaching insights ─────────────────────────────────────────
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS coaching_insights JSONB NOT NULL DEFAULT '[]'::jsonb",
        # ── Round 7: uploads fingerprint ──────────────────────────────────────
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS uploads_fingerprint VARCHAR(64)",
        # ── Round 8: per-file progress detail ─────────────────────────────────
        "ALTER TABLE categorization_jobs ADD COLUMN IF NOT EXISTS progress_detail JSONB",
        # ── Round 9: ingestion watchdog queue timestamp ───────────────────────
        "ALTER TABLE uploads ADD COLUMN IF NOT EXISTS extraction_queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        # ── Round 10: content_items schema expansion ──────────────────────────
        "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS slug VARCHAR(300)",
        "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS body TEXT",
        "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS localization_group VARCHAR(36)",
        "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER",
        "ALTER TABLE content_items ADD COLUMN IF NOT EXISTS duration_seconds INTEGER",
        # Backfill reading_time_minutes from metadata->'estimated_read_minutes'
        """
        UPDATE content_items
        SET reading_time_minutes = (metadata->>'estimated_read_minutes')::integer
        WHERE reading_time_minutes IS NULL
          AND metadata->>'estimated_read_minutes' IS NOT NULL
        """,
        # ── Round 11: Phase 9 tables ──────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS merchant_map (
            id VARCHAR(36) PRIMARY KEY,
            description_raw TEXT NOT NULL,
            canonical_merchant VARCHAR(255),
            category VARCHAR(64) NOT NULL DEFAULT 'uncategorized',
            confidence FLOAT NOT NULL DEFAULT 0.0,
            learned_method VARCHAR(48) NOT NULL DEFAULT 'manual',
            learned_provider_model VARCHAR(128),
            learned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            contributing_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
            contributing_job_id VARCHAR(36),
            contributing_upload_id VARCHAR(36),
            is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
            blacklisted_at TIMESTAMPTZ,
            blacklisted_reason TEXT
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_merchant_map_description_raw ON merchant_map (description_raw)",
        """
        CREATE TABLE IF NOT EXISTS financial_timeline (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            event_type VARCHAR(64) NOT NULL,
            event_date DATE NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            evidence_json JSON,
            user_context_raw TEXT,
            user_context_distilled TEXT,
            context_tos_status VARCHAR(16) NOT NULL DEFAULT 'pending',
            is_user_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
            dismissed_reason VARCHAR(32),
            dismissed_detail TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_financial_timeline_user_id ON financial_timeline (user_id)",
        """
        CREATE TABLE IF NOT EXISTS moderation_log (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content_type VARCHAR(32) NOT NULL,
            content_ref_id VARCHAR(36),
            raw_input TEXT NOT NULL,
            detected_violations JSON NOT NULL DEFAULT '[]',
            severity VARCHAR(16) NOT NULL,
            action_taken VARCHAR(32) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_moderation_log_user_id ON moderation_log (user_id)",
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(32) NOT NULL,
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            action_url VARCHAR(512),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id)",
        # ── Round 12: Phase 9 user penalty columns ────────────────────────────
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS violation_count INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ",
        # ── Round 13: Phase 10 — encryption columns ───────────────────────────
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_user_key TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS pbkdf2_salt VARCHAR(64)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS strict_privacy_mode BOOLEAN NOT NULL DEFAULT FALSE",
        # ── Round 14: Phase 10 — convert T2 JSON/JSONB columns to TEXT ────────
        # EncryptedJSON TypeDecorator stores AES-GCM ciphertext as TEXT.
        # Existing columns are JSON or JSONB — PostgreSQL refuses ciphertext writes.
        # USING clause casts existing JSON values to TEXT (valid JSON strings are
        # accepted by the TEXT type). Idempotent: already-TEXT columns are no-ops.
        """
        DO $$
        BEGIN
          IF (SELECT data_type FROM information_schema.columns
              WHERE table_name='user_profiles' AND column_name='income_summary') != 'text' THEN
            ALTER TABLE user_profiles ALTER COLUMN income_summary TYPE TEXT USING income_summary::text;
          END IF;
        END$$
        """,
        """
        DO $$
        BEGIN
          IF (SELECT data_type FROM information_schema.columns
              WHERE table_name='user_profiles' AND column_name='category_totals') != 'text' THEN
            ALTER TABLE user_profiles ALTER COLUMN category_totals TYPE TEXT USING category_totals::text;
          END IF;
        END$$
        """,
        """
        DO $$
        BEGIN
          IF (SELECT data_type FROM information_schema.columns
              WHERE table_name='user_profiles' AND column_name='insight_cards') != 'text' THEN
            ALTER TABLE user_profiles ALTER COLUMN insight_cards TYPE TEXT USING insight_cards::text;
          END IF;
        END$$
        """,
        """
        DO $$
        BEGIN
          IF (SELECT data_type FROM information_schema.columns
              WHERE table_name='user_profiles' AND column_name='coaching_insights') != 'text' THEN
            ALTER TABLE user_profiles ALTER COLUMN coaching_insights TYPE TEXT USING coaching_insights::text;
          END IF;
        END$$
        """,
        # transactions.description: VARCHAR(1024) → TEXT (EncryptedString stores as TEXT)
        """
        DO $$
        BEGIN
          IF (SELECT data_type FROM information_schema.columns
              WHERE table_name='transactions' AND column_name='description') != 'text' THEN
            ALTER TABLE transactions ALTER COLUMN description TYPE TEXT USING description::text;
          END IF;
        END$$
        """,
        # moderation_log.raw_input: already TEXT in creation DDL above, but guard anyway
        """
        DO $$
        BEGIN
          IF (SELECT data_type FROM information_schema.columns
              WHERE table_name='moderation_log' AND column_name='raw_input') != 'text' THEN
            ALTER TABLE moderation_log ALTER COLUMN raw_input TYPE TEXT USING raw_input::text;
          END IF;
        END$$
        """,
        # ── Round 15: Phase 11 — RBAC role column ─────────────────────────────────
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'user'",
        # Backfill: existing admins (is_admin=TRUE) get role='admin'
        "UPDATE users SET role = 'admin' WHERE is_admin = TRUE AND (role = 'user' OR role IS NULL)",
        # ── Round 16: Phase 11 — ingestion pipeline traces ────────────────────────
        """
        CREATE TABLE IF NOT EXISTS ingestion_traces (
            id VARCHAR(36) PRIMARY KEY,
            upload_id VARCHAR(36) NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
            step_name VARCHAR(128) NOT NULL,
            step_order INTEGER NOT NULL,
            input_summary TEXT,
            output_summary TEXT,
            raw_input TEXT,
            raw_output TEXT,
            duration_ms INTEGER,
            status VARCHAR(16) NOT NULL DEFAULT 'success',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_ingestion_traces_upload_id ON ingestion_traces (upload_id)",
        # ── Round 17: Phase 13 — crypto identity (username + NaCl key columns) ──
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(64) UNIQUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS public_key_b64 TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS signing_key_b64 TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS nacl_pbkdf2_salt TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS nacl_key_login_envelope_b64 TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_x25519_private_b64 TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_ed25519_signing_b64 TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username) WHERE username IS NOT NULL",
    ]
    with engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(__import__("sqlalchemy").text("SAVEPOINT mig"))
                conn.execute(__import__("sqlalchemy").text(stmt))
                conn.execute(__import__("sqlalchemy").text("RELEASE SAVEPOINT mig"))
            except Exception as exc:
                conn.execute(__import__("sqlalchemy").text("ROLLBACK TO SAVEPOINT mig"))
                logging.getLogger(__name__).warning(
                    "Migration skipped: %.120s - %s", stmt.strip()[:120], exc
                )
        conn.commit()


def _backfill_content_slugs() -> None:
    """Backfill slug column for content_items that have NULL slugs.

    Uses slugify(title) with slugify(id) as fallback. Appends a numeric suffix
    on collision to guarantee uniqueness. Then creates a unique index if missing.
    Idempotent — skips rows that already have slugs. Skips for SQLite (tests).
    """
    if DATABASE_URL.startswith("sqlite"):
        return

    import sqlalchemy as sa  # noqa: PLC0415
    from slugify import slugify  # noqa: PLC0415

    # Phase 1: Backfill NULL slugs using raw SQL (no ORM lock issues)
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text("SELECT id, title, slug FROM content_items WHERE slug IS NULL")
        ).fetchall()

        if rows:
            # Collect existing slugs
            existing = conn.execute(
                sa.text("SELECT slug FROM content_items WHERE slug IS NOT NULL")
            ).fetchall()
            used_slugs: set[str] = {r[0] for r in existing}

            for row_id, title, _ in rows:
                base_slug = slugify(title or "", max_length=280)
                if not base_slug:
                    base_slug = slugify(row_id or "", max_length=280)
                if not base_slug:
                    base_slug = row_id

                slug = base_slug
                counter = 2
                while slug in used_slugs:
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                used_slugs.add(slug)

                conn.execute(
                    sa.text("UPDATE content_items SET slug = :slug WHERE id = :id"),
                    {"slug": slug, "id": row_id},
                )
            conn.commit()
            logger.info("Backfilled slugs for %d content items.", len(rows))

    # Phase 2: Add NOT NULL constraint and unique index (separate connection)
    ddl_stmts = [
        "ALTER TABLE content_items ALTER COLUMN slug SET NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_content_items_slug ON content_items(slug)",
        "CREATE INDEX IF NOT EXISTS ix_content_items_localization_group ON content_items(localization_group)",
    ]
    with engine.connect() as conn:
        for stmt in ddl_stmts:
            try:
                conn.execute(sa.text("SAVEPOINT slug_ddl"))
                conn.execute(sa.text(stmt))
                conn.execute(sa.text("RELEASE SAVEPOINT slug_ddl"))
            except Exception as exc:
                conn.execute(sa.text("ROLLBACK TO SAVEPOINT slug_ddl"))
                logger.warning("Slug DDL skipped: %.80s - %s", stmt[:80], exc)
        conn.commit()


def _seed_default_users() -> None:
    """Create DEFAULT_USERS if they don't already exist.

    Derives first_name from the email username (part before '@'), capitalised.
    Honours STARTING_ADMINS: if the email is listed there, sets is_admin=True.
    Idempotent - silently skips users that are already present.
    """
    from uuid import uuid4  # noqa: PLC0415

    from app.core.config import get_settings  # noqa: PLC0415
    from app.core.security import hash_password  # noqa: PLC0415
    from app.db import repository  # noqa: PLC0415
    from app.db.models import User  # noqa: PLC0415

    settings = get_settings()
    if not settings.default_users:
        return

    db = SessionLocal()
    try:
        for email, password in settings.default_users:
            email_lower = email.lower()
            if repository.get_user_by_email(db, email_lower) is not None:
                logger.debug("Seed user already exists, skipping: %s", email_lower)
                continue

            username = email_lower.split("@")[0]
            first_name = username.capitalize()
            is_admin = email_lower in settings.starting_admins

            user = User(
                id=str(uuid4()),
                email=email_lower,
                password_hash=hash_password(password),
                first_name=first_name,
                is_admin=is_admin,
                role="admin" if is_admin else "user",
            )
            repository.create_user(db, user)
            logger.info("Seeded default user: %s (admin=%s)", email_lower, is_admin)
    finally:
        db.close()


def _seed_content_from_json() -> None:
    """Seed content_items table from static JSON catalog files (idempotent).

    Skips if the table already contains any rows.
    Merges type-specific fields into the metadata_ JSONB column.
    Generates UUIDv7 IDs and slugs from titles via python-slugify.
    Resolves ``localization_group`` string keys into shared UUIDv7 groups.
    """
    import json  # noqa: PLC0415
    from pathlib import Path  # noqa: PLC0415

    import uuid_utils as uuid  # noqa: PLC0415
    from slugify import slugify  # noqa: PLC0415
    from app.db.models import ContentItem  # noqa: PLC0415

    db = SessionLocal()
    try:
        existing_count = db.query(ContentItem).count()
        if existing_count > 0:
            logger.debug(
                "content_items already has %d rows, skipping seed.", existing_count
            )
            return

        content_dir = Path(__file__).resolve().parent.parent / "content"
        # Common top-level keys shared by all content types
        shared_keys = {
            "locale",
            "type",
            "title",
            "summary",
            "topics",
            "localization_group",
        }

        catalog_files = {
            "articles.json": "article",
            "videos.json": "video",
            "slides.json": "slide_deck",
            "partners.json": "partner_offer",
        }

        # Map localization_group string keys -> UUIDv7 (resolved lazily)
        l10n_group_map: dict[str, str] = {}

        used_slugs: set[str] = set()
        items_to_add: list[ContentItem] = []
        for fname, expected_type in catalog_files.items():
            path = content_dir / fname
            if not path.exists():
                logger.warning("Catalog file not found: %s", path)
                continue
            raw = json.loads(path.read_text(encoding="utf-8"))
            for entry in raw:
                # Build metadata from all keys that aren't shared
                metadata = {k: v for k, v in entry.items() if k not in shared_keys}

                # Generate unique slug from title
                title = entry.get("title", "")
                base_slug = (
                    slugify(title, max_length=280)
                    if title
                    else f"item-{len(items_to_add)}"
                )
                slug = base_slug
                counter = 2
                while slug in used_slugs:
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                used_slugs.add(slug)

                # Extract reading_time and duration from metadata
                reading_time = metadata.get("estimated_read_minutes")
                duration = None

                # Resolve localization_group key -> UUIDv7
                l10n_key = entry.get("localization_group")
                l10n_group = None
                if l10n_key:
                    if l10n_key not in l10n_group_map:
                        l10n_group_map[l10n_key] = str(uuid.uuid7())
                    l10n_group = l10n_group_map[l10n_key]

                item = ContentItem(
                    id=str(uuid.uuid7()),
                    slug=slug,
                    locale=entry.get("locale", "it"),
                    type=entry.get("type", expected_type),
                    title=title,
                    summary=entry.get("summary", entry.get("description", "")),
                    topics=entry.get("topics", []),
                    metadata_=metadata,
                    is_published=True,
                    localization_group=l10n_group,
                    reading_time_minutes=int(reading_time) if reading_time else None,
                )
                items_to_add.append(item)

        if items_to_add:
            db.bulk_save_objects(items_to_add)
            db.commit()
            logger.info(
                "Seeded %d content items from JSON catalogs.", len(items_to_add)
            )
    except Exception as exc:
        logger.warning("Failed to seed content items: %s", exc)
        db.rollback()
    finally:
        db.close()
