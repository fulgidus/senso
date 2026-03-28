import os
from dataclasses import dataclass
from urllib.parse import urlparse


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
    frontend_origins: tuple[str, ...]
    # MinIO object storage fields
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_bucket: str
    # Debug flags
    llm_debug: bool
    # Database URL
    database_url: str

    @property
    def google_enabled(self) -> bool:
        return bool(
            self.google_client_id
            and self.google_client_secret
            and self.google_redirect_uri
        )


def get_settings() -> Settings:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    raw_origins = os.getenv("FRONTEND_ORIGINS")

    def normalize_origin(value: str) -> str:
        parsed = urlparse(value.strip())
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
        return value.strip().rstrip("/")

    if raw_origins:
        frontend_origins = tuple(
            normalize_origin(origin)
            for origin in raw_origins.split(",")
            if origin.strip()
        )
    else:
        frontend_origins = (normalize_origin(frontend_url),)

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
        frontend_url=frontend_url,
        frontend_origins=frontend_origins,
        # MinIO fields
        minio_endpoint=os.getenv("MINIO_ENDPOINT_URL", "http://minio:9000"),
        minio_access_key=os.getenv("MINIO_ROOT_USER", "minioadmin"),
        minio_secret_key=os.getenv("MINIO_ROOT_PASSWORD", "minioadmin"),
        minio_bucket=os.getenv("MINIO_BUCKET", "senso-uploads"),
        # Debug flags
        llm_debug=os.getenv("LLM_DEBUG", "false").lower() == "true",
        # Database URL
        database_url=os.getenv(
            "DATABASE_URL", "postgresql://senso:senso@postgres:5432/senso"
        ),
    )
