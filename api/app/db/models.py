from datetime import UTC, datetime
from decimal import Decimal

import uuid_utils as uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship, Session
from sqlalchemy import event

Base = declarative_base()


def _uuid7() -> str:
    return str(uuid.uuid7())


class User(Base):
    __tablename__ = "users"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    email: str = Column(String(255), unique=True, nullable=False, index=True)
    password_hash: str = Column(String(255), nullable=False)
    first_name: str | None = Column(String(100), nullable=True, default=None)
    last_name: str | None = Column(String(100), nullable=True, default=None)
    # Voice gender preference: "masculine" | "feminine" | "neutral" | "indifferent"
    # "indifferent" means "use the persona's default"
    voice_gender: str = Column(String(16), nullable=False, default="indifferent")
    # Auto-listen after TTS reply in voice mode: re-opens mic automatically
    voice_auto_listen: bool = Column(Boolean, nullable=False, default=False)
    is_admin: bool = Column(Boolean, nullable=False, default=False)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    chat_sessions_participated = relationship(
        "SessionParticipant",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    refresh_sessions = relationship(
        "RefreshSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    uploads = relationship(
        "Upload",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    profile = relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    categorization_job = relationship(
        "CategorizationJob",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    user_id: str = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_jti: str = Column(String(36), unique=True, nullable=False, index=True)
    expires_at: datetime = Column(DateTime(timezone=True), nullable=False)
    revoked_at: datetime | None = Column(
        DateTime(timezone=True), nullable=True, default=None
    )

    user = relationship("User", back_populates="refresh_sessions")


class Upload(Base):
    __tablename__ = "uploads"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    user_id: str = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_filename: str = Column(String(512), nullable=False)
    minio_bucket: str = Column(String(255), nullable=False)
    minio_key: str = Column(String(1024), nullable=False)
    content_type: str = Column(String(128), nullable=False)
    size_bytes: int = Column(Integer, nullable=False)
    uploaded_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    extraction_status: str = Column(String(32), nullable=False, default="pending")
    extraction_method: str | None = Column(String(256), nullable=True, default=None)
    module_source: str | None = Column(String(32), nullable=True, default=None)
    confirmed: bool = Column(Boolean, nullable=False, default=False)
    report_flagged: bool = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="uploads")
    extracted_document = relationship(
        "ExtractedDocument",
        back_populates="upload",
        uselist=False,
        cascade="all, delete-orphan",
    )
    transactions = relationship(
        "Transaction",
        back_populates="upload",
        cascade="all, delete-orphan",
    )
    extraction_reports = relationship(
        "ExtractionReport",
        back_populates="upload",
        cascade="all, delete-orphan",
    )


class ExtractedDocument(Base):
    __tablename__ = "extracted_documents"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    upload_id: str = Column(
        String(36),
        ForeignKey("uploads.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    document_type: str = Column(String(64), nullable=False)
    module_name: str | None = Column(String(128), nullable=True)
    module_version: str | None = Column(String(32), nullable=True)
    confidence: float = Column(Float, nullable=False, default=0.0)
    raw_text: str | None = Column(Text, nullable=True)
    payload_json: dict = Column(JSON, nullable=False)
    extracted_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    upload = relationship("Upload", back_populates="extracted_document")


class Transaction(Base):
    __tablename__ = "transactions"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    user_id: str = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    upload_id: str = Column(
        String(36),
        ForeignKey("uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date = Column(Date, nullable=False)
    amount: Decimal = Column(Numeric(12, 4), nullable=False)
    currency: str = Column(String(3), nullable=False, default="EUR")
    description: str = Column(String(1024), nullable=False, default="")
    category: str | None = Column(String(128), nullable=True, default=None)
    tags: list = Column(JSON, nullable=False, default=list)
    type: str = Column(String(16), nullable=False)  # "income" | "expense" | "transfer"
    source_module: str | None = Column(String(128), nullable=True, default=None)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    upload = relationship("Upload", back_populates="transactions")


class ExtractionReport(Base):
    __tablename__ = "extraction_reports"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    upload_id: str = Column(
        String(36),
        ForeignKey("uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reported_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    user_note: str | None = Column(Text, nullable=True, default=None)

    upload = relationship("Upload", back_populates="extraction_reports")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    user_id: str = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    income_summary: dict = Column(JSON, nullable=False, default=dict)
    monthly_expenses: float = Column(Float, nullable=True, default=None)
    monthly_margin: float = Column(Float, nullable=True, default=None)
    category_totals: dict = Column(JSON, nullable=False, default=dict)
    insight_cards: list = Column(JSON, nullable=False, default=list)
    coaching_insights: list = Column(JSON, nullable=False, default=list)
    questionnaire_answers: dict = Column(JSON, nullable=True, default=None)
    data_sources: list = Column(JSON, nullable=False, default=list)
    extraordinary_income_total: float = Column(Float, nullable=True, default=None)
    months_covered: float = Column(Float, nullable=True, default=None)
    # SHA-256 hex of sorted confirmed upload IDs at the time of last categorization run.
    # Compare against current confirmed upload IDs to know if profile is stale.
    uploads_fingerprint: str | None = Column(String(64), nullable=True, default=None)
    confirmed: bool = Column(Boolean, nullable=False, default=False)
    profile_generated_at: datetime = Column(
        DateTime(timezone=True), nullable=True, default=None
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    user = relationship("User", back_populates="profile")


class CategorizationJob(Base):
    __tablename__ = "categorization_jobs"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    user_id: str = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    status: str = Column(String(32), nullable=False, default="queued")
    # "queued" | "categorizing" | "generating_insights" | "complete" | "failed"
    error_message: str | None = Column(Text, nullable=True, default=None)
    # Granular per-file progress, updated during run. Shape:
    # {
    #   "files": [{"id": str, "name": str, "status": "pending"|"processing"|"done", "txn_count": int}],
    #   "txn_total": int, "txn_categorised": int, "current_step_detail": str
    # }
    progress_detail: dict | None = Column(JSON, nullable=True, default=None)
    started_at: datetime | None = Column(
        DateTime(timezone=True), nullable=True, default=None
    )
    completed_at: datetime | None = Column(
        DateTime(timezone=True), nullable=True, default=None
    )
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    user = relationship("User", back_populates="categorization_job")


class TagVocabulary(Base):
    __tablename__ = "tag_vocabulary"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    tag: str = Column(String(64), unique=True, nullable=False, index=True)
    description: str | None = Column(String(255), nullable=True, default=None)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    # owner_id: current session owner. Cascade-deletes the session when the owner
    # deletes their account. Transfer ownership via PATCH before account deletion
    # if you want the session to survive.
    owner_id: str = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: str | None = Column(String(120), nullable=True, default=None)
    persona_id: str = Column(String(64), default="mentore-saggio", nullable=False)
    locale: str = Column(String(2), default="it", nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    owner = relationship("User", foreign_keys=[owner_id])
    participants = relationship(
        "SessionParticipant",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        order_by="ChatMessage.created_at",
        cascade="all, delete-orphan",
    )


class SessionParticipant(Base):
    """Many-to-many between Users and ChatSessions with per-participant permissions."""

    __tablename__ = "session_participants"
    __table_args__ = (
        UniqueConstraint("session_id", "participant_id", name="uq_session_participant"),
    )

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    session_id: str = Column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    participant_id: str = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_session_admin: bool = Column(Boolean, nullable=False, default=False)
    can_talk: bool = Column(Boolean, nullable=False, default=True)
    can_invite_participants: bool = Column(Boolean, nullable=False, default=False)
    can_share: bool = Column(Boolean, nullable=False, default=False)
    joined_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    session = relationship("ChatSession", back_populates="participants")
    user = relationship("User", back_populates="chat_sessions_participated")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    session_id: str = Column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # For role=="user": the user who sent the message.
    # For role=="assistant": NULL (persona_id identifies the speaker).
    sender_id: str | None = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # For role=="assistant": which persona was speaking (for name/avatar in history).
    # For role=="user": NULL.
    persona_id: str | None = Column(String(64), nullable=True, default=None)
    role: str = Column(String(16), nullable=False)  # "user" | "assistant"
    content: str = Column(Text, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    session = relationship("ChatSession", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    audio_cache = relationship(
        "AudioCache",
        back_populates="message",
        cascade="all, delete-orphan",
    )


class AudioCache(Base):
    """Tracks TTS audio files stored in MinIO.

    Deletion of a row triggers a best-effort MinIO object delete.
    On failure the object key is recorded in orphaned_s3_objects for cleanup.
    """

    __tablename__ = "audio_cache"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    message_id: str = Column(
        String(36),
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    minio_bucket: str = Column(String(255), nullable=False)
    minio_key: str = Column(String(1024), nullable=False)  # e.g. tts-audio/<sha256>.mp3
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    message = relationship("ChatMessage", back_populates="audio_cache")


class OrphanedS3Object(Base):
    """Records S3 objects that failed to delete when their DB row was removed.

    A periodic cleanup job should iterate this table, attempt deletion,
    and remove the row on success.
    """

    __tablename__ = "orphaned_s3_objects"

    id: str = Column(String(36), primary_key=True, default=_uuid7)
    minio_bucket: str = Column(String(255), nullable=False)
    minio_key: str = Column(String(1024), nullable=False)
    reason: str | None = Column(Text, nullable=True)  # why deletion originally failed
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


class WelcomeCache(Base):
    __tablename__ = "welcome_cache"

    # "SHA3:" (5 chars) + sha3_256 hex (64 chars) = 69 chars — use 72 for headroom
    cache_key: str = Column(String(72), primary_key=True)
    text: str = Column(Text, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


# ── SQLAlchemy event: delete AudioCache row → remove MinIO object ─────────────


def _audio_cache_after_delete(mapper, connection, target: AudioCache) -> None:
    """Best-effort MinIO delete when an AudioCache row is deleted.

    Uses a raw connection to avoid nested session issues.
    Logs a warning and inserts an OrphanedS3Object row on failure.
    """
    import logging

    log = logging.getLogger(__name__)

    # Lazy import to avoid circular deps; minio client requires settings.
    try:
        from app.core.config import get_settings
        from minio import Minio
        from minio.error import S3Error

        settings = get_settings()
        endpoint = settings.minio_endpoint.replace("http://", "").replace(
            "https://", ""
        )
        secure = settings.minio_endpoint.startswith("https://")
        client = Minio(
            endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=secure,
        )
        client.remove_object(target.minio_bucket, target.minio_key)
        log.debug(
            "AudioCache: deleted s3://%s/%s", target.minio_bucket, target.minio_key
        )
    except Exception as exc:
        log.warning(
            "AudioCache: failed to delete s3://%s/%s — recording orphan. Error: %s",
            target.minio_bucket,
            target.minio_key,
            exc,
        )
        # Record for cleanup job — use a raw INSERT to stay out of the ORM session
        # that is mid-delete.
        try:
            from sqlalchemy import text as sa_text

            connection.execute(
                sa_text(
                    "INSERT INTO orphaned_s3_objects (id, minio_bucket, minio_key, reason, created_at) "
                    "VALUES (:id, :bucket, :key, :reason, NOW())"
                ),
                {
                    "id": _uuid7(),
                    "bucket": target.minio_bucket,
                    "key": target.minio_key,
                    "reason": str(exc),
                },
            )
        except Exception as inner:
            log.error("AudioCache: could not record orphan either: %s", inner)


event.listen(AudioCache, "after_delete", _audio_cache_after_delete)
