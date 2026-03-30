"""Admin CRUD API for content items.

All endpoints require is_admin=True via the require_admin dependency.
"""

import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.admin import require_admin
from app.content.search import rebuild_index
from app.db.session import get_db
from app.schemas.auth import UserDTO
from app.schemas.content import (
    ContentItemCreate,
    ContentItemDTO,
    ContentItemUpdate,
    PaginatedResponse,
)
from app.services.content_service import ContentService

router = APIRouter(prefix="/admin/content", tags=["admin-content"])


# ── List / Query ───────────────────────────────────────────────────────────


@router.get("/items", response_model=PaginatedResponse[ContentItemDTO])
def list_content_items(
    locale: str | None = Query(None),
    type: str | None = Query(None),
    published_only: bool = Query(False),
    sort_by: str = Query(
        "created_at", pattern=r"^(created_at|reading_time|duration|title)$"
    ),
    sort_dir: str = Query("desc", pattern=r"^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = ContentService(db)
    items, total = service.list_items(
        locale=locale,
        content_type=type,
        published_only=published_only,
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


# ── Single item ────────────────────────────────────────────────────────────


@router.get("/items/{item_id}", response_model=ContentItemDTO)
def get_content_item(
    item_id: str,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = ContentService(db)
    item = service.get_item(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found"
        )
    return item


# ── Slug collision check ──────────────────────────────────────────────────


@router.get("/slug-exists/{slug}")
def check_slug_collision(
    slug: str,
    exclude_id: str | None = Query(None),
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Check if a slug is already in use. Used by admin edit form (debounced)."""
    service = ContentService(db)
    return {"exists": service.check_slug_exists(slug, exclude_id=exclude_id)}


# ── Localization group search ─────────────────────────────────────────────


@router.get("/linkable-items", response_model=list[ContentItemDTO])
def search_linkable_items(
    q: str = Query(..., min_length=1, max_length=200),
    content_type: str = Query(...),
    exclude_locale: str = Query(...),
    limit: int = Query(10, ge=1, le=50),
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Search for items that can be linked in a localization group.

    Finds items of the same type but different locale, matching by title.
    """
    service = ContentService(db)
    return service.search_linkable_items(
        query=q,
        content_type=content_type,
        exclude_locale=exclude_locale,
        limit=limit,
    )


@router.get("/items/{item_id}/siblings", response_model=list[ContentItemDTO])
def get_item_siblings(
    item_id: str,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get localization siblings of a content item."""
    service = ContentService(db)
    item = service.get_item(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found"
        )
    if not item.localization_group:
        return []
    return service.get_localization_siblings(
        item.localization_group, exclude_locale=item.locale
    )


# ── CUD ────────────────────────────────────────────────────────────────────


@router.post(
    "/items", response_model=ContentItemDTO, status_code=status.HTTP_201_CREATED
)
def create_content_item(
    data: ContentItemCreate,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = ContentService(db)
    try:
        item = service.create_item(data)
        rebuild_index()
        return item
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.put("/items/{item_id}", response_model=ContentItemDTO)
def update_content_item(
    item_id: str,
    data: ContentItemUpdate,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = ContentService(db)
    try:
        item = service.update_item(item_id, data)
        rebuild_index()
        return item
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete("/items/{item_id}")
def delete_content_item(
    item_id: str,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = ContentService(db)
    try:
        service.delete_item(item_id)
        rebuild_index()
        return {"deleted": True}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Bulk operations ────────────────────────────────────────────────────────


class BulkPublishRequest(BaseModel):
    item_ids: list[str]
    is_published: bool
    apply_to_group: bool = True  # default: apply to all group members


@router.post("/bulk-publish")
def bulk_publish(
    data: BulkPublishRequest,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Publish/unpublish multiple items. When apply_to_group is True (default),
    the action is also applied to all localization group siblings."""
    service = ContentService(db)

    if data.apply_to_group:
        # Collect all group IDs from the selected items
        processed_groups: set[str] = set()
        direct_count = 0
        for item_id in data.item_ids:
            item = service.get_item(item_id)
            if not item:
                continue
            if (
                item.localization_group
                and item.localization_group not in processed_groups
            ):
                service.bulk_set_published_by_group(
                    item.localization_group, data.is_published
                )
                processed_groups.add(item.localization_group)
            elif not item.localization_group:
                # Item not in a group — update individually
                service.update_item(
                    item_id,
                    ContentItemUpdate(is_published=data.is_published),
                )
                direct_count += 1
        count = direct_count  # approximate
    else:
        count = service.bulk_set_published(data.item_ids, data.is_published)

    rebuild_index()
    return {
        "updated": count,
        "groups_affected": len(processed_groups) if data.apply_to_group else 0,
    }


class BulkDeleteRequest(BaseModel):
    item_ids: list[str]
    apply_to_group: bool = True


@router.post("/bulk-delete")
def bulk_delete(
    data: BulkDeleteRequest,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete multiple items. When apply_to_group is True (default),
    all localization group siblings are also deleted."""
    service = ContentService(db)

    if data.apply_to_group:
        processed_groups: set[str] = set()
        for item_id in data.item_ids:
            item = service.get_item(item_id)
            if not item:
                continue
            if (
                item.localization_group
                and item.localization_group not in processed_groups
            ):
                service.delete_by_group(item.localization_group)
                processed_groups.add(item.localization_group)
            elif not item.localization_group:
                service.delete_item(item_id)
    else:
        for item_id in data.item_ids:
            try:
                service.delete_item(item_id)
            except ValueError:
                pass

    rebuild_index()
    return {"deleted": True}
