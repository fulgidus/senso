"""
Admin API: module listing, promotion, source retrieval.
All endpoints require is_admin=True (D-19/D-22).
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.ingestion import get_current_user
from app.db.models import FinancialTimeline, MerchantMap, ModerationLog, User
from app.db.session import get_db
from app.schemas.auth import UserDTO
from app.schemas.ingestion import ModuleInfo
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["admin"])


def get_admin_service() -> AdminService:
    return AdminService()


def require_admin(
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserDTO:
    """Dependency that verifies the current user has role='admin' (or is_admin for compat)."""
    from app.db.models import User

    user_row = db.query(User).filter(User.id == current_user.id).first()
    if not user_row or (user_row.role != "admin" and not user_row.is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return current_user


def require_tester(
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserDTO:
    """Dependency that verifies the current user has role in ('tester', 'admin') or is_admin."""
    from app.db.models import User

    user_row = db.query(User).filter(User.id == current_user.id).first()
    if not user_row or (
        user_row.role not in ("tester", "admin") and not user_row.is_admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Tester access required"
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


# ─── Phase 9 DTOs ─────────────────────────────────────────────────────────────


class MerchantMapAdminDTO(BaseModel):
    id: str
    description_raw: str
    canonical_merchant: str | None = None
    category: str
    confidence: float
    learned_method: str
    learned_provider_model: str | None = None
    learned_at: datetime
    contributing_user_obfuscated: str | None = None
    is_blacklisted: bool
    blacklisted_reason: str | None = None
    model_config = ConfigDict(from_attributes=False)


class BlacklistRequest(BaseModel):
    reason: str  # min 5 chars enforced in endpoint


class ModerationLogAdminDTO(BaseModel):
    id: str
    user_id: str
    content_type: str
    content_ref_id: str | None = None
    detected_violations: list
    severity: str
    action_taken: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


def _obfuscate_email(email: str) -> str:
    """u****@domain.com obfuscation for admin privacy."""
    if "@" not in email:
        return "u****"
    local, domain = email.split("@", 1)
    return f"u****@{domain}"


# ─── Phase 9: Merchant map admin endpoints ────────────────────────────────────


@router.get("/learned-merchants", response_model=list[MerchantMapAdminDTO])
def list_merchant_map(
    search: str = "",
    method: str = "",  # "manual"|"text:classification:sm"|"md"|"lg"|""
    blacklisted: str = "",  # "true"|"false"|""
    limit: int = 50,
    offset: int = 0,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[MerchantMapAdminDTO]:
    q = db.query(MerchantMap)
    if search:
        q = q.filter(MerchantMap.description_raw.ilike(f"%{search}%"))
    if method:
        q = q.filter(MerchantMap.learned_method == method)
    if blacklisted == "true":
        q = q.filter(MerchantMap.is_blacklisted == True)  # noqa: E712
    elif blacklisted == "false":
        q = q.filter(MerchantMap.is_blacklisted == False)  # noqa: E712
    rows = q.order_by(MerchantMap.learned_at.desc()).offset(offset).limit(limit).all()

    result = []
    for row in rows:
        obfuscated = None
        if row.contributing_user_id:
            user = db.query(User).filter(User.id == row.contributing_user_id).first()
            if user:
                obfuscated = _obfuscate_email(user.email)
        result.append(
            MerchantMapAdminDTO(
                id=row.id,
                description_raw=row.description_raw,
                canonical_merchant=row.canonical_merchant,
                category=row.category,
                confidence=row.confidence,
                learned_method=row.learned_method,
                learned_provider_model=row.learned_provider_model,
                learned_at=row.learned_at,
                contributing_user_obfuscated=obfuscated,
                is_blacklisted=row.is_blacklisted,
                blacklisted_reason=row.blacklisted_reason,
            )
        )
    return result


@router.post("/learned-merchants/{merchant_id}/blacklist", status_code=200)
def blacklist_merchant(
    merchant_id: str,
    body: BlacklistRequest,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if len(body.reason.strip()) < 5:
        raise HTTPException(
            status_code=422, detail="reason must be at least 5 characters"
        )
    row = db.query(MerchantMap).filter(MerchantMap.id == merchant_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Merchant entry not found")
    row.is_blacklisted = True
    row.blacklisted_at = datetime.now(UTC)
    row.blacklisted_reason = body.reason.strip()
    db.add(row)
    db.commit()
    return {"blacklisted": True}


@router.post("/learned-merchants/{merchant_id}/unblacklist", status_code=200)
def unblacklist_merchant(
    merchant_id: str,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    row = db.query(MerchantMap).filter(MerchantMap.id == merchant_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Merchant entry not found")
    row.is_blacklisted = False
    row.blacklisted_at = None
    row.blacklisted_reason = None
    db.add(row)
    db.commit()
    return {"unblacklisted": True}


# ─── Phase 9: Moderation queue admin endpoints ────────────────────────────────


@router.get("/moderation", response_model=list[ModerationLogAdminDTO])
def list_moderation_queue(
    status_filter: str = "",  # "pending"|"resolved"|""
    limit: int = 50,
    offset: int = 0,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ModerationLogAdminDTO]:
    q = db.query(ModerationLog).filter(ModerationLog.severity != "clean")
    if status_filter == "pending":
        q = q.filter(ModerationLog.action_taken == "none")
    elif status_filter == "resolved":
        q = q.filter(ModerationLog.action_taken != "none")
    rows = q.order_by(ModerationLog.created_at.desc()).offset(offset).limit(limit).all()
    return [ModerationLogAdminDTO.model_validate(r) for r in rows]


@router.post("/moderation/{log_id}/confirm", status_code=200)
def confirm_moderation_action(
    log_id: str,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Admin confirms: action stands, no change to penalty."""
    row = db.query(ModerationLog).filter(ModerationLog.id == log_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Log entry not found")
    row.action_taken = f"admin_confirmed_{row.action_taken}"
    db.add(row)
    db.commit()
    return {"confirmed": True}


@router.post("/moderation/{log_id}/revert", status_code=200)
def revert_moderation_action(
    log_id: str,
    _: UserDTO = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Admin reverts: undo penalty, restore content, notify user."""
    from sqlalchemy import text as sa_text

    from app.services.notification_service import NotificationService

    row = db.query(ModerationLog).filter(ModerationLog.id == log_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Log entry not found")

    # Restore banned_until if it was a timeout/ban action
    db.execute(
        sa_text("UPDATE users SET banned_until = NULL WHERE id = :uid"),
        {"uid": row.user_id},
    )

    # Restore content if it was a timeline_context
    if row.content_type == "timeline_context" and row.content_ref_id:
        event = (
            db.query(FinancialTimeline)
            .filter(FinancialTimeline.id == row.content_ref_id)
            .first()
        )
        if event:
            event.context_tos_status = "clean"
            db.add(event)

    # Notify user
    notif_svc = NotificationService(db)
    notif_svc.create(
        row.user_id,
        "appeal_reverted",
        "Penalità annullata",
        "La tua segnalazione è stata annullata dall'amministratore. Il tuo contenuto è stato ripristinato.",
    )

    row.action_taken = "admin_reverted"
    db.add(row)
    db.commit()
    return {"reverted": True}
