"""
Profile API: get profile, status polling, questionnaire, confirm.
All endpoints require Authorization: Bearer <accessToken>.
"""

from datetime import date as date_type, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.ingestion import get_current_user
from app.db.repository import (
    dismiss_timeline_event,
    get_timeline_event,
    get_timeline_events,
    set_timeline_context,
)
from app.db.session import get_db
from app.schemas.auth import UserDTO
from app.schemas.profile import (
    CategorizationStatusDTO,
    ProfileConfirmRequest,
    QuestionnaireSubmitRequest,
    UserProfileDTO,
)
from app.services.profile_service import ProfileError, ProfileService

router = APIRouter(prefix="/profile", tags=["profile"])


# ─── Phase 9 DTOs ─────────────────────────────────────────────────────────────


class TimelineEventDTO(BaseModel):
    id: str
    event_type: str
    event_date: date_type
    title: str
    description: str | None = None
    evidence_json: dict | None = None
    user_context_distilled: str | None = (
        None  # NOTE: raw context is NEVER returned (D-15)
    )
    context_tos_status: str
    is_user_dismissed: bool
    dismissed_reason: str | None = None
    model_config = ConfigDict(from_attributes=True)


class UncategorizedTransactionDTO(BaseModel):
    id: str
    description: str | None = None
    amount: float | None = None
    date: date_type | None = None
    source_filename: str | None = None
    type: str | None = None  # "income" | "expense" | "transfer"
    counterpart_name: str | None = None  # normalized merchant/actor name
    model_config = ConfigDict(from_attributes=True)


class BulkCategoryUpdateRequest(BaseModel):
    description: str
    category: str


class DismissEventRequest(BaseModel):
    reason: str  # "false_assumption"|"clerical_error"|"outdated"|"duplicate"|"other"
    detail: str | None = None


class AddContextRequest(BaseModel):
    text: str


class CategoryUpdateRequest(BaseModel):
    category: str


def get_profile_service(db: Session = Depends(get_db)) -> ProfileService:
    return ProfileService(db=db)


def _raise_profile_http(err: ProfileError) -> None:
    raise HTTPException(
        status_code=err.status_code,
        detail={"code": err.code, "message": err.message},
    )


@router.get("", response_model=UserProfileDTO)
def get_profile(
    current_user: UserDTO = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    try:
        return service.get_profile(user_id=current_user.id)
    except ProfileError as err:
        _raise_profile_http(err)


@router.get("/status", response_model=CategorizationStatusDTO)
def get_profile_status(
    current_user: UserDTO = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    return service.get_status(user_id=current_user.id)


@router.post("/questionnaire", status_code=status.HTTP_201_CREATED)
def submit_questionnaire(
    payload: QuestionnaireSubmitRequest,
    current_user: UserDTO = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    answers = payload.answers.model_dump(by_alias=False)
    return service.save_questionnaire(user_id=current_user.id, answers=answers)


@router.post("/confirm", response_model=UserProfileDTO)
def confirm_profile(
    payload: ProfileConfirmRequest,
    current_user: UserDTO = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    try:
        return service.confirm_profile(
            user_id=current_user.id,
            income_override=payload.income_override,
            expenses_override=payload.expenses_override,
            income_source_override=payload.income_source_override,
        )
    except ProfileError as err:
        _raise_profile_http(err)


@router.post("/trigger-categorization", status_code=status.HTTP_202_ACCEPTED)
def trigger_categorization(
    background_tasks: BackgroundTasks,
    current_user: UserDTO = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    return service.trigger_categorization_for_user(
        user_id=current_user.id, background_tasks=background_tasks
    )


# ─── Phase 9: Timeline endpoints ──────────────────────────────────────────────


@router.get("/timeline", response_model=list[TimelineEventDTO])
def get_timeline(
    include_dismissed: bool = False,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TimelineEventDTO]:
    events = get_timeline_events(
        db, current_user.id, include_dismissed=include_dismissed
    )
    return [TimelineEventDTO.model_validate(e) for e in events]


@router.post("/timeline/{event_id}/dismiss", status_code=200)
def dismiss_timeline(
    event_id: str,
    body: DismissEventRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    VALID_REASONS = {
        "false_assumption",
        "clerical_error",
        "outdated",
        "duplicate",
        "other",
    }
    if body.reason not in VALID_REASONS:
        raise HTTPException(
            status_code=422, detail=f"reason must be one of {VALID_REASONS}"
        )
    row = dismiss_timeline_event(db, event_id, body.reason, body.detail)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Event not found")
    db.commit()
    return {"dismissed": True}


@router.post("/timeline/{event_id}/context", status_code=202)
def add_timeline_context(
    event_id: str,
    body: AddContextRequest,
    background_tasks: BackgroundTasks,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    from app.ingestion.llm import get_llm_client
    from app.services.moderation_service import ModerationService

    # Check write block (timeout/ban) — D-20
    svc = ModerationService(db, get_llm_client())
    if svc.is_user_write_blocked(current_user.id):
        raise HTTPException(status_code=403, detail="write_blocked")

    row = get_timeline_event(db, event_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Event not found")

    MAX_CONTEXT_LEN = 2000
    if len(body.text) > MAX_CONTEXT_LEN:
        raise HTTPException(
            status_code=422, detail=f"text exceeds {MAX_CONTEXT_LEN} chars"
        )

    # Save raw text immediately, mark pending
    set_timeline_context(db, event_id, body.text)
    db.commit()

    # Run TOS check + distillation asynchronously
    background_tasks.add_task(
        svc.check_timeline_context, current_user.id, event_id, body.text
    )
    return {"accepted": True}


# ─── Phase 9: Uncategorized endpoints ─────────────────────────────────────────


@router.get("/uncategorized", response_model=list[UncategorizedTransactionDTO])
def get_uncategorized(
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UncategorizedTransactionDTO]:
    import re
    from collections import Counter

    from app.db.models import Transaction, Upload

    txns = (
        db.query(Transaction, Upload.original_filename)
        .outerjoin(Upload, Upload.id == Transaction.upload_id)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.category == "uncategorized",
        )
        .all()
    )

    def _normalize(desc: str | None) -> str | None:
        if not desc:
            return None
        # Strip common noise: card numbers, dates inline, reference codes
        s = re.sub(r"\b\d{4,}\b", "", desc)  # long numbers
        s = re.sub(r"\d{2}[/\-\.]\d{2}[/\-\.]\d{2,4}", "", s)  # dates
        s = re.sub(r"\s{2,}", " ", s).strip(" ,-/*")
        return s or desc

    result = []
    for txn, filename in txns:
        result.append(
            UncategorizedTransactionDTO(
                id=txn.id,
                description=txn.description,
                amount=float(txn.amount) if txn.amount else None,
                date=txn.date,
                source_filename=filename,
                type=txn.type,
                counterpart_name=_normalize(txn.description),
            )
        )
    # Sort: frequency-first (same description grouped), then by abs amount
    freq = Counter(r.description for r in result)
    result.sort(key=lambda r: (-freq[r.description], -(abs(r.amount or 0))))
    return result


@router.patch("/transactions/by-description/category", status_code=200)
def bulk_update_category_by_description(
    body: BulkCategoryUpdateRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Categorize ALL uncategorized transactions with a given description at once."""
    from app.db.models import Transaction
    from app.db.repository import write_merchant_map
    from app.services.categorization_service import VALID_CATEGORIES

    if body.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422, detail=f"Invalid category: {body.category}"
        )

    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.category == "uncategorized",
            Transaction.description == body.description,
        )
        .all()
    )
    if not txns:
        raise HTTPException(status_code=404, detail="No matching transactions found")

    for txn in txns:
        txn.category = body.category

    if body.description:
        write_merchant_map(
            db,
            description_raw=body.description,
            category=body.category,
            confidence=1.0,
            learned_method="manual",
            contributing_user_id=current_user.id,
            contributing_upload_id=txns[0].upload_id,
        )

    db.commit()
    return {"updated": len(txns), "category": body.category}


@router.patch("/transactions/{transaction_id}/category", status_code=200)
def update_transaction_category(
    transaction_id: str,
    body: CategoryUpdateRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    from app.db.models import Transaction
    from app.db.repository import write_merchant_map
    from app.services.categorization_service import VALID_CATEGORIES

    if body.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422, detail=f"Invalid category: {body.category}"
        )

    txn = (
        db.query(Transaction)
        .filter(
            Transaction.id == transaction_id,
            Transaction.user_id == current_user.id,
        )
        .first()
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    txn.category = body.category
    # D-09: Write user correction to merchant_map with learned_method="manual"
    if txn.description:
        write_merchant_map(
            db,
            description_raw=txn.description,
            category=body.category,
            confidence=1.0,
            learned_method="manual",
            contributing_user_id=current_user.id,
            contributing_upload_id=txn.upload_id,
        )
    db.commit()
    return {"updated": True, "category": body.category}
