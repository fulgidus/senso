from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

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
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
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
    chat_sessions = relationship(
        "ChatSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
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


class Upload(Base):
    __tablename__ = "uploads"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
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


class ExtractedDocument(Base):
    __tablename__ = "extracted_documents"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
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


class Transaction(Base):
    __tablename__ = "transactions"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
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


class ExtractionReport(Base):
    __tablename__ = "extraction_reports"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
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


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
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
    questionnaire_answers: dict = Column(JSON, nullable=True, default=None)
    data_sources: list = Column(JSON, nullable=False, default=list)
    extraordinary_income_total: float = Column(Float, nullable=True, default=None)
    months_covered: float = Column(Float, nullable=True, default=None)
    confirmed: bool = Column(Boolean, nullable=False, default=False)
    profile_generated_at: datetime = Column(
        DateTime(timezone=True), nullable=True, default=None
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


class CategorizationJob(Base):
    __tablename__ = "categorization_jobs"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
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
    started_at: datetime | None = Column(
        DateTime(timezone=True), nullable=True, default=None
    )
    completed_at: datetime | None = Column(
        DateTime(timezone=True), nullable=True, default=None
    )
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


class TagVocabulary(Base):
    __tablename__ = "tag_vocabulary"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tag: str = Column(String(64), unique=True, nullable=False, index=True)
    description: str | None = Column(String(255), nullable=True, default=None)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


# ── Coaching models ──────────────────────────────────────────────────────────


class ChatSession(Base):
    """
    A coaching conversation session for a user.
    Persists conversation context across multiple messages.
    NOTE: In production, create a DB migration for this table.
    """

    __tablename__ = "chat_sessions"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: str = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
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

    messages = relationship(
        "ChatMessage",
        back_populates="session",
        order_by="ChatMessage.created_at",
        cascade="all, delete-orphan",
    )
    user = relationship("User", back_populates="chat_sessions")


class ChatMessage(Base):
    """
    A single message within a coaching session.
    role: 'user' or 'assistant'
    """

    __tablename__ = "chat_messages"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    session_id: str = Column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: str = Column(String(16), nullable=False)  # "user" | "assistant"
    content: str = Column(Text, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    session = relationship("ChatSession", back_populates="messages")


class WelcomeCache(Base):
    """
    Persistent cache for LLM-generated welcome messages.

    Cache key is a SHA-3-256 hex digest of:
        "{first_name}:{voice_gender}:{persona_id}:{locale}:{soul_hash}"
    where soul_hash is SHA-3-256 of the persona's soul file content.

    This ensures the cached text is regenerated whenever any personalisation
    input changes (name, gender, persona, locale) or the soul file is edited,
    but is reused across container restarts and worker resets.
    """

    __tablename__ = "welcome_cache"

    cache_key: str = Column(String(64), primary_key=True)  # SHA3-256 hex, 64 chars
    text: str = Column(Text, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
