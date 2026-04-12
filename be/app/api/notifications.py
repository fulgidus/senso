"""Notifications API: GET /notifications, POST /{id}/read, POST /read-all."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.ingestion import get_current_user
from app.db.session import get_db
from app.schemas.auth import UserDTO
from app.services.notification_service import NotificationService

router = APIRouter()


class NotificationDTO(BaseModel):
    id: str
    type: str
    title: str
    body: str
    is_read: bool
    action_url: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class NotificationsListDTO(BaseModel):
    items: list[NotificationDTO]
    unread_count: int


@router.get("", response_model=NotificationsListDTO)
def list_notifications(
    limit: int = 20,
    offset: int = 0,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationsListDTO:
    svc = NotificationService(db)
    items = svc.list_for_user(current_user.id, limit=limit, offset=offset)
    unread = svc.unread_count(current_user.id)
    return NotificationsListDTO(
        items=[NotificationDTO.model_validate(n) for n in items],
        unread_count=unread,
    )


@router.post("/{notification_id}/read", status_code=200)
def mark_notification_read(
    notification_id: str,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    svc = NotificationService(db)
    row = svc.mark_read(notification_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"read": True}


@router.post("/read-all", status_code=200)
def mark_all_notifications_read(
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    svc = NotificationService(db)
    count = svc.mark_all_read(current_user.id)
    return {"marked_read": count}
