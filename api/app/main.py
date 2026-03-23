from fastapi import FastAPI

from app.api.auth import router as auth_router


def create_app() -> FastAPI:
    app = FastAPI(title="S.E.N.S.O. API", version="0.1.0")
    app.include_router(auth_router)

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
