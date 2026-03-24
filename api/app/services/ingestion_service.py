"""
IngestionService: orchestrates upload, extraction, confirm, retry, report, delete.
Extraction runs asynchronously (BackgroundTask). Status polled by client.
"""

import io
import logging
import tempfile
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.models import (
    ExtractedDocument as ExtractedDocumentModel,
    ExtractionReport,
    Transaction as TransactionModel,
    Upload,
)
from app.ingestion.guardrail import check_hint_safety
from app.ingestion.llm import LLMClient, LLMError, get_llm_client
from app.ingestion.ocr import extract_with_ocr_pipeline
from app.ingestion.adaptive import run_adaptive_pipeline
from app.ingestion.registry import get_registry
from app.schemas.ingestion import ExtractionResult, UploadStatusDTO

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB

IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/tiff",
    "image/bmp",
    "image/webp",
}
PDF_MIME_TYPE = "application/pdf"


class IngestionError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class IngestionService:
    def __init__(self, db: Session, settings: Settings, minio_client) -> None:
        self.db = db
        self.settings = settings
        self.minio = minio_client

    def upload_file(
        self, user_id: str, filename: str, content_type: str, file_bytes: bytes
    ) -> dict:
        """Store file in MinIO, create Upload row with status=pending."""
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise IngestionError(
                "file_too_large", "File exceeds 20 MB limit", status_code=413
            )

        upload_id = str(uuid4())
        minio_key = f"{user_id}/{upload_id}/{filename}"

        # Upload to MinIO
        self.minio.put_object(
            self.settings.minio_bucket,
            minio_key,
            io.BytesIO(file_bytes),
            length=len(file_bytes),
            content_type=content_type,
        )

        # Persist to Postgres after successful MinIO put (D-03)
        upload = Upload(
            id=upload_id,
            user_id=user_id,
            original_filename=filename,
            minio_bucket=self.settings.minio_bucket,
            minio_key=minio_key,
            content_type=content_type,
            size_bytes=len(file_bytes),
            extraction_status="pending",
        )
        self.db.add(upload)
        self.db.commit()

        return {"upload_id": upload_id, "status": "pending"}

    def run_extraction_background(self, upload_id: str, file_bytes: bytes) -> None:
        """Run extraction pipeline. Called as BackgroundTask."""
        upload = self.db.query(Upload).filter(Upload.id == upload_id).first()
        if not upload:
            return

        llm_client = get_llm_client()
        registry = get_registry()
        suffix = Path(upload.original_filename).suffix.lower() or ".bin"

        # Write to temp file for module/OCR processing
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = Path(tmp.name)

        try:
            result = self._extract(tmp_path, upload.content_type, llm_client, registry)
            self._persist_extraction(upload, result)
        except LLMError:
            upload.extraction_status = "provider_outage"
            self.db.commit()
        except Exception as exc:
            logger.exception("Extraction failed for upload %s: %s", upload_id, exc)
            upload.extraction_status = "failed"
            self.db.commit()
        finally:
            tmp_path.unlink(missing_ok=True)

    def _extract(
        self, file_path: Path, content_type: str, llm_client: LLMClient, registry
    ) -> ExtractionResult:
        """Route to the appropriate extraction pipeline."""
        # Read content preview for module matching
        try:
            preview = file_path.read_bytes()[:4096].decode("utf-8", errors="ignore")
        except Exception:
            preview = ""

        module_entry = registry.match(file_path, preview)
        if module_entry:
            raw_result = module_entry.extract_fn(file_path)
            if isinstance(raw_result, ExtractionResult):
                return raw_result
            # Module returned a dict — wrap it
            from app.schemas.ingestion import ExtractedDocument, ExtractionResult as ER

            doc = ExtractedDocument(**raw_result)
            return ER(document=doc, confidence=0.85, tier_used="module")

        # No module matched — check if image/PDF → OCR pipeline
        if content_type in IMAGE_MIME_TYPES or content_type == PDF_MIME_TYPE:
            return extract_with_ocr_pipeline(file_path, llm_client)

        # Fallback: adaptive pipeline
        return run_adaptive_pipeline(file_path, preview, llm_client, registry)

    def _persist_extraction(self, upload: Upload, result: ExtractionResult) -> None:
        """Persist extraction result; write Transaction rows atomically for bank_statement (D-28)."""
        doc = result.document

        # Determine extraction method string
        if result.tier_used == "module":
            method = f"module:{doc.module_name or 'unknown'}"
        elif result.tier_used == "adaptive":
            method = f"adaptive:{doc.module_name or 'generated'}"
        else:
            method = result.tier_used  # "ocr_text" | "llm_text" | "llm_vision"

        upload.extraction_status = "success"
        upload.extraction_method = method
        upload.module_source = doc.module_source

        extracted = ExtractedDocumentModel(
            upload_id=upload.id,
            document_type=doc.document_type,
            module_name=doc.module_name,
            module_version=doc.module_version,
            confidence=result.confidence,
            raw_text=result.raw_text,
            payload_json=doc.model_dump(mode="json"),
        )
        self.db.add(extracted)

        # Write transactions only for bank_statement (D-28)
        if doc.document_type == "bank_statement":
            for txn in doc.transactions:
                t_type = "income" if txn.amount > 0 else "expense"
                row = TransactionModel(
                    user_id=upload.user_id,
                    upload_id=upload.id,
                    date=txn.date,
                    amount=txn.amount,
                    currency=txn.currency,
                    description=txn.description,
                    type=t_type,
                    source_module=doc.module_name,
                )
                self.db.add(row)

        self.db.commit()

    def list_uploads(self, user_id: str) -> list[UploadStatusDTO]:
        uploads = (
            self.db.query(Upload)
            .filter(Upload.user_id == user_id)
            .order_by(Upload.uploaded_at.desc())
            .all()
        )
        return [self._to_dto(u) for u in uploads]

    def get_upload(self, user_id: str, upload_id: str) -> UploadStatusDTO:
        upload = self._get_upload_for_user(user_id, upload_id)
        return self._to_dto(upload)

    def get_extracted(self, user_id: str, upload_id: str) -> dict:
        self._get_upload_for_user(user_id, upload_id)
        extracted = (
            self.db.query(ExtractedDocumentModel)
            .filter(ExtractedDocumentModel.upload_id == upload_id)
            .first()
        )
        if not extracted:
            raise IngestionError(
                "not_extracted", "Extraction not complete", status_code=404
            )
        return extracted.payload_json

    def confirm_upload(self, user_id: str, upload_id: str) -> dict:
        upload = self._get_upload_for_user(user_id, upload_id)
        if upload.extraction_status != "success":
            raise IngestionError(
                "cannot_confirm",
                "Cannot confirm upload with non-success extraction status",
                status_code=400,
            )
        upload.confirmed = True
        self.db.commit()
        return {"confirmed": True}

    def retry_upload(self, user_id: str, upload_id: str, hint: str | None) -> dict:
        upload = self._get_upload_for_user(user_id, upload_id)
        llm_client = get_llm_client()

        safe_hint: str | None = None
        if hint:
            guardrail_result = check_hint_safety(hint, llm_client)
            if guardrail_result["safe"]:
                safe_hint = hint
            # If unsafe, hint is silently dropped (D-32)

        upload.extraction_status = "pending"
        self.db.commit()

        return {"status": "retrying", "hint_used": safe_hint is not None}

    def report_upload(self, user_id: str, upload_id: str, note: str | None) -> dict:
        upload = self._get_upload_for_user(user_id, upload_id)
        report = ExtractionReport(
            upload_id=upload.id,
            user_note=note,
        )
        self.db.add(report)
        upload.report_flagged = True
        self.db.commit()
        return {"reported": True}

    def delete_upload(self, user_id: str, upload_id: str) -> None:
        upload = self._get_upload_for_user(user_id, upload_id)
        # Remove from MinIO
        try:
            self.minio.remove_object(upload.minio_bucket, upload.minio_key)
        except Exception as exc:
            logger.warning("MinIO delete failed for %s: %s", upload_id, exc)

        # Delete Postgres rows (cascade handles extracted_documents, transactions, reports)
        self.db.delete(upload)
        self.db.commit()

    def _get_upload_for_user(self, user_id: str, upload_id: str) -> Upload:
        upload = (
            self.db.query(Upload)
            .filter(Upload.id == upload_id, Upload.user_id == user_id)
            .first()
        )
        if not upload:
            raise IngestionError("not_found", "Upload not found", status_code=404)
        return upload

    def _download_from_minio(self, upload: Upload) -> bytes:
        response = self.minio.get_object(upload.minio_bucket, upload.minio_key)
        return response.read()

    def _to_dto(self, upload: Upload) -> UploadStatusDTO:
        return UploadStatusDTO(
            id=upload.id,
            originalFilename=upload.original_filename,
            contentType=upload.content_type,
            sizeBytes=upload.size_bytes,
            uploadedAt=upload.uploaded_at.isoformat(),
            extractionStatus=upload.extraction_status,
            extractionMethod=upload.extraction_method,
            moduleSource=upload.module_source,
            confirmed=upload.confirmed,
            reportFlagged=upload.report_flagged,
        )
