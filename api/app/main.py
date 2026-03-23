from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="S.E.N.S.O. API", version="0.1.0")

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
