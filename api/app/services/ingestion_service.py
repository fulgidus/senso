"""
IngestionService: orchestrates upload, extraction, confirm, retry, report, delete.
Extraction runs asynchronously (BackgroundTask). Status polled by client.
"""

import io
import logging
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import openpyxl
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
from app.ingestion.ocr import extract_with_pdf_pipeline, extract_with_image_pipeline
from app.ingestion.adaptive import run_adaptive_pipeline
from app.ingestion.registry import get_registry
from app.schemas.ingestion import ExtractionResult, UploadStatusDTO
from app.db.session import SessionLocal

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
            extraction_queued_at=datetime.now(UTC),
            extraction_status="pending",
        )
        self.db.add(upload)
        self.db.commit()

        return {"upload_id": upload_id, "status": "pending"}

    def run_extraction_background(self, upload_id: str, file_bytes: bytes) -> None:
        """Run extraction pipeline. Called as BackgroundTask."""
        import time as _time

        db = SessionLocal()
        try:
            upload = db.query(Upload).filter(Upload.id == upload_id).first()
            if not upload:
                return

            llm_client = get_llm_client()
            registry = get_registry()
            suffix = Path(upload.original_filename).suffix.lower() or ".bin"

            # Write to temp file for module/OCR processing
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = Path(tmp.name)

            background_service = IngestionService(
                db=db,
                settings=self.settings,
                minio_client=self.minio,
            )

            # ── Trace step 1: start ────────────────────────────────────────────
            background_service._record_trace(
                db,
                upload_id,
                step_order=1,
                step_name="start",
                status="success",
                input_summary=f"file: {upload_id}",
                output_summary=f"filename: {upload.original_filename}, size: {len(file_bytes)} bytes",
            )

            try:
                # ── Trace step 2: ocr_extraction ──────────────────────────────
                _start = _time.time()
                try:
                    result = background_service._extract(
                        tmp_path, upload.content_type, llm_client, registry
                    )
                    _duration = int((_time.time() - _start) * 1000)
                    background_service._record_trace(
                        db,
                        upload_id,
                        step_order=2,
                        step_name="ocr_extraction",
                        status="success",
                        input_summary=f"content_type: {upload.content_type}, file_bytes: {len(file_bytes)}",
                        output_summary=f"doc_type: {result.document.document_type}, tier: {result.tier_used}, confidence: {result.confidence:.2f}",
                        duration_ms=_duration,
                    )
                except Exception:
                    _duration = int((_time.time() - _start) * 1000)
                    background_service._record_trace(
                        db,
                        upload_id,
                        step_order=2,
                        step_name="ocr_extraction",
                        status="error",
                        input_summary=f"content_type: {upload.content_type}, file_bytes: {len(file_bytes)}",
                        duration_ms=_duration,
                    )
                    raise

                # ── Trace step 3: module_match ────────────────────────────────
                background_service._record_trace(
                    db,
                    upload_id,
                    step_order=3,
                    step_name="module_match",
                    status="success",
                    input_summary=f"document_type: {result.document.document_type}",
                    output_summary=f"module_name: {result.document.module_name or 'none'}, module_source: {result.document.module_source or 'none'}",
                )

                # ── Trace step 4: llm_call ────────────────────────────────────
                raw_text_snippet = (
                    (result.raw_text or "")[:500] if result.raw_text else None
                )
                background_service._record_trace(
                    db,
                    upload_id,
                    step_order=4,
                    step_name="llm_call",
                    status="success",
                    input_summary=raw_text_snippet,
                    output_summary=f"transactions: {len(result.document.transactions)}, warnings: {len(result.warnings)}",
                )

                # ── Trace step 5: persistence ─────────────────────────────────
                _start = _time.time()
                background_service._persist_extraction(upload, result)
                _duration = int((_time.time() - _start) * 1000)
                background_service._record_trace(
                    db,
                    upload_id,
                    step_order=5,
                    step_name="persistence",
                    status="success",
                    output_summary="saved to DB",
                    duration_ms=_duration,
                )
            except LLMError:
                upload.extraction_status = "provider_outage"
                db.commit()
            except Exception as exc:
                logger.exception("Extraction failed for upload %s: %s", upload_id, exc)
                upload.extraction_status = "failed"
                db.commit()
            finally:
                tmp_path.unlink(missing_ok=True)
        finally:
            db.close()

    def _record_trace(
        self,
        db,
        upload_id: str,
        step_order: int,
        step_name: str,
        *,
        status: str = "success",
        input_summary: str | None = None,
        output_summary: str | None = None,
        raw_input: str | None = None,
        raw_output: str | None = None,
        duration_ms: int | None = None,
    ) -> None:
        """Write a single trace row. Never raises - failures are logged and swallowed."""
        from app.db.models import IngestionTrace  # noqa: PLC0415

        try:
            trace = IngestionTrace(
                upload_id=upload_id,
                step_name=step_name,
                step_order=step_order,
                input_summary=input_summary,
                output_summary=output_summary,
                raw_input=(str(raw_input)[:8000] if raw_input is not None else None),
                raw_output=(str(raw_output)[:8000] if raw_output is not None else None),
                duration_ms=duration_ms,
                status=status,
            )
            db.add(trace)
            db.commit()
        except Exception as exc:
            logger.warning("_record_trace failed: %s", exc)

    def fail_stale_pending_uploads(self, user_id: str | None = None) -> int:
        cutoff = datetime.now(UTC) - timedelta(
            seconds=self.settings.stale_upload_timeout_seconds
        )
        query = self.db.query(Upload).filter(
            Upload.extraction_status == "pending",
            Upload.extraction_queued_at < cutoff,
        )
        if user_id is not None:
            query = query.filter(Upload.user_id == user_id)

        stale_uploads = query.all()
        if not stale_uploads:
            return 0

        for upload in stale_uploads:
            upload.extraction_status = "failed"
            upload.extraction_method = "watchdog:stale_pending"
            upload.module_source = None

        self.db.commit()
        return len(stale_uploads)

    def _extract(
        self, file_path: Path, content_type: str, llm_client: LLMClient, registry
    ) -> ExtractionResult:
        """Route to the appropriate extraction pipeline."""
        suffix = file_path.suffix.lower()

        # xlsx/xls: extract via openpyxl before any content preview
        if suffix in (".xlsx", ".xls"):
            return self._extract_xlsx(file_path)

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
            # Module returned a dict - wrap it
            from app.schemas.ingestion import ExtractedDocument, ExtractionResult as ER

            doc = ExtractedDocument(**raw_result)
            return ER(document=doc, confidence=0.85, tier_used="module")

        # No module matched - route to PDF or image pipeline
        if content_type == PDF_MIME_TYPE:
            return extract_with_pdf_pipeline(file_path, llm_client, registry)

        if content_type in IMAGE_MIME_TYPES:
            return extract_with_image_pipeline(file_path, llm_client, registry)

        # Fallback: adaptive pipeline (e.g. plain text, CSV with no module match)
        return run_adaptive_pipeline(file_path, preview, llm_client, registry)

    def _extract_xlsx(self, file_path: Path) -> ExtractionResult:
        """Extract transactions from xlsx/xls using openpyxl."""
        from app.schemas.ingestion import ExtractedDocument, Transaction

        def _warn(msg: str) -> ExtractionResult:
            return ExtractionResult(
                document=ExtractedDocument(
                    document_type="bank_statement",
                    module_name="GenericXLSX",
                    module_source="builtin",
                    module_version="1.0.0",
                ),
                confidence=0.1,
                tier_used="module",
                warnings=[msg],
            )

        try:
            wb = openpyxl.load_workbook(str(file_path), read_only=True, data_only=True)
            ws = wb.active
            rows = [list(row) for row in ws.iter_rows(values_only=True)]
            wb.close()
        except Exception as exc:
            logger.warning("openpyxl failed on %s: %s", file_path.name, exc)
            return _warn(f"Could not read xlsx file: {exc}")

        if not rows:
            return _warn("Empty xlsx file")

        # Find header row in first 5 rows
        from app.ingestion.modules.builtin.generic_csv import (
            DATE_COLUMNS,
            AMOUNT_COLUMNS,
            DESC_COLUMNS,
            BALANCE_COLUMNS,
            _find_col,
        )
        from decimal import Decimal, InvalidOperation
        from datetime import datetime as _dt

        header_row_idx = 0
        for i, row in enumerate(rows[:5]):
            row_strs = [str(c).lower().strip() if c is not None else "" for c in row]
            combined = " ".join(row_strs)
            if any(cand in combined for cand in DATE_COLUMNS + AMOUNT_COLUMNS):
                header_row_idx = i
                break

        header_row = [str(c) if c is not None else "" for c in rows[header_row_idx]]
        date_col = _find_col(header_row, DATE_COLUMNS)
        amount_col = _find_col(header_row, AMOUNT_COLUMNS)
        desc_col = _find_col(header_row, DESC_COLUMNS)
        balance_col = _find_col(header_row, BALANCE_COLUMNS)

        if date_col is None or amount_col is None:
            return _warn("GenericXLSX: could not detect required date/amount columns")

        transactions = []
        statement_start = None
        statement_end = None

        for row in rows[header_row_idx + 1 :]:
            if not row or all(c is None for c in row):
                continue
            try:
                raw_date = row[date_col] if date_col < len(row) else None
                raw_amount = row[amount_col] if amount_col < len(row) else None
                if raw_date is None or raw_amount is None:
                    continue

                # Date: may already be a date/datetime object from openpyxl
                from datetime import date as _date

                if isinstance(raw_date, (_dt, _date)):
                    parsed_date = (
                        raw_date.date() if isinstance(raw_date, _dt) else raw_date
                    )
                else:
                    date_str = str(raw_date).strip()
                    parsed_date = None
                    for fmt in (
                        "%Y-%m-%d %H:%M:%S",
                        "%Y-%m-%d",
                        "%d/%m/%Y",
                        "%m/%d/%Y",
                        "%d-%m-%Y",
                    ):
                        try:
                            parsed_date = _dt.strptime(
                                date_str.split(".")[0].strip(), fmt
                            ).date()
                            break
                        except ValueError:
                            continue
                    if parsed_date is None:
                        continue

                # Amount
                amount_str = (
                    str(raw_amount)
                    .strip()
                    .replace(",", ".")
                    .replace(" ", "")
                    .replace("€", "")
                    .replace("$", "")
                )
                amount = Decimal(amount_str).quantize(Decimal("0.0001"))
                desc = (
                    str(row[desc_col]).strip()
                    if desc_col is not None
                    and desc_col < len(row)
                    and row[desc_col] is not None
                    else ""
                )

                balance_after = None
                if (
                    balance_col is not None
                    and balance_col < len(row)
                    and row[balance_col] is not None
                ):
                    try:
                        balance_after = Decimal(
                            str(row[balance_col]).strip().replace(",", ".")
                        ).quantize(Decimal("0.0001"))
                    except InvalidOperation:
                        pass

                if statement_start is None or parsed_date < statement_start:
                    statement_start = parsed_date
                if statement_end is None or parsed_date > statement_end:
                    statement_end = parsed_date

                transactions.append(
                    Transaction(
                        date=parsed_date,
                        description=desc,
                        amount=amount,
                        currency="EUR",
                        balance_after=balance_after,
                    )
                )
            except (InvalidOperation, IndexError, ValueError, TypeError):
                continue

        return ExtractionResult(
            document=ExtractedDocument(
                document_type="bank_statement",
                module_name="GenericXLSX",
                module_source="builtin",
                module_version="1.0.0",
                transactions=transactions,
                statement_period_start=statement_start,
                statement_period_end=statement_end,
            ),
            confidence=0.5 if transactions else 0.1,
            tier_used="module",
            warnings=[] if transactions else ["GenericXLSX: no transactions extracted"],
        )

    def _persist_extraction(self, upload: Upload, result: ExtractionResult) -> None:
        """Persist extraction result; write Transaction rows atomically for bank_statement (D-28)."""
        doc = result.document

        # Determine extraction method string
        if result.tier_used in (
            "module",
            "pdf_text_layer_module",
            "pdf_adaptive_module",
            "image_ocr_module",
        ):
            method = f"module:{doc.module_name or 'unknown'}"
        elif result.tier_used == "adaptive":
            method = f"adaptive:{doc.module_name or 'generated'}"
        else:
            method = result.tier_used

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
        self.fail_stale_pending_uploads(user_id=user_id)
        uploads = (
            self.db.query(Upload)
            .filter(Upload.user_id == user_id)
            .order_by(Upload.uploaded_at.desc())
            .all()
        )
        return [self._to_dto(u) for u in uploads]

    def get_upload(self, user_id: str, upload_id: str) -> UploadStatusDTO:
        self.fail_stale_pending_uploads(user_id=user_id)
        upload = self._get_upload_for_user(user_id, upload_id)
        return self._to_dto(upload)

    def get_extracted(self, user_id: str, upload_id: str) -> dict:
        self.fail_stale_pending_uploads(user_id=user_id)
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

    def confirm_all_uploads(self, user_id: str) -> dict:
        """Confirm all uploads in success state for a user. Returns count confirmed."""
        uploads = (
            self.db.query(Upload)
            .filter(
                Upload.user_id == user_id,
                Upload.extraction_status == "success",
                Upload.confirmed == False,  # noqa: E712
            )
            .all()
        )
        for upload in uploads:
            upload.confirmed = True
        self.db.commit()
        return {"confirmed_count": len(uploads)}

    def retry_upload(self, user_id: str, upload_id: str, hint: str | None) -> dict:
        upload = self._get_upload_for_user(user_id, upload_id)

        safe_hint: str | None = None
        if hint:
            llm_client = get_llm_client()
            guardrail_result = check_hint_safety(hint, llm_client)
            if guardrail_result["safe"]:
                safe_hint = hint
            # If unsafe, hint is silently dropped (D-32)

        if upload.extracted_document is not None:
            self.db.delete(upload.extracted_document)
        for txn in list(upload.transactions):
            self.db.delete(txn)

        upload.confirmed = False
        upload.extraction_status = "pending"
        upload.extraction_method = None
        upload.module_source = None
        upload.extraction_queued_at = datetime.now(UTC)
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
