from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.models import RefreshSession, User


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
