"""ContentService: CRUD operations on ContentItem records."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ContentItem
from app.schemas.content import ContentItemCreate, ContentItemUpdate

logger = logging.getLogger(__name__)

# Valid sort fields mapping (public name → model attribute)
SORT_FIELDS = {
    "created_at": ContentItem.created_at,
    "reading_time": ContentItem.reading_time_minutes,
    "duration": ContentItem.duration_seconds,
    "title": ContentItem.title,
}


class ContentService:
    """Handles content item persistence and query operations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # ── List / Query ───────────────────────────────────────────────────────

    def list_items(
        self,
        *,
        locale: str | None = None,
        content_type: str | None = None,
        published_only: bool = False,
        topics: list[str] | None = None,
        topics_mode: str = "or",  # "or" | "and"
        sort_by: str = "created_at",
        sort_dir: str = "desc",  # "asc" | "desc"
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ContentItem], int]:
        """Return a paginated, filtered, sorted list of content items.

        Returns ``(items, total_count)`` so callers can build pagination metadata.
        """
        q = self.db.query(ContentItem)

        # ── Filters ───────────────────────────────────────────────────
        if locale:
            q = q.filter(ContentItem.locale == locale)
        if content_type:
            q = q.filter(ContentItem.type == content_type)
        if published_only:
            q = q.filter(ContentItem.is_published == True)  # noqa: E712

        # Topic filtering (JSON array contains)
        if topics:
            if topics_mode == "and":
                # AND: item must have ALL specified topics
                for topic in topics:
                    q = q.filter(ContentItem.topics.contains([topic]))
            else:
                # OR: item must have ANY of the specified topics
                from sqlalchemy import or_  # noqa: PLC0415

                q = q.filter(or_(*(ContentItem.topics.contains([t]) for t in topics)))

        # ── Total count (before pagination) ───────────────────────────
        total = q.count()

        # ── Sorting ───────────────────────────────────────────────────
        sort_col = SORT_FIELDS.get(sort_by, ContentItem.created_at)
        if sort_dir == "asc":
            q = q.order_by(sort_col.asc().nullslast())
        else:
            q = q.order_by(sort_col.desc().nullslast())

        # ── Pagination ────────────────────────────────────────────────
        offset = (page - 1) * page_size
        items = q.offset(offset).limit(page_size).all()

        return items, total

    # ── Single-item lookups ────────────────────────────────────────────────

    def get_item(self, item_id: str) -> ContentItem | None:
        return self.db.query(ContentItem).filter(ContentItem.id == item_id).first()

    def get_by_slug(self, slug: str) -> ContentItem | None:
        return self.db.query(ContentItem).filter(ContentItem.slug == slug).first()

    # ── Slug collision check ───────────────────────────────────────────────

    def check_slug_exists(self, slug: str, exclude_id: str | None = None) -> bool:
        """Return True if a content item with this slug already exists.

        Optionally excludes a specific item ID (for edit-mode checks).
        """
        q = self.db.query(ContentItem.id).filter(ContentItem.slug == slug)
        if exclude_id:
            q = q.filter(ContentItem.id != exclude_id)
        return q.first() is not None

    # ── Localization group ─────────────────────────────────────────────────

    def get_localization_siblings(
        self,
        localization_group: str,
        exclude_locale: str | None = None,
    ) -> list[ContentItem]:
        """Return all content items in the same localization group.

        Optionally excludes items of a specific locale (to get "other" translations).
        """
        q = self.db.query(ContentItem).filter(
            ContentItem.localization_group == localization_group
        )
        if exclude_locale:
            q = q.filter(ContentItem.locale != exclude_locale)
        return q.order_by(ContentItem.locale).all()

    def search_linkable_items(
        self,
        query: str,
        content_type: str,
        exclude_locale: str,
        limit: int = 10,
    ) -> list[ContentItem]:
        """Search for items that can be linked in a localization group.

        Finds items of the same type, different locale, matching the title query.
        """
        return (
            self.db.query(ContentItem)
            .filter(
                ContentItem.type == content_type,
                ContentItem.locale != exclude_locale,
                ContentItem.title.ilike(f"%{query}%"),
            )
            .order_by(ContentItem.title)
            .limit(limit)
            .all()
        )

    # ── CUD ────────────────────────────────────────────────────────────────

    def create_item(self, data: ContentItemCreate) -> ContentItem:
        existing = self.get_item(data.id)
        if existing:
            raise ValueError(f"Content item '{data.id}' already exists")
        if self.check_slug_exists(data.slug):
            raise ValueError(f"Slug '{data.slug}' already exists")
        item = ContentItem(
            id=data.id,
            slug=data.slug,
            locale=data.locale,
            type=data.type,
            title=data.title,
            summary=data.summary,
            body=data.body,
            topics=data.topics,
            metadata_=data.metadata_ if data.metadata_ else {},
            is_published=data.is_published,
            localization_group=data.localization_group,
            reading_time_minutes=data.reading_time_minutes,
            duration_seconds=data.duration_seconds,
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
        # Check slug uniqueness if slug is being changed
        if "slug" in update_data and update_data["slug"] != item.slug:
            if self.check_slug_exists(update_data["slug"], exclude_id=item_id):
                raise ValueError(f"Slug '{update_data['slug']}' already exists")
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

    # ── Bulk operations ────────────────────────────────────────────────────

    def bulk_set_published(self, item_ids: list[str], is_published: bool) -> int:
        """Set is_published for multiple items. Returns count of updated rows."""
        count = (
            self.db.query(ContentItem)
            .filter(ContentItem.id.in_(item_ids))
            .update(
                {ContentItem.is_published: is_published}, synchronize_session="fetch"
            )
        )
        self.db.commit()
        return count

    def bulk_set_published_by_group(
        self, localization_group: str, is_published: bool
    ) -> int:
        """Set is_published for all items in a localization group."""
        count = (
            self.db.query(ContentItem)
            .filter(ContentItem.localization_group == localization_group)
            .update(
                {ContentItem.is_published: is_published}, synchronize_session="fetch"
            )
        )
        self.db.commit()
        return count

    def delete_by_group(self, localization_group: str) -> int:
        """Delete all items in a localization group. Returns count."""
        count = (
            self.db.query(ContentItem)
            .filter(ContentItem.localization_group == localization_group)
            .delete(synchronize_session="fetch")
        )
        self.db.commit()
        return count
