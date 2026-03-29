from unittest.mock import patch

from app.main import create_app


def test_cors_allows_frontend_url_when_frontend_origins_missing(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://senso.fulgid.us")
    monkeypatch.delenv("FRONTEND_ORIGINS", raising=False)

    app = create_app()

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        response = client.options(
            "/coaching/chat",
            headers={
                "Origin": "https://senso.fulgid.us",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://senso.fulgid.us"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_keeps_frontend_url_even_when_extra_origins_are_configured(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://senso.fulgid.us")
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://staging.senso.fulgid.us")

    app = create_app()

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        response = client.options(
            "/coaching/chat",
            headers={
                "Origin": "https://senso.fulgid.us",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://senso.fulgid.us"


def test_chat_500_returns_json_and_cors_headers(monkeypatch):
    """500 responses must still carry CORS headers so the browser can read the body."""
    monkeypatch.setenv("FRONTEND_URL", "https://senso.fulgid.us")
    monkeypatch.delenv("FRONTEND_ORIGINS", raising=False)

    app = create_app()

    from fastapi.testclient import TestClient

    with TestClient(app, raise_server_exceptions=False) as no_raise_client:
        signup = no_raise_client.post(
            "/auth/signup",
            json={"email": "cors500@example.com", "password": "Test1234!"},
        )
        token = signup.json()["accessToken"]

        with patch(
            "app.api.coaching._prepare_chat_result", side_effect=RuntimeError("boom")
        ):
            response = no_raise_client.post(
                "/coaching/chat",
                headers={
                    "authorization": f"Bearer {token}",
                    "origin": "https://senso.fulgid.us",
                },
                json={"message": "Posso comprare un laptop?"},
            )

    assert response.status_code == 500
    assert response.json() == {
        "detail": {
            "code": "internal_server_error",
            "message": "Internal server error",
        }
    }
    assert response.headers["access-control-allow-origin"] == "https://senso.fulgid.us"
