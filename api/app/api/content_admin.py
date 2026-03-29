"""Admin CRUD API for content items.

All endpoints require is_admin=True via the require_admin dependency.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.admin import require_admin
from app.db.session import get_db
from app.schemas.auth import UserDTO
from app.schemas.content import ContentItemCreate, ContentItemDTO, ContentItemUpdate
from app.services.content_service import ContentService

router = APIRouter(prefix="/admin/content", tags=["admin-content"])


@router.get("/items", response_model=list[ContentItemDTO])
def list_content_items(
    locale: str | None = Query(None),
    type: str | None = Query(None),
    published_only: bool = Query(False),
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
):
    service = ContentService(db)
    return service.list_items(
        locale=locale, content_type=type, published_only=published_only
    )


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
        return service.create_item(data)
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
        return service.update_item(item_id, data)
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
        return {"deleted": True}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
