from datetime import UTC, datetime
from uuid import uuid4

from app.core.config import Settings
from app.core.security import (
    decode_token,
    hash_password,
    mint_access_token,
    mint_refresh_token,
    verify_password,
)
from app.db.models import RefreshSession, User
from app.db.session import InMemoryDB
from app.schemas.auth import AuthResponseDTO, AuthTokensDTO, UserDTO


class AuthError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class AuthService:
    def __init__(self, db: InMemoryDB, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    def signup(self, *, email: str, password: str) -> AuthResponseDTO:
        if self.db.get_user_by_email(email) is not None:
            raise AuthError("email_in_use", "Email already registered", status_code=409)

        user = User(
            id=str(uuid4()),
            email=email.lower(),
            password_hash=hash_password(password),
            created_at=datetime.now(UTC),
        )
        self.db.create_user(user)
        return self._issue_auth_response(user)

    def login(self, *, email: str, password: str) -> AuthResponseDTO:
        user = self.db.get_user_by_email(email)
        if user is None or not verify_password(password, user.password_hash):
            raise AuthError(
                "invalid_credentials", "Invalid email or password", status_code=401
            )
        return self._issue_auth_response(user)

    def refresh(self, *, refresh_token: str) -> AuthTokensDTO:
        claims = self._decode(refresh_token)
        if claims.get("type") != "refresh":
            raise AuthError("invalid_token", "Invalid refresh token", status_code=401)

        session = self.db.get_refresh_session_by_jti(claims["jti"])
        if session is None:
            raise AuthError(
                "invalid_token", "Refresh token not recognized", status_code=401
            )
        if session.revoked_at is not None:
            raise AuthError(
                "token_revoked", "Refresh token already used", status_code=401
            )
        if session.expires_at <= datetime.now(UTC):
            raise AuthError("token_expired", "Refresh token expired", status_code=401)

        user = self.db.get_user_by_id(session.user_id)
        if user is None:
            raise AuthError("invalid_token", "User not found", status_code=401)

        self.db.revoke_refresh_session(session.token_jti)
        return self._issue_tokens(user)

    def get_current_user(self, *, access_token: str) -> UserDTO:
        claims = self._decode(access_token)
        if claims.get("type") != "access":
            raise AuthError("invalid_token", "Invalid access token", status_code=401)

        user = self.db.get_user_by_id(claims["sub"])
        if user is None:
            raise AuthError("invalid_token", "User not found", status_code=401)
        return UserDTO(id=user.id, email=user.email)

    def logout(self, *, refresh_token: str) -> None:
        claims = self._decode(refresh_token)
        if claims.get("type") != "refresh":
            raise AuthError("invalid_token", "Invalid refresh token", status_code=401)

        session = self.db.get_refresh_session_by_jti(claims["jti"])
        if session is None:
            raise AuthError(
                "invalid_token", "Refresh token not recognized", status_code=401
            )
        self.db.revoke_refresh_session(session.token_jti)

    def get_google_auth_url(self) -> str:
        if not self.settings.google_enabled:
            raise AuthError(
                "google_unavailable", "Google OAuth is unavailable", status_code=503
            )

        client_id = self.settings.google_client_id
        redirect_uri = self.settings.google_redirect_uri
        state = str(uuid4())
        return (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={client_id}&redirect_uri={redirect_uri}"
            "&response_type=code&scope=openid%20email%20profile"
            f"&state={state}"
        )

    def exchange_google_callback(self, *, code: str, state: str) -> AuthResponseDTO:
        if not self.settings.google_enabled:
            raise AuthError(
                "google_unavailable", "Google OAuth is unavailable", status_code=503
            )
        raise AuthError(
            "google_unavailable", "Google OAuth exchange failed", status_code=503
        )

    def _issue_auth_response(self, user: User) -> AuthResponseDTO:
        tokens = self._issue_tokens(user)
        return AuthResponseDTO(
            user=UserDTO(id=user.id, email=user.email),
            accessToken=tokens.access_token,
            refreshToken=tokens.refresh_token,
            expiresIn=tokens.expires_in,
        )

    def _issue_tokens(self, user: User) -> AuthTokensDTO:
        access_token, access_ttl = mint_access_token(
            user_id=user.id,
            email=user.email,
            secret=self.settings.jwt_secret,
            algorithm=self.settings.jwt_algorithm,
            ttl_seconds=self.settings.access_token_ttl_seconds,
        )

        refresh_jti = str(uuid4())
        refresh_token, refresh_expires_at = mint_refresh_token(
            user_id=user.id,
            secret=self.settings.jwt_secret,
            algorithm=self.settings.jwt_algorithm,
            ttl_seconds=self.settings.refresh_token_ttl_seconds,
            jti=refresh_jti,
        )
        self.db.create_refresh_session(
            RefreshSession(
                id=str(uuid4()),
                user_id=user.id,
                token_jti=refresh_jti,
                expires_at=refresh_expires_at,
            )
        )

        return AuthTokensDTO(
            accessToken=access_token,
            refreshToken=refresh_token,
            expiresIn=access_ttl,
        )

    def _decode(self, token: str) -> dict:
        try:
            return decode_token(
                token,
                secret=self.settings.jwt_secret,
                algorithm=self.settings.jwt_algorithm,
            )
        except Exception as exc:
            raise AuthError(
                "invalid_token", "Token validation failed", status_code=401
            ) from exc
