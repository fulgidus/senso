from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.models import (
    CategorizationJob,
    ExtractedDocument,
    RefreshSession,
    TagVocabulary,
    Transaction,
    Upload,
    User,
    UserProfile,
)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user: User) -> User:
    existing = get_user_by_email(db, user.email)
    if existing:
        raise ValueError("email_already_exists")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_refresh_session(db: Session, session: RefreshSession) -> RefreshSession:
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_refresh_session_by_jti(db: Session, jti: str) -> RefreshSession | None:
    return db.query(RefreshSession).filter(RefreshSession.token_jti == jti).first()


def revoke_refresh_session(db: Session, jti: str) -> RefreshSession | None:
    session = get_refresh_session_by_jti(db, jti)
    if session is None:
        return None
    session.revoked_at = datetime.now(UTC)
    db.commit()
    return session


# ────────────────────────────────────────────────────────────────────
# Profile / Categorization repository functions
# ────────────────────────────────────────────────────────────────────


def get_user_profile(db: Session, user_id: str) -> UserProfile | None:
    return db.query(UserProfile).filter(UserProfile.user_id == user_id).first()


def upsert_user_profile(db: Session, user_id: str, **fields) -> UserProfile:
    profile = get_user_profile(db, user_id)
    if profile is None:
        profile = UserProfile(user_id=user_id, **fields)
        db.add(profile)
    else:
        for key, value in fields.items():
            setattr(profile, key, value)
        profile.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(profile)
    return profile


def get_categorization_job(db: Session, user_id: str) -> CategorizationJob | None:
    return (
        db.query(CategorizationJob).filter(CategorizationJob.user_id == user_id).first()
    )


def upsert_categorization_job(db: Session, user_id: str, **fields) -> CategorizationJob:
    job = get_categorization_job(db, user_id)
    if job is None:
        job = CategorizationJob(user_id=user_id, **fields)
        db.add(job)
    else:
        for key, value in fields.items():
            setattr(job, key, value)
    db.commit()
    db.refresh(job)
    return job


def get_confirmed_transactions_for_user(db: Session, user_id: str) -> list[Transaction]:
    """D-29 query contract: confirmed uploads only."""
    from sqlalchemy import select

    confirmed_upload_ids = (
        select(Upload.id)
        .where(Upload.user_id == user_id, Upload.confirmed == True)  # noqa: E712
        .scalar_subquery()
    )
    return (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.upload_id.in_(confirmed_upload_ids),
        )
        .all()
    )


def get_confirmed_payslip_documents(db: Session, user_id: str) -> list:
    """Return extracted payslip documents from confirmed uploads."""
    from sqlalchemy import select

    confirmed_upload_ids = (
        select(Upload.id)
        .where(Upload.user_id == user_id, Upload.confirmed == True)  # noqa: E712
        .scalar_subquery()
    )
    return (
        db.query(ExtractedDocument)
        .filter(
            ExtractedDocument.upload_id.in_(confirmed_upload_ids),
            ExtractedDocument.document_type == "payslip",
        )
        .all()
    )


def get_all_tags(db: Session) -> list[TagVocabulary]:
    return db.query(TagVocabulary).order_by(TagVocabulary.tag).all()


def seed_default_tags(db: Session) -> None:
    """Seed default tag vocabulary if not already present."""
    DEFAULT_TAGS = [
        ("recurring", "Transaction that occurs on a regular schedule"),
        ("subscription", "Paid service with automatic renewal"),
        ("food_delivery", "Food ordered for home delivery"),
        ("fast_food", "Quick service restaurant purchase"),
        ("peer_transfer", "Payment to or from another person"),
        ("savings_transfer", "Movement to/from savings account"),
        ("refund", "Reimbursement or reversal of a previous charge"),
        ("work_income", "Income from primary employment"),
        ("freelance_income", "Income from self-employment or side work"),
        ("interest", "Interest earned on savings or investments"),
        ("utility", "Recurring bill for essential services"),
        ("telecom", "Phone, internet, or TV service"),
        ("hosting", "Web hosting or domain registration"),
        ("tech_tools", "Developer tools, APIs, or AI services"),
        ("transport", "Travel including taxi, rideshare, public transit"),
        ("pet", "Pet-related purchases"),
        ("health", "Pharmacy, medical, or wellness purchases"),
        ("donation", "Charitable or voluntary contributions"),
        ("condominium", "Building maintenance or condo fees"),
    ]
    existing = {t.tag for t in get_all_tags(db)}
    for tag, desc in DEFAULT_TAGS:
        if tag not in existing:
            db.add(TagVocabulary(tag=tag, description=desc))
    db.commit()
