"""ContentService: CRUD operations on ContentItem records."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ContentItem
from app.schemas.content import ContentItemCreate, ContentItemUpdate

logger = logging.getLogger(__name__)


class ContentService:
    """Handles content item persistence and query operations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_items(
        self,
        locale: str | None = None,
        content_type: str | None = None,
        published_only: bool = False,
    ) -> list[ContentItem]:
        q = self.db.query(ContentItem)
        if locale:
            q = q.filter(ContentItem.locale == locale)
        if content_type:
            q = q.filter(ContentItem.type == content_type)
        if published_only:
            q = q.filter(ContentItem.is_published == True)  # noqa: E712
        return q.order_by(ContentItem.type, ContentItem.id).all()

    def get_item(self, item_id: str) -> ContentItem | None:
        return self.db.query(ContentItem).filter(ContentItem.id == item_id).first()

    def create_item(self, data: ContentItemCreate) -> ContentItem:
        existing = self.get_item(data.id)
        if existing:
            raise ValueError(f"Content item '{data.id}' already exists")
        item = ContentItem(
            id=data.id,
            locale=data.locale,
            type=data.type,
            title=data.title,
            summary=data.summary,
            topics=data.topics,
            metadata_=data.metadata_ if data.metadata_ else {},
            is_published=data.is_published,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update_item(self, item_id: str, data: ContentItemUpdate) -> ContentItem:
        item = self.get_item(item_id)
        if not item:
            raise ValueError(f"Content item '{item_id}' not found")
        update_data = data.model_dump(exclude_unset=True, by_alias=False)
        for key, value in update_data.items():
            setattr(item, key, value)
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_item(self, item_id: str) -> bool:
        item = self.get_item(item_id)
        if not item:
            raise ValueError(f"Content item '{item_id}' not found")
        self.db.delete(item)
        self.db.commit()
        return True
