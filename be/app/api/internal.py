"""
Internal API router — E2E test infrastructure.

Guards:
  - settings.allow_test_reset must be True (set via ALLOW_TEST_RESET=true env var)
  - X-Internal-Token header must match settings.internal_token

These endpoints are NEVER reachable in production because ALLOW_TEST_RESET
defaults to "false" and is never set outside docker-compose.test.yml.

Routes:
  POST /internal/db/reset      - truncate all user-data tables, restart identity
  DELETE /internal/users/{id}  - delete a single user and cascade
"""

from __future__ import annotations

import logging

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal", tags=["internal"])

# Tables truncated on reset, in dependency order (children first)
_RESET_TABLES = [
    "audio_cache",
    "welcome_cache",
    "orphaned_s3_objects",
    "notifications",
    "moderation_log",
    "ingestion_traces",
    "financial_timeline",
    "merchant_map",
    "content_items",
    "delivered_messages",
    "undelivered_messages",
    "session_participants",
    "chat_messages",
    "chat_sessions",
    "tag_vocabulary",
    "categorization_jobs",
    "user_memory",
    "regional_knowledge",
    "extraction_reports",
    "transactions",
    "extracted_documents",
    "uploads",
    "user_profiles",
    "refresh_sessions",
    "users",
]


def _guard(request: Request, settings: Settings) -> None:
    """Raise 403 unless test-reset is enabled and the internal token matches."""
    if not settings.allow_test_reset:
        raise HTTPException(status_code=403, detail="Test reset not enabled")
    token = request.headers.get("X-Internal-Token", "")
    if not token or token != settings.internal_token:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Internal-Token")


@router.post("/db/reset")
def reset_db(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Truncate all user-data tables and restart identity sequences.
    Safe to call between Playwright tests to return DB to clean state.
    """
    _guard(request, settings)
    table_list = ", ".join(_RESET_TABLES)
    db.execute(
        sa.text(
            f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE"  # noqa: S608
        )
    )
    db.commit()
    logger.info("DB reset: truncated %d tables", len(_RESET_TABLES))
    return {"status": "reset", "tables": len(_RESET_TABLES)}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Delete a single user and all their data (CASCADE).
    Used by the Playwright account fixture teardown to clean up test users.
    """
    _guard(request, settings)
    result = db.execute(
        sa.text("DELETE FROM users WHERE id = :uid RETURNING id"),
        {"uid": user_id},
    )
    deleted = result.fetchone()
    db.commit()
    if deleted is None:
        raise HTTPException(status_code=404, detail="User not found")
    logger.info("Deleted test user %s", user_id)
    return {"status": "deleted", "user_id": user_id}
