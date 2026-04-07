"""
Debug API: ingestion restart, coaching purge, and nuclear reset.
All endpoints are scoped to the current user and require require_tester.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.admin import require_admin, require_tester
from app.db.models import ChatMessage, ExtractedDocument, Upload, User
from app.db.session import get_db
from app.schemas.auth import UserDTO

router = APIRouter(prefix="/debug", tags=["debug"])


@router.post("/restart-ingestion")
def restart_ingestion(
    current_user: UserDTO = Depends(require_tester),
    db: Session = Depends(get_db),
) -> dict:
    """Reset all non-done DocumentUpload rows for the current user back to pending.

    Sets extraction_status='pending', module_source=None, extraction_method=None
    for any upload owned by the user that is not yet 'done'.
    Returns the count of rows reset.
    """
    rows = (
        db.query(Upload)
        .filter(
            Upload.user_id == current_user.id,
            Upload.extraction_status != "done",
        )
        .all()
    )
    count = 0
    for row in rows:
        row.extraction_status = "pending"
        row.module_source = None
        row.extraction_method = None
        db.add(row)
        count += 1
    db.commit()
    return {"restarted": count}


@router.post("/purge-coaching")
def purge_coaching(
    current_user: UserDTO = Depends(require_tester),
    db: Session = Depends(get_db),
) -> dict:
    """Delete all ChatMessage rows owned by the current user.

    Returns the count of chat messages deleted.
    """
    deleted = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}


@router.delete("/nuke")
def nuke(
    current_user: UserDTO = Depends(require_tester),
    db: Session = Depends(get_db),
) -> dict:
    """Delete ALL data for the current user (chat, extracted docs, uploads).

    Order respects FK constraints:
    1. ChatMessage
    2. ExtractedDocument (via upload_id)
    3. Upload
    """
    # 1. Delete chat messages
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete(
        synchronize_session=False
    )

    # 2. Delete extracted documents via upload FK
    upload_ids = [
        u.id
        for u in db.query(Upload.id).filter(Upload.user_id == current_user.id).all()
    ]
    if upload_ids:
        db.query(ExtractedDocument).filter(
            ExtractedDocument.upload_id.in_(upload_ids)
        ).delete(synchronize_session=False)

    # 3. Delete uploads
    db.query(Upload).filter(Upload.user_id == current_user.id).delete(
        synchronize_session=False
    )

    db.commit()
    return {"nuked": True, "user_id": current_user.id}


@router.delete("/nuke-all")
def nuke_all(
    current_user: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Delete ALL users and their data. Admin only.

    Uses FK CASCADE on the users table to delete all child rows
    (uploads, extracted_documents, chat_messages, transactions,
    user_profiles, notifications, etc.).

    The calling admin's own account is also deleted — they will
    need to re-register after this operation.
    """
    count = db.query(User).count()
    db.query(User).delete(synchronize_session=False)
    db.commit()
    return {"nuked_all": True, "users_deleted": count}
