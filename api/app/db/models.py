from dataclasses import dataclass
from datetime import datetime


@dataclass
class User:
    id: str
    email: str
    password_hash: str
    created_at: datetime


@dataclass
class RefreshSession:
    id: str
    user_id: str
    token_jti: str
    expires_at: datetime
    revoked_at: datetime | None = None
