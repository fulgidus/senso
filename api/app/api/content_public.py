"""Public content API endpoints — no authentication required.

Serves published content for browse pages and search.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.content.search import search_content
from app.db.models import ContentItem
from app.db.session import get_db
from app.schemas.content import ContentItemDTO

router = APIRouter(prefix="/content", tags=["content"])


@router.get("/items", response_model=list[ContentItemDTO])
def list_public_items(
    locale: str = Query("it", pattern=r"^(it|en)$"),
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List published content items, paginated, filtered by locale and optional type."""
    q = db.query(ContentItem).filter(
        ContentItem.is_published == True,  # noqa: E712
        ContentItem.locale == locale,
    )
    if type:
        q = q.filter(ContentItem.type == type)
    items = (
        q.order_by(ContentItem.type, ContentItem.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items


@router.get("/items/{item_id}", response_model=ContentItemDTO)
def get_public_item(item_id: str, db: Session = Depends(get_db)):
    """Get a single published content item by ID."""
    item = (
        db.query(ContentItem)
        .filter(
            ContentItem.id == item_id,
            ContentItem.is_published == True,  # noqa: E712
        )
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content item not found",
        )
    return item


@router.get("/search")
def search_public_content(
    q: str = Query(..., min_length=1, max_length=200),
    locale: str = Query("it", pattern=r"^(it|en)$"),
    top_k: int = Query(5, ge=1, le=20),
    type: str | None = Query(None),
):
    """Search published content using BM25 text search."""
    content_types = [type] if type else None
    return search_content(q, locale, top_k, content_types)
