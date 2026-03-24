from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    app = FastAPI(title="S.E.N.S.O. API", version="0.1.0")
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.frontend_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
