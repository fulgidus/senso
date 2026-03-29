from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

from app.core.config import get_settings
from app.db.models import ExtractedDocument, Transaction, Upload, User
from app.db.session import SessionLocal
from app.services.ingestion_service import IngestionService


def _make_user(db, user_id: str = "user-1") -> User:
    user = User(
        id=user_id,
        email=f"{user_id}@example.com",
        password_hash="hashed",
    )
    db.add(user)
    db.commit()
    return user


def _make_upload(
    db,
    *,
    user_id: str,
    upload_id: str,
    status: str = "pending",
    queued_at: datetime | None = None,
) -> Upload:
    upload = Upload(
        id=upload_id,
        user_id=user_id,
        original_filename="statement.csv",
        minio_bucket="bucket",
        minio_key=f"{user_id}/{upload_id}/statement.csv",
        content_type="text/csv",
        size_bytes=32,
        extraction_status=status,
        extraction_queued_at=queued_at or datetime.now(UTC),
    )
    db.add(upload)
    db.commit()
    return upload


def test_run_extraction_background_uses_fresh_db_session(monkeypatch):
    primary_db = SessionLocal()
    background_db = SessionLocal()
    try:
        _make_user(primary_db, user_id="fresh-session-user")
        _make_upload(
            primary_db,
            user_id="fresh-session-user",
            upload_id="fresh-session-upload",
        )

        service = IngestionService(
            db=primary_db,
            settings=get_settings(),
            minio_client=MagicMock(),
        )

        session_calls: list[object] = []

        def fake_session_local():
            session_calls.append(background_db)
            return background_db

        def fake_extract(*args, **kwargs):
            from app.schemas.ingestion import ExtractedDocument, ExtractionResult

            return ExtractionResult(
                document=ExtractedDocument(document_type="bank_statement"),
                confidence=0.5,
                tier_used="module",
            )

        def fake_persist(self, upload, result):
            assert self.db is background_db
            assert self.db is not primary_db
            upload.extraction_status = "success"
            self.db.commit()

        monkeypatch.setattr(
            "app.services.ingestion_service.SessionLocal", fake_session_local
        )
        monkeypatch.setattr(
            "app.services.ingestion_service.get_llm_client", lambda: MagicMock()
        )
        monkeypatch.setattr(
            "app.services.ingestion_service.get_registry", lambda: MagicMock()
        )
        monkeypatch.setattr(IngestionService, "_extract", fake_extract)
        monkeypatch.setattr(IngestionService, "_persist_extraction", fake_persist)

        service.run_extraction_background("fresh-session-upload", b"date,amount\n")

        assert session_calls == [background_db]
        refreshed = (
            primary_db.query(Upload).filter(Upload.id == "fresh-session-upload").first()
        )
        primary_db.refresh(refreshed)
        assert refreshed.extraction_status == "success"
    finally:
        background_db.close()
        primary_db.close()


def test_fail_stale_pending_uploads_marks_only_expired_pending_rows():
    db = SessionLocal()
    try:
        settings = get_settings()
        _make_user(db, user_id="watchdog-user")
        stale_cutoff = datetime.now(UTC) - timedelta(
            seconds=settings.stale_upload_timeout_seconds + 5
        )
        fresh_cutoff = datetime.now(UTC) - timedelta(seconds=5)

        stale = _make_upload(
            db,
            user_id="watchdog-user",
            upload_id="stale-upload",
            queued_at=stale_cutoff,
        )
        fresh = _make_upload(
            db,
            user_id="watchdog-user",
            upload_id="fresh-upload",
            queued_at=fresh_cutoff,
        )
        done = _make_upload(
            db,
            user_id="watchdog-user",
            upload_id="done-upload",
            status="success",
            queued_at=stale_cutoff,
        )

        service = IngestionService(db=db, settings=settings, minio_client=MagicMock())

        transitioned = service.fail_stale_pending_uploads(user_id="watchdog-user")

        assert transitioned == 1
        db.refresh(stale)
        db.refresh(fresh)
        db.refresh(done)
        assert stale.extraction_status == "failed"
        assert stale.extraction_method == "watchdog:stale_pending"
        assert fresh.extraction_status == "pending"
        assert done.extraction_status == "success"
    finally:
        db.close()


def test_retry_upload_resets_queue_state_and_clears_previous_extraction(monkeypatch):
    db = SessionLocal()
    try:
        settings = get_settings()
        user = _make_user(db, user_id="retry-user")
        upload = _make_upload(
            db,
            user_id=user.id,
            upload_id="retry-upload",
            status="success",
        )
        queued_before_retry = upload.extraction_queued_at

        db.add(
            ExtractedDocument(
                upload_id=upload.id,
                document_type="bank_statement",
                module_name="GenericCSV",
                module_version="1.0.0",
                confidence=0.9,
                payload_json={"document_type": "bank_statement"},
            )
        )
        db.add(
            Transaction(
                user_id=user.id,
                upload_id=upload.id,
                date=datetime.now(UTC).date(),
                amount=Decimal("-12.50"),
                currency="EUR",
                description="Coffee",
                type="expense",
            )
        )
        db.commit()

        service = IngestionService(db=db, settings=settings, minio_client=MagicMock())

        monkeypatch.setattr(
            "app.services.ingestion_service.get_llm_client", lambda: MagicMock()
        )

        result = service.retry_upload(user_id=user.id, upload_id=upload.id, hint=None)

        assert result == {"status": "retrying", "hint_used": False}
        db.refresh(upload)
        assert upload.extraction_status == "pending"
        assert upload.extraction_method is None
        assert upload.module_source is None
        assert upload.confirmed is False
        assert upload.extraction_queued_at >= queued_before_retry
        assert (
            db.query(ExtractedDocument)
            .filter(ExtractedDocument.upload_id == upload.id)
            .count()
            == 0
        )
        assert (
            db.query(Transaction).filter(Transaction.upload_id == upload.id).count()
            == 0
        )
    finally:
        db.close()
