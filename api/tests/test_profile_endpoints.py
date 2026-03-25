"""Tests for /profile endpoints."""


def _register_and_login(client, email="test@example.com"):
    client.post("/auth/signup", json={"email": email, "password": "Test1234!"})
    resp = client.post("/auth/login", json={"email": email, "password": "Test1234!"})
    return resp.json()["accessToken"]


def test_get_profile_no_profile_returns_404(client):
    token = _register_and_login(client)
    resp = client.get("/profile", headers={"authorization": f"Bearer {token}"})
    assert resp.status_code == 404


def test_get_profile_status_no_job_returns_not_started(client):
    token = _register_and_login(client)
    resp = client.get("/profile/status", headers={"authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "not_started"


def test_submit_questionnaire_creates_profile(client):
    token = _register_and_login(client)
    resp = client.post(
        "/profile/questionnaire",
        headers={"authorization": f"Bearer {token}"},
        json={
            "mode": "quick",
            "answers": {
                "employmentType": "employed",
                "monthlyNetIncome": 2000.0,
                "currency": "EUR",
            },
        },
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "saved"


def test_get_profile_without_token_returns_401(client):
    resp = client.get("/profile")
    assert resp.status_code == 401


def test_trigger_categorization_queues_job(client):
    token = _register_and_login(client)
    resp = client.post(
        "/profile/trigger-categorization",
        headers={"authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"


def test_confirm_profile_without_profile_returns_404(client):
    token = _register_and_login(client)
    resp = client.post(
        "/profile/confirm",
        headers={"authorization": f"Bearer {token}"},
        json={"incomeOverride": 2000.0},
    )
    assert resp.status_code == 404
