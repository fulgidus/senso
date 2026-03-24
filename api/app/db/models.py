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
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id: str = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: str = Column(String(255), unique=True, nullable=False, index=True)
    password_hash: str = Column(String(255), nullable=False)
    is_admin: bool = Column(Boolean, nullable=False, default=False)
    created_at: datetime = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
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
