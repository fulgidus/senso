"""
Profile API: get profile, status polling, questionnaire, confirm.
All endpoints require Authorization: Bearer <accessToken>.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.ingestion import get_current_user
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
