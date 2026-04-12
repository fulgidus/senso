from datetime import UTC, datetime, timedelta
import uuid

import bcrypt
import jwt


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def mint_access_token(
    *, user_id: str, email: str, secret: str, algorithm: str, ttl_seconds: int
) -> tuple[str, int]:
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=ttl_seconds)
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(payload, secret, algorithm=algorithm)
    return token, ttl_seconds


def mint_refresh_token(
    *, user_id: str, secret: str, algorithm: str, ttl_seconds: int, jti: str
) -> tuple[str, datetime]:
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=ttl_seconds)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": jti,
    }
    token = jwt.encode(payload, secret, algorithm=algorithm)
    return token, expires_at


def decode_token(token: str, *, secret: str, algorithm: str) -> dict:
    return jwt.decode(token, secret, algorithms=[algorithm])
