"""NotificationService: create and query in-app notifications."""

from sqlalchemy.orm import Session

from app.db.models import Notification
from app.db.repository import (
    count_unread_notifications,
    create_notification,
    get_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        user_id: str,
        notif_type: str,
        title: str,
        body: str,
        action_url: str | None = None,
    ) -> Notification:
        row = create_notification(self.db, user_id, notif_type, title, body, action_url)
        self.db.commit()
        return row

    def list_for_user(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[Notification]:
        return get_notifications(self.db, user_id, limit=limit, offset=offset)

    def unread_count(self, user_id: str) -> int:
        return count_unread_notifications(self.db, user_id)

    def mark_read(self, notification_id: str, user_id: str) -> Notification | None:
        row = mark_notification_read(self.db, notification_id, user_id)
        self.db.commit()
        return row

    def mark_all_read(self, user_id: str) -> int:
        count = mark_all_notifications_read(self.db, user_id)
        self.db.commit()
        return count
