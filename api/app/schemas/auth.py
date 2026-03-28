from pydantic import BaseModel, EmailStr, Field


class UserDTO(BaseModel):
    id: str
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None


class UpdateMeRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None


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
