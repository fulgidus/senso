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
    response = client.get("/auth/google/start")
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
