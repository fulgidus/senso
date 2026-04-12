from typing import Literal

from pydantic import BaseModel, EmailStr, Field

VoiceGender = Literal["masculine", "feminine", "neutral", "indifferent"]


class UserDTO(BaseModel):
    id: str
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    is_admin: bool = False
    role: str = "user"
    voice_gender: VoiceGender = "indifferent"
    voice_auto_listen: bool = False
    default_persona_id: str = "mentore-saggio"
    strict_privacy_mode: bool = False
    username: str | None = None
    public_key_b64: str | None = None    # X25519 public key (safe to expose)
    signing_key_b64: str | None = None   # Ed25519 verify key (safe to expose)
    admin_handle: str | None = None      # Phase 14: !-prefixed admin handle
    nacl_pbkdf2_salt: str | None = None             # Phase 13: base64 salt for Argon2id KDF
    nacl_key_login_envelope_b64: str | None = None  # Phase 13: wrapped nacl_master_key
    encrypted_x25519_private_b64: str | None = None # Phase 13: AES-GCM encrypted X25519 private key
    encrypted_ed25519_signing_b64: str | None = None # Phase 13: AES-GCM encrypted Ed25519 signing seed
    nationalities: list[str] = ["IT"]  # Phase 20: ISO 3166-1/2 codes


class UpdateMeRequest(BaseModel):
    first_name: str | None = None
    voice_gender: VoiceGender | None = None
    voice_auto_listen: bool | None = None
    default_persona_id: str | None = None
    strict_privacy_mode: bool | None = None


class AuthTokensDTO(BaseModel):
    access_token: str = Field(alias="accessToken")
    refresh_token: str = Field(alias="refreshToken")
    expires_in: int = Field(alias="expiresIn")

    model_config = {"populate_by_name": True}


class AuthResponseDTO(BaseModel):
    user: UserDTO
    access_token: str = Field(alias="accessToken")
    refresh_token: str = Field(alias="refreshToken")
    expires_in: int = Field(alias="expiresIn")
    recovery_phrase: str | None = Field(default=None, alias="recoveryPhrase")  # one-time, signup only

    model_config = {"populate_by_name": True}


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(alias="refreshToken")

    model_config = {"populate_by_name": True}


class AuthErrorDTO(BaseModel):
    code: str
    message: str


class GoogleStartResponseDTO(BaseModel):
    auth_url: str = Field(alias="authUrl")

    model_config = {"populate_by_name": True}


class AuthFallbackDTO(BaseModel):
    fallback: str
    reason: str | None = None
