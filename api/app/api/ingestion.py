"""
Ingestion API: upload, status, confirm, retry, report, delete endpoints.
All endpoints require Authorization: Bearer <accessToken>.
"""

from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    HTTPException,
    UploadFile,
    File,
    status,
)
from sqlalchemy.orm import Session

from app.core.config import get_settings, Settings
from app.db.session import get_db
from app.schemas.ingestion import RetryRequest, ReportRequest, UploadStatusDTO
from app.schemas.auth import UserDTO
from app.services.ingestion_service import IngestionService, IngestionError
from app.api.auth import get_auth_service
from app.services.auth_service import AuthError

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


def get_minio_client(settings: Settings = Depends(get_settings)):
    from minio import Minio
    from urllib.parse import urlparse

    parsed = urlparse(settings.minio_endpoint)
    host = parsed.netloc or parsed.path
    secure = parsed.scheme == "https"
    return Minio(
        host,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=secure,
    )


def get_ingestion_service(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    minio_client=Depends(get_minio_client),
) -> IngestionService:
    return IngestionService(db=db, settings=settings, minio_client=minio_client)


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    auth_service=Depends(get_auth_service),
) -> UserDTO:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token"
        )
    token = authorization.split(" ", 1)[1]
    try:
        return auth_service.get_current_user(access_token=token)
    except AuthError as err:
        raise HTTPException(
            status_code=err.status_code,
            detail={"code": err.code, "message": err.message},
        )


def _raise_ingestion_http(err: IngestionError) -> None:
    raise HTTPException(
        status_code=err.status_code, detail={"code": err.code, "message": err.message}
    )


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: UserDTO = Depends(get_current_user),
    service: IngestionService = Depends(get_ingestion_service),
):
    file_bytes = await file.read()
    try:
        result = service.upload_file(
            user_id=current_user.id,
            filename=file.filename or "upload",
            content_type=file.content_type or "application/octet-stream",
            file_bytes=file_bytes,
        )
        # Queue extraction as background task
        background_tasks.add_task(
            service.run_extraction_background,
            upload_id=result["upload_id"],
            file_bytes=file_bytes,
        )
        return result
    except IngestionError as err:
        _raise_ingestion_http(err)


@router.get("/uploads", response_model=list[UploadStatusDTO])
def list_uploads(
    current_user: UserDTO = Depends(get_current_user),
    service: IngestionService = Depends(get_ingestion_service),
):
    return service.list_uploads(user_id=current_user.id)


@router.get("/uploads/{upload_id}", response_model=UploadStatusDTO)
def get_upload(
    upload_id: str,
    current_user: UserDTO = Depends(get_current_user),
    service: IngestionService = Depends(get_ingestion_service),
):
    try:
        return service.get_upload(user_id=current_user.id, upload_id=upload_id)
    except IngestionError as err:
        _raise_ingestion_http(err)


@router.get("/uploads/{upload_id}/extracted")
def get_extracted(
    upload_id: str,
    current_user: UserDTO = Depends(get_current_user),
    service: IngestionService = Depends(get_ingestion_service),
):
    try:
        return service.get_extracted(user_id=current_user.id, upload_id=upload_id)
    except IngestionError as err:
        _raise_ingestion_http(err)


@router.post("/uploads/{upload_id}/confirm")
def confirm_upload(
    upload_id: str,
    current_user: UserDTO = Depends(get_current_user),
    service: IngestionService = Depends(get_ingestion_service),
):
    try:
        return service.confirm_upload(user_id=current_user.id, upload_id=upload_id)
    except IngestionError as err:
        _raise_ingestion_http(err)


@router.post("/uploads/{upload_id}/retry", status_code=status.HTTP_202_ACCEPTED)
def retry_upload(
    upload_id: str,
    payload: RetryRequest,
    background_tasks: BackgroundTasks,
    current_user: UserDTO = Depends(get_current_user),
    service: IngestionService = Depends(get_ingestion_service),
):
    try:
        result = service.retry_upload(
            user_id=current_user.id, upload_id=upload_id, hint=payload.hint
        )
        # Re-queue background extraction after resetting status
        upload = service._get_upload_for_user(current_user.id, upload_id)
        file_bytes = service._download_from_minio(upload)
        background_tasks.add_task(
            service.run_extraction_background,
            upload_id=upload_id,
            file_bytes=file_bytes,
        )
        return result
    except IngestionError as err:
        _raise_ingestion_http(err)


@router.post("/uploads/{upload_id}/report", status_code=status.HTTP_201_CREATED)
def report_upload(
    upload_id: str,
    payload: ReportRequest,
    current_user: UserDTO = Depends(get_current_user),
    service: IngestionService = Depends(get_ingestion_service),
):
    try:
        return service.report_upload(
            user_id=current_user.id, upload_id=upload_id, note=payload.note
        )
    except IngestionError as err:
        _raise_ingestion_http(err)


@router.delete("/uploads/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_upload(
    upload_id: str,
    current_user: UserDTO = Depends(get_current_user),
    service: IngestionService = Depends(get_ingestion_service),
):
    try:
        service.delete_upload(user_id=current_user.id, upload_id=upload_id)
    except IngestionError as err:
        _raise_ingestion_http(err)
