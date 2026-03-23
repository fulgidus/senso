from datetime import UTC, datetime

from app.db.models import RefreshSession, User


class InMemoryDB:
    def __init__(self) -> None:
        self.users_by_id: dict[str, User] = {}
        self.users_by_email: dict[str, User] = {}
        self.refresh_sessions_by_jti: dict[str, RefreshSession] = {}

    def create_user(self, user: User) -> User:
        normalized = user.email.lower()
        if normalized in self.users_by_email:
            raise ValueError("email_already_exists")
        self.users_by_id[user.id] = user
        self.users_by_email[normalized] = user
        return user

    def get_user_by_email(self, email: str) -> User | None:
        return self.users_by_email.get(email.lower())

    def get_user_by_id(self, user_id: str) -> User | None:
        return self.users_by_id.get(user_id)

    def create_refresh_session(self, session: RefreshSession) -> RefreshSession:
        self.refresh_sessions_by_jti[session.token_jti] = session
        return session

    def get_refresh_session_by_jti(self, jti: str) -> RefreshSession | None:
        return self.refresh_sessions_by_jti.get(jti)

    def revoke_refresh_session(self, jti: str) -> RefreshSession | None:
        session = self.refresh_sessions_by_jti.get(jti)
        if session is None:
            return None
        session.revoked_at = datetime.now(UTC)
        return session


db = InMemoryDB()
