"""
Tests for Phase 10 T2 column encryption (StringEncryptedType with AesGcmEngine).

Uses in-memory SQLite because StringEncryptedType stores as TEXT regardless of
the underlying DB engine — the encrypt/decrypt logic is in Python, not Postgres.
"""

import os
import pytest

# Set a valid 32-byte test encryption key BEFORE importing any app module
os.environ.setdefault("ENCRYPTION_KEY", "test-enc-key-for-testing-only!!")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-testing-only!")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, Transaction, UserProfile


@pytest.fixture(scope="module")
def test_db():
    """In-memory SQLite DB with all tables created."""
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_t2_string_encrypt_roundtrip(test_db):
    """Transaction.description is encrypted and decrypts back to original value."""
    import uuid
    from decimal import Decimal
    from datetime import date

    txn = Transaction(
        id=str(uuid.uuid4()),
        user_id="user-1",
        upload_id="upload-1",
        date=date.today(),
        amount=Decimal("99.99"),
        description="Acquisto al supermercato Coop",
        type="expense",
    )
    test_db.add(txn)
    test_db.commit()
    test_db.expire(txn)

    loaded = test_db.get(Transaction, txn.id)
    assert loaded is not None
    assert loaded.description == "Acquisto al supermercato Coop", (
        f"Expected original description, got: {loaded.description!r}"
    )


def test_t2_json_encrypt_roundtrip(test_db):
    """UserProfile.insight_cards is encrypted and decrypts back to original list."""
    import uuid
    from datetime import datetime, UTC

    profile = UserProfile(
        id=str(uuid.uuid4()),
        user_id="user-2",
        income_summary={"monthly": 2000.0},
        category_totals={"food": 300.0},
        insight_cards=[{"type": "tip", "text": "Spendi meno al bar"}],
        coaching_insights=[{"id": "ci-1", "text": "Ottima gestione"}],
        updated_at=datetime.now(UTC),
    )
    test_db.add(profile)
    test_db.commit()
    test_db.expire(profile)

    loaded = test_db.get(UserProfile, profile.id)
    assert loaded is not None
    assert loaded.insight_cards == [{"type": "tip", "text": "Spendi meno al bar"}], (
        f"insight_cards mismatch: {loaded.insight_cards!r}"
    )
    assert loaded.income_summary == {"monthly": 2000.0}
