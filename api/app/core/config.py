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
    stale_upload_timeout_seconds: int
    # MinIO object storage fields
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_bucket: str  # user uploads — treat as sensitive, do not nuke
    minio_tts_bucket: str  # TTS audio cache — safe to nuke entirely
    # Debug flags
    llm_debug: bool
    # Database URL
    database_url: str
    # Seed users: list of (email, password) tuples to create on first startup
    default_users: tuple[tuple[str, str], ...]
    # Emails that receive is_admin=True automatically on registration
    starting_admins: frozenset[str]
    # ElevenLabs TTS settings
    elevenlabs_api_key: str | None

    @property
    def google_enabled(self) -> bool:
        return bool(
            self.google_client_id
            and self.google_client_secret
            and self.google_redirect_uri
        )

    @property
    def tts_enabled(self) -> bool:
        return bool(self.elevenlabs_api_key)


def _parse_default_users(raw: str) -> tuple[tuple[str, str], ...]:
    """Parse DEFAULT_USERS env var into (email, password) pairs.

    Format: ``email:password,email2:pass:with:colons``
    Split on the *first* colon only so passwords may contain colons.
    """
    result = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split(":", 1)
        if len(parts) != 2:
            continue
        email, password = parts[0].strip(), parts[1]
        if email and password:
            result.append((email, password))
    return tuple(result)


def get_settings() -> Settings:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    raw_origins = os.getenv("FRONTEND_ORIGINS")

    def normalize_origin(value: str) -> str:
        parsed = urlparse(value.strip())
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
        return value.strip().rstrip("/")

    origin_values: list[str] = []
    if raw_origins:
        origin_values.extend(
            normalize_origin(origin)
            for origin in raw_origins.split(",")
            if origin.strip()
        )
    origin_values.append(normalize_origin(frontend_url))

    frontend_origins = tuple(dict.fromkeys(origin_values))

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
        stale_upload_timeout_seconds=int(
            os.getenv("STALE_UPLOAD_TIMEOUT_SECONDS", str(15 * 60))
        ),
        # MinIO fields
        minio_endpoint=os.getenv("MINIO_ENDPOINT_URL", "http://minio:9000"),
        minio_access_key=os.getenv("MINIO_ROOT_USER", "minioadmin"),
        minio_secret_key=os.getenv("MINIO_ROOT_PASSWORD", "minioadmin"),
        minio_bucket=os.getenv("MINIO_BUCKET", "senso-uploads"),
        minio_tts_bucket=os.getenv("MINIO_TTS_BUCKET", "senso-tts-audio"),
        # Debug flags
        llm_debug=os.getenv("LLM_DEBUG", "false").lower() == "true",
        # Database URL
        database_url=os.getenv(
            "DATABASE_URL", "postgresql://senso:senso@postgres:5432/senso"
        ),
        # Seed users - format: "email:password,email2:pass:with:colons"
        default_users=_parse_default_users(os.getenv("DEFAULT_USERS", "")),
        # Starting admins - comma-separated emails granted is_admin on registration
        starting_admins=frozenset(
            e.strip().lower()
            for e in os.getenv("STARTING_ADMINS", "").split(",")
            if e.strip()
        ),
        # ElevenLabs TTS settings
        elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY"),
    )
