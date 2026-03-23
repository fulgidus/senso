from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    jwt_secret: str
    jwt_algorithm: str
    access_token_ttl_seconds: int
    refresh_token_ttl_seconds: int
    google_client_id: str | None
    google_client_secret: str | None
    google_redirect_uri: str | None
    frontend_url: str

    @property
    def google_enabled(self) -> bool:
        return bool(
            self.google_client_id
            and self.google_client_secret
            and self.google_redirect_uri
        )


def get_settings() -> Settings:
    return Settings(
        jwt_secret=os.getenv(
            "JWT_SECRET", "dev-secret-change-me-please-use-at-least-32-bytes"
        ),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        access_token_ttl_seconds=int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", "900")),
        refresh_token_ttl_seconds=int(
            os.getenv("REFRESH_TOKEN_TTL_SECONDS", str(7 * 24 * 60 * 60))
        ),
        google_client_id=os.getenv("GOOGLE_CLIENT_ID"),
        google_client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        google_redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
        frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000"),
    )
