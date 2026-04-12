from unittest.mock import MagicMock

from app.api.auth import get_auth_service
from app.main import app
from app.services.auth_service import AuthError


def test_signup_success(client):
    response = client.post(
        "/auth/signup",
        json={"email": "user@example.com", "password": "password123"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["user"]["email"] == "user@example.com"
    assert "accessToken" in payload
    assert "refreshToken" in payload
    assert payload["expiresIn"] > 0


def test_login_success(client):
    signup = client.post(
        "/auth/signup",
        json={"email": "login@example.com", "password": "password123"},
    )
    assert signup.status_code == 201

    response = client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["email"] == "login@example.com"
    assert "accessToken" in payload
    assert "refreshToken" in payload
    assert payload["user"]["default_persona_id"] == "mentore-saggio"


def test_refresh_rotation_revokes_previous_token(client):
    signup = client.post(
        "/auth/signup",
        json={"email": "rotate@example.com", "password": "password123"},
    )
    assert signup.status_code == 201
    first_refresh = signup.json()["refreshToken"]

    refresh_once = client.post("/auth/refresh", json={"refreshToken": first_refresh})
    assert refresh_once.status_code == 200
    rotated_refresh = refresh_once.json()["refreshToken"]
    assert rotated_refresh != first_refresh

    reuse_old = client.post("/auth/refresh", json={"refreshToken": first_refresh})
    assert reuse_old.status_code in (400, 401)


def test_session_persists_via_refresh_within_rolling_window(client):
    signup = client.post(
        "/auth/signup",
        json={"email": "rolling@example.com", "password": "password123"},
    )
    assert signup.status_code == 201

    refresh = signup.json()["refreshToken"]
    response = client.post("/auth/refresh", json={"refreshToken": refresh})
    assert response.status_code == 200
    payload = response.json()
    assert payload["expiresIn"] > 0
    assert payload["refreshToken"] != refresh


def test_me_requires_valid_access_token(client):
    unauthorized = client.get("/auth/me")
    assert unauthorized.status_code in (401, 403)


def test_me_returns_default_persona_for_legacy_user(client):
    signup = client.post(
        "/auth/signup",
        json={"email": "legacy@example.com", "password": "password123"},
    )
    assert signup.status_code == 201

    access_token = signup.json()["accessToken"]
    response = client.get(
        "/auth/me",
        headers={"authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["default_persona_id"] == "mentore-saggio"


def test_patch_me_persists_default_persona_id(client):
    signup = client.post(
        "/auth/signup",
        json={"email": "persona-pref@example.com", "password": "password123"},
    )
    assert signup.status_code == 201

    access_token = signup.json()["accessToken"]
    patch_response = client.patch(
        "/auth/me",
        headers={"authorization": f"Bearer {access_token}"},
        json={"default_persona_id": "hartman"},
    )

    assert patch_response.status_code == 200
    assert patch_response.json()["default_persona_id"] == "hartman"

    me_response = client.get(
        "/auth/me",
        headers={"authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["user"]["default_persona_id"] == "hartman"


def test_patch_me_rejects_unknown_default_persona_id(client):
    signup = client.post(
        "/auth/signup",
        json={"email": "bad-persona@example.com", "password": "password123"},
    )
    assert signup.status_code == 201

    access_token = signup.json()["accessToken"]
    response = client.patch(
        "/auth/me",
        headers={"authorization": f"Bearer {access_token}"},
        json={"default_persona_id": "unknown-persona"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "code": "invalid_persona",
        "message": "Unknown persona",
    }


def test_logout_revokes_refresh_token(client):
    signup = client.post(
        "/auth/signup",
        json={"email": "logout@example.com", "password": "password123"},
    )
    assert signup.status_code == 201

    refresh = signup.json()["refreshToken"]
    logout = client.post("/auth/logout", json={"refreshToken": refresh})
    assert logout.status_code == 204

    refresh_again = client.post("/auth/refresh", json={"refreshToken": refresh})
    assert refresh_again.status_code in (400, 401)


def test_google_start_returns_fallback_when_provider_not_configured(client):
    mock_service = MagicMock()
    mock_service.get_google_auth_url.side_effect = AuthError(
        "google_unavailable", "Google OAuth is unavailable", status_code=503
    )

    app.dependency_overrides[get_auth_service] = lambda: mock_service
    try:
        response = client.get("/auth/google/start")
    finally:
        app.dependency_overrides.pop(get_auth_service, None)

    assert response.status_code == 503
    payload = response.json()
    assert payload["fallback"] == "email_password"
    assert payload["reason"] == "google_unavailable"


def test_google_start_returns_auth_url_when_provider_configured(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id-123")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "client-secret-abc")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://example.com/auth/callback")

    response = client.get("/auth/google/start")
    assert response.status_code == 200
    payload = response.json()
    assert "authUrl" in payload
    assert "client_id=client-id-123" in payload["authUrl"]
    assert (
        "redirect_uri=https%3A%2F%2Fexample.com%2Fauth%2Fcallback" in payload["authUrl"]
    )


def test_google_callback_returns_fallback_on_failure(client):
    response = client.get("/auth/google/callback", params={"code": "x", "state": "y"})
    assert response.status_code == 503
    payload = response.json()
    assert payload["fallback"] == "email_password"
    assert payload["reason"] == "google_unavailable"


def test_cors_preflight_allows_configured_origin_for_auth_signup(client):
    response = client.options(
        "/auth/signup",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in response.headers["access-control-allow-methods"]


def test_cors_preflight_rejects_non_configured_origin_for_auth_login(client):
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "https://malicious.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
