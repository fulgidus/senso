"""
Attachments API — Phase 15

Endpoint:
  POST /attachments/upload — upload encrypted attachment ciphertext to MinIO.

This endpoint is intentionally dumb: it stores whatever bytes it receives.
The client is responsible for encrypting before upload and decrypting after download.
Server never sees plaintext attachment content.
"""
from __future__ import annotations

import io
import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.api.ingestion import get_current_user, get_minio_client
from app.schemas.auth import UserDTO

logger = logging.getLogger(__name__)
attachments_router = APIRouter(tags=["attachments"])

ATTACHMENTS_BUCKET = "attachments"
MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024  # 50 MiB hard limit


class AttachmentUploadResponse(BaseModel):
    attachment_id: str
    s3_addr: str           # s3://attachments/<attachment_id>
    size_bytes: int


@attachments_router.post("/upload", response_model=AttachmentUploadResponse)
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: UserDTO = Depends(get_current_user),
    minio=Depends(get_minio_client),
) -> AttachmentUploadResponse:
    """Upload an encrypted attachment ciphertext to MinIO.

    The client MUST encrypt the file before uploading. This endpoint stores
    raw bytes without inspection — server is zero-knowledge about content.

    Returns:
        s3_addr: s3://attachments/<attachment_id> — embed in message frontmatter.
    """
    contents = await file.read()
    if len(contents) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Attachment exceeds {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MiB limit.",
        )

    attachment_id = str(uuid.uuid4())
    object_name = f"{current_user.id}/{attachment_id}"

    # Ensure bucket exists
    try:
        if not minio.bucket_exists(ATTACHMENTS_BUCKET):
            minio.make_bucket(ATTACHMENTS_BUCKET)
    except Exception as exc:
        logger.error("MinIO bucket check failed: %s", exc)
        raise HTTPException(status_code=503, detail="Storage unavailable.") from exc

    minio.put_object(
        ATTACHMENTS_BUCKET,
        object_name,
        io.BytesIO(contents),
        length=len(contents),
        content_type="application/octet-stream",
    )

    s3_addr = f"s3://{ATTACHMENTS_BUCKET}/{object_name}"
    logger.info(
        "Attachment %s uploaded by %s (%d bytes)",
        attachment_id,
        current_user.username,
        len(contents),
    )

    return AttachmentUploadResponse(
        attachment_id=attachment_id,
        s3_addr=s3_addr,
        size_bytes=len(contents),
    )
