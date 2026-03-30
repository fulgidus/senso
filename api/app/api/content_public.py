"""Public content API endpoints — no authentication required.

Serves published content for browse pages and search.
"""

import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.content.search import search_content, suggest_content, get_all_tags
from app.db.session import get_db
from app.schemas.content import ContentItemDTO, PaginatedResponse
from app.services.content_service import ContentService

router = APIRouter(prefix="/content", tags=["content"])


@router.get("/items", response_model=PaginatedResponse[ContentItemDTO])
def list_public_items(
    locale: str | None = Query(None, pattern=r"^(it|en)$"),
    type: str | None = Query(None),
    topics: str | None = Query(None, description="Comma-separated topic tags"),
    topics_mode: str = Query("or", pattern=r"^(or|and)$"),
    sort_by: str = Query(
        "created_at", pattern=r"^(created_at|reading_time|duration|title)$"
    ),
    sort_dir: str = Query("desc", pattern=r"^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List published content items with sorting, filtering, and pagination."""
    topic_list = [t.strip() for t in topics.split(",") if t.strip()] if topics else None

    svc = ContentService(db)
    items, total = svc.list_items(
        locale=locale,
        content_type=type,
        published_only=True,
        topics=topic_list,
        topics_mode=topics_mode,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse(
        items=[ContentItemDTO.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/items/by-slug/{slug}", response_model=ContentItemDTO)
def get_public_item_by_slug(slug: str, db: Session = Depends(get_db)):
    """Get a single published content item by slug."""
    svc = ContentService(db)
    item = svc.get_by_slug(slug)
    if not item or not item.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content item not found",
        )
    return item


@router.get("/items/{item_id}", response_model=ContentItemDTO)
def get_public_item(item_id: str, db: Session = Depends(get_db)):
    """Get a single published content item by ID (legacy)."""
    svc = ContentService(db)
    item = svc.get_item(item_id)
    if not item or not item.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content item not found",
        )
    return item


@router.get("/slug-exists/{slug}")
def check_slug_exists(
    slug: str,
    exclude_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Check if a slug is already in use. Used by admin UI for collision detection."""
    svc = ContentService(db)
    return {"exists": svc.check_slug_exists(slug, exclude_id=exclude_id)}


@router.get(
    "/items/by-slug/{slug}/siblings",
    response_model=list[ContentItemDTO],
)
def get_localization_siblings(
    slug: str,
    db: Session = Depends(get_db),
):
    """Get all localization siblings of a content item (by slug)."""
    svc = ContentService(db)
    item = svc.get_by_slug(slug)
    if not item or not item.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content item not found",
        )
    if not item.localization_group:
        return []
    siblings = svc.get_localization_siblings(
        item.localization_group, exclude_locale=item.locale
    )
    return [s for s in siblings if s.is_published]


@router.get("/search")
def search_public_content(
    q: str = Query(..., min_length=1, max_length=200),
    locale: str = Query("it", pattern=r"^(it|en)$"),
    top_k: int = Query(5, ge=1, le=20),
    type: str | None = Query(None),
):
    """Search published content using BM25 text search.

    Supports structured syntax keywords (English only):
        tag:budget, type:video, from:2026-01-01, to:2026-03-31
    """
    content_types = [type] if type else None
    return search_content(q, locale, top_k, content_types)


@router.get("/suggest")
def suggest_public_content(
    q: str = Query(..., min_length=1, max_length=200),
    locale: str = Query("it", pattern=r"^(it|en)$"),
    limit: int = Query(8, ge=1, le=20),
):
    """Lightweight typeahead suggestions. Returns id, slug, title, type."""
    return suggest_content(q, locale, limit)


@router.get("/tags")
def list_tags(
    locale: str | None = Query(None, pattern=r"^(it|en)$"),
):
    """Return all unique topic tags, optionally filtered by locale."""
    return get_all_tags(locale)
