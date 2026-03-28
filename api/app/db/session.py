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
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS extraordinary_income_total FLOAT",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS months_covered FLOAT",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_module VARCHAR(128)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_gender VARCHAR(16) NOT NULL DEFAULT 'indifferent'",
    ]
    with engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(__import__("sqlalchemy").text(stmt))
            except Exception as exc:
                # Column may already exist or DB may be read-only - log and continue
                logging.getLogger(__name__).warning(
                    "Migration skipped: %s - %s", stmt, exc
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
