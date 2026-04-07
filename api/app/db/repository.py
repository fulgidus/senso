from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.models import (
    CategorizationJob,
    ExtractedDocument,
    FinancialTimeline,
    MerchantMap,
    ModerationLog,
    Notification,
    RefreshSession,
    TagVocabulary,
    Transaction,
    Upload,
    User,
    UserProfile,
)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    """Look up a user by $username or !admin_handle."""
    if username.startswith("!"):
        return db.query(User).filter(User.admin_handle == username).first()
    return db.query(User).filter(User.username == username).first()


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


def get_confirmed_upload_ids(db: Session, user_id: str) -> list[str]:
    """Return sorted list of confirmed upload IDs for fingerprint computation."""
    rows = (
        db.query(Upload.id)
        .filter(Upload.user_id == user_id, Upload.confirmed == True)  # noqa: E712
        .all()
    )
    return sorted(str(row[0]) for row in rows)


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


# ─── MerchantMap ─────────────────────────────────────────────────────────────


def lookup_merchant_map(db: Session, description_raw: str) -> MerchantMap | None:
    """Exact match first; falls back to startswith prefix match (case-insensitive).
    Never returns blacklisted entries."""
    # Exact match
    row = (
        db.query(MerchantMap)
        .filter(
            MerchantMap.description_raw == description_raw,
            MerchantMap.is_blacklisted == False,  # noqa: E712
        )
        .first()
    )
    if row:
        return row
    # Prefix match: description_raw starts with stored key (normalised lower)
    normalised = description_raw.lower()
    candidates = (
        db.query(MerchantMap)
        .filter(MerchantMap.is_blacklisted == False)  # noqa: E712
        .all()
    )
    for candidate in candidates:
        if normalised.startswith(candidate.description_raw.lower()):
            return candidate
    return None


def write_merchant_map(
    db: Session,
    description_raw: str,
    category: str,
    confidence: float,
    learned_method: str,
    canonical_merchant: str | None = None,
    learned_provider_model: str | None = None,
    contributing_user_id: str | None = None,
    contributing_job_id: str | None = None,
    contributing_upload_id: str | None = None,
) -> MerchantMap:
    """Upsert: if exact description_raw exists (non-blacklisted), update it. Else insert."""
    existing = (
        db.query(MerchantMap)
        .filter(
            MerchantMap.description_raw == description_raw,
            MerchantMap.is_blacklisted == False,  # noqa: E712
        )
        .first()
    )
    if existing:
        existing.category = category
        existing.confidence = confidence
        existing.learned_method = learned_method
        existing.learned_provider_model = learned_provider_model
        existing.learned_at = datetime.now(UTC)
        if contributing_user_id:
            existing.contributing_user_id = contributing_user_id
        db.add(existing)
        return existing
    row = MerchantMap(
        description_raw=description_raw,
        canonical_merchant=canonical_merchant,
        category=category,
        confidence=confidence,
        learned_method=learned_method,
        learned_provider_model=learned_provider_model,
        contributing_user_id=contributing_user_id,
        contributing_job_id=contributing_job_id,
        contributing_upload_id=contributing_upload_id,
    )
    db.add(row)
    return row


# ─── FinancialTimeline ────────────────────────────────────────────────────────


def get_timeline_events(
    db: Session, user_id: str, include_dismissed: bool = False
) -> list[FinancialTimeline]:
    """Return timeline events for a user, newest first."""
    q = db.query(FinancialTimeline).filter(FinancialTimeline.user_id == user_id)
    if not include_dismissed:
        q = q.filter(FinancialTimeline.is_user_dismissed == False)  # noqa: E712
    return q.order_by(FinancialTimeline.event_date.desc()).all()


def upsert_timeline_event(
    db: Session,
    user_id: str,
    event_type: str,
    event_date,
    title: str,
    description: str | None = None,
    evidence_json: dict | None = None,
) -> FinancialTimeline:
    """Insert or update a timeline event (matched on user_id + event_type + event_date)."""
    existing = (
        db.query(FinancialTimeline)
        .filter(
            FinancialTimeline.user_id == user_id,
            FinancialTimeline.event_type == event_type,
            FinancialTimeline.event_date == event_date,
        )
        .first()
    )
    if existing:
        existing.title = title
        existing.description = description
        existing.evidence_json = evidence_json
        db.add(existing)
        return existing
    row = FinancialTimeline(
        user_id=user_id,
        event_type=event_type,
        event_date=event_date,
        title=title,
        description=description,
        evidence_json=evidence_json,
    )
    db.add(row)
    return row


def get_timeline_event(db: Session, event_id: str) -> FinancialTimeline | None:
    return db.query(FinancialTimeline).filter(FinancialTimeline.id == event_id).first()


def dismiss_timeline_event(
    db: Session, event_id: str, reason: str, detail: str | None = None
) -> FinancialTimeline | None:
    row = get_timeline_event(db, event_id)
    if row:
        row.is_user_dismissed = True
        row.dismissed_reason = reason
        row.dismissed_detail = detail
        db.add(row)
    return row


def set_timeline_context(
    db: Session, event_id: str, raw: str
) -> FinancialTimeline | None:
    row = get_timeline_event(db, event_id)
    if row:
        row.user_context_raw = raw
        row.context_tos_status = "pending"
        db.add(row)
    return row


# ─── Notifications ───────────────────────────────────────────────────────────


def create_notification(
    db: Session,
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    action_url: str | None = None,
) -> Notification:
    row = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        body=body,
        action_url=action_url,
    )
    db.add(row)
    return row


def get_notifications(
    db: Session, user_id: str, limit: int = 20, offset: int = 0
) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def count_unread_notifications(db: Session, user_id: str) -> int:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .count()
    )


def mark_notification_read(
    db: Session, notification_id: str, user_id: str
) -> Notification | None:
    row = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if row:
        row.is_read = True
        db.add(row)
    return row


def mark_all_notifications_read(db: Session, user_id: str) -> int:
    """Returns count of updated rows."""
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .all()
    )
    for row in rows:
        row.is_read = True
        db.add(row)
    return len(rows)


# ─── ModerationLog ───────────────────────────────────────────────────────────


def log_moderation(
    db: Session,
    user_id: str,
    content_type: str,
    raw_input: str,
    detected_violations: list,
    severity: str,
    action_taken: str,
    content_ref_id: str | None = None,
) -> ModerationLog:
    row = ModerationLog(
        user_id=user_id,
        content_type=content_type,
        content_ref_id=content_ref_id,
        raw_input=raw_input,
        detected_violations=detected_violations,
        severity=severity,
        action_taken=action_taken,
    )
    db.add(row)
    return row


def count_violations_for_user(db: Session, user_id: str) -> int:
    """Count non-clean moderation events for progressive penalty logic."""
    return (
        db.query(ModerationLog)
        .filter(
            ModerationLog.user_id == user_id,
            ModerationLog.severity != "clean",
        )
        .count()
    )


# ── Phase 14: E2E messaging recipient hash helpers ──────────────────────────

import hashlib as _hashlib


def compute_recipient_hash(username: str) -> str:
    """Return sha256($username) hex digest for zero-knowledge recipient routing.

    D-01: Hash input is sha256($username) - include the ``$`` prefix verbatim.
    D-02: Deterministic - same hash always for a given username.
    D-03: Admin !handle usernames are NOT hashed (use cleartext routing).

    Args:
        username: Must include the ``$`` prefix (e.g. ``$witty-otter-42``).

    Returns:
        64-character lowercase hex sha256 digest.
    """
    return _hashlib.sha256(username.encode()).hexdigest()


def get_all_recipient_hashes(db: Session) -> dict[str, str]:
    """Return mapping of {recipient_hash: user_id} for all $-prefixed usernames.

    Used by POST /messages/send to validate that recipient_hashes exist.
    Admin !handles are excluded (validated separately via get_admin_handles).

    Args:
        db: SQLAlchemy Session.

    Returns:
        Dict mapping sha256($username) hex → user.id for all users with $-usernames.
    """
    rows = (
        db.query(User.username, User.id)
        .filter(User.username.isnot(None), User.username.like("$%"))
        .all()
    )
    return {compute_recipient_hash(row.username): row.id for row in rows}


def get_admin_handles(db: Session) -> set[str]:
    """Return the set of all non-null admin_handle values (cleartext !handles).

    Used by POST /messages/send to validate !handle recipients.

    Args:
        db: SQLAlchemy Session.

    Returns:
        Set of admin_handle strings (e.g. ``{"!senso-team", "!admin"}``).
    """
    rows = db.query(User.admin_handle).filter(User.admin_handle.isnot(None)).all()
    return {row.admin_handle for row in rows}
