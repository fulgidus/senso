from contextlib import asynccontextmanager
import json as _json
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.coaching import router as coaching_router
from app.api.content_admin import router as content_admin_router
from app.api.ingestion import router as ingestion_router
from app.api.profile import router as profile_router
from app.core.config import get_settings
from app.db.session import create_tables


logger = logging.getLogger(__name__)


_500_BODY = _json.dumps(
    {
        "detail": {
            "code": "internal_server_error",
            "message": "Internal server error",
        }
    }
).encode("utf-8")


class CatchAllExceptionMiddleware:
    """Raw ASGI middleware that catches unhandled exceptions.

    Positioned INSIDE CORSMiddleware so that the 500 JSONResponse it
    produces flows back through CORS and receives correct
    ``Access-Control-Allow-Origin`` headers.  Without this, the browser
    reports the error as a CORS failure because Starlette's built-in
    ``ServerErrorMiddleware`` returns 500 *outside* the CORS pipeline.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        try:
            await self.app(scope, receive, send)
        except Exception:
            request_path = scope.get("path", "?")
            request_method = scope.get("method", "?")
            logger.exception(
                "Unhandled API error on %s %s", request_method, request_path
            )
            # Build a minimal HTTP response manually.
            await send(
                {
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [
                        [b"content-type", b"application/json"],
                        [b"content-length", str(len(_500_BODY)).encode()],
                    ],
                }
            )
            await send({"type": "http.response.body", "body": _500_BODY})


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="S.E.N.S.O. API", version="0.1.0", lifespan=lifespan)
    settings = get_settings()

    # Middleware stack order (outermost → innermost):
    #   1. CORSMiddleware              — adds Access-Control-* headers to ALL responses
    #   2. CatchAllExceptionMiddleware — catches crashes → structured 500 JSON
    #
    # add_middleware() PREPENDS (makes outermost), so we add the inner one
    # first, then the outer one.
    app.add_middleware(CatchAllExceptionMiddleware)
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
    app.include_router(content_admin_router)
    app.include_router(profile_router)
    app.include_router(coaching_router)

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
