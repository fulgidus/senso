"""
Tests for Phase 18: ProfileService non-ledger enrichment dispatch.
"""
from __future__ import annotations

import pytest

from app.db.models import UserProfile, User
from app.db.session import SessionLocal
from app.services.profile_service import ProfileService
from app.schemas.ingestion import ExtractedDocument
from decimal import Decimal


def _make_user_and_profile(db) -> tuple[str, str]:
    """Create a user + profile row and return (user_id, profile_id)."""
    from uuid import uuid4
    from datetime import datetime, UTC

    user_id = str(uuid4())
    user = User(
        id=user_id,
        email=f"test_{user_id[:8]}@example.com",
        password_hash="x",
        is_admin=False,
    )
    db.add(user)
    db.flush()

    profile = UserProfile(
        id=str(uuid4()),
        user_id=user_id,
        income_summary={},
        monthly_expenses=0.0,
        monthly_margin=0.0,
        category_totals={},
        insight_cards=[],
        coaching_insights=[],
        data_sources=[],
        verified_income_sources=[],
        fixed_expenses=[],
        one_off_expenses=[],
        confirmed=False,
        updated_at=datetime.now(UTC),
    )
    db.add(profile)
    db.commit()
    return user_id, profile.id


def test_enrich_from_payslip_appends_income(reset_db):
    db = SessionLocal()
    try:
        user_id, _ = _make_user_and_profile(db)
        svc = ProfileService(db=db)

        extraction = ExtractedDocument(
            document_type="payslip",
            net_income=Decimal("1867.75"),
            gross_income=Decimal("2500.00"),
            employer="Acme S.r.l.",
        )
        svc.enrich_from_extraction(user_id, extraction)

        profile = db.query(UserProfile).filter_by(user_id=user_id).first()
        assert len(profile.verified_income_sources) == 1
        entry = profile.verified_income_sources[0]
        assert entry["net_income"] == pytest.approx(1867.75)
        assert entry["employer"] == "Acme S.r.l."
    finally:
        db.close()


def test_enrich_from_utility_bill_upserts_by_provider(reset_db):
    db = SessionLocal()
    try:
        user_id, _ = _make_user_and_profile(db)
        svc = ProfileService(db=db)

        extraction = ExtractedDocument(
            document_type="utility_bill",
            provider="ENEL",
            service_type="luce",
            total_due=Decimal("87.43"),
        )
        svc.enrich_from_extraction(user_id, extraction)

        profile = db.query(UserProfile).filter_by(user_id=user_id).first()
        assert len(profile.fixed_expenses) == 1
        assert profile.fixed_expenses[0]["provider"] == "ENEL"

        # Upload same provider again → should upsert (still 1 entry)
        extraction2 = ExtractedDocument(
            document_type="utility_bill",
            provider="ENEL",
            service_type="luce",
            total_due=Decimal("92.10"),
        )
        # Refresh service with same session
        db.refresh(profile)
        svc.enrich_from_extraction(user_id, extraction2)
        db.refresh(profile)
        assert len(profile.fixed_expenses) == 1
        assert profile.fixed_expenses[0]["monthly_amount"] == pytest.approx(92.10)
    finally:
        db.close()


def test_enrich_from_invoice_appends_one_off(reset_db):
    db = SessionLocal()
    try:
        user_id, _ = _make_user_and_profile(db)
        svc = ProfileService(db=db)

        extraction = ExtractedDocument(
            document_type="invoice",
            merchant="Supplier S.r.l.",
            total_amount=Decimal("1220.00"),
        )
        svc.enrich_from_extraction(user_id, extraction)

        profile = db.query(UserProfile).filter_by(user_id=user_id).first()
        assert len(profile.one_off_expenses) == 1
        assert profile.one_off_expenses[0]["total_amount"] == pytest.approx(1220.0)
    finally:
        db.close()


def test_enrich_from_receipt_appends_one_off(reset_db):
    db = SessionLocal()
    try:
        user_id, _ = _make_user_and_profile(db)
        svc = ProfileService(db=db)

        extraction = ExtractedDocument(
            document_type="receipt",
            merchant="Supermercato Roma",
            total_amount=Decimal("3.59"),
        )
        svc.enrich_from_extraction(user_id, extraction)

        profile = db.query(UserProfile).filter_by(user_id=user_id).first()
        assert len(profile.one_off_expenses) == 1
        assert profile.one_off_expenses[0]["merchant"] == "Supermercato Roma"
    finally:
        db.close()


def test_enrich_bank_statement_no_op(reset_db):
    db = SessionLocal()
    try:
        user_id, _ = _make_user_and_profile(db)
        svc = ProfileService(db=db)

        extraction = ExtractedDocument(document_type="bank_statement")
        svc.enrich_from_extraction(user_id, extraction)

        profile = db.query(UserProfile).filter_by(user_id=user_id).first()
        assert profile.verified_income_sources == []
        assert profile.fixed_expenses == []
        assert profile.one_off_expenses == []
    finally:
        db.close()
