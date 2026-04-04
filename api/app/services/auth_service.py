from datetime import UTC, datetime
import base64
import logging
import os
from urllib.parse import urlencode
from uuid import uuid4

logger = logging.getLogger(__name__)

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import (
    decode_token,
    hash_password,
    mint_access_token,
    mint_refresh_token,
    verify_password,
)
from app.db import repository
from app.db.crypto import server_wrap_user_key
from app.db.models import RefreshSession, User
from app.db.nacl_crypto import (
    generate_x25519_keypair,
    generate_ed25519_keypair,
    generate_nacl_master_key,
    derive_nacl_login_wrap_key,
    wrap_nacl_master_key,
    encrypt_nacl_private_key,
    public_key_b64 as _x25519_pub_b64,
    verify_key_b64 as _ed25519_vk_b64,
    generate_bip39_recovery_phrase,
    wrap_nacl_master_key_with_phrase,
    detect_envelope_version,
    rewrap_all_envelopes,
    b64_decode,
)
from app.personas.loader import _load_config
from app.schemas.auth import AuthResponseDTO, AuthTokensDTO, UpdateMeRequest, UserDTO
from app.services.username_generator import generate_username, generate_admin_username


_DEFAULT_PERSONA_ID = "mentore-saggio"


def _to_user_dto(user: User) -> UserDTO:
    """Convert a User ORM object to UserDTO. Single source of truth for DTO shape."""
    return UserDTO(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=user.is_admin,
        role=user.role or "user",
        voice_gender=user.voice_gender or "indifferent",
        voice_auto_listen=bool(user.voice_auto_listen),
        default_persona_id=user.default_persona_id or _DEFAULT_PERSONA_ID,
        strict_privacy_mode=bool(user.strict_privacy_mode),
        username=user.username,
        public_key_b64=user.public_key_b64,
        signing_key_b64=user.signing_key_b64,
        admin_handle=user.admin_handle,
        nacl_pbkdf2_salt=user.nacl_pbkdf2_salt,
        nacl_key_login_envelope_b64=user.nacl_key_login_envelope_b64,
        encrypted_x25519_private_b64=user.encrypted_x25519_private_b64,
        encrypted_ed25519_signing_b64=user.encrypted_ed25519_signing_b64,
    )


def _valid_persona_ids() -> set[str]:
    return {
        persona.get("id")
        for persona in _load_config().get("personas", [])
        if isinstance(persona.get("id"), str)
    }


class AuthError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class AuthService:
    def __init__(self, db: Session, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    def signup(self, *, email: str, password: str) -> AuthResponseDTO:
        if repository.get_user_by_email(self.db, email) is not None:
            raise AuthError("email_in_use", "Email already registered", status_code=409)

        email_lower = email.lower()
        is_admin = email_lower in self.settings.starting_admins

        user = User(
            id=str(uuid4()),
            email=email_lower,
            password_hash=hash_password(password),
            is_admin=is_admin,
            role="admin" if is_admin else "user",
        )
        repository.create_user(self.db, user)
        # Generate and store a wrapped data key for the new user (server-held for now)
        enc_key, salt_b64 = server_wrap_user_key(user.id)
        user.encrypted_user_key = enc_key
        user.pbkdf2_salt = salt_b64
        # ── Phase 13: Crypto identity ──────────────────────────────────────
        user.username = (
            generate_admin_username() if is_admin else generate_username(self.db)
        )
        nacl_salt = os.urandom(32)
        nacl_master_key = generate_nacl_master_key()
        login_wrap_key = derive_nacl_login_wrap_key(password, nacl_salt)
        user.nacl_pbkdf2_salt = base64.b64encode(nacl_salt).decode()
        user.nacl_key_login_envelope_b64 = wrap_nacl_master_key(nacl_master_key, login_wrap_key)
        x25519_sk, x25519_pk = generate_x25519_keypair()
        user.public_key_b64 = _x25519_pub_b64(x25519_pk)
        user.encrypted_x25519_private_b64 = encrypt_nacl_private_key(bytes(x25519_sk), nacl_master_key)
        ed25519_sk, ed25519_vk = generate_ed25519_keypair()
        user.signing_key_b64 = _ed25519_vk_b64(ed25519_vk)
        user.encrypted_ed25519_signing_b64 = encrypt_nacl_private_key(bytes(ed25519_sk), nacl_master_key)
        # ── Phase 14: BIP-39 recovery envelope ───────────────────────────────
        recovery_phrase = generate_bip39_recovery_phrase()
        user.nacl_key_recovery_envelope_b64 = wrap_nacl_master_key_with_phrase(
            nacl_master_key, recovery_phrase, nacl_salt
        )
        # ──────────────────────────────────────────────────────────────────
        # ──────────────────────────────────────────────────────────────────
        self.db.commit()
        return self._issue_auth_response(user, recovery_phrase=recovery_phrase)

    def login(self, *, email: str, password: str) -> AuthResponseDTO:
        user = repository.get_user_by_email(self.db, email)
        if user is None or not verify_password(password, user.password_hash):
            raise AuthError(
                "invalid_credentials", "Invalid email or password", status_code=401
            )
        # ── Phase 15: Transparent v1→v2 envelope migration ────────────────────
        if (
            user.nacl_key_login_envelope_b64
            and detect_envelope_version(user.nacl_key_login_envelope_b64) == "v1"
        ):
            try:
                salt_bytes = b64_decode(user.nacl_pbkdf2_salt)
                new_blobs = rewrap_all_envelopes(
                    password=password,
                    nacl_pbkdf2_salt=salt_bytes,
                    nacl_key_login_envelope_b64=user.nacl_key_login_envelope_b64,
                    encrypted_x25519_private_b64=user.encrypted_x25519_private_b64,
                    encrypted_ed25519_signing_b64=user.encrypted_ed25519_signing_b64,
                    nacl_key_recovery_envelope_b64=getattr(user, "nacl_key_recovery_envelope_b64", None),
                    recovery_phrase=None,  # Re-wrap recovery only when phrase is available
                )
                for col, val in new_blobs.items():
                    setattr(user, col, val)
                self.db.commit()
                self.db.refresh(user)
                logger.info(
                    "Migrated envelopes v1→v2 for user %s", user.username
                )
            except Exception as exc:
                logger.warning(
                    "Envelope migration failed for %s: %s", user.username, exc
                )
                self.db.rollback()
        # ── End Phase 15 migration ────────────────────────────────────────────
        return self._issue_auth_response(user)

    def refresh(self, *, refresh_token: str) -> AuthTokensDTO:
        claims = self._decode(refresh_token)
        if claims.get("type") != "refresh":
            raise AuthError("invalid_token", "Invalid refresh token", status_code=401)

        session = repository.get_refresh_session_by_jti(self.db, claims["jti"])
        if session is None:
            raise AuthError(
                "invalid_token", "Refresh token not recognized", status_code=401
            )
        if session.revoked_at is not None:
            raise AuthError(
                "token_revoked", "Refresh token already used", status_code=401
            )
        # Handle timezone-naive datetimes from SQLite test env (strip tz for comparison)
        expires_at = session.expires_at
        now = datetime.now(UTC)
        if expires_at.tzinfo is None:
            now = datetime.utcnow()  # noqa: DTZ003
        if expires_at <= now:
            raise AuthError("token_expired", "Refresh token expired", status_code=401)

        user = repository.get_user_by_id(self.db, session.user_id)
        if user is None:
            raise AuthError("invalid_token", "User not found", status_code=401)

        repository.revoke_refresh_session(self.db, session.token_jti)
        return self._issue_tokens(user)

    def get_current_user(self, *, access_token: str) -> UserDTO:
        claims = self._decode(access_token)
        if claims.get("type") != "access":
            raise AuthError("invalid_token", "Invalid access token", status_code=401)

        user = repository.get_user_by_id(self.db, claims["sub"])
        if user is None:
            raise AuthError("invalid_token", "User not found", status_code=401)
        return _to_user_dto(user)

    def logout(self, *, refresh_token: str) -> None:
        claims = self._decode(refresh_token)
        if claims.get("type") != "refresh":
            raise AuthError("invalid_token", "Invalid refresh token", status_code=401)

        session = repository.get_refresh_session_by_jti(self.db, claims["jti"])
        if session is None:
            raise AuthError(
                "invalid_token", "Refresh token not recognized", status_code=401
            )
        repository.revoke_refresh_session(self.db, session.token_jti)

    def get_google_auth_url(self) -> str:
        if not self.settings.google_enabled:
            raise AuthError(
                "google_unavailable", "Google OAuth is unavailable", status_code=503
            )

        client_id = self.settings.google_client_id or ""
        redirect_uri = self.settings.google_redirect_uri or ""
        state = str(uuid4())
        query = urlencode(
            {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
            }
        )
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

    def exchange_google_callback(self, *, code: str, state: str) -> AuthResponseDTO:
        if not self.settings.google_enabled or not code or not state:
            raise AuthError(
                "google_unavailable", "Google OAuth is unavailable", status_code=503
            )
        raise AuthError(
            "google_unavailable", "Google OAuth exchange failed", status_code=503
        )

    def _issue_auth_response(self, user: User, *, recovery_phrase: str | None = None) -> AuthResponseDTO:
        tokens = self._issue_tokens(user)
        return AuthResponseDTO(
            user=_to_user_dto(user),
            accessToken=tokens.access_token,
            refreshToken=tokens.refresh_token,
            expiresIn=tokens.expires_in,
            recoveryPhrase=recovery_phrase,
        )

    def update_me(self, *, user_id: str, payload: UpdateMeRequest) -> UserDTO:
        user = repository.get_user_by_id(self.db, user_id)
        if user is None:
            raise AuthError("user_not_found", "User not found", status_code=404)
        if payload.first_name is not None:
            user.first_name = payload.first_name.strip() or None
        if payload.last_name is not None:
            user.last_name = payload.last_name.strip() or None
        if payload.voice_gender is not None:
            user.voice_gender = payload.voice_gender
        if payload.voice_auto_listen is not None:
            user.voice_auto_listen = payload.voice_auto_listen
        if payload.default_persona_id is not None:
            default_persona_id = payload.default_persona_id.strip()
            if default_persona_id not in _valid_persona_ids():
                raise AuthError("invalid_persona", "Unknown persona", status_code=422)
            user.default_persona_id = default_persona_id
        if payload.strict_privacy_mode is not None:
            user.strict_privacy_mode = payload.strict_privacy_mode
        self.db.commit()
        self.db.refresh(user)
        return _to_user_dto(user)

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
        repository.create_refresh_session(
            self.db,
            RefreshSession(
                id=str(uuid4()),
                user_id=user.id,
                token_jti=refresh_jti,
                expires_at=refresh_expires_at,
            ),
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
