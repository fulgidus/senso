"""
Admin API: module listing, promotion, source retrieval.
All endpoints require is_admin=True (D-19/D-22).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import UserDTO
from app.schemas.ingestion import ModuleInfo
from app.services.admin_service import AdminService
from app.api.ingestion import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


def get_admin_service() -> AdminService:
    return AdminService()


def require_admin(
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserDTO:
    """Dependency that verifies the current user has is_admin=True."""
    from app.db.models import User

    user_row = db.query(User).filter(User.id == current_user.id).first()
    if not user_row or not user_row.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return current_user


@router.get("/modules", response_model=list[ModuleInfo])
def list_modules(
    _: UserDTO = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
):
    return service.list_modules()


@router.post("/modules/{module_name}/promote")
def promote_module(
    module_name: str,
    _: UserDTO = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
):
    try:
        return service.promote_module(module_name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get("/modules/{module_name}/source")
def get_module_source(
    module_name: str,
    _: UserDTO = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
):
    try:
        source = service.get_module_source(module_name)
        return {"name": module_name, "source": source}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
