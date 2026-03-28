import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")
# Use check_same_thread=False only for SQLite (test env)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


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


def _add_missing_columns() -> None:
    """
    Idempotent column additions for Postgres (ALTER TABLE ... ADD COLUMN IF NOT EXISTS).
    SQLite is used only in tests — skip silently for SQLite.
    """
    if DATABASE_URL.startswith("sqlite"):
        return
    migrations = [
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS extraordinary_income_total FLOAT",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS months_covered FLOAT",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_module VARCHAR(128)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)",
    ]
    with engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(__import__("sqlalchemy").text(stmt))
            except Exception as exc:
                # Column may already exist or DB may be read-only — log and continue
                import logging

                logging.getLogger(__name__).warning(
                    "Migration skipped: %s — %s", stmt, exc
                )
        conn.commit()
