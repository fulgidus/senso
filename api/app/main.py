from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.coaching import router as coaching_router
from app.api.ingestion import router as ingestion_router
from app.api.profile import router as profile_router
from app.core.config import get_settings
from app.db.session import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="S.E.N.S.O. API", version="0.1.0", lifespan=lifespan)
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.frontend_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(ingestion_router)
    app.include_router(admin_router)
    app.include_router(profile_router)
    app.include_router(coaching_router)

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
