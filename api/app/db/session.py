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
    _seed_default_users()


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
            )
            repository.create_user(db, user)
            logger.info("Seeded default user: %s (admin=%s)", email_lower, is_admin)
    finally:
        db.close()
